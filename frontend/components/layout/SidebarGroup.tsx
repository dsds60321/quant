import { Icon } from "@/components/ui/Icon";
import type { SidebarGroupEntry } from "@/lib/navigation";
import { SidebarItem } from "@/components/layout/SidebarItem";

export function SidebarGroup({
  group,
  pathname,
  expanded,
  onToggle,
}: {
  group: SidebarGroupEntry;
  pathname: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="rounded-md border border-[color:rgba(15,23,42,0.06)] bg-white/70">
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center justify-between gap-3 px-2.5 py-2 text-left transition ${expanded ? "bg-[#f7f9fc]" : "bg-transparent hover:bg-[#f7f9fc]"}`}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-[color:rgba(15,23,42,0.08)] bg-white text-[color:var(--fg-muted)]">
            <Icon name={group.icon} className="h-3.5 w-3.5" />
          </span>
          <span className="text-[12px] font-semibold text-[color:var(--fg)]">{group.title}</span>
        </div>
        <Icon name="chevron" className={`h-3.5 w-3.5 text-[color:var(--fg-muted)] transition ${expanded ? "rotate-90" : ""}`} />
      </button>
      {expanded ? (
        <div className="space-y-1 border-t border-[color:rgba(15,23,42,0.06)] px-2 py-2">
          {group.items.map((item) => (
            <SidebarItem key={item.href} item={item} active={pathname === item.href || pathname.startsWith(`${item.href}/`)} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
