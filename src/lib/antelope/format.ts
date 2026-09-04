export interface ParsedAsset {
  amount: number;
  symbol: string;
  precision: number;
}

export function parseAsset(quantity: string): ParsedAsset {
  const [rawAmount = '0', symbol = ''] = quantity.trim().split(' ');
  const [, decimals = ''] = rawAmount.split('.');
  return { amount: Number(rawAmount), symbol, precision: decimals.length };
}

export function formatNumber(value: number, digits: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatAsset(amount: number, symbol: string, precision: number): string {
  return `${formatNumber(amount, precision)} ${symbol}`;
}

export function sumAssets(quantities: string[]): ParsedAsset | undefined {
  const first = quantities[0];
  if (first === undefined) return undefined;
  const base = parseAsset(first);
  const amount = quantities.reduce((total, quantity) => total + parseAsset(quantity).amount, 0);
  return { ...base, amount };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '∞';
  const abs = Math.abs(bytes);
  if (abs >= 1024 ** 3) return `${formatNumber(bytes / 1024 ** 3, 2)} GB`;
  if (abs >= 1024 ** 2) return `${formatNumber(bytes / 1024 ** 2, 2)} MB`;
  if (abs >= 1024) return `${formatNumber(bytes / 1024, 2)} KB`;
  return `${formatNumber(bytes, 0)} B`;
}

export function formatMicroseconds(us: number): string {
  if (!Number.isFinite(us)) return '∞';
  if (Math.abs(us) >= 1_000_000) return `${formatNumber(us / 1_000_000, 2)} s`;
  return `${formatNumber(us / 1000, 2)} ms`;
}

export function percentage(part: number, whole: number): number {
  if (!Number.isFinite(whole) || whole <= 0) return 0;
  return Math.min(100, Math.max(0, (part / whole) * 100));
}

export function shortenKey(key: string, head = 8, tail = 6): string {
  return key.length <= head + tail + 1 ? key : `${key.slice(0, head)}…${key.slice(-tail)}`;
}
