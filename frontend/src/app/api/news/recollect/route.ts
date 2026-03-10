/**
 * BFF API Route — Keyword news re-collection (인증 토큰 자동 전달)
 *
 * POST /api/news/recollect?keyword=AI
 *   → Java backend POST /api/news/recollect?keyword=AI
 *   → 기존 뉴스 소프트 삭제 후 백그라운드 신규 수집 시작 (즉시 반환)
 */

import { backendFetch } from "@/lib/backend-fetch";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const keyword = searchParams.get("keyword");

  if (!keyword) {
    return Response.json({ error: "keyword parameter required" }, { status: 400 });
  }

  try {
    const res = await backendFetch(
      `/api/news/recollect?keyword=${encodeURIComponent(keyword)}`,
      { method: "POST" },
    );

    if (!res.ok) {
      return Response.json({ error: `Backend ${res.status}` }, { status: res.status });
    }

    const message = await res.text();
    return Response.json({ message });
  } catch {
    return Response.json({ error: "Backend unreachable" }, { status: 502 });
  }
}
