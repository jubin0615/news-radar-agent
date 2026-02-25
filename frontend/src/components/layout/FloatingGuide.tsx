"use client";

import { useState } from "react";
import { Bot, X, Hash, Newspaper, MessageSquare, HelpCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export default function FloatingGuide() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Button & Speech Bubble */}
      <div className="fixed bottom-8 right-8 z-50 flex flex-row items-center gap-3">
        <AnimatePresence>
          {!isOpen && (
            <motion.div
              initial={{ opacity: 0, x: 10, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative rounded-xl border border-[var(--glass-border)] bg-[rgba(255,255,255,0.08)] px-4 py-2.5 shadow-lg backdrop-blur-md"
            >
              <span className="text-sm font-medium text-[var(--text-primary)]">
                에이전트 이용 가이드
              </span>
              {/* Triangle pointer (right side, pointing toward button) */}
              <div className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border-r border-t border-[var(--glass-border)] bg-[rgba(255,255,255,0.08)]"></div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--neon-blue)] text-black shadow-[0_0_20px_rgba(0,212,255,0.3)] transition-colors hover:bg-[#33e0ff]"
        >
          <HelpCircle size={28} />
        </motion.button>
      </div>

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

              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(0,212,255,0.1)] text-[var(--neon-blue)]">
                  <Bot size={24} />
                </div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">
                  에이전트 이용 가이드
                </h2>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
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
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
