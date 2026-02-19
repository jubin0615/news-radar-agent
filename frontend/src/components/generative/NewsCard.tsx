"use client";

import { motion } from "framer-motion";
import { ExternalLink, Clock, Tag, Brain, TrendingUp } from "lucide-react";
import { cn } from "@/lib/cn";
import type { NewsItem, NewsGrade } from "@/types";

// ── Grade style map ──────────────────────────────────────────── //
const gradeStyles: Record<NewsGrade, { bg: string; border: string; text: string; glow: string }> = {
  CRITICAL: {
    bg: "rgba(239, 68, 68, 0.10)",
    border: "rgba(239, 68, 68, 0.30)",
    text: "#f87171",
    glow: "0 0 16px rgba(239, 68, 68, 0.15)",
  },
  HIGH: {
    bg: "rgba(245, 158, 11, 0.10)",
    border: "rgba(245, 158, 11, 0.30)",
    text: "#fbbf24",
    glow: "0 0 16px rgba(245, 158, 11, 0.12)",
  },
  MEDIUM: {
    bg: "rgba(0, 212, 255, 0.08)",
    border: "rgba(0, 212, 255, 0.25)",
    text: "var(--neon-blue)",
    glow: "0 0 12px rgba(0, 212, 255, 0.10)",
  },
  LOW: {
    bg: "rgba(255, 255, 255, 0.04)",
    border: "rgba(255, 255, 255, 0.10)",
    text: "var(--text-muted)",
    glow: "none",
  },
  "N/A": {
    bg: "rgba(255, 255, 255, 0.04)",
    border: "rgba(255, 255, 255, 0.10)",
    text: "var(--text-muted)",
    glow: "none",
  },
};

// ── Time formatting ──────────────────────────────────────────── //
function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

// ── Component ────────────────────────────────────────────────── //
interface NewsCardProps {
  news: NewsItem;
  index?: number;
  className?: string;
}

export default function NewsCard({ news, index = 0, className }: NewsCardProps) {
  const grade = gradeStyles[news.grade] ?? gradeStyles["N/A"];

  return (
    <motion.article
      /* ── Stagger entrance ── */
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.45,
        delay: index * 0.08,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      /* ── Hover lift ── */
      whileHover={{
        y: -4,
        boxShadow:
          "0 16px 48px rgba(0,0,0,0.35), 0 0 24px rgba(0, 212, 255, 0.08), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
      className={cn(
        "glass group relative flex w-[340px] shrink-0 flex-col overflow-hidden",
        "cursor-default transition-colors duration-300",
        className,
      )}
    >
      {/* ── Thumbnail / Gradient Header ── */}
      <div className="relative h-36 w-full overflow-hidden">
        {news.thumbnailUrl ? (
          <img
            src={news.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          /* Gradient placeholder when no thumbnail */
          <div
            className="h-full w-full"
            style={{
              background: `linear-gradient(135deg, rgba(0,212,255,0.12) 0%, rgba(168,85,247,0.12) 100%)`,
            }}
          />
        )}

        {/* Dark gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to top, var(--bg-primary) 0%, transparent 60%)",
          }}
        />

        {/* Grade badge */}
        <div
          className="absolute right-3 top-3 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
          style={{
            background: grade.bg,
            border: `1px solid ${grade.border}`,
            color: grade.text,
            boxShadow: grade.glow,
            backdropFilter: "blur(8px)",
          }}
        >
          {news.grade}
          {news.importanceScore != null && (
            <span className="ml-1 opacity-70">{news.importanceScore}</span>
          )}
        </div>

        {/* Keyword chip */}
        <div
          className="absolute left-3 top-3 flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold"
          style={{
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(8px)",
            color: "var(--neon-blue)",
            border: "1px solid rgba(0, 212, 255, 0.15)",
          }}
        >
          <Tag size={9} strokeWidth={2.5} />
          {news.keyword}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex flex-1 flex-col gap-2.5 p-4 pt-1">
        {/* Title */}
        <h3
          className="line-clamp-2 text-sm font-semibold leading-snug tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          {news.title}
        </h3>

        {/* Summary */}
        {news.summary && (
          <p
            className="line-clamp-3 text-xs leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            {news.summary}
          </p>
        )}

        {/* AI Reason chip */}
        {news.aiReason && (
          <div
            className="flex items-start gap-1.5 rounded-lg p-2 text-[11px] leading-snug"
            style={{
              background: "rgba(168, 85, 247, 0.06)",
              border: "1px solid rgba(168, 85, 247, 0.12)",
              color: "var(--text-secondary)",
            }}
          >
            <Brain
              size={12}
              className="mt-px shrink-0"
              style={{ color: "var(--neon-purple)" }}
              strokeWidth={2}
            />
            <span className="line-clamp-2">{news.aiReason}</span>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Footer: metadata + link */}
        <div className="flex items-center justify-between border-t pt-2.5" style={{ borderColor: "var(--glass-border)" }}>
          <div className="flex items-center gap-3">
            {/* Time */}
            <span
              className="flex items-center gap-1 text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              <Clock size={10} strokeWidth={2} />
              {formatRelativeTime(news.collectedAt)}
            </span>

            {/* Category */}
            {news.category && (
              <span
                className="flex items-center gap-1 text-[10px]"
                style={{ color: "var(--text-muted)" }}
              >
                <TrendingUp size={10} strokeWidth={2} />
                {news.category}
              </span>
            )}
          </div>

          {/* External link */}
          <a
            href={news.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-200 hover:scale-110"
            style={{
              background: "rgba(0, 212, 255, 0.08)",
              border: "1px solid rgba(0, 212, 255, 0.15)",
              color: "var(--neon-blue)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={12} strokeWidth={2} />
          </a>
        </div>
      </div>

      {/* ── Hover top-edge glow line ── */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.5), rgba(168,85,247,0.5), transparent)",
        }}
      />
    </motion.article>
  );
}
