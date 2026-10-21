import { planPendingAutomationEvents, executePendingAutomationActions } from "./automation-worker";

let running = false;
let timer: ReturnType<typeof setInterval> | undefined;

/**
 * Starts only when explicitly enabled. This is an in-process scheduler:
 * multiple replicas can run safely because the worker locks each execution,
 * but a dedicated job runner is preferable for larger deployments.
 */
export function startAutomationScheduler() {
  if (process.env.AUTOMATION_ENGINE_ENABLED !== "true" || timer) return;
  const interval = Math.max(5000, Number(process.env.AUTOMATION_POLL_INTERVAL_MS) || 30000);
  async function tick() {
    if (running) return;
    running = true;
    try {
      await planPendingAutomationEvents(50);
      await executePendingAutomationActions(25);
    } catch (error) {
      console.error("Automation scheduler iteration failed", error);
    } finally {
      running = false;
    }
  }
  timer = setInterval(() => void tick(), interval);
  timer.unref?.();
  void tick();
}

export function stopAutomationScheduler() {
  if (timer) clearInterval(timer);
  timer = undefined;
}
