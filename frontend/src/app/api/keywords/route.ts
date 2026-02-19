/**
 * BFF API Route — Keywords proxy
 *
 * GET    /api/keywords            → Java backend GET  /api/keywords
 * POST   /api/keywords?name=AI    → Java backend POST /api/keywords?name=AI
 */

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

export const runtime = "nodejs";

/** 전체 키워드 목록 조회 */
export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/keywords`, {
      headers: { Accept: "application/json" },
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

/** 키워드 등록 */
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");

  if (!name) {
    return Response.json({ error: "name parameter required" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${BACKEND_URL}/api/keywords?name=${encodeURIComponent(name)}`,
      {
        method: "POST",
        headers: { Accept: "application/json" },
      },
    );

    if (!res.ok) {
      return Response.json({ error: `Backend ${res.status}` }, { status: res.status });
    }

    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Backend unreachable" }, { status: 502 });
  }
}
