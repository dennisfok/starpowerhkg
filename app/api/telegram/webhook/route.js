import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const TG_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

async function tgCall(method, body) {
  const res = await fetch(`${TG_API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function POST(request) {
  let update;
  try { update = await request.json(); }
  catch { return NextResponse.json({ ok: true }); }

  const cb = update.callback_query;
  if (!cb) return NextResponse.json({ ok: true });

  const { id: cbId, from, message, data } = cb;
  const [action, bookingId] = (data || "").split(":");
  const driverName = [from.first_name, from.last_name].filter(Boolean).join(" ") || from.username || "司機";
  const chatId = message.chat.id;
  const messageId = message.message_id;

  // Acknowledge the callback immediately
  await tgCall("answerCallbackQuery", { callback_query_id: cbId });

  if (action === "accept") {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Check if already assigned
    const { data: bk } = await supabase
      .from("bookings")
      .select("internal_code, assigned_driver_id, telegram_accepted_by")
      .eq("id", bookingId)
      .single();

    if (bk?.telegram_accepted_by) {
      await tgCall("answerCallbackQuery", {
        callback_query_id: cbId,
        text: `此單已由 ${bk.telegram_accepted_by} 接走`,
        show_alert: true,
      });
      return NextResponse.json({ ok: true });
    }

    // Update booking with telegram driver name
    await supabase
      .from("bookings")
      .update({ telegram_accepted_by: driverName, status: "confirmed" })
      .eq("id", bookingId);

    // Edit original message to show accepted
    const originalText = message.text || "";
    await tgCall("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: originalText + `\n\n✅ *已由 ${driverName} 接單*`,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [] },
    });

    // Notify admin
    const adminId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (adminId) {
      await tgCall("sendMessage", {
        chat_id: adminId,
        text: `✅ *接單通知*\n單號：\`${bk?.internal_code || bookingId}\`\n司機：${driverName}\n請喺系統確認派單。`,
        parse_mode: "Markdown",
      });
    }

  } else if (action === "query") {
    await tgCall("sendMessage", {
      chat_id: chatId,
      text: `❓ ${driverName} 對單號 \`${bookingId}\` 有查詢，請聯絡管理員。`,
      parse_mode: "Markdown",
      reply_to_message_id: messageId,
    });
  }

  return NextResponse.json({ ok: true });
}

// Telegram requires GET for webhook verification (not needed but harmless)
export async function GET() {
  return NextResponse.json({ ok: true, service: "telegram-webhook" });
}
