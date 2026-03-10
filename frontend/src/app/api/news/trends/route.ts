/**
 * BFF API Route — News trends proxy (인증 토큰 자동 전달)
 *
 * GET /api/news/trends?days=7 -> Java backend GET /api/news/trends?days=7
 */

import { backendFetch } from "@/lib/backend-fetch";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const days = searchParams.get("days") ?? "7";

  try {
    const res = await backendFetch(`/api/news/trends?days=${encodeURIComponent(days)}`);

    if (!res.ok) {
      return Response.json({ error: `Backend ${res.status}` }, { status: res.status });
    }

    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Backend unreachable" }, { status: 502 });
  }
}
