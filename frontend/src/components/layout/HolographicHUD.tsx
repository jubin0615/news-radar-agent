"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

interface HUDStats {
  collecting: boolean;
  todayNewsCount: number;
  totalNewsCount: number;
  activeKeywordCount: number;
  lastCollectedAt: string | null;
}

interface HolographicHUDProps {
  stats: HUDStats | null;
  onTodayClick?: () => void;
}

// ── Bracket Cell ─────────────────────────────────────────────── //
function BracketCell({
  children,
  delay = 0,
  onClick,
  clickable = false,
}: {
  children: React.ReactNode;
  delay?: number;
  onClick?: () => void;
  clickable?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        "hud-bracket relative flex items-center gap-2.5 px-3.5 py-2",
        "font-mono text-sm tracking-wider",
        clickable && "cursor-pointer",
      )}
      style={{ color: "var(--neon-blue)" }}
    >
      {children}
    </motion.div>
  );
}

// ── Pulse Dot ────────────────────────────────────────────────── //
function PulseDot({ active }: { active: boolean }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {active && (
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
          style={{ background: "var(--neon-blue)" }}
        />
      )}
      <span
        className="relative inline-flex h-2 w-2 rounded-full"
        style={{
          background: active ? "var(--neon-blue)" : "var(--text-muted)",
        }}
      />
    </span>
  );
}

// ── Time Formatting ──────────────────────────────────────────── //
function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

// ── Main Component ───────────────────────────────────────────── //
export default function HolographicHUD({
  stats,
  onTodayClick,
}: HolographicHUDProps) {
  const isCollecting = stats?.collecting ?? false;

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
      {/* 수집 상태 */}
      <BracketCell delay={0.05}>
        <PulseDot active={isCollecting} />
        <span
          className={cn("uppercase font-semibold", isCollecting && "hud-glow-text")}
          style={{
            color: isCollecting ? "var(--neon-blue)" : "var(--text-secondary)",
          }}
        >
          {isCollecting
            ? "COLLECTING"
            : stats?.lastCollectedAt
              ? formatRelativeTime(stats.lastCollectedAt)
              : "STANDBY"}
        </span>
      </BracketCell>

      {/* 오늘 수집 */}
      <BracketCell delay={0.12} onClick={onTodayClick} clickable>
        <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>TODAY</span>
        <span className="font-bold tabular-nums">
          {stats?.todayNewsCount?.toLocaleString() ?? "0"}
        </span>
      </BracketCell>

      {/* 누적 */}
      <BracketCell delay={0.19}>
        <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>TOTAL</span>
        <span className="font-bold tabular-nums">
          {stats?.totalNewsCount?.toLocaleString() ?? "0"}
        </span>
      </BracketCell>

      {/* 활성 키워드 */}
      <BracketCell delay={0.26}>
        <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>KEYWORDS</span>
        <span className="font-bold tabular-nums">
          {stats?.activeKeywordCount ?? 0}
        </span>
      </BracketCell>
    </div>
  );
}
