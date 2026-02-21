/**
 * BFF API Route — Report proxy
 *
 * GET  /api/report?keyword=AI&date=2026-02-19  →  Java backend GET /api/reports
 * POST /api/report                              →  Java backend POST /api/reports/daily
 */

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";
const LOW_GRADE_MAX_SCORE = 39;

export const runtime = "nodejs";

type ReportArticle = {
  grade?: string | null;
  importanceScore?: number | null;
};

type ReportPayload = {
  stats?: {
    totalCount?: number;
    gradeDistribution?: Record<string, number>;
  };
  articles?: ReportArticle[];
};

function isLowImportanceArticle(article: ReportArticle): boolean {
  if (typeof article.grade === "string" && article.grade.toUpperCase() === "LOW") {
    return true;
  }
  if (typeof article.importanceScore === "number") {
    return article.importanceScore <= LOW_GRADE_MAX_SCORE;
  }
  return false;
}

function filterReportForUi(payload: ReportPayload): ReportPayload {
  const articles = Array.isArray(payload.articles)
    ? payload.articles.filter((article) => !isLowImportanceArticle(article))
    : payload.articles;

  const stats = payload.stats
    ? {
        ...payload.stats,
        totalCount: Array.isArray(articles) ? articles.length : payload.stats.totalCount,
        gradeDistribution: payload.stats.gradeDistribution
          ? Object.fromEntries(
              Object.entries(payload.stats.gradeDistribution).filter(
                ([grade]) => grade.toUpperCase() !== "LOW",
              ),
            )
          : payload.stats.gradeDistribution,
      }
    : payload.stats;

  return {
    ...payload,
    stats,
    articles,
  };
}

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
    const payload = (await res.json()) as ReportPayload;
    return Response.json(filterReportForUi(payload));
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
    const payload = (await res.json()) as ReportPayload;
    return Response.json(filterReportForUi(payload));
  } catch {
    return Response.json({ error: "Backend unreachable" }, { status: 502 });
  }
}
