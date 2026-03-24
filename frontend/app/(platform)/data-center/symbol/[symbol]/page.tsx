import { redirect } from "next/navigation";

export default async function StockDataDetailPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  redirect(`/stock-analysis?symbol=${encodeURIComponent(symbol)}`);
}
