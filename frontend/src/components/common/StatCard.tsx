"use client";

import { motion } from "framer-motion";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

// ── Types ────────────────────────────────────────────────────── //
type GlowColor = "blue" | "purple" | "mixed";

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  glow?: GlowColor;
  trend?: { value: number; positive: boolean };
  delay?: number;
  className?: string;
}

// ── Glow Presets ─────────────────────────────────────────────── //
const glowMap: Record<GlowColor, { border: string; shadow: string; icon: string }> = {
  blue: {
    border: "rgba(0, 212, 255, 0.25)",
    shadow: "0 0 30px rgba(0, 212, 255, 0.18), 0 0 60px rgba(0, 212, 255, 0.06)",
    icon: "var(--neon-blue)",
  },
  purple: {
    border: "rgba(168, 85, 247, 0.25)",
    shadow: "0 0 30px rgba(168, 85, 247, 0.18), 0 0 60px rgba(168, 85, 247, 0.06)",
    icon: "var(--neon-purple)",
  },
  mixed: {
    border: "rgba(0, 212, 255, 0.20)",
    shadow:
      "0 0 24px rgba(0, 212, 255, 0.12), 0 0 24px rgba(168, 85, 247, 0.12)",
    icon: "var(--neon-blue)",
  },
};

// ── Component ────────────────────────────────────────────────── //
export default function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  glow = "blue",
  trend,
  delay = 0,
  className,
}: StatCardProps) {
  const preset = glowMap[glow];

  return (
    <motion.div
      /* ── entrance animation ── */
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      /* ── hover glow ── */
      whileHover={{
        scale: 1.03,
        borderColor: preset.border,
        boxShadow: `${preset.shadow}, 0 12px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)`,
      }}
      className={cn(
        // base glass
        "glass group relative cursor-default overflow-hidden p-5",
        "transition-all duration-300 ease-out",
        className,
      )}
    >
      {/* ── Ambient glow orb ── */}
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: preset.icon }}
      />

      <div className="relative flex items-start justify-between gap-3">
        {/* Left: content */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
            {label}
          </span>

          <span className="text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            {value}
          </span>

          {subtitle && (
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {subtitle}
            </span>
          )}

          {trend && (
            <span
              className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium"
              style={{ color: trend.positive ? "#10b981" : "#ef4444" }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                className={cn(!trend.positive && "rotate-180")}
              >
                <path
                  d="M6 2L10 7H2L6 2Z"
                  fill="currentColor"
                />
              </svg>
              {trend.positive ? "+" : ""}
              {trend.value}%
            </span>
          )}
        </div>

        {/* Right: icon */}
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: `${preset.icon}12`,
            border: `1px solid ${preset.icon}20`,
          }}
        >
          <Icon size={20} style={{ color: preset.icon }} strokeWidth={1.8} />
        </div>
      </div>
    </motion.div>
  );
}
