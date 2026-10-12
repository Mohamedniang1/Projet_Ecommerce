// UI checks against the local dev server, with API fixtures only (no real orders).
// Run: node --test tests/addresses.browser.mjs
// Playwright must be available, or specified via PLAYWRIGHT_MODULE.
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

const maison = { id: 1, label: "Maison", customer_name: "Awa Test", phone: "+221771234567", city: "touba", city_label: "Touba", delivery_address: "Quartier de test, maison 12", is_default: true };
const bureau = { ...maison, id: 2, label: "Bureau", city: "dakar", city_label: "Dakar", customer_name: "Fatou Test", phone: "+221761234567", delivery_address: "Rue de test, bureau 8", is_default: false };
const labels = { dakar: "Dakar", touba: "Touba", tambacounda: "Tambacounda" };

async function fixture(t, options = {}) {
  const context = await browser.newContext({ viewport: options.mobile ? { width: 390, height: 844 } : { width: 1360, height: 900 } });
  t.after(() => context.close());
  const page = await context.newPage();
  const state = { book: structuredClone(options.book ?? [maison, bureau]), writes: [], unavailable: false, sessionId: 91, anonymous: false, ...options };
  const unexpected = [];
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => { assert.deepEqual(unexpected, []); assert.deepEqual(errors, []); });
  await context.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const reply = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: status === 204 ? undefined : JSON.stringify(data) });
    if (path === "/api/users/me/") return reply({ id: state.sessionId, first_name: "Awa", last_name: "Test" }, state.anonymous ? 401 : 200);
    if (path === "/api/users/csrf/") return reply({ csrfToken: "test-csrf" });
    if (path === "/api/users/refresh/") return reply({}, 401);
    if (path === "/api/users/addresses/") {
      if (method === "GET") return state.unavailable ? reply({}, 503) : reply(state.book);
      if (method === "POST") {
        assert.equal(request.headers()["x-csrftoken"], "test-csrf");
        const body = request.postDataJSON();
        state.writes.push({ method, body });
        if (body.is_default) state.book.forEach((address) => { address.is_default = false; });
        state.book.push({ ...body, id: Math.max(0, ...state.book.map((address) => address.id)) + 1, city_label: labels[body.city], is_default: !state.book.length || body.is_default });
        return reply(state.book.at(-1), 201);
      }
    }
    const detail = path.match(/^\/api\/users\/addresses\/(\d+)\/$/);
    if (detail) {
      const id = Number(detail[1]);
      const index = state.book.findIndex((address) => address.id === id);
      assert.equal(request.headers()["x-csrftoken"], "test-csrf");
      if (method === "PATCH") {
        const body = request.postDataJSON();
        state.writes.push({ method, id, body });
        if (body.is_default) state.book.forEach((address) => { address.is_default = false; });
        state.book[index] = { ...state.book[index], ...body };
        state.book[index].city_label = labels[state.book[index].city];
        return reply(state.book[index]);
      }
      if (method === "DELETE") {
        state.writes.push({ method, id });
        state.book.splice(index, 1);
        if (state.book.length && !state.book.some((address) => address.is_default)) state.book[0].is_default = true;
        return reply(null, 204);
      }
    }
    if (path === "/api/orders/" && method === "GET") return reply({ results: [{ phone: "+221701234567" }] });
    if (path === "/api/orders/pickup-points/") return reply([{ id: 1, name: "Point de test Dakar", city: "dakar", address: "Rue de test", phone: "", opening_hours: "" }]);
    if (path === "/api/catalog/products/produit-test/") return reply({ id: 1, slug: "produit-test", name: "Article de test", price: "3000", available_quantity: 10, image: null, image_alt: "", category: { name: "Maison" } });
    unexpected.push(`${method} ${path}`);
    return reply({}, 500);
  });
  if (options.cart) await context.addInitScript(() => localStorage.setItem("keurmayata-cart-v1", JSON.stringify([{ id: 1, slug: "produit-test", quantity: 1 }])));
  return { page, state };
}

async function value(locator, expected) {
  await locator.waitFor();
  assert.equal(await locator.inputValue(), expected);
}

async function screenshot(page, name) {
  if (!process.env.UI_SCREENSHOTS) return;
  await mkdir(process.env.UI_SCREENSHOTS, { recursive: true });
  await page.screenshot({ path: join(process.env.UI_SCREENSHOTS, `${name}.png`), fullPage: true });
}

