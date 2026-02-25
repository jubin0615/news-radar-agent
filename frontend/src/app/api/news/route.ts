/**
 * BFF API Route — News proxy
 *
 * Proxies news API calls to the Java backend (localhost:8081)
 * and normalises the response to match the frontend NewsItem type.
 */

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";
const LOW_GRADE_MAX_SCORE = 39;

export const runtime = "nodejs";

type NewsApiItem = {
  grade?: string | null;
  importanceScore?: number | null;
  collectedAt?: string | null;
};

function isLowImportance(item: NewsApiItem): boolean {
  if (typeof item.grade === "string" && item.grade.toUpperCase() === "LOW") {
    return true;
  }
  if (typeof item.importanceScore === "number") {
    return item.importanceScore <= LOW_GRADE_MAX_SCORE;
  }
  return false;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const keyword = searchParams.get("keyword");
  const date = searchParams.get("date");

  const backendPath = date
    ? `${BACKEND_URL}/api/news?date=${encodeURIComponent(date)}`
    : keyword
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
    if (!Array.isArray(data)) {
      return Response.json(data);
    }

    let filtered = data.filter((item) => !isLowImportance(item as NewsApiItem));
    if (date) {
      filtered = filtered.filter((item) => {
        const collectedAt = (item as NewsApiItem).collectedAt;
        return typeof collectedAt === "string" && collectedAt.startsWith(date);
      });
    }
    return Response.json(filtered);
  } catch {
    return Response.json({ error: "Backend unreachable" }, { status: 502 });
  }
}
