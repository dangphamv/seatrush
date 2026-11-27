import { Inject, Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import type { Redis } from "ioredis";
import { env } from "../env.js";
import { REDIS } from "./infra.module.js";

// Fixed window 1 giây theo IP trong Redis: nhiều instance API dùng chung bộ đếm.
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const limit = env.SEATRUSH_RATE_LIMIT;
    if (!limit || req.path.startsWith("/health") || req.path === "/metrics" || req.path.endsWith("/webhook")) return next();
    const key = `rl:${req.ip}:${Math.floor(Date.now() / 1000)}`;
    const [[, count]] = (await this.redis.multi().incr(key).expire(key, 2).exec()) as [[null, number]];
    if (count > limit) {
      res.status(429).type("application/problem+json").set("Retry-After", "1").json({ type: "rate_limited", title: "Too Many Requests", status: 429 });
      return;
    }
    next();
  }
}
