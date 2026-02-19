"use client";

import { ReactNode } from "react";
import { Sidebar } from "@/components/layout";
import Header from "@/components/layout/Header";

interface DashboardLayoutProps {
  stats?: ReactNode;
  children: ReactNode;
}

export default function DashboardLayout({ stats, children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* ── Left: Sidebar ── */}
      <Sidebar />

      {/* ── Right: Main area ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <Header />

        {/* Stats bar (top of main area) */}
        {stats && (
          <div
            className="shrink-0 border-b px-6 py-4"
            style={{ borderColor: "var(--glass-border)" }}
          >
            {stats}
          </div>
        )}

        {/* Central content area */}
        <main className="relative flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
