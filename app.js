// ============================================================
// Ivrit Quest — game engine
// ============================================================

// ---------- tiny helpers ----------
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// distractors: n items from pool, different from `item`, unique by key
function others(pool, item, n, keyOf) {
  const seen = new Set([keyOf(item)]);
  const out = [];
  for (const d of shuffle(pool)) {
    if (d === item || seen.has(keyOf(d))) continue;
    seen.add(keyOf(d)); out.push(d);
    if (out.length >= n) break;
  }
  return out;
}

// ---------- sound effects (WebAudio) ----------
let audioCtx = null;
function initAudio() { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* no audio */ } }
function tone(freq, start, dur, type = 'sine', vol = 0.18) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, audioCtx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + start + dur);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(audioCtx.currentTime + start); o.stop(audioCtx.currentTime + start + dur + 0.05);
}
const SFX = {
  click: () => tone(600, 0, 0.08, 'triangle', 0.1),
  good: () => { tone(660, 0, 0.12, 'triangle'); tone(880, 0.1, 0.18, 'triangle'); },
  bad: () => tone(160, 0, 0.35, 'sawtooth', 0.12),
  coin: () => { tone(988, 0, 0.09, 'square', 0.09); tone(1319, 0.09, 0.22, 'square', 0.09); },
  fanfare: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.14, 0.3, 'triangle')); },
  combo: () => { tone(880, 0, 0.08, 'triangle'); tone(1109, 0.07, 0.08, 'triangle'); tone(1319, 0.14, 0.2, 'triangle'); },
};

// ---------- speech: TTS + recognition ----------
const synth = window.speechSynthesis;
let heVoice = null, enVoice = null;
// Prefer the most natural voice installed: Premium > Enhanced > plain.
// (On iPad, better voices appear after downloading them in
//  Settings → Accessibility → Spoken Content → Voices.)
function voiceScore(v, wantLang) {
  const lang = (v.lang || '').toLowerCase().replace('_', '-');
  const name = (v.name || '').toLowerCase();
  let s = 0;
  if (lang.startsWith(wantLang)) s += 10; else return -1;
  if (wantLang === 'en' && lang === 'en-us') s += 2;
  if (name.includes('premium')) s += 6;
  else if (name.includes('enhanced')) s += 4;
  if (/natural|neural|siri/.test(name)) s += 5;
  if (name.includes('compact')) s -= 2;
  if (v.localService) s += 1;
  return s;
}
function bestVoice(vs, wantLang) {
  return vs.map(v => [voiceScore(v, wantLang), v])
    .filter(([s]) => s >= 0)
    .sort((a, b) => b[0] - a[0])
    .map(([, v]) => v)[0] || null;
}
function pickVoices() {
  const vs = synth ? synth.getVoices() : [];
  heVoice = bestVoice(vs, 'he') || vs.find(v => /hebrew|carmit/i.test(v.name)) || null;
  enVoice = bestVoice(vs, 'en');
}
if (synth) { pickVoices(); synth.onvoiceschanged = pickVoices; }

function speakOne(text, lang, rate) {
  return new Promise((res) => {
    if (!synth) return res();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'he' ? 'he-IL' : 'en-US';
    const v = lang === 'he' ? heVoice : enVoice;
    if (v) u.voice = v;
    u.rate = rate || (lang === 'he' ? 0.8 : 1.0);
    u.pitch = 1.05;
    u.onend = res; u.onerror = res;
    synth.speak(u);
    setTimeout(res, 9000); // safety net
  });
}
let sayToken = 0;
async function say(parts) { // parts: [['en','Listen!'],['he','שלום']] or ['he','שלום',0.55] for slow
  if (!synth) return;
  const my = ++sayToken;
  synth.cancel();
  for (const [lang, text, rate] of parts) {
    if (my !== sayToken) return;
    await speakOne(text, lang, rate);
  }
}

// friendly explanation for recognition failures (kid-appropriate)
function micErrorText(e) {
  const msg = String((e && e.message) || e);
  if (/not-allowed|service-not-allowed/.test(msg)) return '🎤 The microphone is blocked — ask a grown-up to allow it in Settings → Safari → Microphone.';
  if (/no-speech|aborted/.test(msg)) return "🙉 Duki couldn't hear anything — get closer and speak up like a lion! 🦁";
  if (/audio-capture/.test(msg)) return '🎤 No microphone found — is one connected?';
  return '🎤 Mic hiccup — take a breath and try again!';
}

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
function listenOnce() {
  return new Promise((resolve, reject) => {
    if (!SR) return reject(new Error('unsupported'));
    let settled = false;
    const r = new SR();
    r.lang = 'he-IL'; r.interimResults = false; r.maxAlternatives = 5;
    r.onresult = (e) => { settled = true; resolve([...e.results[0]].map(a => a.transcript)); };
    r.onerror = (e) => { if (!settled) { settled = true; reject(new Error(e.error)); } };
    r.onend = () => { if (!settled) { settled = true; resolve([]); } };
    try { r.start(); } catch (e) { reject(e); }
    setTimeout(() => { try { r.stop(); } catch (e) {} }, 7000);
  });
}
const normHe = (s) => String(s).replace(/[֑-ׇ]/g, '').replace(/[^א-ת\s]/g, '').replace(/\s+/g, ' ').trim();
function heMatch(alts, target) {
  const t = normHe(target);
  const tWords = t.split(' ');
  return alts.some(a => {
    const n = normHe(a);
    if (!n) return false;
    if (n === t || n.includes(t) || t.includes(n)) return true;
    const hits = tWords.filter(w => n.includes(w)).length;
    return hits / tWords.length >= 0.6;
  });
}

// ---------- state ----------
const SAVE_KEY = 'ivritQuestSave1';
const EQ_SLOTS = { hat: null, eyes: null, body: null, hand: null, pet: null, ride: null, treasure: null };
let state = { xp: 0, coins: 0, stars: {}, owned: [], eq: { ...EQ_SLOTS } };
function load() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && typeof s.xp === 'number') state = { ...state, ...s, eq: { ...EQ_SLOTS, ...(s.eq || {}) } }; } catch (e) {} }
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {} }
const totalStars = () => Object.values(state.stars).reduce((a, b) => a + b, 0);
function rankOf(xp) { let r = RANKS[0]; for (const k of RANKS) if (xp >= k.xp) r = k; return r; }
function nextRank(xp) { return RANKS.find(k => k.xp > xp) || null; }

// ---------- screens ----------
function show(id) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  $('#' + id).classList.add('active');
}

// ---------- mascot: Duki the Hoopoe ----------
const DUKI_SVG = `
<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="28" cy="82" rx="17" ry="7" fill="#3a2d20" transform="rotate(24 28 82)"/>
  <g stroke="#f6a13c" stroke-width="5" stroke-linecap="round">
    <line x1="76" y1="38" x2="60" y2="16"/><line x1="78" y1="36" x2="70" y2="10"/>
    <line x1="81" y1="35" x2="82" y2="7"/><line x1="84" y1="36" x2="93" y2="11"/>
    <line x1="87" y1="39" x2="101" y2="20"/>
  </g>
  <circle cx="60" cy="16" r="4" fill="#3a2d20"/><circle cx="70" cy="10" r="4" fill="#3a2d20"/>
  <circle cx="82" cy="7" r="4" fill="#3a2d20"/><circle cx="93" cy="11" r="4" fill="#3a2d20"/>
  <circle cx="101" cy="20" r="4" fill="#3a2d20"/>
  <ellipse cx="58" cy="80" rx="30" ry="26" fill="#f6a13c"/>
  <ellipse cx="64" cy="89" rx="16" ry="12" fill="#ffd9a0"/>
  <g transform="rotate(-18 48 82)">
    <ellipse cx="48" cy="82" rx="17" ry="11" fill="#3a2d20"/>
    <rect x="35" y="75" width="26" height="3.6" rx="1.8" fill="#fff"/>
    <rect x="35" y="82" width="26" height="3.6" rx="1.8" fill="#fff"/>
  </g>
  <circle cx="79" cy="49" r="19" fill="#f6a13c"/>
  <path d="M95 50 q 20 3 24 9 q -19 2 -25 -1 z" fill="#3a2d20"/>
  <circle cx="83" cy="45" r="6" fill="#fff"/>
  <circle cx="84.6" cy="46" r="3.2" fill="#2d2a4a"/>
  <circle cx="85.8" cy="44.6" r="1.3" fill="#fff"/>
  <path d="M72 57 q 6 5 12 3" stroke="#c97a1a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M48 104 v9 m -5 9 l 5 -9 l 5 9 M66 104 v9 m -5 9 l 5 -9 l 5 9" stroke="#8a5a20" stroke-width="3" fill="none" stroke-linecap="round"/>
</svg>`;

