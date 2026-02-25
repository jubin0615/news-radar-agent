"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ────────────────────────────────────────────────────── //
interface Keyword {
  id: number;
  name: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  createdAt: string | null;
}

// ── Font helpers ─────────────────────────────────────────────── //
const isKorean = (text: string) => /[가-힣]/.test(text);
const FONT_MONO = "var(--font-geist-mono), monospace";
const FONT_SANS = "var(--font-geist-sans), 'Pretendard Variable', -apple-system, system-ui, sans-serif";

// ── Geometry helpers ─────────────────────────────────────────── //
function computeOrbitPositions(
  count: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
  });
}

// ── Core Node ────────────────────────────────────────────────── //
function CoreNode({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      {/* Outer pulse ring */}
      <circle cx={cx} cy={cy} r={38} fill="none">
        <animate
          attributeName="r"
          values="36;42;36"
          dur="3s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="stroke-opacity"
          values="0.15;0.35;0.15"
          dur="3s"
          repeatCount="indefinite"
        />
        <set attributeName="stroke" to="rgba(0,212,255,0.3)" />
        <set attributeName="stroke-width" to="1" />
      </circle>

      {/* Gradient fill */}
      <defs>
        <radialGradient id="coreGrad" cx="40%" cy="40%">
          <stop offset="0%" stopColor="rgba(0,212,255,0.25)" />
          <stop offset="100%" stopColor="rgba(168,85,247,0.08)" />
        </radialGradient>
        <filter id="coreGlow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle
        cx={cx}
        cy={cy}
        r={34}
        fill="url(#coreGrad)"
        stroke="rgba(0,212,255,0.45)"
        strokeWidth={1.5}
        filter="url(#coreGlow)"
      />

      {/* Inner bright dot */}
      <circle cx={cx} cy={cy} r={6} fill="rgba(0,212,255,0.9)">
        <animate
          attributeName="r"
          values="5;7;5"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>

      {/* Label removed */}
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
}: {
  keyword: Keyword;
  x: number;
  y: number;
  cx: number;
  cy: number;
  index: number;
}) {
  const [hovered, setHovered] = useState(false);
  const isEven = index % 2 === 0;
  const nodeColor = isEven ? "0,212,255" : "168,85,247";

  return (
    <motion.g
      layout
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 25,
        delay: index * 0.08,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: "pointer" }}
    >
      {/* Connection line */}
      <motion.line
        x1={cx}
        y1={cy}
        x2={x}
        y2={y}
        stroke={`rgba(${nodeColor},${hovered ? 0.85 : 0.45})`}
        strokeWidth={hovered ? 2 : 1.2}
        strokeDasharray={hovered ? "none" : "5 5"}
        transition={{ duration: 0.25 }}
      />

      {/* Orbit dot glow */}
      {hovered && (
        <motion.circle
          cx={x}
          cy={y}
          r={18}
          fill={`rgba(${nodeColor},0.06)`}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.2 }}
        />
      )}

      {/* Orbit dot */}
      <motion.circle
        cx={x}
        cy={y}
        r={hovered ? 7 : 5}
        fill={`rgba(${nodeColor},${hovered ? 0.9 : 0.5})`}
        stroke={`rgba(${nodeColor},${hovered ? 0.8 : 0.3})`}
        strokeWidth={1}
        transition={{ duration: 0.2 }}
        filter={hovered ? "url(#coreGlow)" : "none"}
      />

      {/* Label */}
      <motion.text
        x={x}
        y={y - 16}
        textAnchor="middle"
        fill={`rgba(${nodeColor},${hovered ? 1 : 0.65})`}
        fontSize={isKorean(keyword.name) ? (hovered ? 15 : 14) : (hovered ? 14 : 13)}
        fontFamily={isKorean(keyword.name) ? FONT_SANS : FONT_MONO}
        fontWeight={hovered ? 700 : 600}
        letterSpacing={isKorean(keyword.name) ? "0.02em" : "0.06em"}
        transition={{ duration: 0.2 }}
        style={{
          textTransform: isKorean(keyword.name) ? "none" as const : "uppercase" as const,
          textShadow: hovered
            ? `0 0 8px rgba(${nodeColor},0.6), 0 0 20px rgba(${nodeColor},0.3)`
            : "none",
        }}
      >
        {keyword.name}
      </motion.text>
    </motion.g>
  );
}

// ── Main Component ───────────────────────────────────────────── //
export default function CyberneticNodeMap({
  className,
}: {
  className?: string;
}) {
  const [keywords, setKeywords] = useState<Keyword[]>([]);

  // Polling: 10초마다 키워드 목록 갱신
  useEffect(() => {
    const fetchKeywords = async () => {
      try {
        const res = await fetch("/api/keywords");
        if (res.ok) {
          const data: Keyword[] = await res.json();
          setKeywords(data.filter((k) => k.status === "ACTIVE"));
        }
      } catch {
        /* ignore */
      }
    };

    fetchKeywords();
    const interval = setInterval(fetchKeywords, 10_000);
    return () => clearInterval(interval);
  }, []);

  // SVG 좌표 계산 — enlarged
  const viewW = 400;
  const viewH = 360;
  const cx = viewW / 2;
  const cy = viewH / 2 - 8;

  const positions = useMemo(
    () => computeOrbitPositions(keywords.length, cx, cy, 140, 120),
    [keywords.length, cx, cy],
  );

  return (
    <motion.div
      className={className}
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
    >
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
      </div>

      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        className="w-full h-auto"
        style={{ maxHeight: "360px" }}
      >
        {/* Background grid lines (subtle) */}
        <line
          x1={cx}
          y1={0}
          x2={cx}
          y2={viewH}
          stroke="rgba(255,255,255,0.03)"
          strokeWidth={0.5}
        />
        <line
          x1={0}
          y1={cy}
          x2={viewW}
          y2={cy}
          stroke="rgba(255,255,255,0.03)"
          strokeWidth={0.5}
        />

        {/* Orbit track ellipse */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={140}
          ry={120}
          fill="none"
          stroke="rgba(0,212,255,0.06)"
          strokeWidth={0.8}
          strokeDasharray="4 6"
        />

        {/* Core */}
        <CoreNode cx={cx} cy={cy} />

        {/* Satellite keywords */}
        <AnimatePresence>
          {keywords.map((kw, i) => (
            <SatelliteNode
              key={kw.id}
              keyword={kw}
              x={positions[i]?.x ?? cx}
              y={positions[i]?.y ?? cy}
              cx={cx}
              cy={cy}
              index={i}
            />
          ))}
        </AnimatePresence>

        {/* Empty state */}
        {keywords.length === 0 && (
          <text
            x={cx}
            y={cy + 70}
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
    </motion.div>
  );
}
