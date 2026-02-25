/**
 * AgUiWrapper — 커스텀 AI 채팅 인터페이스
 *
 * CopilotKit 위에 직접 사용한 완전 커스텀 UI 구현:
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
import type { NewsItem, AgentReport, DailyReport, ReportNewsItem } from "@/types";

/* ═══════════════════════════ Types ═══════════════════════════ */

interface CollectionStatus {
  totalNewsCount: number;
  todayNewsCount: number;
  activeKeywordCount: number;
  collecting: boolean;
  activeKeywords?: string[];
}

function normalizeCollectionStatus(value: unknown): CollectionStatus | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;

  const totalNewsCount = Number(data.totalNewsCount);
  const todayNewsCount = Number(data.todayNewsCount);
  const activeKeywordCount = Number(data.activeKeywordCount);
  const collecting = data.collecting;

  if (
    !Number.isFinite(totalNewsCount) ||
    !Number.isFinite(todayNewsCount) ||
    !Number.isFinite(activeKeywordCount) ||
    typeof collecting !== "boolean"
  ) {
    return null;
  }

  return {
    totalNewsCount,
    todayNewsCount,
    activeKeywordCount,
    collecting,
    activeKeywords: Array.isArray(data.activeKeywords)
      ? data.activeKeywords.filter((k): k is string => typeof k === "string")
      : undefined,
  };
}

interface BackendReportItem {
  title?: string;
  url?: string;
  importanceScore?: number | null;
  innovationScore?: number | null;
  aiScore?: number | null;
  category?: string | null;
  summary?: string | null;
  aiReason?: string | null;
}

interface BackendReportStats {
  keyword?: string;
  date?: string;
  totalCount?: number;
  averageScore?: number;
  gradeDistribution?: Record<string, number>;
}

interface BackendReport {
  // New shape (티어링·컷오프 적용)
  totalNewsCount?: number;
  displayedNewsCount?: number;
  trendInsight?: string;
  headlines?: BackendReportItem[];
  radarBoard?: BackendReportItem[];
  // Legacy shape (하위 호환)
  stats?: BackendReportStats;
  articles?: BackendReportItem[];
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

/* ═══════════════════════════ System prompt ═══════════════════════════ */

const SYSTEM_INSTRUCTIONS = `
너는 "뉴스 레이더"라는 IT 기술 뉴스 분석 서비스의 AI 에이전트야.
사용자와 자연스럽게 한국어로 대화하면서, 필요할 때 아래 도구를 사용해.

## 사용 가능한 도구
- search_news: DB에서 뉴스를 키워드로 검색. keyword 없이 호출하면 전체 최신 뉴스 반환
- collect_news: 인터넷에서 등록된 키워드로 최신 뉴스를 크롤링해 수집
- generate_report: 수집된 뉴스로 일일 브리핑 리포트 생성
- ask_about_news: 수집된 뉴스 내용에 기반해 RAG 방식으로 심층 답변
- trend_briefing: 오늘의 AI 트렌드 브리핑 생성 (중요도 HIGH 이상 + 시의성 최고 뉴스 기반)

## 도구 사용 기준
- "뉴스 알려줘", "~뉴스", "~소식", "~동향" → search_news
- "핫뉴스", "TOP5", "인기", "최신 뉴스" → search_news(키워드 없이)
- "트렌드", "AI 트렌드", "오늘의 트렌드" → trend_briefing
- "수집", "크롤링", "새 뉴스 가져와" → collect_news
- "리포트", "보고서", "브리핑", "요약 정리" → generate_report
- "왜", "어떻게", "분석해줘", "설명해줘", "~에 대해 자세히" → ask_about_news

## 주의사항
- collect_news는 사용자가 명시적으로 요청했을 때만 사용할 것
- 검색 결과가 비어 있어도 자동으로 수집을 실행하지 말 것
- 항상 대화 맥락을 반영해 일관되게 답변할 것
`.trim();

/* ═══════════════════════════ Quick-action chips ═══════════════════════════ */

const QUICK_ACTIONS = [
  {
    label: "오늘의 AI 트렌드",
    icon: TrendingUp,
    message: "오늘의 AI 트렌드는?",
  },
  {
    label: "핫 뉴스 TOP5",
    icon: Flame,
    message: "이번 주 핫 뉴스 TOP5 알려줘",
  },
  {
    label: "리포트 생성",
    icon: FileBarChart,
    message: "뉴스 리포트 만들어줘",
  },
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
      .then(async (r) => {
        if (!r.ok) return null;
        const json = (await r.json()) as unknown;
        return normalizeCollectionStatus(json);
      })
      .then(setSystemContext)
      .catch(() => setSystemContext(null));
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
    description:
      "DB에 수집된 뉴스를 키워드로 검색합니다. keyword 미입력 시 최신 전체 뉴스를 반환합니다.",
    parameters: [
      {
        name: "keyword",
        type: "string",
        description:
          "검색할 키워드 (예: AI, 반도체). 생략 시 최신 전체 뉴스 반환.",
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
            <span>뉴스를 검색하고 있습니다...</span>
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
      return (
        <NewsCarousel
          items={items}
          title="검색 결과"
          onAskAboutNews={handleSend}
        />
      );
    },
  });

