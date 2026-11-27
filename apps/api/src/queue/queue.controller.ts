import { Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { ClientId } from "../common/http.js";
import { QueueService } from "./queue.service.js";

@Controller("events/:id/queue")
export class QueueController {
  constructor(@Inject(QueueService) private readonly queue: QueueService) {}

  @Post()
  @HttpCode(200)
  join(@Param("id", ParseUUIDPipe) id: string, @ClientId() clientId: string) {
    return this.queue.join(id, clientId);
  }

  @Get()
  status(@Param("id", ParseUUIDPipe) id: string, @ClientId() clientId: string) {
    return this.queue.status(id, clientId);
  }
}
