/**
 * BFF API Route — News proxy
 *
 * Proxies news API calls to the Java backend (localhost:8081)
 * and normalises the response to match the frontend NewsItem type.
 */

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const keyword = searchParams.get("keyword");

  const backendPath = keyword
    ? `${BACKEND_URL}/api/news/search?keyword=${encodeURIComponent(keyword)}`
    : `${BACKEND_URL}/api/news`;

  try {
    const res = await fetch(backendPath, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      return Response.json({ error: `Backend ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    return Response.json(data);
  } catch {
    return Response.json({ error: "Backend unreachable" }, { status: 502 });
  }
}
