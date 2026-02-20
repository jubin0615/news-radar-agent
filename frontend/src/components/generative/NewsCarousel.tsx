"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Newspaper } from "lucide-react";
import { cn } from "@/lib/cn";
import type { NewsItem } from "@/types";
import NewsCard from "./NewsCard";

// ── Props ────────────────────────────────────────────────────── //
interface NewsCarouselProps {
  items: NewsItem[];
  title?: string;
  className?: string;
  onAskAboutNews?: (question: string) => void;
}

// ── Component ────────────────────────────────────────────────── //
export default function NewsCarousel({
  items,
  title = "수집된 뉴스",
  className,
  onAskAboutNews,
}: NewsCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  /* ── Check scroll boundaries ── */
  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      ro.disconnect();
    };
  }, [checkScroll, items]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = 320; // slightly more than card width
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  if (items.length === 0) {
    return (
      <div
        className={cn("glass flex flex-col items-center gap-3 p-8 text-center", className)}
      >
        <Newspaper size={28} style={{ color: "var(--text-muted)" }} strokeWidth={1.5} />
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          수집된 뉴스가 없습니다.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn("flex flex-col gap-4", className)}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{
              background: "rgba(0, 212, 255, 0.10)",
              border: "1px solid rgba(0, 212, 255, 0.18)",
            }}
          >
            <Newspaper size={13} style={{ color: "var(--neon-blue)" }} strokeWidth={2} />
          </div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {title}
          </h3>
          <span
            className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums"
            style={{
              background: "rgba(0, 212, 255, 0.12)",
              color: "var(--neon-blue)",
            }}
          >
            {items.length}
          </span>
        </div>

        {/* Arrow buttons */}
        <div className="flex items-center gap-1.5">
          <NavButton direction="left" disabled={!canScrollLeft} onClick={() => scroll("left")} />
          <NavButton direction="right" disabled={!canScrollRight} onClick={() => scroll("right")} />
        </div>
      </div>

      {/* ── Scrollable track ── */}
      <div className="relative">
        {/* Left fade */}
        <AnimatePresence>
          {canScrollLeft && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-16"
              style={{
                background: "linear-gradient(to right, var(--bg-primary), transparent)",
              }}
            />
          )}
        </AnimatePresence>

        {/* Right fade */}
        <AnimatePresence>
          {canScrollRight && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-16"
              style={{
                background: "linear-gradient(to left, var(--bg-primary), transparent)",
              }}
            />
          )}
        </AnimatePresence>

        <div
          ref={scrollRef}
          className="scrollbar-hidden flex items-start gap-4 overflow-x-auto pb-2 pt-1"
        >
          {items.map((item, i) => (
            <NewsCard key={item.id} news={item} index={i} onAskAboutNews={onAskAboutNews} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Internal: Nav Button ─────────────────────────────────────── //
function NavButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.1 }}
      whileTap={disabled ? {} : { scale: 0.92 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200",
        disabled && "pointer-events-none",
      )}
      style={{
        background: disabled ? "transparent" : "var(--glass-bg-light)",
        border: `1px solid ${disabled ? "transparent" : "var(--glass-border-light)"}`,
        color: disabled ? "var(--text-muted)" : "var(--text-secondary)",
        opacity: disabled ? 0.3 : 1,
      }}
    >
      {direction === "left" ? (
        <ChevronLeft size={15} strokeWidth={2} />
      ) : (
        <ChevronRight size={15} strokeWidth={2} />
      )}
    </motion.button>
  );
}
