/* Mus Mahaia playing cards: a Spanish-style 40-card deck drawn in SVG, with big corner numbers.
   cardSVG('o1') ... cardSVG('b12') and backSVG(). Suits: o oros, c copas, e espadas, b bastos. */
(function (root) {
'use strict';
const INK = { o: '#9a6a06', c: '#b3271f', e: '#1f4f8a', b: '#2f6b24' };
const GOLD = '#f0bd2e', GOLD_D = '#8a5a00', RED = '#c8372d', RED_D = '#6e1a14', BLUE = '#2a5d96', SKIN = '#f2c7a2';
const BREAKS = { o: [], c: [50], e: [40, 60], b: [33, 50, 67] }; // gaps in the frame lines tell the suit
const f = n => +n.toFixed(2);

/* ---------- the four suit symbols, drawn around (0,0) ---------- */
function coin(s) {
  const r = 11 * s, ticks = [];
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; ticks.push(`M${f(Math.cos(a) * r * .74)} ${f(Math.sin(a) * r * .74)}L${f(Math.cos(a) * r * .9)} ${f(Math.sin(a) * r * .9)}`); }
  return `<circle r="${f(r)}" fill="${GOLD}" stroke="${GOLD_D}" stroke-width="${f(1.4 * s)}"/>` +
    `<circle r="${f(r * .66)}" fill="#f7d35a" stroke="${GOLD_D}" stroke-width="${f(.9 * s)}"/>` +
    `<path d="${ticks.join('')}" stroke="${GOLD_D}" stroke-width="${f(.8 * s)}"/>` +
    `<circle r="${f(r * .3)}" fill="#e09a1a" stroke="${GOLD_D}" stroke-width="${f(.7 * s)}"/><circle r="${f(r * .11)}" fill="${RED}"/>`;
}
function cup(s) {
  const k = v => f(v * s);
  return `<path d="M${k(-9)} ${k(-8)} Q${k(-9.5)} ${k(4)} 0 ${k(5)} Q${k(9.5)} ${k(4)} ${k(9)} ${k(-8)} Z" fill="${RED}" stroke="${RED_D}" stroke-width="${k(1)}"/>` +
    `<path d="M${k(-8.6)} ${k(-3)} Q0 ${k(1)} ${k(8.6)} ${k(-3)}" stroke="${BLUE}" stroke-width="${k(1.6)}" fill="none"/>` +
    `<ellipse cy="${k(-8)}" rx="${k(9.4)}" ry="${k(2.4)}" fill="${GOLD}" stroke="${GOLD_D}" stroke-width="${k(.8)}"/>` +
    `<rect x="${k(-1.7)}" y="${k(5)}" width="${k(3.4)}" height="${k(6)}" fill="${GOLD}" stroke="${GOLD_D}" stroke-width="${k(.6)}"/>` +
    `<ellipse cy="${k(7.6)}" rx="${k(3.2)}" ry="${k(1.6)}" fill="${GOLD}" stroke="${GOLD_D}" stroke-width="${k(.6)}"/>` +
    `<ellipse cy="${k(11.6)}" rx="${k(6.5)}" ry="${k(2)}" fill="${GOLD}" stroke="${GOLD_D}" stroke-width="${k(.8)}"/>`;
}
function sword(s) {
  const k = v => f(v * s);
  return `<path d="M${k(-2.3)} ${k(7)} L${k(-2.3)} ${k(-12)} L0 ${k(-17)} L${k(2.3)} ${k(-12)} L${k(2.3)} ${k(7)} Z" fill="#a9cdef" stroke="${BLUE}" stroke-width="${k(.9)}"/>` +
    `<path d="M0 ${k(-14)} L0 ${k(6)}" stroke="${BLUE}" stroke-width="${k(.6)}"/>` +
    `<path d="M${k(-8)} ${k(8.5)} Q0 ${k(5.5)} ${k(8)} ${k(8.5)}" stroke="${GOLD_D}" stroke-width="${k(3.6)}" fill="none" stroke-linecap="round"/>` +
    `<path d="M${k(-8)} ${k(8.5)} Q0 ${k(5.5)} ${k(8)} ${k(8.5)}" stroke="${GOLD}" stroke-width="${k(2.2)}" fill="none" stroke-linecap="round"/>` +
    `<rect x="${k(-1.5)}" y="${k(9)}" width="${k(3)}" height="${k(6)}" rx="${k(1)}" fill="${RED_D}"/>` +
    `<circle cy="${k(16.6)}" r="${k(2.3)}" fill="${GOLD}" stroke="${GOLD_D}" stroke-width="${k(.7)}"/>`;
}
function club(s) {
  const k = v => f(v * s);
  return `<path d="M${k(-1.8)} ${k(16)} L${k(-4.2)} ${k(-10)} Q${k(-4.6)} ${k(-17)} 0 ${k(-17.5)} Q${k(4.6)} ${k(-17)} ${k(4.2)} ${k(-10)} L${k(1.8)} ${k(16)} Q0 ${k(17.5)} ${k(-1.8)} ${k(16)} Z" fill="#5f9d36" stroke="#2c5a18" stroke-width="${k(.9)}"/>` +
    `<path d="M${k(-1.2)} ${k(-14)} L${k(-.4)} ${k(13)}" stroke="#a8d26a" stroke-width="${k(1.1)}" stroke-linecap="round"/>` +
    [[-4.4, -6, -1], [4.0, -1, 1], [-3.5, 5, -1], [3.0, 10, 1]].map(([x, y, d]) =>
      `<ellipse cx="${k(x)}" cy="${k(y)}" rx="${k(1.8)}" ry="${k(1.3)}" fill="#3f7a22" stroke="#2c5a18" stroke-width="${k(.6)}" transform="rotate(${d * 30} ${k(x)} ${k(y)})"/>`).join('') +
    `<path d="M${k(-1.8)} ${k(16)} Q0 ${k(17.5)} ${k(1.8)} ${k(16)}" stroke="#c98b3a" stroke-width="${k(1.4)}" fill="none"/>`;
}
const SYMBOL = { o: coin, c: cup, e: sword, b: club };
const sym = (suit, x, y, s, rot = 0) => `<g transform="translate(${f(x)} ${f(y)})${rot ? ` rotate(${rot})` : ''}">${SYMBOL[suit](s)}</g>`;

/* ---------- pip layouts for 1-7 ---------- */
const PIPS = {
  1: [[50, 80]], 2: [[50, 47], [50, 113, 1]], 3: [[50, 42], [50, 80], [50, 118, 1]],
  4: [[35, 47], [65, 47], [35, 113, 1], [65, 113, 1]],
  5: [[35, 45], [65, 45], [50, 80], [35, 115, 1], [65, 115, 1]],
  6: [[35, 42], [65, 42], [35, 80], [65, 80], [35, 118, 1], [65, 118, 1]],
  7: [[35, 40], [65, 40], [50, 61], [35, 82], [65, 82], [35, 119, 1], [65, 119, 1]]
};
const PIP_SIZE = { 1: 2.1, 2: 1.45, 3: 1.3 }, TALL_SIZE = { 1: 2.1, 2: 1.3, 3: 1.05 };

/* ---------- the three figures: sota (10), caballo (11), rey (12) ---------- */
const DRESS = { o: ['#c8372d', '#2a5d96'], c: ['#2f7d4a', '#c8372d'], e: ['#2a5d96', '#e0a526'], b: ['#b3271f', '#3d7a2e'] };
function face(x, y, r) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${SKIN}" stroke="#a0704f" stroke-width=".6"/>` +
    `<circle cx="${f(x - r * .36)}" cy="${f(y - r * .05)}" r="${f(r * .12)}" fill="#33241c"/><circle cx="${f(x + r * .36)}" cy="${f(y - r * .05)}" r="${f(r * .12)}" fill="#33241c"/>` +
    `<path d="M${f(x - r * .3)} ${f(y + r * .42)} Q${x} ${f(y + r * .6)} ${f(x + r * .3)} ${f(y + r * .42)}" stroke="#a0473f" stroke-width=".7" fill="none"/>`;
}
function sota(suit) {
  const [a, b] = DRESS[suit];
  return `<path d="M44 128 L43 100 L47 100 L48 128 Z M52 128 L53 100 L57 100 L56 128 Z" fill="${b}" stroke="#2b2b2b" stroke-width=".6"/>` +
    `<path d="M41 129 h8 v3 h-9 Z M51 129 h8 l1 3 h-9 Z" fill="#3b2a20"/>` +
    `<path d="M38 60 Q50 54 62 60 L66 101 Q50 105 34 101 Z" fill="${a}" stroke="#2b2b2b" stroke-width=".8"/>` +
    `<path d="M36 82 L64 82" stroke="${GOLD}" stroke-width="2.4"/><path d="M50 60 L50 101" stroke="${b}" stroke-width="2"/>` +
    `<path d="M38 62 Q30 76 33 92" stroke="${a}" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="33" cy="93" r="2.6" fill="${SKIN}"/>` +
    `<path d="M62 62 Q70 52 69 40" stroke="${a}" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="69" cy="39" r="2.6" fill="${SKIN}"/>` +
    `<rect x="47" y="53" width="6" height="6" fill="${SKIN}"/>` + face(50, 46, 7.5) +
    `<path d="M41.5 44 Q42 34 50 34 Q59 34 58.5 44 Q56 38 50 38 Q44 38 41.5 44 Z" fill="#6b4a2f"/>` +
    `<path d="M40 38 Q50 27 61 37 Q50 34 40 38 Z" fill="${b}" stroke="#2b2b2b" stroke-width=".6"/><path d="M58 33 q8 -6 10 -2" stroke="${GOLD}" stroke-width="1.6" fill="none"/>` +
    sym(suit, 72, 27, .9);
}
function caballo(suit) {
  const [a, b] = DRESS[suit];
  return `<path d="M30 110 L28 132 M36 112 L37 132 M64 112 L63 132 M70 109 L73 132" stroke="#5a3a24" stroke-width="3.6" stroke-linecap="round"/>` +
    `<path d="M74 98 Q86 100 84 120" stroke="#3b2a20" stroke-width="3" fill="none" stroke-linecap="round"/>` +
    `<ellipse cx="50" cy="104" rx="26" ry="12" fill="#f3efe6" stroke="#5a3a24" stroke-width="1"/>` +
    `<path d="M30 100 Q22 86 22 76 L31 74 Q34 86 40 96 Z" fill="#f3efe6" stroke="#5a3a24" stroke-width="1"/>` +
    `<path d="M16 76 Q17 68 26 67 L33 70 Q34 77 29 79 Q22 81 16 79 Z" fill="#f3efe6" stroke="#5a3a24" stroke-width="1"/>` +
    `<circle cx="25" cy="72" r="1.1" fill="#33241c"/><path d="M27 67 L29 62 L31 68" fill="#f3efe6" stroke="#5a3a24" stroke-width=".8"/>` +
    `<path d="M33 72 Q30 82 33 92" stroke="#3b2a20" stroke-width="2" fill="none"/>` +
    `<path d="M38 96 Q50 88 64 96 L66 108 Q50 112 36 108 Z" fill="${b}" stroke="#2b2b2b" stroke-width=".7"/>` +
    `<path d="M50 104 L56 116" stroke="${a}" stroke-width="5" stroke-linecap="round"/>` +
    `<path d="M42 70 Q50 64 58 70 L60 96 L40 96 Z" fill="${a}" stroke="#2b2b2b" stroke-width=".8"/><path d="M41 86 L59 86" stroke="${GOLD}" stroke-width="2"/>` +
    `<path d="M57 72 Q66 62 66 50" stroke="${a}" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="66" cy="49" r="2.4" fill="${SKIN}"/>` +
    `<path d="M43 74 Q36 82 38 90" stroke="${a}" stroke-width="5" fill="none" stroke-linecap="round"/>` +
    `<rect x="47.5" y="62" width="5" height="6" fill="${SKIN}"/>` + face(50, 56, 7) +
    `<path d="M40 52 Q50 40 61 51 Q50 47 40 52 Z" fill="${b}" stroke="#2b2b2b" stroke-width=".6"/><path d="M55 45 q9 -8 12 -3" stroke="${RED}" stroke-width="1.8" fill="none"/>` +
    sym(suit, 70, 34, .88);
}
function rey(suit) {
  const [a, b] = DRESS[suit];
  return `<path d="M33 136 L36 64 Q50 56 64 64 L67 136 Z" fill="${a}" stroke="#2b2b2b" stroke-width=".8"/>` +
    `<path d="M33 136 L36 64 Q42 61 46 61 L44 136 Z" fill="${b}" stroke="#2b2b2b" stroke-width=".6"/>` +
    `<path d="M44 66 L44 136" stroke="#f5f2ea" stroke-width="3.4"/>` + [72, 84, 96, 108, 120, 132].map(y => `<circle cx="44" cy="${y}" r=".8" fill="#222"/>`).join('') +
    `<path d="M46 98 L66 98" stroke="${GOLD}" stroke-width="2.4"/>` +
    `<path d="M62 68 Q71 62 70 52" stroke="${a}" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="70" cy="51" r="2.6" fill="${SKIN}"/>` +
    `<path d="M38 70 Q31 84 36 96" stroke="${b}" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="37" cy="97" r="2.6" fill="${SKIN}"/>` +
    `<rect x="47" y="56" width="6" height="6" fill="${SKIN}"/>` + face(50, 48, 7.5) +
    `<path d="M43 52 Q44 61 50 62 Q56 61 57 52 Q54 56 50 56 Q46 56 43 52 Z" fill="#8a8a8a"/>` +
    `<path d="M41 41 L42 31 L46 36 L50 28 L54 36 L58 31 L59 41 Z" fill="${GOLD}" stroke="${GOLD_D}" stroke-width=".8"/><circle cx="50" cy="35" r="1.3" fill="${RED}"/>` +
    sym(suit, 72, 37, .9);
}
const FIGURE = { 10: sota, 11: caballo, 12: rey };

