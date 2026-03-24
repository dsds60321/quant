import { Icon } from "@/components/ui/Icon";

export function SectionTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-[color:rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(243,246,251,0.96))] px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] lg:flex-row lg:items-center lg:justify-between lg:px-4">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="flex items-center gap-2">
            <Icon name="status" className="h-3.5 w-3.5 text-[color:var(--kpi)]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">{eyebrow}</p>
          </div>
        ) : null}
        <h1 className="mt-2 text-[22px] font-semibold tracking-tight text-[color:var(--fg)] lg:text-[26px]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-3xl text-[13px] leading-5 text-[color:var(--fg-muted)]">{description}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap gap-3">{action}</div> : null}
    </div>
  );
}
