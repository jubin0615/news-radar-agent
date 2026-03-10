/**
 * BFF API Route — Trend Briefing proxy (인증 토큰 자동 전달)
 *
 * POST /api/chat/trend-briefing
 * → Java backend POST /api/chat/trend-briefing
 * ← { answer: string, sources: RagSourceItem[] }
 */

import { backendFetch } from "@/lib/backend-fetch";

export const runtime = "nodejs";

export async function POST() {
  try {
    const res = await backendFetch("/api/chat/trend-briefing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      return Response.json({ error: `Backend ${res.status}` }, { status: res.status });
    }

    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Backend unreachable" }, { status: 502 });
  }
}
