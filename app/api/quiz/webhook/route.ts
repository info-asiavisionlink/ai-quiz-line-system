import { NextResponse } from "next/server";
import type { WebhookPayload } from "@/lib/types/quiz";

export const dynamic = "force-dynamic";

const N8N_WEBHOOK =
  "https://nextasia.app.n8n.cloud/webhook/26117ac2-36cf-471a-9b7b-5dde39b5d7b6";

function isPayload(x: unknown): x is WebhookPayload {
  if (x == null || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.userId === "string" &&
    typeof o.score === "number" &&
    o.answers != null &&
    typeof o.answers === "object"
  );
}

export async function POST(request: Request) {
  console.log("[api/quiz/webhook] POST start");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON が不正です" }, { status: 400 });
  }

  if (!isPayload(body)) {
    console.log("[api/quiz/webhook] invalid payload shape");
    return NextResponse.json(
      { ok: false, error: "ペイロードの形式が不正です" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(N8N_WEBHOOK, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    console.log("[api/quiz/webhook] n8n status", res.status, text.slice(0, 200));

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `Webhook 送信先がエラーを返しました (${res.status})`,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.log("[api/quiz/webhook] fetch error", e);
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Webhook 送信に失敗しました",
      },
      { status: 500 }
    );
  }
}
