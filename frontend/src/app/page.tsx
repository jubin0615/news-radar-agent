"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { AgUiWrapper } from "@/components/generative";

// ── Page ─────────────────────────────────────────────────────── //
export default function Home() {
  return (
    <DashboardLayout>
      {/* AG-UI 채팅 인터페이스 */}
      <AgUiWrapper className="h-full" />
    </DashboardLayout>
  );
}
