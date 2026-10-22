/* Mus rules engine: shared by the server (authoritative) and the browser (hand info). */
(function (root) {
'use strict';
const LNAME = ['Grande', 'Chica', 'Pares', 'Juego'];
const JORD = [31, 32, 40, 37, 36, 35, 34, 33];
const DEFAULT_TEAMS = ['Gorriak', 'Berdeak'];
const team = s => s % 2;
const rot = m => [0, 1, 2, 3].map(i => (m + i) % 4);

/* ---------- randomness (cryptographic where available) ---------- */
function rint(n) {
  const c = typeof globalThis !== 'undefined' && globalThis.crypto;
  if (c && c.getRandomValues) {
    const lim = Math.floor(0x100000000 / n) * n, buf = new Uint32Array(1);
    do c.getRandomValues(buf); while (buf[0] >= lim);
    return buf[0] % n;
  }
  return Math.floor(Math.random() * n);
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rint(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* ---------- cards: 8 reyes (12 and 3) and 8 ases (1 and 2) ---------- */
const SUITS = ['o', 'c', 'e', 'b'];
const RANKS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
const rk = c => +c.slice(1);
const gv = c => { const r = rk(c); return r === 3 ? 12 : r === 2 ? 1 : r; };
const pv = c => { const v = gv(c); return v >= 10 ? 10 : v; };
const total = h => h.reduce((a, c) => a + pv(c), 0);
const lex = (a, b) => { for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
const newDeck = () => shuffle(SUITS.flatMap(s => RANKS.map(r => s + r)));
function paresOf(h) {
  const cnt = {}; h.forEach(c => { const v = gv(c); cnt[v] = (cnt[v] || 0) + 1; });
  const e = Object.entries(cnt).map(([v, n]) => [+v, n]).filter(x => x[1] >= 2).sort((a, b) => b[0] - a[0]);
  if (!e.length) return null;
  if (e[0][1] === 4) return { t: 3, k: [e[0][0], e[0][0]] };
  if (e.length === 2) return { t: 3, k: [e[0][0], e[1][0]] };
  if (e[0][1] === 3) return { t: 2, k: [e[0][0]] };
  return { t: 1, k: [e[0][0]] };
}
const RNAME = { 12: 'reyes', 11: 'caballos', 10: 'sotas', 7: 'sietes', 6: 'seises', 5: 'cincos', 4: 'cuatros', 1: 'ases' };
function paresText(p) { if (!p) return 'no pares'; return p.t === 3 ? 'duples' : p.t === 2 ? 'medias de ' + RNAME[p.k[0]] : 'par de ' + RNAME[p.k[0]]; }
const jr = n => { const i = JORD.indexOf(n); return i < 0 ? 99 : i; };
function better(i, punto, a, b) {
  if (i === 0) return lex(a.map(gv).sort((x, y) => y - x), b.map(gv).sort((x, y) => y - x)) > 0;
  if (i === 1) return lex(a.map(gv).sort((x, y) => x - y), b.map(gv).sort((x, y) => x - y)) < 0;
  if (i === 2) { const pa = paresOf(a), pb = paresOf(b); if (!pa) return false; if (!pb) return true; if (pa.t !== pb.t) return pa.t > pb.t; return lex(pa.k, pb.k) > 0; }
  return punto ? total(a) > total(b) : jr(total(a)) < jr(total(b));
}

/* ---------- state ---------- */
function fresh() {
  return { v: 2, rev: 0, seats: [null, null, null, null], score: [0, 0], games: [0, 0], target: 40,
    cfg: { bestOf: 1, scoring: 'auto' }, teamNames: DEFAULT_TEAMS.slice(), handNo: 0,
    phase: 'waiting', dealer: 3, mano: 0, hands: [[], [], [], []], deck: [], discards: [],
    musTurn: 0, musCount: 0, discardSel: [null, null, null, null], lanceIdx: 0, lance: null,
    results: [null, null, null, null], punto: false, said: [null, null, null, null],
    decl: { pares: null, juego: null }, reveal: false, summary: [], winner: null,
    matchWinner: null, ordagoPend: null, log: [],
    handId: null, dealLog: null, recordedHand: null };
}
const tn = (s, t) => (s.teamNames && s.teamNames[t]) || DEFAULT_TEAMS[t];
const nm = (s, i) => (s.seats[i] && s.seats[i].nick) || 'Seat ' + (i + 1);
const lname = (s, i) => i === 3 && s.punto ? 'Punto' : LNAME[i];
const manual = s => s.cfg && s.cfg.scoring === 'manual';
const gamesToWin = s => Math.floor(((s.cfg && s.cfg.bestOf) || 1) / 2) + 1;
function L(s, x) { s.log.push({ t: Date.now(), x }); if (s.log.length > 60) s.log.splice(0, s.log.length - 60); }

function deal(s) {
  s.dealer = (s.dealer + 1) % 4; s.mano = (s.dealer + 1) % 4; s.handNo = (s.handNo || 0) + 1;
  const d = newDeck();
  s.hands = [0, 1, 2, 3].map(() => d.splice(d.length - 4, 4)); s.deck = d; s.discards = [];
  s.handId = Date.now().toString(36) + '-' + rint(1e9).toString(36);
  s.dealLog = [{ hands: s.hands.map(h => h.slice()) }];
  Object.assign(s, { phase: 'mus', musTurn: s.mano, musCount: 0, discardSel: [null, null, null, null], lanceIdx: 0, lance: null,
    results: [null, null, null, null], punto: false, said: [null, null, null, null], decl: { pares: null, juego: null },
    reveal: false, summary: [], winner: null, ordagoPend: null, lastDraw: null, prevSaid: null });
  L(s, `Hand ${s.handNo}. ${nm(s, s.dealer)} deals; ${nm(s, s.mano)}, on the dealer's right, is mano and speaks first.`);
}
function eligFor(s, i) {
  const all = rot(s.mano);
  if (i < 2) return all;
  if (i === 2) return all.filter(x => paresOf(s.hands[x]));
  const j = all.filter(x => total(s.hands[x]) >= 31);
  return j.length ? j : all;
}
function bestSeat(s, i) {
  let b = null;
  for (const x of eligFor(s, i)) if (b === null || better(i, s.punto, s.hands[x], s.hands[b])) b = x;
  return b;
}
function startLance(s, i) {
  s.prevSaid = s.said.slice();
  s.said = [null, null, null, null];
  if (i > 3) return endHand(s);
  s.lanceIdx = i; s.phase = 'lance';
  if (i === 2) {
    const e = eligFor(s, 2);
    s.decl.pares = [0, 1, 2, 3].map(x => !!paresOf(s.hands[x]));
    L(s, 'Pares: ' + rot(s.mano).map(x => `${nm(s, x)} ${s.decl.pares[x] ? 'sí' : 'no'}`).join(', ') + '.');
    if (new Set(e.map(team)).size < 2) { s.results[2] = { s: e.length ? 'nobet' : 'none' }; return startLance(s, 3); }
  }
  if (i === 3) {
    s.decl.juego = [0, 1, 2, 3].map(x => total(s.hands[x]) >= 31);
    s.punto = !s.decl.juego.some(Boolean);
    L(s, s.punto ? 'Juego: nobody has juego. Playing Punto.' : 'Juego: ' + rot(s.mano).map(x => `${nm(s, x)} ${s.decl.juego[x] ? 'sí' : 'no'}`).join(', ') + '.');
    if (!s.punto && new Set(eligFor(s, 3).map(team)).size < 2) { s.results[3] = { s: 'nobet' }; return endHand(s); }
  }
  const order = eligFor(s, i);
  s.lance = { order, idx: 0, bet: null, resp: [], ri: 0, turn: order[0] };
}
function oppsAfter(s, x) {
  const o = s.lance.order, k = o.indexOf(x);
  return [...o.slice(k + 1), ...o.slice(0, k + 1)].filter(y => team(y) !== team(x));
}
function addPts(s, t, n) { s.score[t] = Math.max(0, s.score[t] + n); return s.score[t] >= s.target; }
function finishGame(s, t) {
  s.winner = t; s.games[t]++; s.phase = 'gameEnd'; s.reveal = true; s.lance = null; s.ordagoPend = null;
  s.score[t] = Math.max(s.score[t], s.target);
  if (s.games[t] >= gamesToWin(s)) { s.matchWinner = t; L(s, `${tn(s, t)} win the game and the match, ${s.games[0]}–${s.games[1]}!`); }
  else L(s, `${tn(s, t)} win the game. Games: ${tn(s, 0)} ${s.games[0]} – ${s.games[1]} ${tn(s, 1)}.`);
}
function endHand(s) {
  s.reveal = true; s.lance = null; s.prevSaid = s.said.slice(); s.said = [null, null, null, null]; s.summary = [];
  if (manual(s)) { s.phase = 'handEnd'; L(s, 'Hand over. Count the points and move the coins.'); return; }
  const lines = [];
  for (let i = 0; i < 4; i++) {
    const r = s.results[i]; if (!r || r.s === 'none') continue;
    const w = bestSeat(s, i); if (w === null) continue;
    const t = team(w); let n = 0, why = '';
    if (i < 2) {
      if (r.s === 'rechazado') continue;
      n = r.s === 'paso' ? 1 : r.stake; why = r.s === 'paso' ? 'en paso' : 'querido';
    } else if (i === 2) {
      const bonus = [t, t + 2].reduce((a, x) => { const p = paresOf(s.hands[x]); return a + (p ? p.t : 0); }, 0);
      n = (r.s === 'querido' ? r.stake : 0) + bonus; why = (r.s === 'querido' ? `${r.stake} querido + ` : '') + `${bonus} for pairs`;
    } else if (s.punto) {
      n = (r.s === 'paso' ? 1 : r.s === 'querido' ? r.stake : 0) + 1; why = r.s === 'querido' ? `${r.stake} querido + 1` : r.s === 'paso' ? 'en paso + 1' : '1 for punto';
    } else {
      const bonus = [t, t + 2].reduce((a, x) => { const v = total(s.hands[x]); return a + (v === 31 ? 3 : v >= 31 ? 2 : 0); }, 0);
      n = (r.s === 'querido' ? r.stake : 0) + bonus; why = (r.s === 'querido' ? `${r.stake} querido + ` : '') + `${bonus} for juego`;
    }
    if (n > 0) lines.push({ l: lname(s, i), w, t, n, why });
  }
  for (const ln of lines) {
    s.summary.push({ l: ln.l, who: nm(s, ln.w), t: ln.t, n: ln.n, why: ln.why });
    if (addPts(s, ln.t, ln.n)) { finishGame(s, ln.t); return; }
  }
  s.phase = 'handEnd';
  L(s, 'Hand over. ' + (s.summary.length ? s.summary.map(x => `${x.l} +${x.n} ${tn(s, x.t)}`).join(', ') : 'No points.'));
}

/* Replace discarded cards. Discards go to a pile (the bottom of the deck); when the deck
   runs out, the pile is shuffled into a new deck, except the cards the player being served
   has just thrown away. */
function replaceDiscards(s) {
  const own = [[], [], [], []];
  for (const x of rot(s.mano)) {
    s.hands[x] = s.hands[x].filter((c, k) => { if (s.discardSel[x].includes(k)) { own[x].push(c); return false; } return true; });
  }
  let pile = s.discards.concat(...rot(s.mano).map(x => own[x]));
  let reshuffled = false;
  for (const x of rot(s.mano)) {
    while (s.hands[x].length < 4) {
      if (!s.deck.length) {
        const usable = pile.filter(c => !own[x].includes(c));
        if (!usable.length) break;
        s.deck = shuffle(usable); pile = pile.filter(c => own[x].includes(c)); reshuffled = true;
      }
      s.hands[x].push(s.deck.pop());
    }
  }
  s.discards = pile;
  return reshuffled;
}

/* apply one action; returns an error string or nothing */
const FREE_ACTIONS = ['look', 'sit', 'start', 'next', 'newgame', 'reset', 'nick', 'free', 'teamName', 'cfg', 'adj', 'award', 'addBot'];
const BOT_NAMES = ['Txomin', 'Miren', 'Patxi', 'Amaia', 'Koldo', 'Nerea'];
const isBot = seat => !!(seat && seat.bot);
function act(s, a, uid) {
  const own = x => s.seats[x] && s.seats[x].uid === uid;
  const seated = s.seats.some(x => x && x.uid === uid);
  if (!FREE_ACTIONS.includes(a.t) && !own(a.s)) return 'That seat is not yours.';
  if (['start', 'next', 'newgame', 'reset', 'teamName', 'cfg', 'adj', 'award', 'free'].includes(a.t) && !seated) return 'Take a seat first.';
  const i = s.lanceIdx, Lc = s.lance;
  switch (a.t) {
    case 'sit':
      if (s.seats[a.s]) return 'Someone took that seat.';
      s.seats[a.s] = { uid, nick: a.nick, look: cleanLook(a.look) }; L(s, `${a.nick} sits in seat ${a.s + 1} (${tn(s, team(a.s))}).`); return;
    case 'stand': L(s, `${nm(s, a.s)} leaves seat ${a.s + 1}.`); s.seats[a.s] = null; return;
    case 'free':
      if (!s.seats[a.s]) return;
      if (isBot(s.seats[a.s]) && !['waiting', 'handEnd', 'gameEnd'].includes(s.phase)) return 'Remove bots between hands.';
      L(s, isBot(s.seats[a.s]) ? `${nm(s, a.s)} (bot) left the table.` : `Seat ${a.s + 1} (${nm(s, a.s)}) was freed.`); s.seats[a.s] = null; return;
    case 'addBot': {
      if (s.seats[a.s]) return 'That seat is taken.';
      if (s.seats.filter(isBot).length >= 3) return 'A table can have at most 3 bots.';
      const used = s.seats.filter(Boolean).map(x => x.nick);
      const name = BOT_NAMES.find(n => !used.includes(n)) || 'Bot';
      s.seats[a.s] = { uid: 'bot:' + a.s + ':' + rint(1e9), nick: name, bot: true, look: randomLook() };
      L(s, `${name} (bot) sits in seat ${a.s + 1} (${tn(s, team(a.s))}).`); return;
    }
    case 'nick': s.seats.forEach(x => { if (x && x.uid === uid) x.nick = a.nick; }); return;
    case 'look': s.seats.forEach(x => { if (x && x.uid === uid && !x.bot) x.look = cleanLook(a.look); }); return;
    case 'teamName': {
      const t = a.team === 1 ? 1 : 0, name = String(a.name || '').trim().slice(0, 20);
      if (!name) return 'Team names cannot be empty.';
      L(s, `${tn(s, t)} are now called ${name}.`); s.teamNames[t] = name; return;
    }
    case 'cfg': {
      const busy = !['waiting', 'gameEnd'].includes(s.phase) || (s.games[0] + s.games[1] > 0 && s.matchWinner === null);
      if (busy) return 'Change the match settings between matches.';
      const bo = Math.floor(+a.bestOf); if (bo >= 1 && bo <= 21 && bo % 2 === 1) s.cfg.bestOf = bo;
      if (a.scoring === 'auto' || a.scoring === 'manual') s.cfg.scoring = a.scoring;
      L(s, `Match: best of ${s.cfg.bestOf}, ${s.cfg.scoring === 'auto' ? 'points counted automatically' : 'players count the points'}.`); return;
    }
    case 'adj': {
      const t = a.team === 1 ? 1 : 0, n = Math.floor(+a.n);
      if (![1, 5, -1, -5].includes(n)) return 'Unknown amount.';
      if (['waiting', 'gameEnd'].includes(s.phase)) return 'No game in progress.';
      addPts(s, t, n); L(s, `${n > 0 ? '+' : ''}${n} to ${tn(s, t)} (${s.score[t]}).`); return;
    }
    case 'award': {
      if (s.phase !== 'handEnd') return 'Finish the hand first.';
      finishGame(s, a.team === 1 ? 1 : 0); return;
    }
    case 'start':
      if (!['waiting', 'gameEnd', 'handEnd'].includes(s.phase)) return 'A hand is already being played.';
      if (s.seats.some(x => !x)) return 'All four seats must be taken.';
      if (s.phase === 'gameEnd') return act(s, { t: 'newgame' }, uid);
      deal(s); return;
    case 'next': {
      if (s.phase !== 'handEnd') return 'The hand is not over yet.';
      if (s.ordagoPend) return 'Say who won the órdago first.';
      const over = [0, 1].filter(t => s.score[t] >= s.target).sort((x, y) => s.score[y] - s.score[x]);
      if (over.length) { finishGame(s, over[0]); return; }
      if (s.seats.some(x => !x)) { s.phase = 'waiting'; return; }
      deal(s); return;
    }
    case 'newgame':
      if (s.phase !== 'gameEnd') return 'The game is not over yet.';
      s.score = [0, 0]; s.winner = null;
      if (s.matchWinner !== null) { s.games = [0, 0]; s.matchWinner = null; L(s, 'New match.'); }
      if (s.seats.some(x => !x)) { s.phase = 'waiting'; return; }
      deal(s); return;
    case 'reset': {
      const keep = { seats: s.seats, log: s.log, cfg: s.cfg, teamNames: s.teamNames };
      Object.assign(s, fresh(), keep); L(s, 'The table was reset.'); return;
    }
    case 'mus':
      if (s.phase !== 'mus' || s.musTurn !== a.s) return 'Not your turn.';
      if (a.yes) {
        s.said[a.s] = 'Mus'; s.musCount++;
        if (s.musCount >= 4) { s.phase = 'discard'; s.discardSel = [null, null, null, null]; L(s, 'Mus! Everyone discards.'); }
        else s.musTurn = (a.s + 1) % 4;
      } else {
        L(s, `${nm(s, a.s)}: no hay mus.`); startLance(s, 0); s.said[a.s] = 'No hay mus';
      }
      return;
    case 'discard': {
      if (s.phase !== 'discard' || s.discardSel[a.s]) return 'You already discarded.';
      const idx = [...new Set(a.idx)].map(Number).filter(n => n >= 0 && n < 4);
      if (!idx.length) return 'Pick at least one card.';
      s.discardSel[a.s] = idx; s.said[a.s] = `Descarta ${idx.length}`;
      if (s.discardSel.every(x => x)) {
        const counts = rot(s.mano).map(x => `${nm(s, x)} ${s.discardSel[x].length}`).join(', ');
        const last = s.dealLog && s.dealLog[s.dealLog.length - 1];
        if (last) last.discards = s.discardSel.map((idx, x) => idx.map(k => s.hands[x][k]));
        s.lastDraw = { round: s.dealLog ? s.dealLog.length : 1, counts: s.discardSel.map(i => i.length) };
        const re = replaceDiscards(s);
        if (s.dealLog) s.dealLog.push({ hands: s.hands.map(h => h.slice()) });
        L(s, (re ? 'The deck ran out, so the discards were shuffled into a new deck. ' : '') + `New cards: ${counts}.`);
        Object.assign(s, { phase: 'mus', musTurn: s.mano, musCount: 0, discardSel: [null, null, null, null], said: [null, null, null, null] });
      }
      return;
    }
  }
  if (s.phase !== 'lance' || !Lc || Lc.turn !== a.s) return 'Not your turn.';
  const who = nm(s, a.s);
  switch (a.t) {
    case 'pass':
      if (Lc.bet) return 'There is a bet to answer.';
      s.said[a.s] = 'Paso'; Lc.idx++;
      if (Lc.idx >= Lc.order.length) { s.results[i] = { s: 'paso' }; L(s, `${lname(s, i)} en paso.`); startLance(s, i + 1); }
      else Lc.turn = Lc.order[Lc.idx];
      return;
    case 'bet': case 'raise': case 'ordago': {
      const n = Math.max(1, Math.min(40, Math.floor(+a.n || 2)));
      if (a.t === 'bet' && Lc.bet) return 'There is already a bet.';
      if (a.t === 'raise' && (!Lc.bet || Lc.bet.ordago)) return 'Nothing to raise.';
      if (a.t === 'ordago' && Lc.bet && Lc.bet.ordago) return 'Órdago is already on.';
      if (a.t === 'bet') { Lc.bet = { stake: n, prev: 1, team: team(a.s), ordago: false }; s.said[a.s] = `Envido ${n}`; L(s, `${who}: envido ${n} a la ${lname(s, i).toLowerCase()}.`); }
      else if (a.t === 'raise') { Lc.bet = { stake: Lc.bet.stake + n, prev: Lc.bet.stake, team: team(a.s), ordago: false }; s.said[a.s] = `${n} más`; L(s, `${who}: ${n} más (${Lc.bet.stake} on the table).`); }
      else { Lc.bet = { stake: 0, prev: Lc.bet ? Lc.bet.stake : 1, team: team(a.s), ordago: true }; s.said[a.s] = '¡Órdago!'; L(s, `${who}: ¡ÓRDAGO a la ${lname(s, i).toLowerCase()}!`); }
      Lc.resp = oppsAfter(s, a.s); Lc.ri = 0; Lc.turn = Lc.resp[0];
      return;
    }
    case 'quiero':
      if (!Lc.bet) return 'No bet to accept.';
      s.said[a.s] = 'Quiero';
      if (Lc.bet.ordago) {
        s.reveal = true;
        if (manual(s)) {
          s.ordagoPend = { i }; s.lance = null; s.phase = 'handEnd';
          L(s, `${who}: quiero el órdago! Cards up: whoever wins the ${lname(s, i).toLowerCase()} takes the game.`); return;
        }
        const w = bestSeat(s, i);
        L(s, `${who}: quiero el órdago. ${nm(s, w)} wins the ${lname(s, i).toLowerCase()}.`);
        s.summary = [{ l: lname(s, i), who: nm(s, w), t: team(w), n: 'Órdago', why: 'accepted' }];
        finishGame(s, team(w)); return;
      }
      s.results[i] = { s: 'querido', stake: Lc.bet.stake }; L(s, `${who}: quiero (${Lc.bet.stake}).`);
      startLance(s, i + 1); return;
    case 'noquiero':
      if (!Lc.bet) return 'No bet to refuse.';
      s.said[a.s] = 'No quiero'; Lc.ri++;
      if (Lc.ri < Lc.resp.length) { Lc.turn = Lc.resp[Lc.ri]; L(s, `${who}: no quiero.`); return; }
      { const b = Lc.bet; s.results[i] = { s: 'rechazado', prev: b.prev, team: b.team };
        if (manual(s)) { L(s, `${who}: no quiero. ${tn(s, b.team)} earn ${b.prev}.`); startLance(s, i + 1); return; }
        L(s, `${who}: no quiero. ${tn(s, b.team)} +${b.prev}.`);
        if (addPts(s, b.team, b.prev)) { s.summary = [{ l: lname(s, i), who: tn(s, b.team), t: b.team, n: b.prev, why: 'refused bet' }]; finishGame(s, b.team); return; }
        startLance(s, i + 1); }
      return;
  }
  return 'Unknown move.';
}

/* ---------- signs (keinuak): which ones are true for a hand ---------- */
const SIGNS = ['kings2', 'kings3', 'aces2', 'aces3', 'mediak', 'dupleak', 'juego31', 'bonita', 'thirty', 'twentynine', 'itsuarena'];
function signsFor(h) {
  if (!h || h.length !== 4 || !h.every(Boolean)) return [];
  const k = h.filter(c => gv(c) === 12).length, a = h.filter(c => gv(c) === 1).length, p = paresOf(h), t = total(h);
  const out = [];
  if (k === 2) out.push('kings2'); if (k === 3) out.push('kings3');
  if (a === 2) out.push('aces2'); if (a === 3) out.push('aces3');
  if (p && p.t === 2) out.push('mediak'); if (p && p.t === 3) out.push('dupleak');
  if (t === 31) out.push('juego31');
  if (k === 3 && a === 1) out.push('bonita'); // la bonita: three kings and an ace, 31
  if (t === 30) out.push('thirty'); if (t === 29) out.push('twentynine');
  if (!p && t < 29) out.push('itsuarena');
  return out;
}

/* ---------- avatars: one shared face; players choose hair, shirt, glasses and facial hair ---------- */
const LOOK = {
  hair: ['short', 'side', 'long', 'curly', 'bun', 'buzz', 'bald'],
  hairColor: ['#1f1a17', '#3b2a20', '#6b4a2f', '#c99a4f', '#a5482a', '#9c9c9c'],
  shirt: ['tee', 'vneck', 'collar', 'hoodie'],
  shirtColor: ['#2f62c9', '#c8372d', '#2d8352', '#e0a526', '#6d3fb0', '#2b2b30', '#e8e4da', '#e06a2c'],
  glasses: ['none', 'round', 'square'],
  facial: ['none', 'stubble', 'moustache', 'beard']
};
const HEX = /^#[0-9a-fA-F]{6}$/;
function cleanLook(l) {
  l = l && typeof l === 'object' ? l : {};
  const pick = (k, ok) => (ok ? ok(l[k]) : LOOK[k].includes(l[k])) ? l[k] : LOOK[k][0];
  return { hair: pick('hair'), hairColor: pick('hairColor', v => HEX.test(v)), shirt: pick('shirt'),
    shirtColor: pick('shirtColor', v => HEX.test(v)), glasses: pick('glasses'), facial: pick('facial') };
}
function randomLook() {
  const r = k => LOOK[k][rint(LOOK[k].length)];
  return { hair: r('hair'), hairColor: r('hairColor'), shirt: r('shirt'), shirtColor: r('shirtColor'),
    glasses: rint(3) ? 'none' : r('glasses'), facial: rint(2) ? 'none' : r('facial') };
}

/* ---------- hand records for statistics (taken once a hand is over) ---------- */
function takeRecord(s) {
  if (!s.dealLog || !s.handId || s.recordedHand === s.handId || !['handEnd', 'gameEnd'].includes(s.phase)) return null;
  s.recordedHand = s.handId;
  return {
    handId: s.handId, ts: new Date().toISOString(), handNo: s.handNo, dealer: s.dealer, mano: s.mano,
    players: s.seats.map(x => (x && x.bot ? 'bot' : 'human')),
    deals: s.dealLog.map((d, i) => ({ musRound: i, hands: d.hands, discards: d.discards || null })),
    results: s.results, punto: s.punto, scoreAfter: s.score.slice(), scoring: s.cfg.scoring,
    gameWonBy: s.phase === 'gameEnd' ? s.winner : null
  };
}

const E = { SIGNS, signsFor, LOOK, cleanLook, randomLook, takeRecord, isBot, LNAME, JORD, DEFAULT_TEAMS, SUITS, RANKS, team, rot, rk, gv, pv, total, paresOf, paresText, better,
  fresh, act, nm, tn, lname, bestSeat, gamesToWin, newDeck, shuffle, rint };
if (typeof module !== 'undefined' && module.exports) module.exports = E; else root.MusEngine = E;
})(typeof self !== 'undefined' ? self : this);