let bubbleTimer = null;
function mascotSay(html, speakParts, mood) {
  const m = $('#mascot'), b = $('#bubble');
  b.innerHTML = html;
  b.classList.add('show');
  m.className = mood || 'talking';
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => { b.classList.remove('show'); m.className = ''; }, 7000);
  if (speakParts) say(speakParts);
}
function mascotMood(mood, ms = 1200) {
  const m = $('#mascot');
  m.className = mood;
  setTimeout(() => { if (m.className === mood) m.className = ''; }, ms);
}

// ---------- avatar ----------
function starPts(cx, cy, r) {
  let p = '';
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    p += `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)} `;
  }
  return p.trim();
}
// items with hand-drawn SVG art; everything else renders as an emoji sticker
const SVG_ART = new Set(['cap', 'tembel', 'wizard', 'crown', 'shades', 'starglasses', 'jersey', 'cape', 'astro']);
const SHOP_BY_ID = Object.fromEntries(SHOP.map(i => [i.id, i]));
function sticker(id, x, y, size) {
  const it = SHOP_BY_ID[id];
  return it ? `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle">${it.emoji}</text>` : '';
}

function avatarSVG(eq) {
  const svgItem = (slot) => (eq[slot] && SVG_ART.has(eq[slot]) ? eq[slot] : null);
  const emojiItem = (slot) => (eq[slot] && !SVG_ART.has(eq[slot]) ? eq[slot] : null);
  const hat = svgItem('hat'), eyes = svgItem('eyes'), body = svgItem('body');
  let back = '', overlay = '', glasses = '', hatSvg = '';

  if (body === 'cape') back = `<path d="M56 130 Q30 190 44 218 L100 190 L156 218 Q170 190 144 130 Q100 150 56 130 Z" fill="#e0356b"/>`;

  if (body === 'jersey') overlay = `
    <path d="M44 148 a56 60 0 0 0 112 0 l0 22 a56 40 0 0 1 -112 0 Z" fill="#fff"/>
    <path d="M42 152 h116 v14 h-116 z" fill="#2a6fdb" opacity=".9"/>
    <circle cx="100" cy="182" r="12" fill="#fff" stroke="#2d2a4a" stroke-width="2"/>
    <polygon points="${starPts(100, 182, 5)}" fill="#2d2a4a"/>`;
  if (body === 'astro') overlay = `
    <circle cx="100" cy="112" r="54" fill="rgba(210,235,255,.22)" stroke="#e8f4ff" stroke-width="4"/>
    <rect x="76" y="168" width="48" height="26" rx="8" fill="#e8eef7" stroke="#9fb2cc" stroke-width="2"/>
    <circle cx="88" cy="181" r="4" fill="#ff5e7e"/><circle cx="100" cy="181" r="4" fill="#ffce3d"/><circle cx="112" cy="181" r="4" fill="#2fd6a3"/>`;

  if (eyes === 'shades') glasses = `
    <rect x="64" y="108" width="30" height="20" rx="7" fill="#20203a"/>
    <rect x="106" y="108" width="30" height="20" rx="7" fill="#20203a"/>
    <rect x="92" y="112" width="16" height="5" fill="#20203a"/>`;
  if (eyes === 'starglasses') glasses = `
    <polygon points="${starPts(80, 118, 16)}" fill="#ffce3d" stroke="#e09a10" stroke-width="2"/>
    <polygon points="${starPts(120, 118, 16)}" fill="#ffce3d" stroke="#e09a10" stroke-width="2"/>
    <rect x="94" y="114" width="12" height="4" fill="#e09a10"/>`;

  if (hat === 'cap') hatSvg = `
    <path d="M62 90 a38 34 0 0 1 76 0 z" fill="#ff4d5e"/>
    <rect x="126" y="82" width="40" height="11" rx="6" fill="#c81e40"/>
    <circle cx="100" cy="60" r="5" fill="#ffce3d"/>`;
  if (hat === 'tembel') hatSvg = `
    <path d="M100 38 L60 92 L140 92 Z" fill="#7ec8ff"/>
    <path d="M56 92 h88 v8 a44 10 0 0 1 -88 0 Z" fill="#5aaef0"/>`;
  if (hat === 'wizard') hatSvg = `
    <path d="M104 14 L66 96 L138 96 Z" fill="#8b3fe8"/>
    <ellipse cx="102" cy="96" rx="46" ry="10" fill="#6a25c0"/>
    <polygon points="${starPts(101, 58, 9)}" fill="#ffce3d"/>
    <circle cx="104" cy="14" r="6" fill="#ffce3d"/>`;
  if (hat === 'crown') hatSvg = `
    <path d="M64 92 L64 58 L82 76 L100 48 L118 76 L136 58 L136 92 Z" fill="#ffce3d" stroke="#e09a10" stroke-width="3"/>
    <circle cx="82" cy="86" r="4" fill="#ff4d5e"/><circle cx="100" cy="86" r="4" fill="#43b8ff"/><circle cx="118" cy="86" r="4" fill="#2fd6a3"/>`;

  return `
<svg viewBox="0 0 200 235" xmlns="http://www.w3.org/2000/svg">
  ${back}
  ${sticker(emojiItem('ride'), 100, 232, 46)}
  <ellipse cx="78" cy="212" rx="16" ry="9" fill="#2aa392"/>
  <ellipse cx="122" cy="212" rx="16" ry="9" fill="#2aa392"/>
  <path d="M100 76 C 150 76 158 118 158 148 C 158 188 132 208 100 208 C 68 208 42 188 42 148 C 42 118 50 76 100 76 Z" fill="#3ec6b8"/>
  <path d="M100 76 C 150 76 158 118 158 148 C 158 165 154 179 147 189 C 120 196 80 196 53 189 C 46 179 42 165 42 148 C 42 118 50 76 100 76 Z" fill="#4fdccb" opacity=".55"/>
  <circle cx="80" cy="118" r="12" fill="#fff"/><circle cx="120" cy="118" r="12" fill="#fff"/>
  <circle cx="82" cy="120" r="5.5" fill="#2d2a4a"/><circle cx="122" cy="120" r="5.5" fill="#2d2a4a"/>
  <circle cx="84" cy="118" r="2" fill="#fff"/><circle cx="124" cy="118" r="2" fill="#fff"/>
  <circle cx="70" cy="140" r="6" fill="#ff9cae" opacity=".7"/><circle cx="130" cy="140" r="6" fill="#ff9cae" opacity=".7"/>
  <path d="M84 148 Q100 164 116 148" stroke="#2d2a4a" stroke-width="4" fill="none" stroke-linecap="round"/>
  ${overlay}${glasses}${hatSvg}
  ${sticker(emojiItem('body'), 100, 186, 42)}
  ${sticker(emojiItem('eyes'), 100, 133, 38)}
  ${sticker(emojiItem('hat'), 100, 74, 54)}
  ${sticker(emojiItem('hand'), 176, 192, 40)}
  ${sticker(emojiItem('pet'), 24, 218, 42)}
  ${sticker(emojiItem('treasure'), 172, 54, 36)}
</svg>`;
}

