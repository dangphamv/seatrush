import { randomUUID } from "node:crypto";
import { HttpStatus, StandardSchemaValidationPipe, VersioningType } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { ApiError, ProblemFilter } from "./common/errors.js";
import { httpDuration } from "./common/metrics.js";
import { env } from "./env.js";

// Dùng chung cho main.ts và test: test chạy đúng app như production.
export function configureApp(app: NestExpressApplication) {
  app.set("trust proxy", 1);
  app.use(helmet());
  app.enableCors({ origin: env.WEB_URL, allowedHeaders: ["content-type", "x-client-id", "x-access-token", "idempotency-key", "authorization"] });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const id = req.header("x-request-id") ?? randomUUID();
    res.setHeader("x-request-id", id);
    const end = httpDuration.startTimer({ method: req.method });
    res.on("finish", () => end({ route: (req.route as { path?: string } | undefined)?.path ?? "unmatched", status: String(res.statusCode) }));
    next();
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  app.useGlobalFilters(new ProblemFilter());
  app.useGlobalPipes(
    new StandardSchemaValidationPipe({
      exceptionFactory: (issues) =>
        new ApiError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          "validation",
          issues.map((i) => `${i.path?.map((p) => (typeof p === "object" ? p.key : p)).join(".") ?? ""}: ${i.message}`).join("; "),
        ),
    }),
  );
  app.enableShutdownHooks();
  return app;
}
