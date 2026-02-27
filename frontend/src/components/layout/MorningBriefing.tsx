"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Star, Radio, Zap, Brain, Tag } from "lucide-react";
import type { NewsItem, NewsGrade } from "@/types";

// ── Grade configuration ───────────────────────────────────────── //
const gradeConfig: Record<
  NewsGrade,
  { color: string; bg: string; border: string; glow: string }
> = {
  CRITICAL: {
    color: "#f87171",
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.35)",
    glow: "0 0 12px rgba(239,68,68,0.20)",
  },
  HIGH: {
    color: "#fbbf24",
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.35)",
    glow: "0 0 12px rgba(245,158,11,0.15)",
  },
  MEDIUM: {
    color: "var(--neon-blue)",
    bg: "rgba(0,212,255,0.08)",
    border: "rgba(0,212,255,0.25)",
    glow: "0 0 10px rgba(0,212,255,0.10)",
  },
  LOW: {
    color: "var(--text-muted)",
    bg: "rgba(255,255,255,0.04)",
    border: "rgba(255,255,255,0.10)",
    glow: "none",
  },
  "N/A": {
    color: "var(--text-muted)",
    bg: "rgba(255,255,255,0.04)",
    border: "rgba(255,255,255,0.10)",
    glow: "none",
  },
};

