import { Body, Controller, Get, Headers, HttpStatus, Inject, Param, ParseUUIDPipe, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { z } from "zod";
import { ApiError } from "../common/errors.js";
import { ClientId } from "../common/http.js";
import { env } from "../env.js";
import { OrdersService } from "./orders.service.js";

const HoldBody = z.object({
  sectionId: z.uuid(),
  quantity: z.number().int().min(1).max(env.SEATRUSH_MAX_TICKETS),
  email: z.email().max(200),
});
type HoldBody = z.infer<typeof HoldBody>;

@Controller("orders")
export class OrdersController {
  constructor(@Inject(OrdersService) private readonly orders: OrdersService) {}

  @Post()
  async hold(
    @ClientId() clientId: string,
    @Headers("idempotency-key") key: string | undefined,
    @Headers("x-access-token") accessToken: string | undefined,
    @Body({ schema: HoldBody }) body: HoldBody,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!key || key.length > 64) throw new ApiError(HttpStatus.BAD_REQUEST, "idempotency_key_required");
    const [order, created] = await this.orders.hold(clientId, key, body, accessToken);
    res.status(created ? 201 : 200);
    return order;
  }

  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string, @ClientId() clientId: string) {
    return this.orders.get(id, clientId);
  }
}
