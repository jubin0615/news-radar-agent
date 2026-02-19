"use client";

import { ReactNode } from "react";
import { Sidebar } from "@/components/layout";
import Header from "@/components/layout/Header";
import { NavigationProvider, useNavigation } from "@/lib/NavigationContext";
import NewsCollectionView from "@/components/common/NewsCollectionView";
import DashboardView from "@/components/layout/DashboardView";

interface DashboardLayoutProps {
  stats?: ReactNode;
  children: ReactNode;
}

function DashboardContent({ stats, children }: DashboardLayoutProps) {
  const { activeTab } = useNavigation();

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardView />;
      case "news":
        return <NewsCollectionView className="h-full" />;
      case "chat":
        return children; // AG-UI chat
      default:
        return children;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* ── Left: Sidebar ── */}
      <Sidebar />

      {/* ── Right: Main area ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <Header />

        {/* Stats bar (top of main area) — only on dashboard */}
        {activeTab === "chat" && stats && (
          <div
            className="shrink-0 border-b px-6 py-4"
            style={{ borderColor: "var(--glass-border)" }}
          >
            {stats}
          </div>
        )}

        {/* Central content area */}
        <main className="relative flex-1 overflow-y-auto p-6">
          {renderContent()}
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
