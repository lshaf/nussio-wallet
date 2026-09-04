const VOTE_WEIGHT_EPOCH_SECONDS = 946_684_800;
const SECONDS_PER_WEEK = 7 * 24 * 3600;

export function voteWeightMultiplier(periodWeeks: number, nowSeconds = Date.now() / 1000): number {
  const weeks = (nowSeconds - VOTE_WEIGHT_EPOCH_SECONDS) / SECONDS_PER_WEEK;
  return 2 ** (weeks / periodWeeks);
}

export function voteEffectiveness(
  lastVoteWeight: number,
  proxiedVoteWeight: number,
  stakedUnits: number,
  periodWeeks: number,
  nowSeconds = Date.now() / 1000,
): number | undefined {
  if (stakedUnits <= 0 || lastVoteWeight <= 0) return undefined;
  const full = stakedUnits * voteWeightMultiplier(periodWeeks, nowSeconds);
  const own = lastVoteWeight - proxiedVoteWeight;
  return Math.min(100, Math.max(0, (own / full) * 100));
}

export function voteWeightValue(
  lastVoteWeight: number,
  periodWeeks: number,
  precision: number,
  nowSeconds = Date.now() / 1000,
): number {
  return lastVoteWeight / voteWeightMultiplier(periodWeeks, nowSeconds) / 10 ** precision;
}