test("address book: create, edit, default and delete; persisted after reload", async (t) => {
  const { page, state } = await fixture(t, { book: [] });
  await page.goto(`${baseURL}/mes-adresses`);
  await page.getByRole("button", { name: "Enregistrer ma première adresse" }).click();
  await page.getByLabel("Nom de l’adresse", { exact: true }).fill("Maison");
  await page.getByLabel("Ville", { exact: true }).selectOption("touba");
  await page.getByLabel("Téléphone", { exact: true }).fill("77 123 45 67");
  await page.getByLabel("Adresse et indications").fill("Quartier de test, maison 12");
  await page.getByRole("button", { name: "Enregistrer l’adresse" }).click();
  await page.getByRole("article", { name: "Maison, Touba" }).waitFor();
  assert.equal(state.book[0].is_default, true);
  await page.getByRole("button", { name: "Ajouter une adresse" }).click();
  await page.getByLabel("Nom de l’adresse", { exact: true }).fill("Bureau");
  await page.getByLabel("Téléphone", { exact: true }).fill("76 123 45 67");
  await page.getByLabel("Adresse et indications").fill("Rue de test, bureau 8");
  await page.getByRole("button", { name: "Enregistrer l’adresse" }).click();
  const card = page.getByRole("article", { name: "Bureau, Dakar" });
  await card.waitFor();
  await card.getByRole("button", { name: "Choisir par défaut" }).click();
  await card.getByText("Par défaut", { exact: true }).waitFor();
  await screenshot(page, "adresses-desktop");
  await page.getByRole("button", { name: "Modifier Bureau" }).click();
  assert.equal(await page.getByRole("article").count(), 0, "Editing cannot silently discard a draft through a second card action");
  await page.getByLabel("Nom de l’adresse", { exact: true }).fill("Mon bureau");
  await page.getByRole("button", { name: "Enregistrer l’adresse" }).click();
  await page.getByRole("article", { name: "Mon bureau, Dakar" }).waitFor();
  await page.reload();
  await page.getByRole("article", { name: "Mon bureau, Dakar" }).waitFor();
  await page.getByRole("button", { name: "Supprimer Maison" }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await page.getByRole("button", { name: "Modifier Mon bureau" }).waitFor();
  await page.getByRole("article", { name: "Maison, Touba" }).waitFor({ state: "detached" });
  assert.equal(state.book.length, 1);
  assert.equal(state.book[0].is_default, true);
  assert.equal(state.writes.length, 5);
});

test("checkout: saved address fills delivery and fees; order-only edits preserve the book", async (t) => {
  const { page, state } = await fixture(t, { cart: true });
  await page.goto(`${baseURL}/commande`);
  await page.getByRole("radio", { name: /Je me fais livrer/ }).check();
  await value(page.getByLabel("Choisir une adresse enregistrée"), "1");
  await value(page.getByLabel("Téléphone", { exact: true }), maison.phone);
  await value(page.getByLabel("Adresse de livraison", { exact: false }), maison.delivery_address);
  assert.match(await page.getByRole("complementary").innerText(), /Livraison à Touba/);
  assert.match(await page.getByRole("complementary").innerText(), /3\s?000 FCFA/);
  await page.getByLabel("Choisir une adresse enregistrée").selectOption("2");
  await value(page.getByLabel("Nom complet"), bureau.customer_name);
  assert.match(await page.getByRole("complementary").innerText(), /4\s?500 FCFA/);
  await page.getByLabel("Adresse de livraison", { exact: false }).fill("Une indication pour cette commande seulement");
  assert.equal(state.book[1].delivery_address, bureau.delivery_address);
  await screenshot(page, "commande-adresse-desktop");
  await page.getByLabel("Choisir une adresse enregistrée").selectOption("");
  await value(page.getByLabel("Adresse de livraison", { exact: false }), "");
  assert.deepEqual(state.writes, []);
});

test("checkout preserves explicit city and phone and works when address service fails", async (t) => {
  const { page } = await fixture(t, { cart: true });
  await page.goto(`${baseURL}/commande`);
  await page.getByText("Tambacounda", { exact: true }).click();
  await page.getByLabel("Téléphone", { exact: true }).fill("78 123 45 67");
  await page.getByRole("radio", { name: /Je me fais livrer/ }).check();
  await value(page.getByLabel("Choisir une adresse enregistrée"), "");
  await value(page.getByLabel("Téléphone", { exact: true }), "78 123 45 67");
  assert.match(await page.getByRole("complementary").innerText(), /Livraison à Tambacounda/);
  const fallback = await fixture(t, { cart: true, unavailable: true });
  await fallback.page.goto(`${baseURL}/commande`);
  await fallback.page.getByRole("radio", { name: /Je me fais livrer/ }).check();
  await fallback.page.getByText(/Vos adresses enregistrées sont momentanément indisponibles/).waitFor();
  await fallback.page.getByLabel("Adresse de livraison", { exact: false }).fill("Une adresse saisie manuellement");
  await value(fallback.page.getByLabel("Adresse de livraison", { exact: false }), "Une adresse saisie manuellement");
});

test("mobile address cards and editor have no horizontal overflow", async (t) => {
  const { page } = await fixture(t, { mobile: true });
  await page.goto(`${baseURL}/mes-adresses`);
  await page.getByRole("article", { name: "Maison, Touba" }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await screenshot(page, "adresses-mobile");
  await page.getByRole("button", { name: "Modifier Maison" }).click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await screenshot(page, "adresses-editeur-mobile");
});

test("logged out shows sign-in; switched account cannot mutate a stale book", async (t) => {
  const guest = await fixture(t, { anonymous: true });
  await guest.page.goto(`${baseURL}/mes-adresses`);
  await guest.page.getByRole("link", { name: "Se connecter", exact: true }).waitFor();
  assert.equal(await guest.page.getByRole("link", { name: "Se connecter", exact: true }).getAttribute("href"), "/connexion?next=/mes-adresses");
  const { page, state } = await fixture(t);
  await page.goto(`${baseURL}/mes-adresses`);
  await page.getByRole("button", { name: "Modifier Maison" }).click();
  state.sessionId = 92;
  await page.getByRole("button", { name: "Enregistrer l’adresse" }).click();
  await page.getByRole("link", { name: "Se connecter", exact: true }).waitFor();
  assert.deepEqual(state.writes, []);
});
