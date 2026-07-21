# Siang Dee — เสียงดี

A Progressive Web App that helps Thai native speakers improve their English pronunciation. Speak into your phone → the app recognizes the phonemes you produced, aligns them against the target English phonemes, flags the specific Thai→English error patterns, and gives you encouraging bilingual feedback with model audio to mimic.

**Privacy first:** your voice is processed on your device. Audio never leaves your phone unless you opt into cloud coaching (and even then only the phoneme diff is sent, never the waveform). **Works offline** after first load. **Installable** to your home screen.

See **[`SPEC.md`](./SPEC.md)** for the full product specification, and **[`docs/PHONOLOGY.md`](./docs/PHONOLOGY.md)** for the scientific basis of every error rule.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
```

First time you press "record", the app downloads the wav2vec2 phoneme model (~40–80 MB over Wi-Fi) and caches it for offline use.

## Scripts

- `npm run dev` — dev server with HMR
- `npm run build` — production build to `dist/` (static, deploy anywhere)
- `npm run preview` — preview the production build
- `npx vitest` — run the phonology unit tests (alignment + error detection + dictionary)
- `npm run check` — type-check

## Architecture

```
src/lib/phonology/   ← the tested scientific core (no DOM deps)
  phonemes.ts       IPA alphabet + classification
  errors.ts         15 Thai→English error categories (grounded in Thai phonology)
  align.ts          Needleman–Wunsch alignment with Thai-aware costs
  detect.ts         alignment → scored errors
  dictionary.ts     seed IPA dictionary + sentence tokenizer
src/lib/audio/
  mic.ts            mic → 16kHz Float32 PCM (AudioWorklet + fallback)
  recognizer.ts     transformers.js + wav2vec2 phoneme recognition (lazy, cached)
src/lib/tts/speech.ts        on-device spoken coaching (Web Speech API)
src/lib/feedback/templates.ts template feedback (Thai + English)
src/lib/storage/db.ts        IndexedDB (attempts, progress, settings, audio)
src/data/exercises.ts        curated drill bank across the 15 error categories
src/views/                   Home, Exercise (core loop), Progress, Settings
```

## How pronunciation scoring works

1. **Record** 16 kHz mono PCM via `AudioWorklet`.
2. **Recognize** phonemes on-device with a multilingual wav2vec2 model (`transformers.js`).
3. **Align** the spoken phoneme sequence against the target (from the IPA dictionary) with Needleman–Wunsch, using a Thai-aware substitution matrix (known confusions like /l/↔/r/ get a low cost so they align, then get *flagged* as errors).
4. **Detect** each non-match position maps to one of 15 error categories (E1–E15) via the rules in `errors.ts`.
5. **Score** 0–100, weighted by error severity (/l/↔/r/ swap is high-severity; final /t/ drop is moderate). Low-confidence phonemes (model noise) are not penalized.
6. **Feedback**: bilingual (Thai-first) explanation + model audio (slow + normal) + replay yours + try again. Spoken coaching via Web Speech API (on-device, offline).

## Swapping the model

The recognizer is pinned in `src/lib/audio/recognizer.ts` (`MODEL_ID`). Any Hugging Face model that outputs espeak-aligned phoneme tokens works. To use Whisper-tiny (cheaper, less precise) as a fallback tier, set `modelTier: "fast"` in Settings and wire the alternative model.

## Regenerating the dictionary

The seed dictionary in `src/lib/phonology/dictionary.ts` is hand-verified for the curated drills. For full coverage, generate a larger JSON from CMUdict (`cmudict` + an `arpabet-to-ipa` mapping) at build time and bundle it as a static asset (~2 MB gzipped for top ~30k words).

## Deploy

The app is a static SPA — deploy `dist/` to Cloudflare Pages, Vercel, Netlify, or any static host. The service worker in `public/sw.js` handles offline caching.

```bash
npm run build
# then upload dist/ to your static host, e.g.:
npx wrangler pages deploy dist --project-name=siang-dee
```

## Privacy

- Raw audio is processed on-device. Nothing is uploaded.
- IndexedDB stores your attempts + audio blobs (auto-expire after 7 days).
- Optional cloud LLM coaching (off by default) sends only the phoneme diff + the target text — never the audio.
- No analytics phone home with audio.

## Testing

`npx vitest` runs the phonology suite: alignment correctness (E1 l→r, E2 epenthesis, E3 final deletion), candidate-error lookup, dictionary coverage, and the model-noise confidence guard.

## Status

M1–M4 implemented (app shell, recording, phoneme recognition, alignment+scoring+feedback, spoken coaching, progress, offline PWA). M5 (polish, perf, deploy) and M6 (cloud coaching, sync, free-talk) are next.
