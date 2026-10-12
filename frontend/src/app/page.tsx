"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import StoreHeader from "@/components/store-header";
import SiteFooter from "@/components/site-footer";
import { Arrow, HomeHero, HomeUniverses, HomeVisit } from "@/components/home-showcase";
import { FavoriteButton, FavoritesProvider } from "@/components/favorites";
import { catalogHref, catalogQuery, catalogSorts, readCatalogFilters, type CatalogFilters } from "@/lib/catalog-navigation";

type Category = {
  id: number;
  name: string;
  slug: string;
  description: string;
};

type Product = {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: string;
  image: string | null;
  image_alt: string;
  category: Category;
  in_stock: boolean;
  is_featured: boolean;
};

type ProductResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: Product[];
};

const priceFormatter = new Intl.NumberFormat("fr-SN", {
  maximumFractionDigits: 0,
});

const focusStyle =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F633F]";

function ProductCard({ product, query, spacious }: { product: Product; query: string; spacious: boolean }) {
  const [imageFailed, setImageFailed] = useState(false);
  const productUrl = `/produits/${encodeURIComponent(product.slug)}${query ? `?${query}` : ""}`;

  return (
    <article className="group flex h-full min-w-0 flex-col rounded-2xl border border-[#E5E6DC] bg-white p-2.5 motion-safe:transition-shadow motion-safe:duration-300 hover:shadow-[0_16px_40px_-24px_rgba(23,61,43,0.3)] sm:p-3">
      <div className="relative">
      <Link
        href={productUrl}
        aria-label={`Découvrir ${product.name}`}
        className={`relative block overflow-hidden rounded-xl bg-[#F4F3ED] ${spacious ? "aspect-[4/3] sm:aspect-[5/4]" : "aspect-[4/5]"} ${focusStyle}`}
      >
        {product.image && !imageFailed ? (
          <Image
            src={product.image}
            alt={product.image_alt || product.name}
            fill
            unoptimized
            sizes={spacious ? "(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 584px" : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"}
            onError={() => setImageFailed(true)}
            className="object-contain p-5 motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-[1.04] sm:p-8"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-[#647168]">
            Photo à venir
          </div>
        )}

        {product.is_featured && (
          <span className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] rounded-full bg-[#173D2B] px-3 py-1.5 text-[9px] font-semibold tracking-wide text-white sm:text-[10px]">
            Notre sélection
          </span>
        )}
      </Link>
      <div className="absolute right-3 top-3"><FavoriteButton productId={product.id} name={product.name} compact /></div>
      </div>

      <div className="flex flex-1 flex-col px-2 pb-2 pt-5 sm:px-3 sm:pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#7A6338] sm:text-[10px]">
          {product.category.name}
        </p>
        <p className={`flex items-center gap-1.5 text-[10px] ${product.in_stock ? "text-[#386548]" : "text-[#72776E]"}`}>
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
          {product.in_stock ? "En stock" : "Rupture de stock"}
        </p>
        </div>

        <h3 className={`mb-5 mt-3 break-words font-normal text-[#173D2B] ${spacious ? "min-h-14 font-[Georgia] text-xl leading-7 sm:min-h-16 sm:text-2xl sm:leading-8" : "min-h-12 text-sm leading-6 sm:text-base"}`}>
          <Link
            href={productUrl}
            title={product.name}
            className={`line-clamp-2 underline-offset-4 hover:underline ${focusStyle}`}
          >
            {product.name}
          </Link>
        </h3>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-[#ECEDE5] pt-3">
        <p className="text-lg font-semibold tracking-tight text-[#173D2B] sm:text-xl">
          {priceFormatter.format(Number(product.price))}
          <span className="ml-1.5 text-xs font-medium">FCFA</span>
        </p>

        <Link
          href={productUrl}
          className={`inline-flex min-h-11 items-center gap-2 text-xs font-medium text-[#173D2B] underline-offset-4 hover:underline ${focusStyle}`}
        >
          Voir le produit <Arrow className="size-4" />
        </Link>
        </div>
      </div>
    </article>
  );
}

function HomeContent() {
  const searchParams = useSearchParams();
  const filters = readCatalogFilters(searchParams);
  const { category, search, ordering, page } = filters;
  const query = catalogQuery(filters);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [count, setCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [settledRequest, setSettledRequest] = useState("");
  const [error, setError] = useState("");
  const [missingPage, setMissingPage] = useState(false);
  const [retry, setRetry] = useState(0);
  const requestKey = `${query}|${retry}`;
  const isLoading = settledRequest !== requestKey;

  useEffect(() => {
    const controller = new AbortController();

    async function loadCatalog() {
      const params = new URLSearchParams({
        page: String(page),
        ordering,
      });

      if (category) params.set("category", category);
      if (search) params.set("search", search);

      const options: RequestInit = {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(15000),
        ]),
      };

      try {
        const [categoriesResponse, productsResponse] = await Promise.all([
          fetch("/api/catalog/categories/", options),
          fetch(`/api/catalog/products/?${params.toString()}`, options),
        ]);

        if (controller.signal.aborted) return;
        if (categoriesResponse.ok && productsResponse.status === 404 && page > 1) {
          setMissingPage(true);
          setError("Cette page de produits n’est plus disponible. Retrouvez votre sélection sur la première page.");
          return;
        }

        if (!categoriesResponse.ok || !productsResponse.ok) {
          throw new Error("Catalogue indisponible");
        }

        const [categoryData, productData]: [Category[], ProductResponse] =
          await Promise.all([
            categoriesResponse.json(),
            productsResponse.json(),
          ]);

        if (controller.signal.aborted) return;

        setCategories(categoryData);
        setProducts(productData.results);
        setCount(productData.count);
        setHasNext(productData.next !== null);
        setMissingPage(false);
        setError("");
      } catch {
        if (!controller.signal.aborted) {
          setMissingPage(false);
          setError(
            "Le catalogue ne peut pas être chargé pour le moment. Réessayez dans quelques instants.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setSettledRequest(requestKey);
        }
      }
    }

    void loadCatalog();

    return () => controller.abort();
  }, [category, search, ordering, page, requestKey]);

  function prepareLoading() {
    setError("");
    setRetry((value) => value + 1);
  }

  function updateFilters(changes: Partial<CatalogFilters>) {
    const next = { ...filters, page: 1, ...changes };
    if (catalogQuery(next) === query) {
      prepareLoading();
      return;
    }
    window.history.pushState(null, "", catalogHref(next));
  }

  function selectCategory(slug: string) {
    updateFilters({ category: slug });
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("search") ?? "");
    updateFilters({ search: value.trim().slice(0, 150) });
    scrollToCatalog();
  }

  function resetFilters() {
    updateFilters({ category: "", search: "", ordering: "-created_at" });
  }

  function changePage(nextPage: number) {
    updateFilters({ page: nextPage });
    scrollToCatalog();
  }

  function scrollToCatalog() {
    document.getElementById("catalogue")?.scrollIntoView({
      block: "start",
      behavior: "instant",
    });
  }

  const activeCategory = categories.find(
    (item) => item.slug === category,
  );
  const hasFilters = Boolean(category || search || ordering !== "-created_at");

  return (
    <div className="min-h-screen bg-[#FFFEFA] text-[#173D2B] [--store-header-height:129px] sm:[--store-header-height:140px] lg:[--store-header-height:83px]">
      <div className="bg-[#173D2B] px-4 py-2.5 text-center text-[10px] font-medium tracking-wide text-[#F5F0DF] sm:text-xs">
        Un peu de vous, dans chaque détail. <span aria-hidden="true" className="mx-2 text-[#E3C783]">✦</span> <span className="whitespace-nowrap">Bienvenue chez KeurMayata.</span>
      </div>

      <StoreHeader search={search} onSearch={handleSearch} />

      <main>
        <HomeHero />
        <HomeUniverses categories={categories} onSelect={(slug) => {
          updateFilters({ category: slug, search: "", ordering: "-created_at" });
          scrollToCatalog();
        }} />

        <section
          id="catalogue"
          aria-labelledby="catalog-title"
          className="mx-auto max-w-7xl scroll-mt-[calc(var(--store-header-height)+1rem)] px-5 pb-12 pt-3 sm:px-8 sm:pb-16"
        >
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#85652C]">
                La sélection KeurMayata
              </p>

              <h2
                id="catalog-title"
                className="mt-3 font-[Georgia] text-3xl tracking-tight sm:text-4xl"
              >
                {search ? "Vos résultats de recherche" : activeCategory?.name || "Vos prochains coups de cœur."}
              </h2>
            </div>
            <p className="max-w-xs text-sm leading-6 text-[#657065]">{search || category ? "Une sélection au fil de vos envies." : "Repérez vos favoris. Trouvez votre bonheur."}</p>
          </div>

          <div
            role="group"
            aria-label="Filtrer par catégorie"
            className="mt-7 flex flex-wrap gap-2 border-b border-[#E5EAE3] pb-6"
          >
            {[
              { id: 0, name: "Tout découvrir", slug: "" },
              ...categories,
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={category === item.slug}
                onClick={() => selectCategory(item.slug)}
                className={`min-h-11 rounded-full border px-5 text-sm transition-colors ${focusStyle} ${
                  category === item.slug
                    ? "border-[#173D2B] bg-[#173D2B] text-white"
                    : "border-[#DCE5DC] bg-white text-[#526052] hover:border-[#173D2B] hover:text-[#173D2B]"
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 py-5">
            <div aria-live="polite" className="min-w-0 max-w-full break-words text-xs text-[#647168] [overflow-wrap:anywhere]">
              {isLoading
                ? "Chargement de la sélection…"
                : error
                  ? "Catalogue indisponible"
                  : `${count} produit${count > 1 ? "s" : ""}`}

              {!isLoading && !error && search && (
                <span> pour « {search} »</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <label
                htmlFor="catalog-sort"
                className="text-xs text-[#647168]"
              >
                Trier par
              </label>

              <select
                id="catalog-sort"
                value={ordering}
                onChange={(event) => updateFilters({ ordering: event.target.value })}
                className={`min-h-11 max-w-full rounded-lg border border-[#DCE5DC] bg-white px-3 text-xs ${focusStyle}`}
              >
                {catalogSorts.map((sort) => <option key={sort.value} value={sort.value}>{sort.label}</option>)}
              </select>
            </div>
          </div>

          {hasFilters && (
            <div aria-label="Filtres actifs" role="group" className="mb-6 flex flex-wrap items-center gap-2 rounded-xl bg-[#F4F7F2] p-3 sm:p-4">
              <span className="mr-1 text-xs text-[#647168]">Votre sélection</span>
              {[
                ...(category ? [{ label: activeCategory?.name || category, changes: { category: "" } }] : []),
                ...(search ? [{ label: `Recherche : ${search}`, changes: { search: "" } }] : []),
                ...(ordering !== "-created_at" ? [{ label: catalogSorts.find((sort) => sort.value === ordering)!.label, changes: { ordering: "-created_at" } }] : []),
              ].map(({ label, changes }) => (
                <button key={label} type="button" aria-label={`Retirer le filtre ${label}`} onClick={() => updateFilters(changes)} className={`inline-flex min-h-11 max-w-full items-center gap-3 rounded-full border border-[#DCE5DC] bg-white px-4 py-2 text-left text-xs text-[#173D2B] transition hover:border-[#173D2B] ${focusStyle}`}>
                  <span className="min-w-0 break-words [overflow-wrap:anywhere]">{label}</span><span aria-hidden="true" className="text-base text-[#647168]">×</span>
                </button>
              ))}
              <button type="button" onClick={resetFilters} className={`min-h-11 px-2 text-xs font-medium underline underline-offset-4 sm:ml-auto ${focusStyle}`}>Tout effacer</button>
            </div>
          )}

          <div aria-busy={isLoading}>
            {isLoading ? (
              <div
                aria-hidden="true"
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6"
              >
                {[1, 2].map((item) => (
                  <div key={item} className="motion-safe:animate-pulse">
                    <div className="aspect-[5/4] rounded-xl bg-[#F0F3EE]" />
                    <div className="mt-4 h-3 w-1/3 rounded bg-[#EDF1E9]" />
                    <div className="mt-3 h-4 w-4/5 rounded bg-[#EDF1E9]" />
                    <div className="mt-3 h-4 w-1/2 rounded bg-[#EDF1E9]" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="rounded-xl border border-[#E1E7E1] bg-[#F7F9F5] p-8 text-center">
                <p
                  role="alert"
                  className="text-sm leading-7 text-[#526052]"
                >
                  {error}
                </p>

                <button
                  type="button"
                  onClick={() => {
                    if (missingPage) changePage(1);
                    else prepareLoading();
                  }}
                  className={`mt-5 min-h-11 rounded-lg bg-[#173D2B] px-6 text-sm font-medium text-white hover:bg-[#24573E] ${focusStyle}`}
                >
                  {missingPage ? "Revenir à la première page" : "Réessayer"}
                </button>
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-xl border border-[#E1E7E1] bg-[#F7F9F5] px-6 py-12 text-center">
                <h3 className="font-[Georgia] text-2xl">
                  {hasFilters
                    ? "Aucun produit pour cette sélection."
                    : "Notre sélection arrive bientôt."}
                </h3>

                <p className="mt-3 text-sm leading-7 text-[#647168]">
                  {hasFilters
                    ? "Essayez une autre catégorie ou un autre mot-clé."
                    : "Revenez découvrir les premiers produits KeurMayata."}
                </p>

                {hasFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className={`mt-5 min-h-11 rounded-lg bg-[#173D2B] px-6 text-sm font-medium text-white hover:bg-[#24573E] ${focusStyle}`}
                  >
                    Voir tous les produits
                  </button>
                )}
              </div>
            ) : (
              <div className={`grid items-stretch gap-4 sm:gap-6 ${products.length <= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"}`}>
                {products.map((product) => (
                  <ProductCard
                    key={`${product.id}-${product.image}`}
                    product={product}
                    query={query}
                    spacious={products.length <= 2}
                  />
                ))}
              </div>
            )}
          </div>

          {!isLoading && !error && (page > 1 || hasNext) && (
            <nav
              aria-label="Pages du catalogue"
              className="mt-10 flex flex-wrap items-center justify-center gap-4 border-t border-[#E5EAE3] pt-7"
            >
              <button
                type="button"
                disabled={page === 1}
                onClick={() => changePage(page - 1)}
                className={`min-h-11 rounded-lg border border-[#DCE5DC] px-4 text-sm hover:bg-[#F3F6F2] disabled:cursor-not-allowed disabled:opacity-40 ${focusStyle}`}
              >
                ← Précédent
              </button>

              <span aria-current="page" className="text-sm">
                Page {page}
              </span>

              <button
                type="button"
                disabled={!hasNext}
                onClick={() => changePage(page + 1)}
                className={`min-h-11 rounded-lg border border-[#DCE5DC] px-4 text-sm hover:bg-[#F3F6F2] disabled:cursor-not-allowed disabled:opacity-40 ${focusStyle}`}
              >
                Suivant →
              </button>
            </nav>
          )}
        </section>
        <HomeVisit />
      </main>

      <SiteFooter />
    </div>
  );
}

export default function HomePage() {
  return <FavoritesProvider><Suspense fallback={<main role="status" className="min-h-screen bg-[#F5F7F5] p-10 text-center text-[#173D2B]">Chargement de la boutique…</main>}><HomeContent /></Suspense></FavoritesProvider>;
}
