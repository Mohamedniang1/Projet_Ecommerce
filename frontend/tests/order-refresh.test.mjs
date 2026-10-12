import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/order-refresh.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

// Horloge et événements du navigateur simulés, sans requête ni délai réel.
function browser() {
  const document = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const window = new EventTarget();
  const navigator = { onLine: true };
  const timers = new Map();
  let now = 0;
  let nextTimer = 0;
  const loadedModule = { exports: {} };
  vm.runInNewContext(compiled, {
    module: loadedModule, exports: loadedModule.exports, document, window, navigator, AbortController,
    setTimeout(callback, delay) {
      const id = ++nextTimer;
      timers.set(id, { callback, at: now + delay });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
  });
  return {
    start: loadedModule.exports.startOrderRefresh,
    timers,
    async advance(delay) {
      const until = now + delay;
      while (true) {
        const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > until) break;
        now = next[1].at;
        timers.delete(next[0]);
        next[1].callback();
        await setImmediate();
      }
      now = until;
    },
    hide() { document.visibilityState = "hidden"; document.dispatchEvent(new Event("visibilitychange")); },
    show() { document.visibilityState = "visible"; document.dispatchEvent(new Event("visibilitychange")); },
    offline() { navigator.onLine = false; window.dispatchEvent(new Event("offline")); },
    online() { navigator.onLine = true; window.dispatchEvent(new Event("online")); },
    focus() { window.dispatchEvent(new Event("focus")); },
  };
}

test("actualise au chargement puis toutes les 30 secondes", async (t) => {
  const env = browser();
  let calls = 0;
  const tracking = env.start(async () => { calls++; return true; });
  t.after(() => tracking.stop());
  await setImmediate();
  assert.equal(calls, 1);
  await env.advance(29_999);
  assert.equal(calls, 1);
  await env.advance(1);
  assert.equal(calls, 2);
  await env.advance(30_000);
  assert.equal(calls, 3);
});

test("évite les requêtes simultanées malgré les clics et retours d’onglet", async (t) => {
  const env = browser();
  let calls = 0;
  let finish;
  const tracking = env.start(() => {
    calls++;
    return new Promise((resolve) => { finish = resolve; });
  });
  t.after(() => tracking.stop());
  tracking.refresh();
  env.focus();
  env.show();
  await env.advance(90_000);
  assert.equal(calls, 1);
  finish(true);
  await setImmediate();
  await env.advance(30_000);
  assert.equal(calls, 2);
  finish(true);
  await setImmediate();
});

test("suspend les lectures quand la page est masquée ou hors ligne", async (t) => {
  const env = browser();
  let calls = 0;
  const tracking = env.start(async () => { calls++; return true; });
  t.after(() => tracking.stop());
  await setImmediate();
  env.hide();
  await env.advance(120_000);
  assert.equal(calls, 1);
  env.show();
  await setImmediate();
  assert.equal(calls, 2);
  env.offline();
  env.focus();
  await env.advance(120_000);
  assert.equal(calls, 2);
  env.online();
  await setImmediate();
  assert.equal(calls, 3);
});

test("une réponse reçue après masquage ne relance pas les lectures en arrière-plan", async (t) => {
  const env = browser();
  let finish;
  const tracking = env.start(() => new Promise((resolve) => { finish = resolve; }));
  t.after(() => tracking.stop());
  env.hide();
  finish(true);
  await setImmediate();
  assert.equal(env.timers.size, 0);
});

test("arrête le suivi après refus de session et permet un nouvel essai manuel", async (t) => {
  const env = browser();
  let calls = 0;
  const tracking = env.start(async () => { calls++; return calls > 1; });
  t.after(() => tracking.stop());
  await setImmediate();
  await env.advance(120_000);
  env.focus();
  env.hide();
  env.show();
  assert.equal(calls, 1);
  tracking.refresh();
  await setImmediate();
  assert.equal(calls, 2);
  await env.advance(30_000);
  assert.equal(calls, 3);
});

test("réessaie après une interruption réseau", async (t) => {
  const env = browser();
  let calls = 0;
  const tracking = env.start(async () => {
    calls++;
    if (calls === 1) throw new Error("Réseau indisponible");
    return true;
  });
  t.after(() => tracking.stop());
  await setImmediate();
  await env.advance(30_000);
  assert.equal(calls, 2);
});

test("quitter la page annule la lecture et retire tous les déclencheurs", async () => {
  const env = browser();
  let signal;
  let finish;
  let calls = 0;
  const tracking = env.start((currentSignal) => {
    calls++;
    signal = currentSignal;
    return new Promise((resolve) => { finish = resolve; });
  });
  tracking.stop();
  assert.equal(signal.aborted, true);
  finish(true);
  await setImmediate();
  env.focus();
  env.online();
  env.show();
  tracking.refresh();
  await env.advance(120_000);
  assert.equal(calls, 1);
  assert.equal(env.timers.size, 0);
});
