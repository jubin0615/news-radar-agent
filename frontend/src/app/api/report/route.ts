/**
 * BFF API Route — Report proxy
 *
 * GET  /api/report?keyword=AI&date=2026-02-19  →  Java backend GET /api/reports
 * POST /api/report                              →  Java backend POST /api/reports/daily
 *
 * 백엔드가 Hard Cutoff를 수행하므로 프론트엔드에서의 추가 필터링은 불필요합니다.
 */

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

export const runtime = "nodejs";

/** Retrieve an existing report */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const keyword = searchParams.get("keyword") ?? "";
  const date = searchParams.get("date") ?? "";

  const qs = new URLSearchParams();
  if (keyword) qs.set("keyword", keyword);
  if (date) qs.set("date", date);

  try {
    const res = await fetch(`${BACKEND_URL}/api/reports?${qs}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) return Response.json({ error: `Backend ${res.status}` }, { status: res.status });
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Backend unreachable" }, { status: 502 });
  }
}

/** Generate a new daily report */
export async function POST() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/reports/daily`, {
      method: "POST",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) return Response.json({ error: `Backend ${res.status}` }, { status: res.status });
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Backend unreachable" }, { status: 502 });
  }
}
