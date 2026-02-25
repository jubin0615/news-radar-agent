"use client";

import { useEffect, useState } from "react";
import { Activity, Calendar, Database, Hash, Loader2 } from "lucide-react";
import StatCard from "@/components/common/StatCard";
import FloatingGuide from "./FloatingGuide";
import WelcomeModal from "./WelcomeModal";
import MorningBriefingHero from "./MorningBriefingHero";
import { useNavigation } from "@/lib/NavigationContext";

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
  const { navigateToTodayNews } = useNavigation();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/news/collection-status");
        if (res.ok) {
          setStats(await res.json());
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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
    <>
      <WelcomeModal />

      <div className="flex flex-col gap-8 p-2">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">대시보드</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            뉴스 수집 현황을 한눈에 확인할 수 있습니다.
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
            onClick={navigateToTodayNews}
          />
          <StatCard
            label="활성 키워드"
            value={(stats?.activeKeywordCount ?? 0).toLocaleString()}
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

        <MorningBriefingHero />

        <FloatingGuide />
      </div>
    </>
  );
}
