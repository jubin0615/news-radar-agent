"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Newspaper, Sparkles, ArrowRight, Radio } from "lucide-react";

function isMorningBriefingAvailable(): boolean {
  return new Date().getHours() >= 9;
}

function getTodaySeenKey(): string {
  const today = new Date().toISOString().split("T")[0];
  return `morning-brief-seen-${today}`;
}

interface WelcomeModalProps {
  onEnter?: () => void;
}

export default function WelcomeModal({ onEnter }: WelcomeModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const key = getTodaySeenKey();
    if (!localStorage.getItem(key) && isMorningBriefingAvailable()) {
      // Small delay so the dashboard loads first
      const t = setTimeout(() => setVisible(true), 300);
      return () => clearTimeout(t);
    }
  }, []);

  function handleEnter() {
    localStorage.setItem(getTodaySeenKey(), "true");
    setVisible(false);
    onEnter?.();
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="welcome-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(6, 8, 15, 0.90)", backdropFilter: "blur(16px)" }}
        >
          {/* Ambient glow orbs */}
          <div
            className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, rgba(0,212,255,0.5) 0%, transparent 70%)" }}
          />
          <div
            className="pointer-events-none absolute -bottom-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full opacity-15"
            style={{ background: "radial-gradient(circle, rgba(168,85,247,0.6) 0%, transparent 70%)" }}
          />

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.86, y: 32 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="glass relative flex flex-col items-center gap-8 overflow-hidden rounded-3xl px-12 py-14 text-center"
            style={{
              maxWidth: 480,
              width: "calc(100vw - 48px)",
              boxShadow:
                "0 0 0 1px rgba(0,212,255,0.15), 0 0 80px rgba(0,212,255,0.12), 0 40px 80px rgba(0,0,0,0.5)",
            }}
          >
            {/* Top edge glow */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(0,212,255,0.7), rgba(168,85,247,0.7), transparent)",
              }}
            />

            {/* Icon cluster */}
            <div className="relative">
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
                className="flex h-24 w-24 items-center justify-center rounded-2xl"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(0,212,255,0.14), rgba(168,85,247,0.14))",
                  border: "1px solid rgba(0,212,255,0.25)",
                  boxShadow: "0 0 40px rgba(0,212,255,0.18)",
                }}
              >
                <Newspaper size={40} strokeWidth={1.4} style={{ color: "var(--neon-blue)" }} />
              </motion.div>

              {/* Sparkle badge */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.45, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full"
                style={{
                  background: "rgba(168,85,247,0.20)",
                  border: "1px solid rgba(168,85,247,0.50)",
                  boxShadow: "0 0 12px rgba(168,85,247,0.30)",
                }}
              >
                <Sparkles size={14} style={{ color: "#c084fc" }} />
              </motion.div>

              {/* Live dot */}
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5], scale: [0.9, 1.1, 0.9] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -bottom-1 -left-1 flex h-6 w-6 items-center justify-center rounded-full"
                style={{
                  background: "rgba(239,68,68,0.15)",
                  border: "1px solid rgba(239,68,68,0.45)",
                }}
              >
                <Radio size={11} style={{ color: "#f87171" }} />
              </motion.div>
            </div>

            {/* Text content */}
            <div className="flex flex-col gap-3">
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.4 }}
                className="text-[11px] font-bold uppercase tracking-[0.2em]"
                style={{ color: "var(--neon-blue)" }}
              >
                Morning Intelligence Report
              </motion.p>

              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.4 }}
                className="text-2xl font-bold leading-snug"
                style={{ color: "var(--text-primary)" }}
              >
                오늘의 인텔리전스
                <br />
                리포트가 완성되었습니다
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.4 }}
                className="text-sm leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                오늘 오전 9시, AI 레이더가 핵심 이슈를 포착했습니다.
                <br />
                지금 바로 오늘의 브리핑을 확인하세요.
              </motion.p>
            </div>

            {/* CTA Button */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65, duration: 0.4 }}
              onClick={handleEnter}
              whileHover={{ scale: 1.04, boxShadow: "0 0 28px rgba(0,212,255,0.25)" }}
              whileTap={{ scale: 0.97 }}
              className="group flex items-center gap-2.5 rounded-xl px-8 py-3.5 text-sm font-bold transition-all duration-200"
              style={{
                background:
                  "linear-gradient(135deg, rgba(0,212,255,0.18), rgba(168,85,247,0.18))",
                border: "1px solid rgba(0,212,255,0.35)",
                color: "var(--neon-blue)",
                boxShadow: "0 0 20px rgba(0,212,255,0.12)",
              }}
            >
              오늘의 브리핑 보기
              <ArrowRight
                size={16}
                strokeWidth={2.5}
                className="transition-transform duration-200 group-hover:translate-x-1"
              />
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
