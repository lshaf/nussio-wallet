export interface RamMarket {
  baseBytes: number;
  quoteUnits: number;
  symbol: string;
  precision: number;
}

export const RAM_FEE = 0.995;
export const RAM_BUFFER = 1.005;

function units(tokens: number, precision: number): number {
  return tokens * 10 ** precision;
}

function tokens(value: number, precision: number): number {
  return value / 10 ** precision;
}

export function ramPricePerByte(market: RamMarket): number {
  return tokens(market.quoteUnits / market.baseBytes, market.precision);
}

export function ramCostForBytes(market: RamMarket, bytes: number): number {
  if (bytes <= 0 || bytes >= market.baseBytes) return 0;
  const cost = (market.quoteUnits * bytes) / (market.baseBytes - bytes);
  return tokens(Math.ceil(cost * RAM_BUFFER), market.precision);
}

export function ramBytesForTokens(market: RamMarket, amount: number): number {
  if (amount <= 0) return 0;
  const spend = units(amount, market.precision) * RAM_FEE;
  return Math.floor((market.baseBytes * spend) / (market.quoteUnits + spend));
}

export function ramProceedsForBytes(market: RamMarket, bytes: number): number {
  if (bytes <= 0) return 0;
  const proceeds = (market.quoteUnits * bytes) / (market.baseBytes + bytes);
  return tokens(Math.floor(proceeds * RAM_FEE), market.precision);
}