// ---------- fx ----------
const FX_COLORS = ['#ffce3d', '#ff5e7e', '#2fd6a3', '#43b8ff', '#9b5eff', '#ff9838'];
function confetti(n = 60) {
  const layer = $('#fx-layer');
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div');
    c.className = 'confetto';
    c.style.left = Math.random() * 100 + '%';
    c.style.background = pick(FX_COLORS);
    c.style.width = c.style.height = 6 + Math.random() * 10 + 'px';
    c.style.borderRadius = Math.random() > 0.5 ? '50%' : '3px';
    c.style.animationDuration = 1.4 + Math.random() * 1.8 + 's';
    c.style.animationDelay = Math.random() * 0.5 + 's';
    layer.appendChild(c);
    setTimeout(() => c.remove(), 4200);
  }
}
function burst(emoji, x, y) {
  const b = document.createElement('div');
  b.className = 'burst-emoji';
  b.textContent = emoji;
  b.style.left = x + 'px'; b.style.top = y + 'px';
  $('#fx-layer').appendChild(b);
  setTimeout(() => b.remove(), 1100);
}
function starryBg() {
  const app = $('#app');
  for (let i = 0; i < 36; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    s.style.left = Math.random() * 100 + '%';
    s.style.top = Math.random() * 100 + '%';
    s.style.width = s.style.height = 1.5 + Math.random() * 3 + 'px';
    s.style.animationDelay = Math.random() * 3 + 's';
    app.appendChild(s);
  }
}

// ---------- home ----------
function renderHome() {
  show('home');
  $('#hud-stars').textContent = totalStars();
  $('#hud-xp').textContent = state.xp;
  $('#hud-coins').textContent = state.coins;

  $('#home-avatar').innerHTML = avatarSVG(state.eq);
  const r = rankOf(state.xp), nx = nextRank(state.xp);
  $('#rank-line').textContent = `${r.emoji} ${r.name}`;
  $('#xp-line').textContent = nx ? `${nx.xp - state.xp} XP to ${nx.name} ${nx.emoji}` : 'Top rank reached! 🎉';
  const base = r.xp, top = nx ? nx.xp : state.xp || 1;
  $('#xp-fill').style.width = Math.min(100, ((state.xp - base) / Math.max(1, top - base)) * 100) + '%';

  $('#tip-text').textContent = pick(HOME_TIPS);

  const path = $('#path');
  path.innerHTML = '';
  let currentIdx = LEVELS.findIndex(l => !(l.id in state.stars));
  if (currentIdx === -1) currentIdx = LEVELS.length;
  // Free roam: letters (l1–l6) are sequential. Finishing them opens everything
  // through Numbers (l10); finishing Numbers too removes all remaining locks.
  const lettersDone = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6'].every(id => id in state.stars);
  const numbersDone = 'l10' in state.stars;
  const numbersIdx = LEVELS.findIndex(l => l.id === 'l10');
  const unlockedAt = (i) =>
    i <= currentIdx ||
    (lettersDone && numbersDone) ||
    (lettersDone && i <= numbersIdx);
  LEVELS.forEach((lvl, i) => {
    const done = lvl.id in state.stars;
    const current = i === currentIdx;
    const locked = !unlockedAt(i);
    const node = document.createElement('div');
    const resume = state.lessonSave && state.lessonSave.levelId === lvl.id ? 'resume ' : '';
    node.className = 'lvl-node ' + (i % 2 ? 'offR ' : 'offL ') + resume + (done ? 'done' : current ? 'current' : locked ? 'locked' : '');
    const starsTxt = done ? '★'.repeat(state.stars[lvl.id]) + '<span style="opacity:.3">' + '★'.repeat(3 - state.stars[lvl.id]) + '</span>' : '';
    node.innerHTML = `
      <div class="bubble">${locked ? '🔒' : lvl.emoji}</div>
      <div class="meta">
        <div class="t">${esc(lvl.title)}</div>
        <div class="s ${/[א-ת]/.test(lvl.sub) ? 'he' : ''}">${esc(lvl.sub)}</div>
        ${done ? `<div class="stars" style="color:var(--sun)">${starsTxt}</div>` : ''}
        ${locked ? '<div class="stars" style="color:var(--sun);font-size:13px">⚡ Know it already? Tap to test out!</div>' : ''}
      </div>`;
    if (locked) node.addEventListener('click', () => { SFX.click(); showSkillCheckIntro(i); });
    else node.addEventListener('click', () => { SFX.click(); startLevel(lvl); });
    path.appendChild(node);
  });

  const cur = LEVELS[Math.min(currentIdx, LEVELS.length - 1)];
  mascotSay(`Shalom! 👋 Ready for <b>${esc(cur.title)}</b>? Tap a glowing level to play!`,
    [['he', 'שלום'], ['en', `Ready for ${cur.title}? Tap a level to play!`]]);
}

// ---------- lesson engine ----------
let lesson = null;

function buildQueue(level) {
  const q = [];
  const items = level.items;
  const quiz = (type, item, extra) => ({ type, item, isQuiz: true, ...extra });

  if (level.kind === 'letters' || level.kind === 'vowels') {
    for (let i = 0; i < items.length; i += 3) {
      const chunk = items.slice(i, i + 3);
      chunk.forEach(it => q.push({ type: 'learn', item: it }));
      shuffle(chunk).forEach(it => q.push(quiz('pickChar', it)));
      shuffle(chunk).forEach(it => q.push(quiz('pickName', it)));
    }
    q.push(quiz('match', null, { pairs: shuffle(items).slice(0, 4) }));
    shuffle(items).slice(0, 4).forEach(it => q.push(quiz(pick(['pickChar', 'pickName']), it)));
  }
  else if (level.kind === 'review') {
    shuffle(items).slice(0, 6).forEach(it => q.push(quiz('pickChar', it)));
    q.push(quiz('match', null, { pairs: shuffle(items).slice(0, 4) }));
    shuffle(items).slice(0, 6).forEach(it => q.push(quiz('pickName', it)));
    q.push(quiz('match', null, { pairs: shuffle(items).slice(0, 4) }));
  }
  else if (level.kind === 'vocab') {
    for (let i = 0; i < items.length; i += 4) {
      const chunk = items.slice(i, i + 4);
      chunk.forEach(it => q.push({ type: 'learn', item: it }));
      shuffle(chunk).forEach(it => q.push(quiz('hearPick', it)));
      shuffle(chunk).forEach((it, j) => q.push(quiz(j % 2 ? 'readPick' : 'enPick', it)));
    }
    q.push(quiz('match', null, { pairs: shuffle(items).slice(0, 4) }));
    const talk = shuffle(items).slice(0, 3);
    talk.forEach(it => q.push(quiz(SR ? 'speak' : 'enPick', it)));
    shuffle(items).slice(0, 2).forEach(it => q.push(quiz('hearPick', it)));
  }
  else if (level.kind === 'sentences') {
    items.forEach(it => { q.push({ type: 'learn', item: it }); q.push(quiz('build', it)); });
    shuffle(items).slice(0, 3).forEach(it => q.push(quiz('readPick', it)));
    if (SR) shuffle(items).slice(0, 2).forEach(it => q.push(quiz('speak', it)));
  }
  return q;
}

