"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Bot,
  Calendar,
  Database,
  Hash,
  Loader2,
  MessageSquare,
  Newspaper,
} from "lucide-react";
import StatCard from "@/components/common/StatCard";

interface DashboardStats {
  totalNewsCount: number;
  todayNewsCount: number;
  activeKeywordCount: number;
  collecting: boolean;
  lastCollectedAt: string | null;
}

export default function DashboardView() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const statsRes = await fetch("/api/news/collection-status");

        if (statsRes.ok) {
          setStats(await statsRes.json());
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // 10s polling
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-[var(--neon-blue)]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-2">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">대시보드</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          뉴스 수집 현황과 서비스 상태를 한눈에 확인할 수 있습니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="전체 수집 뉴스"
          value={stats?.totalNewsCount.toLocaleString() ?? "0"}
          icon={Database}
          glow="blue"
          delay={0.1}
        />
        <StatCard
          label="오늘 수집"
          value={stats?.todayNewsCount.toLocaleString() ?? "0"}
          icon={Calendar}
          glow="purple"
          delay={0.2}
        />
        <StatCard
          label="활성 키워드"
          value={stats?.activeKeywordCount ?? "0"}
          icon={Hash}
          glow="mixed"
          delay={0.3}
        />
        <StatCard
          label="수집 상태"
          value={stats?.collecting ? "수집 중" : "대기 중"}
          icon={Activity}
          glow={stats?.collecting ? "blue" : "purple"}
          delay={0.4}
          subtitle={
            stats?.lastCollectedAt
              ? `마지막 ${new Date(stats.lastCollectedAt).toLocaleTimeString()}`
              : "-"
          }
        />
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-[var(--text-primary)]">
          <Bot size={18} className="text-[var(--neon-blue)]" />
          에이전트 사용 가이드
        </h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="group relative overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 transition-all hover:border-[var(--neon-blue)] hover:bg-[rgba(0,212,255,0.03)]">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[rgba(0,212,255,0.1)] text-[var(--neon-blue)]">
              <Hash size={20} />
            </div>
            <h4 className="mb-2 text-base font-bold text-[var(--text-primary)]">1. 키워드 등록</h4>
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
              사이드바의 <strong>키워드 관리</strong>에서 관심 주제를 등록하면,
              수집기가 해당 키워드를 기준으로 뉴스를 찾습니다.
            </p>
          </div>

          <div className="group relative overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 transition-all hover:border-[var(--neon-purple)] hover:bg-[rgba(168,85,247,0.03)]">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[rgba(168,85,247,0.1)] text-[var(--neon-purple)]">
              <Newspaper size={20} />
            </div>
            <h4 className="mb-2 text-base font-bold text-[var(--text-primary)]">2. 뉴스 수집</h4>
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
              <strong>뉴스 수집</strong> 탭에서 <strong>뉴스 수집 시작</strong> 버튼을 눌러
              최신 뉴스를 가져오고 중요도를 분석합니다.
            </p>
          </div>

          <div className="group relative overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 transition-all hover:border-[#10b981] hover:bg-[rgba(16,185,129,0.03)]">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[rgba(16,185,129,0.1)] text-[#10b981]">
              <MessageSquare size={20} />
            </div>
            <h4 className="mb-2 text-base font-bold text-[var(--text-primary)]">3. AI 리포트 확인</h4>
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
              <strong>AI 채팅</strong>에서 오늘 뉴스 리포트를 요청하면,
              수집된 뉴스를 요약하고 핵심 인사이트를 제공합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
