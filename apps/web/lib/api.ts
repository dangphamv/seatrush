// Kiểu dữ liệu theo docs/api-contract.yaml.
export type Section = { id: string; name: string; priceVnd: number; total: number; available: number };
export type EventSummary = { id: string; slug: string; name: string; venue: string; startsAt: string; salesOpenAt: string; status: "draft" | "on_sale" | "closed" };
export type EventDetail = EventSummary & { sections: Section[] };
export type QueueStatus = { admitted: boolean; position: number; etaSeconds: number; accessToken?: string; accessExpiresAt?: string };
export type Order = {
  id: string;
  code: number;
  eventId: string;
  sectionId: string;
  email: string;
  quantity: number;
  amountVnd: number;
  status: "pending" | "confirmed" | "expired" | "refund_required";
  expiresAt: string;
  seats: string[];
  tickets: string[];
};
export type Stats = { available: number; held: number; sold: number; revenueVnd: number; queueLength: number; admitted: number };

export class ApiProblem extends Error {
  constructor(readonly status: number, readonly type: string, detail?: string) {
    super(detail ?? type);
  }
}

// Server component gọi qua API_URL (mạng nội bộ); trình duyệt gọi NEXT_PUBLIC_API_URL.
const base = () => (typeof window === "undefined" ? process.env.API_URL : process.env.NEXT_PUBLIC_API_URL) ?? "http://localhost:4000";

export async function api<T>(path: string, init: RequestInit & { clientId?: string; accessToken?: string } = {}): Promise<T> {
  const { clientId, accessToken, headers, ...rest } = init;
  const res = await fetch(`${base()}/v1${path}`, {
    cache: "no-store",
    ...rest,
    headers: {
      ...(rest.body ? { "content-type": "application/json" } : {}),
      ...(clientId ? { "x-client-id": clientId } : {}),
      ...(accessToken ? { "x-access-token": accessToken } : {}),
      ...headers,
    },
  });
  if (!res.ok) {
    const p = (await res.json().catch(() => ({}))) as { type?: string; detail?: string };
    throw new ApiProblem(res.status, p.type ?? "error", p.detail);
  }
  return (await res.json()) as T;
}

// Mã lỗi API → câu cho người mua.
export function problemMessage(err: unknown): string {
  const type = err instanceof ApiProblem ? err.type : "network";
  const messages: Record<string, string> = {
    not_enough_seats: "Khu vực này không còn đủ ghế. Thử khu khác hoặc giảm số lượng.",
    ticket_limit: err instanceof Error ? err.message : "Vượt giới hạn vé cho mỗi email.",
    access_denied: "Lượt mua đã hết hạn. Vui lòng vào lại hàng chờ.",
    sales_not_open: "Chưa tới giờ mở bán.",
    sales_closed: "Sự kiện đã ngừng bán.",
    order_not_payable: "Đơn đã hết hạn giữ ghế hoặc đã thanh toán.",
    rate_limited: "Bạn thao tác quá nhanh, thử lại sau 1 giây.",
    validation: "Thông tin chưa hợp lệ, vui lòng kiểm tra lại.",
    network: "Không kết nối được máy chủ. Thử lại sau giây lát.",
  };
  return messages[type] ?? "Có lỗi xảy ra, vui lòng thử lại.";
}