// --- mid-lesson save/resume: refreshing the page must never lose a kid's progress ---
function persistLesson() {
  const L = lesson;
  if (!L || L.isCheck) return; // skill checks are short one-shots, never resumed
  state.lessonSave = {
    levelId: L.level.id, idx: L.idx, totalQuiz: L.totalQuiz, correctFirst: L.correctFirst,
    combo: L.combo, xpGained: L.xpGained,
    steps: L.queue.map(s => ({
      t: s.type,
      i: L.level.items.indexOf(s.item),
      r: s.requeued ? 1 : 0,
      p: s.pairs ? s.pairs.map(x => L.level.items.indexOf(x)) : undefined,
    })),
  };
  save();
}
function restoreLesson(level, data) {
  const queue = data.steps.map(d => ({
    type: d.t,
    item: d.i >= 0 ? level.items[d.i] : null,
    isQuiz: d.t !== 'learn' ? true : undefined,
    requeued: d.r ? true : undefined,
    pairs: d.p ? d.p.map(i => level.items[i]) : undefined,
  }));
  if (queue.some(s => s.type !== 'match' && !s.item)) throw new Error('stale save');
  return {
    level, queue, idx: Math.min(data.idx, queue.length - 1),
    totalQuiz: data.totalQuiz || 0, correctFirst: data.correctFirst || 0,
    combo: data.combo || 0, xpGained: data.xpGained || 0,
  };
}

function startLevel(level) {
  synth && synth.cancel();
  lesson = null;
  if (state.lessonSave && state.lessonSave.levelId === level.id) {
    try {
      lesson = restoreLesson(level, state.lessonSave);
      mascotSay(`Welcome back! Picking up right where you left off 💪`, [['en', 'Welcome back! Picking up where you left off!']], 'happy');
    } catch (e) { lesson = null; }
  }
  if (!lesson) lesson = { level, queue: buildQueue(level), idx: 0, totalQuiz: 0, correctFirst: 0, combo: 0, xpGained: 0 };
  persistLesson();
  show('lesson');
  renderStep();
}

function addXP(n) { state.xp += n; lesson && (lesson.xpGained += n); save(); }

function updateProgress() {
  const L = lesson;
  $('#lesson-progress').style.width = Math.min(100, (L.idx / L.queue.length) * 100) + '%';
  const cp = $('#combo-pill');
  if (L.combo >= 3) { cp.classList.add('show'); $('#combo-n').textContent = 'x' + L.combo; }
  else cp.classList.remove('show');
}

const PRAISE = ['Metzuyan! Excellent!', 'Ken! Correct!', 'Amazing!', 'Yofi! Beautiful!', 'You got it!', 'Kol hakavod! Well done!'];
const OOPS = ['Almost!', 'Not quite…', 'Oops! Keep going!'];

function showFeedback(good, subHtml) {
  const fb = $('#feedback');
  fb.className = good ? 'good show' : 'bad show';
  fb.querySelector('.fb-emoji').textContent = good ? pick(['🎉', '⭐', '💪', '🔥', '✨']) : '🤔';
  fb.querySelector('.fb-title').textContent = good ? pick(PRAISE) : pick(OOPS);
  fb.querySelector('.fb-sub').innerHTML = subHtml || '';
}
function hideFeedback() { $('#feedback').classList.remove('show'); }

function finishStep(correct, subHtml) {
  const L = lesson, step = L.queue[L.idx];
  if (step.isQuiz) {
    if (!step.requeued) L.totalQuiz++;
    if (correct) {
      if (!step.requeued) { L.correctFirst++; addXP(10); } else addXP(5);
      L.combo++;
      if (L.combo > 0 && L.combo % 5 === 0) { addXP(5); SFX.combo(); mascotSay(`🔥 Combo x${L.combo}! Bonus XP!`); }
      SFX.good(); mascotMood('happy');
    } else {
      L.combo = 0;
      SFX.bad(); mascotMood('sad');
      if (!step.requeued && !L.isCheck) L.queue.push({ ...step, requeued: true });
    }
  } else {
    SFX.click();
  }
  if (step.isQuiz) showFeedback(correct, subHtml);
  setTimeout(() => {
    hideFeedback();
    L.idx++;
    updateProgress();
    if (L.idx >= L.queue.length) finishLevel();
    else { persistLesson(); renderStep(); }
  }, step.isQuiz ? (correct ? 1050 : 1950) : 150);
}

// ---------- step renderers ----------
function renderStep() {
  const L = lesson, step = L.queue[L.idx];
  updateProgress();
  const stage = $('#stage');
  stage.innerHTML = '';
  const R = {
    learn: renderLearn, pickChar: renderPickChar, pickName: renderPickName,
    hearPick: renderHearPick, readPick: renderReadPick, enPick: renderEnPick,
    match: renderMatch, speak: renderSpeak, build: renderBuild,
  };
  R[step.type](step, stage);
}

const isLetterish = (it) => 'char' in it;

function choiceBtn(inner, cb) {
  const b = document.createElement('button');
  b.className = 'choice';
  b.innerHTML = inner;
  b.addEventListener('click', () => cb(b));
  return b;
}
function lockChoices() { $$('#stage .choice').forEach(c => (c.disabled = true)); }

// --- learn card ---
function renderLearn(step, stage) {
  const it = step.item;
  const card = document.createElement('div');
  card.className = 'learn-card';

  if (isLetterish(it)) {
    card.innerHTML = `
      <div class="he-hero" style="color:#5b2ab8">${it.char}</div>
      <div class="lname">${esc(it.name)} <span class="big-emoji">${it.memoji}</span></div>
      <div class="lsound">${esc(it.sound)}</div>
      <div class="mnemo">💡 ${esc(it.mnemonic)}</div>
      <div class="example">
        <span class="w-em">${it.word.emoji}</span>
        <span><span class="w-he">${it.word.he}</span><br><span class="w-tr">${esc(it.word.translit)}</span> · <span class="w-en">${esc(it.word.en)}</span></span>
      </div>
      <div class="learn-row">
        <button class="btn sound-btn" id="b-letter">🔊 Letter</button>
        <button class="btn sound-btn" id="b-word">🔊 Word</button>
        ${SR ? '<button class="btn mic-btn" id="b-mic">🎤 Say it!</button>' : ''}
        <button class="btn btn-green" id="b-next">Got it ➜</button>
      </div>
      <div class="heard-note" id="heard"></div>`;
    stage.appendChild(card);
    $('#b-letter').addEventListener('click', () => say([['he', it.nameHe]]));
    $('#b-word').addEventListener('click', () => say([['he', it.word.plain], ['en', it.word.en]]));
    say([['en', `This is ${it.name}.`], ['he', it.nameHe], ['en', it.sound]]);
    mascotSay(`💡 ${esc(it.mnemonic)}`);
    if (SR) wireLearnMic([it.word.plain, it.nameHe], it.word.he);
  } else {
    // vocab word or sentence
    const isSent = 'words' in it;
    card.innerHTML = `
      <div style="font-size:64px">${it.emoji}</div>
      <div class="${isSent ? 'he-big' : 'he-hero'}" style="color:#5b2ab8">${it.he}</div>
      <div class="lsound" style="font-size:20px">${esc(it.translit)}</div>
      <div class="lname" style="margin-top:8px">${esc(it.en)}</div>
      <div class="learn-row">
        <button class="btn sound-btn" id="b-word">🔊 Hear it</button>
        ${SR ? '<button class="btn mic-btn" id="b-mic">🎤 Say it!</button>' : ''}
        <button class="btn btn-green" id="b-next">Got it ➜</button>
      </div>
      <div class="heard-note" id="heard"></div>`;
    stage.appendChild(card);
    $('#b-word').addEventListener('click', () => say([['he', it.plain]]));
    say([['he', it.plain], ['en', it.en]]);
    mascotSay(`Repeat after me: <span class="he">${it.he}</span> — "${esc(it.translit)}" means <b>${esc(it.en)}</b> ${it.emoji}`);
    if (SR) wireLearnMic(it.accept ? [...it.accept, it.plain] : [it.plain], it.he);
  }
  $('#b-next').addEventListener('click', () => finishStep(true));
}

