import { Controller, Get, Inject, Injectable, type MessageEvent, Param, ParseUUIDPipe, Sse, UseGuards } from "@nestjs/common";
import { from, interval, type Observable, startWith, switchMap } from "rxjs";
import { AdminGuard } from "../common/http.js";
import { SQL, type Sql } from "../common/infra.module.js";
import { QueueService } from "../queue/queue.service.js";

@Injectable()
export class StatsService {
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    @Inject(QueueService) private readonly queue: QueueService,
  ) {}

  async stats(eventId: string) {
    const [[seats], [rev], q] = await Promise.all([
      this.sql<{ available: number; held: number; sold: number }[]>`
        select count(*) filter (where status = 'available' or (status = 'held' and held_until < now()))::int as available,
               count(*) filter (where status = 'held' and held_until >= now())::int as held,
               count(*) filter (where status = 'sold')::int as sold
        from seats where event_id = ${eventId}`,
      this.sql<{ revenueVnd: number }[]>`
        select coalesce(sum(amount_vnd), 0)::float8 as "revenueVnd" from orders where event_id = ${eventId} and status = 'confirmed'`,
      this.queue.stats(eventId),
    ]);
    return { ...seats, revenueVnd: Number(rev.revenueVnd), ...q };
  }
}

@Controller("admin/events/:id/stats")
@UseGuards(AdminGuard)
export class AdminStatsController {
  constructor(@Inject(StatsService) private readonly stats: StatsService) {}

  @Get()
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.stats.stats(id);
  }

  @Sse("stream")
  stream(@Param("id", ParseUUIDPipe) id: string): Observable<MessageEvent> {
    return interval(1000).pipe(
      startWith(0),
      switchMap(() => from(this.stats.stats(id).then((data) => ({ data })))),
    );
  }
}
