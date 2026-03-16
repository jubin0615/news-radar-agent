/**
 * 백엔드 리포트 응답 → 프론트엔드 AgentReport 변환 유틸
 */

import type { AgentReport, DailyReport, ReportNewsItem } from "@/types";

/* ── Backend response shapes ── */

export interface BackendReportItem {
  title?: string;
  url?: string;
  importanceScore?: number | null;
  innovationScore?: number | null;
  aiScore?: number | null;
  category?: string | null;
  summary?: string | null;
  aiReason?: string | null;
}

export interface BackendReportStats {
  keyword?: string;
  date?: string;
  totalCount?: number;
  averageScore?: number;
  gradeDistribution?: Record<string, number>;
}

export interface BackendReport {
  totalNewsCount?: number;
  displayedNewsCount?: number;
  trendInsight?: string;
  headlines?: BackendReportItem[];
  radarBoard?: BackendReportItem[];
  stats?: BackendReportStats;
  articles?: BackendReportItem[];
}

/* ── Helpers ── */

function toNumberOrNull(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toReportNewsItem(raw: BackendReportItem): ReportNewsItem {
  return {
    title: raw.title ?? "제목 없음",
    url: raw.url ?? "",
    importanceScore: toNumberOrNull(raw.importanceScore),
    innovationScore: toNumberOrNull(raw.innovationScore) ?? toNumberOrNull(raw.aiScore),
    category: raw.category ?? null,
    summary: raw.summary ?? null,
    aiReason: raw.aiReason ?? null,
  };
}

function formatGradeDistribution(
  gradeDistribution: BackendReportStats["gradeDistribution"],
): string {
  if (!gradeDistribution) return "";
  return Object.entries(gradeDistribution)
    .filter(([, count]) => Number.isFinite(Number(count)) && Number(count) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([grade, count]) => `${grade}:${count}`)
    .join(", ");
}

/* ── Main builder ── */

export function buildAgentReport(data: BackendReport): AgentReport {
  const hasNewPayload =
    Array.isArray(data.headlines) ||
    Array.isArray(data.radarBoard) ||
    data.totalNewsCount != null ||
    data.displayedNewsCount != null ||
    typeof data.trendInsight === "string";

  let reportData: DailyReport;

  if (hasNewPayload) {
    reportData = {
      totalNewsCount: toNumberOrNull(data.totalNewsCount) ?? 0,
      displayedNewsCount:
        toNumberOrNull(data.displayedNewsCount) ??
        (data.headlines?.length ?? 0) + (data.radarBoard?.length ?? 0),
      trendInsight: data.trendInsight ?? "",
      headlines: (data.headlines ?? []).map(toReportNewsItem),
      radarBoard: (data.radarBoard ?? []).map(toReportNewsItem),
    };
  } else {
    const sortedArticles = (data.articles ?? [])
      .map(toReportNewsItem)
      .sort((a, b) => (b.importanceScore ?? 0) - (a.importanceScore ?? 0));

    const headlines = sortedArticles.slice(0, 3);
    const radarBoard = sortedArticles.slice(3, 9);

    const totalNewsCount = toNumberOrNull(data.stats?.totalCount) ?? sortedArticles.length;
    const averageScore = toNumberOrNull(data.stats?.averageScore);
    const gradeText = formatGradeDistribution(data.stats?.gradeDistribution);

    const trendParts = [
      data.stats?.date ? `${data.stats.date} 기준` : "오늘 기준",
      averageScore != null ? `평균 중요도 ${averageScore.toFixed(1)}점` : null,
      gradeText ? `등급 분포 ${gradeText}` : null,
    ].filter((part): part is string => Boolean(part));

    reportData = {
      totalNewsCount,
      displayedNewsCount: headlines.length + radarBoard.length,
      trendInsight: trendParts.join(" | "),
      headlines,
      radarBoard,
    };
  }

  return {
    id: `rpt-${Date.now()}`,
    title: "뉴스 레이더 데일리 브리핑",
    content: "",
    createdAt: new Date().toISOString(),
    newsCount: reportData.displayedNewsCount,
    reportData,
  };
}
