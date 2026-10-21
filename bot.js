/* Mus bot: picks a move for one seat, using only that seat's own cards and what is public. */
'use strict';
const E = require('./engine.js');

const rnd = () => Math.random();
const count = (h, v) => h.filter(c => E.gv(c) === v).length;

// How good the hand is for each lance, from 0 (hopeless) to 1 (almost sure to win).
function strength(h, i, punto) {
  if (i === 0) { // grande: kings, then horses
    const k = count(h, 12), c = count(h, 11);
    return [0.12, 0.38, 0.66, 0.88, 0.97][k] + Math.min(c, 2) * 0.04;
  }
  if (i === 1) { // chica: aces, then fours
    const a = count(h, 1), f = count(h, 4);
    return [0.12, 0.38, 0.66, 0.88, 0.97][a] + Math.min(f, 2) * 0.04;
  }
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

function musDecision(h) {
  const p = E.paresOf(h), t = E.total(h), k = count(h, 12);
  let keep = (p && p.t >= 2) || t === 31 || t === 32 || k >= 3 || (p && p.t === 1 && p.k[0] >= 11 && t >= 31);
  if (rnd() < 0.1) keep = !keep; // a little unpredictability
  return !keep; // true = "Mus"
}

function discardChoice(h) {
  const p = E.paresOf(h);
  const pairVals = p ? p.k : [];
  let idx = h.map((c, k) => k).filter(k => {
    const v = E.gv(h[k]);
    return v !== 12 && !(pairVals.includes(v) && v >= 10);
  });
  if (!idx.length) { // everything is worth keeping: change the weakest card
    let worst = 0; h.forEach((c, k) => { if (E.gv(c) < E.gv(h[worst])) worst = k; });
    idx = [worst];
  }
  return idx;
}

function lanceMove(st, seat) {
  const L = st.lance, i = st.lanceIdx, h = st.hands[seat];
  let sc = strength(h, i, st.punto);
  if (seat === st.mano) sc += 0.04;
  sc += (rnd() - 0.5) * 0.1;
  const b = L.bet;
  if (!b) {
    if (sc > 0.9 && rnd() < 0.12) return { t: 'ordago', s: seat };
    if (sc > 0.62) return { t: 'bet', s: seat, n: sc > 0.82 ? (rnd() < 0.5 ? 3 : 2) : 2 };
    if (sc > 0.45 && rnd() < 0.15) return { t: 'bet', s: seat, n: 2 }; // occasional bluff
    return { t: 'pass', s: seat };
  }
  if (b.ordago) {
    const mine = E.team(seat), behind = st.score[1 - mine] - st.score[mine];
    return { t: sc > 0.86 || (sc > 0.72 && behind > 15) ? 'quiero' : 'noquiero', s: seat };
  }
  if (sc > 0.86 && b.stake < 10 && rnd() < 0.35) return { t: 'raise', s: seat, n: 2 };
  return { t: sc > 0.5 + Math.min(b.stake, 12) * 0.02 ? 'quiero' : 'noquiero', s: seat };
}

// Returns the action for `seat`, or null if this seat has nothing to do.
function move(st, seat) {
  const h = st.hands[seat];
  if (st.phase === 'mus' && st.musTurn === seat) return { t: 'mus', s: seat, yes: musDecision(h) };
  if (st.phase === 'discard' && !st.discardSel[seat]) return { t: 'discard', s: seat, idx: discardChoice(h) };
  if (st.phase === 'lance' && st.lance && st.lance.turn === seat) return lanceMove(st, seat);
  return null;
}

// Bots sometimes make a sign to their partner: a random true one.
function maybeSign(st, seat) {
  const opts = E.signsFor(st.hands[seat]);
  if (!opts.length || rnd() > 0.4) return null;
  return opts[Math.floor(rnd() * opts.length)];
}

module.exports = { move, maybeSign, strength };
