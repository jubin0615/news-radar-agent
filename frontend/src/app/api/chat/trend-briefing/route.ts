/**
 * BFF API Route — Trend Briefing proxy
 *
 * POST /api/chat/trend-briefing
 * → Java backend POST /api/chat/trend-briefing
 * ← { answer: string, sources: RagSourceItem[] }
 */

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

export const runtime = "nodejs";

export async function POST() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/chat/trend-briefing`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return Response.json({ error: `Backend ${res.status}` }, { status: res.status });
    }

    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Backend unreachable" }, { status: 502 });
  }
}