function wireLearnMic(targets, displayHe) {
  const mic = $('#b-mic'), note = $('#heard');
  if (!mic) return;
  const target = targets[0];
  mic.addEventListener('click', async () => {
    synth && synth.cancel();
    mic.classList.add('listening'); mic.textContent = '👂 Listening…';
    note.textContent = '';
    try {
      const alts = await listenOnce();
      const ok = alts.length && targets.some(t => heMatch(alts, t));
      if (ok) {
        note.textContent = `Duki heard: "${alts[0]}" — perfect! +5 XP`;
        addXP(5); SFX.good(); mascotMood('happy');
        mascotSay('🎉 Wow, great pronunciation!', [['en', 'Great pronunciation!']]);
      } else if (alts.length) {
        note.textContent = `Duki heard: "${alts[0]}" — not quite!`;
        SFX.bad(); mascotMood('sad', 900);
        mascotSay(`🤔 I heard <b>"${esc(alts[0])}"</b> — we want <span class="he">${displayHe || target}</span>. Listen sloooowly, then try again!`,
          [['en', 'Not quite! Listen closely:'], ['he', target, 0.55], ['en', 'Now you try!']]);
      } else {
        SFX.bad();
        note.textContent = "🙉 Duki couldn't hear you — speak up like a lion! 🦁";
        say([['en', "I couldn't hear you. Say it loud like this:"], ['he', target, 0.7]]);
      }
    } catch (e) {
      note.textContent = micErrorText(e);
    }
    mic.classList.remove('listening'); mic.textContent = '🎤 Say it!';
  });
}

// --- tap the letter / vowel ---
function renderPickChar(step, stage) {
  const it = step.item, pool = step.pool || lesson.level.items;
  const isVowel = (step.srcKind || lesson.level.kind) === 'vowels';
  const prompt = document.createElement('div');
  prompt.className = 'prompt';
  prompt.innerHTML = isVowel
    ? `Tap <b>${esc(it.name)}</b> — the vowel that says <b>${esc(it.sound)}</b> <button class="icon-btn" id="replay">🔊</button>`
    : `Tap the letter <b>${esc(it.name)}</b>! <button class="icon-btn" id="replay">🔊</button>`;
  stage.appendChild(prompt);

  const opts = shuffle([it, ...others(pool, it, 3, d => d.char)]);
  const grid = document.createElement('div'); grid.className = 'choices';
  opts.forEach(o => grid.appendChild(choiceBtn(`<span class="c-he">${o.char}</span>`, (btn) => {
    lockChoices();
    const good = o === it;
    btn.classList.add(good ? 'right' : 'wrong-pick');
    if (!good) $$('#stage .choice').forEach((c, i) => { if (opts[i] === it) c.classList.add('reveal'); });
    finishStep(good, good ? '' : `${esc(it.name)} is <span class="he" style="font-size:26px">${it.char}</span>`);
  })));
  stage.appendChild(grid);
  const audio = () => say([['en', isVowel ? `Tap ${it.name}. It says ${it.sound}` : `Tap the letter ${it.name}`], ['he', it.nameHe]]);
  $('#replay').addEventListener('click', audio);
  audio();
}

// --- what sound does it make ---
function renderPickName(step, stage) {
  const it = step.item, pool = step.pool || lesson.level.items;
  const prompt = document.createElement('div');
  prompt.className = 'prompt';
  prompt.innerHTML = `What is this ${(step.srcKind || lesson.level.kind) === 'vowels' ? 'vowel' : 'letter'}?`;
  stage.appendChild(prompt);

  const hero = document.createElement('div');
  hero.className = 'he-hero'; hero.style.color = 'var(--sun)';
  hero.textContent = it.char;
  stage.appendChild(hero);
  hero.style.marginBottom = '18px';

  const opts = shuffle([it, ...others(pool.filter(d => d.sound !== it.sound || d === it), it, 3, d => d.name)]);
  const grid = document.createElement('div'); grid.className = 'choices';
  opts.forEach(o => grid.appendChild(choiceBtn(
    `<span class="c-txt">${esc(o.name)}</span><span class="c-sub">${esc(o.sound)}</span>`,
    (btn) => {
      lockChoices();
      const good = o === it;
      btn.classList.add(good ? 'right' : 'wrong-pick');
      if (!good) $$('#stage .choice').forEach((c, i) => { if (opts[i] === it) c.classList.add('reveal'); });
      if (good) say([['he', it.nameHe]]);
      finishStep(good, good ? '' : `<span class="he">${it.char}</span> is ${esc(it.name)} — ${esc(it.sound)}`);
    })));
  stage.appendChild(grid);
  say([['en', 'What is this one?']]);
}

// --- vocab: hear → pick meaning ---
function renderHearPick(step, stage) {
  const it = step.item, pool = step.pool || lesson.level.items;
  const prompt = document.createElement('div');
  prompt.className = 'prompt';
  prompt.innerHTML = `🦜 Duki said a word — which one is it? <button class="icon-btn" id="replay">🔊</button>`;
  stage.appendChild(prompt);

  const opts = shuffle([it, ...others(pool, it, 3, d => d.en)]);
  const grid = document.createElement('div'); grid.className = 'choices';
  opts.forEach(o => grid.appendChild(choiceBtn(
    `<span class="c-em">${o.emoji}</span><span class="c-txt">${esc(o.en)}</span>`,
    (btn) => {
      lockChoices();
      const good = o === it;
      btn.classList.add(good ? 'right' : 'wrong-pick');
      if (!good) $$('#stage .choice').forEach((c, i) => { if (opts[i] === it) c.classList.add('reveal'); });
      finishStep(good, `<span class="he">${it.he}</span> = ${esc(it.en)} ${it.emoji}`);
    })));
  stage.appendChild(grid);
  const audio = () => say([['he', it.plain]]);
  $('#replay').addEventListener('click', audio);
  audio();
}

// --- vocab/sentence: read Hebrew → pick meaning ---
function renderReadPick(step, stage) {
  const it = step.item, pool = step.pool || lesson.level.items;
  const prompt = document.createElement('div');
  prompt.className = 'prompt';
  prompt.textContent = 'What does this say?';
  stage.appendChild(prompt);

  const hero = document.createElement('div');
  hero.className = 'he-big'; hero.style.cssText = 'color:var(--sun);margin-bottom:20px;text-align:center';
  hero.textContent = it.he;
  stage.appendChild(hero);

  const opts = shuffle([it, ...others(pool, it, 3, d => d.en)]);
  const grid = document.createElement('div'); grid.className = 'choices';
  opts.forEach(o => grid.appendChild(choiceBtn(
    `<span class="c-em">${o.emoji}</span><span class="c-txt">${esc(o.en)}</span>`,
    (btn) => {
      lockChoices();
      const good = o === it;
      btn.classList.add(good ? 'right' : 'wrong-pick');
      if (!good) $$('#stage .choice').forEach((c, i) => { if (opts[i] === it) c.classList.add('reveal'); });
      say([['he', it.plain]]);
      finishStep(good, `<span class="he">${it.he}</span> = ${esc(it.en)}`);
    })));
  stage.appendChild(grid);
  say([['en', 'What does this say?']]);
}

