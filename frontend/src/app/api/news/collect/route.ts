/**
 * BFF API Route — News collect proxy
 *
 * POST /api/news/collect → Java backend POST /api/news/collect
 */

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

export const runtime = "nodejs";

export async function POST() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/news/collect`, {
      method: "POST",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      return Response.json({ error: `Backend ${res.status}` }, { status: res.status });
    }

    const text = await res.text();
    return Response.json({ message: text });
  } catch {
    return Response.json({ error: "Backend unreachable" }, { status: 502 });
  }
}
