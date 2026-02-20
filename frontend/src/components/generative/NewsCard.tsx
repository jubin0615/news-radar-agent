"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Clock, Tag, Brain, TrendingUp, ChevronDown, ChevronUp, MessageCircleQuestion } from "lucide-react";
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

// ── Contextual question generator ────────────────────────────── //
function buildContextualQuestion(news: NewsItem): string {
  const { title, category, keyword, grade } = news;
  const cat = category?.toLowerCase() ?? "";

  if (cat.includes("경제") || cat.includes("금융") || cat.includes("시장") || cat.includes("주식")) {
    return `"${title}" 기사가 ${keyword} 관련 시장·투자에 미칠 영향을 분석해줘`;
  }
  if (cat.includes("정책") || cat.includes("규제") || cat.includes("정치") || cat.includes("법")) {
    return `"${title}" 기사의 정책·규제 변화가 ${keyword} 산업에 갖는 의미는?`;
  }
  if (cat.includes("ai") || cat.includes("기술") || cat.includes("반도체") || cat.includes("sw")) {
    return `"${title}" 기사에서 소개된 ${keyword} 기술의 핵심 의의와 향후 발전 방향은?`;
  }
  if (cat.includes("기업") || cat.includes("비즈니스") || cat.includes("스타트업")) {
    return `"${title}" 기사에서 ${keyword} 관련 기업들의 전략적 시사점은 무엇인가요?`;
  }
  if (cat.includes("보안") || cat.includes("사이버")) {
    return `"${title}" 기사의 보안 이슈가 ${keyword} 분야에 미치는 위협과 대응 방안은?`;
  }

  // Grade-based fallback
  if (grade === "CRITICAL" || grade === "HIGH") {
    return `"${title}" 이 중요 이슈에서 ${keyword}의 단기·장기 영향과 리스크를 분석해줘`;
  }
  return `"${title}" 기사에서 ${keyword}에 관한 핵심 쟁점과 향후 전망은?`;
}

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
  onAskAboutNews?: (question: string) => void;
}

export default function NewsCard({ news, index = 0, className, onAskAboutNews }: NewsCardProps) {
  const grade = gradeStyles[news.grade] ?? gradeStyles["N/A"];
  const [isExpanded, setIsExpanded] = useState(false);
  const canExpand = news.aiReason && news.aiReason.length > 80;

  return (
    <motion.article
      layout
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
        "glass group relative flex w-[300px] shrink-0 flex-col overflow-hidden transition-all",
        "min-h-[380px] cursor-default duration-300 ease-in-out",
        className,
      )}
    >
      {/* ── Summary Dashboard Header ── */}
      <div className="flex flex-col gap-2 px-3 pt-3 pb-1">
        {/* Context strip — chips row */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Category chip */}
          {news.category && (
            <span
              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium"
              style={{
                background: "rgba(168, 85, 247, 0.10)",
                border: "1px solid rgba(168, 85, 247, 0.20)",
                color: "var(--neon-purple, #a855f7)",
              }}
            >
              <TrendingUp size={9} strokeWidth={2.5} />
              {news.category}
            </span>
          )}

          {/* Relative time chip */}
          <span
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "var(--text-muted)",
            }}
          >
            <Clock size={12} strokeWidth={2.5} />
            {formatRelativeTime(news.collectedAt)}
          </span>
        </div>

        {/* Keyword + Grade row */}
        <div className="flex items-center justify-between">
          {/* Keyword chip */}
          <div
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold"
            style={{
              background: "rgba(0, 212, 255, 0.08)",
              border: "1px solid rgba(0, 212, 255, 0.18)",
              color: "var(--neon-blue)",
            }}
          >
            <Tag size={12} strokeWidth={2.5} />
            {news.keyword}
          </div>

          {/* Grade badge */}
          <div
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wider"
            style={{
              background: grade.bg,
              border: `1px solid ${grade.border}`,
              color: grade.text,
              boxShadow: grade.glow,
            }}
          >
            {news.grade}
            {news.importanceScore != null && (
              <span className="ml-0.5 opacity-70">{news.importanceScore}</span>
            )}
          </div>
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

        {/* AI Reason (replacing Summary) */}
        {news.aiReason && (
          <div className="relative group/ai-reason mt-1">
            <div
              className={cn(
                "rounded-xl p-3 text-xs leading-relaxed transition-all duration-300",
                "border border-[rgba(168,85,247,0.15)] bg-[rgba(168,85,247,0.05)]",
              )}
            >
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--neon-purple)]">
                <Brain size={12} strokeWidth={2.5} />
                <span>AI 분석</span>
              </div>
              <p
                className={cn(!isExpanded && "line-clamp-3")}
                style={{ color: "var(--text-secondary)" }}
              >
                {news.aiReason}
              </p>
            </div>
            
            {canExpand && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="mt-1.5 flex w-full items-center justify-center gap-1 text-[10px] font-medium transition-colors hover:text-[var(--neon-purple)]"
                style={{ color: "var(--text-muted)" }}
              >
                {isExpanded ? (
                  <>
                    접기 <ChevronUp size={12} strokeWidth={2} />
                  </>
                ) : (
                  <>
                    더보기 <ChevronDown size={12} strokeWidth={2} />
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* RAG CTA button — below AI analysis */}
        {onAskAboutNews && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAskAboutNews(buildContextualQuestion(news));
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-200 hover:brightness-125"
            style={{
              background: "linear-gradient(135deg, rgba(0,212,255,0.12), rgba(168,85,247,0.12))",
              border: "1px solid rgba(0, 212, 255, 0.18)",
              color: "var(--neon-blue)",
            }}
          >
            <MessageCircleQuestion size={12} strokeWidth={2.5} />
            이 기사 더 물어보기
          </button>
        )}


        {/* Spacer */}
        <div className="flex-1" />

        {/* Footer: external link */}
        <div className="flex items-center justify-end border-t pt-2.5" style={{ borderColor: "var(--glass-border)" }}>
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
