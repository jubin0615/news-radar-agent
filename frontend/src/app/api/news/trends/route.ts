/**
 * BFF API Route — News trends proxy
 *
 * GET /api/news/trends?days=7 -> Java backend GET /api/news/trends?days=7
 */

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const days = searchParams.get("days") ?? "7";

  try {
    const res = await fetch(`${BACKEND_URL}/api/news/trends?days=${encodeURIComponent(days)}`, {
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
