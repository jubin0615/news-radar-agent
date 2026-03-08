"use client";

import { ReactNode, useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "@/components/layout";
import Header from "@/components/layout/Header";
import { NavigationProvider, useNavigation } from "@/lib/NavigationContext";
import NewsCollectionView from "@/components/common/NewsCollectionView";
import DashboardView from "@/components/layout/DashboardView";
import AgUiWrapper from "@/components/generative/AgUiWrapper";
import OnboardingView from "@/components/layout/OnboardingView";

interface DashboardLayoutProps {
  children: ReactNode;
}

function DashboardContent({ children }: DashboardLayoutProps) {
  const { activeTab } = useNavigation();
  const [initialized, setInitialized] = useState<boolean | null>(null); // null = loading

  useEffect(() => {
    fetch("/api/system/status", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("status check failed");
        return res.json();
      })
      .then((data) => setInitialized(data.initialized === true))
      .catch(() => setInitialized(true)); // fallback: skip onboarding on error
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    setInitialized(true);
  }, []);

  // System status loading
  if (initialized === null) {
    return (
      <div
        className="flex h-screen w-screen items-center justify-center"
        style={{ background: "var(--bg-primary)" }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="nrc-spinner" style={{ width: 28, height: 28 }} />
          <span className="text-sm text-[var(--text-muted)]">로딩 중...</span>
        </motion.div>
      </div>
    );
  }

  // Onboarding screen
  if (!initialized) {
    return (
      <AnimatePresence>
        <OnboardingView onComplete={handleOnboardingComplete} />
      </AnimatePresence>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="flex h-screen w-screen overflow-hidden"
    >
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
          <div className={activeTab === "news" ? "h-full" : "hidden"}>
            <NewsCollectionView className="h-full" />
          </div>
          {activeTab !== "dashboard" && activeTab !== "news" && activeTab !== "chat" && children}
        </main>
      </div>
    </motion.div>
  );
}

export default function DashboardLayout(props: DashboardLayoutProps) {
  return (
    <NavigationProvider>
      <DashboardContent {...props} />
    </NavigationProvider>
  );
}
