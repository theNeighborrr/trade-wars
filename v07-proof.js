/* Leaderboard wire format. Contains decisions, never trusted account balances. */
export const PROOF_VERSION = 1;
export const LEADERBOARD_RULES = '0.6.0';
export const MAX_ACTIONS = 1200;
export class ProofError extends Error {}
const fail = message => { throw new ProofError(message); };
const object = v => v && typeof v === 'object' && !Array.isArray(v);
export function boardMeta(input, today = new Date().toISOString().slice(0,10)) {
  if (!object(input) || input.rules !== LEADERBOARD_RULES) fail('This rules version is not supported by the leaderboard.');
  const {mode, seed, specialty} = input;
  if (!['daily','free'].includes(mode) || !['independent','logistics','grid'].includes(specialty)) fail('Invalid competition setup.');
  if (typeof seed !== 'string' || !/^[-_a-zA-Z0-9]{1,48}$/.test(seed)) fail('Invalid scenario seed.');
  let date = null;
  if (mode === 'daily') {
    date = input.challengeDate;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '2026-09-20' || date > today) fail('That daily edition is not available yet or has an invalid date.');
    const parsed = new Date(date+'T00:00:00Z');
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== date || specialty !== 'independent' || seed !== 'DAILY-'+date) fail('Daily challenges require the matching date, seed and Independent setup.');
  } else if (input.challengeDate != null) fail('Free scenarios cannot have a daily challenge date.');
  return {rules:LEADERBOARD_RULES, mode, seed, specialty, challengeDate:date,
    boardKey: mode === 'daily' ? `daily|${LEADERBOARD_RULES}|${date}` : `free|${LEADERBOARD_RULES}|${specialty}|${seed}`};
}
export function eligibility(state) {
  if (!state || state.version !== 6 || state.worldRules !== LEADERBOARD_RULES || state.rules !== LEADERBOARD_RULES || state.migrated || state.legacyRules || state.coverageStart !== 1 || state.worldStartDay !== 1)
    return 'Only full Trading Houses campaigns using rules 0.6.0 can be replay-validated. Your preserved older run remains playable.';
  if (!state.finished || state.day !== 30) return 'Finish Day 30 and close the campaign before submitting a score.';
  return '';
}
export function submissionFor(state, report) {
  const why = eligibility(state); if (why) fail(why);
  const meta = boardMeta({rules:state.worldRules, mode:state.mode, seed:state.seed, specialty:state.company.specialty, challengeDate:state.challengeDate});
  if (!Array.isArray(state.journal) || state.journal.length > MAX_ACTIONS) fail('This run exceeds the leaderboard action limit. It can still be played and exported.');
  const actions = []; let day = 1, sequence = 0;
  const add = a => { actions.push(a); if (actions.length > MAX_ACTIONS) fail('This run exceeds the leaderboard action limit.'); };
  // The v0.6 journal recorded every economic action, but not quiet next-day clicks.
  // Fill only those gaps. Travel already advances a day. Automatic forfeits are
  // recomputed by the server on advancing/closing, not accepted as commands.
  for (const r of state.journal) {
    if (!object(r) || !Number.isInteger(r.day) || r.day < day || r.day > 30 || r.id !== ++sequence) fail('The recorded journal is incomplete or out of order.');
    while (day < r.day) { add({type:'advance'}); day++; }
    switch (r.type) {
      case 'buy': case 'sell': add({type:r.type, asset:r.assetId, qty:r.qty}); break;
      case 'travel': add({type:'travel', hub:r.toHub}); day++; break;
      case 'bond': add({type:'accept', id:r.contractId}); break;
      case 'delivery': add({type:'deliver', id:r.contractId}); break;
      case 'upgrade': add({type:'upgrade', id:r.upgradeId}); break;
      case 'forfeit':
        if (typeof r.message !== 'string') fail('Unrecognized forfeiture record.');
        if (r.message.startsWith('Cancelled: ')) add({type:'cancel', id:r.contractId});
        else if (!r.message.startsWith('Deadline missed: ') && !r.message.startsWith('Campaign closed before delivery: ')) fail('Unrecognized forfeiture record.');
        break;
      default: fail('The journal contains an unsupported action.');
    }
  }
  if (day > 30) fail('The run travels past its final day.');
  while (day < 30) { add({type:'advance'}); day++; }
  add({type:'close'});
  const fields=['worth','cash','inventory','startingCash','realized','contractProfit','travelCosts','upgradeCosts','forfeits','unrealized','escrow','trades','deliveries'];
  const expected = Object.fromEntries(fields.map(k => [k,report[k]]));
  return {proofVersion:PROOF_VERSION, meta, companyName:state.company.name, actions, expected,
    final:{hub:state.currentHub, holdings:{...state.holdings}, avgCosts:{...state.avgCosts}}};
}
