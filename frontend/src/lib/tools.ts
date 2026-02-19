/**
 * AG-UI Tool Definitions
 *
 * Each tool maps to a Java backend capability and is rendered
 * as Generative UI on the frontend when the agent invokes it.
 *
 *  search_news     → NewsCarousel (via /api/news)
 *  generate_report → ReportViewer (via /api/report)
 */

import type { Tool } from "@ag-ui/client";

export const agentTools: Tool[] = [
  {
    name: "search_news",
    description:
      "키워드로 뉴스를 검색하거나 최신 주요 뉴스를 조회합니다. 결과는 NewsCarousel 카드 UI로 렌더됩니다.",
    parameters: {
      type: "object",
      properties: {
        keyword: {
          type: "string",
          description: "검색할 키워드 (예: AI, 반도체). 비어있으면 전체 최신 뉴스를 반환합니다.",
        },
      },
    },
  },
  {
    name: "generate_report",
    description:
      "오늘 수집/분석된 뉴스를 종합하여 일일 브리핑 리포트를 생성합니다. 결과는 ReportViewer 패널로 렌더됩니다.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
];

/**
 * Tool name → Generative UI component mapping key.
 * Used by AgUiWrapper to decide which component to render
 * when a TOOL_CALL_END event arrives.
 */
export type ToolName = "search_news" | "generate_report" | "collect_news" | "daily_report";

/** Matches backend-side toolName aliases to canonical frontend ToolName */
export function normalizeToolName(raw: string): ToolName {
  const map: Record<string, ToolName> = {
    search_news: "search_news",
    generate_report: "generate_report",
    daily_report: "generate_report",
    collect_news: "search_news",
  };
  return map[raw] ?? "search_news";
}
