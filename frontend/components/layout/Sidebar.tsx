"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { SidebarGroup } from "@/components/layout/SidebarGroup";
import { SidebarItem } from "@/components/layout/SidebarItem";
import { sidebarGroups } from "@/lib/navigation";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const activeGroupTitle = useMemo(
    () => sidebarGroups.find((group) => group.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)))?.title ?? "홈",
    [pathname],
  );
  const [expandedGroupTitle, setExpandedGroupTitle] = useState(activeGroupTitle);

  useEffect(() => {
    setExpandedGroupTitle(activeGroupTitle);
  }, [activeGroupTitle]);

  return (
    <aside className={`border-r border-[color:rgba(15,23,42,0.08)] bg-[#fbfcfe] transition-all duration-200 ${collapsed ? "w-18" : "w-56"}`}>
      <div className="flex h-full flex-col px-2 py-2.5">
        <div className="mb-2 flex items-center justify-between px-1">
          {!collapsed ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">메뉴</p>
              <p className="mt-1 text-[12px] font-semibold text-[color:var(--fg)]">플랫폼 탐색</p>
            </div>
          ) : <div className="h-7" />}
          <button type="button" onClick={() => setCollapsed((value) => !value)} className="flex h-7 w-7 items-center justify-center rounded-md border border-[color:rgba(15,23,42,0.08)] bg-white text-[color:var(--fg-muted)]">
            <Icon name="chevron" className={`h-3 w-3 transition ${collapsed ? "rotate-180" : ""}`} />
          </button>
        </div>

        {!collapsed ? (
          <nav className="space-y-2 overflow-y-auto pr-1">
            {sidebarGroups.map((group) => (
              <SidebarGroup
                key={group.title}
                group={group}
                pathname={pathname}
                expanded={expandedGroupTitle === group.title}
                onToggle={() => setExpandedGroupTitle((current) => (current === group.title ? "" : group.title))}
              />
            ))}
          </nav>
        ) : (
          <nav className="space-y-2 overflow-y-auto pr-1">
            {sidebarGroups.map((group) => (
              <div key={group.title} className="space-y-1 border-b border-[color:rgba(15,23,42,0.06)] pb-2 last:border-b-0">
                {group.items.map((item) => (
                  <SidebarItem key={item.href} item={item} active={pathname === item.href || pathname.startsWith(`${item.href}/`)} collapsed />
                ))}
              </div>
            ))}
          </nav>
        )}

        <div className="mt-auto rounded-md border border-[color:rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,#0f172a,#1e293b)] p-2.5 text-white">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10">
              <Icon name="job" className="h-3.5 w-3.5" />
            </span>
            {!collapsed ? (
              <div>
                <p className="text-[10px] font-semibold tracking-[0.18em] text-white/60 uppercase">작업 모니터</p>
                <p className="text-[12px] font-semibold">실행중 작업 4건</p>
              </div>
            ) : null}
          </div>
          {!collapsed ? (
            <>
              <p className="mt-2 text-[11px] leading-4 text-white/70">백테스트, 리스크 계산, 데이터 동기화가 순차적으로 처리되고 있습니다.</p>
              <Link href="/job-monitor" className="mt-3 inline-flex items-center gap-2 rounded-md bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[color:var(--fg)]">
                <Icon name="arrowRight" className="h-3 w-3" />
                작업 보기
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
