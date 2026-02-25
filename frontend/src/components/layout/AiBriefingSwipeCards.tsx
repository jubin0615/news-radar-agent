"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  AnimatePresence,
  type PanInfo,
} from "framer-motion";
import { Brain, Newspaper, Tag, Sparkles, ChevronLeft, ChevronRight, MousePointerClick } from "lucide-react";
import type { NewsItem, NewsGrade } from "@/types";

// ── Grade config ─────────────────────────────────────────────── //
const gradeConfig: Record<
  NewsGrade,
  { label: string; color: string; glow: string; bg: string }
> = {
  CRITICAL: {
    label: "CRITICAL",
    color: "#f87171",
    glow: "0 0 12px rgba(239,68,68,0.5)",
    bg: "rgba(239,68,68,0.08)",
  },
  HIGH: {
    label: "HIGH",
    color: "#fbbf24",
    glow: "0 0 12px rgba(245,158,11,0.4)",
    bg: "rgba(245,158,11,0.08)",
  },
  MEDIUM: {
    label: "MEDIUM",
    color: "var(--neon-blue)",
    glow: "0 0 12px rgba(0,212,255,0.4)",
    bg: "rgba(0,212,255,0.06)",
  },
  LOW: {
    label: "LOW",
    color: "var(--text-muted)",
    glow: "none",
    bg: "rgba(255,255,255,0.03)",
  },
  "N/A": {
    label: "N/A",
    color: "var(--text-muted)",
    glow: "none",
    bg: "rgba(255,255,255,0.03)",
  },
};

