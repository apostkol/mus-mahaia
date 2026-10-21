// Mus Mahaia — multiplayer Mus server (static files + WebSocket game rooms + bots + hand records).
// Run: npm install && npm start   →   http://localhost:3000
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const E = require('./engine.js');
const Bot = require('./bot.js');
const Rec = require('./recorder.js');

const PORT = process.env.PORT || 3000;
const MAX_CHAT = 200;
const ROOM_IDLE_MS = 24 * 60 * 60 * 1000; // forget empty rooms after a day
const BOT_DELAY = [900, 1700];             // how long a bot "thinks", in ms

/* ---------- static files + data downloads ---------- */
const TYPES = { '.jpg': 'image/jpeg', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.jsonl': 'application/x-ndjson; charset=utf-8' };
const FILES = { '/': 'index.html', '/index.html': 'index.html', '/engine.js': 'engine.js' };
const CARD_FILE = /^\/cards\/(?:(?:oros|copas|espadas|bastos)_(?:[1-7]|1[0-2])|backside)\.jpg$/;
const DATA_FILE = /^\/data\/((?:deal_\d+_[a-z0-9_]+|hands)\.(?:csv|jsonl))$/;
const server = http.createServer((req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  if (p === '/healthz') { res.writeHead(200); return res.end('ok'); }
  if (CARD_FILE.test(p)) return sendFile(res, path.join(__dirname, p), 'public, max-age=604800');
  if (p === '/data' || p === '/data/') return dataPage(res);
  const dm = p.match(DATA_FILE);
  if (dm) { Rec.flushNow(); return sendFile(res, path.join(Rec.DIR, dm[1]), 'no-store', true); }
  if (!FILES[p]) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
  sendFile(res, path.join(__dirname, FILES[p]));
});
function sendFile(res, file, cache = 'no-cache', download = false) {
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    const h = { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': cache };
    if (download) h['Content-Disposition'] = `attachment; filename="${path.basename(file)}"`;
    res.writeHead(200, h); res.end(buf);
  });
}
function dataPage(res) {
  Rec.flushNow();
  const files = Rec.listFiles();
  const kb = n => n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.ceil(n / 1e3) + ' KB';
  const rows = files.map(f => `<li><a href="/data/${f.name}">${f.name}</a> <span>${kb(f.size)}</span></li>`).join('');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mus Mahaia · hand data</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;color:#1f211d}h1{font-family:Georgia,serif}li{margin:4px 0}span{color:#666;font-size:.9em;margin-left:8px}p{color:#444}</style>
<h1>Hand data</h1><p>Every finished hand is saved here. <b>deal_0_first_hand.csv</b> has the cards as first dealt, <b>deal_1_after_1_mus.csv</b> the cards after the first mus, and so on. <b>hands.jsonl</b> has everything about each hand, one per line.</p>
${rows ? `<ul>${rows}</ul>` : '<p>No finished hands yet.</p>'}`);
}

/* ---------- rooms ---------- */
const rooms = new Map(); // code -> { st, chat, clients:Set<ws>, touched, botTimer, code }
function getRoom(code) {
  let r = rooms.get(code);
  if (!r) { r = { code, st: E.fresh(), chat: [], clients: new Set(), touched: Date.now(), botTimer: null, signsDone: null }; rooms.set(code, r); }
  r.touched = Date.now();
  return r;
}
const cleanCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
const cleanNick = n => String(n || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 20);

// What one player is allowed to see: their own cards only (all cards once revealed).
function viewFor(st, pid, online) {
  const { dealLog, deck, discards, ...rest } = st;
  const v = JSON.parse(JSON.stringify(rest));
  v.hands = st.hands.map((h, i) => (st.reveal || (st.seats[i] && st.seats[i].uid === pid)) ? h : h.map(() => null));
  v.seats = st.seats.map(s => s && { nick: s.nick, mine: s.uid === pid, bot: !!s.bot, online: !!s.bot || online.has(s.uid) });
  return v;
}
function broadcast(room) {
  const online = new Set([...room.clients].map(c => c.pid));
  for (const c of room.clients) send(c, { type: 'state', st: viewFor(room.st, c.pid, online) });
}
function send(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }
function sendAll(room, msg) { for (const c of room.clients) send(c, msg); }

// Every change to a table goes through here: apply, save a finished hand, tell everyone, let bots move.
function apply(room, a, uid) {
  let err;
  try { err = E.act(room.st, a, uid); } catch (e) { console.error(e); err = 'Something went wrong with that move.'; }
  if (err) return err;
  room.st.rev = (room.st.rev || 0) + 1;
  Rec.save(E.takeRecord(room.st), room.code);
  broadcast(room);
  scheduleBots(room);
}

/* ---------- bots ---------- */
function botSeats(st) { return [0, 1, 2, 3].filter(x => E.isBot(st.seats[x])); }
function scheduleBots(room) {
  clearTimeout(room.botTimer); room.botTimer = null;
  const st = room.st, bots = botSeats(st);
  if (!bots.length) return;
  planSigns(room, bots);
  const todo = bots.map(x => ({ x, a: Bot.move(st, x) })).filter(m => m.a);
  if (!todo.length) return;
  const wait = BOT_DELAY[0] + Math.random() * (BOT_DELAY[1] - BOT_DELAY[0]);
  room.botTimer = setTimeout(() => {
    room.botTimer = null;
    const m = todo[0], again = Bot.move(room.st, m.x); // the table may have changed meanwhile
    if (!again) return scheduleBots(room);
    const uid = room.st.seats[m.x].uid;
    let err = apply(room, again, uid);
    // never leave the table stuck: fall back to the simplest legal answer
    for (const t of ['pass', 'noquiero']) { if (!err) break; err = apply(room, { t, s: m.x }, uid); }
    if (err) console.error('bot move refused:', err, again);
  }, wait);
}
// Once per hand, when the betting starts, each bot may make a sign to its partner.
function planSigns(room, bots) {
  const st = room.st;
  if (st.phase !== 'lance' || room.signsDone === st.handId) return;
  room.signsDone = st.handId;
  for (const x of bots) {
    const sign = Bot.maybeSign(st, x);
    if (sign) setTimeout(() => { if (room.st.handId === st.handId && room.st.phase === 'lance') sendAll(room, { type: 'sign', seat: x, sign }); }, 600 + Math.random() * 4000);
  }
}

/* ---------- sockets ---------- */
const wss = new WebSocketServer({ server, maxPayload: 8 * 1024 });
wss.on('connection', ws => {
  ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;

    if (m.type === 'hello') {
      const code = cleanCode(m.room);
      const pid = typeof m.pid === 'string' && /^[a-f0-9]{32}$/.test(m.pid) ? m.pid : null;
      if (!code || !pid) return send(ws, { type: 'error', text: 'Bad room or player id.' });
      if (ws.room) ws.room.clients.delete(ws);
      ws.pid = pid; ws.room = getRoom(code); ws.room.clients.add(ws);
      // the person who creates a table picks the match length, scoring and bots
      const st = ws.room.st, c = m.create;
      if (c && typeof c === 'object' && st.handNo === 0 && st.seats.every(x => !x) && !ws.room.configured) {
        const bo = Math.floor(+c.bestOf);
        if (bo >= 1 && bo <= 21 && bo % 2 === 1) st.cfg.bestOf = bo;
        if (c.scoring === 'auto' || c.scoring === 'manual') st.cfg.scoring = c.scoring;
        const nb = Math.max(0, Math.min(3, Math.floor(+c.bots || 0)));
        for (const x of [1, 3, 2].slice(0, nb)) E.act(st, { t: 'addBot', s: x }, pid); // opponents first
        ws.room.configured = true;
      }
      send(ws, { type: 'chat', all: ws.room.chat });
      broadcast(ws.room);
      return scheduleBots(ws.room);
    }
    const room = ws.room; if (!room) return;
    room.touched = Date.now();

    if (m.type === 'chat') {
      const text = String(m.text || '').trim().slice(0, 500);
      if (!text) return;
      const seat = room.st.seats.findIndex(s => s && s.uid === ws.pid);
      const msg = { nick: cleanNick(m.nick) || (seat >= 0 ? room.st.seats[seat].nick : 'Someone'), seat, text, ts: Date.now() };
      room.chat.push(msg); if (room.chat.length > MAX_CHAT) room.chat.shift();
      return sendAll(room, { type: 'chat', msg });
    }
    if (m.type === 'sign') {
      const seat = Number(m.seat), st = room.st;
      if (!(seat >= 0 && seat < 4) || !st.seats[seat] || st.seats[seat].uid !== ws.pid) return;
      if (!['mus', 'discard', 'lance'].includes(st.phase)) return send(ws, { type: 'error', text: 'Signs can be made while a hand is being played.' });
      if (!E.signsFor(st.hands[seat]).includes(m.sign)) return send(ws, { type: 'error', text: "That sign doesn't match your cards." });
      const now = Date.now(); if (ws.lastSign && now - ws.lastSign < 2500) return; ws.lastSign = now;
      return sendAll(room, { type: 'sign', seat, sign: m.sign });
    }
    if (m.type === 'act' && m.a && typeof m.a === 'object') {
      const a = { ...m.a };
      if (a.nick !== undefined) { a.nick = cleanNick(a.nick); if (!a.nick) return send(ws, { type: 'error', text: 'Type your name first.' }); }
      if (a.s !== undefined) { a.s = Number(a.s); if (!(a.s >= 0 && a.s < 4)) return; }
      const err = apply(room, a, ws.pid);
      if (err) send(ws, { type: 'error', text: err });
    }
  });
  ws.on('close', () => { if (ws.room) { ws.room.clients.delete(ws); broadcast(ws.room); } });
});

// keep connections alive through proxies, drop dead ones, forget idle rooms
setInterval(() => {
  for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); }
  const now = Date.now();
  for (const [code, r] of rooms) if (!r.clients.size && now - r.touched > ROOM_IDLE_MS) { clearTimeout(r.botTimer); rooms.delete(code); }
}, 25000);
process.on('SIGTERM', () => { Rec.flushNow(); process.exit(0); });
process.on('SIGINT', () => { Rec.flushNow(); process.exit(0); });

server.listen(PORT, () => console.log(`Mus Mahaia running on http://localhost:${PORT}`));
