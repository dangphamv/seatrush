import { notFound } from "next/navigation";
import { api, ApiProblem, type EventDetail } from "@/lib/api";
import { formatDate, formatVnd } from "@/lib/format";
import { Card } from "@/components/ui";
import { JoinQueue } from "./join-queue";

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let ev: EventDetail;
  try {
    ev = await api<EventDetail>(`/events/${id}`);
  } catch (err) {
    if (err instanceof ApiProblem && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  }
  return (
    <div className="grid gap-6 py-6 lg:grid-cols-[1fr_340px]">
      <div>
        <p className="text-sm font-medium uppercase tracking-wider text-accent-2">{ev.venue}</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">{ev.name}</h1>
        <p className="mt-2 text-muted">Diễn ra {formatDate(ev.startsAt)}</p>
        <h2 className="mt-8 mb-3 font-bold">Khu vực</h2>
        <ul className="grid gap-3">
          {ev.sections.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3">
              <span className="font-bold">{s.name}</span>
              <span className="text-sm text-muted">
                {formatVnd(s.priceVnd)} · {s.available > 0 ? `còn ${s.available}/${s.total}` : <span className="text-danger">hết vé</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <Card className="h-fit lg:sticky lg:top-6">
        <JoinQueue eventId={ev.id} salesOpenAt={ev.salesOpenAt} />
      </Card>
    </div>
  );
}
