/**
 * BFF (Backend for Frontend) API Route — AG-UI Agent Proxy
 *
 * Receives AG-UI RunAgentInput from HttpAgent (POST),
 * forwards to Java backend (/api/agent),
 * transforms the backend's SSE events into AG-UI standard format,
 * and re-streams to the frontend.
 */

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json();

  // ── Transform AG-UI RunAgentInput → Java Backend AgentRequest ──
  const agentRequest = {
    threadId: body.threadId || "default-thread",
    runId: body.runId || crypto.randomUUID(),
    messages: (body.messages ?? []).map((m: { role: string; content: unknown }) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    })),
    state: body.state ?? {},
    tools: (body.tools ?? []).map((t: { name: string }) => ({
      name: t.name,
      input: {},
    })),
  };

  const runId = agentRequest.runId;
  const threadId = agentRequest.threadId;

  // ── Forward to Java Backend ──
  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND_URL}/api/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(agentRequest),
    });
  } catch (err) {
    return new Response(
      ssePayload({ type: "RUN_ERROR", message: "Backend unreachable", threadId, runId }),
      sseHeaders(),
    );
  }

  if (!backendRes.ok || !backendRes.body) {
    return new Response(
      ssePayload({ type: "RUN_ERROR", message: `Backend ${backendRes.status}`, threadId, runId }),
      sseHeaders(),
    );
  }

  // ── Stream-transform backend SSE → AG-UI SSE ──
  let currentMessageId = "";
  let currentToolCallId = "";

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const reader = backendRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const emit = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Split on double-newline (SSE event boundary)
          let idx: number;
          while ((idx = buffer.indexOf("\n\n")) !== -1) {
            const raw = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);

            // Parse SSE lines
            let dataStr = "";
            for (const line of raw.split("\n")) {
              if (line.startsWith("data:")) {
                dataStr = line.slice(5).trim();
              }
            }
            if (!dataStr) continue;

            let parsed: { type?: string; runId?: string; data?: Record<string, unknown> };
            try {
              parsed = JSON.parse(dataStr);
            } catch {
              continue;
            }

            const evType = parsed.type ?? "";
            const evData = (parsed.data ?? {}) as Record<string, unknown>;

            // ── Map backend events to AG-UI events ──
            switch (evType) {
              case "RUN_STARTED":
                emit({ type: "RUN_STARTED", threadId, runId });
                break;

              case "TEXT_MESSAGE_START": {
                const msgId = `msg-${crypto.randomUUID().slice(0, 8)}`;
                currentMessageId = msgId;
                emit({
                  type: "TEXT_MESSAGE_START",
                  messageId: msgId,
                  role: evData.role ?? "assistant",
                });
                break;
              }

              case "TEXT_MESSAGE_CONTENT": {
                emit({
                  type: "TEXT_MESSAGE_CONTENT",
                  messageId: currentMessageId,
                  delta: evData.delta ?? "",
                });
                break;
              }

              case "TEXT_MESSAGE_END":
                emit({ type: "TEXT_MESSAGE_END", messageId: currentMessageId });
                break;

              case "TOOL_CALL_START": {
                const tcId = `tc-${crypto.randomUUID().slice(0, 8)}`;
                currentToolCallId = tcId;
                emit({
                  type: "TOOL_CALL_START",
                  toolCallId: tcId,
                  toolCallName: evData.toolName ?? "unknown",
                  parentMessageId: currentMessageId || undefined,
                });
                // Emit initial args if keyword etc. present
                const initArgs: Record<string, unknown> = {};
                if (evData.keyword) initArgs.keyword = evData.keyword;
                if (evData.input) initArgs.input = evData.input;
                if (Object.keys(initArgs).length > 0) {
                  emit({
                    type: "TOOL_CALL_ARGS",
                    toolCallId: tcId,
                    delta: JSON.stringify(initArgs),
                  });
                }
                break;
              }

              case "TOOL_CALL_CONTENT": {
                // Progress updates during long-running tool execution.
                // Emit as CUSTOM event (not TOOL_CALL_ARGS) to avoid corrupting
                // the accumulated tool args JSON. State updates are already sent
                // via STATE_DELTA by the backend.
                emit({
                  type: "CUSTOM",
                  name: "TOOL_PROGRESS",
                  value: evData,
                });
                break;
              }

              case "TOOL_CALL_END": {
                // Only emit TOOL_CALL_END — result data is NOT sent as TOOL_CALL_ARGS
                // because useAgent.fetchToolData() fetches it from the BFF API separately.
                // Sending it here would corrupt the accumulated TOOL_CALL_ARGS JSON
                // (concatenating two JSON objects = invalid JSON).
                emit({ type: "TOOL_CALL_END", toolCallId: currentToolCallId });
                break;
              }

              case "STATE_DELTA":
                emit({
                  type: "STATE_DELTA",
                  delta: Array.isArray(parsed.data) ? parsed.data : [],
                });
                break;

              case "RUN_FINISHED":
                emit({ type: "RUN_FINISHED", threadId, runId });
                break;

              default:
                emit({ type: "CUSTOM", name: evType, value: evData });
            }
          }
        }
      } catch {
        // stream interrupted
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, sseHeaders());
}

function sseHeaders(): ResponseInit {
  return {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  };
}

function ssePayload(event: Record<string, unknown>): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
