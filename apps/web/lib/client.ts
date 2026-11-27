"use client";

// Người mua không đăng nhập: uuid ngẫu nhiên lưu trong trình duyệt (PRD non-goals).
export function clientId(): string {
  let id = localStorage.getItem("seatrush:client");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("seatrush:client", id);
  }
  return id;
}

const accessKey = (eventId: string) => `seatrush:access:${eventId}`;

export function saveAccess(eventId: string, token: string, expiresAt: string) {
  sessionStorage.setItem(accessKey(eventId), JSON.stringify({ token, expiresAt }));
}

export function loadAccess(eventId: string): { token: string; expiresAt: string } | null {
  const raw = sessionStorage.getItem(accessKey(eventId));
  if (!raw) return null;
  const v = JSON.parse(raw) as { token: string; expiresAt: string };
  return new Date(v.expiresAt).getTime() > Date.now() ? v : null;
}
