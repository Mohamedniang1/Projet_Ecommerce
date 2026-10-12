"use client";

import Image from "next/image";
import Link from "next/link";
import SiteFooter from "@/components/site-footer";
import StoreHeader from "@/components/store-header";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { FavoriteButton, FavoritesProvider } from "@/components/favorites";
import { catalogHref, readCatalogFilters } from "@/lib/catalog-navigation";
import { AddToCartButton } from "@/components/cart-controls";

type ProductPhoto = {
  id: number;
  image: string | null;
  image_alt: string;
  position: number;
};

type Product = {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: string;
  image: string | null;
  image_alt: string;
  images: ProductPhoto[];
  category: {
    id: number;
    name: string;
    slug: string;
  };
  in_stock: boolean;
  available_quantity: number;
  is_featured: boolean;
};

type Photo = {
  src: string;
  alt: string;
};

type LoadState =
  | { status: "loading" }
  | { status: "success"; product: Product }
  | { status: "missing" }
  | { status: "error" };

const priceFormatter = new Intl.NumberFormat("fr-SN", {
  maximumFractionDigits: 0,
});

const focusStyle =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F633F]";

function ProductPhoto({
  photo,
  thumbnail = false,
}: {
  photo: Photo;
  thumbnail?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-full items-center justify-center p-2 text-center text-xs text-[#667269]">
        {thumbnail ? "Photo" : "Cette photo est indisponible."}
      </div>
    );
  }

  return (
    <Image
      src={photo.src}
      alt={thumbnail ? "" : photo.alt}
      fill
      unoptimized
      sizes={
        thumbnail
          ? "80px"
          : "(max-width: 1024px) 100vw, 50vw"
      }
      className="object-contain"
      onError={() => setFailed(true)}
    />
  );
}

