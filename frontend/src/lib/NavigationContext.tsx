"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

// ── Tab types ────────────────────────────────────────────────── //
export type TabId = "dashboard" | "news" | "chat";

interface NavigationContextValue {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  /** 키워드 클릭 시 뉴스 수집 탭으로 이동하며 해당 키워드로 필터링 */
  navigateToNewsWithKeyword: (keyword: string) => void;
  /** 현재 선택된 키워드 필터 (뉴스 탭에서 사용) */
  selectedKeyword: string | null;
  clearSelectedKeyword: () => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);

  const navigateToNewsWithKeyword = useCallback((keyword: string) => {
    setSelectedKeyword(keyword);
    setActiveTab("news");
  }, []);

  const clearSelectedKeyword = useCallback(() => {
    setSelectedKeyword(null);
  }, []);

  return (
    <NavigationContext.Provider
      value={{
        activeTab,
        setActiveTab,
        navigateToNewsWithKeyword,
        selectedKeyword,
        clearSelectedKeyword,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error("useNavigation must be used within NavigationProvider");
  return ctx;
}
