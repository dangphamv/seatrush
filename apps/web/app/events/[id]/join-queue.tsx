"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Notice } from "@/components/ui";
import { formatCountdown, formatDate } from "@/lib/format";

export function JoinQueue({ eventId, salesOpenAt }: { eventId: string; salesOpenAt: string }) {
  const router = useRouter();
  const openAt = new Date(salesOpenAt).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // Giờ hiện tại chỉ lấy trên trình duyệt (tránh lệch giữa HTML server và client).
    const first = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);

  const open = now !== null && now >= openAt;
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted">Mở bán {formatDate(salesOpenAt)}</p>
      {now !== null && !open && (
        <p className="text-3xl font-extrabold tabular-nums" aria-live="polite">
          Còn {formatCountdown(openAt - now)}
        </p>
      )}
      <Button disabled={!open} onClick={() => router.push(`/events/${eventId}/queue`)}>
        {open ? "Vào hàng chờ mua vé" : "Chưa mở bán"}
      </Button>
      <Notice tone="warn">Mỗi email tối đa 4 vé. Ghế được giữ 10 phút sau khi chọn.</Notice>
    </div>
  );
}
