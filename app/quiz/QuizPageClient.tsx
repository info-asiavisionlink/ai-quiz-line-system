"use client";

import { useCallback, useEffect, useState } from "react";
import {
  emptyQuizState,
  type QuizQuestion,
  type QuizResultRow,
  type QuizStateShape,
  type WebhookPayload,
} from "@/lib/types/quiz";
import { formatDateTimeJST } from "@/lib/quiz-helpers";

const PASS_SCORE = 60;
const POINTS_PER_QUESTION = 10;
const TOTAL_QUESTIONS = 10;

type ApiGenerateOk = { ok: true; quiz: QuizQuestion[]; meta?: { count: number } };
type ApiGenerateErr = { ok: false; error: string };
type ApiGenerate = ApiGenerateOk | ApiGenerateErr;

export default function QuizPageClient() {
  console.log("[QuizPageClient] render");

  const [state, setState] = useState<QuizStateShape>(() => emptyQuizState());
  const { quiz, answers, result, score, isFinished } = state;

  const [loadState, setLoadState] = useState<"idle" | "loading" | "error" | "ready">(
    "idle"
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultDate, setResultDate] = useState<string | null>(null);
  const [userId, setUserId] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("userId");

      console.log("FULL URL:", window.location.href);
      console.log("USER ID DETECTED:", id);

      if (id) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUserId(id);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadState("loading");
      setLoadError(null);
      console.log("[Quiz] fetch /api/quiz/generate");
      try {
        const res = await fetch("/api/quiz/generate", { cache: "no-store" });
        const data: ApiGenerate = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          const msg =
            !data.ok && "error" in data
              ? data.error
              : `HTTP ${res.status}`;
          setLoadError(msg);
          setLoadState("error");
          return;
        }
        if (!data.quiz || !Array.isArray(data.quiz) || data.quiz.length === 0) {
          setLoadError("クイズデータが空です");
          setLoadState("error");
          return;
        }
        setState({
          ...emptyQuizState(),
          quiz: data.quiz,
        });
        setResultDate(null);
        setSubmitError(null);
        setLoadState("ready");
        console.log("[Quiz] loaded questions", data.quiz.length);
      } catch (e) {
        if (cancelled) return;
        console.log("[Quiz] load error", e);
        setLoadError(
          e instanceof Error ? e.message : "通信エラーが発生しました"
        );
        setLoadState("error");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectOption = useCallback((index: number, option: string) => {
    setState((prev) => ({
      ...prev,
      answers: { ...prev.answers, [index]: option },
    }));
  }, []);

  const buildResults = useCallback((): {
    rows: QuizResultRow[];
    score: number;
    correctCount: number;
  } | null => {
    if (quiz.length !== TOTAL_QUESTIONS) {
      setSubmitError("問題数が不正です");
      return null;
    }
    const unanswered: number[] = [];
    for (let i = 0; i < TOTAL_QUESTIONS; i++) {
      const a = answers[i];
      if (a == null || String(a).trim() === "") unanswered.push(i + 1);
    }
    if (unanswered.length > 0) {
      setSubmitError(
        `未回答の問題があります: ${unanswered.join(", ")} 問目`
      );
      console.log("[Quiz] unanswered", unanswered);
      return null;
    }

    const rows: QuizResultRow[] = [];
    let correctCount = 0;
    for (let i = 0; i < quiz.length; i++) {
      const q = quiz[i];
      if (!q) continue;
      const userAnswer = answers[i] ?? "";
      const isCorrect = userAnswer.trim() === q.answer.trim();
      if (isCorrect) correctCount += 1;
      rows.push({
        question: q.question,
        userAnswer,
        correctAnswer: q.answer,
        isCorrect,
        explanation: q.explanation,
      });
    }
    const computedScore = correctCount * POINTS_PER_QUESTION;
    return { rows, score: computedScore, correctCount };
  }, [answers, quiz]);

  const handleShowResults = useCallback(async () => {
    setSubmitError(null);
    if (!userId) {
      setSubmitError("userId がありません。LINEのURLから再アクセスしてください。");
      return;
    }
    const built = buildResults();
    if (!built) return;

    const jst = formatDateTimeJST();
    setResultDate(jst);
    setState((prev) => ({
      ...prev,
      result: built.rows,
      score: built.score,
      isFinished: true,
    }));

    const payload: WebhookPayload = {
      userId,
      score: built.score,
      answers,
    };

    console.log("[Quiz] webhook payload", payload);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/quiz/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data: unknown = await res.json().catch(() => ({}));
      console.log("[Quiz] webhook response", res.status, data);
      if (!res.ok) {
        const err =
          typeof data === "object" &&
          data != null &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : `Webhook エラー (${res.status})`;
        setSubmitError(err);
      }
    } catch (e) {
      console.log("[Quiz] webhook fetch error", e);
      setSubmitError(
        e instanceof Error ? e.message : "Webhook 送信に失敗しました"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [answers, buildResults, userId]);

  const handleRetest = useCallback(() => {
    console.log("[Quiz] retest — reload");
    window.location.reload();
  }, []);

  const handleClose = useCallback(() => {
    console.log("[Quiz] close");
    window.close();
    // LINE 内ブラウザ等で window.close が効かない場合のフォールバック
    setTimeout(() => {
      if (typeof window !== "undefined" && window.history.length > 1) {
        window.history.back();
      }
    }, 100);
  }, []);

  const passed = score >= PASS_SCORE;

  if (loadState === "loading" || loadState === "idle") {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 py-8">
        <p className="text-lg text-zinc-600">クイズ生成中...</p>
      </div>
    );
  }

  if (loadState === "error" && loadError) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 px-4 py-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800 shadow-sm">
          <h1 className="text-xl font-bold">読み込みエラー</h1>
          <p className="mt-2 font-medium">クイズ生成中...</p>
          <p className="mt-2">{loadError}</p>
        </div>
        <button
          type="button"
          className="rounded-xl bg-zinc-900 px-6 py-4 text-lg font-semibold text-white active:bg-zinc-800"
          onClick={() => window.location.reload()}
        >
          再読み込み
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 py-6 pb-32">
      <header className="mb-6 rounded-2xl bg-white p-5 shadow-md ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <h1 className="text-2xl font-bold tracking-tight">4択クイズ（10問）</h1>
        <p className="mt-1 text-sm text-zinc-500">
          1問10点・100点満点 / 60点以上 → 合格
        </p>
        <p className="mt-2 text-xs text-zinc-400">userId: {userId || "(empty)"}</p>
        {!userId && (
          <p style={{ color: "red" }}>
            userId 未指定（LINEのURLからアクセスしてください）
          </p>
        )}
      </header>

      <ol className="flex flex-col gap-5">
        {quiz.map((q, idx) => (
          <li key={`${idx}-${q.question.slice(0, 12)}`}>
            <section className="rounded-2xl bg-white p-5 shadow-md ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
              <p className="text-sm font-medium text-zinc-500">問題 {idx + 1}</p>
              <h2 className="mt-2 text-lg font-semibold leading-snug">
                {q.question}
              </h2>
              <div className="mt-4 flex flex-col gap-3">
                {q.options.map((opt) => {
                  const selected = answers[idx] === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => selectOption(idx, opt)}
                      className={`min-h-[52px] rounded-xl border-2 px-4 py-3 text-left text-base font-medium transition-colors ${
                        selected
                          ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
                          : "border-zinc-200 bg-zinc-50 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </section>
          </li>
        ))}
      </ol>

      {/* 結果ブロック */}
      {isFinished && result.length > 0 && (
        <section className="mt-8 rounded-2xl bg-white p-6 shadow-md ring-2 ring-emerald-200 dark:bg-zinc-900 dark:ring-emerald-900">
          <h2 className="text-xl font-bold">試験結果</h2>
          {resultDate && (
            <p className="mt-1 text-sm text-zinc-500">{resultDate}</p>
          )}
          <p className="mt-4 text-4xl font-extrabold tabular-nums">
            {score}
            <span className="text-2xl font-bold">点</span>
          </p>
          <p className="mt-2 text-lg font-semibold">
            {passed ? "クリア" : "再テストしてください"}
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            正解数 {result.filter((r) => r.isCorrect).length} / {TOTAL_QUESTIONS}
          </p>

          <ul className="mt-6 flex max-h-[60vh] flex-col gap-4 overflow-y-auto rounded-xl bg-zinc-50 p-4 dark:bg-zinc-950">
            {result.map((r, i) => (
              <li
                key={i}
                className="rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <p className="font-semibold text-zinc-800 dark:text-zinc-100">
                  Q{i + 1}. {r.question}
                </p>
                <p className="mt-2">
                  <span className="text-zinc-500">あなたの回答: </span>
                  {r.userAnswer || "—"}
                </p>
                <p className="mt-1">
                  <span className="text-zinc-500">正解: </span>
                  {r.correctAnswer}
                </p>
                <p className="mt-2 font-medium">
                  {r.isCorrect ? (
                    <span className="text-emerald-600">正解</span>
                  ) : (
                    <span className="text-red-600">不正解</span>
                  )}
                </p>
                <p className="mt-2 text-zinc-600">
                  <span className="font-medium text-zinc-700">解説: </span>
                  {r.explanation}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {submitError && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          {submitError}
        </div>
      )}

      {/* 固定フッター CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-zinc-200 bg-white/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="mx-auto flex max-w-lg flex-col gap-3">
          {!isFinished && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleShowResults()}
              className="w-full rounded-2xl bg-emerald-600 py-4 text-lg font-bold text-white shadow-lg active:bg-emerald-700 disabled:opacity-60"
            >
              {isSubmitting ? "送信中…" : "結果を見る"}
            </button>
          )}
          {isFinished && passed && (
            <button
              type="button"
              onClick={handleClose}
              className="w-full rounded-2xl bg-zinc-900 py-4 text-lg font-bold text-white active:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
            >
              閉じる
            </button>
          )}
          {isFinished && !passed && (
            <button
              type="button"
              onClick={handleRetest}
              className="w-full rounded-2xl bg-orange-600 py-4 text-lg font-bold text-white shadow-lg active:bg-orange-700"
            >
              再テスト
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
