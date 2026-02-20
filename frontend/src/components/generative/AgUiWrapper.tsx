/**
 * AgUiWrapper — 커스텀 AI 채팅 인터페이스
 *
 * CopilotKit 내부 훅을 직접 사용해 완전 커스텀 UI 구현:
 *   • useCopilotChatInternal — 메시지 송수신 / 스트리밍 제어
 *   • useCopilotAction       — search_news / collect_news / generate_report 도구
 *   • useCopilotReadable     — 시스템 상태를 LLM에 전달
 *   • ReactMarkdown          — 어시스턴트 메시지 마크다운 렌더링
 *   • ReportViewer           — 리포트 슬라이드-오버 패널
 */

"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  useCopilotAction,
  useCopilotReadable,
  useCopilotContext,
  useCopilotChatInternal,
} from "@copilotkit/react-core";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  Square,
  Orbit,
  Radio,
  Search,
  FileBarChart,
  TrendingUp,
  Flame,
  Bot,
  User,
  Copy,
  Check,
  Brain,
} from "lucide-react";
import { cn } from "@/lib/cn";
import NewsCarousel from "./NewsCarousel";
import ReportViewer from "./ReportViewer";
import RagAnswerCard, { type RagAnswerData } from "./RagAnswerCard";
import type { NewsItem, AgentReport } from "@/types";

/* ─────────────────────────── Types ─────────────────────────── */

interface CollectionStatus {
  totalNewsCount: number;
  todayNewsCount: number;
  activeKeywordCount: number;
  collecting: boolean;
  activeKeywords?: string[];
}

