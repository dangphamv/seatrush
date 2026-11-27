"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, Card, Notice } from "@/components/ui";
import { api, problemMessage } from "@/lib/api";

// WEB-05: cổng thanh toán giả lập cho dev và demo. API chỉ bật khi không có key PayOS và không phải production.
export default function Page() {
  return (
    <Suspense>
      <FakeGateway />
    </Suspense>
  );
}

function FakeGateway() {
  const { code } = useParams<{ code: string }>();
  const orderId = useSearchParams().get("order");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    try {
      await api(`/payments/fake/${code}/pay`, { method: "POST" });
      router.replace(`/orders/${orderId}`);
    } catch (err) {
      setError(problemMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-10">
      <Card className="grid gap-4 border-dashed">
        <p className="text-xs font-bold uppercase tracking-wider text-warn">Cổng thanh toán giả lập</p>
        <h1 className="text-2xl font-extrabold">Đơn #{code}</h1>
        <p className="text-sm text-muted">Bấm thanh toán để gửi webhook có chữ ký giống PayOS về API.</p>
        {error && <Notice>{error}</Notice>}
        <Button onClick={() => void pay()} disabled={busy}>{busy ? "Đang xử lý…" : "Thanh toán thành công"}</Button>
        <Button variant="ghost" onClick={() => router.replace(`/orders/${orderId}`)}>Huỷ</Button>
      </Card>
    </div>
  );
}
