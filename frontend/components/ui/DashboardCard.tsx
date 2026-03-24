export function DashboardCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="ui-section rounded-md border-[color:rgba(15,23,42,0.08)] bg-white/92 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)] lg:p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--kpi)]" />
            <h2 className="text-[14px] font-semibold text-[color:var(--fg)] lg:text-[15px]">{title}</h2>
          </div>
          {subtitle ? <p className="mt-1.5 text-[12px] leading-5 text-[color:var(--fg-muted)]">{subtitle}</p> : null}
        </div>
        {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
