import { NextResponse } from "next/server";

const TG_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function POST(request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const groupId = process.env.TELEGRAM_GROUP_CHAT_ID;
  if (!token || !groupId) {
    return NextResponse.json({ error: "Telegram 未設定" }, { status: 500 });
  }

  let booking;
  try { booking = await request.json(); }
  catch { return NextResponse.json({ error: "無效請求" }, { status: 400 }); }

  const {
    id, internal_code, booking_date, pickup_time,
    pickup_location, dropoff_location, flight_number,
    passenger_name, pax = 1, luggage = 0,
    vehicle_type, platform_payout, driver_wage_paid,
    notes,
  } = booking;

  const date = booking_date || "";
  const time = pickup_time ? pickup_time.slice(0, 5) : "";
  const payout = platform_payout ? `US$${platform_payout}` : "—";
  const wage = driver_wage_paid ? `HK$${driver_wage_paid}` : "—";

  const text =
    `🚗 *新出單* | \`${internal_code || "—"}\`\n` +
    `\n📅 ${date} ${time}` +
    `${flight_number ? `\n✈️ ${flight_number}` : ""}` +
    `\n📍 ${pickup_location || "—"}\n🏁 ${dropoff_location || "—"}` +
    `\n👤 ${passenger_name || "—"} · ${pax}人 / ${luggage}件行李` +
    `\n🚙 ${vehicle_type || "—"}` +
    `\n💰 司機工資：${wage}（平台：${payout}）` +
    `${notes ? `\n📝 ${notes}` : ""}` +
    `\n\n有冇人接單？👇`;

  const inline_keyboard = [[
    { text: "✅ 我接單", callback_data: `accept:${id}` },
    { text: "❓ 查詢", callback_data: `query:${id}` },
  ]];

  try {
    const res = await fetch(`${TG_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: groupId,
        text,
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard },
      }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.description || "Telegram 發送失敗");
    return NextResponse.json({ ok: true, message_id: data.result.message_id });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
