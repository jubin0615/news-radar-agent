"use client";

import { useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X, FileText, Calendar, Hash, Copy, Check, ExternalLink } from "lucide-react";
import { cn } from "@/lib/cn";
import type { AgentReport } from "@/types";
import { useState } from "react";

// ── Props ────────────────────────────────────────────────────── //
interface ReportViewerProps {
  report: AgentReport | null;
  open: boolean;
  onClose: () => void;
  className?: string;
}

// ── Slide-panel variants ─────────────────────────────────────── //
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

// ── Component ────────────────────────────────────────────────── //
export default function ReportViewer({ report, open, onClose, className }: ReportViewerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  /* ── ESC key close ── */
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

  /* ── Copy to clipboard ── */
  const copyContent = useCallback(async () => {
    if (!report) return;
    await navigator.clipboard.writeText(report.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [report]);

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
            style={{ background: "rgba(0, 0, 0, 0.55)", backdropFilter: "blur(4px)" }}
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
              boxShadow: "-16px 0 64px rgba(0, 0, 0, 0.4), 0 0 32px rgba(0, 212, 255, 0.04)",
            }}
          >
            {/* ── Header ─────────── */}
            <div
              className="flex shrink-0 items-center justify-between border-b px-6 py-4"
              style={{ borderColor: "var(--glass-border)" }}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: "linear-gradient(135deg, rgba(0,212,255,0.12), rgba(168,85,247,0.12))",
                    border: "1px solid rgba(0, 212, 255, 0.15)",
                  }}
                >
                  <FileText size={16} style={{ color: "var(--neon-blue)" }} strokeWidth={1.8} />
                </div>
                <div className="flex flex-col overflow-hidden">
                  <h2
                    className="truncate text-sm font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {report.title}
                  </h2>
                  <div className="flex items-center gap-3">
                    {report.keyword && (
                      <span
                        className="flex items-center gap-1 text-[10px] font-medium"
                        style={{ color: "var(--neon-blue)" }}
                      >
                        <Hash size={9} strokeWidth={2.5} />
                        {report.keyword}
                      </span>
                    )}
                    <span
                      className="flex items-center gap-1 text-[10px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <Calendar size={9} strokeWidth={2} />
                      {new Date(report.createdAt).toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                {/* Copy */}
                <button
                  onClick={copyContent}
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 hover:bg-[rgba(255,255,255,0.06)]"
                  style={{ color: copied ? "#10b981" : "var(--text-muted)" }}
                  title="Copy markdown"
                >
                  {copied ? <Check size={15} strokeWidth={2} /> : <Copy size={15} strokeWidth={1.8} />}
                </button>

                {/* Close */}
                <button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 hover:bg-[rgba(239,68,68,0.10)]"
                  style={{ color: "var(--text-muted)" }}
                >
                  <X size={16} strokeWidth={1.8} />
                </button>
              </div>
            </div>

            {/* ── Stat Pills (optional) ── */}
            {report.newsCount != null && (
              <div className="flex shrink-0 gap-3 border-b px-6 py-3" style={{ borderColor: "var(--glass-border)" }}>
                <span
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold"
                  style={{
                    background: "rgba(0, 212, 255, 0.08)",
                    border: "1px solid rgba(0, 212, 255, 0.15)",
                    color: "var(--neon-blue)",
                  }}
                >
                  <ExternalLink size={10} strokeWidth={2} />
                  {report.newsCount}건 분석
                </span>
              </div>
            )}

            {/* ── Markdown Body ───── */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <article className="report-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {report.content}
                </ReactMarkdown>
              </article>
            </div>

            {/* ── Bottom glow line ── */}
            <div className="neon-divider w-full shrink-0" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
