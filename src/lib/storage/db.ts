/**
 * IndexedDB storage (SPEC §6) via the `idb` wrapper.
 * Stores: exercises, attempts, progress, settings, audio.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

const DB_NAME = "siang-dee";
const DB_VERSION = 1;

export interface Attempt {
  id: string;
  exerciseId: string;
  timestamp: number;
  targetPhonemes: string[];
  spokenPhonemes: string[];
  errors: Array<{ errorId: string; position: number }>;
  score: number;
  audioRef?: string; // id into the audio store
}

export interface Progress {
  errorId: string;
  attempts: number;
  lastScore: number;
  bestScore: number;
  masteryLevel: number; // 0..3
  streakDays: number;
  lastPracticed: number;
}

export interface Settings {
  modelTier: "accurate" | "fast";
  cloudCoaching: boolean;
  uiLang: "th" | "en";
  wakeLock: boolean;
  autoSpeak: boolean;
  speakRate: 0.8 | 1.0 | 1.1;
  muted: boolean;
  onboarded: boolean;
  reminderTime: string; // "HH:MM" for daily practice reminder, "" = off
  reminderGranted: boolean; // notification permission granted
}

const DEFAULT_SETTINGS: Settings = {
  modelTier: "accurate",
  cloudCoaching: false,
  uiLang: "th",
  wakeLock: true,
  autoSpeak: true,
  speakRate: 1.0,
  muted: false,
  onboarded: false,
  reminderTime: "",
  reminderGranted: false,
};

interface SDDB extends DBSchema {
  exercises: { key: string; value: any };
  attempts: { key: string; value: Attempt; indexes: { "by-date": number } };
  progress: { key: string; value: Progress };
  settings: { key: string; value: Settings };
  audio: { key: string; value: { id: string; blob: Blob; createdAt: number } };
  meta: { key: string; value: { key: string; value: any } };
}

let dbp: Promise<IDBPDatabase<SDDB>> | null = null;

function db() {
  if (!dbp) {
    dbp = openDB<SDDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("exercises")) db.createObjectStore("exercises", { keyPath: "id" });
        if (!db.objectStoreNames.contains("attempts")) {
          const s = db.createObjectStore("attempts", { keyPath: "id" });
          s.createIndex("by-date", "timestamp");
        }
        if (!db.objectStoreNames.contains("progress")) db.createObjectStore("progress", { keyPath: "errorId" });
        if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings");
        if (!db.objectStoreNames.contains("audio")) db.createObjectStore("audio", { keyPath: "id" });
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
      },
    });
  }
  return dbp;
}

export async function getSettings(): Promise<Settings> {
  const d = await db();
  const s = await d.get("settings", "app");
  return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const d = await db();
  const cur = await getSettings();
  const next = { ...cur, ...patch };
  await d.put("settings", next, "app");
  return next;
}

export async function saveAttempt(a: Attempt, audioBlob?: Blob): Promise<void> {
  const d = await db();
  // Deep-clone to strip Svelte 5 $state proxies — IndexedDB structured clone can't handle them
  const attempt: Attempt = JSON.parse(JSON.stringify(a));
  if (audioBlob) {
    const audioId = `aud-${a.id}`;
    attempt.audioRef = audioId;
    await d.put("audio", { id: audioId, blob: audioBlob, createdAt: Date.now() });
  }
  await d.put("attempts", attempt);
  // update progress per errorId touched
  await updateProgress(attempt);
  await pruneOldAudio(d);
}

async function updateProgress(a: Attempt): Promise<void> {
  const d = await db();
  const touched = new Set(a.errors.map((e) => e.errorId));
  for (const eid of touched) {
    const cur = (await d.get("progress", eid)) ?? {
      errorId: eid, attempts: 0, lastScore: 0, bestScore: 0, masteryLevel: 0, streakDays: 0, lastPracticed: 0,
    };
    cur.attempts++;
    cur.lastScore = a.score;
    cur.bestScore = Math.max(cur.bestScore, a.score);
    // mastery: 0=none, 1=seen, 2=stable 60+, 3=stable 80+
    if (a.score >= 80) cur.masteryLevel = Math.max(cur.masteryLevel, 3);
    else if (a.score >= 60) cur.masteryLevel = Math.max(cur.masteryLevel, 2);
    else cur.masteryLevel = Math.max(cur.masteryLevel, 1);
    // streak (simple day diff)
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const last = new Date(cur.lastPracticed || 0); last.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - last.getTime()) / 86400000);
    cur.streakDays = diff === 1 ? cur.streakDays + 1 : diff === 0 ? cur.streakDays : 1;
    cur.lastPracticed = a.timestamp;
    await d.put("progress", cur);
  }
}

export async function getAllProgress(): Promise<Progress[]> {
  const d = await db();
  return await d.getAll("progress");
}

export async function getRecentAttempts(limit = 20): Promise<Attempt[]> {
  const d = await db();
  const tx = d.transaction("attempts", "readonly");
  const idx = tx.store.index("by-date");
  const out: Attempt[] = [];
  let cursor = await idx.openCursor(null, "prev");
  while (cursor && out.length < limit) { out.push(cursor.value); cursor = await cursor.continue(); }
  await tx.done;
  return out;
}

async function pruneOldAudio(d: IDBPDatabase<SDDB>) {
  const cutoff = Date.now() - 7 * 86400000;
  let cursor = await d.transaction("audio", "readwrite").store.openCursor();
  while (cursor) {
    if (cursor.value.createdAt < cutoff) await cursor.delete();
    cursor = await cursor.continue();
  }
}

export async function getAudio(id: string): Promise<Blob | undefined> {
  const d = await db();
  return (await d.get("audio", id))?.blob;
}

export async function clearAll(): Promise<void> {
  const d = await db();
  await d.clear("attempts");
  await d.clear("audio");
  await d.clear("progress");
}
