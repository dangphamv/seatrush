import { Counter, collectDefaultMetrics, Histogram, Registry } from "prom-client";

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const httpDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP latency theo route",
  labelNames: ["method", "route", "status"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [registry],
});

// Analytics events trong PRD: mỗi event là một counter.
export const businessEvents = new Counter({
  name: "seatrush_events_total",
  help: "queue_joined, queue_admitted, hold_created, hold_failed, checkout_started, order_confirmed, order_expired, payment_late",
  labelNames: ["event", "reason"],
  registers: [registry],
});

export const track = (event: string, reason = "") => businessEvents.inc({ event, reason });