// ── Swipe Card ───────────────────────────────────────────────── //
function SwipeCard({
  news,
  isTop,
  stackIndex,
  totalVisible,
  onSwipe,
  onCardClick,
}: {
  news: NewsItem;
  isTop: boolean;
  stackIndex: number;
  totalVisible: number;
  onSwipe: (dir: "left" | "right") => void;
  onCardClick: (news: NewsItem) => void;
}) {
  const grade = gradeConfig[news.grade] ?? gradeConfig["N/A"];
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-18, 0, 18]);
  const opacity = useTransform(x, [-300, -150, 0, 150, 300], [0, 1, 1, 1, 0]);
  const hasDragged = useRef(false);

  const scale = 1 - stackIndex * 0.045;
  const yOffset = stackIndex * 12;
  const zIndex = totalVisible - stackIndex;

  const handleDragStart = () => {
    hasDragged.current = false;
  };

  const handleDrag = () => {
    hasDragged.current = true;
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 120 || Math.abs(info.velocity.x) > 500) {
      hasDragged.current = true;
      onSwipe(info.offset.x > 0 ? "right" : "left");
    }
  };

  const handleClick = () => {
    if (isTop && !hasDragged.current) {
      onCardClick(news);
    }
  };

  return (
    <motion.div
      className="absolute inset-0"
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        opacity: isTop ? opacity : 1,
        scale,
        y: yOffset,
        zIndex,
      }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragStart={isTop ? handleDragStart : undefined}
      onDrag={isTop ? handleDrag : undefined}
      onDragEnd={isTop ? handleDragEnd : undefined}
      initial={{ scale: scale - 0.05, y: yOffset + 20, opacity: 0 }}
      animate={{ scale, y: yOffset, opacity: stackIndex < 3 ? 1 : 0 }}
      exit={{ x: 400, opacity: 0, rotate: 20 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
    >
      <div
        onClick={handleClick}
        className="relative h-full w-full cursor-pointer overflow-hidden rounded-2xl"
        style={{
          background:
            "linear-gradient(160deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)",
          border: `1px solid ${stackIndex === 0 ? "rgba(0,212,255,0.25)" : "rgba(255,255,255,0.10)"}`,
          backdropFilter: "blur(12px)",
          boxShadow: `0 8px 40px rgba(0,0,0,0.35), ${stackIndex === 0 ? "0 0 30px rgba(0,212,255,0.06)" : "none"}`,
        }}
      >
        {/* Top accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${grade.color}, transparent)`,
            boxShadow: grade.glow,
          }}
        />

        <div className="flex h-full flex-col justify-between p-5">
          {/* Header: AI Insight label + Badge + Score */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div
                className="flex items-center gap-1.5 rounded-full px-3 py-1"
                style={{
                  background: "linear-gradient(135deg, rgba(168,85,247,0.15), rgba(0,212,255,0.12))",
                  border: "1px solid rgba(168,85,247,0.30)",
                  boxShadow: "0 0 12px rgba(168,85,247,0.20), 0 0 4px rgba(0,212,255,0.15)",
                }}
              >
                <Brain size={14} style={{ color: "#c084fc" }} />
                <span
                  className="text-xs font-bold tracking-wide"
                  style={{
                    background: "linear-gradient(135deg, #c084fc, #38bdf8)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  AI Insight
                </span>
              </div>
              <span
                className="rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.15em]"
                style={{
                  background: grade.bg,
                  color: grade.color,
                  border: `1px solid ${grade.color}30`,
                  boxShadow: grade.glow,
                }}
              >
                {grade.label}
              </span>
              {news.importanceScore != null && (
                <span
                  className="font-mono text-base font-bold tabular-nums"
                  style={{
                    color: grade.color,
                    textShadow: `0 0 8px ${grade.color}40`,
                  }}
                >
                  {news.importanceScore}
                </span>
              )}
            </div>
          </div>

          {/* AI Reason (main focus) */}
          <div className="mt-3 mb-2 flex-1">
            {news.aiReason ? (
              <p className="text-lg font-bold leading-relaxed text-white line-clamp-3">
                {news.aiReason}
              </p>
            ) : (
              <p
                className="text-lg font-bold leading-relaxed line-clamp-3"
                style={{ color: "var(--text-secondary)" }}
              >
                {news.summary || news.title}
              </p>
            )}
          </div>

          {/* Title (with clear label) */}
          <div
            className="mb-2 rounded-lg px-3 py-2.5"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            <div className="mb-1.5 flex items-center gap-1.5">
              <Newspaper size={11} style={{ color: "var(--neon-blue)" }} />
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "var(--neon-blue)" }}
              >
                원문 기사
              </span>
            </div>
            <p
              className="text-sm font-semibold leading-snug line-clamp-2"
              style={{ color: "var(--text-primary)" }}
            >
              {news.title}
            </p>
            <div className="mt-1.5 flex items-center gap-3">
              {news.keyword && (
                <span
                  className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--neon-blue)" }}
                >
                  <Tag size={9} />
                  {news.keyword}
                </span>
              )}
              {news.category && (
                <span
                  className="text-[10px] font-medium uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  {news.category}
                </span>
              )}
            </div>
          </div>

          {/* Bottom: Click guide — enlarged */}
          <div
            className="flex items-center justify-center gap-2 rounded-lg py-2"
            style={{ background: "rgba(0,212,255,0.04)" }}
          >
            <MousePointerClick size={16} style={{ color: "var(--neon-blue)" }} />
            <span
              className="text-xs font-semibold"
              style={{
                color: "var(--neon-blue)",
                textShadow: "0 0 6px rgba(0,212,255,0.25)",
              }}
            >
              클릭해서 상세 브리핑 보기
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Component ───────────────────────────────────────────── //
export default function AiBriefingSwipeCards({
  onCardClick,
}: {
  onCardClick?: (news: NewsItem) => void;
}) {
  const [cards, setCards] = useState<NewsItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCards = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const res = await fetch("/api/news", { cache: "no-store" });
      if (!res.ok) return;

      const data: NewsItem[] = await res.json();
      // Top 5 by importance score
      const top5 = data
        .filter((n) => n.importanceScore != null)
        .sort((a, b) => (b.importanceScore ?? 0) - (a.importanceScore ?? 0))
        .slice(0, 5);

      setCards(top5);
      setCurrentIndex((prev) => Math.max(0, Math.min(prev, top5.length)));
    } catch {
      /* ignore */
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCards(true);

    const intervalId = window.setInterval(() => {
      void fetchCards(false);
    }, 10_000);

    const handleWindowFocus = () => {
      void fetchCards(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchCards(false);
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchCards]);

  const handleSwipe = useCallback(() => {
    setCurrentIndex((prev) => prev + 1);
  }, []);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(cards.length - 1, prev + 1));
  }, [cards.length]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handlePrev, handleNext]);

  const handleCardClick = useCallback(
    (news: NewsItem) => {
      onCardClick?.(news);
    },
    [onCardClick],
  );

  const visibleCards = cards.slice(currentIndex, currentIndex + 3);
  const isEnd = currentIndex >= cards.length;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <Sparkles
            size={24}
            className="animate-pulse"
            style={{ color: "var(--neon-blue)" }}
          />
          <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            AI BRIEFING LOADING...
          </span>
        </motion.div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <Sparkles size={28} style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            AI 브리핑을 생성할 뉴스가 없습니다
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            뉴스를 수집하면 핵심 기사가 여기에 표시됩니다
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Title */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{
              background:
                "linear-gradient(135deg, rgba(0,212,255,0.12), rgba(168,85,247,0.12))",
              border: "1px solid rgba(0,212,255,0.15)",
            }}
          >
            <Sparkles size={15} style={{ color: "var(--neon-blue)" }} />
          </div>
          <div>
            <h2
              className="text-sm font-bold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              AI Briefing
            </h2>
            <p
              className="text-[10px] font-mono uppercase tracking-widest"
              style={{ color: "var(--text-muted)" }}
            >
              TOP {cards.length} INTELLIGENCE
            </p>
          </div>
        </div>

        {/* Navigation arrows */}
        <div className="flex items-center gap-1.5">
          <span
            className="mr-2 text-[10px] font-mono tabular-nums"
            style={{ color: "var(--text-muted)" }}
          >
            {Math.min(currentIndex + 1, cards.length)}/{cards.length}
          </span>
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-20"
            style={{
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-secondary)",
            }}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={handleNext}
            disabled={currentIndex >= cards.length - 1}
            className="flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-20"
            style={{
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-secondary)",
            }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Cards stack */}
      <div className="relative flex-1 min-h-[260px]">
        <AnimatePresence>
          {isEnd ? (
            <motion.div
              key="end"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            >
              <Sparkles size={28} style={{ color: "var(--neon-purple)" }} />
              <p
                className="text-sm font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                모든 브리핑을 확인했습니다
              </p>
              <button
                onClick={() => setCurrentIndex(0)}
                className="mt-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors"
                style={{
                  background: "rgba(0,212,255,0.08)",
                  border: "1px solid rgba(0,212,255,0.20)",
                  color: "var(--neon-blue)",
                }}
              >
                처음부터 다시 보기
              </button>
            </motion.div>
          ) : (
            visibleCards
              .map((news, i) => (
                <SwipeCard
                  key={`${news.id}-${currentIndex + i}`}
                  news={news}
                  isTop={i === 0}
                  stackIndex={i}
                  totalVisible={visibleCards.length}
                  onSwipe={handleSwipe}
                  onCardClick={handleCardClick}
                />
              ))
              .reverse()
          )}
        </AnimatePresence>
      </div>

      {/* Swipe hint — enlarged for visibility */}
      {!isEnd && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-4 flex items-center justify-center gap-2 py-2"
        >
          <ChevronLeft size={16} style={{ color: "var(--neon-blue)", opacity: 0.7 }} />
          <span
            className="text-sm font-semibold tracking-wider uppercase"
            style={{
              color: "var(--neon-blue)",
              textShadow: "0 0 8px rgba(0,212,255,0.35)",
            }}
          >
            SWIPE OR USE ARROW KEYS
          </span>
          <ChevronRight size={16} style={{ color: "var(--neon-blue)", opacity: 0.7 }} />
        </motion.div>
      )}
    </div>
  );
}
