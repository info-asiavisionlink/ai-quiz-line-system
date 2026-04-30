import { Suspense } from "react";
import QuizPageClient from "./QuizPageClient";

export default function QuizPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 py-8">
          <p className="text-lg text-zinc-600">クイズ生成中...</p>
        </div>
      }
    >
      <QuizPageClient />
    </Suspense>
  );
}
