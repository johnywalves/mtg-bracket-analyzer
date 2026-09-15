// Selo de validação — indicador de baixo peso visual (contorno + ícone
// colorido, sem fundo sólido) pra não competir com o pill sólido do
// BracketBadge, que fica ao lado nos cards e na página do deck.
export function ValidationBadge({ legal }: { legal: boolean }) {
  const iconTone = legal ? "text-emerald-400" : "text-rose-400";

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-semibold text-muted">
      <ValidationIcon approved={legal} className={iconTone} />
      {legal ? "aprovado" : "rejeitado"}
    </span>
  );
}

function ValidationIcon({ approved, className = "" }: { approved: boolean; className?: string }) {
  if (approved) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`h-3.5 w-3.5 ${className}`}>
        <path d="m4 12 6 6L20 6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`h-3.5 w-3.5 ${className}`}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
