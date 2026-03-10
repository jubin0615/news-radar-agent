/**
 * BFF API Route - Briefing proxy with resilient fallback. (인증 토큰 자동 전달)
 *
 * Primary: Java backend `/api/news/briefing`.
 * Fallback: Java backend `/api/news` + local filtering/sorting for recent major news.
 */

import { backendFetch } from "@/lib/backend-fetch";

const DEFAULT_HOURS = 48;
const DEFAULT_LIMIT = 5;
const LOW_GRADE_MAX_SCORE = 39;

export const runtime = "nodejs";

type NewsApiItem = {
  id?: number | null;
  grade?: string | null;
  importanceScore?: number | null;
  collectedAt?: string | null;
};

function toPositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toTimestamp(value: string | null | undefined): number {
  if (!value) return Number.NaN;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? Number.NaN : ts;
}

function isMajorNews(item: NewsApiItem): boolean {
  if (typeof item.grade === "string" && item.grade.toUpperCase() === "LOW") {
    return false;
  }
  if (typeof item.importanceScore === "number") {
    return item.importanceScore > LOW_GRADE_MAX_SCORE;
  }
  return false;
}

function sortByImportanceThenCollectedAt(a: NewsApiItem, b: NewsApiItem): number {
  const scoreA = typeof a.importanceScore === "number" ? a.importanceScore : Number.NEGATIVE_INFINITY;
  const scoreB = typeof b.importanceScore === "number" ? b.importanceScore : Number.NEGATIVE_INFINITY;
  if (scoreB !== scoreA) return scoreB - scoreA;

  const collectedA = toTimestamp(a.collectedAt);
  const collectedB = toTimestamp(b.collectedAt);
  if (Number.isNaN(collectedA) && Number.isNaN(collectedB)) return 0;
  if (Number.isNaN(collectedA)) return 1;
  if (Number.isNaN(collectedB)) return -1;
  return collectedB - collectedA;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const hours = toPositiveInt(searchParams.get("hours"), DEFAULT_HOURS);
  const limit = toPositiveInt(searchParams.get("limit"), DEFAULT_LIMIT);

  try {
    const briefingRes = await backendFetch(
      `/api/news/briefing?hours=${encodeURIComponent(String(hours))}&limit=${encodeURIComponent(String(limit))}`,
    );

    if (briefingRes.ok) {
      const data = await briefingRes.json();
      return Response.json(data);
    }

    // Fallback path: backend may be older build without /api/news/briefing.
    const allNewsRes = await backendFetch("/api/news");
    if (!allNewsRes.ok) {
      return Response.json({ error: `Backend ${briefingRes.status}` }, { status: briefingRes.status });
    }

    const allNews = (await allNewsRes.json()) as NewsApiItem[];
    const sinceTs = Date.now() - hours * 60 * 60 * 1000;

    const fallback = allNews
      .filter((item) => {
        const collectedAtTs = toTimestamp(item.collectedAt);
        return !Number.isNaN(collectedAtTs) && collectedAtTs >= sinceTs;
      })
      .filter(isMajorNews)
      .sort(sortByImportanceThenCollectedAt)
      .slice(0, limit);

    return Response.json(fallback, {
      headers: { "x-briefing-fallback": "true" },
    });
  } catch {
    return Response.json({ error: "Backend unreachable" }, { status: 502 });
  }
}
