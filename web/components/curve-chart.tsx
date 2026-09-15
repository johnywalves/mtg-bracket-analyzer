import type { CurveBucket } from "@/lib/types";

export function CurveChart({ curve }: { curve: CurveBucket[] }) {
  const max = Math.max(1, ...curve.map((bucket) => bucket.count));

  return (
    <div className="flex h-32 items-end gap-2">
      {curve.map((bucket) => (
        <div key={bucket.cmc} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
          <div
            className="w-full rounded-t bg-accent-secondary/70"
            style={{ height: `${Math.max(4, (bucket.count / max) * 100)}%` }}
            title={`${bucket.count} cartas`}
          />
          <span className="text-xs text-muted">{bucket.cmc >= 7 ? "7+" : bucket.cmc}</span>
        </div>
      ))}
    </div>
  );
}
