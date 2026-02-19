"use client";

import { Activity, Bell, Wifi } from "lucide-react";
import { useNavigation, type TabId } from "@/lib/NavigationContext";

const tabTitles: Record<TabId, string> = {
  dashboard: "Dashboard",
  news: "뉴스 수집",
  chat: "AI 채팅",
};

export default function Header() {
  const { activeTab } = useNavigation();

  return (
    <header
      className="flex h-14 shrink-0 items-center justify-between border-b px-6"
      style={{
        background: "rgba(3, 7, 18, 0.4)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderColor: "var(--glass-border)",
      }}
    >
      {/* Left — page title */}
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
          {tabTitles[activeTab]}
        </h1>
        <span
          className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{
            background: "rgba(16, 185, 129, 0.12)",
            color: "#10b981",
            border: "1px solid rgba(16, 185, 129, 0.20)",
          }}
        >
          <Wifi size={10} strokeWidth={2.5} />
          Live
        </span>
      </div>

      {/* Right — status indicators */}
      <div className="flex items-center gap-3">
        {/* Activity pulse */}
        <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ background: "var(--glass-bg)" }}>
          <Activity size={13} style={{ color: "var(--neon-blue)" }} strokeWidth={2} />
          <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Agent Idle
          </span>
        </div>

        {/* Notifications */}
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-200 hover:bg-[rgba(255,255,255,0.05)]"
          style={{ color: "var(--text-muted)" }}
        >
          <Bell size={16} strokeWidth={1.8} />
          {/* notification dot */}
          <span
            className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full"
            style={{
              background: "#ef4444",
              boxShadow: "0 0 6px rgba(239, 68, 68, 0.6)",
            }}
          />
        </button>
      </div>
    </header>
  );
}
