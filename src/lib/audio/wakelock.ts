/**
 * Screen wake lock — keeps the screen awake during recording.
 * Uses the Screen Wake Lock API where available, with graceful fallback.
 * SPEC §2: "Recording UI must survive screen sleep (wake lock)."
 */

let wakeLock: any = null;

export async function acquireWakeLock(): Promise<void> {
  try {
    if ("wakeLock" in navigator) {
      wakeLock = await (navigator as any).wakeLock.request("screen");
      // Re-acquire on visibility change (wake lock is released when tab is hidden)
      document.addEventListener("visibilitychange", onVisibilityChange);
    }
  } catch {
    // Wake lock not supported or denied — silently degrade
  }
}

export async function releaseWakeLock(): Promise<void> {
  try {
    if (wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
    document.removeEventListener("visibilitychange", onVisibilityChange);
  } catch {
    // ignore
  }
}

async function onVisibilityChange() {
  if (document.visibilityState === "visible" && !wakeLock) {
    try {
      if ("wakeLock" in navigator) {
        wakeLock = await (navigator as any).wakeLock.request("screen");
      }
    } catch {
      // ignore
    }
  }
}

export function isWakeLockSupported(): boolean {
  return "wakeLock" in navigator;
}
