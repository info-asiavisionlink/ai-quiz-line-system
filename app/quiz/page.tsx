import { Suspense } from "react";
import { QuizPageClient } from "@/app/quiz/QuizPageClient";

export default function QuizPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-4">
          <p className="text-zinc-500">準備中…</p>
        </div>
      }
    >
      <QuizPageClient />
    </Suspense>
  );
}
