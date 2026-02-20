/**
 * AgUiWrapper — CopilotKit 기반 AI 채팅 인터페이스
 *
 * AG-UI 대신 CopilotKit을 사용해 LLM 대화를 처리:
 *   • useCopilotAction  — search_news / collect_news / generate_report 도구 정의
 *   • useCopilotReadable — 시스템 상태(키워드, 뉴스 수 등)를 LLM에 전달
 *   • CopilotChat       — 다크 테마 채팅 UI (CSS 오버라이드 적용)
 *   • ReportViewer      — 리포트 슬라이드-오버 패널
 */

"use client";

import { useState, useEffect } from "react";
import {
  useCopilotAction,
  useCopilotReadable,
} from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import { cn } from "@/lib/cn";
import NewsCarousel from "./NewsCarousel";
import ReportViewer from "./ReportViewer";
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

/* ─────────────────────────── System prompt ─────────────────────────── */

const SYSTEM_INSTRUCTIONS = `
너는 "뉴스 레이더"라는 IT 기술 뉴스 분석 서비스의 AI 에이전트야.
사용자와 자연스럽게 한국어로 대화하면서, 필요할 때 아래 도구를 사용해.

## 사용 가능한 도구
- search_news: DB에서 뉴스를 검색 (keyword 파라미터 옵션)
- collect_news: 인터넷에서 최신 뉴스를 크롤링해 수집
- generate_report: 수집된 뉴스로 일일 브리핑 리포트 생성

## 도구 사용 기준
- "뉴스 알려줘", "~뉴스", "~소식", "~동향" → search_news
- "수집", "크롤링", "새 뉴스 가져와" → collect_news
- "리포트", "보고서", "브리핑", "요약 정리" → generate_report
- 일반 질문·잡담 → 도구 없이 자연스럽게 대화

## 주의사항
- 수집된 뉴스가 없을 때 검색 요청이 오면 먼저 collect_news를 제안해.
- 대화 맥락을 항상 반영해서 일관성 있게 답변해.
`.trim();

/* ═══════════════════════════ Component ═══════════════════════════ */

export default function AgUiWrapper({ className }: { className?: string }) {
  const [reportOpen, setReportOpen] = useState(false);
  const [activeReport, setActiveReport] = useState<AgentReport | null>(null);
  const [systemContext, setSystemContext] = useState<CollectionStatus | null>(null);

  // 시스템 상태 로드 (LLM 컨텍스트 제공용)
  useEffect(() => {
    fetch("/api/news/collection-status")
      .then((r) => r.json())
      .then(setSystemContext)
      .catch(() => null);
  }, []);

  // LLM에 현재 시스템 상태 전달
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

  /* ── 도구: 뉴스 검색 ── */
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
          <div className="news-radar-tool-loading">
            <span className="news-radar-spinner" />
            뉴스를 검색하고 있습니다…
          </div>
        );
      }
      const items = (result ?? []) as NewsItem[];
      if (items.length === 0) {
        return (
          <div className="news-radar-tool-empty">
            검색 결과가 없습니다. 뉴스를 먼저 수집해 보세요.
          </div>
        );
      }
      return <NewsCarousel items={items} title="검색 결과" />;
    },
  });

  /* ── 도구: 뉴스 수집 ── */
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
          <div className="news-radar-tool-loading">
            <span className="news-radar-spinner" />
            뉴스를 수집하고 있습니다… (1~2분 소요)
          </div>
        );
      }
      return (
        <div className="news-radar-tool-success">
          ✓ 뉴스 수집이 시작되었습니다. 잠시 후 검색해 보세요.
        </div>
      );
    },
  });

  /* ── 도구: 리포트 생성 ── */
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
          <div className="news-radar-tool-loading">
            <span className="news-radar-spinner" />
            리포트를 생성하고 있습니다…
          </div>
        );
      }
      if (!result) {
        return (
          <div className="news-radar-tool-empty">
            리포트 결과를 불러오지 못했습니다.
          </div>
        );
      }

      const report = buildAgentReport(result as BackendReport);
      return (
        <button
          className="news-radar-report-btn"
          onClick={() => {
            setActiveReport(report);
            setReportOpen(true);
          }}
        >
          <span className="news-radar-report-icon">📄</span>
          <span>
            <strong>{report.title}</strong>
            <br />
            <small>
              {report.newsCount != null ? `${report.newsCount}건 분석 완료` : "리포트 생성 완료"} —
              클릭해서 열기
            </small>
          </span>
        </button>
      );
    },
  });

  /* ── Render ── */
  return (
    <div className={cn("news-radar-chat-root", className)}>
      <CopilotChat
        instructions={SYSTEM_INSTRUCTIONS}
        className="news-radar-copilot-chat"
        labels={{
          title: "News Radar Agent",
          initial:
            "안녕하세요! IT 기술 뉴스 레이더 에이전트입니다.\n뉴스 검색, 수집, 리포트 생성을 도와드릴게요. 무엇이 궁금하신가요?",
          placeholder: "메시지를 입력하세요… (Enter로 전송)",
        }}
      />

      {/* 리포트 슬라이드-오버 패널 */}
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
