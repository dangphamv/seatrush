import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { AdminStatsController, StatsService } from "./admin/admin.controller.js";
import { InfraModule } from "./common/infra.module.js";
import { RateLimitMiddleware } from "./common/rate-limit.js";
import { AdminEventsController, EventsController } from "./events/events.controller.js";
import { EventsService } from "./events/events.service.js";
import { HealthController } from "./health/health.controller.js";
import { OrdersController } from "./orders/orders.controller.js";
import { OrdersService } from "./orders/orders.service.js";
import { OutboxService } from "./outbox/outbox.service.js";
import { WorkersService } from "./outbox/workers.service.js";
import { PaymentsController } from "./payments/payments.controller.js";
import { PaymentsService } from "./payments/payments.service.js";
import { QueueController } from "./queue/queue.controller.js";
import { QueueService } from "./queue/queue.service.js";

@Module({
  imports: [InfraModule],
  controllers: [HealthController, EventsController, AdminEventsController, QueueController, OrdersController, PaymentsController, AdminStatsController],
  providers: [EventsService, QueueService, OrdersService, PaymentsService, OutboxService, WorkersService, StatsService, RateLimitMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RateLimitMiddleware).forRoutes("*path");
  }
}
