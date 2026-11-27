import { timingSafeEqual } from "node:crypto";
import { type CanActivate, createParamDecorator, type ExecutionContext, HttpStatus, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { env } from "../env.js";
import { ApiError } from "./errors.js";

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const uuid = z.uuid();

// Người mua không đăng nhập: web sinh uuid lưu cookie và gửi qua header (ADR 0005, PRD non-goals).
export const ClientId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const id = ctx.switchToHttp().getRequest<Request>().header("x-client-id");
  if (!id || !uuid.safeParse(id).success) throw new ApiError(HttpStatus.BAD_REQUEST, "client_id_required");
  return id;
});

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const header = req.header("authorization")?.replace(/^Bearer /, "");
    // EventSource không gửi được header → SSE gửi token qua query.
    const token = header ?? (typeof req.query.token === "string" ? req.query.token : "");
    if (!token || !safeEqual(token, env.ADMIN_TOKEN)) throw new ApiError(HttpStatus.UNAUTHORIZED, "unauthorized");
    return true;
  }
}
