// Isolated API fixtures: these checks never log out the user's real session.
// node --test tests/store-menu.browser.mjs (Playwright or PLAYWRIGHT_MODULE required)
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const baseURL = process.env.TEST_BASE_URL || "http://localhost:3000";
let browser;
before(async () => {
  browser = await chromium.launch({ headless: true, executablePath: process.env.TEST_BROWSER_EXECUTABLE });
});
after(async () => { await browser?.close(); });

async function fixture(t, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1360, height: 1000 } });
  t.after(() => context.close());
  const state = { session: "connected", csrf: "valid", logoutStatus: 200, meRequests: 0, requests: [], firstName: "Awa", lastName: "Test", ...options };
  await context.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    state.requests.push({ path: url.pathname, method: request.method(), csrf: request.headers()["x-csrftoken"] });
    const reply = (json, status = 200) => route.fulfill({ json, status });
    if (url.pathname === "/api/users/me/") {
      state.meRequests++;
      if (state.session === "error") return reply({}, 503);
      if (state.session === "guest") return reply({}, 401);
      return reply({ id: 99, first_name: state.firstName, last_name: state.lastName });
    }
    if (url.pathname === "/api/users/csrf/") {
      if (state.csrf === "error") return reply({}, 503);
      return reply({ csrfToken: state.csrf === "valid" ? "isolated-csrf-token" : null });
    }
    if (url.pathname === "/api/users/refresh/") return reply({}, 401);
    if (url.pathname === "/api/users/logout/") return reply({}, state.logoutStatus);
    if (url.pathname === "/api/catalog/products/") return reply({ count: 0, results: [] });
    return reply({}, 404);
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(`${baseURL}/panier`);
  await page.getByRole("heading", { name: "Tout commence par une envie." }).waitFor();
  return { page, state };
}

async function open(page) {
  await page.getByRole("button", { name: "Ouvrir le menu", exact: true }).click();
  const menu = page.getByRole("navigation", { name: "Menu principal", exact: true });
  await menu.waitFor();
  return menu;
}

test("header shows the signed-in name and initials, updates on return, and clears an expired session", async t => {
  const { page, state } = await fixture(t, { firstName: "  Mohamed  ", lastName: " Niang " });
  const accountNav = page.getByRole("navigation", { name: "Compte et panier", exact: true });
  const account = accountNav.getByRole("link", { name: "Mohamed Niang — Mon compte", exact: true });
  await account.waitFor();
  assert.equal(await account.getAttribute("href"), "/mon-compte");
  assert.equal(await account.locator('[aria-hidden="true"]').innerText(), "MN");
  assert.equal(await account.locator("span").last().innerText(), "Mohamed Niang");
  await page.reload();
  await account.waitFor();

  state.firstName = "Aminata";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await accountNav.getByRole("link", { name: "Aminata Niang — Mon compte", exact: true }).waitFor();
  const menu = await open(page);
  await menu.getByText("Bonjour, Aminata", { exact: true }).waitFor();
  await page.keyboard.press("Escape");

  state.session = "guest";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await accountNav.getByRole("link", { name: "Mon compte", exact: true }).waitFor();
  assert.equal(await accountNav.getByText("Aminata Niang", { exact: true }).count(), 0);
});

test("long names fit the header and an unnamed or unavailable profile keeps the account link usable", async t => {
  const firstName = "Aminata-Mariama";
  const lastName = "Ndiaye-Diop-LongNom";
  const { page, state } = await fixture(t, { firstName, lastName });
  const nav = page.getByRole("navigation", { name: "Compte et panier", exact: true });
  const account = nav.getByRole("link", { name: `${firstName} ${lastName} — Mon compte`, exact: true });
  await account.waitFor();
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const bounds = await account.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
    assert.equal(await account.getAttribute("title"), `${firstName} ${lastName} — Mon compte`);
  }
  state.firstName = "";
  state.lastName = "";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await nav.getByRole("link", { name: "Mon compte", exact: true }).waitFor();
  const menu = await open(page);
  await menu.getByRole("button", { name: "Se déconnecter", exact: true }).waitFor();
  await page.keyboard.press("Escape");
  state.session = "error";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await open(page);
  await menu.getByRole("button", { name: "Réessayer", exact: true }).waitFor();
  assert.equal(await nav.getByRole("link", { name: "Mon compte", exact: true }).getAttribute("href"), "/mon-compte");
});

