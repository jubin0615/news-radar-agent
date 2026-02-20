"use client";

import { ReactNode, useEffect, useState } from "react";
import { Sidebar } from "@/components/layout";
import Header from "@/components/layout/Header";
import { NavigationProvider, useNavigation } from "@/lib/NavigationContext";
import NewsCollectionView from "@/components/common/NewsCollectionView";
import DashboardView from "@/components/layout/DashboardView";
import AgUiWrapper from "@/components/generative/AgUiWrapper";
import StatCard from "@/components/common/StatCard";
import { Activity, Calendar, Database, Hash } from "lucide-react";

interface DashboardStats {
  totalNewsCount: number;
  todayNewsCount: number;
  activeKeywordCount: number;
  collecting: boolean;
  lastCollectedAt: string | null;
}

interface DashboardLayoutProps {
  stats?: ReactNode;
  children: ReactNode;
}

function DashboardContent({ stats: initialStats, children }: DashboardLayoutProps) {
  const { activeTab } = useNavigation();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    if (activeTab !== "chat") return;

    const fetchData = async () => {
      try {
        const statsRes = await fetch("/api/news/collection-status");

        if (statsRes.ok) {
          setStats(await statsRes.json());
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [activeTab]);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Left: Sidebar */}
      <Sidebar />

      {/* Right: Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <Header />

        {/* Stats bar (top of main area) — only on chat */}
        {activeTab === "chat" && (stats || initialStats) && (
          <div
            className="shrink-0 border-b px-6 py-4"
            style={{ borderColor: "var(--glass-border)" }}
          >
            {stats ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="전체 수집 뉴스"
                  value={stats.totalNewsCount.toLocaleString()}
                  icon={Database}
                  glow="blue"
                  delay={0.1}
                />
                <StatCard
                  label="오늘 수집"
                  value={stats.todayNewsCount.toLocaleString()}
                  icon={Calendar}
                  glow="purple"
                  delay={0.2}
                />
                <StatCard
                  label="활성 키워드"
                  value={stats.activeKeywordCount}
                  icon={Hash}
                  glow="mixed"
                  delay={0.3}
                />
                <StatCard
                  label="수집 상태"
                  value={stats.collecting ? "수집 중" : "대기 중"}
                  icon={Activity}
                  glow={stats.collecting ? "blue" : "purple"}
                  delay={0.4}
                  subtitle={
                    stats.lastCollectedAt
                      ? `마지막 ${new Date(stats.lastCollectedAt).toLocaleTimeString()}`
                      : "-"
                  }
                />
              </div>
            ) : (
              initialStats
            )}
          </div>
        )}

        {/* Central content area */}
        <main className="relative flex-1 overflow-y-auto p-6">
          {/* AgUiWrapper: always mounted, hidden when not on chat tab */}
          <div className={activeTab === "chat" ? "h-full" : "hidden"}>
            <AgUiWrapper className="h-full" />
          </div>

          {activeTab === "dashboard" && <DashboardView />}
          {activeTab === "news" && <NewsCollectionView className="h-full" />}
          {activeTab !== "dashboard" && activeTab !== "news" && activeTab !== "chat" && children}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout(props: DashboardLayoutProps) {
  return (
    <NavigationProvider>
      <DashboardContent {...props} />
    </NavigationProvider>
  );
}
