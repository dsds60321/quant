import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { SidebarItemEntry } from "@/lib/navigation";

export function SidebarItem({
  item,
  active,
  collapsed = false,
}: {
  item: SidebarItemEntry;
  active: boolean;
  collapsed?: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={`group flex items-center gap-2 rounded-md px-2 py-2 text-[12px] font-semibold transition ${
        active
          ? "bg-[linear-gradient(180deg,#111827,#1f2937)] text-white shadow-[0_10px_18px_rgba(15,23,42,0.14)]"
          : "text-[color:var(--fg)] hover:bg-[#f3f6fb]"
      } ${collapsed ? "justify-center" : ""}`}
      title={collapsed ? item.label : undefined}
    >
      <span className={`flex h-7 w-7 items-center justify-center rounded-md ${active ? "bg-white/12" : "bg-white border border-[color:rgba(15,23,42,0.08)] text-[color:var(--fg-muted)]"}`}>
        <Icon name={item.icon} className="h-3.5 w-3.5" />
      </span>
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
    </Link>
  );
}
