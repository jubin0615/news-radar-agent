/**
 * AgUiWrapper — AI Chat Interface powered by AG-UI Protocol
 *
 * Renders a full chat interface with:
 *  • User / Assistant text messages
 *  • Generative UI for tool-call results (NewsCarousel, ReportViewer)
 *  • Slide-up & fade-in animations via Framer Motion
 *  • Streaming text indicator
 */

"use client";

import { useState, useRef, useEffect, type KeyboardEvent, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Loader2,
  Bot,
  User,
  Sparkles,
  Newspaper,
  FileText,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useAgent, type ChatItem, type ToolCallChatItem } from "@/hooks/useAgent";
import NewsCarousel from "./NewsCarousel";
import ReportViewer from "./ReportViewer";
import type { NewsItem, AgentReport } from "@/types";

/* ───────────────────── Prompt suggestions ───────────────────── */

const SUGGESTIONS = [
  { icon: Newspaper, text: "AI 관련 뉴스 알려줘", color: "var(--neon-blue)" },
  { icon: Newspaper, text: "반도체 관련 뉴스 검색", color: "var(--neon-blue)" },
  { icon: FileText, text: "오늘 리포트 만들어줘", color: "var(--neon-purple)" },
  { icon: Sparkles, text: "최신 뉴스 수집해줘", color: "var(--neon-blue)" },
];

/* ───────────────────── Chat item animations ───────────────────── */

const itemVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 260, damping: 24 },
  },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

/* ═══════════════════════════ Component ═══════════════════════════ */

export default function AgUiWrapper({ className }: { className?: string }) {
  const { chatItems, isRunning, sendMessage, clearChat } = useAgent();

  const [input, setInput] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [activeReport, setActiveReport] = useState<AgentReport | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new items arrive
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [chatItems]);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isRunning) return;
    setInput("");
    sendMessage(trimmed);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  const openReport = (report: AgentReport) => {
    setActiveReport(report);
    setReportOpen(true);
  };

  /* ── Empty state ── */
  const isEmpty = chatItems.length === 0;

  return (
    <div className={cn("flex h-full flex-col overflow-hidden", className)}>
      {/* Message area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 scrollbar-hidden"
      >
        {isEmpty ? (
          <EmptyState onSuggestion={(text) => { setInput(""); sendMessage(text); }} />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-3">
            <AnimatePresence initial={false}>
              {chatItems.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <ChatBubble
                    item={item}
                    onOpenReport={openReport}
                  />
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing indicator when waiting for first response */}
            {isRunning && !chatItems.some((i) => i.type === "assistant" && i.isStreaming) && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 px-4 py-2"
              >
                <Loader2
                  size={14}
                  className="animate-spin"
                  style={{ color: "var(--neon-blue)" }}
                />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  에이전트가 응답을 준비 중입니다…
                </span>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Input bar */}
      <div
        className="shrink-0 border-t px-4 py-3"
        style={{ borderColor: "var(--glass-border)", background: "rgba(3, 7, 18, 0.5)", backdropFilter: "blur(16px)" }}
      >
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-3xl items-end gap-2"
        >
          {chatItems.length > 0 && (
            <button
              type="button"
              onClick={clearChat}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-200 hover:bg-[rgba(239,68,68,0.10)]"
              style={{ color: "var(--text-muted)", border: "1px solid var(--glass-border)" }}
              title="대화 초기화"
            >
              <Trash2 size={15} strokeWidth={1.8} />
            </button>
          )}

          <div
            className="relative flex flex-1 items-end rounded-xl transition-all duration-200"
            style={{
              background: "var(--glass-bg-light)",
              border: "1px solid var(--glass-border-light)",
            }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="메시지를 입력하세요… (Shift+Enter 줄바꿈)"
              disabled={isRunning}
              className="flex-1 resize-none bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-[var(--text-muted)] disabled:opacity-50"
              style={{ color: "var(--text-primary)", maxHeight: 120 }}
            />
          </div>

          <button
            type="submit"
            disabled={!input.trim() || isRunning}
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-200",
              input.trim() && !isRunning
                ? "hover:scale-105"
                : "pointer-events-none opacity-40",
            )}
            style={{
              background:
                input.trim() && !isRunning
                  ? "linear-gradient(135deg, rgba(0,212,255,0.20), rgba(168,85,247,0.20))"
                  : "var(--glass-bg)",
              border: "1px solid var(--glass-border-light)",
              color:
                input.trim() && !isRunning
                  ? "var(--neon-blue)"
                  : "var(--text-muted)",
            }}
          >
            {isRunning ? (
              <Loader2 size={16} className="animate-spin" strokeWidth={2} />
            ) : (
              <Send size={16} strokeWidth={2} />
            )}
          </button>
        </form>
      </div>

      {/* Report slide-over panel (global) */}
      <ReportViewer
        report={activeReport}
        open={reportOpen}
        onClose={() => setReportOpen(false)}
      />
    </div>
  );
}

/* ═══════════════════════════ Sub-components ═══════════════════════════ */

