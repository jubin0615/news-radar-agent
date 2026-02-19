"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Radar,
  Newspaper,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/cn";
import KeywordManager from "@/components/common/KeywordManager";
import { useNavigation, type TabId } from "@/lib/NavigationContext";

// ── Nav Item Type ────────────────────────────────────────────── //
interface NavItem {
  icon: typeof Radar;
  label: string;
  tabId: TabId;
}

const navItems: NavItem[] = [
  { icon: Radar, label: "대시보드", tabId: "dashboard" },
  { icon: Newspaper, label: "뉴스 수집", tabId: "news" },
  { icon: MessageSquare, label: "AI 채팅", tabId: "chat" },
];

// ── Component ────────────────────────────────────────────────── //
export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { activeTab, setActiveTab } = useNavigation();

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 280 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        "relative flex h-full flex-col overflow-hidden",
        "border-r",
      )}
      style={{
        background: "rgba(3, 7, 18, 0.6)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderColor: "var(--glass-border)",
      }}
    >
      {/* ── Logo / Brand ──────────────────────────── */}
      <div className="flex h-16 items-center gap-3 border-b px-4" style={{ borderColor: "var(--glass-border)" }}>
        {/* Radar icon with glow */}
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: "linear-gradient(135deg, rgba(0, 212, 255, 0.15), rgba(168, 85, 247, 0.15))",
            boxShadow: "0 0 20px rgba(0, 212, 255, 0.12)",
          }}
        >
          <Radar size={18} style={{ color: "var(--neon-blue)" }} strokeWidth={2} />
        </div>

        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col overflow-hidden"
          >
            <span className="text-sm font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              News Radar
            </span>
            <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
              Intelligence Agent
            </span>
          </motion.div>
        )}
      </div>

      {/* ── Navigation ────────────────────────────── */}
      <nav className="flex flex-col gap-1 px-2 pt-4">
        {navItems.map((item) => {
          const isActive = activeTab === item.tabId;
          return (
          <button
            key={item.label}
            onClick={() => setActiveTab(item.tabId)}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5",
              "transition-all duration-200",
              collapsed && "justify-center px-0",
            )}
            style={{
              background: isActive ? "rgba(0, 212, 255, 0.08)" : "transparent",
              color: isActive ? "var(--neon-blue)" : "var(--text-secondary)",
            }}
          >
            {/* Active indicator bar */}
            {isActive && (
              <motion.div
                layoutId="sidebar-active"
                className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full"
                style={{ background: "var(--neon-blue)", boxShadow: "0 0 10px rgba(0, 212, 255, 0.5)" }}
                transition={{ type: "spring", stiffness: 350, damping: 28 }}
              />
            )}

            <item.icon size={18} strokeWidth={1.8} className="shrink-0 transition-colors duration-200 group-hover:text-[var(--neon-blue)]" />

            {!collapsed && (
              <span className="text-sm font-medium transition-colors duration-200 group-hover:text-[var(--text-primary)]">
                {item.label}
              </span>
            )}
          </button>
          );
        })}
      </nav>

      {/* ── Divider ───────────────────────────────── */}
      <div className="neon-divider mx-4 my-4" />

      {/* ── Keyword Manager ───────────────────────── */}
      {!collapsed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-hidden"
        >
          <KeywordManager />
        </motion.div>
      )}

      {/* ── Collapse toggle ───────────────────────── */}
      <div className="border-t px-2 py-3" style={{ borderColor: "var(--glass-border)" }}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center rounded-lg py-2 transition-colors duration-200 hover:bg-[rgba(255,255,255,0.05)]"
          style={{ color: "var(--text-muted)" }}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </motion.aside>
  );
}
