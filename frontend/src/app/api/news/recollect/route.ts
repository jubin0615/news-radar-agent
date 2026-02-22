/**
 * BFF API Route — Keyword news re-collection
 *
 * POST /api/news/recollect?keyword=AI
 *   → Java backend POST /api/news/recollect?keyword=AI
 *   → 기존 뉴스 소프트 삭제 후 백그라운드 신규 수집 시작 (즉시 반환)
 */

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const keyword = searchParams.get("keyword");

  if (!keyword) {
    return Response.json({ error: "keyword parameter required" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${BACKEND_URL}/api/news/recollect?keyword=${encodeURIComponent(keyword)}`,
      {
        method: "POST",
        headers: { Accept: "application/json" },
      },
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
