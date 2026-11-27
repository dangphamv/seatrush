import "reflect-metadata";
import { ConsoleLogger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";
import { env, isProduction } from "./env.js";
import { configureApp } from "./setup.js";

const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: new ConsoleLogger({ json: isProduction }) });
configureApp(app);
await app.listen(env.PORT, "0.0.0.0");
