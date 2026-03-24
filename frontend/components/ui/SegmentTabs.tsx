"use client";

import { useState } from "react";

export function SegmentTabs({
  items,
  initialValue,
  onChange,
}: {
  items: string[];
  initialValue?: string;
  onChange?: (value: string) => void;
}) {
  const [active, setActive] = useState(initialValue ?? items[0] ?? "");

  return (
    <div className="inline-flex rounded-md border border-[color:rgba(15,23,42,0.08)] bg-[#f7f9fc] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => {
            setActive(item);
            onChange?.(item);
          }}
          className={`rounded-sm px-3 py-1.5 text-[12px] font-semibold transition ${
            active === item ? "bg-white text-[color:var(--fg)] shadow-[0_12px_20px_rgba(15,23,42,0.08)]" : "text-[color:var(--fg-muted)]"
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
