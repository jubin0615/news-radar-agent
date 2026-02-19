"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Database,
  Calendar,
  Hash,
  ArrowRight,
  Loader2,
} from "lucide-react";
import StatCard from "@/components/common/StatCard";
import { useNavigation } from "@/lib/NavigationContext";
import type { NewsItem } from "@/types";

interface DashboardStats {
  totalNewsCount: number;
  todayNewsCount: number;
  activeKeywordCount: number;
  collecting: boolean;
  lastCollectedAt: string | null;
}

export default function DashboardView() {
  const { setActiveTab } = useNavigation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentNews, setRecentNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, newsRes] = await Promise.all([
          fetch("/api/news/collection-status"),
          fetch("/api/news"),
        ]);

        if (statsRes.ok) {
          setStats(await statsRes.json());
        }

        if (newsRes.ok) {
          const data: NewsItem[] = await newsRes.json();
          // 최신순 정렬 후 상위 5개만 추출
          const sorted = data
            .sort((a, b) => new Date(b.collectedAt || 0).getTime() - new Date(a.collectedAt || 0).getTime())
            .slice(0, 5);
          setRecentNews(sorted);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // 10초마다 데이터 갱신
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
      {/* Header Section */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          대시보드
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          뉴스 수집 현황과 시스템 상태를 한눈에 확인하세요.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="총 수집 뉴스"
          value={stats?.totalNewsCount.toLocaleString() ?? "0"}
          icon={Database}
          glow="blue"
          delay={0.1}
        />
        <StatCard
          label="오늘 수집됨"
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
          label="시스템 상태"
          value={stats?.collecting ? "수집 중" : "대기 중"}
          icon={Activity}
          glow={stats?.collecting ? "blue" : "purple"}
          delay={0.4}
          subtitle={stats?.lastCollectedAt ? `마지막: ${new Date(stats.lastCollectedAt).toLocaleTimeString()}` : "-"}
        />
      </div>

      {/* Recent Activity Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Activity size={18} className="text-[var(--neon-blue)]" />
            최근 수집 활동
          </h3>
          <button
            onClick={() => setActiveTab("news")}
            className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--neon-blue)] transition-colors flex items-center gap-1"
          >
            전체 보기 <ArrowRight size={12} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {recentNews.length > 0 ? (
            recentNews.map((news, i) => (
              <motion.div
                key={news.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 + 0.5 }}
                className="group flex items-center gap-4 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 transition-all hover:border-[var(--neon-blue)] hover:bg-[rgba(0,212,255,0.03)]"
              >
                {/* Status Dot */}
                <div className={`h-2 w-2 shrink-0 rounded-full ${
                  news.grade === 'CRITICAL' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' :
                  news.grade === 'HIGH' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]' :
                  'bg-[var(--neon-blue)] shadow-[0_0_8px_rgba(0,212,255,0.6)]'
                }`} />
                
                <div className="flex flex-1 flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-[var(--text-secondary)] px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.05)]">
                      {news.keyword}
                    </span>
                    <h4 className="truncate text-sm font-medium text-[var(--text-primary)]">
                      {news.title}
                    </h4>
                  </div>
                  <p className="truncate text-xs text-[var(--text-muted)]">
                    {news.summary || "요약 없음"}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-4 text-xs text-[var(--text-muted)]">
                  <span className="hidden sm:inline-block">
                    {news.collectedAt ? new Date(news.collectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </span>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-[var(--glass-border)] bg-[rgba(255,255,255,0.02)]">
              <p className="text-sm text-[var(--text-muted)]">최근 수집된 뉴스가 없습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}