/** Empty-state with prompt suggestions */
function EmptyState({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-3 text-center"
      >
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(0,212,255,0.12), rgba(168,85,247,0.12))",
            border: "1px solid rgba(0,212,255,0.15)",
            boxShadow: "0 0 32px rgba(0,212,255,0.08)",
          }}
        >
          <Bot size={26} style={{ color: "var(--neon-blue)" }} strokeWidth={1.5} />
        </div>
        <h2
          className="text-lg font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          News Radar Agent
        </h2>
        <p className="max-w-sm text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          뉴스 검색, 수집, 리포트 생성을 도와드립니다.
          <br />
          아래 버튼을 클릭하거나 직접 메시지를 입력해 보세요.
        </p>
      </motion.div>

      <div className="grid grid-cols-2 gap-3">
        {SUGGESTIONS.map((s, i) => (
          <motion.button
            key={s.text}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.07, duration: 0.4 }}
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onSuggestion(s.text)}
            className="glass flex items-center gap-2.5 px-4 py-3 text-left transition-colors duration-200"
          >
            <s.icon size={14} style={{ color: s.color }} strokeWidth={2} />
            <span
              className="text-xs font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              {s.text}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

/** Single chat bubble — dispatches to the right render by type */
function ChatBubble({
  item,
  onOpenReport,
}: {
  item: ChatItem;
  onOpenReport: (report: AgentReport) => void;
}) {
  switch (item.type) {
    case "user":
      return <UserBubble content={item.content} />;
    case "assistant":
      return (
        <AssistantBubble
          content={item.content}
          isStreaming={item.isStreaming}
        />
      );
    case "tool-call":
      return (
        <ToolCallBubble item={item} onOpenReport={onOpenReport} />
      );
  }
}

/* ── User bubble ── */
function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="flex max-w-[80%] items-start gap-2">
        <div
          className="rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed"
          style={{
            background:
              "linear-gradient(135deg, rgba(0,212,255,0.12), rgba(168,85,247,0.12))",
            border: "1px solid rgba(0,212,255,0.15)",
            color: "var(--text-primary)",
          }}
        >
          {content}
        </div>
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
          style={{
            background: "rgba(0,212,255,0.10)",
            border: "1px solid rgba(0,212,255,0.20)",
          }}
        >
          <User size={13} style={{ color: "var(--neon-blue)" }} strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

/* ── Assistant bubble ── */
function AssistantBubble({
  content,
  isStreaming,
}: {
  content: string;
  isStreaming: boolean;
}) {
  return (
    <div className="flex justify-start">
      <div className="flex max-w-[85%] items-start gap-2">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
          style={{
            background: "rgba(168,85,247,0.10)",
            border: "1px solid rgba(168,85,247,0.20)",
          }}
        >
          <Bot size={13} style={{ color: "var(--neon-purple)" }} strokeWidth={2} />
        </div>
        <div
          className="rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
          style={{
            background: "var(--glass-bg-light)",
            border: "1px solid var(--glass-border)",
            color: "var(--text-primary)",
          }}
        >
          {content || "\u00A0"}
          {isStreaming && (
            <span
              className="ml-0.5 inline-block h-4 w-[2px] animate-pulse rounded-full align-middle"
              style={{ background: "var(--neon-blue)" }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Tool-call bubble (Generative UI) ── */
function ToolCallBubble({
  item,
  onOpenReport,
}: {
  item: ToolCallChatItem;
  onOpenReport: (report: AgentReport) => void;
}) {
  if (item.status === "loading") {
    return (
      <div className="flex items-center gap-2 px-4 py-3">
        <Loader2
          size={14}
          className="animate-spin"
          style={{ color: "var(--neon-purple)" }}
        />
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {item.toolName === "generate_report"
            ? "리포트를 생성하고 있습니다…"
            : "뉴스를 검색하고 있습니다…"}
        </span>
      </div>
    );
  }

  if (item.status === "error") {
    return (
      <div className="flex items-center gap-2 px-4 py-3">
        <AlertCircle size={14} style={{ color: "#ef4444" }} />
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          도구 실행 중 오류가 발생했습니다.
        </span>
      </div>
    );
  }

  // ── Generative UI rendering ──
  switch (item.toolName) {
    case "search_news": {
      const news = (item.data ?? []) as NewsItem[];
      return news.length > 0 ? (
        <div className="py-2">
          <NewsCarousel items={news} title="검색 결과" />
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-3">
          <Newspaper size={14} style={{ color: "var(--text-muted)" }} />
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            검색 결과가 없습니다.
          </span>
        </div>
      );
    }

    case "generate_report": {
      const report = item.data as AgentReport | undefined;
      if (!report) return null;
      return (
        <motion.button
          whileHover={{ scale: 1.01, y: -2 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => onOpenReport(report)}
          className="glass group flex w-full items-center gap-3 px-5 py-3 text-left transition-all duration-200"
        >
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300"
            style={{
              background:
                "linear-gradient(135deg, rgba(0,212,255,0.12), rgba(168,85,247,0.12))",
              border: "1px solid rgba(168, 85, 247, 0.18)",
            }}
          >
            <FileText
              size={16}
              style={{ color: "var(--neon-purple)" }}
              strokeWidth={1.8}
            />
          </div>
          <div className="flex flex-col">
            <span
              className="text-xs font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {report.title}
            </span>
            <span
              className="text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              {report.newsCount != null
                ? `${report.newsCount}건 분석 완료`
                : "리포트 생성 완료"}{" "}
              — 클릭하여 열기 →
            </span>
          </div>
        </motion.button>
      );
    }

    default:
      return null;
  }
}
