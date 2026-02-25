"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type TabId = "dashboard" | "news" | "chat";

interface NavigationContextValue {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  navigateToNewsWithKeyword: (keyword: string) => void;
  navigateToTodayNews: () => void;
  selectedKeyword: string | null;
  selectedDate: string | null;
  clearSelectedKeyword: () => void;
  clearSelectedDate: () => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const navigateToNewsWithKeyword = useCallback((keyword: string) => {
    setSelectedKeyword(keyword);
    setSelectedDate(null);
    setActiveTab("news");
  }, []);

  const navigateToTodayNews = useCallback(() => {
    const today = new Date().toISOString().split("T")[0];
    setSelectedKeyword(null);
    setSelectedDate(today);
    setActiveTab("news");
  }, []);

  const clearSelectedKeyword = useCallback(() => {
    setSelectedKeyword(null);
  }, []);

  const clearSelectedDate = useCallback(() => {
    setSelectedDate(null);
  }, []);

  return (
    <NavigationContext.Provider
      value={{
        activeTab,
        setActiveTab,
        navigateToNewsWithKeyword,
        navigateToTodayNews,
        selectedKeyword,
        selectedDate,
        clearSelectedKeyword,
        clearSelectedDate,
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
