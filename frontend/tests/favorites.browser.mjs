// Local UI tests with intercepted API responses; no real favorites or orders are written.
// node --test tests/favorites.browser.mjs (Playwright or PLAYWRIGHT_MODULE required)
import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const baseURL = process.env.TEST_BASE_URL || "http://localhost:3000";
let browser;
before(async () => { browser = await chromium.launch({ headless: true, executablePath: process.env.TEST_BROWSER_EXECUTABLE }); });
after(async () => { await browser?.close(); });

const category = { id: 1, name: "Beauté", slug: "beaute", description: "" };
const product = { id: 1, slug: "soin-test", name: "Soin test", price: "3000", image: null, image_alt: "", category, description: "Description de test.", images: [], in_stock: true, available_quantity: 5, is_featured: true };
const other = { ...product, id: 2, slug: "huile-test", name: "Huile test", in_stock: false, available_quantity: 0 };

async function fixture(t, options = {}) {
  const context = await browser.newContext({ viewport: options.mobile ? { width: 390, height: 844 } : { width: 1360, height: 900 } });
  t.after(() => context.close());
  const page = await context.newPage();
  const state = { ids: [], userId: 91, anonymous: false, unavailable: false, writes: [], ...options };
  const unexpected = [];
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => { assert.deepEqual(unexpected, []); assert.deepEqual(errors, []); });
  await context.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const reply = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: status === 204 ? undefined : JSON.stringify(body) });
    if (path === "/api/users/me/") return reply({ id: state.userId, first_name: "Awa", last_name: "Test" }, state.anonymous ? 401 : 200);
    if (path === "/api/users/csrf/") return reply({ csrfToken: "test-csrf" });
    if (path === "/api/users/refresh/") return reply({}, 401);
    if (path === "/api/users/login/") { state.anonymous = false; return reply({}); }
    if (path === "/api/users/favorites/" && method === "GET") {
      if (state.anonymous) return reply({}, 401);
      if (state.unavailable) return reply({}, 503);
      return reply({ user_id: state.userId, results: state.ids.map((id) => {
        const current = [product, other].find((item) => item.id === id);
        return { product_id: id, product: current ? { ...current, category: category.name } : null };
      }) });
    }
    const detail = path.match(/^\/api\/users\/favorites\/(\d+)\/$/);
    if (detail && ["PUT", "DELETE"].includes(method)) {
      assert.equal(request.headers()["x-csrftoken"], "test-csrf");
      const id = Number(detail[1]);
      state.writes.push({ id, method });
      state.ids = method === "DELETE" ? state.ids.filter((value) => value !== id) : [...new Set([id, ...state.ids])];
      return reply({}, method === "DELETE" ? 204 : 201);
    }
    if (path === "/api/catalog/categories/") return reply([category]);
    if (path === "/api/catalog/products/") return reply({ count: 2, next: null, previous: null, results: [product, other] });
    if (path === "/api/catalog/products/soin-test/") return reply(product);
    unexpected.push(`${method} ${path}`);
    return reply({}, 500);
  });
  return { page, state };
}

async function screenshot(page, name) {
  if (!process.env.UI_SCREENSHOTS) return;
  await mkdir(process.env.UI_SCREENSHOTS, { recursive: true });
  await page.screenshot({ path: join(process.env.UI_SCREENSHOTS, `${name}.png`), fullPage: true });
}

test("catalog heart saves without navigating; product and favorites pages stay consistent after reload", async (t) => {
  const { page, state } = await fixture(t);
  await page.goto(baseURL);
  await page.getByRole("button", { name: "Ajouter Soin test aux favoris", exact: true }).click();
  await page.getByRole("button", { name: "Retirer Soin test des favoris", exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/");
  assert.deepEqual(state.ids, [1]);
  await page.getByRole("link", { name: "Découvrir Soin test", exact: true }).click();
  await page.getByRole("button", { name: "Retirer Soin test des favoris", exact: true }).waitFor();
  await page.getByRole("link", { name: "Favoris", exact: true }).click();
  await page.getByRole("article", { name: "Soin test", exact: true }).waitFor();
  await page.reload();
  await page.getByRole("button", { name: "Retirer Soin test des favoris", exact: true }).click();
  await page.getByRole("heading", { name: "Votre prochain coup de cœur vous attend" }).waitFor();
  assert.deepEqual(state.ids, []);
  assert.deepEqual(state.writes.map((write) => write.method), ["PUT", "DELETE"]);
});

test("saved, out-of-stock and unpublished items; stock filter and removal", async (t) => {
  const { page, state } = await fixture(t, { ids: [1, 2, 3] });
  await page.goto(`${baseURL}/mes-favoris`);
  await page.getByRole("article", { name: "Soin test", exact: true }).waitFor();
  assert.equal(await page.getByRole("article").count(), 3);
  await screenshot(page, "favoris-desktop");
  await page.getByLabel("Uniquement en stock").check();
  assert.equal(await page.getByRole("article").count(), 1);
  await page.getByLabel("Uniquement en stock").uncheck();
  await page.getByRole("button", { name: "Retirer l’article indisponible n°3 des favoris", exact: true }).click();
  await page.getByRole("article", { name: "Article indisponible", exact: true }).waitFor({ state: "detached" });
  assert.deepEqual(state.ids, [1, 2]);
});

test("mobile favorites and product hearts remain accessible without overflow", async (t) => {
  const { page } = await fixture(t, { ids: [1, 2], mobile: true });
  await page.goto(`${baseURL}/mes-favoris`);
  await page.getByRole("article", { name: "Soin test", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await screenshot(page, "favoris-mobile");
  await page.goto(baseURL);
  await page.getByRole("button", { name: "Retirer Soin test des favoris", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const heart = page.getByRole("button", { name: "Retirer Soin test des favoris", exact: true });
  const rect = await heart.boundingBox();
  assert.ok(rect && rect.width >= 44 && rect.height >= 44);
});

test("guest heart leads to sign-in and returns to the product; no favorite is silently created", async (t) => {
  const { page, state } = await fixture(t, { anonymous: true });
  await page.goto(`${baseURL}/produits/soin-test`);
  await page.getByRole("button", { name: "Ajouter Soin test aux favoris", exact: true }).click();
  await page.waitForURL(/\/connexion\?next=/);
  assert.equal(new URL(page.url()).searchParams.get("next"), "/produits/soin-test");
  await page.locator('input[name="email"]').fill("test@example.com");
  await page.locator('input[name="password"]').fill("Only-a-fixture-password");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.waitForURL(`${baseURL}/produits/soin-test`);
  assert.deepEqual(state.writes, []);
  await page.getByRole("button", { name: "Ajouter Soin test aux favoris", exact: true }).click();
  await page.getByRole("button", { name: "Retirer Soin test des favoris", exact: true }).waitFor();
});

test("read failure can be retried and an account switch cannot write stale favorites", async (t) => {
  const { page, state } = await fixture(t, { unavailable: true, ids: [1] });
  await page.goto(`${baseURL}/mes-favoris`);
  await page.getByRole("button", { name: "Réessayer", exact: true }).waitFor();
  state.unavailable = false;
  await page.getByRole("button", { name: "Réessayer", exact: true }).click();
  await page.getByRole("button", { name: "Retirer Soin test des favoris", exact: true }).waitFor();
  state.userId = 92;
  await page.getByRole("button", { name: "Retirer Soin test des favoris", exact: true }).click();
  await page.getByRole("link", { name: "Se connecter", exact: true }).waitFor();
  assert.deepEqual(state.writes, []);
});
