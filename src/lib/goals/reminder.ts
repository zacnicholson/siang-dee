/**
 * Daily practice reminder notifications.
 *
 * PWAs can't schedule true background notifications without a push server
 * (Push API + VAPID). Instead we use a hybrid approach:
 *  1. When the app is open, setTimeout fires the notification at the set time.
 *  2. When the app is opened AFTER the reminder time and the daily goal
 *     isn't met yet, we fire a "catch-up" notification immediately.
 *  3. The service worker (public/sw.js) shows the notification body.
 *
 * This covers the most common case: the user opens the app in the evening,
 * hasn't practiced yet, and gets a gentle nudge.
 */
import { getSettings, saveSettings } from "../storage/db";
import { getDailyStats } from "./daily";
import { EXERCISES } from "../../data/exercises";
import { openDB } from "idb";

let scheduledTimeout: ReturnType<typeof setTimeout> | null = null;

/** Request notification permission from a user gesture. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") {
    await saveSettings({ reminderGranted: true });
    return true;
  }
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  const granted = result === "granted";
  await saveSettings({ reminderGranted: granted });
  return granted;
}

/** Schedule today's reminder notification (if app is open past the set time). */
export async function scheduleReminder(): Promise<void> {
  if (scheduledTimeout) { clearTimeout(scheduledTimeout); scheduledTimeout = null; }
  const settings = await getSettings();
  if (!settings.reminderTime || !settings.reminderGranted) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const [h, m] = settings.reminderTime.split(":").map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);

  // If the time has already passed today, don't schedule — the catch-up
  // check on app open handles it.
  if (target.getTime() <= now.getTime()) return;

  const msUntil = target.getTime() - now.getTime();
  scheduledTimeout = setTimeout(() => {
    fireReminderNotification();
    // Reschedule for tomorrow
    scheduleReminder();
  }, msUntil);
}

/** Fire the reminder notification if the daily goal isn't met. */
export async function fireReminderNotification(): Promise<void> {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const daily = await getDailyStats();
  if (daily.goalMet) return; // already practiced enough today

  const word = EXERCISES[Math.floor(Math.random() * EXERCISES.length)];
  const body = `${word.prompt} → ${word.promptThai}. ฝึก 1 นาที?`;

  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification("เสียงดี — ฝึกวันนี้", {
          body,
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          tag: "siang-dee-reminder",
          data: { url: "/?exercise=" + word.id },
        });
        return;
      }
    }
    new Notification("เสียงดี — ฝึกวันนี้", { body, icon: "/icons/icon-192.png" });
  } catch {
    // Notification API not available
  }
}

/** On app open: if reminder time has passed today and goal not met, fire it. */
export async function checkReminderOnOpen(): Promise<void> {
  const settings = await getSettings();
  if (!settings.reminderTime || !settings.reminderGranted) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const [h, m] = settings.reminderTime.split(":").map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);

  // Only fire catch-up if we're within 4 hours past the reminder time
  const msPast = now.getTime() - target.getTime();
  if (msPast < 0 || msPast > 4 * 3600000) return;

  // Check if we already fired a reminder today (stored in meta)
  const todayKey = `reminder-fired-${new Date().toDateString()}`;
  const fired = await getMeta(todayKey);
  if (fired) return;
  await setMeta(todayKey, true);

  await fireReminderNotification();
}

// Simple meta store helpers
async function getMeta(key: string): Promise<any> {
  const db = await openDB("siang-dee", 1);
  return (await db.get("meta", key))?.value;
}

async function setMeta(key: string, value: any): Promise<void> {
  const db = await openDB("siang-dee", 1);
  await db.put("meta", { key, value });
}