// --- vocab: English → pick Hebrew ---
function renderEnPick(step, stage) {
  const it = step.item, pool = step.pool || lesson.level.items;
  const prompt = document.createElement('div');
  prompt.className = 'prompt';
  prompt.innerHTML = `How do you say <b>${esc(it.en)}</b> ${it.emoji} in Hebrew?`;
  stage.appendChild(prompt);

  const opts = shuffle([it, ...others(pool, it, 3, d => d.he)]);
  const grid = document.createElement('div'); grid.className = 'choices';
  opts.forEach(o => grid.appendChild(choiceBtn(
    `<span class="c-he small">${o.he}</span><span class="c-sub">${esc(o.translit)}</span>`,
    (btn) => {
      lockChoices();
      const good = o === it;
      btn.classList.add(good ? 'right' : 'wrong-pick');
      if (!good) $$('#stage .choice').forEach((c, i) => { if (opts[i] === it) c.classList.add('reveal'); });
      say([['he', it.plain]]);
      finishStep(good, `${esc(it.en)} = <span class="he">${it.he}</span> "${esc(it.translit)}"`);
    })));
  stage.appendChild(grid);
  say([['en', `How do you say ${it.en} in Hebrew?`]]);
}

// --- match pairs ---
function renderMatch(step, stage) {
  const pairs = step.pairs;
  const prompt = document.createElement('div');
  prompt.className = 'prompt';
  prompt.textContent = '🧩 Match the pairs!';
  stage.appendChild(prompt);

  const letterMode = isLetterish(pairs[0]);
  const cards = shuffle([
    ...pairs.map(p => ({ p, side: 'a', label: letterMode ? p.char : p.he, sub: '' })),
    ...pairs.map(p => ({ p, side: 'b', label: letterMode ? p.memoji : p.emoji, sub: letterMode ? p.name : p.en })),
  ]);
  const grid = document.createElement('div'); grid.className = 'match-grid';
  let first = null, matched = 0, mistakes = 0, lockBoard = false;

  cards.forEach(c => {
    const el = document.createElement('button');
    el.className = 'match-card';
    el.innerHTML = `<span class="${c.side === 'a' ? 'he' : ''}">${c.label}</span>${c.sub ? `<span class="m-sub">${esc(c.sub)}</span>` : ''}`;
    el.addEventListener('click', () => {
      if (lockBoard || el.classList.contains('matched') || el === (first && first.el)) return;
      SFX.click();
      el.classList.add('picked');
      if (!first) { first = { c, el }; return; }
      const a = first; first = null;
      if (a.c.p === c.p && a.c.side !== c.side) {
        a.el.classList.remove('picked'); el.classList.remove('picked');
        a.el.classList.add('matched'); el.classList.add('matched');
        matched++;
        say([['he', letterMode ? c.p.nameHe : c.p.plain]]);
        SFX.good();
        if (matched === pairs.length) {
          setTimeout(() => finishStep(mistakes === 0, mistakes === 0 ? 'Perfect memory! 🧠' : `All matched — ${mistakes} slip${mistakes > 1 ? 's' : ''}!`), 500);
        }
      } else {
        mistakes++; lockBoard = true;
        a.el.classList.add('nope'); el.classList.add('nope');
        SFX.bad();
        setTimeout(() => {
          a.el.classList.remove('picked', 'nope'); el.classList.remove('picked', 'nope');
          lockBoard = false;
        }, 600);
      }
    });
    grid.appendChild(el);
  });
  stage.appendChild(grid);
  say([['en', 'Match the pairs!']]);
}

// --- speak it! ---
function renderSpeak(step, stage) {
  const it = step.item;
  const zone = document.createElement('div');
  zone.className = 'speak-zone';
  zone.innerHTML = `
    <div class="prompt">🎤 Your turn to SPEAK Hebrew!</div>
    <div class="speak-target">
      <div class="st-em">${it.emoji}</div>
      <div class="st-en">${esc(it.en)}</div>
      <div class="st-he">${it.he}</div>
      <div class="st-tr">"${esc(it.translit)}"</div>
    </div>
    <div>
      <button class="icon-btn" id="hear-it" style="margin-right:10px">🔊</button>
      <button class="big-mic" id="big-mic">🎤</button>
    </div>
    <div class="speak-status" id="speak-status">Tap the mic and say it in Hebrew!</div>
    <button class="btn btn-ghost" id="skip-speak" style="margin-top:10px">Too noisy? Skip ➜</button>`;
  stage.appendChild(zone);

  let attempts = 0;
  const mic = $('#big-mic'), status = $('#speak-status');
  $('#hear-it').addEventListener('click', () => say([['he', it.plain]]));
  $('#skip-speak').addEventListener('click', () => finishStep(false, `Say: <span class="he">${it.he}</span> — "${esc(it.translit)}"`));
  mic.addEventListener('click', async () => {
    synth && synth.cancel();
    mic.classList.add('listening'); mic.disabled = true;
    status.textContent = '👂 Duki is listening…';
    try {
      const alts = await listenOnce();
      mic.classList.remove('listening'); mic.disabled = false;
      const speakTargets = it.accept ? [...it.accept, it.plain] : [it.plain];
      if (alts.length && speakTargets.some(t => heMatch(alts, t))) {
        status.textContent = `Duki heard: "${alts[0]}" ✔`;
        addXP(5);
        burst('🎉', window.innerWidth / 2, window.innerHeight / 2);
        finishStep(true, `You SAID it! <span class="he">${it.he}</span> +bonus XP`);
      } else {
        attempts++;
        SFX.bad(); mascotMood('sad', 900);
        if (attempts >= 3) {
          finishStep(true, 'Great effort! Speaking takes practice 💪');
          return;
        }
        const heard = alts.length ? `Duki heard: "${alts[0]}" — not quite!` : "🙉 Duki couldn't hear you!";
        status.innerHTML = `${esc(heard)}<br>👂 Listen closely… then try again${attempts === 2 ? ' — last try, then we move on!' : '!'}`;
        mascotSay(
          `🤔 ${esc(heard)} We're saying <span class="he">${it.he}</span> — "${esc(it.translit)}". Listen sloooowly!`,
          [['en', alts.length ? 'Not quite! Listen closely:' : "I couldn't hear you. Listen, nice and loud:"], ['he', it.plain, 0.55], ['en', 'Now you try!']]
        );
      }
    } catch (e) {
      mic.classList.remove('listening'); mic.disabled = false;
      SFX.bad();
      status.textContent = micErrorText(e) + ' (Or tap Skip.)';
    }
  });
  say([['en', `Say ${it.en} in Hebrew. Like this:`], ['he', it.plain]]);
  mascotSay(`Say it like this: <span class="he">${it.he}</span> — "${esc(it.translit)}"`);
}

// --- sentence builder ---
function renderBuild(step, stage) {
  const it = step.item;
  const prompt = document.createElement('div');
  prompt.className = 'prompt';
  prompt.innerHTML = `🔨 Build it in Hebrew: <b>"${esc(it.en)}"</b> ${it.emoji} <button class="icon-btn" id="replay">🔊</button>`;
  stage.appendChild(prompt);

  const answer = document.createElement('div'); answer.className = 'build-answer';
  const bank = document.createElement('div'); bank.className = 'build-bank';
  stage.appendChild(answer); stage.appendChild(bank);

  // each tile is its own object so duplicate words behave correctly
  const tiles = shuffle(it.words.map((w, i) => ({ w, key: i, used: false })));
  const chosen = []; // array of tile objects, in picked order
  const render = () => {
    answer.innerHTML = ''; bank.innerHTML = '';
    chosen.forEach((tile, i) => {
      const t = document.createElement('button');
      t.className = 'tile'; t.textContent = tile.w;
      t.addEventListener('click', () => { SFX.click(); tile.used = false; chosen.splice(i, 1); render(); });
      answer.appendChild(t);
    });
    tiles.forEach((tile) => {
      const t = document.createElement('button');
      t.className = 'tile' + (tile.used ? ' ghost' : '');
      t.textContent = tile.w;
      t.addEventListener('click', () => {
        if (tile.used) return;
        SFX.click(); tile.used = true; chosen.push(tile); render();
      });
      bank.appendChild(t);
    });
    check.style.display = chosen.length === it.words.length ? 'inline-block' : 'none';
  };

  const check = document.createElement('button');
  check.className = 'btn btn-green'; check.textContent = 'Check ✓'; check.style.marginTop = '18px';
  check.addEventListener('click', () => {
    const good = chosen.map(t => t.w).join(' ') === it.words.join(' ');
    if (good) say([['he', it.plain]]);
    finishStep(good, `<span class="he">${it.he}</span> — "${esc(it.translit)}"`);
  });
  stage.appendChild(check);

  const audio = () => say([['en', it.en], ['he', it.plain]]);
  $('#replay').addEventListener('click', audio);
  render();
  audio();
}

