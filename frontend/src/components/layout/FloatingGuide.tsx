"use client";

import { useState } from "react";
import { Bot, X, Hash, Newspaper, MessageSquare, Sparkles, BookOpen, CircleHelp, Archive, Trash2, Zap } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

type Tab = "guide" | "faq";

export default function FloatingGuide() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("guide");

  return (
    <>
      {/* Floating Button & Speech Bubble */}
      <motion.div
        className="fixed bottom-8 right-8 z-50 flex flex-row items-center gap-3"
        animate={{ y: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
      >
        <AnimatePresence>
          {!isOpen && (
            <motion.div
              initial={{ opacity: 0, x: 10, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative rounded-xl border border-[rgba(0,212,255,0.25)] bg-[rgba(255,255,255,0.04)] px-4 py-2.5 shadow-lg backdrop-blur-xl"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, rgba(0,212,255,0.08), rgba(168,85,247,0.06))",
                boxShadow:
                  "0 0 20px rgba(0,212,255,0.08), inset 0 0 20px rgba(255,255,255,0.02)",
              }}
            >
              <span
                className="text-sm font-medium text-[var(--text-primary)]"
                style={{ textShadow: "0 0 12px rgba(0,212,255,0.4)" }}
              >
                에이전트 이용 가이드
              </span>
              {/* Triangle pointer */}
              <div
                className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border-r border-t border-[rgba(0,212,255,0.25)]"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(0,212,255,0.08), rgba(168,85,247,0.06))",
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Button wrapper with glow layer */}
        <div className="relative">
          {/* Glow / pulse layer (behind button) */}
          <div
            className="absolute inset-0 animate-pulse rounded-full"
            style={{
              background:
                "linear-gradient(135deg, #22d3ee, #6366f1, #a855f7)",
              filter: "blur(12px)",
              opacity: 0.5,
            }}
          />
          {/* Main button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.93 }}
            onClick={() => setIsOpen(true)}
            className="relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg"
            style={{
              background:
                "linear-gradient(135deg, #22d3ee, #3b82f6, #a855f7)",
              boxShadow:
                "0 0 24px rgba(0,212,255,0.35), 0 0 48px rgba(168,85,247,0.15)",
            }}
          >
            <Sparkles size={26} />
          </motion.button>
        </div>
      </motion.div>

      {/* Modal Overlay */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[#0a0a0f] p-8 shadow-2xl md:p-10"
            >
              <button
                onClick={() => setIsOpen(false)}
                className="absolute right-6 top-6 rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--glass-bg)] hover:text-[var(--text-primary)]"
              >
                <X size={20} />
              </button>

              {/* Header */}
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(0,212,255,0.1)] text-[var(--neon-blue)]">
                  <Bot size={24} />
                </div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">
                  에이전트 이용 가이드
                </h2>
              </div>

              {/* Tabs */}
              <div className="mb-6 flex gap-2 border-b border-[var(--glass-border)]">
                <button
                  onClick={() => setActiveTab("guide")}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                    activeTab === "guide"
                      ? "border-b-2 border-[var(--neon-blue)] text-[var(--neon-blue)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <BookOpen size={16} />
                  시작 가이드
                </button>
                <button
                  onClick={() => setActiveTab("faq")}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                    activeTab === "faq"
                      ? "border-b-2 border-[var(--neon-purple)] text-[var(--neon-purple)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <CircleHelp size={16} />
                  상황별 추천 FAQ
                </button>
              </div>

              {/* Tab Content */}
              <AnimatePresence mode="wait">
                {activeTab === "guide" ? (
                  <motion.div
                    key="guide"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="grid gap-6 md:grid-cols-3"
                  >
                    {/* Step 1 */}
                    <div className="group relative overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 transition-all hover:border-[var(--neon-blue)] hover:bg-[rgba(0,212,255,0.03)]">
                      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[rgba(0,212,255,0.1)] text-[var(--neon-blue)]">
                        <Hash size={20} />
                      </div>
                      <h4 className="mb-3 text-lg font-bold text-[var(--text-primary)]">
                        1. 키워드 등록
                      </h4>
                      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                        사이드바의 <strong>키워드 관리</strong>에서 관심 주제를 등록하면,
                        수집기가 해당 키워드를 기준으로 뉴스를 찾습니다.
                      </p>
                    </div>

                    {/* Step 2 */}
                    <div className="group relative overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 transition-all hover:border-[var(--neon-purple)] hover:bg-[rgba(168,85,247,0.03)]">
                      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[rgba(168,85,247,0.1)] text-[var(--neon-purple)]">
                        <Newspaper size={20} />
                      </div>
                      <h4 className="mb-3 text-lg font-bold text-[var(--text-primary)]">
                        2. 뉴스 수집
                      </h4>
                      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                        <strong>뉴스 수집</strong> 탭에서 <strong>뉴스 수집 시작</strong> 버튼을 눌러
                        최신 뉴스를 가져오고 중요도를 분석합니다.
                      </p>
                    </div>

                    {/* Step 3 */}
                    <div className="group relative overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 transition-all hover:border-[#10b981] hover:bg-[rgba(16,185,129,0.03)]">
                      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[rgba(16,185,129,0.1)] text-[#10b981]">
                        <MessageSquare size={20} />
                      </div>
                      <h4 className="mb-3 text-lg font-bold text-[var(--text-primary)]">
                        3. AI 리포트
                      </h4>
                      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                        <strong>AI 채팅</strong>에서 리포트를 생성한 뒤 궁금한 점을 질문해보세요.
                        기사 기반(RAG)으로 관련 내용을 찾아 분석 답변을 제공합니다.
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="faq"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col gap-4"
                  >
                    {/* FAQ 1 — Archive */}
                    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-5 transition-all hover:border-[var(--neon-purple)] hover:bg-[rgba(168,85,247,0.03)]">
                      <div className="mb-3 flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgba(168,85,247,0.1)] text-[var(--neon-purple)]">
                          <Archive size={16} />
                        </div>
                        <p className="text-sm font-semibold leading-relaxed text-[var(--text-primary)]">
                          Q. 관심이 식은 키워드가 있는데, 나중에 다시 볼 수도 있을 것 같아요.
                        </p>
                      </div>
                      <p className="ml-11 text-sm leading-relaxed text-[var(--text-secondary)]">
                        👉 <strong className="text-[var(--neon-purple)]">아카이브</strong>를 추천해요!
                        언제든 다시 &apos;활성화&apos;로 돌려놓을 수 있거든요.
                      </p>
                    </div>

                    {/* FAQ 2 — Delete */}
                    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-5 transition-all hover:border-[#f43f5e] hover:bg-[rgba(244,63,94,0.03)]">
                      <div className="mb-3 flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgba(244,63,94,0.1)] text-[#f43f5e]">
                          <Trash2 size={16} />
                        </div>
                        <p className="text-sm font-semibold leading-relaxed text-[var(--text-primary)]">
                          Q. 단어 스펠링을 아예 잘못 입력했어요.
                        </p>
                      </div>
                      <p className="ml-11 text-sm leading-relaxed text-[var(--text-secondary)]">
                        👉 미련 없이 <strong className="text-[#f43f5e]">삭제</strong>를 누르고
                        새로 등록해 주세요!
                      </p>
                    </div>

                    {/* FAQ 3 — Active */}
                    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-5 transition-all hover:border-[#10b981] hover:bg-[rgba(16,185,129,0.03)]">
                      <div className="mb-3 flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgba(16,185,129,0.1)] text-[#10b981]">
                          <Zap size={16} />
                        </div>
                        <p className="text-sm font-semibold leading-relaxed text-[var(--text-primary)]">
                          Q. 요즘 가장 핫한 기술 트렌드라 매일매일 흐름을 놓치고 싶지 않아요.
                        </p>
                      </div>
                      <p className="ml-11 text-sm leading-relaxed text-[var(--text-secondary)]">
                        👉 무조건 <strong className="text-[#10b981]">활성화</strong>를 켜두고
                        에이전트의 브리핑을 받아보세요.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
