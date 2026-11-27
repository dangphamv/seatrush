// OPS-01: mô phỏng đợt mở bán. Mỗi iteration là 1 người mua: vào hàng chờ → chờ tới lượt → giữ ghế → thanh toán.
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";
import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

const API = __ENV.API ?? "http://host.docker.internal:4100";
const ADMIN = __ENV.ADMIN_TOKEN ?? "dev-admin-token";
const VUS = Number(__ENV.VUS ?? 1000);
const BUYERS_PER_VU = Number(__ENV.BUYERS_PER_VU ?? 3);
const SEATS = Number(__ENV.SEATS ?? 2000);

const holdOk = new Counter("hold_ok");
const holdSoldOut = new Counter("hold_sold_out");
const paid = new Counter("paid");
const queueWait = new Trend("queue_wait_ms", true);

// 409 (hết ghế) là kết quả nghiệp vụ hợp lệ, không phải lỗi.
http.setResponseCallback(http.expectedStatuses(200, 201, 409));

export const options = {
  scenarios: {
    rush: { executor: "per-vu-iterations", vus: VUS, iterations: BUYERS_PER_VU, maxDuration: "5m" },
  },
  thresholds: {
    http_req_failed: ["rate<0.001"],
    "http_req_duration{name:hold}": ["p(95)<300"],
    "http_req_duration{name:queue_status}": ["p(95)<50"],
  },
  summaryTrendStats: ["avg", "med", "p(95)", "p(99)", "max"],
};

export function setup() {
  const perRow = 50;
  const body = {
    slug: `rush-${Date.now()}`,
    name: "Load test",
    venue: "k6",
    startsAt: new Date(Date.now() + 86400000).toISOString(),
    salesOpenAt: new Date().toISOString(),
    sections: [
      { name: "A", priceVnd: 1000000, rows: Math.ceil(SEATS / 2 / perRow), seatsPerRow: perRow },
      { name: "B", priceVnd: 500000, rows: Math.ceil(SEATS / 2 / perRow), seatsPerRow: perRow },
    ],
  };
  const res = http.post(`${API}/v1/admin/events`, JSON.stringify(body), {
    headers: { "content-type": "application/json", authorization: `Bearer ${ADMIN}` },
  });
  if (res.status !== 201) throw new Error(`setup failed: ${res.status} ${res.body}`);
  const ev = res.json();
  return { eventId: ev.id, sections: ev.sections.map((s) => s.id) };
}

export default function ({ eventId, sections }) {
  const clientId = uuidv4();
  const h = { "content-type": "application/json", "x-client-id": clientId };
  const start = Date.now();
  let s = http.post(`${API}/v1/events/${eventId}/queue`, null, { headers: h, tags: { name: "queue_join" } }).json();
  while (!s.admitted) {
    sleep(0.5);
    s = http.get(`${API}/v1/events/${eventId}/queue`, { headers: h, tags: { name: "queue_status" } }).json();
  }
  queueWait.add(Date.now() - start);

  const quantity = 1 + Math.floor(Math.random() * 2);
  const res = http.post(
    `${API}/v1/orders`,
    JSON.stringify({ sectionId: sections[Math.floor(Math.random() * sections.length)], quantity, email: `${clientId}@load.test` }),
    { headers: { ...h, "x-access-token": s.accessToken, "idempotency-key": uuidv4() }, tags: { name: "hold" } },
  );
  check(res, { "hold 201 or 409": (r) => r.status === 201 || r.status === 409 });
  if (res.status === 409) return holdSoldOut.add(1);
  holdOk.add(1);

  // 80% người giữ được ghế sẽ trả tiền; còn lại bỏ đơn (ghế về lại sau khi hết hạn).
  if (Math.random() < 0.8) {
    const p = http.post(`${API}/v1/payments/fake/${res.json().code}/pay`, null, { tags: { name: "pay" } });
    if (check(p, { "paid confirmed": (r) => r.json().outcome === "confirmed" })) paid.add(1);
  }
}
