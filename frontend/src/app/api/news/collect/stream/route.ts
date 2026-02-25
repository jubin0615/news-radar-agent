/**
 * BFF API Route — SSE proxy for news collection progress
 *
 * GET /api/news/collect/stream → Java backend GET /api/news/collect/stream
 * SSE 스트림을 투명하게 프록시합니다.
 */

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

export const runtime = "nodejs";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/news/collect/stream`, {
      headers: { Accept: "text/event-stream" },
      cache: "no-store",
    });

    if (!res.ok || !res.body) {
      return Response.json(
        { error: `Backend ${res.status}` },
        { status: res.status },
      );
    }

    // SSE 스트림을 그대로 포워딩
    return new Response(res.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch {
    return Response.json({ error: "Backend unreachable" }, { status: 502 });
  }
}
