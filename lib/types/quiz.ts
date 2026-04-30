/**
 * クイズ1問分（API応答・画面表示の共通型）
 */
export type QuizQuestion = {
  question: string;
  options: [string, string, string, string];
  answer: string;
  explanation: string;
};

/**
 * フロントの useState 形に近い集約型（result は計算後に入る）
 */
export type QuizResultRow = {
  question: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
};

/**
 * n8n Webhook へ送るペイロード（仕様どおり）
 */
export type WebhookPayload = {
  userId: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  answers: Record<number, string>;
};

/** 画面のクイズ状態（要件どおり） */
export type QuizStateShape = {
  quiz: QuizQuestion[];
  answers: Record<number, string>;
  result: QuizResultRow[];
  score: number;
  isFinished: boolean;
};

export const emptyQuizState = (): QuizStateShape => ({
  quiz: [],
  answers: {},
  result: [],
  score: 0,
  isFinished: false,
});
