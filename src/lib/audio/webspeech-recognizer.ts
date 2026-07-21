/**
 * Web Speech Recognition API wrapper — uses the browser's built-in speech
 * recognition (Apple's on-device engine on iOS Safari, Google's engine on Chrome).
 *
 * This is far more accurate than Whisper-tiny for short single-word recognition,
 * requires no model download, and works offline on iOS (the OS downloads the
 * language pack automatically).
 *
 * IMPORTANT: SpeechRecognition does its own mic capture — it does NOT accept
 * a pre-recorded audio blob. It must be started from a user gesture and runs
 * live while the user speaks. We start it in parallel with our PCM recorder
 * so we still have the audio for playback + waveform display.
 */

export interface WebSpeechResult {
  transcript: string;
  confidence: number;
}

export function isWebSpeechSupported(): boolean {
  return typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
}

/**
 * Start live speech recognition. Returns a controller object:
 *   - `result`: Promise that resolves with the recognized text
 *   - `stop()`: Call when the user releases the record button
 */
export interface WebSpeechController {
  result: Promise<WebSpeechResult>;
  stop: () => void;
}

export function startWebSpeechRecognition(
  targetWord?: string,
  timeoutMs = 8000,
): WebSpeechController {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  let recognition: any = null;
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let resolveFn: ((r: WebSpeechResult) => void) | null = null;
  let rejectFn: ((e: any) => void) | null = null;

  let retried = false; // guard against retry loops on repeated network errors

  const result = new Promise<WebSpeechResult>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;

    if (!SR) {
      reject(new Error("SpeechRecognition not supported"));
      return;
    }

    // Build + wire a fresh SpeechRecognition instance. Extracted so we can
    // restart it on a transient `network` error (Chrome's online engine)
    // instead of letting onend reject before the user has spoken.
    const buildRecognition = (): any => {
      const r = new SR();
      r.lang = "en-US";
      r.continuous = false;
      r.interimResults = false;
      r.maxAlternatives = 5;
      return r;
    };

    const done = (r: WebSpeechResult) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try { recognition.stop(); } catch {}
      resolve(r);
    };

    const fail = (e: any) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try { recognition.stop(); } catch {}
      reject(e);
    };

    timer = setTimeout(() => {
      fail(new Error("recognition timeout"));
    }, timeoutMs);

    let networkFailed = false;

    const wire = (r: any) => {
      r.onresult = onResult;
      r.onerror = onError;
      r.onend = onEnd;
    };

    const onResult = (event: any) => {
      const results = event.results;
      const alternatives: Array<{ transcript: string; confidence: number }> = [];
      for (let i = 0; i < results.length; i++) {
        for (let j = 0; j < results[i].length; j++) {
          alternatives.push({
            transcript: results[i][j].transcript.trim(),
            confidence: results[i][j].confidence ?? 0.8,
          });
        }
      }

      if (alternatives.length === 0) {
        fail(new Error("no recognition results"));
        return;
      }

      // If we have a target word, prefer the alternative that matches it
      if (targetWord) {
        const cleanTarget = targetWord.toLowerCase().replace(/[^a-z']/g, "");
        let best = alternatives[0];
        for (const alt of alternatives) {
          const cleanAlt = alt.transcript.toLowerCase().replace(/[^a-z']/g, "");
          if (cleanAlt === cleanTarget) {
            best = { ...alt, confidence: Math.max(alt.confidence, 0.9) };
            break;
          }
          // Also prefer shorter transcripts (single-word practice)
          if (cleanAlt.length < best.transcript.length && alt.confidence >= best.confidence) {
            best = alt;
          }
        }
        done(best);
      } else {
        done(alternatives[0]);
      }
    };

    const onError = (event: any) => {
      if (event.error === "no-speech" || event.error === "aborted") {
        fail(new Error(`no speech detected: ${event.error}`));
      } else if (event.error === "not-allowed") {
        fail(new Error("microphone permission denied"));
      } else if (event.error === "network") {
        // Transient on Chrome's online engine. Retry once before giving up —
        // a single re-start frequently succeeds and lets the user actually
        // be heard instead of falling straight to the hallucination-prone
        // Whisper path.
        if (!retried) {
          retried = true;
          console.warn("[Siang Dee] Web Speech network error — retrying once");
          try { recognition?.stop(); } catch {}
          try {
            recognition = buildRecognition();
            wire(recognition);
            recognition.start();
          } catch (e: any) {
            if (!String(e?.name || e?.message || "").includes("InvalidState")) {
              networkFailed = true;
            }
          }
        } else {
          networkFailed = true;
          console.warn("[Siang Dee] Web Speech network error (retry exhausted) — will fall back to Whisper");
        }
      } else {
        fail(new Error(`recognition error: ${event.error}`));
      }
    };

    const onEnd = () => {
      if (settled) return;
      // If a network retry is in flight (we restarted and haven't settled),
      // this onend belongs to the failed first attempt — ignore it. The retry's
      // own onresult/onend will settle the promise.
      if (retried && !networkFailed) return;
      if (networkFailed) {
        console.warn("[Siang Dee] Web Speech ended after network error — falling back");
      }
      fail(new Error("recognition ended without result"));
    };

    try {
      recognition = buildRecognition();
      wire(recognition);
      recognition.start();
    } catch (e: any) {
      // "InvalidStateError" if already started — ignore
      if (!String(e?.name || e?.message || "").includes("InvalidState")) {
        fail(e);
      }
    }
  });

  const stop = () => {
    if (settled) return;
    if (timer) clearTimeout(timer);
    try { recognition?.stop(); } catch {}
    // Give the engine up to 1.5s to deliver a late onresult after the user
    // releases the button — a single short word often finalizes just as the
    // finger lifts, and 500ms was too tight, cutting off valid results.
    setTimeout(() => {
      if (!settled && rejectFn) {
        settled = true;
        rejectFn(new Error("recognition stopped by user"));
      }
    }, 1500);
  };

  return { result, stop };
}
