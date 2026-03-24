const toneClass = {
  buy: "bg-emerald-50 text-[color:var(--buy)] border-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]",
  sell: "bg-rose-50 text-[color:var(--sell)] border-rose-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]",
  hold: "bg-amber-50 text-[color:var(--hold)] border-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]",
  neutral: "bg-slate-100 text-slate-700 border-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]",
};

export function SignalBadge({
  label,
  tone,
}: {
  label: string;
  tone: keyof typeof toneClass;
}) {
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${toneClass[tone]}`}>{label}</span>;
}
