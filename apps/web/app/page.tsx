import Link from "next/link";
import { api, type EventSummary } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { Card, Notice } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Home() {
  let events: EventSummary[] = [];
  let failed = false;
  try {
    events = await api<EventSummary[]>("/events");
  } catch {
    failed = true;
  }
  return (
    <>
      <section className="py-10">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Mở bán lúc 0 giờ, <span className="text-accent">không ai mua trùng ghế.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          Vào hàng chờ đúng giờ, tới lượt thì chọn khu và số lượng. Ghế được giữ cho bạn 10 phút để thanh toán.
        </p>
      </section>
      {failed && <Notice>Không tải được danh sách sự kiện. Thử tải lại trang.</Notice>}
      {!failed && events.length === 0 && <Card className="text-muted">Chưa có sự kiện nào đang mở bán.</Card>}
      <ul className="grid gap-4 sm:grid-cols-2">
        {events.map((e) => (
          <li key={e.id}>
            <Link href={`/events/${e.id}`} className="block rounded-card border border-line bg-surface p-5 transition hover:border-accent">
              <p className="text-xs font-medium uppercase tracking-wider text-accent-2">Mở bán {formatDate(e.salesOpenAt)}</p>
              <h2 className="mt-2 text-xl font-bold">{e.name}</h2>
              <p className="mt-1 text-sm text-muted">
                {e.venue} · {formatDate(e.startsAt)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
