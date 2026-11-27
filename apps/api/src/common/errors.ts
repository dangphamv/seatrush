import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Request, Response } from "express";

// Lỗi nghiệp vụ: client dựa vào `type` (mã ngắn), không dựa vào câu chữ.
export class ApiError extends HttpException {
  constructor(status: HttpStatus, readonly code: string, detail?: string) {
    super({ code, detail }, status);
  }
}

// Mọi lỗi ra ngoài dạng problem+json (RFC 9457). Lỗi không lường trước: log đầy đủ, trả 500 không kèm chi tiết.
@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger("Problem");

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<Request>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let type = "internal";
    let detail: string | undefined;
    if (exception instanceof ApiError) {
      status = exception.getStatus();
      type = exception.code;
      detail = (exception.getResponse() as { detail?: string }).detail;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      type = (HttpStatus[status] ?? "error").toLowerCase();
      const raw = exception.getResponse();
      detail = typeof raw === "object" && raw && "message" in raw ? String(raw.message) : String(raw);
    } else {
      this.logger.error(`${req.method} ${req.url} ${exception instanceof Error ? (exception.stack ?? exception.message) : String(exception)}`);
    }
    res
      .status(status)
      .type("application/problem+json")
      .json({ type, title: HttpStatus[status] ?? "Error", status, ...(detail && { detail }) });
  }
}
