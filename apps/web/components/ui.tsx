import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card border border-line bg-surface p-5 ${className}`}>{children}</div>;
}

export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }) {
  const look =
    variant === "primary"
      ? "bg-accent text-white hover:brightness-110 disabled:opacity-50"
      : "border border-line text-text hover:bg-surface-2 disabled:opacity-50";
  return <button className={`inline-flex items-center justify-center rounded-xl px-5 py-3 font-bold transition ${look} ${className}`} {...props} />;
}

export function Notice({ tone = "danger", children }: { tone?: "danger" | "ok" | "warn"; children: ReactNode }) {
  const color = { danger: "border-danger/40 bg-danger/10 text-danger", ok: "border-ok/40 bg-ok/10 text-ok", warn: "border-warn/40 bg-warn/10 text-warn" }[tone];
  return (
    <p role={tone === "danger" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${color}`}>
      {children}
    </p>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-muted" role="status">
      <span className="size-4 animate-spin rounded-full border-2 border-line border-t-accent" />
      {label}
    </span>
  );
}
