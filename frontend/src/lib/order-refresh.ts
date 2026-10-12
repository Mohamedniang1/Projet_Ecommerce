export const ORDER_REFRESH_INTERVAL = 30_000;

// Une seule lecture à la fois. Le callback retourne false si la session
// ne permet plus le suivi ; une actualisation manuelle peut le relancer.
export function startOrderRefresh(load: (signal: AbortSignal) => Promise<boolean>) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight = false;
  let automatic = true;

  function clearTimer() {
    clearTimeout(timer);
    timer = undefined;
  }

  function available() {
    return document.visibilityState !== "hidden" && navigator.onLine !== false;
  }

  function schedule() {
    clearTimer();
    if (!controller.signal.aborted && automatic && available()) {
      timer = setTimeout(() => void refresh(), ORDER_REFRESH_INTERVAL);
    }
  }

  async function refresh() {
    if (controller.signal.aborted || inFlight || document.visibilityState === "hidden") return;
    clearTimer();
    inFlight = true;
    try {
      automatic = await load(controller.signal);
    } catch {
      // L’appelant affiche l’erreur ; une interruption n’arrête pas les essais.
    } finally {
      inFlight = false;
      schedule();
    }
  }

  function resume() {
    if (automatic && available()) void refresh();
    else clearTimer();
  }

  document.addEventListener("visibilitychange", resume);
  window.addEventListener("focus", resume);
  window.addEventListener("online", resume);
  window.addEventListener("offline", clearTimer);
  // Une première lecture permet aussi d’afficher une erreur si l’on est hors ligne.
  void refresh();

  return {
    refresh() {
      automatic = true;
      void refresh();
    },
    stop() {
      controller.abort();
      clearTimer();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", clearTimer);
    },
  };
}
