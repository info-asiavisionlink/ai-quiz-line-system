import type { QuizQuestion } from "@/lib/types/quiz";

/** Fisher–Yates シャッフル（コピーを返す） */
export function shuffleInPlace<T>(array: T[]): T[] {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 日本時間の表示（例：2026年4月30日 14:00）
 */
export function formatDateTimeJST(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

type RawRow = Record<string, unknown>;

function cell(row: RawRow, ...keys: string[]): string {
  for (const key of keys) {
    for (const rk of Object.keys(row)) {
      if (rk.trim().toLowerCase() === key.toLowerCase()) {
        const v = row[rk];
        if (v == null) continue;
        const s = String(v).trim();
        if (s !== "") return s;
      }
    }
  }
  return "";
}

/**
 * opensheet の1行を QuizQuestion に変換。
 * 想定列名: question, option1..4, answer, explanation
 * 日本語列: 問題, 選択肢1..4, 正解, 解説 などもフォールバック
 */
export function parseSheetRow(row: RawRow): QuizQuestion | null {
  const question =
    cell(row, "question", "問題", "q") ||
    cell(row, "Question");

  const o1 = cell(row, "option1", "選択肢1", "a", "A");
  const o2 = cell(row, "option2", "選択肢2", "b", "B");
  const o3 = cell(row, "option3", "選択肢3", "c", "C");
  const o4 = cell(row, "option4", "選択肢4", "d", "D");

  const answer =
    cell(row, "answer", "正解", "Answer") ||
    cell(row, "correct");

  const explanation =
    cell(row, "explanation", "解説", "説明", "概要", "ai要約", "summary") ||
    "";

  if (!question || !o1 || !o2 || !o3 || !o4 || !answer) {
    console.log("[parseSheetRow] skip invalid row", {
      question: !!question,
      opts: [!!o1, !!o2, !!o3, !!o4],
      answer: !!answer,
    });
    return null;
  }

  const options: [string, string, string, string] = [o1, o2, o3, o4];

  // 正解が完全一致しない場合はトリム比較で options のいずれかに合致させる
  let normalizedAnswer = answer;
  const match = options.find(
    (opt) => opt.trim() === answer.trim() || opt === answer
  );
  if (!match) {
    const loose = options.find(
      (opt) =>
        opt.toLowerCase() === answer.toLowerCase() ||
        answer.includes(opt) ||
        opt.includes(answer)
    );
    if (loose) normalizedAnswer = loose;
    else {
      console.log("[parseSheetRow] answer not in options; using raw answer", {
        answer,
        options,
      });
    }
  } else {
    normalizedAnswer = match;
  }

  return {
    question,
    options,
    answer: normalizedAnswer,
    explanation: explanation || "（解説なし）",
  };
}

type JapaneseQuizRow = {
  name: string;
  canDo: string;
  explanation: string;
};

/**
 * 日本語カラム（言語名・ツール名 / 何ができる？ / AI要約 or 概要説明）を
 * クイズ生成用の有効行へ変換する。
 */
export function parseJapaneseQuizRow(row: RawRow): JapaneseQuizRow | null {
  const name = cell(row, "言語名・ツール名");
  const canDo = cell(row, "何ができる？");
  const explanation = cell(row, "AI要約") || cell(row, "概要説明") || "（解説なし）";

  if (!name || !canDo) return null;

  return { name, canDo, explanation };
}

/**
 * 日本語スプレッドシート専用の4択クイズを生成する。
 * - 問題文: 「{言語名・ツール名}でできることはどれ？」
 * - 正解: 何ができる？
 * - 不正解: 他行の何ができる？からランダム3件
 */
export function buildQuizFromJapaneseRows(
  validRows: JapaneseQuizRow[],
  count: number
): QuizQuestion[] {
  if (validRows.length < count) {
    throw new Error(
      `有効な行が ${validRows.length} 件しかありません。最低 ${count} 件必要です。`
    );
  }

  const selectedRows = shuffleInPlace(validRows).slice(0, count);

  const quiz = selectedRows.map((row) => {
    const wrongPool = validRows
      .filter((r) => r.name !== row.name && r.canDo !== row.canDo)
      .map((r) => r.canDo);

    const uniqueWrongPool = Array.from(new Set(wrongPool));
    if (uniqueWrongPool.length < 3) {
      throw new Error(
        `「${row.name}」の不正解候補が不足しています（3件未満）。`
      );
    }

    const wrongOptions = shuffleInPlace(uniqueWrongPool).slice(0, 3);
    const options = shuffleInPlace([row.canDo, ...wrongOptions]) as [
      string,
      string,
      string,
      string,
    ];

    return {
      question: `${row.name}でできることはどれ？`,
      options,
      answer: row.canDo,
      explanation: row.explanation,
    };
  });

  return quiz;
}

export function pickRandomQuestions(
  pool: QuizQuestion[],
  count: number
): QuizQuestion[] {
  if (pool.length < count) {
    throw new Error(
      `有効な問題が ${pool.length} 問しかありません（${count} 問必要）`
    );
  }
  const shuffled = shuffleInPlace(pool);
  return shuffled.slice(0, count).map((q) => ({
    ...q,
    options: shuffleInPlace([...q.options]) as [string, string, string, string],
  }));
}