function ProductGallery({ product }: { product: Product }) {
  const [selected, setSelected] = useState(0);

  const candidates: Photo[] = [];

  if (product.image) {
    candidates.push({
      src: product.image,
      alt: product.image_alt || product.name,
    });
  }

  for (const photo of product.images ?? []) {
    if (photo.image) {
      candidates.push({
        src: photo.image,
        alt: photo.image_alt || `Autre vue de ${product.name}`,
      });
    }
  }

  const photos = candidates.filter(
    (photo, index, all) =>
      all.findIndex((item) => item.src === photo.src) === index,
  );

  const activePhoto = photos[selected] ?? photos[0];

  function movePhoto(direction: number) {
    if (photos.length < 2) return;

    setSelected(
      (current) =>
        (current + direction + photos.length) % photos.length,
    );
  }

  return (
    <section aria-label="Photos du produit" className="min-w-0 lg:sticky lg:top-[calc(var(--store-header-height)+1.5rem)]">
      <div className="relative overflow-hidden rounded-[24px] border border-[#E6E3D9] bg-[#EFEEE5] p-5 sm:p-8">
        <div className="relative aspect-square overflow-hidden rounded-xl bg-white sm:aspect-[6/5]">
          {activePhoto ? (
            <ProductPhoto
              key={activePhoto.src}
              photo={activePhoto}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[#667269]">
              Photo à venir
            </div>
          )}
        </div>

        {product.is_featured && (
          <span className="absolute left-4 top-4 rounded-full bg-[#173D2B] px-3 py-2 text-[9px] font-semibold tracking-wide text-white sm:left-6 sm:top-6 sm:text-[10px]">
            Notre sélection
          </span>
        )}

        {photos.length > 1 && (
          <div className="mt-5 flex items-center justify-between gap-3">
            <p
              aria-live="polite"
              aria-atomic="true"
              className="text-xs text-[#647168]"
            >
              Photo {selected + 1} sur {photos.length}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                aria-label="Photo précédente"
                onClick={() => movePhoto(-1)}
                className={`flex h-11 w-11 items-center justify-center rounded-full border border-[#D6DFD5] bg-white text-xl transition-colors hover:bg-[#E8EEE7] ${focusStyle}`}
              >
                <span aria-hidden="true">←</span>
              </button>

              <button
                type="button"
                aria-label="Photo suivante"
                onClick={() => movePhoto(1)}
                className={`flex h-11 w-11 items-center justify-center rounded-full border border-[#D6DFD5] bg-white text-xl transition-colors hover:bg-[#E8EEE7] ${focusStyle}`}
              >
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {photos.length > 1 && (
        <div
          aria-label="Choisir une photo"
          className="mt-3 flex gap-3 overflow-x-auto px-1 py-2"
        >
          {photos.map((photo, index) => (
            <button
              key={photo.src}
              type="button"
              aria-label={`Afficher la photo ${index + 1} de ${product.name}`}
              aria-pressed={selected === index}
              onClick={() => setSelected(index)}
              className={`relative h-18 w-18 shrink-0 overflow-hidden rounded-xl border-2 bg-white p-1 transition-colors sm:h-20 sm:w-20 ${focusStyle} ${
                selected === index
                  ? "border-[#173D2B] shadow-[0_0_0_3px_#E4E9DC]"
                  : "border-[#E4E9E2] hover:border-[#9CAB9D]"
              }`}
            >
              <ProductPhoto photo={photo} thumbnail />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function ProductContent({ slug, returnHref }: { slug: string; returnHref: string }) {
  const [state, setState] = useState<LoadState>({
    status: "loading",
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProduct() {
      try {
        const response = await fetch(
          `/api/catalog/products/${encodeURIComponent(slug)}/`,
          {
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(15000),
            ]),
          },
        );

        if (controller.signal.aborted) return;

        if (response.status === 404) {
          setState({ status: "missing" });
          return;
        }

        if (!response.ok) {
          throw new Error("Produit indisponible");
        }

        const product: Product = await response.json();

        if (!controller.signal.aborted) {
          setState({
            status: "success",
            product,
          });
        }
      } catch {
        if (!controller.signal.aborted) {
          setState({ status: "error" });
        }
      }
    }

    void loadProduct();

    return () => controller.abort();
  }, [slug, attempt]);

  if (state.status === "loading") {
    return (
      <div role="status" aria-busy="true" className="py-8">
        <span className="sr-only">
          Chargement du produit…
        </span>

        <div
          aria-hidden="true"
          className="grid gap-10 motion-safe:animate-pulse lg:grid-cols-[1.15fr_1fr]"
        >
          <div className="aspect-square rounded-2xl bg-[#F0F3EE]" />

          <div className="space-y-6 py-8">
            <div className="h-3 w-24 rounded bg-[#E9EEE6]" />
            <div className="h-12 w-3/4 rounded bg-[#E9EEE6]" />
            <div className="h-8 w-32 rounded bg-[#E9EEE6]" />
            <div className="h-14 rounded-xl bg-[#E9EEE6]" />
            <div className="h-40 rounded-xl bg-[#F0F3EE]" />
          </div>
        </div>
      </div>
    );
  }

  if (
    state.status === "missing" ||
    state.status === "error"
  ) {
    const missing = state.status === "missing";

    return (
      <section className="mx-auto max-w-lg py-24 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-[#86682E]">
          KeurMayata
        </p>

        <h1 className="mt-5 font-[Georgia] text-4xl">
          {missing ? "Produit introuvable" : "Un instant…"}
        </h1>

        <p className="mt-5 leading-7 text-[#647168]">
          {missing
            ? "Ce produit n’est plus disponible dans notre catalogue."
            : "Nous n’arrivons pas à charger cette fiche. Réessayez dans un instant."}
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {!missing && (
            <button
              type="button"
              onClick={() => {
                setState({ status: "loading" });
                setAttempt((current) => current + 1);
              }}
              className={`rounded-lg bg-[#173D2B] px-6 py-3 text-sm font-medium text-white hover:bg-[#24573E] ${focusStyle}`}
            >
              Réessayer
            </button>
          )}

          <Link
            href={returnHref}
            className={`rounded-lg border border-[#D6DFD5] px-6 py-3 text-sm font-medium hover:bg-[#F4F6F3] ${focusStyle}`}
          >
            Retour au catalogue
          </Link>
        </div>
      </section>
    );
  }

  const { product } = state;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 sm:mb-8">
        <Link href={returnHref} className={`inline-flex min-h-11 items-center gap-3 text-xs font-medium underline-offset-4 hover:underline ${focusStyle}`}>
          <span aria-hidden="true">←</span> Retour à ma sélection
        </Link>
        <nav aria-label="Fil d’Ariane" className="flex min-w-0 max-w-full items-center gap-2 text-[11px] text-[#647168]">
          <Link href="/" className={`hover:underline ${focusStyle}`}>Accueil</Link>
          <span aria-hidden="true">/</span>
          <Link href={returnHref} className={`hover:underline ${focusStyle}`}>Catalogue</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" title={product.name} className="min-w-0 max-w-48 truncate text-[#173D2B]">{product.name}</span>
        </nav>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1.05fr_1fr] lg:gap-9">
        <ProductGallery key={product.id} product={product} />

        <section aria-labelledby="product-title" className="min-w-0 rounded-[24px] border border-[#E6E3D9] bg-white p-5 sm:p-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#87682F]">{product.category.name}</p>
          <h1 id="product-title" className="mt-4 break-words font-[Georgia] text-[30px] leading-[1.18] tracking-tight sm:text-[38px] lg:text-[34px]">{product.name}</h1>
          <a href="#description-produit" className={`mt-3 inline-flex min-h-11 items-center gap-2 text-xs text-[#647168] underline underline-offset-4 hover:text-[#173D2B] ${focusStyle}`}>Lire la description <span aria-hidden="true">↓</span></a>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-y border-[#E7E7DD] py-5">
            <div><p className="text-[10px] text-[#647168]">Prix unitaire</p><p className="mt-1 text-[32px] font-semibold leading-tight tracking-tight">{priceFormatter.format(Number(product.price))}<span className="ml-2 text-xs font-medium tracking-normal">FCFA</span></p></div>
            <p className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-medium ${product.in_stock ? "bg-[#EDF5EE] text-[#285B3B]" : "bg-[#F2F2EF] text-[#696D65]"}`}>
              <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{product.in_stock ? "En stock" : "Rupture de stock"}
            </p>
          </div>

          <AddToCartButton key={product.id} product={product} />
          <FavoriteButton productId={product.id} name={product.name} />

          <div className="mt-7 space-y-4 rounded-xl bg-[#F8F7F1] p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 size-5 shrink-0 text-[#87682F]"><path d="M3 4h11v13H3zM14 9h4l3 4v4h-7" /><circle cx="6.5" cy="18" r="2" /><circle cx="17.5" cy="18" r="2" /></svg>
              <p className="text-xs leading-5"><span className="block font-semibold">Livraison à domicile</span><span className="text-[#647168]">Dakar : 1 500 FCFA<br />Touba et Tambacounda : gratuit</span></p>
            </div>
            <div className="flex items-start gap-3">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mt-0.5 size-5 shrink-0 text-[#87682F]"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>
              <p className="text-xs leading-5"><span className="block font-semibold">Retrait sur place gratuit</span><span className="text-[#647168]">Dans nos points de retrait à Dakar, Touba et Tambacounda.</span></p>
            </div>
            <Link href="/livraison-et-retrait" className={`inline-flex min-h-11 items-center gap-3 text-xs font-medium underline underline-offset-4 ${focusStyle}`}>Voir les modalités <span aria-hidden="true">→</span></Link>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#E7E7DD] pt-4">
            <p className="text-[11px] text-[#647168]">Modes de paiement proposés</p>
            <div className="flex flex-wrap items-center gap-3">
              <Image src="/payments/wave.png" alt="Wave" width={230} height={101} unoptimized className="h-auto w-[68px]" />
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#252525]"><Image src="/payments/orange-money.svg" alt="" width={26} height={26} unoptimized />Orange Money</span>
            </div>
          </div>
        </section>
      </div>

      <section id="description-produit" aria-labelledby="description-title" className="mt-9 grid scroll-mt-[calc(var(--store-header-height)+1rem)] gap-5 rounded-[24px] border border-[#E6E3D9] bg-white p-6 sm:mt-12 sm:p-8 lg:grid-cols-[0.55fr_1fr] lg:gap-12">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#87682F]">Tous les détails</p><h2 id="description-title" className="mt-3 font-[Georgia] text-2xl tracking-tight sm:text-3xl">À propos du produit</h2></div>
        <p className="min-w-0 whitespace-pre-line break-words text-sm leading-7 text-[#58665C]">{product.description.trim() || "La description de ce produit sera disponible prochainement."}</p>
      </section>
    </>
  );
}

function ProductPageContent() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const returnHref = catalogHref(readCatalogFilters(searchParams));

  return (
    <div className="min-h-screen bg-[#F8F5EE] text-[#173D2B] [--store-header-height:129px] sm:[--store-header-height:140px] lg:[--store-header-height:83px]">
      <div className="bg-[#173D2B] px-4 py-2.5 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-white">
        KeurMayata · Mode, beauté & maison
      </div>

      <StoreHeader search={searchParams.get("search") ?? ""} />

      <main className="mx-auto max-w-7xl px-5 pb-12 pt-4 sm:px-8 sm:pb-16 sm:pt-6">
        <ProductContent key={slug} slug={slug} returnHref={returnHref} />
      </main>

      <SiteFooter />
    </div>
  );
}

export default function ProductPage() {
  return <FavoritesProvider><Suspense fallback={<main role="status" className="min-h-screen bg-[#F5F7F5] p-10 text-center text-[#173D2B]">Chargement du produit…</main>}><ProductPageContent /></Suspense></FavoritesProvider>;
}
