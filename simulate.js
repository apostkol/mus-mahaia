// Let four bots play many hands and save every hand to the data files, for statistics.
// Usage:  node simulate.js 10000        (number of hands; default 1000)
'use strict';
const E = require('./engine.js');
const Bot = require('./bot.js');
const Rec = require('./recorder.js');

const N = Math.max(1, Math.floor(+process.argv[2] || 1000));
const TABLE = 'SIM-' + new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');

let st = E.fresh();
// the engine allows at most 3 bots at a table; here the fourth player also plays with the bot code
st.seats[0] = { uid: 'sim-0', nick: 'Sim' };
for (let x = 1; x < 4; x++) E.act(st, { t: 'addBot', s: x }, 'sim-0');
st.seats[0].bot = true;
const uid = x => st.seats[x].uid;
const someone = 'sim-0';

let hands = 0, musRounds = [0, 0, 0, 0, 0, 0], t0 = Date.now();
E.act(st, { t: 'start' }, someone);
while (hands < N) {
  if (st.phase === 'handEnd' || st.phase === 'gameEnd') {
    const rec = E.takeRecord(st);
    if (rec) { Rec.save(rec, TABLE); hands++; musRounds[Math.min(rec.deals.length - 1, 5)]++; }
    if (hands % 1000 === 0 && hands) process.stdout.write(`\r${hands} / ${N} hands`);
    if (st.phase === 'gameEnd') { if (st.matchWinner !== null) { st.games = [0, 0]; st.matchWinner = null; } E.act(st, { t: 'newgame' }, someone); }
    else E.act(st, { t: 'next' }, someone);
    continue;
  }
  let moved = false;
  for (let x = 0; x < 4 && !moved; x++) {
    const a = Bot.move(st, x);
    if (!a) continue;
    const err = E.act(st, a, uid(x));
    if (err) throw new Error(`bot move refused: ${err} ${JSON.stringify(a)}`);
    moved = true;
  }
  if (!moved) throw new Error('No one could move in phase ' + st.phase);
}
Rec.flushNow();
console.log(`\rSaved ${hands} hands in ${((Date.now() - t0) / 1000).toFixed(1)} s to ${Rec.DIR}`);
console.log('Hands by number of mus rounds:', musRounds.map((n, i) => `${i === 5 ? '5+' : i}: ${n}`).join(', '));
