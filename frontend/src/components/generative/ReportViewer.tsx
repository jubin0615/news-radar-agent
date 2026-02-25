"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  X,
  FileText,
  ExternalLink,
  Sparkles,
  Trophy,
  Radar,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { AgentReport, DailyReport, ReportNewsItem } from "@/types";

// ── Props ────────────────────────────────────────────────────── //
interface ReportViewerProps {
  report: AgentReport | null;
  open: boolean;
  onClose: () => void;
  className?: string;
}

// ── Animation variants ───────────────────────────────────────── //
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const panelVariants = {
  hidden: { x: "100%", opacity: 0.5 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 32 },
  },
  exit: {
    x: "100%",
    opacity: 0,
    transition: { duration: 0.25, ease: [0.4, 0, 1, 1] as const },
  },
};

// ═══════════════════════════ Sub-components ═══════════════════════════ //

/** Hero box — AI Connecting the Dots 트렌드 인사이트 */
function TrendSection({ insight }: { insight: string }) {
  if (!insight) return null;
  return (
    <section className="mx-1 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} style={{ color: "var(--neon-blue)" }} />
        <h3
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: "var(--neon-blue)" }}
        >
          Today's Briefing
        </h3>
      </div>
      <div
        className="rounded-xl p-5 text-[13px] leading-relaxed whitespace-pre-line"
        style={{
          color: "var(--text-secondary)",
          background:
            "linear-gradient(135deg, rgba(0,212,255,0.06) 0%, rgba(168,85,247,0.06) 100%)",
          border: "1px solid rgba(0,212,255,0.12)",
        }}
      >
        {insight}
      </div>
    </section>
  );
}

/** 큰 카드 — Headlines Top 3 */
function HeadlineCard({ item, rank }: { item: ReportNewsItem; rank: number }) {
  return (
    <div
      className="rounded-xl p-4 transition-colors duration-200"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Top row: rank + score + category */}
      <div className="flex items-center gap-2 mb-2.5">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold"
          style={{
            background:
              "linear-gradient(135deg, rgba(0,212,255,0.15), rgba(168,85,247,0.15))",
            color: "var(--neon-blue)",
          }}
        >
          {rank}
        </span>
        {item.importanceScore != null && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{
              background: getScoreBg(item.importanceScore),
              color: getScoreColor(item.importanceScore),
            }}
          >
            {item.importanceScore}점
          </span>
        )}
        {item.category && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              background: "rgba(255,255,255,0.05)",
              color: "var(--text-muted)",
            }}
          >
            {item.category}
          </span>
        )}
      </div>

      {/* Title */}
      <h4
        className="text-sm font-semibold leading-snug mb-2"
        style={{ color: "var(--text-primary)" }}
      >
        {item.title}
      </h4>

      {/* AI Reason (강조 박스) */}
      {item.aiReason && (
        <div
          className="flex gap-2 rounded-lg p-2.5 mb-2 text-[12px] leading-relaxed"
          style={{
            background: "rgba(0,212,255,0.04)",
            border: "1px solid rgba(0,212,255,0.08)",
            color: "var(--text-secondary)",
          }}
        >
          <Lightbulb
            size={13}
            className="shrink-0 mt-0.5"
            style={{ color: "var(--neon-blue)", opacity: 0.7 }}
          />
          <span>{item.aiReason}</span>
        </div>
      )}

      {/* Summary */}
      {item.summary && (
        <p
          className="text-[12px] leading-relaxed mb-2"
          style={{ color: "var(--text-secondary)" }}
        >
          {item.summary}
        </p>
      )}

      {/* Link */}
      {item.url && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-medium transition-opacity hover:opacity-80"
          style={{ color: "var(--neon-blue)", opacity: 0.7 }}
        >
          <ExternalLink size={10} strokeWidth={2} />
          원문 보기
        </a>
      )}
    </div>
  );
}

/** 작은 카드 — Radar Board 잠재 트렌드 */
function RadarCard({ item }: { item: ReportNewsItem }) {
  return (
    <div
      className="rounded-lg p-3 transition-colors duration-200"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {/* Badges */}
      <div className="flex items-center gap-1.5 mb-2">
        {item.innovationScore != null && (
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
            style={{
              background: "rgba(168,85,247,0.12)",
              color: "rgb(192,132,252)",
            }}
          >
            혁신 {item.innovationScore}/50
          </span>
        )}
        {item.category && (
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-medium"
            style={{
              background: "rgba(255,255,255,0.04)",
              color: "var(--text-muted)",
            }}
          >
            {item.category}
          </span>
        )}
      </div>

      {/* Title */}
      <h5
        className="text-[12px] font-semibold leading-snug mb-1.5"
        style={{ color: "var(--text-primary)" }}
      >
        {item.title}
      </h5>

      {/* Summary */}
      {item.summary && (
        <p
          className="text-[11px] leading-relaxed mb-2 line-clamp-3"
          style={{ color: "var(--text-secondary)" }}
        >
          {item.summary}
        </p>
      )}

      {/* Link */}
      {item.url && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] font-medium transition-opacity hover:opacity-80"
          style={{ color: "var(--neon-blue)", opacity: 0.6 }}
        >
          <ExternalLink size={9} strokeWidth={2} />
          원문
        </a>
      )}
    </div>
  );
}