  /* ── Tool: collect_news ── */
  useCopilotAction({
    name: "collect_news",
    description:
      "인터넷에서 등록된 키워드로 최신 뉴스를 크롤링해 수집합니다.",
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
            <span>뉴스를 수집하고 있습니다... (1~2분 소요)</span>
          </div>
        );
      }
      return (
        <div className="nrc-tool-success">
          <div className="nrc-tool-success-icon">✓</div>
          뉴스 수집이 시작되었습니다. 잠시 후 다시 확인해 주세요.
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
        description:
          "사용자의 자연어 질문 (예: 'AI 반도체 규제가 삼성에 미치는 영향은?')",
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
            <span>뉴스 기사를 분석하고 있습니다...</span>
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

  /* ── Tool: trend_briefing (오늘의 AI 트렌드) ── */
  useCopilotAction({
    name: "trend_briefing",
    description:
      "오늘의 AI 트렌드 브리핑을 생성합니다. " +
      "중요도 HIGH 이상이면서 시의성(Timeliness)이 가장 높은 뉴스를 선별해 트렌드 리포트를 작성합니다. " +
      "'트렌드', 'AI 트렌드', '오늘의 트렌드' 등의 요청에 사용하세요.",
    parameters: [],
    handler: async () => {
      const res = await fetch("/api/chat/trend-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`트렌드 브리핑 요청 실패 (${res.status})`);
      return (await res.json()) as RagAnswerData;
    },
    render: ({ status, result }) => {
      if (status !== "complete") {
        return (
          <div className="nrc-tool-loading">
            <span className="nrc-spinner" />
            <span>AI 트렌드를 분석하고 있습니다...</span>
          </div>
        );
      }
      if (!result) {
        return (
          <div className="nrc-tool-empty">
            <Brain size={14} style={{ opacity: 0.5 }} />
            트렌드 분석 결과를 불러오지 못했습니다.
          </div>
        );
      }
      return <RagAnswerCard data={result as RagAnswerData} />;
    },
  });

  /* ── Tool: generate_report ── */
  useCopilotAction({
    name: "generate_report",
    description:
      "수집·분석된 뉴스를 종합해 일일 브리핑 리포트를 생성합니다.",
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
            <span>리포트를 생성하고 있습니다...</span>
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
              {report.reportData
                ? `${report.reportData.totalNewsCount}건 검토 → ${report.reportData.displayedNewsCount}건 브리핑`
                : "리포트 생성 완료"}{" "}
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
                  응답 생성 중...
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
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <textarea
            ref={inputRef}
            className="nrc-textarea"
            placeholder="메시지를 입력하세요..."
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

/* ═══════════════════════════ Helpers ═══════════════════════════ */

function buildAgentReportLegacy(data: BackendReport): AgentReport {
  const toItem = (raw: BackendReportItem): ReportNewsItem => ({
    title: raw.title ?? "제목 없음",
    url: raw.url ?? "",
    importanceScore: toNumberOrNull(raw.importanceScore),
    innovationScore: toNumberOrNull(raw.innovationScore) ?? toNumberOrNull(raw.aiScore),
    category: raw.category ?? null,
    summary: raw.summary ?? null,
    aiReason: raw.aiReason ?? null,
  });

  const reportData: DailyReport = {
    totalNewsCount: toNumberOrNull(data.totalNewsCount) ?? 0,
    displayedNewsCount:
      toNumberOrNull(data.displayedNewsCount) ??
      (data.headlines?.length ?? 0) + (data.radarBoard?.length ?? 0),
    trendInsight: data.trendInsight ?? "",
    headlines: (data.headlines ?? []).map(toItem),
    radarBoard: (data.radarBoard ?? []).map(toItem),
  };

  return {
    id: `rpt-${Date.now()}`,
    title: "뉴스 레이더 데일리 브리핑",
    content: "",
    createdAt: new Date().toISOString(),
    newsCount: reportData.displayedNewsCount,
    reportData,
  };
}

function toNumberOrNull(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatGradeDistribution(
  gradeDistribution: BackendReportStats["gradeDistribution"],
): string {
  if (!gradeDistribution) return "";
  return Object.entries(gradeDistribution)
    .filter(([, count]) => Number.isFinite(Number(count)) && Number(count) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([grade, count]) => `${grade}:${count}`)
    .join(", ");
}

function toReportNewsItem(raw: BackendReportItem): ReportNewsItem {
  return {
    title: raw.title ?? "제목 없음",
    url: raw.url ?? "",
    importanceScore: toNumberOrNull(raw.importanceScore),
    innovationScore: toNumberOrNull(raw.innovationScore) ?? toNumberOrNull(raw.aiScore),
    category: raw.category ?? null,
    summary: raw.summary ?? null,
    aiReason: raw.aiReason ?? null,
  };
}

function buildAgentReport(data: BackendReport): AgentReport {
  const hasNewPayload =
    Array.isArray(data.headlines) ||
    Array.isArray(data.radarBoard) ||
    data.totalNewsCount != null ||
    data.displayedNewsCount != null ||
    typeof data.trendInsight === "string";

  if (hasNewPayload) {
    return buildAgentReportLegacy(data);
  }

  const sortedArticles = (data.articles ?? [])
    .map(toReportNewsItem)
    .sort((a, b) => (b.importanceScore ?? 0) - (a.importanceScore ?? 0));

  const headlines = sortedArticles.slice(0, 3);
  const radarBoard = sortedArticles.slice(3, 9);

  const totalNewsCount = toNumberOrNull(data.stats?.totalCount) ?? sortedArticles.length;
  const averageScore = toNumberOrNull(data.stats?.averageScore);
  const gradeText = formatGradeDistribution(data.stats?.gradeDistribution);

  const trendParts = [
    data.stats?.date ? `${data.stats.date} 기준` : "오늘 기준",
    averageScore != null ? `평균 중요도 ${averageScore.toFixed(1)}점` : null,
    gradeText ? `등급 분포 ${gradeText}` : null,
  ].filter((part): part is string => Boolean(part));

  const reportData: DailyReport = {
    totalNewsCount,
    displayedNewsCount: headlines.length + radarBoard.length,
    trendInsight: trendParts.join(" | "),
    headlines,
    radarBoard,
  };

  return {
    id: `rpt-${Date.now()}`,
    title: "뉴스 레이더 데일리 브리핑",
    content: "",
    createdAt: new Date().toISOString(),
    newsCount: reportData.displayedNewsCount,
    reportData,
  };
}
