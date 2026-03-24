export function StatusNotice({
  title,
  description,
  tone = "warning",
}: {
  title: string;
  description: string;
  tone?: "info" | "success" | "warning" | "error";
}) {
  const palette = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-rose-200 bg-rose-50 text-rose-900",
  } satisfies Record<"info" | "success" | "warning" | "error", string>;

  const detailPalette = {
    info: "text-sky-800",
    success: "text-emerald-800",
    warning: "text-amber-800",
    error: "text-rose-800",
  } satisfies Record<"info" | "success" | "warning" | "error", string>;

  return (
    <div className={`rounded-md border px-4 py-3 text-[13px] ${palette[tone]}`}>
      <p className="font-semibold">{title}</p>
      <p className={`mt-1 text-[12px] ${detailPalette[tone]}`}>{description}</p>
    </div>
  );
}
