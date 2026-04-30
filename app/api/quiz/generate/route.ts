import { NextResponse } from "next/server";
import {
  buildQuizFromJapaneseRows,
  parseJapaneseQuizRow,
} from "@/lib/quiz-helpers";

export const dynamic = "force-dynamic";

const QUESTION_COUNT = 10;

function getSheetUrl(): string | null {
  const id = process.env.QUIZ_SPREADSHEET_ID?.trim();
  if (!id) return null;
  const tab = process.env.QUIZ_SHEET_TAB?.trim() || "Sheet1";
  return `https://opensheet.elk.sh/${id}/${encodeURIComponent(tab)}`;
}

export async function GET() {
  console.log("[api/quiz/generate] GET start");

  const url = getSheetUrl();
  if (!url) {
    console.log("[api/quiz/generate] QUIZ_SPREADSHEET_ID missing");
    return NextResponse.json(
      {
        ok: false,
        error: "環境変数 QUIZ_SPREADSHEET_ID が設定されていません。",
      },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(url, {
      next: { revalidate: 0 },
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      console.log("[api/quiz/generate] opensheet HTTP error", res.status);
      return NextResponse.json(
        {
          ok: false,
          error: `スプレッドシートの取得に失敗しました (${res.status})`,
        },
        { status: 502 }
      );
    }

    const data: unknown = await res.json();
    if (!Array.isArray(data)) {
      console.log("[api/quiz/generate] invalid JSON shape", typeof data);
      return NextResponse.json(
        { ok: false, error: "スプレッドシートの形式が不正です（配列ではありません）" },
        { status: 502 }
      );
    }

    console.log("Loaded rows:", data.length);

    const validRows = data
      .filter((row): row is Record<string, unknown> => row != null && typeof row === "object")
      .map((row) => parseJapaneseQuizRow(row))
      .filter((row): row is NonNullable<typeof row> => row !== null);

    console.log("Valid rows:", validRows.length);

    const quiz = buildQuizFromJapaneseRows(validRows, QUESTION_COUNT);

    return NextResponse.json({
      ok: true,
      quiz,
      meta: { count: quiz.length },
    });
  } catch (e) {
    console.log("[api/quiz/generate] exception", e);
    const message =
      e instanceof Error ? e.message : "クイズ生成中にエラーが発生しました";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