// ---------- backup nudge: every ~5 completed levels, one gentle reminder ----------
const NUDGE_EVERY = 5;
const completedCount = () => Object.keys(state.stars).length;
function nudgeHtml() {
  if (completedCount() - (state.lastNudgeLevels || 0) < NUDGE_EVERY) return '';
  state.lastNudgeLevels = completedCount();
  save();
  return `<button class="btn btn-ghost nudge-btn" id="nudge-backup">🔑 Lots of new progress — tap to save your backup code!</button>`;
}
function wireNudge() {
  const b = $('#nudge-backup');
  if (b) b.addEventListener('click', () => { SFX.click(); showBackup(); });
}

// ---------- results ----------
function finishLevel() {
  const L = lesson;
  if (L.isCheck) return finishCheck();
  const acc = L.totalQuiz ? L.correctFirst / L.totalQuiz : 1;
  const stars = acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : 1;
  const firstTime = !(L.level.id in state.stars);
  const coins = 10 + stars * 5;
  state.stars[L.level.id] = Math.max(state.stars[L.level.id] || 0, stars);
  state.coins += coins;
  delete state.lessonSave;
  save();

  const res = $('#results');
  res.innerHTML = `
    <h2>Level Complete!</h2>
    <div style="font-size:20px;color:#cfc4f2">${esc(L.level.emoji)} ${esc(L.level.title)}</div>
    <div class="stars-row">${'⭐'.repeat(stars)}<span class="dim">${'⭐'.repeat(3 - stars)}</span></div>
    <div class="gains">
      <div class="gain">⚡ +${L.xpGained}<span>XP earned</span></div>
      <div class="gain">🪙 +${coins}<span>coins</span></div>
      <div class="gain">🎯 ${Math.round(acc * 100)}%<span>accuracy</span></div>
    </div>
    <button class="btn btn-primary" id="res-shop" style="margin-top:14px">🎭 Reward time — Costume Shop!</button>
    <button class="btn btn-ghost" id="res-home">🗺 Back to the map</button>
    ${nudgeHtml()}`;
  show('results');
  $('#res-shop').addEventListener('click', () => { SFX.click(); renderShop(); });
  $('#res-home').addEventListener('click', () => { SFX.click(); renderHome(); });
  wireNudge();

  SFX.fanfare();
  confetti(stars * 40);
  setTimeout(() => SFX.coin(), 700);
  const cheer = stars === 3 ? 'PERFECT! Three stars! You are unstoppable!' :
                stars === 2 ? 'Two stars! Awesome work!' : 'Level done! Practice again for more stars!';
  mascotSay(`🎉 ${cheer} You won <b>${coins} coins</b> — spend them in the costume shop!`,
    [['en', cheer], ['he', 'כל הכבוד!']], 'happy');
  lesson = null;
}

// ---------- skill check: test out of levels you already know ----------
const CHECK_PASS = 0.8;

function buildCheckQueue(fromIdx, toIdx) {
  const cand = [];
  for (let i = fromIdx; i < toIdx; i++) {
    const lvl = LEVELS[i];
    const mk = (type, item) => ({ type, item, isQuiz: true, pool: lvl.items, srcKind: lvl.kind });
    const items = shuffle(lvl.items);
    if (lvl.kind === 'letters' || lvl.kind === 'review' || lvl.kind === 'vowels') {
      items.slice(0, 3).forEach((it, j) => cand.push(mk(j % 2 ? 'pickName' : 'pickChar', it)));
    } else if (lvl.kind === 'vocab') {
      items.slice(0, 3).forEach((it, j) => cand.push(mk(['hearPick', 'readPick', 'enPick'][j % 3], it)));
    } else { // sentences
      items.slice(0, 2).forEach((it, j) => cand.push(mk(j % 2 ? 'build' : 'readPick', it)));
    }
  }
  return shuffle(cand).slice(0, 10);
}

