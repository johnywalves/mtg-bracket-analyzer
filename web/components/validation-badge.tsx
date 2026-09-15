import { StatusBadge } from "@/components/status-badge";

export function ValidationBadge({ legal }: { legal: boolean }) {
  return legal ? (
    <StatusBadge tone="ok" label="legal" />
  ) : (
    <StatusBadge tone="error" label="ilegal" />
  );
}
