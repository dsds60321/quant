"use client";

import { isValidElement, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";

function getTextValue(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map((item) => getTextValue(item)).join(" ");
  }

  if (isValidElement(node)) {
    return getTextValue((node.props as { children?: React.ReactNode }).children);
  }

  return "";
}

export function DataTable({
  columns,
  rows,
  title = "데이터 테이블",
  pageSize = 5,
}: {
  columns: string[];
  rows: Array<Array<React.ReactNode>>;
  title?: string;
  pageSize?: number;
}) {
  const [sortAscending, setSortAscending] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const next = rows.filter((row) => {
      if (!normalizedQuery) {
        return true;
      }

      return row.some((cell) => getTextValue(cell).toLowerCase().includes(normalizedQuery));
    });

    return sortAscending ? next : [...next].reverse();
  }, [query, rows, sortAscending]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [currentPage, filteredRows, pageSize]);

  return (
    <div className="overflow-hidden rounded-md border border-[color:rgba(15,23,42,0.08)] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-2 border-b border-[color:rgba(15,23,42,0.08)] bg-[#f7f9fc] px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">{title}</p>
          <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">정렬, 필터, 페이지 이동이 가능한 표입니다.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex items-center gap-2 rounded-md border border-[color:rgba(15,23,42,0.08)] bg-white px-2.5 py-1.5 text-xs font-semibold text-[color:var(--fg-muted)]">
            <Icon name="search" className="h-3.5 w-3.5" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="표 내용 검색"
              className="min-w-28 bg-transparent text-[12px] text-[color:var(--fg)] placeholder:text-[color:var(--fg-muted)]"
            />
          </label>
          <button type="button" onClick={() => setSortAscending((value) => !value)} className="inline-flex items-center gap-2 rounded-md border border-[color:rgba(15,23,42,0.08)] bg-white px-2.5 py-1.5 text-xs font-semibold text-[color:var(--fg)]">
            <Icon name="filter" className="h-3.5 w-3.5 text-[color:var(--fg-muted)]" />
            {sortAscending ? "오름차순" : "내림차순"}
          </button>
        </div>
      </div>
      <div className="ui-scrollbar overflow-x-auto">
        <table className="ui-table min-w-full bg-white">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`} className="transition hover:bg-[#f8fbff]">
                {row.map((cell, cellIndex) => (
                  <td key={`cell-${rowIndex}-${cellIndex}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-2 border-t border-[color:rgba(15,23,42,0.08)] bg-[#fbfcfe] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] font-medium text-[color:var(--fg-muted)]">
          총 {filteredRows.length}건 중 {currentPage} / {totalPages} 페이지
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="inline-flex items-center gap-2 rounded-md border border-[color:rgba(15,23,42,0.08)] bg-white px-2.5 py-1.5 text-xs font-semibold text-[color:var(--fg)] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={currentPage === 1}
          >
            <Icon name="arrowLeft" className="h-3.5 w-3.5" />
            이전
          </button>
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            className="inline-flex items-center gap-2 rounded-md border border-[color:rgba(15,23,42,0.08)] bg-white px-2.5 py-1.5 text-xs font-semibold text-[color:var(--fg)] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={currentPage === totalPages}
          >
            다음
            <Icon name="arrowRight" className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
