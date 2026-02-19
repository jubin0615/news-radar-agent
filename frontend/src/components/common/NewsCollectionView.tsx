"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Newspaper,
  RefreshCw,
  Loader2,
  Search,
  ExternalLink,
  Tag,
  Brain,
  Calendar,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Filter,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useNavigation } from "@/lib/NavigationContext";
import type { NewsItem, NewsGrade } from "@/types";

// ── Grade styles ─────────────────────────────────────────────── //
const gradeStyles: Record<
  NewsGrade,
  { bg: string; border: string; text: string }
> = {
  CRITICAL: {
    bg: "rgba(239, 68, 68, 0.10)",
    border: "rgba(239, 68, 68, 0.30)",
    text: "#f87171",
  },
  HIGH: {
    bg: "rgba(245, 158, 11, 0.10)",
    border: "rgba(245, 158, 11, 0.30)",
    text: "#fbbf24",
  },
  MEDIUM: {
    bg: "rgba(0, 212, 255, 0.08)",
    border: "rgba(0, 212, 255, 0.25)",
    text: "var(--neon-blue)",
  },
  LOW: {
    bg: "rgba(255, 255, 255, 0.04)",
    border: "rgba(255, 255, 255, 0.10)",
    text: "var(--text-muted)",
  },
  "N/A": {
    bg: "rgba(255, 255, 255, 0.04)",
    border: "rgba(255, 255, 255, 0.10)",
    text: "var(--text-muted)",
  },
};

// ── Collection status type ───────────────────────────────────── //
interface CollectionStatus {
  collecting: boolean;
  totalNewsCount: number;
  todayNewsCount: number;
  activeKeywordCount: number;
  lastCollectedAt: string | null;
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
export default function NewsCollectionView({ className }: { className?: string }) {
  const { selectedKeyword, clearSelectedKeyword } = useNavigation();

  const [news, setNews] = useState<NewsItem[]>([]);
  const [status, setStatus] = useState<CollectionStatus | null>(null);
  const [isLoadingNews, setIsLoadingNews] = useState(true);
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectMessage, setCollectMessage] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

  // Sync selected keyword from context
  useEffect(() => {
    if (selectedKeyword) {
      setActiveFilter(selectedKeyword);
      setSearchInput(selectedKeyword);
    }
  }, [selectedKeyword]);

  // ── Fetch news ──
  const fetchNews = useCallback(async (keyword?: string | null) => {
    setIsLoadingNews(true);
    try {
      const url = keyword
        ? `/api/news?keyword=${encodeURIComponent(keyword)}`
        : "/api/news";
      const res = await fetch(url);
      if (res.ok) {
        const data: NewsItem[] = await res.json();
        setNews(data);
      }
    } catch {
      /* ignore */
    } finally {
      setIsLoadingNews(false);
    }
  }, []);

