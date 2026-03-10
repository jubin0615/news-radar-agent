/**
 * BFF API Route — News collection status proxy (인증 토큰 자동 전달)
 *
 * GET /api/news/collection-status → Java backend GET /api/news/collection-status
 */

import { backendFetch } from "@/lib/backend-fetch";

export const runtime = "nodejs";

export async function GET() {
  try {
    const res = await backendFetch("/api/news/collection-status");

    if (!res.ok) {
      return Response.json({ error: `Backend ${res.status}` }, { status: res.status });
    }

    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Backend unreachable" }, { status: 502 });
  }
}
