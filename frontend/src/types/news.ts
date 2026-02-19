/* ================================================================
   News Intelligence Radar — Shared TypeScript Types
   Mirrors the backend Java DTOs for full type-safety.
   ================================================================ */

// ── Grade / Importance ────────────────────────────────────────── //
export type NewsGrade = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "N/A";

// ── NewsResponse — mirrors com.example.news_radar.dto.NewsResponse ── //
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

// ── Agent Report ──────────────────────────────────────────────── //
export interface AgentReport {
  id: string;
  title: string;
  /** Markdown-formatted report body */
  content: string;
  createdAt: string;
  keyword?: string;
  newsCount?: number;
}
