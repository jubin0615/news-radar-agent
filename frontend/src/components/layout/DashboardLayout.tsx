"use client";

import { ReactNode, useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [initialized, setInitialized] = useState<boolean | null>(null); // null = loading
  const [backendError, setBackendError] = useState<string | null>(null);

  // 미인증 사용자 → 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.replace("/login");
    }
  }, [authStatus, router]);

  useEffect(() => {
    // 인증 완료 후에만 시스템 상태 확인
    if (authStatus !== "authenticated") return;

    setBackendError(null);
    fetch("/api/system/status", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          // 백엔드 JWT 만료 → NextAuth 세션도 정리하고 로그인 페이지로
          await signOut({ callbackUrl: "/login" });
          return;
        }
        if (!res.ok) throw new Error(`Backend ${res.status}`);
        const data = await res.json();
        setInitialized(data.initialized === true);
      })
      .catch(() => {
        setInitialized(false); // fallback: 에러 시 온보딩 표시
      });
  }, [authStatus]);

  const handleOnboardingComplete = useCallback(() => {
    setInitialized(true);
  }, []);

  // Auth loading or system status loading
  if (authStatus === "loading" || authStatus === "unauthenticated" || initialized === null) {
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
        <OnboardingView onComplete={handleOnboardingComplete} initialError={backendError} />
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
