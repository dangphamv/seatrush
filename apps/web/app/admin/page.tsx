"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button, Card, Notice } from "@/components/ui";
import { api, type EventSummary, type Stats } from "@/lib/api";
import { formatVnd } from "@/lib/format";

// WEB-06 / ADM-01: số liệu realtime qua SSE. Token admin chỉ giữ trong tab này (sessionStorage).
export default function AdminPage() {
  const [token, setToken] = useState("");
  const stored = useSyncExternalStore(
    () => () => {},
    () => sessionStorage.getItem("seatrush:admin"),
    () => null,
  );
  const [override, setSaved] = useState<string | null | undefined>(undefined);
  const saved = override === undefined ? stored : override;
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [eventId, setEventId] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<EventSummary[]>("/events")
      .then((e) => {
        setEvents(e);
        setEventId((cur) => cur || e[0]?.id || "");
      })
      .catch(() => setError("Không tải được danh sách sự kiện."));
  }, []);

  useEffect(() => {
    if (!saved || !eventId) return;
    const url = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/v1/admin/events/${eventId}/stats/stream?token=${encodeURIComponent(saved)}`;
    const es = new EventSource(url);
    es.onmessage = (m) => {
      setStats(JSON.parse(m.data as string) as Stats);
      setError(null);
    };
    es.onerror = () => setError("Mất kết nối hoặc sai token. Đang thử lại…");
    return () => es.close();
  }, [saved, eventId]);

  if (!saved) {
    return (
      <form
        className="mx-auto grid max-w-sm gap-4 py-10"
        onSubmit={(e) => {
          e.preventDefault();
          sessionStorage.setItem("seatrush:admin", token);
          setSaved(token);
        }}
      >
        <h1 className="text-2xl font-extrabold">Dashboard ban tổ chức</h1>
        <label className="grid gap-2">
          <span className="font-bold">Admin token</span>
          <input type="password" required value={token} onChange={(e) => setToken(e.target.value)} className="rounded-xl border border-line bg-surface px-4 py-3" />
        </label>
        <Button type="submit">Vào dashboard</Button>
      </form>
    );
  }

  const total = stats ? stats.available + stats.held + stats.sold : 0;
  const tiles: [string, string, string][] = stats
    ? [
        ["Đã bán", stats.sold.toLocaleString("vi-VN"), "text-ok"],
        ["Đang giữ", stats.held.toLocaleString("vi-VN"), "text-accent-2"],
        ["Còn trống", stats.available.toLocaleString("vi-VN"), "text-text"],
        ["Doanh thu", formatVnd(stats.revenueVnd), "text-accent"],
        ["Trong hàng chờ", stats.queueLength.toLocaleString("vi-VN"), "text-text"],
        ["Đã cho vào", stats.admitted.toLocaleString("vi-VN"), "text-text"],
      ]
    : [];
  return (
    <div className="grid gap-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Dashboard</h1>
        <div className="flex gap-2">
          <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="rounded-xl border border-line bg-surface px-4 py-2" aria-label="Sự kiện">
            {events.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <Button
            variant="ghost"
            className="py-2"
            onClick={() => {
              sessionStorage.removeItem("seatrush:admin");
              setSaved(null);
            }}
          >
            Thoát
          </Button>
        </div>
      </div>
      {error && <Notice tone="warn">{error}</Notice>}
      {stats && (
        <>
          <div aria-label="Tỉ lệ ghế" className="flex h-4 overflow-hidden rounded-full bg-surface-2">
            <div className="bg-ok" style={{ width: `${(stats.sold / total) * 100}%` }} />
            <div className="bg-accent-2" style={{ width: `${(stats.held / total) * 100}%` }} />
          </div>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {tiles.map(([label, value, color]) => (
              <li key={label}>
                <Card>
                  <p className="text-sm text-muted">{label}</p>
                  <p className={`mt-1 text-3xl font-extrabold tabular-nums ${color}`}>{value}</p>
                </Card>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">Cập nhật mỗi giây · {total.toLocaleString("vi-VN")} ghế</p>
        </>
      )}
    </div>
  );
}
