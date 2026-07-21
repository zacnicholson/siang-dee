/** App-wide reactive state (Svelte 5 runes via $state in .svelte; this is the plain-JS store bridge). */
import { writable } from "svelte/store";
import type { Settings } from "../lib/storage/db";
import { getSettings, saveSettings } from "../lib/storage/db";

export const settings = writable<Settings | null>(null);
export const route = writable<"home" | "exercise" | "minimalpair" | "settings" | "progress">("home");
export const currentExerciseId = writable<string | null>(null);
export const modelReady = writable(false);
export const modelProgress = writable(0);

export async function loadSettings() {
  const s = await getSettings();
  settings.set(s);
  return s;
}

export async function updateSettings(patch: Partial<Settings>) {
  const next = await saveSettings(patch);
  settings.set(next);
  return next;
}
