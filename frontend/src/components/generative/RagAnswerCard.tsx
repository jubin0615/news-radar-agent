"use client";

import { motion } from "framer-motion";
import { ExternalLink, Brain, Sparkles, Tag } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { NewsGrade } from "@/types";

/* ── Types ──────────────────────────────────────────────────────── */

export interface RagSourceItem {
  id: number;
  title: string;
  url: string;
  keyword: string;
  summary: string | null;
  importanceScore: number | null;
  grade: NewsGrade | "N/A";
  category: string | null;
  score: number | null; // 코사인 유사도 0.0 ~ 1.0
}

export interface RagAnswerData {
  answer: string;
  sources: RagSourceItem[];
}

/* ── Grade colour map ────────────────────────────────────────────── */

const gradeColour: Record<string, string> = {
  CRITICAL: "#f87171",
  HIGH: "#fbbf24",
  MEDIUM: "var(--neon-blue)",
  LOW: "var(--text-muted)",
  "N/A": "var(--text-muted)",
};

/* ═══ Component ══════════════════════════════════════════════════ */

export default function RagAnswerCard({ data }: { data: RagAnswerData }) {
  const { answer, sources } = data;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="flex flex-col gap-3"
    >
      {/* ── 생성된 답변 패널 ── */}
      <div
        className="glass rounded-xl p-4"
        style={{
          border: "1px solid rgba(168, 85, 247, 0.25)",
          background: "rgba(168, 85, 247, 0.05)",
        }}
      >
        {/* 헤더 */}
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={13} style={{ color: "var(--neon-purple)" }} />
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--neon-purple)" }}
          >
            AI 분석 답변
          </span>
        </div>

        {/* 마크다운 답변 */}
        <div
          className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed"
          style={{ color: "var(--text-primary)" }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--neon-blue)" }}
                >
                  {children}
                </a>
              ),
            }}
          >
            {answer}
          </ReactMarkdown>
        </div>
      </div>

      {/* ── 참고 기사 목록 ── */}
      {sources.length > 0 && (
        <div className="flex flex-col gap-2">
          {/* 섹션 레이블 */}
          <div className="flex items-center gap-1.5 px-1">
            <Brain size={12} style={{ color: "var(--text-muted)" }} />
            <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
              참고 기사 {sources.length}건
            </span>
          </div>

          {sources.map((src, idx) => (
            <motion.div
              key={src.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.07 }}
              className="glass flex items-start gap-3 rounded-lg p-3"
              style={{ border: "1px solid var(--glass-border)" }}
            >
              {/* 순서 번호 뱃지 */}
              <div
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold"
                style={{
                  background: "rgba(0, 212, 255, 0.10)",
                  color: "var(--neon-blue)",
                  border: "1px solid rgba(0, 212, 255, 0.20)",
                }}
              >
                {idx + 1}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {/* 제목 + 외부 링크 */}
                <div className="flex items-start justify-between gap-2">
                  <p
                    className="line-clamp-2 text-xs font-semibold leading-snug"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {src.title}
                  </p>
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink
                      size={12}
                      style={{ color: "var(--neon-blue)", marginTop: 2 }}
                    />
                  </a>
                </div>

                {/* 메타 행: 키워드 chip / 등급 / 유사도 */}
                <div className="flex flex-wrap items-center gap-2">
                  {src.keyword && (
                    <span
                      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
                      style={{
                        background: "rgba(0, 212, 255, 0.08)",
                        color: "var(--neon-blue)",
                        border: "1px solid rgba(0, 212, 255, 0.15)",
                      }}
                    >
                      <Tag size={8} />
                      {src.keyword}
                    </span>
                  )}

                  {src.importanceScore != null && (
                    <span
                      className="text-[10px] font-bold"
                      style={{ color: gradeColour[src.grade] ?? gradeColour["N/A"] }}
                    >
                      {src.grade} {src.importanceScore}점
                    </span>
                  )}

                  {src.score != null && (
                    <span
                      className="text-[10px] tabular-nums"
                      style={{ color: "var(--text-muted)" }}
                    >
                      유사도 {(src.score * 100).toFixed(0)}%
                    </span>
                  )}
                </div>

                {/* 한 줄 요약 */}
                {src.summary && (
                  <p
                    className="line-clamp-2 text-[11px] leading-relaxed"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {src.summary}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