// ── Importance badge with star rating ────────────────────────── //
function ImportanceBadge({ grade, score }: { grade: NewsGrade; score: number | null }) {
  const cfg = gradeConfig[grade] ?? gradeConfig["N/A"];
  const filledStars = Math.round(Math.min((score ?? 0) / 20, 5));

  return (
    <div className="flex items-center gap-2">
      <span
        className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
        style={{
          background: cfg.bg,
          border: `1px solid ${cfg.border}`,
          color: cfg.color,
          boxShadow: cfg.glow,
        }}
      >
        {grade}
      </span>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            size={10}
            strokeWidth={1.5}
            fill={i < filledStars ? cfg.color : "transparent"}
            style={{ color: i < filledStars ? cfg.color : "rgba(255,255,255,0.15)" }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main article card (large, left column) ────────────────────── //
function MainArticleCard({ news }: { news: NewsItem }) {
  const cfg = gradeConfig[news.grade] ?? gradeConfig["N/A"];

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="glass group relative flex h-full flex-col overflow-hidden rounded-2xl p-6"
      style={{
        border: `1px solid ${cfg.border}`,
        boxShadow: cfg.glow,
        minHeight: 280,
      }}
    >
      {/* Top accent line */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)`,
          opacity: 0.6,
        }}
      />

      {/* MAIN label + importance */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <span
          className="rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-widest"
          style={{
            background: "rgba(0,212,255,0.08)",
            border: "1px solid rgba(0,212,255,0.20)",
            color: "var(--neon-blue)",
          }}
        >
          LEAD
        </span>
        <ImportanceBadge grade={news.grade} score={news.importanceScore} />
      </div>

      {/* Category + keyword */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {news.category && (
          <span
            className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium"
            style={{
              background: "rgba(168,85,247,0.10)",
              border: "1px solid rgba(168,85,247,0.22)",
              color: "#c084fc",
            }}
          >
            {news.category}
          </span>
        )}
        <span
          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium"
          style={{
            background: "rgba(0,212,255,0.06)",
            border: "1px solid rgba(0,212,255,0.15)",
            color: "var(--neon-blue)",
          }}
        >
          <Tag size={9} strokeWidth={2.5} />
          {news.keyword}
        </span>
      </div>

      {/* Title */}
      <h3
        className="mb-4 text-lg font-bold leading-snug tracking-tight line-clamp-3"
        style={{ color: "var(--text-primary)" }}
      >
        {news.title}
      </h3>

      {/* Summary */}
      {news.summary && (
        <p
          className="mb-4 flex-1 text-sm leading-relaxed line-clamp-4"
          style={{ color: "var(--text-secondary)" }}
        >
          {news.summary}
        </p>
      )}

      {/* AI reason excerpt */}
      {news.aiReason && (
        <div
          className="mb-4 rounded-xl p-3"
          style={{
            background: "rgba(168,85,247,0.05)",
            border: "1px solid rgba(168,85,247,0.14)",
          }}
        >
          <div
            className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold"
            style={{ color: "#c084fc" }}
          >
            <Brain size={11} strokeWidth={2.5} />
            AI 분석 요약
          </div>
          <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "var(--text-secondary)" }}>
            {news.aiReason}
          </p>
        </div>
      )}

      {/* Read link */}
      <div
        className="mt-auto border-t pt-4"
        style={{ borderColor: "var(--glass-border)" }}
      >
        <a
          href={news.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-200 hover:brightness-125"
          style={{
            background: `linear-gradient(135deg, ${cfg.bg}, rgba(168,85,247,0.08))`,
            border: `1px solid ${cfg.border}`,
            color: cfg.color,
          }}
        >
          원문 기사 읽기
          <ExternalLink size={12} strokeWidth={2} />
        </a>
      </div>

      {/* Hover top glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(0,212,255,0.5), rgba(168,85,247,0.5), transparent)",
        }}
      />
    </motion.article>
  );
}

// ── Sub article card (compact, right column) ──────────────────── //
function SubArticleCard({ news, index }: { news: NewsItem; index: number }) {
  const cfg = gradeConfig[news.grade] ?? gradeConfig["N/A"];

  return (
    <motion.article
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.5,
        delay: (index + 1) * 0.12,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className="glass group relative flex flex-col overflow-hidden rounded-2xl p-5 transition-all duration-300"
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        minHeight: 120,
      }}
    >
      {/* Left accent bar */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-[2px]"
        style={{ background: cfg.color, opacity: 0.4 }}
      />

      {/* Header row */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className="text-[10px] font-black uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            #{index + 1}
          </span>
          {news.category && (
            <span
              className="rounded px-1.5 py-0.5 text-[9px] font-medium"
              style={{
                background: "rgba(168,85,247,0.08)",
                border: "1px solid rgba(168,85,247,0.18)",
                color: "#c084fc",
              }}
            >
              {news.category}
            </span>
          )}
        </div>
        <ImportanceBadge grade={news.grade} score={news.importanceScore} />
      </div>

      {/* Title */}
      <h4
        className="mb-2 text-sm font-semibold leading-snug line-clamp-2"
        style={{ color: "var(--text-primary)" }}
      >
        {news.title}
      </h4>

      {/* Summary */}
      {news.summary && (
        <p
          className="mb-3 flex-1 text-xs leading-relaxed line-clamp-2 group-hover:line-clamp-none"
          style={{ color: "var(--text-secondary)" }}
        >
          {news.summary}
        </p>
      )}

      {/* Footer */}
      <div
        className="mt-auto flex items-center justify-between border-t pt-3"
        style={{ borderColor: "var(--glass-border)" }}
      >
        <span
          className="inline-flex items-center gap-1 text-[10px]"
          style={{ color: "var(--text-muted)" }}
        >
          <Tag size={9} strokeWidth={2.5} />
          {news.keyword}
        </span>
        <a
          href={news.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-6 w-6 items-center justify-center rounded-md transition-all duration-200 hover:brightness-125"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: "var(--text-muted)",
          }}
        >
          <ExternalLink size={11} strokeWidth={2} />
        </a>
      </div>
    </motion.article>
  );
}

// ── Hero section ──────────────────────────────────────────────── //
export default function MorningBriefing() {
  const [topNews, setTopNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/news")
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          const sorted = (data as NewsItem[])
            .filter((n) => n.grade !== "LOW" && n.grade !== "N/A")
            .sort((a, b) => (b.importanceScore ?? 0) - (a.importanceScore ?? 0));
          setTopNews(sorted.slice(0, 3));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading || topNews.length === 0) return null;

  const [main, ...subs] = topNews;

  const updateBadgeText = new Date().toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
  });

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="mb-8"
    >
      {/* Section header */}
      <div className="mb-5 flex flex-col gap-2.5">
        <div className="flex items-center gap-3">
          {/* Pulsing live indicator */}
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5], scale: [0.95, 1.05, 0.95] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
            style={{
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.40)",
              boxShadow: "0 0 12px rgba(239,68,68,0.18)",
            }}
          >
            <Radio size={13} strokeWidth={2} style={{ color: "#f87171" }} />
          </motion.div>

          <h2
            className="text-xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            오늘의 레이더망에 포착된 핵심 이슈
          </h2>
        </div>

        {/* Update badge */}
        <div className="flex items-center gap-2 pl-10">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold"
            style={{
              background:
                "linear-gradient(135deg, rgba(0,212,255,0.12), rgba(168,85,247,0.10))",
              border: "1px solid rgba(0,212,255,0.25)",
              color: "var(--neon-blue)",
            }}
          >
            <Zap size={10} fill="currentColor" strokeWidth={0} />
            업데이트: {updateBadgeText} 오전 09:00
          </span>
        </div>
      </div>

      {/* Asymmetric newspaper grid: 3/5 main + 2/5 subs */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Main article */}
        <div className="lg:col-span-3">
          <MainArticleCard news={main} />
        </div>

        {/* Sub articles stacked */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          {subs.map((news, i) => (
            <SubArticleCard key={news.id} news={news} index={i} />
          ))}
        </div>
      </div>
    </motion.section>
  );
}
