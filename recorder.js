/* Saves every finished hand for statistics.
   data/hands.jsonl                    one line per finished hand, everything about it
   data/deal_0_first_hand.csv          the cards each player was dealt first
   data/deal_1_after_1_mus.csv         the cards after the first mus (discard and draw)
   data/deal_2_after_2_mus.csv         after the second mus, and so on                    */
'use strict';
const fs = require('fs');
const path = require('path');
const E = require('./engine.js');

const DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const SUIT = { o: 'oros', c: 'copas', e: 'espadas', b: 'bastos' };
const PARES = ['none', 'par', 'medias', 'duples'];
const HEADER = ['hand_id', 'date', 'table', 'mus_round', 'seat', 'position', 'player',
  'card1', 'card2', 'card3', 'card4', 'game_values', 'kings', 'aces', 'pares', 'pares_values',
  'points', 'juego', 'cards_discarded', 'played_with_these'].join(',') + '\n';

const csvName = r => r === 0 ? 'deal_0_first_hand.csv' : `deal_${r}_after_${r}_mus.csv`;
const cardName = c => `${SUIT[c[0]]}_${E.rk(c)}`;
const ensureDir = () => fs.mkdirSync(DIR, { recursive: true });

function rowsFor(rec, table) {
  const out = {};
  const last = rec.deals.length - 1;
  for (const d of rec.deals) {
    const lines = [];
    for (let seat = 0; seat < 4; seat++) {
      const h = d.hands[seat];
      // order the cards high to low so identical hands look identical
      const sorted = h.slice().sort((a, b) => E.gv(b) - E.gv(a) || E.rk(b) - E.rk(a));
      const p = E.paresOf(h), t = E.total(h);
      lines.push([
        rec.handId, rec.ts, table, d.musRound, seat + 1, ((seat - rec.mano + 4) % 4) + 1, rec.players[seat],
        ...sorted.map(cardName),
        sorted.map(E.gv).join('-'),
        h.filter(c => E.gv(c) === 12).length, h.filter(c => E.gv(c) === 1).length,
        p ? PARES[p.t] : 'none', p ? p.k.join('-') : '',
        t, t >= 31 ? t : 'no',
        d.discards ? d.discards[seat].length : '',
        d.musRound === last ? 'yes' : 'no'
      ].join(','));
    }
    out[d.musRound] = lines.join('\n') + '\n';
  }
  return out;
}

// Buffered writer: many hands can be saved quickly (the simulator) without one disk write each.
const pending = { jsonl: '', csv: {} };
let timer = null;
function flush() {
  timer = null;
  if (!pending.jsonl) return;
  try {
    ensureDir();
    fs.appendFileSync(path.join(DIR, 'hands.jsonl'), pending.jsonl);
    for (const [r, text] of Object.entries(pending.csv)) {
      const f = path.join(DIR, csvName(+r));
      if (!fs.existsSync(f)) fs.writeFileSync(f, HEADER);
      fs.appendFileSync(f, text);
    }
  } catch (e) { console.error('Could not save hand data:', e.message); }
  pending.jsonl = ''; pending.csv = {};
}
function save(rec, table) {
  if (!rec) return;
  pending.jsonl += JSON.stringify({ table, ...rec }) + '\n';
  for (const [r, text] of Object.entries(rowsFor(rec, table))) pending.csv[r] = (pending.csv[r] || '') + text;
  if (!timer) timer = setTimeout(flush, 500);
  if (pending.jsonl.length > 2e6) { clearTimeout(timer); flush(); }
}
function flushNow() { if (timer) clearTimeout(timer); flush(); }

function listFiles() {
  try {
    return fs.readdirSync(DIR).filter(f => /\.(csv|jsonl)$/.test(f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map(f => ({ name: f, size: fs.statSync(path.join(DIR, f)).size }));
  } catch { return []; }
}

module.exports = { save, flushNow, listFiles, DIR };
