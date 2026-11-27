"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, Notice, Spinner } from "@/components/ui";
import { api, type Order, problemMessage } from "@/lib/api";
import { clientId } from "@/lib/client";
import { formatVnd } from "@/lib/format";

const LABEL: Record<Order["status"], string> = {
  pending: "Đang chờ thanh toán",
  confirmed: "Đã xác nhận",
  expired: "Đã hết hạn giữ ghế",
  refund_required: "Chờ hoàn tiền",
};

// WEB-04: webhook có thể tới sau khi người mua quay về → hỏi lại mỗi 2 giây khi đơn còn pending.
export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const o = await api<Order>(`/orders/${id}`, { clientId: clientId() });
        setOrder(o);
        if (o.status === "pending") timer = setTimeout(() => void load(), 2000);
      } catch (err) {
        setError(problemMessage(err));
      }
    };
    void load();
    return () => clearTimeout(timer);
  }, [id]);

  if (error) return <div className="mx-auto max-w-lg py-10"><Notice>{error}</Notice></div>;
  if (!order) return <div className="py-10"><Spinner label="Đang tải đơn hàng…" /></div>;
  return (
    <div className="mx-auto max-w-lg py-10">
      <Card className="grid gap-4">
        <p className="text-sm text-muted">Đơn #{order.code}</p>
        <h1 className="text-2xl font-extrabold" aria-live="polite">{LABEL[order.status]}</h1>
        {order.status === "pending" && <Spinner label="Đang chờ xác nhận thanh toán…" />}
        {order.status === "refund_required" && <Notice tone="warn">Tiền đã đến sau khi đơn hết hạn hoặc không khớp. Ban tổ chức sẽ hoàn tiền cho bạn.</Notice>}
        <p className="text-muted">Tổng tiền: <span className="font-bold text-text">{formatVnd(order.amountVnd)}</span></p>
        {order.status === "confirmed" && (
          <ul className="grid gap-2">
            {order.seats.map((seat, i) => (
              <li key={seat} className="flex items-center justify-between rounded-xl border border-ok/40 bg-ok/10 px-4 py-3">
                <span className="font-bold">Ghế {seat}</span>
                <code className="font-mono text-ok">{order.tickets[i]}</code>
              </li>
            ))}
          </ul>
        )}
        {order.status === "confirmed" && <Notice tone="ok">Vé đã được gửi tới {order.email}.</Notice>}
      </Card>
    </div>
  );
}
