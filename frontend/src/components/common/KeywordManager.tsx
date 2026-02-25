"use client";

import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Search, Hash, Loader2, Power, RefreshCw, Archive, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import { useNavigation } from "@/lib/NavigationContext";

// ── Types ────────────────────────────────────────────────────── //
type KeywordStatus = "ACTIVE" | "PAUSED" | "ARCHIVED";

interface Keyword {
  id: number;
  name: string;
  status: KeywordStatus;
  createdAt: string | null;
}

interface ToastItem {
  id: number;
  message: string;
}

interface KeywordManagerProps {
  className?: string;
  showHeader?: boolean;
  onKeywordsChange?: (keywords: Keyword[]) => void;
}

// ── Status visual config ──────────────────────────────────────── //
const STATUS_CONFIG: Record<
  KeywordStatus,
  { dotColor: string; dotShadow: string; border: string; textColor: string; badge: string }
> = {
  ACTIVE: {
    dotColor: "var(--neon-blue)",
    dotShadow: "0 0 6px rgba(0,212,255,0.6)",
    border: "rgba(0, 212, 255, 0.10)",
    textColor: "var(--text-primary)",
    badge: "구독 중",
  },
  PAUSED: {
    dotColor: "#fbbf24",
    dotShadow: "0 0 6px rgba(251,191,36,0.4)",
    border: "rgba(251, 191, 36, 0.15)",
    textColor: "var(--text-secondary)",
    badge: "수집 정지",
  },
  ARCHIVED: {
    dotColor: "var(--text-muted)",
    dotShadow: "none",
    border: "var(--glass-border)",
    textColor: "var(--text-muted)",
    badge: "아카이브",
  },
};

