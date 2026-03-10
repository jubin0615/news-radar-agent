/**
 * BFF API Route — RAG Chat proxy (인증 토큰 자동 전달)
 *
 * POST /api/chat/rag { question: string }
 * → Java backend POST /api/chat/rag
 * ← { answer: string, sources: RagSourceItem[] }
 */

import { backendFetch } from "@/lib/backend-fetch";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const res = await backendFetch("/api/chat/rag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return Response.json({ error: `Backend ${res.status}` }, { status: res.status });
    }

    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Backend unreachable" }, { status: 502 });
  }
}
