"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radar, Sparkles, Zap, Brain, Loader2, CheckCircle2, Newspaper, ArrowRight, AlertTriangle, RotateCcw } from "lucide-react";

interface ProgressEvent {
  type: string;
  keyword: string | null;
  message: string;
  currentStep: number;
  totalSteps: number;
  percentage: number;
  count: number | null;
}

interface OnboardingViewProps {
  onComplete: () => void;
  initialError?: string | null;
}

type Phase = "welcome" | "collecting" | "done" | "error";

export default function OnboardingView({ onComplete, initialError }: OnboardingViewProps) {
  const [phase, setPhase] = useState<Phase>(initialError ? "error" : "welcome");
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState(initialError || "");
  const [currentKeyword, setCurrentKeyword] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  const resetState = useCallback(() => {
    setProgress(0);
    setStatusMsg("");
    setErrorMsg("");
    setCurrentKeyword(null);
    setSavedCount(0);
    setPhase("welcome");
  }, []);

  const handleStart = useCallback(() => {
    setPhase("collecting");
    setProgress(0);
    setSavedCount(0);
    setStatusMsg("초기화 요청 중...");

    fetch("/api/system/initialize", { method: "POST" })
      .then(async (res) => {
        if (!res.ok || !res.body) {
          // 응답 본문에서 실제 에러 메시지 추출
          let detail = "";
          try {
            const body = await res.json();
            detail = body.error || "";
          } catch { /* ignore */ }

          if (res.status === 401 || res.status === 403) {
            throw new Error("인증이 만료되었습니다. 페이지를 새로고침하고 다시 로그인해 주세요.");
          }
          if (res.status === 502) {
            throw new Error("백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해 주세요.");
          }
          throw new Error(detail || `서버 오류가 발생했습니다. (${res.status})`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        function pump(): Promise<void> {
          return reader.read().then(({ done, value }) => {
            if (done) {
              setPhase((prev) => (prev === "collecting" ? "done" : prev));
              return;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data:")) continue;
              const json = line.slice(5).trim();
              if (!json) continue;
              try {
                const evt: ProgressEvent = JSON.parse(json);
                if (evt.percentage >= 0) setProgress(evt.percentage);
                setStatusMsg(evt.message);
                if (evt.keyword) setCurrentKeyword(evt.keyword);
                if (evt.count && evt.count > 0) {
                  setSavedCount((prev) => prev + evt.count!);
                }
                if (evt.type === "COMPLETED") {
                  setPhase("done");
                }
                if (evt.type === "ERROR") {
                  setErrorMsg(evt.message);
                  setPhase("error");
                }
              } catch {
                // skip malformed data
              }
            }
            return pump();
          });
        }

        return pump();
      })
      .catch((err: Error) => {
        setErrorMsg(err.message || "서버 연결에 실패했습니다. 백엔드 서버가 실행 중인지 확인해 주세요.");
        setPhase("error");
      });
  }, []);

  // Auto-transition to dashboard after "done" phase
  useEffect(() => {
    if (phase === "done") {
      const timer = setTimeout(onComplete, 2500);
      return () => clearTimeout(timer);
    }
  }, [phase, onComplete]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="onboarding"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
        style={{ background: "var(--bg-primary)" }}
      >
        {/* Ambient background effects */}
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              width: "120vw",
              height: "120vh",
              background:
                "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(0,212,255,0.08) 0%, transparent 60%), " +
                "radial-gradient(ellipse 50% 40% at 30% 70%, rgba(168,85,247,0.06) 0%, transparent 55%), " +
                "radial-gradient(ellipse 40% 35% at 70% 30%, rgba(0,212,255,0.04) 0%, transparent 50%)",
            }}
          />
          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(0,212,255,0.5) 1px, transparent 1px), " +
                "linear-gradient(90deg, rgba(0,212,255,0.5) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        {/* Main content */}
        <div className="relative z-10 flex flex-col items-center px-6 text-center">
          <AnimatePresence mode="wait">
            {phase === "welcome" && <WelcomePhase key="welcome" onStart={handleStart} />}
            {phase === "collecting" && (
              <CollectingPhase
                key="collecting"
                progress={progress}
                statusMsg={statusMsg}
                currentKeyword={currentKeyword}
                savedCount={savedCount}
              />
            )}
            {phase === "error" && <ErrorPhase key="error" message={errorMsg} onRetry={resetState} />}
            {phase === "done" && <DonePhase key="done" savedCount={savedCount} onEnter={onComplete} />}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Welcome Phase ── //
function WelcomePhase({ onStart }: { onStart: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="flex flex-col items-center"
    >
      {/* Logo / Icon */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        className="mb-8 flex h-24 w-24 items-center justify-center rounded-3xl"
        style={{
          background: "linear-gradient(135deg, rgba(0,212,255,0.12), rgba(168,85,247,0.12))",
          border: "1px solid rgba(0,212,255,0.2)",
          boxShadow: "0 0 60px rgba(0,212,255,0.15), 0 0 120px rgba(168,85,247,0.08)",
        }}
      >
        <Radar size={44} className="text-[var(--neon-blue)]" />
      </motion.div>

      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="mb-3 text-4xl font-bold tracking-tight"
      >
        <span className="text-gradient-neon">News Intelligence Radar</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="mb-2 text-lg text-[var(--text-secondary)]"
      >
        AI 기반 뉴스 수집 및 분석 플랫폼에 오신 것을 환영합니다
      </motion.p>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="mb-10 max-w-md text-sm leading-relaxed text-[var(--text-muted)]"
      >
        최신 AI, LLM, 테크 뉴스를 자동으로 수집하고 중요도를 분석합니다.
        <br />
        아래 버튼을 눌러 기본 키워드로 첫 뉴스를 수집해 보세요.
      </motion.p>

      {/* Default keyword pills */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.65 }}
        className="mb-8 flex flex-wrap justify-center gap-3"
      >
        {["AI", "OpenAI", "LLM", "Google"].map((kw, i) => (
          <motion.span
            key={kw}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7 + i * 0.08 }}
            className="rounded-full px-4 py-1.5 text-sm font-medium"
            style={{
              background: i % 2 === 0 ? "rgba(0,212,255,0.08)" : "rgba(168,85,247,0.08)",
              border: `1px solid ${i % 2 === 0 ? "rgba(0,212,255,0.2)" : "rgba(168,85,247,0.2)"}`,
              color: i % 2 === 0 ? "var(--neon-blue)" : "var(--neon-purple)",
            }}
          >
            {kw}
          </motion.span>
        ))}
      </motion.div>

      {/* CTA Button */}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, type: "spring", stiffness: 200 }}
        whileHover={{ scale: 1.03, boxShadow: "0 0 40px rgba(0,212,255,0.25), 0 0 80px rgba(168,85,247,0.12)" }}
        whileTap={{ scale: 0.97 }}
        onClick={onStart}
        className="group relative flex items-center gap-3 rounded-2xl px-8 py-4 text-lg font-bold text-white transition-all"
        style={{
          background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(168,85,247,0.2))",
          border: "1px solid rgba(0,212,255,0.3)",
          boxShadow: "0 0 30px rgba(0,212,255,0.15), 0 0 60px rgba(168,85,247,0.08)",
        }}
      >
        <Sparkles size={22} className="text-[var(--neon-blue)]" />
        기본 키워드로 뉴스 수집 시작하기
        <ArrowRight
          size={20}
          className="text-[var(--text-muted)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--neon-blue)]"
        />
      </motion.button>

      {/* Feature hints */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1 }}
        className="mt-12 flex gap-8 text-xs text-[var(--text-muted)]"
      >
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-[var(--neon-blue)]" />
          실시간 수집
        </div>
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-[var(--neon-purple)]" />
          AI 중요도 분석
        </div>
        <div className="flex items-center gap-2">
          <Newspaper size={14} className="text-[var(--neon-blue)]" />
          자동 브리핑
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Collecting Phase ── //
function CollectingPhase({
  progress,
  statusMsg,
  currentKeyword,
  savedCount,
}: {
  progress: number;
  statusMsg: string;
  currentKeyword: string | null;
  savedCount: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
      className="flex w-full max-w-lg flex-col items-center"
    >
      {/* Spinning radar icon */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        className="mb-8 flex h-20 w-20 items-center justify-center rounded-full"
        style={{
          background: "linear-gradient(135deg, rgba(0,212,255,0.1), rgba(168,85,247,0.1))",
          border: "1px solid rgba(0,212,255,0.2)",
          boxShadow: "0 0 40px rgba(0,212,255,0.12)",
        }}
      >
        <Radar size={36} className="text-[var(--neon-blue)]" />
      </motion.div>

      <h2 className="mb-2 text-2xl font-bold text-[var(--text-primary)]">
        뉴스를 수집하고 있습니다
      </h2>
      <p className="mb-8 text-sm text-[var(--text-muted)]">
        최초 뉴스를 수집 및 분석하고 있습니다. 잠시만 기다려 주세요...
      </p>

      {/* Progress bar */}
      <div className="mb-4 w-full overflow-hidden rounded-full" style={{ height: 6, background: "rgba(255,255,255,0.06)" }}>
        <motion.div
          className="h-full rounded-full"
          style={{
            background: "linear-gradient(90deg, var(--neon-blue), var(--neon-purple))",
            boxShadow: "0 0 12px rgba(0,212,255,0.4)",
          }}
          initial={{ width: "0%" }}
          animate={{ width: `${Math.max(progress, 2)}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      {/* Progress percentage */}
      <div className="mb-6 flex w-full items-center justify-between text-xs text-[var(--text-muted)]">
        <span>{progress}%</span>
        {currentKeyword && (
          <span className="flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin text-[var(--neon-blue)]" />
            {currentKeyword}
          </span>
        )}
        <span>{savedCount}건 저장</span>
      </div>

      {/* Status message */}
      <motion.div
        key={statusMsg}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-xl px-5 py-3 text-sm text-[var(--text-secondary)]"
      >
        {statusMsg}
      </motion.div>
    </motion.div>
  );
}

// ── Done Phase ── //
function DonePhase({ savedCount, onEnter }: { savedCount: number; onEnter: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col items-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, delay: 0.1 }}
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-full"
        style={{
          background: "rgba(34,197,94,0.1)",
          border: "1px solid rgba(34,197,94,0.25)",
          boxShadow: "0 0 40px rgba(34,197,94,0.15)",
        }}
      >
        <CheckCircle2 size={40} className="text-emerald-400" />
      </motion.div>

      <h2 className="mb-2 text-2xl font-bold text-[var(--text-primary)]">
        설정 완료!
      </h2>
      <p className="mb-4 text-sm text-[var(--text-muted)]">
        총 <span className="font-semibold text-[var(--neon-blue)]">{savedCount}건</span>의 뉴스가
        수집 및 분석되었습니다.
      </p>
      <p className="mb-8 text-xs text-[var(--text-muted)]">
        잠시 후 대시보드로 이동합니다...
      </p>

      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onEnter}
        className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white"
        style={{
          background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(168,85,247,0.2))",
          border: "1px solid rgba(0,212,255,0.3)",
        }}
      >
        대시보드로 바로 이동
        <ArrowRight size={16} />
      </motion.button>
    </motion.div>
  );
}

// ── Error Phase ── //
function ErrorPhase({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col items-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, delay: 0.1 }}
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-full"
        style={{
          background: "rgba(239,68,68,0.1)",
          border: "1px solid rgba(239,68,68,0.25)",
          boxShadow: "0 0 40px rgba(239,68,68,0.15)",
        }}
      >
        <AlertTriangle size={36} className="text-red-400" />
      </motion.div>

      <h2 className="mb-2 text-2xl font-bold text-[var(--text-primary)]">
        연결 오류
      </h2>
      <p className="mb-6 max-w-md text-sm text-[var(--text-muted)]">
        {message}
      </p>

      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onRetry}
        className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white"
        style={{
          background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(168,85,247,0.2))",
          border: "1px solid rgba(0,212,255,0.3)",
        }}
      >
        <RotateCcw size={16} />
        다시 시도하기
      </motion.button>
    </motion.div>
  );
}
