/* Mus bot: picks a move for one seat, from its own cards, what is public, and the signs it caught. */
'use strict';
const E = require('./engine.js');

const rnd = () => Math.random();
const count = (h, v) => h.filter(c => E.gv(c) === v).length;

// How good a hand is for each lance, from 0 (hopeless) to 1 (almost sure to win).
function strength(h, i, punto) {
  if (i === 0) { const k = count(h, 12), c = count(h, 11); return [0.12, 0.38, 0.66, 0.88, 0.97][k] + Math.min(c, 2) * 0.04; }
  if (i === 1) { const a = count(h, 1), f = count(h, 4); return [0.12, 0.38, 0.66, 0.88, 0.97][a] + Math.min(f, 2) * 0.04; }
  if (i === 2) {
    const p = E.paresOf(h);
    if (!p) return 0;
    if (p.t === 3) return p.k[0] === 12 ? 0.95 : 0.85;
    if (p.t === 2) return 0.68 + p.k[0] / 12 * 0.14;
    return 0.3 + p.k[0] / 12 * 0.25;
  }
  const t = E.total(h);
  if (punto) return Math.max(0, (t - 18) / 12) * 0.9;
  return { 31: 0.95, 32: 0.78, 40: 0.6, 37: 0.5, 36: 0.45, 35: 0.42, 34: 0.4, 33: 0.38 }[t] || 0;
}

// What a caught sign says about a hand, per lance (null = the sign says nothing about it).
const SIGN_STRENGTH = {
  kings2: [0.66, null, 0.45, null], kings3: [0.88, null, 0.7, null],
  aces2: [null, 0.66, 0.45, null], aces3: [null, 0.88, 0.7, null],
  mediak: [null, null, 0.75, null], dupleak: [null, null, 0.9, null],
  juego31: [null, null, null, 0.95], bonita: [0.88, 0.4, 0.7, 0.97],
  thirty: [null, null, null, 0.9], twentynine: [null, null, null, 0.75],
  itsuarena: [0.15, 0.25, 0, 0.1]
};
const signSays = (sign, i) => (SIGN_STRENGTH[sign] || [])[i] ?? null;

// The team's and the opponents' expected strength in this lance, from what this bot knows.
function picture(st, seat, know) {
  const i = st.lanceIdx, me = strength(st.hands[seat], i, st.punto);
  const partner = (seat + 2) % 4, signs = (know && know.signs) || {};
  let team = me, opp = 0.35;
  const ps = signs[partner] && signSays(signs[partner], i);
  if (ps !== null && ps !== undefined) team = Math.max(me, ps);
  const oppSeen = [(seat + 1) % 4, (seat + 3) % 4].map(x => signs[x] && signSays(signs[x], i)).filter(v => v !== null && v !== undefined);
  if (oppSeen.length) opp = Math.max(...oppSeen);
  // public declarations: an opponent without pares/juego can't win that lance
  if (i === 2 && st.decl && st.decl.pares) { if (![1, 3].some(d => st.decl.pares[(seat + d) % 4])) opp = 0; }
  if (i === 3 && !st.punto && st.decl && st.decl.juego) { if (![1, 3].some(d => st.decl.juego[(seat + d) % 4])) opp = 0; }
  return { me, team, opp, partnerSign: signs[partner] || null };
}

function musDecision(st, seat, know) {
  const h = st.hands[seat], p = E.paresOf(h), t = E.total(h), k = count(h, 12);
  let keep = (p && p.t >= 2) || t === 31 || t === 32 || k >= 3 || (p && p.t === 1 && p.k[0] >= 11 && t >= 31);
  // a partner who signalled a big hand: don't give the opponents a new deal
  const ps = know && know.signs && know.signs[(seat + 2) % 4];
  if (ps && ['kings3', 'aces3', 'dupleak', 'juego31', 'bonita', 'mediak'].includes(ps)) keep = true;
  if (rnd() < 0.08) keep = !keep;
  return !keep; // true = "Mus"
}

