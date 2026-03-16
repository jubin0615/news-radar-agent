"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Newspaper, TrendingUp, Clock, ExternalLink } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import type { NewsItem } from "@/types";

// ── Types ────────────────────────────────────────────────────── //
interface Keyword {
  id: number;
  name: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  createdAt: string | null;
}

interface KeywordWithStats extends Keyword {
  newsCount: number;
  latestNews: NewsItem[];
  category: string | null;
}

// ── Color palette by index (cybernetic neon theme) ─────────── //
const NEON_PALETTE = [
  { rgb: "0,212,255", name: "cyan" },       // electric cyan
  { rgb: "168,85,247", name: "purple" },     // vivid purple
  { rgb: "34,211,153", name: "emerald" },    // neon emerald
  { rgb: "251,146,60", name: "amber" },      // warm amber
];

function getNodeColor(index: number) {
  return NEON_PALETTE[index % NEON_PALETTE.length];
}

// ── Font helpers ─────────────────────────────────────────────── //
const isKorean = (text: string) => /[가-힣]/.test(text);
const FONT_MONO =
  "var(--font-geist-mono), monospace";
const FONT_SANS =
  "var(--font-geist-sans), 'Pretendard Variable', -apple-system, system-ui, sans-serif";

// ── Geometry helpers ─────────────────────────────────────────── //
function computeOrbitPositions(
  count: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  startAngle = -Math.PI / 2,
) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count + startAngle;
    return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
  });
}

function estimateTagTextWidth(text: string, korean: boolean, active: boolean) {
  const widthPerChar = korean ? 10.5 : active ? 8.8 : 8.1;
  return Math.max(44, text.length * widthPerChar);
}

function estimateKeywordPillWidth(keyword: KeywordWithStats, active = false) {
  const korean = isKorean(keyword.name);
  const paddingX = active ? 12 : 10;
  const dotSize = 8;
  const dotGap = 6;
  const labelWidth = estimateTagTextWidth(keyword.name, korean, active);
  // Count badge is now external (floating), not included in pill width
  return paddingX * 2 + dotSize + dotGap + labelWidth;
}

function computeCollisionAwareRingPositions(
  indices: number[],
  keywords: KeywordWithStats[],
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
) {
  if (indices.length === 0) return [] as { x: number; y: number }[];
  if (indices.length === 1) {
    return computeOrbitPositions(1, cx, cy, radius, radius, startAngle);
  }

  const items = indices.map((idx) => {
    const pillWidth = estimateKeywordPillWidth(keywords[idx]);
    return { idx, collisionRadius: pillWidth / 2 + 14 };
  });

  const baseStep = (2 * Math.PI) / indices.length;
  let angles = indices.map((_, i) => startAngle + i * baseStep);

  for (let pass = 0; pass < 4; pass += 1) {
    for (let i = 1; i < angles.length; i += 1) {
      const prev = items[i - 1];
      const current = items[i];
      const minGap =
        (prev.collisionRadius + current.collisionRadius) / radius;

      if (angles[i] - angles[i - 1] < minGap) {
        angles[i] = angles[i - 1] + minGap;
      }
    }

    const first = items[0];
    const last = items[items.length - 1];
    const minWrapGap =
      (first.collisionRadius + last.collisionRadius) / radius;
    const wrapGap = 2 * Math.PI - (angles[angles.length - 1] - angles[0]);

    if (wrapGap < minWrapGap) {
      const spread = minWrapGap - wrapGap;
      const mid = (angles.length - 1) / 2;
      angles = angles.map(
        (angle, i) =>
          angle + ((i - mid) / Math.max(1, angles.length - 1)) * spread,
      );
    }

    const desiredMean = startAngle + baseStep * ((angles.length - 1) / 2);
    const actualMean =
      angles.reduce((sum, angle) => sum + angle, 0) / angles.length;
    const shift = desiredMean - actualMean;
    angles = angles.map((angle) => angle + shift);
  }

  return angles.map((angle) => ({
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  }));
}

