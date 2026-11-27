"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Card, Notice, Spinner } from "@/components/ui";
import { api, type EventDetail, type Order, problemMessage } from "@/lib/api";
import { clientId, loadAccess } from "@/lib/client";
import { formatCountdown, formatVnd } from "@/lib/format";

// WEB-03: chọn khu + số lượng → giữ ghế → đếm ngược → thanh toán.
export default function CheckoutPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ev, setEv] = useState<EventDetail | null>(null);
  const [sectionId, setSectionId] = useState("");
  const [quantity, setQuantity] = useState(2);
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Bấm lại sau lỗi mạng dùng cùng key → không giữ ghế 2 lần (HLD-03). Đổi lựa chọn thì sinh key mới.
  const idemKey = useRef<string>("");

  useEffect(() => {
    if (!loadAccess(id)) {
      router.replace(`/events/${id}/queue`);
      return;
    }
    api<EventDetail>(`/events/${id}`)
      .then((e) => {
        setEv(e);
        setSectionId(e.sections.find((s) => s.available > 0)?.id ?? "");
      })
      .catch((err: unknown) => setError(problemMessage(err)));
  }, [id, router]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    idemKey.current = crypto.randomUUID();
  }, [sectionId, quantity, email]);

  async function hold(e: React.FormEvent) {
    e.preventDefault();
    const access = loadAccess(id);
    if (!access) return router.replace(`/events/${id}/queue`);
    setBusy(true);
    setError(null);
    try {
      const o = await api<Order>("/orders", {
        method: "POST",
        clientId: clientId(),
        accessToken: access.token,
        headers: { "idempotency-key": idemKey.current },
        body: JSON.stringify({ sectionId, quantity, email }),
      });
      setOrder(o);
    } catch (err) {
      setError(problemMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (!order) return;
    setBusy(true);
    setError(null);
    try {
      const { checkoutUrl } = await api<{ checkoutUrl: string }>(`/orders/${order.id}/checkout`, { method: "POST", clientId: clientId() });
      window.location.href = checkoutUrl;
    } catch (err) {
      setError(problemMessage(err));
      setBusy(false);
    }
  }

  if (!ev && !error) return <div className="py-10"><Spinner label="Đang tải…" /></div>;

  if (order) {
    const left = new Date(order.expiresAt).getTime() - now;
    return (
      <div className="mx-auto max-w-lg py-10">
        <Card className="grid gap-5">
          <h1 className="text-2xl font-extrabold">Đã giữ ghế cho bạn</h1>
          <p className="text-muted">
            Ghế: <span className="font-bold text-text">{order.seats.join(", ")}</span>
          </p>
          <p className="text-muted">
            Tổng tiền: <span className="font-bold text-text">{formatVnd(order.amountVnd)}</span>
          </p>
          <p aria-live="polite" className={`text-center text-5xl font-extrabold tabular-nums ${left < 60_000 ? "text-danger" : "text-accent-2"}`}>
            {formatCountdown(left)}
          </p>
          {left <= 0 ? (
            <Notice>Hết thời gian giữ ghế. Ghế đã được trả lại cho người khác.</Notice>
          ) : (
            <Button onClick={() => void pay()} disabled={busy}>
              {busy ? "Đang mở cổng thanh toán…" : "Thanh toán"}
            </Button>
          )}
          {error && <Notice>{error}</Notice>}
        </Card>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void hold(e)} className="mx-auto grid max-w-lg gap-5 py-10">
      <h1 className="text-2xl font-extrabold">Tới lượt bạn: {ev?.name}</h1>
      <fieldset className="grid gap-2">
        <legend className="mb-2 font-bold">Khu vực</legend>
        {ev?.sections.map((s) => (
          <label key={s.id} className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 ${sectionId === s.id ? "border-accent bg-surface-2" : "border-line bg-surface"} ${s.available === 0 ? "opacity-50" : ""}`}>
            <span className="flex items-center gap-3">
              <input type="radio" name="section" value={s.id} checked={sectionId === s.id} disabled={s.available === 0} onChange={() => setSectionId(s.id)} className="accent-[var(--color-accent)]" />
              <span className="font-bold">{s.name}</span>
            </span>
            <span className="text-sm text-muted">
              {formatVnd(s.priceVnd)} · {s.available > 0 ? `còn ${s.available}` : "hết vé"}
            </span>
          </label>
        ))}
      </fieldset>
      <label className="grid gap-2">
        <span className="font-bold">Số lượng</span>
        <select value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="rounded-xl border border-line bg-surface px-4 py-3">
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>{n} vé</option>
          ))}
        </select>
      </label>
      <label className="grid gap-2">
        <span className="font-bold">Email nhận vé</span>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@email.com" className="rounded-xl border border-line bg-surface px-4 py-3" />
      </label>
      {error && <Notice>{error}</Notice>}
      <Button type="submit" disabled={busy || !sectionId}>
        {busy ? "Đang giữ ghế…" : "Giữ ghế 10 phút"}
      </Button>
    </form>
  );
}
