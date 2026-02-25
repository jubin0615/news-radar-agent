"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import FloatingGuide from "./FloatingGuide";
import WelcomeModal from "./WelcomeModal";
import HolographicHUD from "./HolographicHUD";
import AiBriefingSwipeCards from "./AiBriefingSwipeCards";
import CyberneticNodeMap from "./CyberneticNodeMap";
import { useNavigation } from "@/lib/NavigationContext";
import type { NewsItem } from "@/types";

// ── News Detail Modal (inline, reused from NewsCollectionView pattern) ── //
import {
  Brain,
  Calendar,
  ExternalLink,
  Tag,
  X,
} from "lucide-react";
import { motion } from "framer-motion";

function NewsDetailModal({
  news,
  onClose,
}: {
  news: NewsItem;
  onClose: () => void;
}) {
  const gradeColors: Record<string, { bg: string; border: string; text: string }> = {
    CRITICAL: { bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.30)", text: "#f87171" },
    HIGH: { bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.30)", text: "#fbbf24" },
    MEDIUM: { bg: "rgba(0,212,255,0.08)", border: "rgba(0,212,255,0.25)", text: "var(--neon-blue)" },
    LOW: { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.10)", text: "var(--text-muted)" },
    "N/A": { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.10)", text: "var(--text-muted)" },
  };
  const grade = gradeColors[news.grade] ?? gradeColors["N/A"];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{ background: "#0a0a0a", borderColor: "var(--glass-border)" }}
      >
        <div
          className="flex shrink-0 items-start justify-between gap-4 border-b px-6 py-5"
          style={{ borderColor: "var(--glass-border)", background: `linear-gradient(to bottom, ${grade.bg}, transparent)` }}
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span
                className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: grade.bg, border: `1px solid ${grade.border}`, color: grade.text }}
              >
                {news.grade}
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                {news.importanceScore ?? "N/A"}
              </span>
            </div>
            <h2 className="text-lg font-bold leading-snug text-[var(--text-primary)]">
              {news.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-white/10 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col gap-6">
            <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--neon-purple)]">
                <Brain size={16} />
                AI 분석 리포트
              </h3>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                {news.aiReason || "AI 분석 내용이 없습니다."}
              </p>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">요약</h3>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                {news.summary || "요약 내용이 없습니다."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs text-[var(--text-muted)]">
              <div className="flex items-center gap-2">
                <Tag size={14} /> 키워드: <span className="text-[var(--text-primary)]">{news.keyword}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={14} /> 수집일: <span className="text-[var(--text-primary)]">{news.collectedAt ? new Date(news.collectedAt).toLocaleString() : "-"}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 justify-end border-t border-[var(--glass-border)] bg-[var(--glass-bg)] px-6 py-4">
          <a
            href={news.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg bg-[var(--neon-blue)] px-4 py-2 text-sm font-semibold text-black transition-transform hover:scale-105"
          >
            원문 기사 보러가기
            <ExternalLink size={16} />
          </a>
        </div>
      </motion.div>
    </div>
  );
}

// ── Dashboard Stats ──────────────────────────────────────────── //
interface DashboardStats {
  totalNewsCount: number;
  todayNewsCount: number;
  activeKeywordCount: number;
  collecting: boolean;
  lastCollectedAt: string | null;
}

// ── Main Component ───────────────────────────────────────────── //
export default function DashboardView() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const { navigateToTodayNews } = useNavigation();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/news/collection-status");
        if (res.ok) {
          setStats(await res.json());
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCardClick = useCallback((news: NewsItem) => {
    setSelectedNews(news);
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-[var(--neon-blue)]" />
      </div>
    );
  }

  return (
    <>
      <WelcomeModal />

      <div className="flex h-full flex-col gap-6 p-2">
        {/* ── Header + HUD ── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">
              대시보드
            </h1>
          </div>
          <HolographicHUD stats={stats} onTodayClick={navigateToTodayNews} />
        </div>

        {/* ── Neon divider ── */}
        <div className="neon-divider" />

        {/* ── Main Content: Swipe Cards + Node Map ── */}
        <div className="flex flex-1 min-h-0 gap-5">
          {/* Left: AI Briefing — 60% */}
          <div className="min-w-0" style={{ flex: "6 6 0%" }}>
            <AiBriefingSwipeCards onCardClick={handleCardClick} />
          </div>

          {/* Right: Cybernetic Node Map — 40% */}
          <div className="hidden lg:flex items-center min-w-0" style={{ flex: "4 4 0%" }}>
            <CyberneticNodeMap className="w-full" />
          </div>
        </div>

        <FloatingGuide />
      </div>

      {/* ── Detail Modal ── */}
      <AnimatePresence>
        {selectedNews && (
          <NewsDetailModal
            news={selectedNews}
            onClose={() => setSelectedNews(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