function discardChoice(h) {
  const p = E.paresOf(h), pairVals = p ? p.k : [];
  let idx = h.map((c, k) => k).filter(k => { const v = E.gv(h[k]); return v !== 12 && !(pairVals.includes(v) && v >= 10); });
  if (!idx.length) { let worst = 0; h.forEach((c, k) => { if (E.gv(c) < E.gv(h[worst])) worst = k; }); idx = [worst]; }
  return idx;
}

function lanceMove(st, seat, know) {
  const L = st.lance, b = L.bet, mine = E.team(seat), them = 1 - mine;
  const { me, team, opp, partnerSign } = picture(st, seat, know);
  const pos = L.order.indexOf(seat), late = pos >= 2;               // later speakers know more
  const edge = team - opp * 0.5 + (seat === st.mano ? 0.04 : 0) + (rnd() - 0.5) * 0.08;
  const toWin = st.target - st.score[them], ourToWin = st.target - st.score[mine];

  if (!b) {
    if (edge > 0.62 && (team > 0.9 || ourToWin <= 8) && rnd() < 0.14) return { t: 'ordago', s: seat };
    if (edge > 0.47) return { t: 'bet', s: seat, n: edge > 0.68 ? 2 + Math.floor(rnd() * 3) : 2 };
    // bluffs: more often late, or when the partner signalled something for this lance
    const bluff = (late ? 0.22 : 0.1) + (partnerSign && signSays(partnerSign, st.lanceIdx) > 0.6 ? 0.15 : 0);
    if (opp < 0.7 && rnd() < bluff) return { t: 'bet', s: seat, n: rnd() < 0.7 ? 2 : 3 };
    return { t: 'pass', s: seat };
  }
  // refusing hands the opponents b.prev points; if that wins them the game, refusing is pointless
  const refuseLoses = b.prev >= toWin;
  if (b.ordago) {
    if (refuseLoses) return { t: 'quiero', s: seat };
    const behind = st.score[them] - st.score[mine];
    return { t: edge > 0.62 || (edge > 0.45 && behind > 15) ? 'quiero' : 'noquiero', s: seat };
  }
  if (edge > 0.66 && b.stake < 12 && rnd() < 0.35) return { t: 'raise', s: seat, n: 2 + Math.floor(rnd() * 2) };
  if (edge > 0.58 && rnd() < 0.05) return { t: 'ordago', s: seat };
  if (refuseLoses) return { t: 'quiero', s: seat };
  // re-bluff now and then against a bet when the opponents haven't shown strength
  if (opp < 0.55 && late && rnd() < 0.08) return { t: 'raise', s: seat, n: 2 };
  return { t: edge > 0.32 + Math.min(b.stake, 12) * 0.02 ? 'quiero' : 'noquiero', s: seat };
}

// Returns the action for `seat`, or null if this seat has nothing to do.
function move(st, seat, know) {
  const h = st.hands[seat];
  if (st.phase === 'mus' && st.musTurn === seat) return { t: 'mus', s: seat, yes: musDecision(st, seat, know) };
  if (st.phase === 'discard' && !st.discardSel[seat]) return { t: 'discard', s: seat, idx: discardChoice(h) };
  if (st.phase === 'lance' && st.lance && st.lance.turn === seat) return lanceMove(st, seat, know);
  return null;
}

// Bots make a sign to their partner most hands: a true one.
function maybeSign(st, seat) {
  const opts = E.signsFor(st.hands[seat]);
  if (!opts.length || rnd() > 0.65) return null;
  return opts[Math.floor(rnd() * opts.length)];
}

// Chance that a bot catches a sign: partners watch each other closely, opponents less so.
const catchChance = (bot, signer) => (E.team(bot) === E.team(signer) ? 0.8 : 0.5);

module.exports = { move, maybeSign, strength, catchChance, SIGN_STRENGTH };
