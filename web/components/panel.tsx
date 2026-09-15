import type { ReactNode } from "react";

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-white/20 bg-surface p-6 shadow-[0_0_40px_-15px_rgba(255,0,127,0.35)] ${className}`}
    >
      {children}
    </div>
  );
}