test("menu supports keyboard, outside click and navigation with the header session", async t => {
  const { page, state } = await fixture(t);
  await page.getByRole("navigation", { name: "Compte et panier" }).getByRole("link", { name: "Awa Test — Mon compte", exact: true }).waitFor();
  assert.ok(state.meRequests >= 1);
  assert.equal(await page.getByRole("navigation", { name: "Menu principal", exact: true }).count(), 0);
  const trigger = page.getByRole("button", { name: "Ouvrir le menu", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("navigation", { name: "Menu principal", exact: true });
  await menu.getByRole("button", { name: "Se déconnecter", exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Fermer le menu" }).getAttribute("aria-expanded"), "true");
  assert.equal(await menu.getByRole("link").count(), 8);
  await page.keyboard.press("Tab");
  assert.equal(await menu.getByRole("link", { name: "Mon compte", exact: true }).evaluate(el => el === document.activeElement), true);
  await page.keyboard.press("Escape");
  await menu.waitFor({ state: "hidden" });
  assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
  await open(page);
  await page.getByRole("heading", { name: "Tout commence par une envie." }).click();
  await menu.waitFor({ state: "hidden" });
  await open(page);
  await page.getByRole("searchbox", { name: "Rechercher un produit" }).focus();
  await menu.waitFor({ state: "hidden" });
  await open(page);
  await menu.getByRole("link", { name: "À propos de l’entreprise" }).click();
  await page.waitForURL("**/a-propos");
  await page.getByRole("heading", { level: 1, name: "Le style qui vous ressemble." }).waitFor();
  assert.equal(await menu.count(), 0);
});

test("guests see sign-in; temporary session errors can be retried", async t => {
  const { page, state } = await fixture(t);
  state.session = "guest";
  const menu = await open(page);
  await menu.getByRole("link", { name: "Se connecter", exact: true }).waitFor();
  assert.equal(await menu.getByRole("button", { name: "Se déconnecter", exact: true }).count(), 0);
  await page.keyboard.press("Escape");
  state.session = "error";
  await open(page);
  await menu.getByRole("button", { name: "Réessayer", exact: true }).waitFor();
  state.session = "connected";
  await menu.getByRole("button", { name: "Réessayer", exact: true }).click();
  await menu.getByText("Bonjour, Awa", { exact: true }).waitFor();
  await menu.getByRole("button", { name: "Se déconnecter", exact: true }).waitFor();
});

test("logout requires CSRF, preserves failure feedback and redirects only after success", async t => {
  const { page, state } = await fixture(t);
  const menu = await open(page);
  const logout = menu.getByRole("button", { name: "Se déconnecter", exact: true });
  await logout.waitFor();
  for (const csrf of ["error", "invalid"]) {
    state.csrf = csrf;
    await logout.click();
    await menu.getByRole("alert").filter({ hasText: "Impossible de préparer la déconnexion" }).waitFor();
    assert.equal(state.requests.filter(r => r.path === "/api/users/logout/").length, 0);
  }
  state.csrf = "valid";
  state.logoutStatus = 503;
  await logout.click();
  await menu.getByRole("alert").filter({ hasText: "La déconnexion a échoué" }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/panier");
  state.logoutStatus = 200;
  await logout.click();
  await page.waitForURL("**/connexion");
  const posts = state.requests.filter(r => r.path === "/api/users/logout/");
  assert.equal(posts.length, 2);
  assert.ok(posts.every(r => r.method === "POST" && r.csrf === "isolated-csrf-token"));
  assert.deepEqual(state.requests.filter(r => r.method !== "GET").map(r => r.path), ["/api/users/logout/", "/api/users/logout/"]);
});

test("menu fits small screens, scrolls internally, and remains usable after page scrolling", async t => {
  const { page } = await fixture(t);
  for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 768, height: 480 }, { width: 1360, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => window.scrollTo(0, 300));
    const menu = await open(page);
    const logout = menu.getByRole("button", { name: "Se déconnecter", exact: true });
    await logout.waitFor();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const bounds = await menu.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width);
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= viewport.height, `Menu exceeds ${JSON.stringify(viewport)}`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await logout.scrollIntoViewIfNeeded();
    const buttonBounds = await logout.boundingBox();
    assert.ok(buttonBounds.y >= bounds.y && buttonBounds.y + buttonBounds.height <= viewport.height);
    assert.equal(Math.round((await page.locator("header").boundingBox()).y), 0);
    await page.keyboard.press("Escape");
  }
  // The home announcement sits above the sticky header before scrolling.
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(baseURL);
  const homeMenu = await open(page);
  await homeMenu.getByRole("button", { name: "Se déconnecter", exact: true }).waitFor();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const bounds = await homeMenu.boundingBox();
  assert.ok(bounds.y + bounds.height <= 640);
});

test("about page publishes the supplied contacts and opens its contact section from the menu", async t => {
  const { page } = await fixture(t);
  const menu = await open(page);
  await menu.getByRole("link", { name: "Nous contacter", exact: true }).click();
  await page.waitForURL("**/a-propos#contact");
  await page.getByRole("heading", { name: "Une question ? Parlons-en." }).waitFor();
  const contact = page.locator("#contact");
  assert.equal(await contact.locator('a[href="tel:+33672150549"]').count(), 1);
  assert.equal(await contact.locator('a[href="mailto:mohamedniang0606@gmail.com"]').count(), 1);
  assert.equal(await contact.locator('a[href="https://www.instagram.com/mohamedniang03/"]').count(), 1);
  assert.equal(await contact.locator('a[href="https://www.tiktok.com/@mniang188"]').count(), 1);
  await page.setViewportSize({ width: 320, height: 700 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
});
