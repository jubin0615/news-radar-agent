/**
 * useAgent — Custom React hook wrapping AG-UI HttpAgent
 *
 * Provides a React-friendly interface around the framework-agnostic
 * AG-UI client SDK:
 *   • Manages chat items (user messages, assistant messages, tool-call UIs)
 *   • Streams assistant text token-by-token
 *   • Triggers generative UI (NewsCarousel / ReportViewer) on tool calls
 *   • Fetches full tool result data from BFF API routes
 */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { HttpAgent } from "@ag-ui/client";
import type { Message } from "@ag-ui/client";
import { v4 as uuidv4 } from "uuid";
import { agentTools, normalizeToolName, type ToolName } from "@/lib/tools";
import type { NewsItem, AgentReport } from "@/types";

/* ────────────────────────── Chat Item Types ────────────────────────── */

export interface UserChatItem {
  type: "user";
  id: string;
  content: string;
}

export interface AssistantChatItem {
  type: "assistant";
  id: string;
  content: string;
  isStreaming: boolean;
}

export interface ToolCallChatItem {
  type: "tool-call";
  id: string;
  toolName: ToolName;
  toolArgs: Record<string, unknown>;
  status: "loading" | "complete" | "error";
  /** Fetched data — NewsItem[] for search_news, AgentReport for generate_report */
  data?: NewsItem[] | AgentReport;
}

export type ChatItem = UserChatItem | AssistantChatItem | ToolCallChatItem;

/* ──────────────────────────── Hook ──────────────────────────── */

export function useAgent() {
  const [chatItems, setChatItems] = useState<ChatItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // Persistent agent instance (survives re-renders)
  const agentRef = useRef<HttpAgent | null>(null);

  // Lazy-initialise once
  useEffect(() => {
    agentRef.current = new HttpAgent({
      url: "/api/agent",
      threadId: `thread-${uuidv4()}`,
      initialMessages: [],
      initialState: {},
    });
  }, []);

  /* ── Send a user message and start the agent run ── */
  const sendMessage = useCallback(async (text: string) => {
    const agent = agentRef.current;
    if (!agent || isRunning) return;

    // 1) Append user message to AG-UI agent's internal messages list
    const userMsg: Message = { id: uuidv4(), role: "user", content: text };
    agent.messages.push(userMsg);

    // 2) Append user item to React state
    setChatItems((prev) => [...prev, { type: "user", id: userMsg.id, content: text }]);

    setIsRunning(true);

    // Mutable refs used inside subscriber callbacks
    let currentMsgId = "";
    let currentContentBuf = "";
    let currentToolCallId = "";
    let currentToolName: ToolName = "search_news";
    let currentToolArgs = "";

    try {
      await agent.runAgent(
        { tools: agentTools },
        {
          /* ── Text message streaming ── */
          async onTextMessageStartEvent({ event }) {
            currentMsgId = (event as unknown as Record<string, string>).messageId ?? uuidv4();
            currentContentBuf = "";
            setChatItems((prev) => [
              ...prev,
              { type: "assistant", id: currentMsgId, content: "", isStreaming: true },
            ]);
          },

          async onTextMessageContentEvent({ event }) {
            const delta = (event as unknown as Record<string, string>).delta ?? "";
            currentContentBuf += delta;
            const snap = currentContentBuf;
            const mid = currentMsgId;
            setChatItems((prev) =>
              prev.map((item) =>
                item.id === mid && item.type === "assistant"
                  ? { ...item, content: snap }
                  : item,
              ),
            );
          },

          async onTextMessageEndEvent() {
            const mid = currentMsgId;
            setChatItems((prev) =>
              prev.map((item) =>
                item.id === mid && item.type === "assistant"
                  ? { ...item, isStreaming: false }
                  : item,
              ),
            );
          },

          /* ── Tool call events → Generative UI ── */
          async onToolCallStartEvent({ event }) {
            const ev = event as unknown as Record<string, string>;
            currentToolCallId = ev.toolCallId ?? uuidv4();
            currentToolName = normalizeToolName(ev.toolCallName ?? "");
            currentToolArgs = "";
            setChatItems((prev) => [
              ...prev,
              {
                type: "tool-call",
                id: currentToolCallId,
                toolName: currentToolName,
                toolArgs: {},
                status: "loading" as const,
              },
            ]);
          },

          async onToolCallArgsEvent({ event }) {
            const delta = (event as unknown as Record<string, string>).delta ?? "";
            currentToolArgs += delta;
          },

          async onToolCallEndEvent() {
            // Parse accumulated tool args
            let parsed: Record<string, unknown> = {};
            try {
              parsed = JSON.parse(currentToolArgs);
            } catch {
              /* args may be partial / empty */
            }

            const tcId = currentToolCallId;
            const toolName = currentToolName;

            // Update chat item with parsed args (still loading)
            setChatItems((prev) =>
              prev.map((item) =>
                item.id === tcId && item.type === "tool-call"
                  ? { ...item, toolArgs: parsed }
                  : item,
              ),
            );

            // Fetch full result data from BFF API
            try {
              const data = await fetchToolData(toolName, parsed);
              setChatItems((prev) =>
                prev.map((item) =>
                  item.id === tcId && item.type === "tool-call"
                    ? { ...item, status: "complete" as const, data }
                    : item,
                ),
              );
            } catch {
              setChatItems((prev) =>
                prev.map((item) =>
                  item.id === tcId && item.type === "tool-call"
                    ? { ...item, status: "error" as const }
                    : item,
                ),
              );
            }
          },

          /* ── Lifecycle ── */
          async onRunFinishedEvent() {
            setIsRunning(false);
          },

          async onRunErrorEvent() {
            setIsRunning(false);
          },
        },
      );
    } catch (err) {
      console.error("[useAgent] runAgent error:", err);
      // Surface the error in chat
      setChatItems((prev) => [
        ...prev,
        {
          type: "assistant",
          id: uuidv4(),
          content: "⚠️ 에이전트 실행 중 오류가 발생했습니다. 백엔드 서버가 실행 중인지 확인해주세요.",
          isStreaming: false,
        },
      ]);
    } finally {
      setIsRunning(false);
    }
  }, [isRunning]);

  /* ── Clear conversation ── */
  const clearChat = useCallback(() => {
    setChatItems([]);
    if (agentRef.current) {
      agentRef.current.messages = [];
      agentRef.current.state = {};
    }
  }, []);

  return { chatItems, isRunning, sendMessage, clearChat };
}

