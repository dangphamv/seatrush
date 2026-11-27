import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { env } from "../env.js";
import { OrdersService } from "../orders/orders.service.js";
import { OutboxService } from "./outbox.service.js";

// Việc nền chạy ngay trong process API (đủ cho MVP). Mỗi việc không chạy chồng lên lần trước.
@Injectable()
export class WorkersService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger("Workers");
  private readonly timers: NodeJS.Timeout[] = [];

  constructor(
    @Inject(OutboxService) private readonly outbox: OutboxService,
    @Inject(OrdersService) private readonly orders: OrdersService,
  ) {}

  onApplicationBootstrap() {
    if (env.SEATRUSH_WORKERS !== "1") return;
    this.every("relay", 500, () => this.outbox.relay());
    this.every("notify", 500, () => this.outbox.consume());
    this.every("expire", 5000, () => this.orders.expireDue());
  }

  private every(name: string, ms: number, job: () => Promise<unknown>) {
    let running = false;
    this.timers.push(
      setInterval(() => {
        if (running) return;
        running = true;
        job()
          .catch((err: unknown) => this.logger.error(`${name}: ${String(err)}`))
          .finally(() => (running = false));
      }, ms),
    );
  }

  onApplicationShutdown() {
    this.timers.forEach(clearInterval);
  }
}
