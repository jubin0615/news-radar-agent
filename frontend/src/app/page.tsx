"use client";

import { Newspaper, TrendingUp, Radio, Zap } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import StatCard from "@/components/common/StatCard";
import { AgUiWrapper } from "@/components/generative";

// ── Stat cards ──────────────────────────────────────────────── //
const stats = [
  {
    label: "수집된 뉴스",
    value: "—",
    subtitle: "지난 24시간",
    icon: Newspaper,
    glow: "blue" as const,
  },
  {
    label: "분석 완료",
    value: "—",
    subtitle: "AI 처리 완료",
    icon: TrendingUp,
    glow: "purple" as const,
  },
  {
    label: "실시간 소스",
    value: "32",
    subtitle: "Active feeds",
    icon: Radio,
    glow: "blue" as const,
  },
  {
    label: "에이전트 작업",
    value: "—",
    subtitle: "대기 중",
    icon: Zap,
    glow: "mixed" as const,
  },
];

// ── Page ─────────────────────────────────────────────────────── //
export default function Home() {
  return (
    <DashboardLayout
      stats={
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s, i) => (
            <StatCard key={s.label} {...s} delay={i * 0.08} />
          ))}
        </div>
      }
    >
      {/* AG-UI 채팅 인터페이스 */}
      <AgUiWrapper className="h-full" />
    </DashboardLayout>
  );
}