/* ---------- a whole card ---------- */
const cache = {};
function frame(suit) {
  const gaps = BREAKS[suit], seg = y => {
    let x = 8, out = '';
    for (const g of gaps) { out += `M${x} ${y}L${g - 3.5} ${y}`; x = g + 3.5; }
    return out + `M${x} ${y}L92 ${y}`;
  };
  return `<path d="${seg(8)}${seg(152)}M8 8L8 152M92 8L92 152" stroke="${INK[suit]}" stroke-width="1.3" fill="none"/>`;
}
function cardSVG(c) {
  if (cache[c]) return cache[c];
  const suit = c[0], r = +c.slice(1), col = INK[suit];
  let body = '';
  if (r >= 10) body = FIGURE[r](suit);
  else { const tall = suit === 'e' || suit === 'b', sz = (tall ? TALL_SIZE : PIP_SIZE)[r] || (tall ? 1 : 1.12);
    body = PIPS[r].map(([x, y, flip]) => sym(suit, x, y, sz, flip && suit === 'c' ? 180 : 0)).join(''); }
  const num = `font-family="Georgia,'Times New Roman',serif" font-weight="700" fill="${col}"`;
  return (cache[c] = `<svg viewBox="0 0 100 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
    `<rect x=".5" y=".5" width="99" height="159" rx="7" fill="#fbf7ee"/>` + frame(suit) + body +
    `<text x="11" y="32" font-size="27" ${num}>${r}</text>` +
    `<text x="11" y="32" font-size="27" ${num} transform="rotate(180 50 80)">${r}</text></svg>`);
}
function backSVG() {
  let lattice = '';
  for (let i = -160; i < 260; i += 12) lattice += `M${i} 12L${i + 148} 148M${i + 148} 12L${i} 148`;
  return `<svg viewBox="0 0 100 160" xmlns="http://www.w3.org/2000/svg"><rect x=".5" y=".5" width="99" height="159" rx="7" fill="#fbf7ee"/>` +
    `<rect x="6" y="6" width="88" height="148" rx="4" fill="#9b2229"/><clipPath id="bk"><rect x="9" y="9" width="82" height="142" rx="3"/></clipPath>` +
    `<g clip-path="url(#bk)"><path d="${lattice}" stroke="#d65a5f" stroke-width="1.1" opacity=".75"/></g>` +
    `<rect x="9" y="9" width="82" height="142" rx="3" fill="none" stroke="#f3d27a" stroke-width="1.2"/>` +
    `<ellipse cx="50" cy="80" rx="18" ry="24" fill="#9b2229" stroke="#f3d27a" stroke-width="1.6"/>` +
    `<path d="M50 62 L62 80 L50 98 L38 80 Z" fill="#f3d27a"/><circle cx="50" cy="80" r="4" fill="#9b2229"/></svg>`;
}
const E = { cardSVG, backSVG };
if (typeof module !== 'undefined' && module.exports) module.exports = E; else root.MusDeck = E;
})(typeof self !== 'undefined' ? self : this);
