# 🦜 Ivrit Quest — Learn Hebrew by Talking!

A voice-first, gamified Hebrew-learning web app for English-speaking kids (ages 10–14).
Runs entirely in the browser — no install, no accounts, no server logic, works offline once loaded.

## ▶️ Run it

Any static web server works:

```bash
cd "henrew learning"
python3 -m http.server 8471
# open http://localhost:8471
```

## 📱 Put it on the iPad (the fun part)

1. Make sure the iPad and your Mac are on the **same Wi-Fi**.
2. On the Mac: `python3 -m http.server 8471` in this folder.
3. Find your Mac's IP: System Settings → Wi-Fi → Details (e.g. `192.168.1.23`).
4. On the iPad, open Safari → `http://192.168.1.23:8471`
5. Tap **Share → Add to Home Screen** — it becomes a full-screen app with its own icon.
6. Turn the volume up and allow the microphone when Safari asks.

> Tip: Hebrew text-to-speech uses the built-in iOS voice (Carmit). If Hebrew audio is silent,
> add the voice under Settings → Accessibility → Spoken Content → Voices → Hebrew.

## 🎮 What's inside

- **15 levels**: Alef-Bet (5 letter levels + boss review) → vowels (nikud) → 6 vocabulary worlds
  (greetings, family, numbers, colors, animals, food) → 2 sentence levels.
- **Duki the Hoopoe** 🪶 (Israel's national bird) — the on-screen guide who talks, cheers, and gives
  memory tricks for every letter.
- **Voice-first**: every word is spoken aloud (Hebrew TTS), and kids answer by **speaking Hebrew**
  into the mic (Web Speech API). Falls back to tap-based play when no mic/speech support.
- **Pedagogy**: chunking (3–4 new items at a time), dual coding (visual mnemonics + audio),
  retrieval practice (quizzes right after learning), spaced review (boss levels + missed items
  re-queued), low-stakes mastery (no lives — accuracy earns stars).
- **Gamification**: XP + ranks, 3-star levels, combo streaks, coins.
- **Reward loop**: coins buy costumes (crowns, capes, space suits…) for your avatar in the
  Costume Shop after each level.

## 🗂 Files

- `index.html` — app shell
- `style.css` — all styling
- `data.js` — curriculum: letters, vowels, vocab, sentences, levels, shop
- `app.js` — game engine: speech, exercises, scoring, mascot, avatar, shop

Progress is saved in `localStorage` on the device.
