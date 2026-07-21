# Build Prompt: "Siang Dee" (เสียงดี) — A Thai→English Pronunciation PWA

> Hand this entire document to a coding agent (or a developer) as the build spec. It is self-contained: goal, users, phonology, architecture, features, data model, UX, milestones, acceptance tests, and library/version choices. No external context needed.

---

## 1. Product goal (one paragraph)

Build **"Siang Dee"** (Thai เสียงดี = "good sound"), a Progressive Web App that helps a Thai native speaker (specifically: the developer's wife) improve her English pronunciation. The user speaks a word or sentence into her phone mic; the app transcribes the *phonemes* she actually produced, aligns them against the *target* English phonemes for that utterance, flags the specific Thai→English error patterns she made, and gives immediate, encouraging, bilingual (Thai + English) feedback with a model audio to mimic and a minimal-pair drill to practice. Everything runs in the browser; audio never leaves the device unless she opts into cloud scoring; the app installs to the home screen and works offline after first load. The MVP must be genuinely useful for a real learner, not a demo.

## 2. Target user & constraints

- **Primary user:** Thai native speaker, adult, intermediate English learner, owns an Android phone (and maybe an iPhone). Mixes up /l/ and /r/, drops final consonants, and shows the other errors in §4.
- **Secondary user:** any Thai learner of English.
- **Hard constraints:**
  - **Privacy first:** raw audio is processed on-device by default. No audio upload unless the user explicitly enables "cloud scoring." Even then, only the phoneme sequence (a few dozen tokens) is sent, not the waveform.
  - **Offline-capable:** after first visit, the app loads with no network. Model weights and the phoneme dictionary are cached. Recording + scoring works offline. Cloud LLM feedback (optional) requires network.
  - **Installable PWA:** add-to-home-screen, standalone display mode, works on mobile Chrome/Safari.
  - **Mobile-first:** large tap targets, one-handed use, works in portrait. Recording UI must survive screen sleep (wake lock).
  - **Bilingual UI:** Thai labels first, English secondary. Feedback copy is Thai-primary with English phoneme/word in parentheses. Voice instructions in Thai.
  - **Gentle, encouraging tone:** never "wrong" — always "almost" / "try again" / "you got X right." This is for a spouse, not a test.

## 3. Scope (MVP vs later)

**MVP (must ship first):**
- Single-word and short-sentence speaking exercises, curated per Thai-error category.
- Record → on-device phoneme recognition → alignment → score + targeted feedback.
- Per-phoneme visual feedback (which sound was off, what she said instead, model audio).
- Minimal-pair drill mode (e.g., "light" vs "right").
- Progress tracking in IndexedDB (per-error-category mastery, streak).
- Installable, offline.

**Later (design for, don't build yet):**
- Free-talk mode with sentence-level feedback.
- Cloud LLM coaching (send the phoneme diff + context, get a tailored practice plan).
- Account sync across devices.
- Teacher dashboard for a tutor to see her progress.
- Thai-language UI localization beyond the core strings.

## 4. The Thai→English phonology engine (grounded, not guessed)

This is the scientific core. Every feedback message and every drill must map to one of these documented error patterns. Source basis: Thai has only **8 syllable-final consonant phonemes** (/p t k ʔ m n ŋ w j/), no word-final consonant clusters, no /θ ð/, no /ʃ ʒ tʃ dʒ/, and is a **syllable-timed** language with no lexical stress contrast. (Grounded from pronunciationstudio.com's "10 English Pronunciation Errors by Thai Speakers" + the Thai-accented-English phonology review EJ1348382.)

The engine must detect and score each of these **error categories**:

| # | Category | Target | Common Thai substitution | Example | Detection signal |
|---|----------|--------|--------------------------|---------|-------------------|
| E1 | **/l/ vs /r/ confusion** | /l/ lateral alveolar approximant; /r/ (alveolar/postalveolar) approximant | /l/→/r/ or /r/→/l/; sometimes /r/→trilled [r] | "light"→"right"; "red"→"led" | spoken phoneme ≠ target at positions where target is /l/ or /r/; specifically flag /l/↔/r/ swaps |
| E2 | **Consonant-cluster epenthesis** | CC onset (e.g., /dr/ /sm/ /kr/ /str/) | insert schwa /ə/ between: /dər/ /səm/ /kər/ | "drive"→"da-rive"; "smoke"→"sa-moke" | extra vowel phoneme detected between two target consonants |
| E3 | **Word-final consonant deletion** | final /t d k g s z θ ð f v l r tʃ dʒ/ | dropped entirely (only /p t k m n ŋ/ + glides are legal Thai finals) | "what"→"wa"; "nice bag"→"nice ba" | target final consonant missing; word ends early |
| E4 | **Final-cluster simplification** | word-final CC/CCC (e.g., "asked" /ɑːskt/, "world") | delete one or more finals | "asked"→"ask" | trailing target consonants missing |
| E5 | **/tʃ/ → /ʃ/ or /s/** | /tʃ/ (church, chair, cheese) | /ʃ/ ("shurch") or /s/ ("surch") | "church"→"shurch" | /tʃ/ target produced as /ʃ/ or /s/ |
| E6 | **/θ/ → /s/ or /t/; /ð/ → /z/ or /d/** | /θ/ (three, think); /ð/ (the, this) | /s/ /t/ for /θ/; /z/ /d/ for /ð/ | "three"→"tree"/"sree"; "the"→"ze"/"de" | target /θ/→{s,t}; /ð/→{z,d} |
| E7 | **/ʃ/ vs /s/** | /ʃ/ (she, shoe) | /s/ (Thai has no /ʃ/) | "she"→"see" | /ʃ/→/s/ |
| E8 | **/v/ vs /w/ confusion** | /v/ (labiodental voiced) | /w/ (Thai has no /v/) | "very"→"wery" | /v/→/w/ |
| E9 | **/z/ → /s/ (word-final devoicing)** | final /z/ | /s/ (no voiced final fricatives in Thai) | "dogs"→"dobs"/"dos" | final /z/→/s/ |
| E10 | **Diphthong /əʊ/ → monophthong /ɔ/ or /ɒ/** | /əʊ/ (go, show, note) | /ɔ/ or /ɒ/ | "show"→"shore"/"short" vowel | /əʊ/→{/ɔ/,/ɒ/} |
| E11 | **Vowel length / tense-lax** | /iː/ vs /ɪ/, /uː/ vs /ʊ/, /ɑː/ vs /ʌ/ | Thai has no length contrast → laxed/shortened or tensed wrongly | "sheep"→"ship"; "cot"→"caught" merged | target long/lax vowel produced as the opposite |
| E12 | **Nasalized vowels** | oral vowels | nasal resonance (Thai vowels often nasal) | "keep" sounds nasal | (hard to score from phonemes alone — mark as a suprasegmental note, not a hard error in MVP) |
| E13 | **Word stress** (final-syllable over-stress) | lexically stressed syllable | stress pushed to final syllable | "pronunciation" → "/ation/ over-stressed" | energy/pitch peak on wrong syllable (requires prosody, not just phonemes — MVP: note only) |
| E14 | **Weak-form reduction missing** | reduced schwa in function words (can /kən/, of /əv/, to /tə/) | full-vowel pronunciation | "can"→/kæn/ not /kən/ | target schwa in unstressed function word produced as full vowel |
| E15 | **Syllable timing / intonation** | stress-timed rhythm | equal weight per syllable | flat machine-gun rhythm | (suprasegmental — MVP: note only; later use F0/duration analysis) |

**MVP detection focus:** E1–E11 are segmental and detectable from phoneme alignment alone. E12/E13/E15 are suprasegmental — surface as gentle notes, not scored errors, until prosody analysis is added.

Each error category needs:
- An **error-id**, a Thai name, an English name, an IPA target set, a Thai-substitution set, and a human explanation (Thai + English).
- A **drill set**: 8–20 minimal pairs or sentences targeting it, with model audio (TTS or recorded).
- A **detection rule**: a function from (target phoneme sequence, spoken phoneme sequence, alignment) → list of {position, errorId, confidence}.

## 5. Architecture

### 5.1 High-level
- **Frontend-only PWA by default** (audio + phoneme recognition + alignment + feedback all in-browser).
- **Optional backend** (Cloudflare Worker) only for: (a) cloud LLM coaching, (b) account sync, (c) a curated content API. The MVP does not require the backend.
- **Build/deploy:** Cloudflare Pages for the static PWA. (Matches the existing stack.) No server compute needed for MVP.

### 5.2 Recording pipeline (client)
1. `navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true, noiseSuppression:true, autoGainControl:true}})` — request mic.
2. `MediaRecorder` → Opus/WebM blobs, OR raw PCM via `AudioWorklet` for model input. Prefer **AudioWorklet → Float32 PCM @ 16 kHz mono** because wav2vec2 expects 16 kHz.
3. `ScreenWakeLock` while recording so the screen doesn't sleep.
4. Store the recording blob in IndexedDB for replay + history.

### 5.3 Phoneme recognition (client)
- Use **transformers.js** (`@huggingface/transformers`, the in-browser WASM/WebGPU runtime) to run a **wav2vec2 phoneme** model in the browser.
- Recommended model: a **multilingual XLSR-wav2vec2 fine-tuned for phoneme recognition** (e.g., `facebook/wav2vec2-lv-60-espeak-cvft` or a Thai+English phoneme model from Hugging Face). Pin the exact model repo + revision in config. Verify it actually outputs IPA/espeak phoneme tokens, not graphemes.
- Convert the recorded 16 kHz Float32 PCM → model input via the transformers.js `pipeline("automatic-speech-recognition", model, {return_timestamps:"word"})` or the phoneme-specific pipeline. Extract an ordered list of recognized phoneme tokens with per-token confidence.
- **Fallback tier** (if wav2vec2 is too heavy for low-end phones): use **Whisper-tiny** via transformers.js to get words + timestamps, then map words→phonemes via the dictionary (§5.4). Less precise but cheaper. Expose a settings toggle: "Accurate (slower)" vs "Fast (less precise)".
- **WebGPU** if available; fall back to WASM. Show a one-time "downloading voice model (~XX MB)" progress bar; cache in the Cache API / IndexedDB for offline.

### 5.4 Reference phoneme generation (text → target phonemes)
- **Primary: dictionary lookup.** Bundle a JSON dictionary mapping common English words → their IPA phoneme sequence (derive from `cmudict` + an IPA conversion, or use the `arpabet-to-ipa` mapping; pre-process offline into a compact JSON ≤ ~2 MB gzipped for the top ~30k words). Ship as a static asset.
- **Fallback: espeak-ng compiled to WASM** (`espeak-ng.wasm`) for grapheme-to-phoneme of any word not in the dictionary. This is the same G2P the wav2vec2-espeak model was trained against, so the phoneme alphabets match — critical for alignment.
- For sentences, concatenate word phoneme sequences with stress markers; mark function words for weak-form reduction (§4 E14) using a small function-word table.

### 5.5 Alignment + scoring (client)
- **Align** the spoken phoneme sequence against the target phoneme sequence using **Needleman–Wunsch** (global alignment) with a phoneme-distance substitution matrix that encodes the Thai substitution rules from §4 (e.g., /l/↔/r/ cost is low *if* it's a known Thai confusion — but we actually want to *detect* the confusion, so the alignment should still match them and then we flag the substitution). Use a tuned gap penalty (epenthesis = insert vowel; deletion = drop consonant).
- From the aligned pair, emit per-position labels: **MATCH**, **SUBSTITUTION** (with target→spoken pair), **INSERTION** (epenthesis), **DELETION** (dropped final).
- Map each non-MATCH position to an **error category** from §4 via the detection rules. A position can map to one or more candidate errors; pick by the target→spoken phoneme pair. Aggregate into an **error report** per utterance.
- **Per-phoneme score:** 0–100, weighted by confidence of the recognized phoneme and by severity of the error (/l/↔/r/ swap is high-severity for intelligibility; final /t/ deletion is moderate).
- **Per-word score** and **per-utterance score** roll up from phoneme scores.
- Guard against model noise: if recognized confidence < threshold on a phoneme, don't score that phoneme as an error — mark it "unclear, try again."

### 5.6 Feedback generation (client, templated; optional cloud LLM)
- **MVP: template-based**, no LLM. For each detected error, render a fixed Thai+English message from a template keyed by errorId + the specific target/spoken pair. Example for E1 /l/→/r/: *"เกือบถูกแล้ว! คุณออกเสียง 'ร' แทน 'ล' (You said /r/ instead of /l/). ลองแตะปลายลิ้นที่เพดานปากแล้วปล่อยลมออกข้างๆ (Touch your tongue tip to the ridge and let air flow around the sides). ฟังตัวอย่างแล้วพูดตาม."*
- Provide: (a) the **model audio** (TTS of the target word/sentence, or a pre-recorded native clip), (b) a **play-your-recording** button, (c) a **slow model audio** (0.7× playbackRate), (d) a **try again** button.
- **Optional cloud LLM tier:** if network + opt-in, POST the *error report JSON* (phoneme diff + errorIds + the target text) to a Cloudflare Worker → returns a personalized 2–3 sentence Thai coaching paragraph. Never send audio. This is a settings toggle, off by default.

## 6. Data model (IndexedDB)

Stores (versioned):
- `exercises` — the curated word/sentence list per error category (seeded from a static JSON; updatable).
- `attempts` — {id, exerciseId, timestamp, targetPhonemes, spokenPhonemes, alignment, errors[], score, audioBlobRef}. Keep last 200; older summarize.
- `progress` — {errorId, attempts, lastScore, bestScore, masteryLevel (0–3), streakDays, lastPracticed}.
- `settings` — {modelTier ("accurate"|"fast"), cloudCoaching (bool), uiLang ("th"|"en"), wakeLock (bool), autoSpeak (bool, default true), speakRate (0.8|1.0|1.1), muted (bool)}.
- `audio` — {id, blob} for replay (auto-expire > 7 days).

## 7. UX / screens

### 7.1 Home
- Greeting in Thai ("สวัสดีครับ/ค่ะ วันนี้มาฝึกเสียงกันเถอะ" — adapt gender).
- A big **"ออกกำลังกายเสียง" (Start practicing)** button.
- Today's recommended drill (auto-picked from weakest error category).
- Streak + mastery overview (simple bars per error category, colored red→amber→green).
- Install prompt (beforeinstallprompt) shown once, with Thai copy.

### 7.2 Exercise screen (the core loop)
- Show the target word/sentence large, in English, with Thai gloss underneath and the target IPA in small type.
- A single huge **record** button (hold-to-talk OR tap-to-start/stop). Visual waveform/pulse while recording.
- On release: "กำลังวิเคราะห์เสียง..." (Analyzing...) spinner (the model runs; show a progress hint on first load).
- Result card:
  - **Overall score** (big number + emoji: 😀 ≥85, 🙂 70–84, 😐 55–69, 🙁 <55) — but labeled encouragingly ("เก่งมาก! / ดีแล้ว / ใกล้แล้ว / ลองอีกครั้ง").
  - **Per-phoneme strip**: each target phoneme as a chip, colored green (match) / amber (substitution) / red (deletion) / blue (insertion). Tap a chip → detail.
  - **Errors found** list: each with errorId, the Thai explanation, a play-model-audio + play-yours + try-again trio.
  - **Next** button → next exercise (spaced-repetition weighted by weak categories).
- Minimal-pair mode toggle: show two words side by side (e.g., light/right), record each, compare.

### 7.3 Progress screen
- Per-error-category mastery bars + history sparkline.
- "Words practiced", "Best streak", "Hardest sound for you" (the errorId with lowest avg score).
- Export progress as JSON (for a tutor or backup).

### 7.4 Settings
- Model tier (accurate/fast), cloud coaching toggle, UI language, wake lock, clear cache, download offline model now.
- **Spoken coaching:** autoSpeak (auto-play feedback on result), speakRate (0.8×/1×/1.1×), global mute, "test voice" button that speaks a sample Thai + English line so she can confirm her phone has a Thai voice installed.

## 8. Content (the exercise bank) — must be curated, not random

Ship a seed JSON of ~150 exercises across the 15 error categories (roughly 10 each, more for E1–E3 since they're the wife's pain points). Each exercise:
```json
{
  "id": "e1-light",
  "errorIds": ["E1"],
  "type": "word" | "sentence" | "minimalpair",
  "prompt": "light",
  "promptThai": "แสงสว่าง",
  "targetPhonemes": ["l", "aɪ", "t"],
  "modelAudioUrl": "/audio/word/light.mp3",
  "difficulty": 1,
  "pairId": "e1-right"  // for minimal pairs
}
```
- For E1 (l/r): light/right, long/wrong, fly/fry, glass/grass, play/pray, collect/correct, alive/arrive, etc.
- For E2 (clusters): "drive", "smoke", "crime", "school", "street", "breakfast", sentence: "Smoking while driving is a crime."
- For E3 (final deletion): "what", "bag", "nice", sentence: "What a nice bag you have."
- For E5 (tʃ): "church", "chair", "cheese", sentence: "The church bells chime at Christmas."
- For E6 (th): "the", "three", "think", "bath", sentence: "The three others."
- For E8 (v/w): "very", "wave", "river", sentence: "Very warm water."
- For E10 (əʊ): "show", "go", "note", "coat", minimal pairs show/short, coat/caught, note/nought.
- Generate **model audio** via a good English TTS (e.g., pre-render with a neural TTS at build time, or use the Web Speech API `speechSynthesis` with an en-US voice as a no-download fallback — clearly lower quality, label it "เสียงอ่านจากระบบ" / system voice).

## 9. Offline / installability / performance

- **Service worker** (Workbox or hand-rolled): precache the app shell + the dictionary + model weights on first load. Cache-first for assets, network-first for content updates with a fallback-to-cache.
- **Web App Manifest**: name (Siang Dee / เสียงดี), short_name, icons (512 + 192, maskable), `display:standalone`, `background_color` / `theme_color`, `start_url`, `scope`, `orientation:portrait-primary`. Add to home screen prompt with Thai copy.
- **Model lazy-load:** don't block first paint on the 80+ MB model. Show the app immediately; download the model on first "Start practicing" with a clear progress bar and a "download over Wi-Fi" nudge. Store in Cache API.
- **Performance budget:** first load < 3s on mid Android over 4G (app shell only); interaction-to-feedback < 3s for the fast tier, < 8s for accurate tier on a mid phone. Measure with Lighthouse; target PWA score ≥ 90.
- **Memory:** unload the model when idle for > 2 min if memory pressure; reload on next use.

## 10. Privacy

- No analytics SDK that phones home with audio. If analytics, only events (no audio, no transcript) and off by default.
- A clear Thai-language privacy screen on first launch: *"เสียงของคุณจะไม่ถูกส่งไปที่ไหน ประมวลผลบนเครื่องของคุณเท่านั้น"* (Your voice is not sent anywhere; it's processed only on your device). If cloud coaching is turned on, explain exactly what's sent (the phoneme diff, not the audio).

## 11. Accessibility & i18n

- Thai-primary UI; all strings via an i18n map (`th.json`, `en.json`). Support the Thai script rendering well (Sarabun/Noto Sans Thai font, bundled).
- Large tap targets (≥ 48px), high contrast, supports system font scaling.
- Screen-reader labels on all controls (Thai + English `aria-label`).
- Haptic feedback on record start/stop and on score reveal (`navigator.vibrate`).
- Dark mode (respect `prefers-color-scheme`).

## 12. Tech stack & versions (pin these)

- **Framework:** SvelteKit (static adapter) OR Next.js (static export) — prefer SvelteKit for smaller bundle + simpler offline. Pin to current stable (e.g., SvelteKit 2.x, Svelte 5). Vite build.
- **ML runtime:** `@huggingface/transformers` (v3.x, the ESM/WASM/WebGPU build). Pin exact version.
- **Model:** a multilingual wav2vec2 phoneme model (pin HF repo + revision + commit hash). Verify the tokenizer outputs phoneme tokens.
- **G2P fallback:** `espeak-ng` compiled to WASM (find a maintained `espeak-ng-wasm` build; pin version) OR the bundled dictionary.
- **Audio:** Web Audio API + `AudioWorklet` for 16 kHz Float32 PCM capture. No heavy audio lib.
- **Storage:** IndexedDB via `idb` (v8) wrapper.
- **PWA:** `vite-plugin-pwa` (Workbox under the hood) for service worker + manifest.
- **Backend (later):** Hono on Cloudflare Workers; D1 for sync; optional Workers AI for the LLM coaching endpoint.
- **Test:** Vitest (unit: alignment, error-detection rules, dictionary), Playwright (PWA install + record flow E2E on Chromium + WebKit).
- **Lint/format:** ESLint + Prettier; `tsc --noEmit` in CI.

## 13. Testing & acceptance criteria

- **Unit (must pass):**
  - Alignment: given target [l,aɪ,t] and spoken [r,aɪ,t], output flags E1 at position 0.
  - Alignment: target [d,r,aɪ,v] spoken [d,ə,r,aɪ,v] → flags E2 insertion at position 1.
  - Alignment: target [w,ɒ,t] spoken [w,ɒ] → flags E3 deletion at position 2.
  - Each of E1–E11 detection rules has a unit test with ≥ 3 (target, spoken, expected) cases.
  - Dictionary lookup returns IPA for 1000 sample words with no missing (for the top-frequency list).
- **Integration:** a recorded clip of a native Thai speaker saying "light" as "right" → app reports E1, score < 70, shows the right Thai feedback string, and offers the model audio. Use a fixture audio file + mocked model output.
- **E2E (Playwright):** app installs (beforeinstallprompt), loads offline (toggle network off in test), records (fake mic via Playwright `grantPermissions` + a fixed audio fixture), shows a score.
- **Spoken-coaching E2E:** on score reveal, a `SpeechSynthesisUtterance` is queued for the Thai summary line and the target English word (assert via mocking `speechSynthesis.speak` and capturing the utterance text + lang); the global mute toggle cancels pending speech (`speechSynthesis.cancel()`).
- **Performance:** Lighthouse PWA ≥ 90, Performance ≥ 85 on a simulated mid-mobile profile.
- **Real-world smoke:** the developer's wife completes a 5-minute session on her actual phone and reports it was understandable and the feedback matched what she heard herself do. (Manual acceptance — this is the real test.)

## 14. Milestones (ship in this order)

1. **M1 — App shell + record/playback + model audio.** No ML yet. Pick an exercise, record, hear it back, hear model TTS. Validates the recording pipeline + installability. (1–2 days)
2. **M2 — Phoneme recognition in-browser.** transformers.js + wav2vec2, show the raw recognized phonemes for a recording. No scoring yet. (2–3 days; the risky part)
3. **M3 — Dictionary + alignment + error detection.** Unit-tested core. Show the per-phoneme chip strip and detected errors, template feedback. This is "the app works." (2–3 days)
4. **M4 — Curated content + progress tracking + the full exercise loop.** Home screen, progress, drills, **spoken coaching (speechSynthesis) with Thai+English voice selection and mute/rate controls**. (2 days)
5. **M5 — Offline + install + polish + i18n + a11y + perf.** Ship to production. (2 days)
6. **M6 (later) — Cloud LLM coaching + sync + free-talk.**

## 15. Error handling & edge cases

- Mic permission denied → friendly Thai instructions to re-enable; offer a "type the word and just hear the model" fallback so the app is still useful.
- Model download fails / interrupted → resume support, retry, and a "use fast tier" fallback.
- Model produces empty/garbage phonemes (silence, noise) → "ไม่ได้ยินเสียงชัดเจน ลองอีกครั้งในที่เงียบกว่านี้" (Didn't hear clearly, try somewhere quieter) — never show a fake score.
- Very long utterance (> 15s) → ask to shorten; chunk later.
- AudioWorklet not supported (old Safari) → fall back to `MediaRecorder` + decode, or the fast/Whisper tier.
- Non-English sounds detected → label as "unexpected sound", don't crash alignment.

## 16. Deliverables

- A git repo with the SvelteKit app, the seed exercise JSON, the alignment + detection library (separate, unit-tested package or folder), the service worker config, the manifest, icons, and this spec as `SPEC.md`.
- A `README.md` with: how to run locally, how to regenerate the dictionary, how to swap the model, how to deploy to Cloudflare Pages, and the privacy summary.
- A `docs/PHONOLOGY.md` summarizing the §4 table with citations, so future contributors understand *why* each error rule exists.
- Lighthouse + test reports checked in under `docs/reports/`.

## 17. Out of scope (explicitly)

- No user accounts / auth in MVP.
- No server-side audio storage ever.
- No ads.
- No automated speech pathology diagnosis — this is pronunciation practice, not a medical device.
- No full ASR transcription display (we use phonemes; showing "what you said" in English letters can be demoralizing and wrong — show phonemes + the error, not a mis-spelled transcript).

---

**Success definition:** the developer's wife uses it for 10 minutes, gets feedback that matches what she actually heard herself do, and asks to do it again tomorrow.
