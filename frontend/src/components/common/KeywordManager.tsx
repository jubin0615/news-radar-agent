"use client";

import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Search, Hash, Loader2, Power } from "lucide-react";
import { cn } from "@/lib/cn";
import { useNavigation } from "@/lib/NavigationContext";

// ── Types ────────────────────────────────────────────────────── //
interface Keyword {
  id: number;
  name: string;
  enabled: boolean;
  createdAt: string | null;
}

// ── Component ────────────────────────────────────────────────── //
export default function KeywordManager({ className }: { className?: string }) {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const { navigateToNewsWithKeyword } = useNavigation();

  // ── 초기 로딩: 백엔드에서 키워드 목록 가져오기 ──
  useEffect(() => {
    fetchKeywords();
  }, []);

  const fetchKeywords = async () => {
    try {
      const res = await fetch("/api/keywords");
      if (res.ok) {
        const data: Keyword[] = await res.json();
        setKeywords(data);
      }
    } catch {
      /* 네트워크 오류 무시 */
    } finally {
      setIsLoading(false);
    }
  };

  // ── 키워드 추가 ──
  const addKeyword = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (keywords.some((k) => k.name.toLowerCase() === trimmed.toLowerCase())) {
      setInput("");
      return;
    }

    try {
      const res = await fetch(`/api/keywords?name=${encodeURIComponent(trimmed)}`, {
        method: "POST",
      });
      if (res.ok) {
        const newKw: Keyword = await res.json();
        setKeywords((prev) => [...prev, newKw]);
      }
    } catch {
      /* 네트워크 오류 무시 */
    }
    setInput("");
  }, [input, keywords]);

  // ── 키워드 삭제 ──
  const removeKeyword = useCallback(async (id: number) => {
    setKeywords((prev) => prev.filter((k) => k.id !== id));
    try {
      await fetch(`/api/keywords/${id}`, { method: "DELETE" });
    } catch {
      // 실패 시 다시 로드
      fetchKeywords();
    }
  }, []);

  // ── 키워드 활성화/비활성화 토글 ──
  const toggleKeyword = useCallback(async (id: number) => {
    // Optimistic update
    setKeywords((prev) =>
      prev.map((k) => (k.id === id ? { ...k, enabled: !k.enabled } : k)),
    );
    try {
      const res = await fetch(`/api/keywords/${id}`, { method: "PUT" });
      if (res.ok) {
        const updated: Keyword = await res.json();
        setKeywords((prev) =>
          prev.map((k) => (k.id === updated.id ? updated : k)),
        );
      }
    } catch {
      fetchKeywords();
    }
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addKeyword();
    }
    // backspace on empty input removes last chip
    if (e.key === "Backspace" && input === "" && keywords.length > 0) {
      removeKeyword(keywords[keywords.length - 1].id);
    }
  };

  const activeCount = keywords.filter((k) => k.enabled).length;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* ── Section Header ─────────── */}
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
          style={{
            background: "rgba(0, 212, 255, 0.12)",
            color: "var(--neon-blue)",
          }}
        >
          {activeCount}/{keywords.length}
        </span>
      </div>

      {/* ── Input Area ─────────────── */}
      <div
        className={cn(
          "group relative flex items-center gap-2 rounded-xl px-3 py-2.5",
          "transition-all duration-200",
        )}
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
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-colors"
            style={{
              background: "rgba(0, 212, 255, 0.15)",
              color: "var(--neon-blue)",
            }}
          >
            <Plus size={14} strokeWidth={2.5} />
          </motion.button>
        )}
      </div>

      {/* ── Keyword Chips ──────────── */}
      <div className="flex flex-wrap gap-2 px-0.5">
        {isLoading ? (
          <div className="flex w-full items-center justify-center py-3 gap-2">
            <Loader2 size={14} className="animate-spin" style={{ color: "var(--neon-blue)" }} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>불러오는 중…</span>
          </div>
        ) : (
        <AnimatePresence mode="popLayout">
          {keywords.map((keyword) => (
            <motion.div
              key={keyword.id}
              layout
              initial={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.6, filter: "blur(4px)" }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              className="group/chip relative flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-200 hover:pr-14"
              style={{
                background: keyword.enabled
                  ? "rgba(0, 212, 255, 0.08)"
                  : "rgba(100, 100, 100, 0.08)",
                border: `1px solid ${keyword.enabled ? "rgba(0, 212, 255, 0.15)" : "rgba(100, 100, 100, 0.15)"}`,
                color: keyword.enabled ? "var(--neon-blue)" : "var(--text-muted)",
                opacity: keyword.enabled ? 1 : 0.6,
              }}
            >
              <span
                className="select-none"
                onClick={() => navigateToNewsWithKeyword(keyword.name)}
                title={`"${keyword.name}" 뉴스 보기`}
              >
                {keyword.name}
              </span>

              {/* Toggle button */}
              <motion.button
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.8 }}
                onClick={() => toggleKeyword(keyword.id)}
                className="absolute right-7 flex h-4 w-4 items-center justify-center rounded-full opacity-0 transition-opacity duration-150 group-hover/chip:opacity-100"
                style={{
                  background: keyword.enabled
                    ? "rgba(0, 212, 255, 0.20)"
                    : "rgba(34, 197, 94, 0.25)",
                  color: keyword.enabled ? "var(--neon-blue)" : "#22c55e",
                }}
                aria-label={`Toggle ${keyword.name}`}
                title={keyword.enabled ? "비활성화" : "활성화"}
              >
                <Power size={9} strokeWidth={3} />
              </motion.button>

              {/* Close button */}
              <motion.button
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.8 }}
                onClick={() => removeKeyword(keyword.id)}
                className="absolute right-1.5 flex h-4 w-4 items-center justify-center rounded-full opacity-0 transition-opacity duration-150 group-hover/chip:opacity-100"
                style={{
                  background: "rgba(239, 68, 68, 0.25)",
                  color: "#f87171",
                }}
                aria-label={`Remove ${keyword.name}`}
              >
                <X size={10} strokeWidth={3} />
              </motion.button>
            </motion.div>
          ))}
        </AnimatePresence>
        )}

        {!isLoading && keywords.length === 0 && (
          <p className="py-3 text-center text-xs w-full" style={{ color: "var(--text-muted)" }}>
            모니터링할 키워드를 추가하세요
          </p>
        )}
      </div>
    </div>
  );
}
