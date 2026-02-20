"use client";

import { ReactNode } from "react";
import { Sidebar } from "@/components/layout";
import Header from "@/components/layout/Header";
import { NavigationProvider, useNavigation } from "@/lib/NavigationContext";
import NewsCollectionView from "@/components/common/NewsCollectionView";
import DashboardView from "@/components/layout/DashboardView";
import AgUiWrapper from "@/components/generative/AgUiWrapper";

interface DashboardLayoutProps {
  children: ReactNode;
}

function DashboardContent({ children }: DashboardLayoutProps) {
  const { activeTab } = useNavigation();

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Left: Sidebar */}
      <Sidebar />

      {/* Right: Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <Header />

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
