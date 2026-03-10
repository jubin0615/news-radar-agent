/**
 * BFF API Route — SSE proxy for news collection progress (인증 토큰 자동 전달)
 *
 * GET /api/news/collect/stream → Java backend GET /api/news/collect/stream
 * SSE 스트림을 투명하게 프록시합니다.
 */

import { backendFetch } from "@/lib/backend-fetch";

export const runtime = "nodejs";

export async function GET() {
  try {
    const res = await backendFetch("/api/news/collect/stream", {
      headers: { Accept: "text/event-stream" },
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
        "X-Accel-Buffering": "no",   // Cloudflare/Nginx 프록시 버퍼링 비활성화
      },
    });
  } catch {
    return Response.json({ error: "Backend unreachable" }, { status: 502 });
  }
}