interface BackendReport {
  stats?: {
    keyword?: string;
    date?: string;
    totalCount?: number;
    averageScore?: number;
    gradeDistribution?: Record<string, number>;
  };
  articles?: {
    title?: string;
    importanceScore?: number;
    grade?: string;
    category?: string;
    summary?: string;
    aiReason?: string;
  }[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  generativeUI?: () => React.ReactNode;
  generativeUIPosition?: "before" | "after";
  [key: string]: any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ─────────────────────────── System prompt ─────────────────────────── */

const SYSTEM_INSTRUCTIONS = `
너는 "뉴스 레이더"라는 IT 기술 뉴스 분석 서비스의 AI 에이전트야.
사용자와 자연스럽게 한국어로 대화하면서, 필요할 때 아래 도구를 사용해.

## 사용 가능한 도구
- search_news: DB에서 뉴스를 키워드로 검색 (keyword 파라미터 옵션)
- collect_news: 인터넷에서 최신 뉴스를 크롤링해 수집
- generate_report: 수집된 뉴스로 일일 브리핑 리포트 생성
- ask_about_news: 수집된 뉴스 내용을 기반으로 심층 질문에 RAG 방식으로 답변

## 도구 사용 기준
- "뉴스 알려줘", "~뉴스", "~소식", "~동향" → search_news
- "수집", "크롤링", "새 뉴스 가져와" → collect_news
- "리포트", "보고서", "브리핑", "요약 정리" → generate_report
- "왜", "어떻게", "분석해줘", "설명해줘", "~에 대해 자세히", "~의 의미는", "~영향은", "~전망은" → ask_about_news
- 일반 질문·잡담 → 도구 없이 자연스럽게 대화

## 주의사항
- 수집된 뉴스가 없을 때 검색 요청이 오면 먼저 collect_news를 제안해.
- 뉴스 내용에 대한 깊은 이해·분석이 필요한 질문은 ask_about_news를 사용해.
- 대화 맥락을 항상 반영해서 일관성 있게 답변해.
`.trim();

/* ─────────────────────────── Quick-action chips ─────────────────────────── */

const QUICK_ACTIONS = [
  { label: "최신 뉴스 검색", icon: Search, message: "최신 뉴스 알려줘" },
  { label: "오늘의 AI 트렌드", icon: TrendingUp, message: "오늘의 AI 트렌드는?" },
  { label: "핫 뉴스 TOP5", icon: Flame, message: "이번 주 핫 뉴스 TOP5 알려줘" },
  { label: "리포트 생성", icon: FileBarChart, message: "뉴스 리포트 만들어줘" },
];

/* ═══════════════════════════ Component ═══════════════════════════ */

export default function AgUiWrapper({ className }: { className?: string }) {
  /* ── State ── */
  const [reportOpen, setReportOpen] = useState(false);
  const [activeReport, setActiveReport] = useState<AgentReport | null>(null);
  const [systemContext, setSystemContext] = useState<CollectionStatus | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* ── CopilotKit internal chat hook ── */
  const {
    messages,
    sendMessage,
    stopGeneration,
    isLoading,
  } = useCopilotChatInternal() as {
    messages: ChatMessage[];
    sendMessage: (msg: { id: string; content: string; role: string }) => Promise<void>;
    stopGeneration: () => void;
    isLoading: boolean;
  };

  /* ── Auto-scroll to bottom ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  /* ── System status load ── */
  useEffect(() => {
    fetch("/api/news/collection-status")
      .then((r) => r.json())
      .then(setSystemContext)
      .catch(() => null);
  }, []);

  /* ── Set system instructions ── */
  const { setChatInstructions } = useCopilotContext();
  useEffect(() => {
    setChatInstructions(SYSTEM_INSTRUCTIONS);
  }, [setChatInstructions]);

  useCopilotReadable({
    description: "뉴스 레이더 현재 시스템 상태",
    value: systemContext
      ? {
          totalNews: systemContext.totalNewsCount,
          todayNews: systemContext.todayNewsCount,
          activeKeywords: systemContext.activeKeywordCount,
          collecting: systemContext.collecting,
          date: new Date().toLocaleDateString("ko-KR"),
        }
      : { message: "시스템 상태 로딩 중" },
  });

  /* ── Tool: search_news ── */
  useCopilotAction({
    name: "search_news",
    description: "DB에 수집된 뉴스를 키워드로 검색합니다. keyword 미입력 시 최신 뉴스를 반환합니다.",
    parameters: [
      {
        name: "keyword",
        type: "string",
        description: "검색할 키워드 (예: AI, 반도체). 생략 시 최신 전체 뉴스 반환.",
        required: false,
      },
    ],
    handler: async ({ keyword }: { keyword?: string }) => {
      const qs = keyword ? `?keyword=${encodeURIComponent(keyword)}` : "";
      const res = await fetch(`/api/news${qs}`);
      if (!res.ok) throw new Error(`뉴스 검색 실패 (${res.status})`);
      return (await res.json()) as NewsItem[];
    },
    render: ({ status, result }) => {
      if (status !== "complete") {
        return (
          <div className="nrc-tool-loading">
            <span className="nrc-spinner" />
            <span>뉴스를 검색하고 있습니다…</span>
          </div>
        );
      }
      const items = (result ?? []) as NewsItem[];
      if (items.length === 0) {
        return (
          <div className="nrc-tool-empty">
            <Search size={14} style={{ opacity: 0.5 }} />
            검색 결과가 없습니다. 뉴스를 먼저 수집해 보세요.
          </div>
        );
      }
      return <NewsCarousel items={items} title="검색 결과" />;
    },
  });

  /* ── Tool: collect_news ── */
  useCopilotAction({
    name: "collect_news",
    description: "인터넷에서 등록된 키워드로 최신 뉴스를 크롤링해 수집합니다.",
    parameters: [],
    handler: async () => {
      const res = await fetch("/api/news/collect", { method: "POST" });
      if (!res.ok) throw new Error(`수집 요청 실패 (${res.status})`);
      return await res.text();
    },
    render: ({ status }) => {
      if (status !== "complete") {
        return (
          <div className="nrc-tool-loading">
            <span className="nrc-spinner" />
            <span>뉴스를 수집하고 있습니다… (1~2분 소요)</span>
          </div>
        );
      }
      return (
        <div className="nrc-tool-success">
          <div className="nrc-tool-success-icon">✓</div>
          뉴스 수집이 시작되었습니다. 잠시 후 검색해 보세요.
        </div>
      );
    },
  });

  /* ── Tool: ask_about_news (RAG) ── */
  useCopilotAction({
    name: "ask_about_news",
    description:
      "수집된 뉴스 기사를 벡터 검색으로 찾아 GPT-4o-mini로 심층 분석 답변을 생성합니다. " +
      "뉴스 내용에 대한 '왜', '어떻게', '영향', '의미', '전망' 등 분석적 질문에 사용하세요.",
    parameters: [
      {
        name: "question",
        type: "string",
        description: "사용자의 자연어 질문 (예: 'AI 반도체 규제가 삼성에 미치는 영향은?')",
        required: true,
      },
    ],
    handler: async ({ question }: { question: string }) => {
      const res = await fetch("/api/chat/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) throw new Error(`RAG 요청 실패 (${res.status})`);
      return (await res.json()) as RagAnswerData;
    },
    render: ({ status, result }) => {
      if (status !== "complete") {
        return (
          <div className="nrc-tool-loading">
            <span className="nrc-spinner" />
            <span>뉴스 기사를 분석하고 있습니다…</span>
          </div>
        );
      }
      if (!result) {
        return (
          <div className="nrc-tool-empty">
            <Brain size={14} style={{ opacity: 0.5 }} />
            분석 결과를 불러오지 못했습니다.
          </div>
        );
      }
      return <RagAnswerCard data={result as RagAnswerData} />;
    },
  });

  /* ── Tool: generate_report ── */
  useCopilotAction({
    name: "generate_report",
    description: "수집·분석된 뉴스를 종합해 일일 브리핑 리포트를 생성합니다.",
    parameters: [],
    handler: async () => {
      const res = await fetch("/api/report", { method: "POST" });
      if (!res.ok) throw new Error(`리포트 생성 실패 (${res.status})`);
      return (await res.json()) as BackendReport;
    },
    render: ({ status, result }) => {
      if (status !== "complete") {
        return (
          <div className="nrc-tool-loading">
            <span className="nrc-spinner" />
            <span>리포트를 생성하고 있습니다…</span>
          </div>
        );
      }
      if (!result) {
        return (
          <div className="nrc-tool-empty">
            <FileBarChart size={14} style={{ opacity: 0.5 }} />
            리포트 결과를 불러오지 못했습니다.
          </div>
        );
      }
      const report = buildAgentReport(result as BackendReport);
      return (
        <button
          className="nrc-report-card"
          onClick={() => {
            setActiveReport(report);
            setReportOpen(true);
          }}
        >
          <div className="nrc-report-card-icon">
            <FileBarChart size={18} />
          </div>
          <div className="nrc-report-card-body">
            <strong>{report.title}</strong>
            <span>
              {report.newsCount != null ? `${report.newsCount}건 분석 완료` : "리포트 생성 완료"}{" "}
              — 클릭해서 열기
            </span>
          </div>
          <div className="nrc-report-card-arrow">→</div>
        </button>
      );
    },
  });

  /* ── Send handler ── */
  const handleSend = useCallback(
    async (text?: string) => {
      const content = (text ?? inputValue).trim();
      if (!content || isLoading) return;
      setInputValue("");
      // Auto-resize textarea
      if (inputRef.current) inputRef.current.style.height = "auto";
      await sendMessage({
        id: `usr-${Date.now()}`,
        content,
        role: "user",
      });
    },
    [inputValue, isLoading, sendMessage],
  );

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  /* ── Copy message ── */
  const copyMessage = useCallback(async (id: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  /* ── Auto-resize textarea ── */
  const handleInput = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, []);

  /* ── Filter visible messages ── */
  const visibleMessages = useMemo(
    () => (messages as ChatMessage[]).filter((m) => m.role === "user" || m.role === "assistant"),
    [messages],
  );

  const showWelcome = visibleMessages.length === 0 && !isLoading;

  /* ═══════════════════════════ Render ═══════════════════════════ */
  return (
    <div className={cn("nrc-root", className)}>
      {/* ── Header ── */}
      <header className="nrc-header">
        <div className="nrc-header-left">
          <div className="nrc-avatar-agent nrc-avatar-sm">
            <Orbit size={14} />
          </div>
          <div>
            <h2 className="nrc-header-title">News Radar Agent</h2>
            <p className="nrc-header-status">
              {isLoading ? (
                <>
                  <span className="nrc-dot-pulse" />
                  응답 생성 중…
                </>
              ) : (
                <>
                  <Radio size={10} />
                  온라인
                </>
              )}
            </p>
          </div>
        </div>
        {systemContext && (
          <div className="nrc-header-pills">
            <span className="nrc-pill nrc-pill-blue">
              뉴스 {systemContext.totalNewsCount.toLocaleString()}건
            </span>
            <span className="nrc-pill nrc-pill-purple">
              키워드 {systemContext.activeKeywordCount}개
            </span>
          </div>
        )}
      </header>

      {/* ── Messages area ── */}
      <div className="nrc-messages">
        <AnimatePresence initial={false}>
          {/* Welcome screen */}
          {showWelcome && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
              className="nrc-welcome"
            >
              <div className="nrc-welcome-icon">
                <Orbit size={32} />
              </div>
              <h3 className="nrc-welcome-title">News Radar Agent</h3>
              <p className="nrc-welcome-desc">
                안녕하세요! IT 기술 뉴스 분석 에이전트입니다.
                <br />
                뉴스 검색, 수집, 리포트 생성을 도와드릴게요.
              </p>

              {/* Quick actions */}
              <div className="nrc-quick-actions">
                {QUICK_ACTIONS.map((qa) => (
                  <motion.button
                    key={qa.label}
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    className="nrc-quick-btn"
                    onClick={() => handleSend(qa.message)}
                  >
                    <qa.icon size={16} />
                    <span>{qa.label}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Message list */}
          {visibleMessages.map((msg, idx) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(idx * 0.03, 0.15) }}
              className={cn(
                "nrc-msg-row",
                msg.role === "user" ? "nrc-msg-row-user" : "nrc-msg-row-assistant",
              )}
            >
              {/* Avatar */}
              {msg.role === "assistant" && (
                <div className="nrc-avatar-agent">
                  <Bot size={16} />
                </div>
              )}

              <div className={cn("nrc-bubble", msg.role === "user" ? "nrc-bubble-user" : "nrc-bubble-assistant")}>
                {/* Generative UI (before) */}
                {msg.generativeUI && msg.generativeUIPosition !== "after" && (
                  <div className="nrc-gen-ui">{msg.generativeUI()}</div>
                )}

                {/* Text content */}
                {msg.content && (
                  <div className="nrc-msg-text">
                    {msg.role === "assistant" ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: ({ href, children }) => (
                            <a href={href} target="_blank" rel="noopener noreferrer">
                              {children}
                            </a>
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      msg.content
                    )}
                  </div>
                )}

                {/* Generative UI (after) */}
                {msg.generativeUI && msg.generativeUIPosition === "after" && (
                  <div className="nrc-gen-ui">{msg.generativeUI()}</div>
                )}

                {/* Message actions (assistant only) */}
                {msg.role === "assistant" && msg.content && (
                  <div className="nrc-msg-actions">
                    <button
                      className="nrc-msg-action-btn"
                      onClick={() => copyMessage(msg.id, msg.content)}
                      title="복사"
                    >
                      {copiedId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </div>
                )}
              </div>

              {/* User avatar */}
              {msg.role === "user" && (
                <div className="nrc-avatar-user">
                  <User size={14} />
                </div>
              )}
            </motion.div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="nrc-msg-row nrc-msg-row-assistant"
            >
              <div className="nrc-avatar-agent">
                <Bot size={16} />
              </div>
              <div className="nrc-typing-indicator">
                <span /><span /><span />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area ── */}
      <div className="nrc-input-area">
        {/* Quick-action pills when conversation is ongoing */}
        {!showWelcome && !isLoading && (
          <div className="nrc-input-pills">
            {QUICK_ACTIONS.map((qa) => (
              <button
                key={qa.label}
                className="nrc-input-pill"
                onClick={() => handleSend(qa.message)}
              >
                <qa.icon size={12} />
                {qa.label}
              </button>
            ))}
          </div>
        )}

        <form
          className="nrc-input-form"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <textarea
            ref={inputRef}
            className="nrc-textarea"
            placeholder="메시지를 입력하세요…"
            rows={1}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            disabled={isLoading}
          />
          {isLoading ? (
            <button
              type="button"
              className="nrc-send-btn nrc-stop-btn"
              onClick={() => stopGeneration()}
              title="생성 중지"
            >
              <Square size={16} />
            </button>
          ) : (
            <button
              type="submit"
              className="nrc-send-btn"
              disabled={!inputValue.trim()}
              title="전송 (Enter)"
            >
              <Send size={16} />
            </button>
          )}
        </form>
      </div>

      {/* ── Report slide-over ── */}
      <ReportViewer
        report={activeReport}
        open={reportOpen}
        onClose={() => setReportOpen(false)}
      />
    </div>
  );
}

/* ─────────────────────────── Helpers ─────────────────────────── */

function buildAgentReport(data: BackendReport): AgentReport {
  return {
    id: `rpt-${Date.now()}`,
    title: `뉴스 데일리 리포트 — ${data.stats?.keyword ?? "전체"}`,
    content: formatReportContent(data),
    createdAt: new Date().toISOString(),
    keyword: data.stats?.keyword,
    newsCount: data.stats?.totalCount,
  };
}

function formatReportContent(report: BackendReport): string {
  const s = report.stats;
  const lines: string[] = ["# 뉴스 데일리 리포트", ""];

  if (s) {
    lines.push("## 통계 요약", "", "| 항목 | 값 |", "|---|---|");
    if (s.keyword) lines.push(`| 키워드 | ${s.keyword} |`);
    if (s.date) lines.push(`| 날짜 | ${s.date} |`);
    if (s.totalCount != null) lines.push(`| 총 기사 수 | ${s.totalCount}건 |`);
    if (s.averageScore != null) lines.push(`| 평균 중요도 | ${s.averageScore.toFixed(1)}점 |`);
    if (s.gradeDistribution) {
      const grades = Object.entries(s.gradeDistribution)
        .map(([g, c]) => `${g}: ${c}건`)
        .join(", ");
      lines.push(`| 등급 분포 | ${grades} |`);
    }
    lines.push("");
  }

  const articles = report.articles;
  if (articles && articles.length > 0) {
    lines.push("## 주요 기사", "");
    articles.forEach((a, i) => {
      lines.push(`### ${i + 1}. ${a.title ?? "제목 없음"}`);
      lines.push(
        `- **중요도**: ${a.grade ?? "N/A"} (${a.importanceScore ?? "-"}점) / **카테고리**: ${a.category ?? "-"}`,
      );
      if (a.summary) lines.push(`- ${a.summary}`);
      if (a.aiReason) lines.push(`> ${a.aiReason}`);
      lines.push("");
    });
  } else {
    lines.push("수집된 뉴스가 없습니다.");
  }

  return lines.join("\n");
}