/** 하단 통계 한 줄 요약 */
function BottomStats({ data }: { data: DailyReport }) {
  return (
    <p
      className="text-center text-sm py-5 px-4"
      style={{ color: "var(--text-muted)", opacity: 0.6 }}
    >
      오늘 에이전트가 총{" "}
      <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>
        {data.totalNewsCount}건
      </span>
      의 뉴스를 수집 및 검토하여, 가장 핵심적인{" "}
      <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>
        {data.displayedNewsCount}건
      </span>
      을 브리핑했습니다.
    </p>
  );
}

// ── Score color helpers ──────────────────────────────────────── //
function getScoreBg(score: number): string {
  if (score >= 80) return "rgba(239,68,68,0.12)";
  if (score >= 60) return "rgba(245,158,11,0.12)";
  return "rgba(59,130,246,0.12)";
}

function getScoreColor(score: number): string {
  if (score >= 80) return "rgb(252,129,129)";
  if (score >= 60) return "rgb(252,191,73)";
  return "rgb(147,197,253)";
}

// ═══════════════════════════ Main Component ═══════════════════════════ //

export default function ReportViewer({
  report,
  open,
  onClose,
  className,
}: ReportViewerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  /* ESC key close */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.addEventListener("keydown", handler);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const data = report?.reportData;

  return (
    <AnimatePresence>
      {open && report && (
        <>
          {/* ── Backdrop ── */}
          <motion.div
            key="report-overlay"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={onClose}
            className="fixed inset-0 z-50"
            style={{
              background: "rgba(0, 0, 0, 0.55)",
              backdropFilter: "blur(4px)",
            }}
          />

          {/* ── Slide Panel ── */}
          <motion.div
            key="report-panel"
            ref={panelRef}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              "fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-2xl flex-col overflow-hidden",
              className,
            )}
            style={{
              background: "rgba(3, 7, 18, 0.92)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              borderLeft: "1px solid var(--glass-border)",
              boxShadow:
                "-16px 0 64px rgba(0, 0, 0, 0.4), 0 0 32px rgba(0, 212, 255, 0.04)",
            }}
          >
            {/* ── Header ── */}
            <div
              className="flex shrink-0 items-center justify-between border-b px-6 py-4"
              style={{ borderColor: "var(--glass-border)" }}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(0,212,255,0.12), rgba(168,85,247,0.12))",
                    border: "1px solid rgba(0, 212, 255, 0.15)",
                  }}
                >
                  <FileText
                    size={16}
                    style={{ color: "var(--neon-blue)" }}
                    strokeWidth={1.8}
                  />
                </div>
                <div className="flex flex-col overflow-hidden">
                  <h2
                    className="truncate text-sm font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {report.title}
                  </h2>
                  {data && (
                    <span
                      className="text-[10px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      수집 {data.totalNewsCount}건 → 브리핑{" "}
                      {data.displayedNewsCount}건
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 hover:bg-[rgba(239,68,68,0.10)]"
                style={{ color: "var(--text-muted)" }}
              >
                <X size={16} strokeWidth={1.8} />
              </button>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {data ? (
                <StructuredReport data={data} />
              ) : (
                /* Legacy fallback: markdown rendering */
                <article className="report-markdown">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {report.content}
                  </ReactMarkdown>
                </article>
              )}
            </div>

            {/* ── Bottom glow line ── */}
            <div className="neon-divider w-full shrink-0" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ═══════════════════════════ Structured Report ═══════════════════════════ //

/** 구조화된 리포트 렌더링 (reportData가 있을 때) */
function StructuredReport({ data }: { data: DailyReport }) {
  return (
    <>
      {/* ── Trend Insight ── */}
      <TrendSection insight={data.trendInsight} />

      {/* ── Headlines ── */}
      {data.headlines.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3 mx-1">
            <Trophy size={13} style={{ color: "rgb(250,204,21)" }} />
            <h3
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: "var(--text-secondary)" }}
            >
              헤드라인 TOP {data.headlines.length}
            </h3>
          </div>
          <div className="flex flex-col gap-3">
            {data.headlines.map((item, i) => (
              <HeadlineCard key={i} item={item} rank={i + 1} />
            ))}
          </div>
        </section>
      )}

      {/* ── Radar Board ── */}
      {data.radarBoard.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3 mx-1">
            <Radar size={13} style={{ color: "rgb(192,132,252)" }} />
            <h3
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: "var(--text-secondary)" }}
            >
              레이더 보드
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {data.radarBoard.map((item, i) => (
              <RadarCard key={i} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* ── Bottom Stats ── */}
      <BottomStats data={data} />
    </>
  );
}
