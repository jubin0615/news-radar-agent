/**
 * BFF API Route — News collect proxy (인증 토큰 자동 전달)
 *
 * POST /api/news/collect → Java backend POST /api/news/collect
 */

import { backendFetch } from "@/lib/backend-fetch";

export const runtime = "nodejs";

export async function POST() {
  try {
    const res = await backendFetch("/api/news/collect", { method: "POST" });

    if (!res.ok) {
      return Response.json({ error: `Backend ${res.status}` }, { status: res.status });
    }

    const text = await res.text();
    return Response.json({ message: text });
  } catch {
    return Response.json({ error: "Backend unreachable" }, { status: 502 });
  }
}
