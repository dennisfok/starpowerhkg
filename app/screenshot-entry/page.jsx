"use client";

import { useState, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = "https://snpgpvmqctkbhumugegj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNucGdwdm1xY3RrYmh1bXVnZWdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NjI3NzQsImV4cCI6MjA5MDUzODc3NH0.dAbcsV5JRtcMcSGE_bxAR9eEkZ37NCgQaqaXSBkM0s4";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MONTH_LETTERS = ["A","B","C","D","E","F","G","H","I","J","K","L"];
const PLATFORM_CODES = { Talixo:"TX", Transferoo:"TR", Kiwitaxi:"KT", eLife:"EX", Local:"LX" };
const PLATFORMS = ["Talixo","Transferoo","Kiwitaxi","eLife","Local"];
const STATUSES  = ["pending","confirmed","completed","cancelled"];

function genInternalId(platform, dateStr, seq) {
  const code = PLATFORM_CODES[platform] || "XX";
  const d    = new Date(dateStr);
  const day  = String(d.getDate()).padStart(2, "0");
  const mon  = MONTH_LETTERS[d.getMonth()] || "A";
  return `${code}${day}${mon}-${String(seq).padStart(2,"0")}`;
}

function todayISO() {
  return new Date().toISOString().slice(0,10);
}

export default function ScreenshotEntryPage() {
  const [images,    setImages]    = useState([]);
  const [parsing,   setParsing]   = useState(false);
  const [orders,    setOrders]    = useState([]);
  const [saving,    setSaving]    = useState(false);
  const [msg,       setMsg]       = useState(null);
  const [seqStart,  setSeqStart]  = useState(1);

  const galleryRef = useRef(null);
  const cameraRef  = useRef(null);

  const addFiles = useCallback((files) => {
    if (!files?.length) return;
    const readers = Array.from(files).map(f => new Promise(resolve => {
      const r = new FileReader();
      r.onload = e => resolve({ name: f.name, preview: e.target.result, base64: e.target.result.split(",")[1], mime: f.type || "image/jpeg" });
      r.readAsDataURL(f);
    }));
    Promise.all(readers).then(res => setImages(prev => [...prev, ...res]));
  }, []);

  const removeImage = (i) => setImages(prev => prev.filter((_,idx) => idx !== i));

  const handleParse = async () => {
    if (!images.length) { setMsg({ type:"err", text:"請先上傳截圖" }); return; }
    setParsing(true);
    setMsg({ type:"info", text:"AI 正在解析截圖，請稍候…" });
    try {
      const res  = await fetch("/api/parse-screenshot", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ images: images.map(i => ({ base64: i.base64, mime: i.mime })) }) });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "解析失敗");
      const mapped = (data.orders || []).map((o, idx) => ({
        internal_id: genInternalId(o.platform || "Talixo", o.date || todayISO(), seqStart + idx),
        platform: o.platform || "Talixo", platform_ref: o.booking_id || "",
        date: o.date || todayISO(), time: o.time || "", vehicle_type: o.vehicle_type || "",
        origin: o.origin || "", destination: o.destination || "", flight_no: o.flight_no || "",
        passenger_name: o.passenger_name || "", passenger_phone: o.passenger_phone || "",
        pax_count: String(o.pax_count ?? ""), luggage_count: String(o.luggage_count ?? ""),
        payout_usd: parseFloat(o.payout_usd) || null, gross_usd: parseFloat(o.gross_usd) || null,
        driver_name: "未指派", status: "pending", notes: "",
      }));
      setOrders(mapped);
      setMsg({ type:"ok", text:`解析完成，共 ${mapped.length} 張單` });
    } catch (err) {
      setMsg({ type:"err", text:"解析失敗：" + err.message });
    }
    setParsing(false);
  };

  const updateOrder = (i, field, val) => setOrders(prev => prev.map((o,idx) => idx === i ? { ...o, [field]: val } : o));
  const removeOrder = (i) => setOrders(prev => prev.filter((_,idx) => idx !== i));

  const handleSave = async () => {
    if (!orders.length) return;
    setSaving(true); setMsg({ type:"info", text:"儲存中…" });
    let ok = 0, fail = 0;
    for (const order of orders) {
      const { error } = await supabase.from("orders").upsert(order, { onConflict: "internal_id" });
      error ? fail++ : ok++;
    }
    setSaving(false);
    if (fail === 0) { setMsg({ type:"ok", text:`成功儲存 ${ok} 張單！` }); setImages([]); setOrders([]); setSeqStart(s => s + ok); }
    else setMsg({ type:"err", text:`${ok} 成功 / ${fail} 失敗` });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-yellow-400 text-black px-4 py-3 flex items-center gap-3 sticky top-0 z-20 shadow-lg">
        <span className="text-2xl font-black tracking-widest">STARPOWER</span>
        <span className="text-xs font-semibold opacity-60 mt-0.5">截圖入單系統</span>
      </header>
      <div className="max-w-xl mx-auto p-4 space-y-4 pb-16">
        <section className="bg-gray-900 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-bold text-yellow-400 tracking-widest uppercase">上傳截圖</p>
          <button onClick={() => galleryRef.current?.click()} className="w-full border-2 border-dashed border-gray-700 hover:border-yellow-400 rounded-xl p-6 text-center transition-colors">
            <div className="text-4xl mb-1">📸</div>
            <div className="text-gray-400 text-sm">點此選擇截圖（可多張）</div>
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => galleryRef.current?.click()} className="bg-gray-800 hover:bg-gray-700 rounded-xl py-3 text-sm font-medium transition-colors">相簿選取</button>
            <button onClick={() => cameraRef.current?.click()} className="bg-gray-800 hover:bg-gray-700 rounded-xl py-3 text-sm font-medium transition-colors">即時拍攝</button>
          </div>
          <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
          <input ref={cameraRef}  type="file" accept="image/*" capture="environment" className="hidden" onChange={e => addFiles(e.target.files)} />
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {images.map((img, i) => (
                <div key={i} className="relative aspect-[3/4] rounded-xl overflow-hidden bg-gray-800">
                  <img src={img.preview} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-black/60 rounded-full w-6 h-6 text-xs flex items-center justify-center">✕</button>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="bg-gray-900 rounded-2xl p-4 flex items-center gap-3">
          <p className="text-sm text-gray-400 flex-1">今日起始序號</p>
          <input type="number" min="1" value={seqStart} onChange={e => setSeqStart(Math.max(1, parseInt(e.target.value)||1))} className="w-20 bg-gray-800 text-center rounded-lg py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-yellow-400" />
        </section>
        <button onClick={handleParse} disabled={parsing || !images.length} className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:bg-gray-800 disabled:text-gray-600 text-black font-bold rounded-2xl py-4 text-base transition-colors">
          {parsing ? "AI 解析中…" : images.length ? `解析 ${images.length} 張截圖` : "解析截圖（請先上傳）"}
        </button>
        {msg && <div className={`rounded-xl px-4 py-3 text-sm font-medium ${msg.type==="ok"?"bg-green-900/50 text-green-300":msg.type==="err"?"bg-red-900/50 text-red-300":"bg-gray-800 text-gray-300"}`}>{msg.text}</div>}
        {orders.length > 0 && (
          <section className="space-y-3">
            <p className="text-xs font-bold text-yellow-400 tracking-widest uppercase">核對訂單（{orders.length} 張）</p>
            {orders.map((order, i) => <OrderCard key={i} order={order} idx={i} onUpdate={updateOrder} onRemove={removeOrder} />)}
            <button onClick={handleSave} disabled={saving} className="w-full bg-green-500 hover:bg-green-400 disabled:bg-gray-800 text-white font-bold rounded-2xl py-4 text-base transition-colors">
              {saving ? "儲存中…" : `儲存全部 ${orders.length} 張單`}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

function OrderCard({ order, idx, onUpdate, onRemove }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 text-left">
        <div>
          <span className="font-mono text-yellow-400 font-bold text-sm">{order.internal_id}</span>
          <p className="text-xs text-gray-400 mt-0.5">{order.passenger_name || "—"} · {order.date} {order.time}</p>
        </div>
        <div className="flex items-center gap-2">
          <span onClick={e => { e.stopPropagation(); onRemove(idx); }} className="text-xs text-red-400 bg-red-900/40 px-2 py-1 rounded-lg cursor-pointer">刪除</span>
          <span className="text-gray-600 text-xs">{open ? "▲" : "▼"}</span>
        </div>
      </button>
      {open && (
        <div className="p-4 grid grid-cols-2 gap-3">
          <F label="Internal ID" val={order.internal_id} mono onChange={v => onUpdate(idx,"internal_id",v)} />
          <F label="平台" val={order.platform} sel={PLATFORMS} onChange={v => onUpdate(idx,"platform",v)} />
          <F label="Booking ID" val={order.platform_ref} onChange={v => onUpdate(idx,"platform_ref",v)} />
          <F label="日期" val={order.date} type="date" onChange={v => onUpdate(idx,"date",v)} />
          <F label="時間" val={order.time} onChange={v => onUpdate(idx,"time",v)} />
          <F label="車型" val={order.vehicle_type} onChange={v => onUpdate(idx,"vehicle_type",v)} />
          <F label="出發地" val={order.origin} wide onChange={v => onUpdate(idx,"origin",v)} />
          <F label="目的地" val={order.destination} wide onChange={v => onUpdate(idx,"destination",v)} />
          <F label="航班號" val={order.flight_no} onChange={v => onUpdate(idx,"flight_no",v)} />
          <F label="乘客姓名" val={order.passenger_name} onChange={v => onUpdate(idx,"passenger_name",v)} />
          <F label="乘客電話" val={order.passenger_phone} onChange={v => onUpdate(idx,"passenger_phone",v)} />
          <F label="人數" val={order.pax_count} onChange={v => onUpdate(idx,"pax_count",v)} />
          <F label="行李" val={order.luggage_count} onChange={v => onUpdate(idx,"luggage_count",v)} />
          <F label="Payout US$" val={order.payout_usd} type="number" onChange={v => onUpdate(idx,"payout_usd",parseFloat(v)||null)} />
          <F label="Gross US$" val={order.gross_usd} type="number" onChange={v => onUpdate(idx,"gross_usd",parseFloat(v)||null)} />
          <F label="狀態" val={order.status} sel={STATUSES} onChange={v => onUpdate(idx,"status",v)} />
          <F label="備注" val={order.notes} wide onChange={v => onUpdate(idx,"notes",v)} />
        </div>
      )}
    </div>
  );
}

function F({ label, val, onChange, type="text", sel, wide=false, mono=false }) {
  const base = "w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400";
  return (
    <div className={wide ? "col-span-2" : ""}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {sel
        ? <select value={val||""} onChange={e=>onChange(e.target.value)} className={base}>{sel.map(o=><option key={o} value={o}>{o}</option>)}</select>
        : <input type={type} value={val??""} onChange={e=>onChange(e.target.value)} className={`${base} ${mono?"font-mono":""}`} />
      }
    </div>
  );
}