// ── SVG Defs (filters & gradients) ──────────────────────────── //
function SvgDefs() {
  return (
    <defs>
      {/* Core node gradient */}
      <radialGradient id="coreGrad" cx="40%" cy="40%">
        <stop offset="0%" stopColor="rgba(0,212,255,0.30)" />
        <stop offset="100%" stopColor="rgba(168,85,247,0.10)" />
      </radialGradient>

      {/* Glow filters per color */}
      {NEON_PALETTE.map((c) => (
        <filter key={c.name} id={`glow-${c.name}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feFlood floodColor={`rgb(${c.rgb})`} floodOpacity="0.35" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="colorBlur" />
          <feMerge>
            <feMergeNode in="colorBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      ))}

      {/* Core glow */}
      <filter id="coreGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="5" result="blur" />
        <feFlood floodColor="rgb(0,212,255)" floodOpacity="0.3" result="color" />
        <feComposite in="color" in2="blur" operator="in" result="colorBlur" />
        <feMerge>
          <feMergeNode in="colorBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

    </defs>
  );
}

// ── Core Node ────────────────────────────────────────────────── //
function CoreNode({
  cx,
  cy,
  dimmed,
}: {
  cx: number;
  cy: number;
  dimmed: boolean;
}) {
  return (
    <g style={{ opacity: dimmed ? 0.15 : 1, transition: "opacity 0.5s ease" }}>
      {/* Outer pulse ring */}
      <circle cx={cx} cy={cy} r={38} fill="none">
        <animate attributeName="r" values="36;44;36" dur="4s" repeatCount="indefinite" />
        <animate attributeName="stroke-opacity" values="0.1;0.3;0.1" dur="4s" repeatCount="indefinite" />
        <set attributeName="stroke" to="rgba(0,212,255,0.25)" />
        <set attributeName="stroke-width" to="1" />
      </circle>

      <circle
        cx={cx}
        cy={cy}
        r={34}
        fill="url(#coreGrad)"
        stroke="rgba(0,212,255,0.4)"
        strokeWidth={1.5}
        filter="url(#coreGlow)"
      />

      {/* Inner bright dot */}
      <circle cx={cx} cy={cy} r={8} fill="rgba(0,212,255,0.6)">
        <animate attributeName="r" values="6;9;6" dur="2.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.5;0.9;0.5" dur="2.5s" repeatCount="indefinite" />
      </circle>

      {/* Center label — large & luminous */}
      <text
        x={cx}
        y={cy + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fill="rgba(0,230,255,0.95)"
        fontSize={13}
        fontFamily={FONT_MONO}
        fontWeight={800}
        letterSpacing="0.22em"
        filter="url(#coreGlow)"
        style={{
          textShadow:
            "0 0 8px rgba(0,212,255,0.8), 0 0 20px rgba(0,212,255,0.4), 0 0 40px rgba(0,212,255,0.2)",
        }}
      >
        RADAR
      </text>
    </g>
  );
}

// ── Satellite Node (radar target style) ─────────────────────── //
function SatelliteNode({
  keyword,
  x,
  y,
  index,
  isHighweight,
  isSelected,
  isHovered,
  dimmed,
  onHoverStart,
  onHoverEnd,
  onClick,
}: {
  keyword: KeywordWithStats;
  x: number;
  y: number;
  index: number;
  isHighweight: boolean;
  isSelected: boolean;
  isHovered: boolean;
  dimmed: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onClick: () => void;
}) {
  const color = getNodeColor(index);
  const active = isSelected || isHovered;
  const koreanLabel = isKorean(keyword.name);
  const countLabel = keyword.newsCount > 99 ? "99+" : `${keyword.newsCount}`;
  const showCount = keyword.newsCount > 0;

  // Pill dimensions (count badge is external)
  const paddingX = active ? 12 : 10;
  const pillHeight = active ? 26 : 24;
  const dotSize = 8;
  const dotGap = 6;
  const labelWidth = estimateTagTextWidth(keyword.name, koreanLabel, active);
  const pillWidth = paddingX * 2 + dotSize + dotGap + labelWidth;

  const pillX = x - pillWidth / 2;
  const pillY = y - pillHeight / 2;

  // Targeting bracket geometry
  const bracketGap = active ? 4 : 3;
  const bracketLen = active ? 8 : 6;
  const bx1 = pillX - bracketGap;
  const by1 = pillY - bracketGap;
  const bx2 = pillX + pillWidth + bracketGap;
  const by2 = pillY + pillHeight + bracketGap;

  // Floating count badge position (top-right corner)
  const badgeR = countLabel.length > 2 ? 11 : 9;
  const badgeCx = pillX + pillWidth - 2;
  const badgeCy = pillY - 2;

  return (
    <motion.g
      layout
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: dimmed ? 0.12 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 25,
        delay: index * 0.06,
        opacity: { duration: 0.45, ease: "easeInOut" },
      }}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        onClick();
      }}
      style={{ cursor: "pointer" }}
    >
      {/* Targeting brackets ┌ ┐ └ ┘ */}
      <g
        stroke={`rgba(${color.rgb},${active ? 0.6 : dimmed ? 0.08 : 0.22})`}
        strokeWidth={active ? 1.2 : 0.8}
        strokeLinecap="round"
        fill="none"
      >
        <path d={`M ${bx1} ${by1 + bracketLen} L ${bx1} ${by1} L ${bx1 + bracketLen} ${by1}`} />
        <path d={`M ${bx2 - bracketLen} ${by1} L ${bx2} ${by1} L ${bx2} ${by1 + bracketLen}`} />
        <path d={`M ${bx1} ${by2 - bracketLen} L ${bx1} ${by2} L ${bx1 + bracketLen} ${by2}`} />
        <path d={`M ${bx2 - bracketLen} ${by2} L ${bx2} ${by2} L ${bx2} ${by2 - bracketLen}`} />
      </g>

      {/* Hover/select glow */}
      <AnimatePresence>
        {active && (
          <motion.rect
            x={pillX - 2}
            y={pillY - 2}
            width={pillWidth + 4}
            height={pillHeight + 4}
            rx={(pillHeight + 4) / 2}
            fill={`rgba(${color.rgb},0.06)`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          />
        )}
      </AnimatePresence>

      {/* Pill background */}
      <rect
        x={pillX}
        y={pillY}
        width={pillWidth}
        height={pillHeight}
        rx={pillHeight / 2}
        fill={active ? "rgba(8, 12, 20, 0.88)" : "rgba(8, 12, 20, 0.74)"}
        stroke={`rgba(${color.rgb},${active ? 0.4 : dimmed ? 0.1 : 0.2})`}
        strokeWidth={active ? 1 : 0.7}
      />

      {/* Blip dot */}
      <circle
        cx={pillX + paddingX + dotSize / 2}
        cy={y}
        r={dotSize / 2}
        fill={`rgba(${color.rgb},${active ? 1 : 0.75})`}
        filter={active || isHighweight ? `url(#glow-${color.name})` : undefined}
      >
        {(isHighweight || active) && !dimmed && (
          <animate
            attributeName="opacity"
            values="0.7;1;0.7"
            dur="2s"
            repeatCount="indefinite"
          />
        )}
      </circle>

      {/* Blip bright core */}
      <circle
        cx={pillX + paddingX + dotSize / 2}
        cy={y}
        r={2}
        fill={`rgba(255,255,255,${active ? 0.9 : 0.6})`}
      />

      {/* Keyword name */}
      <motion.text
        x={pillX + paddingX + dotSize + dotGap}
        y={y + 0.5}
        textAnchor="start"
        dominantBaseline="central"
        fill={
          active
            ? "rgba(241, 245, 249, 0.98)"
            : dimmed
              ? "rgba(226, 232, 240, 0.38)"
              : "rgba(226, 232, 240, 0.84)"
        }
        fontSize={koreanLabel ? (active ? 13 : 12) : active ? 12 : 11}
        fontFamily={koreanLabel ? FONT_SANS : FONT_MONO}
        fontWeight={active ? 700 : 600}
        letterSpacing={koreanLabel ? "0.02em" : "0.05em"}
        transition={{ duration: 0.25 }}
        style={{
          textTransform: koreanLabel ? ("none" as const) : ("uppercase" as const),
          textShadow: active ? `0 0 12px rgba(${color.rgb},0.24)` : "none",
        }}
      >
        {keyword.name}
      </motion.text>

      {/* Floating count badge (top-right corner) */}
      {showCount && (
        <g>
          <circle
            cx={badgeCx}
            cy={badgeCy}
            r={badgeR}
            fill="rgba(8, 12, 20, 0.9)"
            stroke={`rgba(${color.rgb},${active ? 0.5 : dimmed ? 0.1 : 0.3})`}
            strokeWidth={0.8}
          />
          <text
            x={badgeCx}
            y={badgeCy + 0.5}
            textAnchor="middle"
            dominantBaseline="central"
            fill={`rgba(${color.rgb},${active ? 0.96 : dimmed ? 0.35 : 0.82})`}
            fontSize={8}
            fontFamily={FONT_MONO}
            fontWeight={700}
          >
            {countLabel}
          </text>
        </g>
      )}
    </motion.g>
  );
}

// ── Info Panel (Glassmorphism) ───────────────────────────────── //
function InfoPanel({
  keyword,
  colorIndex,
  onClose,
}: {
  keyword: KeywordWithStats;
  colorIndex: number;
  onClose: () => void;
}) {
  const color = getNodeColor(colorIndex);
  const hasNews = keyword.latestNews.length > 0;

  // Trend indicator (simple heuristic)
  const trendLabel =
    keyword.newsCount >= 10
      ? "HOT"
      : keyword.newsCount >= 5
        ? "ACTIVE"
        : keyword.newsCount > 0
          ? "NORMAL"
          : "IDLE";
  const trendColor =
    keyword.newsCount >= 10
      ? "rgb(239,68,68)"
      : keyword.newsCount >= 5
        ? "rgb(34,211,153)"
        : keyword.newsCount > 0
          ? "rgb(0,212,255)"
          : "rgb(100,100,120)";

  return (
    <motion.div
      initial={{ opacity: 0, x: 30, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 30, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
      className="absolute right-0 top-0 bottom-0 z-30 flex w-[280px] flex-col overflow-hidden rounded-2xl border"
      style={{
        background: "rgba(10, 10, 18, 0.80)",
        backdropFilter: "blur(20px) saturate(1.4)",
        WebkitBackdropFilter: "blur(20px) saturate(1.4)",
        borderColor: `rgba(${color.rgb}, 0.25)`,
        boxShadow: `0 0 40px rgba(${color.rgb}, 0.08), inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}
    >
      {/* Header */}
      <div
        className="relative flex items-start justify-between gap-2 px-5 pt-5 pb-4"
        style={{
          background: `linear-gradient(135deg, rgba(${color.rgb},0.12) 0%, transparent 60%)`,
        }}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{
                background: `rgb(${color.rgb})`,
                boxShadow: `0 0 8px rgba(${color.rgb},0.6)`,
              }}
            />
            <span
              className="text-base font-bold"
              style={{
                color: `rgb(${color.rgb})`,
                textShadow: `0 0 12px rgba(${color.rgb},0.3)`,
              }}
            >
              {keyword.name}
            </span>
          </div>
          <div
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
            style={{ color: trendColor }}
          >
            <TrendingUp size={11} />
            {trendLabel}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="rounded-lg p-1 transition-colors hover:bg-white/10"
          style={{ color: `rgba(${color.rgb},0.6)` }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 px-5 py-3">
        <div
          className="rounded-xl border px-3 py-2"
          style={{
            background: "rgba(255,255,255,0.02)",
            borderColor: "rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
            <Newspaper size={10} />
            뉴스
          </div>
          <div
            className="mt-1 text-xl font-bold"
            style={{ color: `rgb(${color.rgb})` }}
          >
            {keyword.newsCount}
          </div>
        </div>
        <div
          className="rounded-xl border px-3 py-2"
          style={{
            background: "rgba(255,255,255,0.02)",
            borderColor: "rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
            <Clock size={10} />
            등록일
          </div>
          <div className="mt-1 text-xs font-semibold text-[var(--text-secondary)]">
            {keyword.createdAt
              ? new Date(keyword.createdAt).toLocaleDateString("ko-KR", {
                  month: "short",
                  day: "numeric",
                })
              : "—"}
          </div>
        </div>
      </div>

      {/* Neon divider */}
      <div
        className="mx-5 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, rgba(${color.rgb},0.3), transparent)`,
        }}
      />

      {/* Latest News */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-5 py-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
          최신 뉴스
        </span>
        {hasNews ? (
          keyword.latestNews.slice(0, 5).map((news) => (
            <a
              key={news.id}
              href={news.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-2 rounded-lg border px-3 py-2 transition-all hover:border-[rgba(255,255,255,0.12)] hover:bg-white/[0.03]"
              style={{ borderColor: "rgba(255,255,255,0.05)" }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium leading-snug text-[var(--text-secondary)] line-clamp-2 group-hover:text-[var(--text-primary)]">
                  {news.title}
                </p>
                {news.grade && news.grade !== "N/A" && (
                  <span
                    className="mt-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
                    style={{
                      background:
                        news.grade === "CRITICAL"
                          ? "rgba(239,68,68,0.15)"
                          : news.grade === "HIGH"
                            ? "rgba(245,158,11,0.15)"
                            : "rgba(0,212,255,0.08)",
                      color:
                        news.grade === "CRITICAL"
                          ? "#f87171"
                          : news.grade === "HIGH"
                            ? "#fbbf24"
                            : "var(--neon-blue)",
                    }}
                  >
                    {news.grade}
                  </span>
                )}
              </div>
              <ExternalLink
                size={12}
                className="mt-0.5 shrink-0 text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100"
              />
            </a>
          ))
        ) : (
          <p className="py-4 text-center text-[11px] text-[var(--text-muted)]">
            수집된 뉴스가 없습니다
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ── Main Component ───────────────────────────────────────────── //
export default function KeywordMap({
  className,
}: {
  className?: string;
}) {
  const [keywords, setKeywords] = useState<KeywordWithStats[]>([]);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const newsCache = useRef<Map<string, { news: NewsItem[]; ts: number }>>(
    new Map(),
  );

  // Fetch keywords & enrich with news counts
  useEffect(() => {
    const fetchKeywords = async () => {
      try {
        const res = await apiFetch("/api/keywords");
        if (!res.ok) return;
        const data: Keyword[] = await res.json();
        const active = data.filter((k) => k.status === "ACTIVE");

        // Fetch all news once and group by keyword
        const now = Date.now();
        const cache = newsCache.current;
        let allNews: NewsItem[] = [];

        if (!cache.has("__all") || now - cache.get("__all")!.ts > 30_000) {
          const newsRes = await apiFetch("/api/news");
          if (newsRes.ok) {
            allNews = await newsRes.json();
            cache.set("__all", { news: allNews, ts: now });
          }
        } else {
          allNews = cache.get("__all")!.news;
        }

        // Group news by keyword
        const newsByKeyword = new Map<string, NewsItem[]>();
        for (const n of allNews) {
          const kw = n.keyword?.toLowerCase() ?? "";
          if (!newsByKeyword.has(kw)) newsByKeyword.set(kw, []);
          newsByKeyword.get(kw)!.push(n);
        }

        const enriched: KeywordWithStats[] = active.map((k) => {
          const kwNews = newsByKeyword.get(k.name.toLowerCase()) ?? [];
          // Sort by collectedAt desc
          kwNews.sort(
            (a, b) =>
              new Date(b.collectedAt).getTime() -
              new Date(a.collectedAt).getTime(),
          );
          return {
            ...k,
            newsCount: kwNews.length,
            latestNews: kwNews.slice(0, 5),
            category: kwNews[0]?.category ?? null,
          };
        });

        setKeywords(enriched);
      } catch {
        /* ignore */
      }
    };

    fetchKeywords();
    const interval = setInterval(fetchKeywords, 15_000);
    return () => clearInterval(interval);
  }, []);

  // Compute high-weight threshold (top 30%)
  const highWeightThreshold = useMemo(() => {
    if (keywords.length === 0) return Infinity;
    const counts = keywords.map((k) => k.newsCount).sort((a, b) => b - a);
    const idx = Math.max(0, Math.floor(counts.length * 0.3) - 1);
    return counts[idx] ?? 1;
  }, [keywords]);

  // SVG layout — orbit radius auto-expands when pills would overlap
  const layoutInfo = useMemo(() => {
    const baseRadius = 110;
    if (keywords.length === 0) return { orbitRadius: baseRadius, viewSize: 360 };
    const totalPillWidth = keywords.reduce(
      (sum, kw) => sum + estimateKeywordPillWidth(kw) + 16,
      0,
    );
    const neededRadius = Math.max(baseRadius, Math.ceil(totalPillWidth / (2 * Math.PI)));
    const maxPillHalf = Math.max(...keywords.map(kw => estimateKeywordPillWidth(kw) / 2));
    const neededView = Math.max(360, Math.ceil((neededRadius + maxPillHalf + 30) * 2));
    return { orbitRadius: neededRadius, viewSize: neededView };
  }, [keywords]);

  const { orbitRadius, viewSize } = layoutInfo;
  const viewW = viewSize;
  const viewH = viewSize;
  const cx = viewSize / 2;
  const cy = viewSize / 2;
  const sweepRadius = orbitRadius + 32;

  const positions = useMemo(() => {
    if (keywords.length <= 3) {
      return computeOrbitPositions(
        keywords.length,
        cx,
        cy,
        orbitRadius,
        orbitRadius,
      );
    }

    return computeCollisionAwareRingPositions(
      keywords.map((_, idx) => idx),
      keywords,
      cx,
      cy,
      orbitRadius,
      -Math.PI / 2 + Math.PI / 14,
    );
  }, [keywords, cx, cy, orbitRadius]);

  // Determine which IDs are "active" (selected or hovered + neighbors)
  const activeIds = useMemo(() => {
    const focusId = selectedId ?? hoveredId;
    if (focusId == null) return null; // null = no dimming, all visible
    // All nodes are connected to core, so "neighbors" = all, but we only
    // highlight the focused node to create contrast
    return new Set([focusId]);
  }, [selectedId, hoveredId]);

  const handleNodeClick = useCallback(
    (id: number) => {
      setSelectedId((prev) => (prev === id ? null : id));
    },
    [],
  );

  const handleBackdropClick = useCallback(() => {
    setSelectedId(null);
  }, []);

  const selectedKeyword = keywords.find((k) => k.id === selectedId) ?? null;
  const selectedIndex = keywords.findIndex((k) => k.id === selectedId);

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      <div className="relative" onClick={handleBackdropClick}>
        {/* Title */}
        <div className="mb-3 flex items-center gap-2">
          <div
            className="h-2 w-2 rounded-full"
            style={{
              background: "var(--neon-purple)",
              boxShadow: "0 0 6px rgba(168,85,247,0.6)",
            }}
          />
          <span
            className="text-sm font-mono font-bold uppercase tracking-[0.15em]"
            style={{ color: "var(--text-secondary)" }}
          >
            KEYWORD MAP
          </span>
          {keywords.length > 0 && (
            <span
              className="ml-auto text-[10px] font-mono tabular-nums"
              style={{ color: "var(--text-muted)" }}
            >
              {keywords.length} NODE{keywords.length !== 1 && "S"}
            </span>
          )}
        </div>

        <svg
          viewBox={`0 0 ${viewW} ${viewH}`}
          preserveAspectRatio="xMidYMid meet"
          className="mx-auto block h-auto w-full max-w-[420px]"
        >
          <SvgDefs />

          {/* ── Layer 0: Crosshair + concentric grid (centered on core) ── */}
          <g style={{ pointerEvents: "none" }}>
            {/* Main crosshair */}
            <line
              x1={cx} y1={0} x2={cx} y2={viewH}
              stroke="rgba(0,212,255,0.15)" strokeWidth={1}
            />
            <line
              x1={0} y1={cy} x2={viewW} y2={cy}
              stroke="rgba(0,212,255,0.15)" strokeWidth={1}
            />
            {/* Diagonal crosshairs */}
            <line
              x1={cx - 180} y1={cy - 160} x2={cx + 180} y2={cy + 160}
              stroke="rgba(0,212,255,0.07)" strokeWidth={0.6}
            />
            <line
              x1={cx + 180} y1={cy - 160} x2={cx - 180} y2={cy + 160}
              stroke="rgba(0,212,255,0.07)" strokeWidth={0.6}
            />
            {/* Concentric circles — scale with orbit radius */}
            {[0.38, 0.73, 1.07, 1.42].map((ratio) => {
              const r = Math.round(orbitRadius * ratio);
              return (
                <circle
                  key={ratio}
                  cx={cx} cy={cy} r={r}
                  fill="none"
                  stroke={ratio <= 0.73 ? "rgba(0,212,255,0.14)" : "rgba(0,212,255,0.10)"}
                  strokeWidth={ratio <= 0.38 ? 1 : ratio <= 0.73 ? 0.8 : 0.6}
                  strokeDasharray={ratio > 1.07 ? "5 7" : ratio > 0.73 ? "3 5" : "none"}
                />
              );
            })}
            {/* Tick marks on horizontal crosshair */}
            {[-140, -110, -80, -50, 50, 80, 110, 140].map((d) => (
              <line
                key={`h${d}`}
                x1={cx + d} y1={cy - 4} x2={cx + d} y2={cy + 4}
                stroke="rgba(0,212,255,0.18)" strokeWidth={0.7}
              />
            ))}
            {/* Tick marks on vertical crosshair */}
            {[-120, -80, -40, 40, 80, 120].map((d) => (
              <line
                key={`v${d}`}
                x1={cx - 4} y1={cy + d} x2={cx + 4} y2={cy + d}
                stroke="rgba(0,212,255,0.18)" strokeWidth={0.7}
              />
            ))}
          </g>

          {/* ── Layer 1: Sweeping radar beam (pure SVG) ── */}
          <g style={{ pointerEvents: "none" }}>
            <defs>
              <mask id="radar-sweep-mask">
                <radialGradient id="radar-sweep-fade" cx="50%" cy="50%" r="50%">
                  <stop offset="30%" stopColor="white" />
                  <stop offset="70%" stopColor="black" />
                </radialGradient>
                <circle cx={cx} cy={cy} r={sweepRadius} fill="url(#radar-sweep-fade)" />
              </mask>
            </defs>
            <g
              mask="url(#radar-sweep-mask)"
              style={{
                transformOrigin: `${cx}px ${cy}px`,
                animation: "radarSweep 4s linear infinite",
                willChange: "transform",
              }}
            >
              {/* Wedge-shaped sweep beam using a pie slice path */}
              <path
                d={`M ${cx} ${cy} L ${cx} ${cy - sweepRadius} A ${sweepRadius} ${sweepRadius} 0 0 1 ${cx + sweepRadius * Math.sin(Math.PI / 6)} ${cy - sweepRadius * Math.cos(Math.PI / 6)} Z`}
                fill="rgba(0,212,255,0.18)"
              />
              <path
                d={`M ${cx} ${cy} L ${cx + sweepRadius * Math.sin(Math.PI / 6)} ${cy - sweepRadius * Math.cos(Math.PI / 6)} A ${sweepRadius} ${sweepRadius} 0 0 1 ${cx + sweepRadius * Math.sin(Math.PI / 3)} ${cy - sweepRadius * Math.cos(Math.PI / 3)} Z`}
                fill="rgba(0,212,255,0.08)"
              />
              <path
                d={`M ${cx} ${cy} L ${cx + sweepRadius * Math.sin(Math.PI / 3)} ${cy - sweepRadius * Math.cos(Math.PI / 3)} A ${sweepRadius} ${sweepRadius} 0 0 1 ${cx + sweepRadius} ${cy} Z`}
                fill="rgba(0,212,255,0.02)"
              />
            </g>
          </g>

          {/* Orbit track ellipse */}
          <ellipse
            cx={cx}
            cy={cy}
            rx={orbitRadius}
            ry={orbitRadius}
            fill="none"
            stroke="rgba(0,212,255,0.08)"
            strokeWidth={0.8}
            strokeDasharray="4 6"
            style={{
              opacity: activeIds ? 0.3 : 1,
              transition: "opacity 0.5s ease",
            }}
          />

          {/* Secondary orbit ring (decorative) */}
          <ellipse
            cx={cx}
            cy={cy}
            rx={orbitRadius + 14}
            ry={orbitRadius + 14}
            fill="none"
            stroke="rgba(168,85,247,0.05)"
            strokeWidth={0.55}
            strokeDasharray="2 8"
            style={{
              opacity: activeIds ? 0.18 : 1,
              transition: "opacity 0.5s ease",
            }}
          />

          {/* Core */}
          <CoreNode cx={cx} cy={cy} dimmed={activeIds != null} />

          {/* Satellite keywords */}
          <AnimatePresence>
            {keywords.map((kw, i) => {
              const isDimmed =
                activeIds != null && !activeIds.has(kw.id);
              return (
                <SatelliteNode
                  key={kw.id}
                  keyword={kw}
                  x={positions[i]?.x ?? cx}
                  y={positions[i]?.y ?? cy}
                  index={i}
                  isHighweight={kw.newsCount >= highWeightThreshold && kw.newsCount > 0}
                  isSelected={selectedId === kw.id}
                  isHovered={hoveredId === kw.id}
                  dimmed={isDimmed}
                  onHoverStart={() => setHoveredId(kw.id)}
                  onHoverEnd={() => setHoveredId(null)}
                  onClick={() => handleNodeClick(kw.id)}
                />
              );
            })}
          </AnimatePresence>

          {/* Empty state */}
          {keywords.length === 0 && (
            <text
              x={cx} y={cy + 70}
              textAnchor="middle"
              fill="rgba(255,255,255,0.25)"
              fontSize={13}
              fontFamily={FONT_MONO}
              fontWeight={600}
            >
              NO ACTIVE KEYWORDS
            </text>
          )}
        </svg>
      </div>

      {/* ── Info Panel (slide-in from right) ── */}
      <AnimatePresence>
        {selectedKeyword && (
          <InfoPanel
            keyword={selectedKeyword}
            colorIndex={selectedIndex}
            onClose={() => setSelectedId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
