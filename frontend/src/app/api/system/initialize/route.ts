/**
 * BFF API Route — System initialize SSE proxy
 * POST /api/system/initialize → Java backend POST /api/system/initialize (SSE stream)
 */

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

export const runtime = "nodejs";

export async function POST() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/system/initialize`, {
      method: "POST",
      headers: { Accept: "text/event-stream" },
      cache: "no-store",
    });

    if (!res.ok || !res.body) {
      return Response.json(
        { error: `Backend ${res.status}` },
        { status: res.status },
      );
    }

    return new Response(res.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",   // Cloudflare/Nginx 프록시 버퍼링 비활성화
      },
    });
  } catch {
    return Response.json({ error: "Backend unreachable" }, { status: 502 });
  }
}
