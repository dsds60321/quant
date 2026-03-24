"use client";

import { useState } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SecondaryButton } from "@/components/ui/SecondaryButton";

export function PortfolioModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: { name: string; baseCurrency: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("KRW");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(2,6,12,0.48)] p-4" onClick={onClose} role="presentation">
      <div
        className="mx-auto mt-[10vh] w-full max-w-md rounded-md border border-[rgba(15,23,42,0.08)] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]"
        onClick={(event) => event.stopPropagation()}
        role="presentation"
      >
        <div className="border-b border-[rgba(15,23,42,0.08)] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--fg-muted)]">포트폴리오 생성</p>
          <h3 className="mt-1 text-[18px] font-semibold text-[color:var(--fg)]">새 포트폴리오 등록</h3>
        </div>

        <form
          className="space-y-4 px-4 py-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setSubmitting(true);
            setError(null);
            try {
              await onCreate({ name: name.trim(), baseCurrency });
              setName("");
              setBaseCurrency("KRW");
              onClose();
            } catch (err) {
              setError(err instanceof Error ? err.message : "포트폴리오 생성에 실패했습니다.");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-[color:var(--fg)]">이름</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-md border border-[rgba(15,23,42,0.12)] bg-white px-3 py-2 text-[13px] text-[color:var(--fg)]"
              placeholder="예: AI Growth Portfolio"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-[color:var(--fg)]">기준 통화</label>
            <select
              value={baseCurrency}
              onChange={(event) => setBaseCurrency(event.target.value)}
              className="w-full rounded-md border border-[rgba(15,23,42,0.12)] bg-white px-3 py-2 text-[13px] text-[color:var(--fg)]"
            >
              <option value="KRW">KRW</option>
              <option value="USD">USD</option>
              <option value="JPY">JPY</option>
            </select>
          </div>

          {error ? <p className="text-[12px] text-[color:var(--sell)]">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <SecondaryButton label="닫기" icon="close" onClick={onClose} disabled={submitting} />
            <PrimaryButton type="submit" label={submitting ? "생성 중" : "포트폴리오 생성"} icon="play" disabled={submitting || !name.trim()} />
          </div>
        </form>
      </div>
    </div>
  );
}