// ── Component ────────────────────────────────────────────────── //
export default function KeywordManager({
  className,
  showHeader = true,
  onKeywordsChange,
}: KeywordManagerProps) {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [recollectingIds, setRecollectingIds] = useState<Set<number>>(new Set());
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { navigateToNewsWithKeyword } = useNavigation();

  useEffect(() => { fetchKeywords(); }, []);

  const fetchKeywords = async () => {
    try {
      const res = await fetch("/api/keywords");
      if (res.ok) setKeywords(await res.json());
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  };

  const showToast = useCallback((message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const addKeyword = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (keywords.some((k) => k.name.toLowerCase() === trimmed.toLowerCase())) {
      setInput(""); return;
    }
    try {
      const res = await fetch(`/api/keywords?name=${encodeURIComponent(trimmed)}`, { method: "POST" });
      if (res.ok) {
        const newKw: Keyword = await res.json();
        setKeywords((prev) => [...prev, newKw]);
      }
    } catch { /* ignore */ }
    setInput("");
  }, [input, keywords]);

  const removeKeyword = useCallback(async (id: number) => {
    setKeywords((prev) => prev.filter((k) => k.id !== id));
    try {
      await fetch(`/api/keywords/${id}`, { method: "DELETE" });
    } catch { fetchKeywords(); }
  }, []);

  /** 상태 변경 요청 (ACTIVE | PAUSED | ARCHIVED) */
  const setStatus = useCallback(async (id: number, newStatus: KeywordStatus) => {
    // 낙관적 업데이트
    setKeywords((prev) =>
      prev.map((k) => (k.id === id ? { ...k, status: newStatus } : k)),
    );
    try {
      const res = await fetch(
        `/api/keywords/${id}?status=${newStatus}`,
        { method: "PATCH" },
      );
      if (res.ok) {
        const updated: Keyword = await res.json();
        setKeywords((prev) => prev.map((k) => (k.id === updated.id ? updated : k)));
      } else {
        fetchKeywords(); // 실패 시 서버 상태로 복구
      }
    } catch { fetchKeywords(); }
  }, []);

  /** ACTIVE ↔ PAUSED 토글 */
  const toggleActiveOrPaused = useCallback(
    (keyword: Keyword) => {
      const next: KeywordStatus = keyword.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
      setStatus(keyword.id, next);
    },
    [setStatus],
  );

  const recollectNews = useCallback(async (keyword: Keyword) => {
    if (recollectingIds.has(keyword.id)) return;
    setRecollectingIds((prev) => new Set(prev).add(keyword.id));
    showToast(`"${keyword.name}" 기존 뉴스가 보관 처리되고 백그라운드에서 새로운 뉴스 수집을 시작합니다.`);
    try {
      await fetch(`/api/news/recollect?keyword=${encodeURIComponent(keyword.name)}`, { method: "POST" });
    } catch { /* ignore */ }
    finally {
      setRecollectingIds((prev) => { const next = new Set(prev); next.delete(keyword.id); return next; });
    }
  }, [recollectingIds, showToast]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); addKeyword(); }
  };

  const activeCount = keywords.filter((k) => k.status === "ACTIVE").length;

  useEffect(() => {
    if (!isLoading) onKeywordsChange?.(keywords);
  }, [isLoading, keywords, onKeywordsChange]);

  return (
    <div className={cn("flex flex-col gap-4", className)}>

      {/* ── Section Header ─────────── */}
      {showHeader && (
        <div className="flex items-center gap-2 px-1">
          <Hash size={14} style={{ color: "var(--neon-blue)" }} strokeWidth={2} />
          <h2
            className="text-xs font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--text-secondary)" }}
          >
            키워드 관리
          </h2>
          <span
            className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums"
            style={{ background: "rgba(0, 212, 255, 0.12)", color: "var(--neon-blue)" }}
          >
            {activeCount}/{keywords.length}
          </span>
        </div>
      )}

      {/* ── Input Area ─────────────── */}
      <div
        className="relative flex items-center gap-2 rounded-xl px-3 py-2.5 transition-all duration-200"
        style={{
          background: "var(--glass-bg-light)",
          border: `1px solid ${isFocused ? "rgba(0, 212, 255, 0.35)" : "var(--glass-border)"}`,
          boxShadow: isFocused
            ? "0 0 16px rgba(0, 212, 255, 0.08), inset 0 1px 0 rgba(255,255,255,0.04)"
            : "inset 0 1px 0 rgba(255,255,255,0.02)",
        }}
      >
        <Search
          size={14}
          className="shrink-0 transition-colors duration-200"
          style={{ color: isFocused ? "var(--neon-blue)" : "var(--text-muted)" }}
        />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="키워드 입력 후 Enter"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
          style={{ color: "var(--text-primary)" }}
        />
        {input.trim() && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={addKeyword}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "rgba(0, 212, 255, 0.15)", color: "var(--neon-blue)" }}
          >
            <Plus size={14} strokeWidth={2.5} />
          </motion.button>
        )}
      </div>

      {/* ── Keyword List ───────────── */}
      <div className="flex flex-col gap-1">
        {isLoading ? (
          <div className="flex w-full items-center justify-center py-4 gap-2">
            <Loader2 size={14} className="animate-spin" style={{ color: "var(--neon-blue)" }} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>불러오는 중…</span>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {keywords.map((keyword) => {
              const cfg = STATUS_CONFIG[keyword.status] ?? STATUS_CONFIG["ACTIVE"];
              const isArchived = keyword.status === "ARCHIVED";

              return (
                <motion.div
                  key={keyword.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8, transition: { duration: 0.15 } }}
                  transition={{ type: "spring", stiffness: 380, damping: 24 }}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2"
                  style={{
                    background: "var(--glass-bg-light)",
                    border: `1px solid ${cfg.border}`,
                  }}
                >
                  {/* ── 상태 인디케이터 dot ── */}
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: cfg.dotColor, boxShadow: cfg.dotShadow }}
                  />

                  {/* ── 키워드 이름 ── */}
                  <button
                    className="flex-1 truncate text-left text-xs font-medium"
                    style={{ color: cfg.textColor }}
                    onClick={() => navigateToNewsWithKeyword(keyword.name)}
                    title={`"${keyword.name}" 뉴스 보기`}
                  >
                    {keyword.name}
                  </button>

                  {/* ── 상태 뱃지 (PAUSED·ARCHIVED만 표시) ── */}
                  {keyword.status !== "ACTIVE" && (
                    <span
                      className="shrink-0 rounded px-1 text-[9px] font-semibold"
                      style={{
                        background: isArchived
                          ? "rgba(100,100,120,0.15)"
                          : "rgba(251,191,36,0.12)",
                        color: cfg.dotColor,
                      }}
                    >
                      {cfg.badge}
                    </span>
                  )}

                  {/* ── 재수집 버튼 (ACTIVE만) ── */}
                  {keyword.status === "ACTIVE" && (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => recollectNews(keyword)}
                      disabled={recollectingIds.has(keyword.id)}
                      className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold transition-colors disabled:opacity-50"
                      style={{
                        background: "rgba(251, 191, 36, 0.10)",
                        border: "1px solid rgba(251, 191, 36, 0.20)",
                        color: "#fbbf24",
                      }}
                      title="뉴스 다시 수집"
                    >
                      <RefreshCw
                        size={9}
                        strokeWidth={2.5}
                        className={recollectingIds.has(keyword.id) ? "animate-spin" : ""}
                      />
                      <span>재수집</span>
                    </motion.button>
                  )}

                  {/* ── ACTIVE ↔ PAUSED 토글 (비아카이브만) ── */}
                  {!isArchived && (
                    <motion.button
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.85 }}
                      onClick={() => toggleActiveOrPaused(keyword)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors"
                      style={{
                        background:
                          keyword.status === "ACTIVE"
                            ? "rgba(251, 191, 36, 0.10)"
                            : "rgba(0, 212, 255, 0.12)",
                        color: keyword.status === "ACTIVE" ? "#fbbf24" : "var(--neon-blue)",
                      }}
                      aria-label={keyword.status === "ACTIVE" ? "수집 정지" : "수집 재개"}
                      title={keyword.status === "ACTIVE" ? "수집 정지" : "수집 재개"}
                    >
                      <Power size={10} strokeWidth={2.5} />
                    </motion.button>
                  )}

                  {/* ── 아카이브 버튼 (ACTIVE·PAUSED만) ── */}
                  {!isArchived ? (
                    <motion.button
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.85 }}
                      onClick={() => setStatus(keyword.id, "ARCHIVED")}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors"
                      style={{ background: "rgba(100, 100, 120, 0.15)", color: "var(--text-muted)" }}
                      aria-label="아카이브 (뉴스 보관 처리 후 수집 중단)"
                      title="아카이브"
                    >
                      <Archive size={10} strokeWidth={2.5} />
                    </motion.button>
                  ) : (
                    /* ── 복원 버튼 (ARCHIVED만) ── */
                    <motion.button
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.85 }}
                      onClick={() => setStatus(keyword.id, "ACTIVE")}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors"
                      style={{ background: "rgba(0, 212, 255, 0.10)", color: "var(--neon-blue)" }}
                      aria-label="수집 재개 (ACTIVE로 복원)"
                      title="수집 재개"
                    >
                      <RotateCcw size={10} strokeWidth={2.5} />
                    </motion.button>
                  )}

                  {/* ── 영구 삭제 ── */}
                  <motion.button
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.85 }}
                    onClick={() => removeKeyword(keyword.id)}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors"
                    style={{ background: "rgba(239, 68, 68, 0.12)", color: "#f87171" }}
                    aria-label={`${keyword.name} 삭제`}
                    title="영구 삭제"
                  >
                    <X size={10} strokeWidth={2.5} />
                  </motion.button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}

        {!isLoading && keywords.length === 0 && (
          <p className="py-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>
            모니터링할 키워드를 추가하세요
          </p>
        )}
      </div>

      {/* ── Toast Notifications ────── */}
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-2.5 rounded-xl px-4 py-3 text-xs shadow-lg"
            style={{
              background: "rgba(15, 23, 35, 0.95)",
              border: "1px solid rgba(251, 191, 36, 0.30)",
              color: "var(--text-primary)",
              backdropFilter: "blur(12px)",
              boxShadow: "0 0 24px rgba(251, 191, 36, 0.08)",
            }}
          >
            <RefreshCw size={13} className="mt-0.5 shrink-0" style={{ color: "#fbbf24" }} strokeWidth={2.5} />
            <span className="leading-relaxed">{toast.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
