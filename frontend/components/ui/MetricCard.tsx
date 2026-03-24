import { Icon } from "@/components/ui/Icon";

export function MetricCard({
  label,
  value,
  change,
  accent = "default",
}: {
  label: string;
  value: string;
  change: string;
  accent?: "default" | "buy" | "sell" | "kpi";
}) {
  const accentClass = {
    default: "text-[color:var(--fg)]",
    buy: "text-[color:var(--buy)]",
    sell: "text-[color:var(--sell)]",
    kpi: "text-[color:var(--kpi)]",
  };

  const chipClass = {
    default: "bg-slate-100 text-slate-600",
    buy: "bg-emerald-50 text-[color:var(--buy)]",
    sell: "bg-rose-50 text-[color:var(--sell)]",
    kpi: "bg-blue-50 text-[color:var(--kpi)]",
  };

  return (
    <section className="ui-card overflow-hidden rounded-md border-[color:rgba(15,23,42,0.08)] bg-white p-0 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3 p-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">{label}</p>
          <p className={`mt-2 text-[22px] font-semibold tracking-tight ${accentClass[accent]}`}>{value}</p>
          <p className="mt-1.5 text-[12px] text-[color:var(--fg-muted)]">{change}</p>
        </div>
        <span className={`flex h-8 w-8 items-center justify-center rounded-md ${chipClass[accent]}`}>
          <Icon name="spark" className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="flex h-12 items-end gap-1 border-t border-[color:rgba(15,23,42,0.05)] bg-[linear-gradient(180deg,#f8fafc,#f1f5f9)] px-4 pb-3">
        {[38, 48, 42, 61, 58, 72, 66, 78, 70, 74].map((bar, index) => (
          <div key={`${label}-${index}`} className="flex-1 bg-[linear-gradient(180deg,#d6e4ff,#7ea6ff)]" style={{ height: `${bar}%` }} />
        ))}
      </div>
    </section>
  );
}