/* ────────────────── Data fetchers for Generative UI ────────────────── */

async function fetchToolData(
  toolName: ToolName,
  args: Record<string, unknown>,
): Promise<NewsItem[] | AgentReport> {
  switch (toolName) {
    case "search_news": {
      const keyword = typeof args.keyword === "string" ? args.keyword : "";
      const qs = keyword ? `?keyword=${encodeURIComponent(keyword)}` : "";
      const res = await fetch(`/api/news${qs}`);
      if (!res.ok) throw new Error(`news ${res.status}`);
      return (await res.json()) as NewsItem[];
    }

    case "generate_report": {
      const res = await fetch("/api/report", { method: "POST" });
      if (!res.ok) throw new Error(`report ${res.status}`);
      const data = await res.json();
      // Normalise backend ReportResult → AgentReport shape
      return {
        id: `rpt-${Date.now()}`,
        title: `뉴스 데일리 리포트 — ${data.stats?.keyword ?? "전체"}`,
        content: formatReportContent(data),
        createdAt: new Date().toISOString(),
        keyword: data.stats?.keyword,
        newsCount: data.stats?.totalCount,
      } satisfies AgentReport;
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

/** Convert backend ReportResult to a Markdown string for ReportViewer */
function formatReportContent(report: {
  stats?: {
    keyword?: string;
    date?: string;
    totalCount?: number;
    averageScore?: number;
    gradeDistribution?: Record<string, number>;
  };
  articles?: {
    title?: string;
    importanceScore?: number;
    grade?: string;
    category?: string;
    summary?: string;
    aiReason?: string;
  }[];
}): string {
  const s = report.stats;
  const lines: string[] = [];

  lines.push(`# 뉴스 데일리 리포트`);
  lines.push("");
  if (s) {
    lines.push(`## 📊 통계 요약`);
    lines.push("");
    lines.push(`| 항목 | 값 |`);
    lines.push(`|---|---|`);
    if (s.keyword) lines.push(`| 키워드 | ${s.keyword} |`);
    if (s.date) lines.push(`| 날짜 | ${s.date} |`);
    if (s.totalCount != null) lines.push(`| 총 기사 수 | ${s.totalCount}건 |`);
    if (s.averageScore != null) lines.push(`| 평균 중요도 | ${s.averageScore.toFixed(1)}점 |`);
    if (s.gradeDistribution) {
      const grades = Object.entries(s.gradeDistribution)
        .map(([g, c]) => `${g}: ${c}건`)
        .join(", ");
      lines.push(`| 등급 분포 | ${grades} |`);
    }
    lines.push("");
  }

  const articles = report.articles;
  if (articles && articles.length > 0) {
    lines.push(`## 📰 주요 기사`);
    lines.push("");
    articles.forEach((a, i) => {
      lines.push(`### ${i + 1}. ${a.title ?? "제목 없음"}`);
      lines.push(
        `- **중요도**: ${a.grade ?? "N/A"} (${a.importanceScore ?? "-"}점) ・ **카테고리**: ${a.category ?? "-"}`,
      );
      if (a.summary) lines.push(`- ${a.summary}`);
      if (a.aiReason) lines.push(`> 💡 ${a.aiReason}`);
      lines.push("");
    });
  }

  return lines.join("\n");
}
