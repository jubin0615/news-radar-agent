/* ================================================================
   News Intelligence Radar — Shared TypeScript Types
   Mirrors the backend Java DTOs for full type-safety.
   ================================================================ */

// ── Grade / Importance ────────────────────────────────────────── //
export type NewsGrade = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "N/A";

// ── NewsItem — mirrors com.example.news_radar.dto.NewsResponse ── //
export interface NewsItem {
  id: number;
  title: string;
  url: string;
  keyword: string;
  summary: string | null;
  importanceScore: number | null;
  grade: NewsGrade;
  category: string | null;
  aiReason: string | null;
  collectedAt: string; // ISO-8601 datetime string
  /** Optional thumbnail — not in backend DTO but useful for UI enrichment */
  thumbnailUrl?: string;
}

// ── Report NewsItem — mirrors ReportResult.NewsItem (Backend DTO) ── //
export interface ReportNewsItem {
  title: string;
  url: string;
  importanceScore: number | null;
  innovationScore: number | null;
  category: string | null;
  summary: string | null;
  aiReason: string | null;
}

// ── Daily Report — mirrors ReportResult (Backend DTO) ── //
export interface DailyReport {
  totalNewsCount: number;
  displayedNewsCount: number;
  trendInsight: string;
  headlines: ReportNewsItem[];
  radarBoard: ReportNewsItem[];
}

// ── Agent Report ──────────────────────────────────────────────── //
export interface AgentReport {
  id: string;
  title: string;
  /** Markdown-formatted report body (legacy fallback) */
  content: string;
  createdAt: string;
  keyword?: string;
  newsCount?: number;
  /** Structured report data — when present, ReportViewer uses component-based rendering */
  reportData?: DailyReport;
}