function showSkillCheckIntro(targetIdx) {
  const fromIdx = LEVELS.findIndex(l => !(l.id in state.stars));
  const target = LEVELS[targetIdx];
  const n = targetIdx - fromIdx;
  const old = $('.modal-overlay'); if (old) old.remove();
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `
    <div class="modal">
      <h3>⚡ Skill Check</h3>
      <p style="font-size:17px;color:var(--ink)"><b>${target.emoji} ${esc(target.title)}</b> is locked… but if you already know your stuff, prove it!</p>
      <p>Answer <b>10 quick questions</b> from the ${n === 1 ? 'level' : n + ' levels'} before it.
      Get <b>8 or more</b> right and you jump straight ahead — every skipped level gets ⭐⭐ and you win <b>🪙 20 bonus coins</b>.</p>
      <p>No learning cards, no second tries. Miss it? No problem — nothing is lost, and you can try again or play the levels.</p>
      <div class="modal-row">
        <button class="btn btn-primary" id="check-go" style="font-size:18px;padding:12px 28px">⚡ Let's go!</button>
        <button class="btn btn-ghost" id="check-no">Not yet</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  $('#check-go').addEventListener('click', () => { ov.remove(); SFX.click(); startSkillCheck(targetIdx); });
  $('#check-no').addEventListener('click', () => ov.remove());
}

function startSkillCheck(targetIdx) {
  synth && synth.cancel();
  const fromIdx = LEVELS.findIndex(l => !(l.id in state.stars));
  const target = LEVELS[targetIdx];
  lesson = {
    level: { id: '__check', title: 'Skill Check', emoji: '⚡', kind: 'check', items: [] },
    isCheck: true, checkFrom: fromIdx, checkTarget: targetIdx,
    queue: buildCheckQueue(fromIdx, targetIdx),
    idx: 0, totalQuiz: 0, correctFirst: 0, combo: 0, xpGained: 0,
  };
  show('lesson');
  renderStep();
  mascotSay(`⚡ Skill Check! Get <b>${Math.ceil(lesson.queue.length * CHECK_PASS)} of ${lesson.queue.length}</b> right to unlock <b>${esc(target.title)}</b>. Show me what you know!`,
    [['en', 'Skill check! No hints this time — show me what you know!']]);
}

function finishCheck() {
  const L = lesson;
  const total = L.totalQuiz || 1, correct = L.correctFirst;
  const passed = correct / total >= CHECK_PASS;
  const target = LEVELS[L.checkTarget];
  const res = $('#results');
  if (passed) {
    let unlocked = 0;
    for (let i = L.checkFrom; i < L.checkTarget; i++) {
      if (!(LEVELS[i].id in state.stars)) unlocked++;
      state.stars[LEVELS[i].id] = Math.max(state.stars[LEVELS[i].id] || 0, 2);
    }
    state.coins += 20;
    save();
    res.innerHTML = `
      <h2>⚡ Skill Check PASSED!</h2>
      <div class="stars-row">🏆</div>
      <div class="gains">
        <div class="gain">🎯 ${correct}/${total}<span>correct</span></div>
        <div class="gain">🔓 ${unlocked}<span>level${unlocked === 1 ? '' : 's'} skipped</span></div>
        <div class="gain">🪙 +20<span>bonus coins</span></div>
      </div>
      <button class="btn btn-primary" id="check-start-target" style="margin-top:14px">${target.emoji} Play ${esc(target.title)}!</button>
      <button class="btn btn-ghost" id="check-map">🗺 Back to the map</button>
      ${nudgeHtml()}`;
    show('results');
    wireNudge();
    $('#check-start-target').addEventListener('click', () => { SFX.click(); startLevel(target); });
    $('#check-map').addEventListener('click', () => { SFX.click(); renderHome(); });
    SFX.fanfare(); confetti(120); setTimeout(() => SFX.coin(), 700);
    mascotSay(`🤯 WOW — you really know this! <b>${esc(target.title)}</b> is unlocked. Kol hakavod!`,
      [['en', `Wow, you really know this! ${target.title} is unlocked!`], ['he', 'כל הכבוד!']], 'happy');
  } else {
    res.innerHTML = `
      <h2>Not yet… 💪</h2>
      <div style="font-size:20px;color:#cfc4f2">You got <b style="color:var(--sun)">${correct}/${total}</b> — you need ${Math.ceil(total * CHECK_PASS)} to jump ahead.</div>
      <div style="font-size:17px;color:#cfc4f2;max-width:440px;line-height:1.5">No stars lost, no coins lost! Play the next levels to power up — or try the check again with fresh questions.</div>
      <button class="btn btn-primary" id="check-retry" style="margin-top:14px">⚡ Try again</button>
      <button class="btn btn-ghost" id="check-map">🗺 Back to the map</button>`;
    show('results');
    const tIdx = L.checkTarget;
    $('#check-retry').addEventListener('click', () => { SFX.click(); startSkillCheck(tIdx); });
    $('#check-map').addEventListener('click', () => { SFX.click(); renderHome(); });
    mascotSay(`So close! The path is the way — every level makes you stronger 💪`, [['en', 'So close! Every level makes you stronger!']], 'sad');
  }
  lesson = null;
}

// ---------- shop ----------
function renderShop() {
  show('shop');
  $('#shop-coins').textContent = state.coins;
  $('#shop-avatar').innerHTML = avatarSVG(state.eq);
  const grid = $('#shop-grid');
  grid.innerHTML = '';
  for (const [slotKey, slotLabel] of SHOP_SLOTS) {
    const hdr = document.createElement('div');
    hdr.className = 'shop-cat';
    const items = SHOP.filter(x => x.slot === slotKey).sort((a, b) => a.cost - b.cost);
    const ownedCount = items.filter(x => state.owned.includes(x.id)).length;
    hdr.innerHTML = `${slotLabel} <span class="cat-count">${ownedCount}/${items.length}</span>`;
    grid.appendChild(hdr);
    items.forEach(item => renderShopItem(grid, item));
  }
}

function renderShopItem(grid, item) {
    const owned = state.owned.includes(item.id);
    const equipped = state.eq[item.slot] === item.id;
    const el = document.createElement('div');
    el.className = 'shop-item' + (owned ? ' owned' : '') + (equipped ? ' equipped' : '') + (!owned && state.coins < item.cost ? ' cantafford' : '');
    el.innerHTML = `
      <div class="si-em">${item.emoji}</div>
      <div class="si-name">${esc(item.name)}</div>
      <div class="si-cost">${equipped ? '✔ Wearing' : owned ? 'Tap to wear' : `🪙 ${item.cost}`}</div>`;
    el.addEventListener('click', () => {
      if (owned) {
        state.eq[item.slot] = equipped ? null : item.id;
        SFX.click();
      } else if (state.coins >= item.cost) {
        state.coins -= item.cost;
        state.owned.push(item.id);
        state.eq[item.slot] = item.id;
        SFX.coin(); confetti(30);
        mascotSay(`😎 Looking GOOD in the ${esc(item.name)}!`, [['en', `Looking good in the ${item.name}!`]], 'happy');
      } else {
        SFX.bad();
        mascotSay(`You need ${item.cost - state.coins} more coins for the ${esc(item.name)} — go crush a level! 💪`);
        return;
      }
      save(); renderShop();
    });
    grid.appendChild(el);
}

// ---------- backup codes (parents' insurance against cleared storage) ----------
function encodeSave() { return btoa(unescape(encodeURIComponent(JSON.stringify(state)))); }
function decodeSave(code) {
  const s = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
  if (typeof s.xp !== 'number' || typeof s.coins !== 'number') throw new Error('bad code');
  return s;
}
function showBackup() {
  state.lastNudgeLevels = Object.keys(state.stars).length; // any backup visit resets the nudge clock
  save();
  const old = $('.modal-overlay'); if (old) old.remove();
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `
    <div class="modal">
      <h3>🔑 Progress Backup</h3>
      <p>Copy this magic code somewhere safe (Notes, a photo…). Paste it back any time — on any device — to restore all stars, coins and costumes.</p>
      <textarea readonly id="backup-code">${encodeSave()}</textarea>
      <button class="btn btn-green" id="copy-code">📋 Copy code</button>
      <p style="margin-top:14px">Restore from a saved code:</p>
      <textarea id="restore-code" placeholder="Paste a magic code here…"></textarea>
      <div class="modal-row">
        <button class="btn btn-primary" id="do-restore" style="font-size:17px;padding:10px 24px">Restore</button>
        <button class="btn btn-ghost" id="close-modal">Close</button>
      </div>
      <div id="backup-msg" style="min-height:20px;margin-top:8px;font-size:14px;color:var(--mint)"></div>
    </div>`;
  document.body.appendChild(ov);
  $('#backup-code').addEventListener('click', (e) => e.target.select());
  $('#copy-code').addEventListener('click', async () => {
    const ta = $('#backup-code'); ta.select();
    try { await navigator.clipboard.writeText(ta.value); $('#backup-msg').textContent = '✓ Copied!'; }
    catch (e) { document.execCommand('copy'); $('#backup-msg').textContent = '✓ Copied!'; }
  });
  $('#do-restore').addEventListener('click', () => {
    try {
      state = { ...state, ...decodeSave($('#restore-code').value) };
      save();
      ov.remove();
      renderHome();
      mascotSay('🎉 Progress restored — everything is back!', [['en', 'Progress restored!']], 'happy');
    } catch (e) { $('#backup-msg').style.color = 'var(--wrong)'; $('#backup-msg').textContent = 'That code does not look right — check it and try again.'; }
  });
  $('#close-modal').addEventListener('click', () => ov.remove());
}

// ---------- boot ----------
function boot() {
  load();
  starryBg();
  $('#mascot').innerHTML = DUKI_SVG;
  $('#splash-mascot').innerHTML = DUKI_SVG;

  // ask the browser to never evict our storage (matters on iPad Safari)
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  // returning player? make it obvious their progress is safe
  if (state.xp > 0 || totalStars() > 0) {
    $('#splash p').innerHTML = `Welcome back! ⭐ <b>${totalStars()} stars</b> · 🪙 <b>${state.coins} coins</b> — all safe and waiting for you.`;
    $('#start-btn').textContent = '▶ Continue the Adventure';
  }

  $('#start-btn').addEventListener('click', () => {
    initAudio();
    SFX.click();
    renderHome();
    setTimeout(() => mascotSay(
      `I'm <b>Duki the Hoopoe</b> 🪶 — Israel's national bird and your Hebrew guide! Tap a level and let's go!`,
      [['en', "Hi! I'm Dooki the hoopoe, your Hebrew guide! Tap a level and let's go!"]], 'happy'), 400);
  });
  $('#quit-btn').addEventListener('click', () => { synth && synth.cancel(); lesson = null; renderHome(); });
  $('#shop-btn').addEventListener('click', () => { SFX.click(); renderShop(); });
  $('#shop-back').addEventListener('click', () => { SFX.click(); renderHome(); });
  $('#backup-btn').addEventListener('click', () => { SFX.click(); showBackup(); });
}
document.addEventListener('DOMContentLoaded', boot);
