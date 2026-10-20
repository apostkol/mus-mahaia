// Mus Mahaia — multiplayer Mus server (static files + WebSocket game rooms).
// Run: npm install && npm start   →   http://localhost:3000
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const E = require('./engine.js');

const PORT = process.env.PORT || 3000;
const MAX_CHAT = 200;
const ROOM_IDLE_MS = 24 * 60 * 60 * 1000; // forget empty rooms after a day

/* ---------- static files ---------- */
const TYPES = { '.jpg': 'image/jpeg', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png' };
// Only these files are served to browsers.
const FILES = { '/': 'index.html', '/index.html': 'index.html', '/engine.js': 'engine.js', '/cards.jpg': 'cards.jpg' };
const server = http.createServer((req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  if (p === '/healthz') { res.writeHead(200); return res.end('ok'); }
  if (!FILES[p]) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
  sendFile(res, path.join(__dirname, FILES[p]));
});
function sendFile(res, file) {
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}

/* ---------- rooms ---------- */
const rooms = new Map(); // code -> { st, chat, clients:Set<ws>, touched }
function getRoom(code) {
  let r = rooms.get(code);
  if (!r) { r = { st: E.fresh(), chat: [], clients: new Set(), touched: Date.now() }; rooms.set(code, r); }
  r.touched = Date.now();
  return r;
}
const cleanCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
const cleanNick = n => String(n || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 20);

// What one player is allowed to see: their own cards only (all cards once revealed).
function viewFor(st, pid, online) {
  const v = JSON.parse(JSON.stringify(st));
  v.hands = st.hands.map((h, i) => (st.reveal || (st.seats[i] && st.seats[i].uid === pid)) ? h : h.map(() => null));
  v.deck = st.deck.length; v.discardCount = st.discards.length; delete v.discards;
  v.seats = st.seats.map(s => s && { nick: s.nick, mine: s.uid === pid, online: online.has(s.uid) });
  return v;
}
function broadcast(room) {
  const online = new Set([...room.clients].map(c => c.pid));
  for (const c of room.clients) send(c, { type: 'state', st: viewFor(room.st, c.pid, online) });
}
function send(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }

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
      // the person who creates a table picks the match length and scoring
      const st = ws.room.st, c = m.create;
      if (c && typeof c === 'object' && st.handNo === 0 && st.seats.every(x => !x) && !ws.room.configured) {
        const bo = Math.floor(+c.bestOf);
        if (bo >= 1 && bo <= 21 && bo % 2 === 1) st.cfg.bestOf = bo;
        if (c.scoring === 'auto' || c.scoring === 'manual') st.cfg.scoring = c.scoring;
        ws.room.configured = true;
      }
      send(ws, { type: 'chat', all: ws.room.chat });
      return broadcast(ws.room);
    }
    const room = ws.room; if (!room) return;
    room.touched = Date.now();

    if (m.type === 'chat') {
      const text = String(m.text || '').trim().slice(0, 500);
      if (!text) return;
      const seat = room.st.seats.findIndex(s => s && s.uid === ws.pid);
      const msg = { nick: cleanNick(m.nick) || (seat >= 0 ? room.st.seats[seat].nick : 'Someone'), seat, text, ts: Date.now() };
      room.chat.push(msg); if (room.chat.length > MAX_CHAT) room.chat.shift();
      for (const c of room.clients) send(c, { type: 'chat', msg });
      return;
    }
    if (m.type === 'act' && m.a && typeof m.a === 'object') {
      const a = { ...m.a };
      if (a.nick !== undefined) { a.nick = cleanNick(a.nick); if (!a.nick) return send(ws, { type: 'error', text: 'Type your name first.' }); }
      if (a.s !== undefined) { a.s = Number(a.s); if (!(a.s >= 0 && a.s < 4)) return; }
      let err;
      try { err = E.act(room.st, a, ws.pid); } catch (e) { console.error(e); err = 'Something went wrong with that move.'; }
      if (err) return send(ws, { type: 'error', text: err });
      room.st.rev = (room.st.rev || 0) + 1;
      broadcast(room);
    }
  });
  ws.on('close', () => { if (ws.room) { ws.room.clients.delete(ws); broadcast(ws.room); } });
});

// keep connections alive through proxies, drop dead ones, forget idle rooms
setInterval(() => {
  for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); }
  const now = Date.now();
  for (const [code, r] of rooms) if (!r.clients.size && now - r.touched > ROOM_IDLE_MS) rooms.delete(code);
}, 25000);

server.listen(PORT, () => console.log(`Mus Mahaia running on http://localhost:${PORT}`));