  // ── Fetch collection status ──
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/news/collection-status");
      if (res.ok) {
        const data: CollectionStatus = await res.json();
        setStatus(data);
        setIsCollecting(data.collecting);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchNews(activeFilter);
    fetchStatus();
  }, [fetchNews, fetchStatus, activeFilter]);

  // Poll status while collecting
  useEffect(() => {
    if (!isCollecting) return;
    const interval = setInterval(() => {
      fetchStatus();
      fetchNews(activeFilter);
    }, 5000);
    return () => clearInterval(interval);
  }, [isCollecting, fetchStatus, fetchNews, activeFilter]);

  // ── Trigger collection ──
  const handleCollect = async () => {
    setIsCollecting(true);
    setCollectMessage(null);
    try {
      const res = await fetch("/api/news/collect", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setCollectMessage(data.message || "뉴스 수집을 시작했습니다.");
      } else {
        setCollectMessage("뉴스 수집 요청에 실패했습니다.");
        setIsCollecting(false);
      }
    } catch {
      setCollectMessage("백엔드 서버에 연결할 수 없습니다.");
      setIsCollecting(false);
    }

    // Auto-refresh after some time
    setTimeout(() => {
      fetchStatus();
      fetchNews(activeFilter);
    }, 8000);
  };

  // ── Search / Filter ──
  const handleSearch = () => {
    const trimmed = searchInput.trim();
    if (trimmed) {
      setActiveFilter(trimmed);
    } else {
      setActiveFilter(null);
      clearSelectedKeyword();
    }
  };

  const handleClearFilter = () => {
    setActiveFilter(null);
    setSearchInput("");
    clearSelectedKeyword();
    fetchNews(null);
  };

  return (
    <div className={cn("flex h-full flex-col gap-5", className)}>
      {/* ── Header section ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background:
                "linear-gradient(135deg, rgba(0,212,255,0.15), rgba(168,85,247,0.15))",
              boxShadow: "0 0 20px rgba(0,212,255,0.12)",
            }}
          >
            <Newspaper size={20} style={{ color: "var(--neon-blue)" }} />
          </div>
          <div>
            <h2
              className="text-lg font-bold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              뉴스 수집
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              키워드 기반 실시간 뉴스 크롤링 및 AI 분석
            </p>
          </div>
        </div>

        {/* Collect button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleCollect}
          disabled={isCollecting}
          className={cn(
            "flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold",
            "transition-all duration-200",
            isCollecting && "pointer-events-none opacity-70",
          )}
          style={{
            background: isCollecting
              ? "rgba(0,212,255,0.08)"
              : "linear-gradient(135deg, rgba(0,212,255,0.20), rgba(168,85,247,0.20))",
            border: "1px solid rgba(0,212,255,0.30)",
            color: "var(--neon-blue)",
            boxShadow: isCollecting
              ? "none"
              : "0 0 20px rgba(0,212,255,0.12)",
          }}
        >
          {isCollecting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          {isCollecting ? "수집 중..." : "뉴스 수집 시작"}
        </motion.button>
      </div>

      {/* ── Status bar ── */}
      {status && (
        <div className="flex flex-wrap gap-3">
          {[
            {
              label: "전체 뉴스",
              value: status.totalNewsCount,
              icon: Newspaper,
            },
            {
              label: "오늘 수집",
              value: status.todayNewsCount,
              icon: TrendingUp,
            },
            {
              label: "활성 키워드",
              value: status.activeKeywordCount,
              icon: Tag,
            },
          ].map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-lg px-3 py-2"
              style={{
                background: "var(--glass-bg)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <Icon
                size={13}
                style={{ color: "var(--neon-blue)" }}
                strokeWidth={2}
              />
              <span
                className="text-xs font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                {label}
              </span>
              <span
                className="text-xs font-bold tabular-nums"
                style={{ color: "var(--text-primary)" }}
              >
                {value}
              </span>
            </div>
          ))}
          {status.lastCollectedAt && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2"
              style={{
                background: "var(--glass-bg)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <Clock
                size={13}
                style={{ color: "var(--text-muted)" }}
                strokeWidth={2}
              />
              <span
                className="text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                마지막 수집: {formatRelativeTime(status.lastCollectedAt)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Collect message ── */}
      <AnimatePresence>
        {collectMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
            style={{
              background: "rgba(0,212,255,0.06)",
              border: "1px solid rgba(0,212,255,0.15)",
              color: "var(--neon-blue)",
            }}
          >
            {isCollecting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <CheckCircle2 size={14} />
            )}
            {collectMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Search / Filter bar ── */}
      <div className="flex items-center gap-3">
        <div
          className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2.5"
          style={{
            background: "var(--glass-bg-light)",
            border: "1px solid var(--glass-border)",
          }}
        >
          <Search
            size={14}
            style={{ color: "var(--text-muted)" }}
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="키워드로 뉴스 검색..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
            style={{ color: "var(--text-primary)" }}
          />
          {activeFilter && (
            <button onClick={handleClearFilter}>
              <X size={14} style={{ color: "var(--text-muted)" }} />
            </button>
          )}
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSearch}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium"
          style={{
            background: "rgba(0,212,255,0.10)",
            border: "1px solid rgba(0,212,255,0.20)",
            color: "var(--neon-blue)",
          }}
        >
          <Filter size={14} />
          검색
        </motion.button>
      </div>

      {/* ── Active filter chip ── */}
      {activeFilter && (
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            필터:
          </span>
          <div
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold"
            style={{
              background: "rgba(0,212,255,0.08)",
              border: "1px solid rgba(0,212,255,0.15)",
              color: "var(--neon-blue)",
            }}
          >
            <Tag size={10} />
            {activeFilter}
            <button
              onClick={handleClearFilter}
              className="ml-1 rounded-full p-0.5 hover:bg-[rgba(0,212,255,0.15)]"
            >
              <X size={10} />
            </button>
          </div>
        </div>
      )}

      {/* ── News list ── */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingNews ? (
          <div className="flex items-center justify-center py-16 gap-2">
            <Loader2
              size={18}
              className="animate-spin"
              style={{ color: "var(--neon-blue)" }}
            />
            <span
              className="text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              뉴스 불러오는 중...
            </span>
          </div>
        ) : news.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{
                background: "rgba(0,212,255,0.06)",
                border: "1px solid rgba(0,212,255,0.10)",
              }}
            >
              <AlertCircle
                size={24}
                style={{ color: "var(--text-muted)" }}
              />
            </div>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              {activeFilter
                ? `"${activeFilter}" 관련 뉴스가 없습니다`
                : "수집된 뉴스가 없습니다"}
            </p>
            <p
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              {activeFilter
                ? "다른 키워드로 검색하거나 뉴스를 수집해보세요"
                : "위의 '뉴스 수집 시작' 버튼을 눌러 뉴스를 수집하세요"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p
              className="text-xs font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              {news.length}건의 뉴스
            </p>
            <AnimatePresence mode="popLayout">
              {news.map((item, i) => (
                <NewsListItem
                  key={item.id}
                  news={item}
                  index={i}
                  onSelect={setSelectedNews}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Detail Modal ── */}
      <AnimatePresence>
        {selectedNews && (
          <NewsDetailModal news={selectedNews} onClose={() => setSelectedNews(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── News list item (compact row format) ──────────────────────── //
function NewsListItem({
  news,
  index,
  onSelect,
}: {
  news: NewsItem;
  index: number;
  onSelect: (news: NewsItem) => void;
}) {
  const grade = gradeStyles[news.grade] ?? gradeStyles["N/A"];

  return (
    <motion.div
      onClick={() => onSelect(news)}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      whileHover={{ x: 4 }}
      className="group flex cursor-pointer items-start gap-4 rounded-xl p-4 transition-colors duration-200"
      style={{
        background: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
      }}
    >
      {/* Grade badge */}
      <div
        className="mt-0.5 shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider"
        style={{
          background: grade.bg,
          border: `1px solid ${grade.border}`,
          color: grade.text,
        }}
      >
        {news.grade}
        {news.importanceScore != null && (
          <span className="ml-1 opacity-70">{news.importanceScore}</span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-1.5 min-w-0">
        <h3
          className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-[var(--neon-blue)] transition-colors"
          style={{ color: "var(--text-primary)" }}
        >
          {news.title}
          <ExternalLink
            size={11}
            className="ml-1.5 inline-block opacity-0 group-hover:opacity-60 transition-opacity"
          />
        </h3>

        {news.summary && (
          <p
            className="text-xs leading-relaxed line-clamp-2"
            style={{ color: "var(--text-secondary)" }}
          >
            {news.summary}
          </p>
        )}

        {news.aiReason && (
          <div className="flex items-start gap-1.5 mt-1">
            <Brain
              size={11}
              className="mt-0.5 shrink-0"
              style={{ color: "var(--neon-purple)" }}
            />
            <span
              className="text-[11px] leading-snug line-clamp-1"
              style={{ color: "var(--text-muted)" }}
            >
              {news.aiReason}
            </span>
          </div>
        )}

        <div className="flex items-center gap-3 mt-1">
          <span
            className="flex items-center gap-1 text-[10px]"
            style={{ color: "var(--text-muted)" }}
          >
            <Tag size={9} />
            {news.keyword}
          </span>
          {news.category && (
            <span
              className="text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              {news.category}
            </span>
          )}
          {news.collectedAt && (
            <span
              className="flex items-center gap-1 text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              <Clock size={9} />
              {formatRelativeTime(news.collectedAt)}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── News Detail Modal ────────────────────────────────────────── //
function NewsDetailModal({
  news,
  onClose,
}: {
  news: NewsItem;
  onClose: () => void;
}) {
  const grade = gradeStyles[news.grade] ?? gradeStyles["N/A"];

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
        style={{
          background: "#0a0a0a",
          borderColor: "var(--glass-border)",
        }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-start justify-between gap-4 border-b px-6 py-5"
          style={{
            borderColor: "var(--glass-border)",
            background: `linear-gradient(to bottom, ${grade.bg}, transparent)`,
          }}
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span
                className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{
                  background: grade.bg,
                  border: `1px solid ${grade.border}`,
                  color: grade.text,
                }}
              >
                {news.grade}
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                중요도 점수: {news.importanceScore ?? "N/A"}
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col gap-6">
            {/* AI Analysis */}
            <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--neon-purple)]">
                <Brain size={16} />
                AI 분석 리포트
              </h3>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                {news.aiReason || "AI 분석 내용이 없습니다."}
              </p>
            </div>

            {/* Summary */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">요약</h3>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                {news.summary || "요약 내용이 없습니다."}
              </p>
            </div>

            {/* Meta Info */}
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

        {/* Footer */}
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
