"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, Notice, Spinner } from "@/components/ui";
import { api, problemMessage, type QueueStatus } from "@/lib/api";
import { clientId, saveAccess } from "@/lib/client";

// WEB-02: vào hàng chờ, hỏi vị trí mỗi 2 giây, tới lượt thì lưu token và sang trang chọn vé.
export default function QueuePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    let lastEta = 0;
    const cid = clientId();
    const tick = async (first: boolean) => {
      try {
        const s = await api<QueueStatus>(`/events/${id}/queue`, { method: first ? "POST" : "GET", clientId: cid });
        if (stop) return;
        setStatus(s);
        setError(null);
        lastEta = s.etaSeconds;
        if (s.admitted && s.accessToken && s.accessExpiresAt) {
          saveAccess(id, s.accessToken, s.accessExpiresAt);
          router.replace(`/events/${id}/checkout`);
          return;
        }
      } catch (err) {
        if (!stop) setError(problemMessage(err));
      }
      // Chờ lâu thì hỏi thưa hơn: giảm tải lúc cao điểm.
      if (!stop) timer = setTimeout(() => void tick(false), lastEta > 60 ? 5000 : 2000);
    };
    void tick(true);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [id, router]);

  return (
    <div className="mx-auto max-w-lg py-10">
      <Card className="grid gap-5 text-center">
        <h1 className="text-2xl font-extrabold">Bạn đang trong hàng chờ</h1>
        {error && <Notice>{error}</Notice>}
        {!status && !error && <Spinner label="Đang lấy số thứ tự…" />}
        {status && !status.admitted && (
          <div aria-live="polite" className="grid gap-1">
            <p className="text-muted">Số người phía trước</p>
            <p className="text-6xl font-extrabold tabular-nums text-accent">{status.position.toLocaleString("vi-VN")}</p>
            <p className="text-muted">Ước tính khoảng {Math.max(1, Math.ceil(status.etaSeconds / 60))} phút</p>
          </div>
        )}
        {status?.admitted && <Spinner label="Tới lượt bạn, đang chuyển trang…" />}
        <p className="text-sm text-muted">Giữ nguyên trang này. Tải lại trang không làm mất vị trí của bạn.</p>
      </Card>
    </div>
  );
}
