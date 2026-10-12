// Browser navigation checks with isolated API fixtures. No shop data is changed.
// node --test tests/catalog-navigation.browser.mjs (Playwright or PLAYWRIGHT_MODULE required)
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const baseURL = process.env.TEST_BASE_URL || "http://localhost:3000";
let browser;
before(async () => { browser = await chromium.launch({ headless: true, executablePath: process.env.TEST_BROWSER_EXECUTABLE }); });
after(async () => { await browser?.close(); });

const category = { id: 1, name: "Beauté", slug: "beaute", description: "" };
const product = { id: 1, name: "Huile de rose", slug: "huile-de-rose", description: "Un soin pour le quotidien.", price: "1500", image: null, image_alt: "", images: [], category, in_stock: true, available_quantity: 10, is_featured: false };
async function fixture(t) {
  const context = await browser.newContext({ viewport: { width: 1360, height: 960 } });
  t.after(() => context.close());
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  const state = { fail: false, requests: [] };
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await context.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const reply = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    assert.equal(route.request().method(), "GET");
    if (url.pathname === "/api/users/me/") return reply({ id: 99, first_name: "Awa", last_name: "Test" });
    if (url.pathname === "/api/users/favorites/") return reply({ user_id: 99, results: [] });
    if (url.pathname === "/api/catalog/categories/") return reply([category, { ...category, id: 2, name: "Maison", slug: "maison" }]);
    if (url.pathname === "/api/catalog/products/huile-de-rose/") return reply(product);
    if (url.pathname === "/api/catalog/products/") {
      state.requests.push(Object.fromEntries(url.searchParams));
      if (state.fail) return reply({}, 503);
      const currentPage = Number(url.searchParams.get("page"));
      if (currentPage > 2) return reply({ detail: "Invalid page." }, 404);
      return reply({ count: 13, next: currentPage === 1 ? "?page=2" : null, previous: currentPage === 2 ? "?page=1" : null, results: [product] });
    }
    throw new Error(`Unexpected API request: ${url.pathname}`);
  });
  return { page, state };
}
const loaded = (page) => page.getByRole("link", { name: "Découvrir Huile de rose", exact: true }).waitFor();
const filters = (page) => Object.fromEntries(new URL(page.url()).searchParams);

test("shared selection survives reload, product visit and return to catalogue", async (t) => {
  const { page, state } = await fixture(t);
  const expected = { category: "beaute", search: "huile", ordering: "price", page: "2" };
  await page.goto(`${baseURL}/?${new URLSearchParams(expected)}#catalogue`);
  await loaded(page);
  assert.equal(await page.getByLabel("Rechercher un produit", { exact: true }).inputValue(), "huile");
  assert.equal(await page.getByLabel("Trier par").inputValue(), "price");
  assert.equal(await page.getByRole("button", { name: "Beauté", exact: true }).getAttribute("aria-pressed"), "true");
  assert.deepEqual(state.requests.at(-1), { page: "2", ordering: "price", category: "beaute", search: "huile" });
  await page.reload();
  await loaded(page);
  await page.getByRole("link", { name: "Découvrir Huile de rose", exact: true }).click();
  await page.getByRole("heading", { level: 1, name: product.name }).waitFor();
  assert.deepEqual(filters(page), expected);
  await page.reload();
  await page.getByRole("link", { name: "Retour à ma sélection", exact: true }).click();
  await loaded(page);
  assert.deepEqual(filters(page), expected);
  assert.equal(new URL(page.url()).hash, "#catalogue");
  assert.equal(await page.locator('[aria-current="page"]').innerText(), "Page 2");
});

test("filter history follows back and forward; chips can be removed independently", async (t) => {
  const { page } = await fixture(t);
  await page.goto(`${baseURL}/#catalogue`);
  await loaded(page);
  await page.getByRole("button", { name: "Beauté", exact: true }).click();
  await loaded(page);
  await page.getByLabel("Rechercher un produit", { exact: true }).fill("huile");
  await page.getByRole("button", { name: "Rechercher", exact: true }).click();
  await loaded(page);
  await page.getByLabel("Trier par").selectOption("price");
  await loaded(page);
  await page.goBack();
  await loaded(page);
  assert.equal(await page.getByLabel("Trier par").inputValue(), "-created_at");
  await page.goBack();
  await loaded(page);
  assert.equal(await page.getByLabel("Rechercher un produit", { exact: true }).inputValue(), "");
  await page.goForward();
  await loaded(page);
  assert.equal(await page.getByLabel("Rechercher un produit", { exact: true }).inputValue(), "huile");
  await page.getByRole("button", { name: "Suivant →", exact: true }).click();
  await loaded(page);
  assert.equal(filters(page).page, "2");
  await page.getByRole("button", { name: "Retirer le filtre Beauté", exact: true }).click();
  await loaded(page);
  assert.deepEqual(filters(page), { search: "huile" });
  await page.getByRole("button", { name: "Tout effacer", exact: true }).click();
  await loaded(page);
  assert.deepEqual(filters(page), {});
  assert.equal(await page.getByRole("group", { name: "Filtres actifs", exact: true }).count(), 0);
});

test("obsolete page can return to first page without losing selection; temporary errors retry", async (t) => {
  const { page, state } = await fixture(t);
  await page.goto(`${baseURL}/?category=beaute&search=huile&page=999#catalogue`);
  await page.getByRole("button", { name: "Revenir à la première page", exact: true }).click();
  await loaded(page);
  assert.deepEqual(filters(page), { category: "beaute", search: "huile" });
  state.fail = true;
  await page.reload();
  // Next.js also mounts an empty route-announcement alert; wait for the actual failure.
  await page.getByRole("alert").filter({ hasText: "Le catalogue ne peut pas être chargé" }).waitFor();
  state.fail = false;
  await page.getByRole("button", { name: "Réessayer", exact: true }).click();
  await loaded(page);
  assert.deepEqual(filters(page), { category: "beaute", search: "huile" });
});

test("invalid URL values use safe defaults; long mobile queries remain readable", async (t) => {
  const { page, state } = await fixture(t);
  await page.goto(`${baseURL}/?category=https://example.invalid&ordering=unknown&page=-2#catalogue`);
  await loaded(page);
  assert.deepEqual(state.requests.at(-1), { page: "1", ordering: "-created_at" });
  await page.getByRole("link", { name: "Découvrir Huile de rose", exact: true }).click();
  await page.getByRole("heading", { level: 1, name: product.name }).waitFor();
  assert.equal(await page.getByRole("link", { name: "Retour à ma sélection", exact: true }).getAttribute("href"), "/#catalogue");
  await page.setViewportSize({ width: 390, height: 844 });
  const longSearch = "rose".repeat(37);
  await page.goto(`${baseURL}/?search=${longSearch}&category=beaute&ordering=-price#catalogue`);
  await loaded(page);
  const overflow = await page.evaluate(() => [...document.querySelectorAll("body *")]
    .filter((element) => element.getBoundingClientRect().right > innerWidth + 1)
    .map((element) => `${element.tagName}.${element.className}`));
  assert.deepEqual(overflow, [], "Mobile elements must remain inside the viewport");
  await page.getByRole("button", { name: `Retirer le filtre Recherche : ${longSearch}`, exact: true }).click();
  await loaded(page);
  assert.deepEqual(filters(page), { category: "beaute", ordering: "-price" });
});
