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

/** Quadratic bezier path that curves outward from center */
function curvedLinkPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  // Push control point perpendicular to the line, away from center
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const perpX = -dy / len;
  const perpY = dx / len;
  // Determine which side of the center the midpoint is on
  const toMidX = mx - cx;
  const toMidY = my - cy;
  const sign = perpX * toMidX + perpY * toMidY > 0 ? 1 : -1;
  const curvature = len * 0.18;
  const cpx = mx + perpX * curvature * sign;
  const cpy = my + perpY * curvature * sign;
  return `M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`;
}

function estimateTagTextWidth(text: string, korean: boolean, active: boolean) {
  const widthPerChar = korean ? 10.5 : active ? 8.8 : 8.1;
  return Math.max(44, text.length * widthPerChar);
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

      {/* Link gradients */}
      {NEON_PALETTE.map((c) => (
        <linearGradient key={`lg-${c.name}`} id={`link-grad-${c.name}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={`rgba(${c.rgb},0.05)`} />
          <stop offset="50%" stopColor={`rgba(${c.rgb},0.35)`} />
          <stop offset="100%" stopColor={`rgba(${c.rgb},0.05)`} />
        </linearGradient>
      ))}
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

// ── Satellite Node ───────────────────────────────────────────── //
function SatelliteNode({
  keyword,
  x,
  y,
  cx,
  cy,
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
  cx: number;
  cy: number;
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
  const nodeRadius = active ? 9 : isHighweight ? 7.5 : 6;
  const shellRadius = active ? nodeRadius + 6 : nodeRadius + 4;
  const radialX = x - cx;
  const radialY = y - cy;
  const radialLength = Math.hypot(radialX, radialY) || 1;
  const nx = radialX / radialLength;
  const ny = radialY / radialLength;
  const tagPaddingX = active ? 12 : 10;
  const tagHeight = active ? 24 : 22;
  const badgeWidth = showCount ? Math.max(22, countLabel.length * 6 + 10) : 0;
  const labelWidth = estimateTagTextWidth(keyword.name, koreanLabel, active);
  const tagGap = showCount ? 8 : 0;
  const tagWidth = tagPaddingX * 2 + labelWidth + tagGap + badgeWidth;
  const tagDistance = nodeRadius + 14 + tagWidth / 2;
  const tagCenterX = x + nx * tagDistance;
  const tagCenterY = y + ny * (nodeRadius + 8);
  const tagX = tagCenterX - tagWidth / 2;
  const tagY = tagCenterY - tagHeight / 2;
  const connectorStartX = x + nx * (nodeRadius + 2);
  const connectorStartY = y + ny * (nodeRadius + 2);
  const connectorEndX = tagCenterX - nx * Math.min(tagWidth / 2 - 6, 18);
  const connectorEndY = tagCenterY - ny * Math.max(tagHeight / 2 - 4, 6);

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
      {/* Curved connection link */}
      <motion.path
        d={curvedLinkPath(cx, cy, x, y, cx, cy)}
        fill="none"
        stroke={
          active
            ? `rgba(${color.rgb},0.85)`
            : `url(#link-grad-${color.name})`
        }
        strokeWidth={active ? 2 : 1.2}
        strokeLinecap="round"
        transition={{ duration: 0.3 }}
      />

      <line
        x1={connectorStartX}
        y1={connectorStartY}
        x2={connectorEndX}
        y2={connectorEndY}
        stroke={`rgba(${color.rgb},${active ? 0.55 : dimmed ? 0.12 : 0.28})`}
        strokeWidth={active ? 1.35 : 1}
        strokeLinecap="round"
      />

      {/* Outer glow ring (hover / select) */}
      <AnimatePresence>
        {active && (
          <motion.circle
            cx={x}
            cy={y}
            r={shellRadius + 7}
            fill={`rgba(${color.rgb},0.08)`}
            stroke={`rgba(${color.rgb},0.18)`}
            strokeWidth={0.75}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          />
        )}
      </AnimatePresence>

      {/* Pulse ring for high-weight nodes */}
      {isHighweight && !dimmed && (
        <circle cx={x} cy={y} r={shellRadius} fill="none">
          <animate
            attributeName="r"
            values={`${shellRadius};${shellRadius + 9};${shellRadius}`}
            dur="3s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="stroke-opacity"
            values="0.3;0;0.3"
            dur="3s"
            repeatCount="indefinite"
          />
          <set attributeName="stroke" to={`rgba(${color.rgb},0.4)`} />
          <set attributeName="stroke-width" to="1.5" />
        </circle>
      )}

      {/* Orb shell */}
      <motion.circle
        cx={x}
        cy={y}
        r={shellRadius}
        fill={`rgba(${color.rgb},${active ? 0.14 : 0.08})`}
        stroke={`rgba(${color.rgb},${active ? 0.42 : 0.2})`}
        strokeWidth={0.9}
        transition={{ duration: 0.25 }}
      />

      {/* Main node circle */}
      <motion.circle
        cx={x}
        cy={y}
        r={nodeRadius}
        fill={`rgba(${color.rgb},${active ? 0.86 : 0.62})`}
        stroke={`rgba(${color.rgb},${active ? 0.9 : 0.35})`}
        strokeWidth={active ? 1.5 : 1}
        filter={active || isHighweight ? `url(#glow-${color.name})` : undefined}
        transition={{ duration: 0.25 }}
      />

      {/* Inner bright core */}
      <circle cx={x} cy={y} r={2.2} fill={`rgba(${color.rgb},0.95)`} />
      <circle
        cx={x - nodeRadius * 0.38}
        cy={y - nodeRadius * 0.34}
        r={1.5}
        fill="rgba(255,255,255,0.78)"
        opacity={active ? 0.95 : 0.55}
      />

      {/* Label + count group — stacked vertically above node */}
      <g style={{ display: "none" }}>
        {/* Keyword name */}
        <motion.text
          x={x}
          y={y + (active ? 22 : 18)}
          textAnchor="middle"
          fill={`rgba(${color.rgb},${active ? 1 : dimmed ? 0.3 : 0.7})`}
          fontSize={
            isKorean(keyword.name) ? (active ? 14 : 12) : (active ? 13 : 11)
          }
          fontFamily={isKorean(keyword.name) ? FONT_SANS : FONT_MONO}
          fontWeight={active ? 700 : 600}
          letterSpacing={isKorean(keyword.name) ? "0.02em" : "0.06em"}
          transition={{ duration: 0.25 }}
          style={{
            textTransform: isKorean(keyword.name)
              ? ("none" as const)
              : ("uppercase" as const),
            textShadow: active
              ? `0 0 10px rgba(${color.rgb},0.6), 0 0 25px rgba(${color.rgb},0.25)`
              : "none",
          }}
        >
          {keyword.name}
        </motion.text>

        {/* News count — small pill below keyword name */}
        {keyword.newsCount > 0 && !dimmed && (
          <g>
            <rect
              x={x - 14}
              y={y + (active ? 26 : 22)}
              width={28}
              height={14}
              rx={7}
              fill={`rgba(${color.rgb},0.12)`}
              stroke={`rgba(${color.rgb},0.25)`}
              strokeWidth={0.5}
            />
            <text
              x={x}
              y={y + (active ? 33 : 29)}
              textAnchor="middle"
              dominantBaseline="central"
              fill={`rgba(${color.rgb},0.85)`}
              fontSize={8}
              fontFamily={FONT_MONO}
              fontWeight={700}
            >
              {keyword.newsCount > 99 ? "99+" : keyword.newsCount}
            </text>
          </g>
        )}
      </g>

      <g>
        <rect
          x={tagX}
          y={tagY}
          width={tagWidth}
          height={tagHeight}
          rx={tagHeight / 2}
          fill={active ? "rgba(8, 12, 20, 0.84)" : "rgba(8, 12, 20, 0.7)"}
          stroke={`rgba(${color.rgb},${active ? 0.34 : dimmed ? 0.12 : 0.22})`}
          strokeWidth={0.9}
        />
        <line
          x1={tagX + 10}
          y1={tagY + 2}
          x2={tagX + tagWidth - 10}
          y2={tagY + 2}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={0.8}
          strokeLinecap="round"
        />
        <motion.text
          x={tagX + tagPaddingX}
          y={tagCenterY + 0.5}
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

        {showCount && (
          <g>
            <rect
              x={tagX + tagWidth - tagPaddingX - badgeWidth}
              y={tagY + (tagHeight - 14) / 2}
              width={badgeWidth}
              height={14}
              rx={7}
              fill={`rgba(${color.rgb},${active ? 0.18 : dimmed ? 0.05 : 0.11})`}
              stroke={`rgba(${color.rgb},${active ? 0.34 : dimmed ? 0.1 : 0.2})`}
              strokeWidth={0.7}
            />
            <text
              x={tagX + tagWidth - tagPaddingX - badgeWidth / 2}
              y={tagCenterY + 0.5}
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
      </g>
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

  // SVG layout
  const viewSize = 360;
  const viewW = viewSize;
  const viewH = viewSize;
  const cx = viewSize / 2;
  const cy = viewSize / 2;
  const ringRadii = {
    inner: 104,
    middle: 124,
    outer: 136,
  };
  const sweepRadius = 156;

  const positions = useMemo(() => {
    if (keywords.length <= 3) {
      return computeOrbitPositions(
        keywords.length,
        cx,
        cy,
        ringRadii.middle,
        ringRadii.middle,
      );
    }

    const sortedByWeight = keywords
      .map((keyword, idx) => ({ idx, newsCount: keyword.newsCount }))
      .sort((a, b) => b.newsCount - a.newsCount || a.idx - b.idx);

    const innerCount = Math.max(1, Math.ceil(keywords.length * 0.25));
    const outerCount = Math.max(1, Math.floor(keywords.length * 0.25));
    const innerSet = new Set(sortedByWeight.slice(0, innerCount).map((item) => item.idx));
    const outerSet = new Set(
      sortedByWeight
        .slice(Math.max(innerCount, sortedByWeight.length - outerCount))
        .map((item) => item.idx)
        .filter((idx) => !innerSet.has(idx)),
    );

    const innerIndices: number[] = [];
    const middleIndices: number[] = [];
    const outerIndices: number[] = [];

    keywords.forEach((_, idx) => {
      if (innerSet.has(idx)) {
        innerIndices.push(idx);
      } else if (outerSet.has(idx)) {
        outerIndices.push(idx);
      } else {
        middleIndices.push(idx);
      }
    });

    const resolved = Array.from({ length: keywords.length }, () => ({ x: cx, y: cy }));
    const rings = [
      {
        indices: innerIndices,
        radius: ringRadii.inner,
        angle: -Math.PI / 2 - Math.PI / 10,
      },
      {
        indices: middleIndices,
        radius: ringRadii.middle,
        angle: -Math.PI / 2 + Math.PI / 12,
      },
      {
        indices: outerIndices,
        radius: ringRadii.outer,
        angle: -Math.PI / 2 + Math.PI / 5,
      },
    ];

    rings.forEach((ring) => {
      const ringPositions = computeOrbitPositions(
        ring.indices.length,
        cx,
        cy,
        ring.radius,
        ring.radius,
        ring.angle,
      );

      ring.indices.forEach((keywordIndex, positionIndex) => {
        resolved[keywordIndex] = ringPositions[positionIndex] ?? { x: cx, y: cy };
      });
    });

    return resolved;
  }, [keywords, cx, cy, ringRadii.inner, ringRadii.middle, ringRadii.outer]);

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
            {/* Concentric circles — centered on cx,cy (core node) */}
            {[42, 80, 118, 156].map((r) => (
              <circle
                key={r}
                cx={cx} cy={cy} r={r}
                fill="none"
                stroke={r <= 80 ? "rgba(0,212,255,0.14)" : "rgba(0,212,255,0.10)"}
                strokeWidth={r <= 42 ? 1 : r <= 80 ? 0.8 : 0.6}
                strokeDasharray={r > 118 ? "5 7" : r > 80 ? "3 5" : "none"}
              />
            ))}
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

          {/* Weighted orbit rings */}
          {[
            {
              radius: ringRadii.inner,
              stroke: "rgba(0,212,255,0.11)",
              strokeWidth: 0.8,
              strokeDasharray: "3 5",
            },
            {
              radius: ringRadii.middle,
              stroke: "rgba(0,212,255,0.08)",
              strokeWidth: 0.8,
              strokeDasharray: "4 6",
            },
            {
              radius: ringRadii.outer,
              stroke: "rgba(168,85,247,0.06)",
              strokeWidth: 0.6,
              strokeDasharray: "2 7",
            },
          ].map((ring) => (
            <ellipse
              key={ring.radius}
              cx={cx}
              cy={cy}
              rx={ring.radius}
              ry={ring.radius}
              fill="none"
              stroke={ring.stroke}
              strokeWidth={ring.strokeWidth}
              strokeDasharray={ring.strokeDasharray}
              style={{
                opacity: activeIds ? 0.26 : 1,
                transition: "opacity 0.5s ease",
              }}
            />
          ))}

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
                  cx={cx}
                  cy={cy}
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
