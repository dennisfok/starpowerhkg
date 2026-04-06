import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY 未設定" }, { status: 500 });
  }

  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "無效的請求格式" }, { status: 400 }); }

  const { images } = body;
  if (!images?.length) {
    return NextResponse.json({ error: "沒有收到圖片" }, { status: 400 });
  }

  const imageBlocks = images.map(({ base64, mime }) => ({
    type: "image",
    source: { type: "base64", media_type: (mime || "image/jpeg"), data: base64 },
  }));

  const PROMPT = `You are a professional data extractor for a Hong Kong transfer company.
Analyse the Talixo driver app screenshot(s) provided and extract every booking card.

Return ONLY a valid JSON array — no markdown, no explanation, no extra text.

Schema for each order:
{
  "booking_id":      "exact booking number from the upper-left of the card",
  "date":            "YYYY-MM-DD",
  "time":            "HH:MM (24-hour)",
  "platform":        "Talixo",
  "vehicle_type":    "exact text including + symbol, e.g. economy+, econ MPV",
  "origin":          "full departure location text including any bracketed suffix",
  "destination":     "full arrival location text including any bracketed suffix",
  "flight_no":       "flight number shown in parentheses below HKG location, or null if absent",
  "passenger_name":  "passenger full name",
  "passenger_phone": "phone number with country code",
  "pax_count":       "digit next to person icon",
  "luggage_count":   "digit next to luggage icon",
  "payout_usd":      "the SMALLER USD amount at the bottom of the card, digits only, no $",
  "gross_usd":       "the LARGER USD amount labelled gross, digits only, no $"
}

Critical rules:
- Zero guessing — only extract data that is clearly legible in the image.
- If a field is unclear or not present, use null.
- Include EVERY order visible across ALL provided images.
- Payout is the smaller amount (driver earnings). Gross is the larger amount.
- Return the raw JSON array starting with [ and ending with ].`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: [...imageBlocks, { type: "text", text: PROMPT }] }],
    });
    const raw = message.content[0]?.text?.trim() || "[]";
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) {
      console.error("Claude response (no JSON array found):", raw);
      return NextResponse.json({ orders: [], warning: "AI 未返回有效 JSON，請重試" });
    }
    const orders = JSON.parse(match[0]);
    return NextResponse.json({ orders });
  } catch (err) {
    console.error("Claude API error:", err);
    return NextResponse.json({ error: err.message || "Claude API 調用失敗" }, { status: 500 });
  }
}
