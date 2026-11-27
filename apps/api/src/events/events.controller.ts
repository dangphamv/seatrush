import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { AdminGuard } from "../common/http.js";
import { EventsService } from "./events.service.js";

export const CreateEventBody = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,80}$/),
  name: z.string().min(1).max(200),
  venue: z.string().min(1).max(200),
  startsAt: z.coerce.date(),
  salesOpenAt: z.coerce.date(),
  sections: z
    .array(
      z.object({
        name: z.string().min(1).max(50),
        priceVnd: z.number().int().positive(),
        rows: z.number().int().min(1).max(100),
        seatsPerRow: z.number().int().min(1).max(200),
      }),
    )
    .min(1)
    .max(20),
});
type CreateEventBody = z.infer<typeof CreateEventBody>;

@Controller("events")
export class EventsController {
  constructor(@Inject(EventsService) private readonly events: EventsService) {}

  @Get()
  list() {
    return this.events.list();
  }

  @Get(":id")
  detail(@Param("id", ParseUUIDPipe) id: string) {
    return this.events.detail(id);
  }
}

@Controller("admin/events")
@UseGuards(AdminGuard)
export class AdminEventsController {
  constructor(@Inject(EventsService) private readonly events: EventsService) {}

  @Post()
  create(@Body({ schema: CreateEventBody }) body: CreateEventBody) {
    return this.events.create(body);
  }
}
