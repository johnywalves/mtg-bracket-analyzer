// Selo de validação — visual próprio (chip sólido, cantos retos-arredondados)
// pra se distinguir dos badges em pílula (bracket, cores) usados no resto da UI.
export function ValidationBadge({ legal }: { legal: boolean }) {
  const tone = legal
    ? "bg-blue-500 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.25)]"
    : "bg-red-500 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.25)]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${tone}`}
    >
      <ValidationIcon approved={legal} />
      {legal ? "aprovado" : "rejeitado"}
    </span>
  );
}

function ValidationIcon({ approved }: { approved: boolean }) {
  if (approved) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
        <path d="m4 12 6 6L20 6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
