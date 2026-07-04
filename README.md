# 🦜 Ivrit Quest — Learn Hebrew by Talking!

A voice-first, gamified Hebrew-learning web app for English-speaking kids (ages 10–14).
Runs entirely in the browser — no install, no accounts, no server logic, works offline once loaded.

## 📱 Put it on the iPad (no computer needed)

The app is a PWA hosted at **https://buddy-robotlab.github.io/ivrit-quest/**

1. On the iPad, open that URL in **Safari**.
2. Tap **Share → Add to Home Screen** — it becomes a full-screen app with its own icon.
3. Open it once from the home screen while online — the service worker caches everything.
4. From then on it works **completely offline**. Progress is saved on the device.
5. Turn the volume up and allow the microphone when Safari asks.

To ship an update: commit + `git push` — GitHub Pages redeploys automatically.
(If an iPad seems stuck on an old version, bump the `CACHE` name in `sw.js` before pushing.)

## ▶️ Run it locally (development)

Any static web server works:

```bash
cd "henrew learning"
python3 -m http.server 8471
# open http://localhost:8471
```

> Tip: Hebrew text-to-speech uses the built-in iOS voice (Carmit). If Hebrew audio is silent,
> add the voice under Settings → Accessibility → Spoken Content → Voices → Hebrew.

## 🎮 What's inside

- **24 levels**: Alef-Bet (5 letter levels + boss review) → vowels (nikud) → 12 vocabulary worlds
  (greetings, family, numbers, colors, animals, food, everyday life, getting around, games,
  motion, masculine/feminine forms, plurals) → science & space → 3 sentence/conversation levels.
- **Free roam**: letters are sequential; finishing them unlocks everything through Numbers,
  and finishing Numbers removes all remaining locks.
- **Duki the Hoopoe** 🪶 (Israel's national bird) — the on-screen guide who talks, cheers, and gives
  memory tricks for every letter.
- **Voice-first**: every word is spoken aloud (Hebrew TTS), and kids answer by **speaking Hebrew**
  into the mic (Web Speech API). Falls back to tap-based play when no mic/speech support.
- **Pedagogy**: chunking (3–4 new items at a time), dual coding (visual mnemonics + audio),
  retrieval practice (quizzes right after learning), spaced review (boss levels + missed items
  re-queued), low-stakes mastery (no lives — accuracy earns stars).
- **Gamification**: XP + ranks, 3-star levels, combo streaks, coins.
- **Skill Checks**: tap any locked level to "test out" — 10 hard questions from the skipped
  levels, 80% to pass; passing awards ⭐⭐ on skipped levels + bonus coins. Kids who already
  know the Alef-Bet can jump straight to vocabulary.
- **Reward loop**: coins buy 100+ items for your avatar in the Costume Shop — hats, glasses,
  outfits, hand items, pets, rides, and treasures, from a 25-coin cap to a 2,500-coin
  Legendary Mega Diamond.

## 🗂 Files

- `index.html` — app shell
- `style.css` — all styling
- `data.js` — curriculum: letters, vowels, vocab, sentences, levels, shop
- `app.js` — game engine: speech, exercises, scoring, mascot, avatar, shop

Progress is saved in `localStorage` on the device.
