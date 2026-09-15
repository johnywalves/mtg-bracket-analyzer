type Tone = "ok" | "error";

const TONE_STYLES: Record<Tone, string> = {
  ok: "border-accent-secondary/40 bg-accent-secondary/10 text-accent-secondary",
  error: "border-accent-primary/40 bg-accent-primary/10 text-accent-primary",
};

export function StatusBadge({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${TONE_STYLES[tone]}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${tone === "ok" ? "bg-accent-secondary" : "bg-accent-primary"}`}
      />
      {label}
    </span>
  );
}
