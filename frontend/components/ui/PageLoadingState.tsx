import { PageContainer } from "@/components/ui/PageContainer";
import { SectionTitle } from "@/components/ui/SectionTitle";

export function PageLoadingState({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <PageContainer>
      <SectionTitle eyebrow={eyebrow} title={title} description={description} />

      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`metric-skeleton-${index}`}
            className="overflow-hidden rounded-md border border-[color:rgba(15,23,42,0.08)] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
          >
            <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
            <div className="mt-3 h-7 w-28 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-3 w-32 animate-pulse rounded bg-slate-100" />
            <div className="mt-4 h-12 animate-pulse rounded bg-[linear-gradient(180deg,#f8fafc,#eef2ff)]" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={`panel-skeleton-${index}`}
            className="rounded-md border border-[color:rgba(15,23,42,0.08)] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
          >
            <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-3 w-56 animate-pulse rounded bg-slate-100" />
            <div className="mt-6 h-64 animate-pulse rounded-md bg-[linear-gradient(180deg,#f8fafc,#eef2ff)]" />
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
