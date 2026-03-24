export function formatCurrency(value: number, currency = "KRW") {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number, digits = 2) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatCompactCurrency(value: number, currency = "KRW") {
  const eok = 100000000;
  if (currency === "KRW" && Math.abs(value) >= eok) {
    return `₩${(value / eok).toFixed(2)}억`;
  }
  return formatCurrency(value, currency);
}
