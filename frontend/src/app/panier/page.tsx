"use client";

import Image from "next/image";
import Link from "next/link";
import SiteFooter from "@/components/site-footer";
import StoreHeader from "@/components/store-header";
import CartSuggestions from "@/components/cart-suggestions";
import { useEffect, useState } from "react";
import {
  fetchCartProduct,
  MAX_QUANTITY,
  money,
  removeFromCart,
  setCartQuantity,
  useCart,
  type CartItem,
  type CartProduct,
} from "@/lib/cart";

const outlineButton =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-[#D6DFD5] px-4 text-sm transition-colors hover:bg-[#F0F4ED] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F633F]";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F633F]";

function BagIcon({ className = "size-5" }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 7h14l1 14H4L5 7ZM8 8V6a4 4 0 0 1 8 0v2" /></svg>;
}

function DeliveryInfo() {
  return (
    <section aria-label="Livraison et retrait" className="rounded-2xl border border-[#E3E5D6] bg-[#EEF1E6] p-5 lg:col-start-1 lg:row-start-2">
      <div className="flex items-center gap-2.5">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-5 shrink-0 text-[#87682F]"><path d="M3 4h11v13H3zM14 9h4l3 4v4h-7" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></svg>
        <h2 className="text-sm font-medium">À votre porte ou près de chez vous</h2>
      </div>
      <dl className="mt-4 grid gap-3 text-xs leading-5 sm:grid-cols-3 sm:divide-x sm:divide-[#DCE2D2]">
        <div className="flex justify-between gap-3 sm:block sm:pr-3"><dt className="text-[#647168]">Retrait sur place</dt><dd>Gratuit</dd></div>
        <div className="flex justify-between gap-3 sm:block sm:px-3"><dt className="text-[#647168]">Livraison à Dakar</dt><dd>1 500 FCFA</dd></div>
        <div className="flex justify-between gap-3 sm:block sm:pl-3"><dt className="text-[#647168]">Touba & Tambacounda</dt><dd>Livraison gratuite</dd></div>
      </dl>
    </section>
  );
}

function CartPhoto({ product }: { product: CartProduct }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-[#F5F4EE] sm:h-28 sm:w-24">
      {product.image && !failed ? (
        <Image
          src={product.image}
          alt={product.image_alt || product.name}
          fill
          unoptimized
          sizes="96px"
          className="object-contain p-2"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full items-center justify-center p-2 text-center text-xs text-[#647168]">
          Photo indisponible
        </div>
      )}
    </div>
  );
}

function CartContents({
  items,
  signature,
}: {
  items: CartItem[];
  signature: string;
}) {
  const [products, setProducts] = useState<
    Record<number, CartProduct | null> | null
  >(null);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const references: { id: number; slug: string }[] =
      JSON.parse(signature);

    async function load() {
      try {
        const entries = await Promise.all(
          references.map(async ({ id, slug }) => {
            const product = await fetchCartProduct(
              slug,
              controller.signal,
            );

            return [
              id,
              product?.id === id ? product : null,
            ] as const;
          }),
        );

        if (!controller.signal.aborted) {
          setProducts(Object.fromEntries(entries));
          setLoadError("");
        }
      } catch {
        if (!controller.signal.aborted) {
          setLoadError(
            "Impossible de charger les prix et les disponibilités.",
          );
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [signature, attempt]);

  function changeCart(action: () => void) {
    try {
      action();
      setActionError("");
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Impossible de modifier le panier.",
      );
    }
  }

  if (loadError) {
    return (
      <div role="alert" className="rounded-2xl border border-[#E1E7DD] bg-white p-8">
        <p>{loadError}</p>
        <button
          type="button"
          onClick={() => {
            setLoadError("");
            setAttempt((value) => value + 1);
          }}
          className={`${outlineButton} mt-5`}
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (!products) {
    return (
      <p role="status" className="py-12 text-[#647168]">
        Vérification des articles…
      </p>
    );
  }

  const hasUnavailable = items.some((item) => {
    const product = products[item.id];
    return !product || item.quantity > product.available_quantity;
  });

  const total = items.reduce((sum, item) => {
    const product = products[item.id];
    return sum + (product ? Number(product.price) * item.quantity : 0);
  }, 0);

  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      {actionError && (
        <p role="alert" className="mb-5 rounded-lg bg-[#FFF0EE] p-4 text-sm text-[#96392D]">
          {actionError}
        </p>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_1fr] lg:gap-6">
        <section
          aria-label="Articles du panier"
          className="min-w-0 divide-y divide-[#E8E8DF] overflow-hidden rounded-2xl border border-[#E5E6DC] bg-white"
        >
          {items.map((item) => {
            const product = products[item.id];

            if (!product) {
              return (
                <article key={item.id} className="p-5 sm:p-6">
                  <h2 className="break-words font-medium">
                    Produit indisponible : {item.slug}
                  </h2>
                  <p className="mt-2 text-sm text-[#647168]">
                    Ce produit a été retiré du catalogue.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      changeCart(() => removeFromCart(item.id))
                    }
                    className={`mt-3 min-h-11 text-sm underline underline-offset-4 ${focus}`}
                  >
                    Retirer du panier
                  </button>
                </article>
              );
            }

            const exceedsStock =
              item.quantity > product.available_quantity;

            return (
              <article key={item.id} aria-label={product.name} className="p-4 sm:p-5">
                <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-x-4 gap-y-4 sm:grid-cols-[96px_minmax(0,1fr)_160px]">
                  <Link href={`/produits/${encodeURIComponent(product.slug)}`} aria-label={`Voir ${product.name}`} className={`self-start rounded-xl ${focus}`}><CartPhoto key={product.image} product={product} /></Link>

                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#86682E]">
                      {product.category.name}
                    </p>

                    <h2 className="mt-2 break-words text-sm font-normal leading-6 sm:text-base">
                      <Link
                        href={`/produits/${encodeURIComponent(product.slug)}`}
                        title={product.name}
                        className={`line-clamp-2 underline-offset-4 hover:underline ${focus}`}
                      >
                        {product.name}
                      </Link>
                    </h2>

                    <p className="mt-2 text-xs leading-5 text-[#647168]">
                      {money(Number(product.price))} / unité
                    </p>

                    {!exceedsStock && <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[#386548]"><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />En stock</p>}
                  </div>

                <div className="col-span-2 flex flex-wrap items-center justify-between gap-3 border-t border-[#ECEDE5] pt-3 sm:col-span-1 sm:flex-col sm:items-end sm:justify-start sm:border-0 sm:pt-0">
                  <div className="flex items-center gap-2">
                  <div
                    role="group"
                    aria-label={`Quantité de ${product.name}`}
                    className="flex items-center rounded-lg border border-[#D6DFD5] bg-white"
                  >
                    <button
                      type="button"
                      aria-label={`Diminuer la quantité de ${product.name}`}
                      disabled={item.quantity <= 1}
                      onClick={() =>
                        changeCart(() =>
                          setCartQuantity(item.id, item.quantity - 1),
                        )
                      }
                      className={`h-11 w-9 rounded-l-lg text-lg hover:bg-[#F3F6F0] disabled:cursor-not-allowed disabled:opacity-30 ${focus}`}
                    >
                      −
                    </button>

                    <span aria-live="polite" className="w-7 text-center text-sm">
                      {item.quantity}
                    </span>

                    <button
                      type="button"
                      aria-label={`Augmenter la quantité de ${product.name}`}
                      disabled={
                        item.quantity >=
                        Math.min(MAX_QUANTITY, product.available_quantity)
                      }
                      onClick={() =>
                        changeCart(() =>
                          setCartQuantity(item.id, item.quantity + 1),
                        )
                      }
                      className={`h-11 w-9 rounded-r-lg text-lg hover:bg-[#F3F6F0] disabled:cursor-not-allowed disabled:opacity-30 ${focus}`}
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    aria-label={`Retirer ${product.name} du panier`}
                    title="Supprimer cet article"
                    onClick={() =>
                      changeCart(() => removeFromCart(item.id))
                    }
                    className={`flex size-11 items-center justify-center rounded-lg text-[#647168] transition-colors hover:bg-[#FFF0EE] hover:text-[#96392D] ${focus}`}
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-4"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6" /></svg>
                  </button>
                  </div>
                  <p className="ml-auto text-right text-base font-semibold sm:mt-1 sm:text-lg">{money(Number(product.price) * item.quantity)}</p>
                </div>
                </div>

                {exceedsStock && (
                  <p role="alert" className="mt-4 rounded-lg bg-[#FFF0EE] p-3 text-sm text-[#96392D]">
                    {product.available_quantity === 0
                      ? "Ce produit est en rupture de stock. Retirez-le du panier."
                      : `Il reste ${product.available_quantity} exemplaire(s). Réduisez la quantité.`}
                  </p>
                )}
              </article>
            );
          })}
        </section>

        <aside aria-label="Récapitulatif du panier" className="lg:sticky lg:top-[calc(var(--store-header-height)+1.25rem)] lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="rounded-2xl border border-[#E5E6DC] bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-[Georgia] text-2xl">Récapitulatif</h2>
              <BagIcon className="size-5 text-[#87682F]" />
            </div>

            <p className="mt-1 text-xs text-[#647168]">{count} article{count > 1 ? "s" : ""} dans votre panier</p>

            <div className="mt-5 border-t border-[#E8E8DF] pt-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="text-sm">Sous-total</span>
                <span aria-live="polite" className="text-2xl font-semibold tracking-tight">
                  {hasUnavailable ? "À vérifier" : money(total)}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-5 text-[#647168]">Hors frais de livraison.</p>
            </div>

            {hasUnavailable ? (
              <p className="mt-5 rounded-lg bg-[#FFF3E1] p-3 text-sm leading-6 text-[#78551C]">
                Vérifiez les articles signalés avant de poursuivre.
              </p>
            ) : (
              <Link href="/commande" className={`mt-5 flex min-h-12 items-center justify-center gap-3 rounded-xl bg-[#173D2B] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#28553E] ${focus}`}>
                Préparer ma commande <span aria-hidden="true">→</span>
              </Link>
            )}

            <Link href="/#catalogue" className={`mt-1 flex min-h-11 items-center justify-center text-xs text-[#647168] underline underline-offset-4 hover:text-[#173D2B] ${focus}`}>
              Continuer mes achats
            </Link>

            <div className="mt-3 border-t border-[#E8E8DF] pt-4">
              <p className="text-[11px] text-[#647168]">Modes de paiement proposés</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Image src="/payments/wave.png" alt="Wave" width={70} height={31} className="h-7 w-auto" />
                <span className="h-6 w-px bg-[#E8E8DF]" aria-hidden="true" />
                <span className="inline-flex items-center gap-2 text-xs"><Image src="/payments/orange-money.svg" alt="" width={28} height={28} />Orange Money</span>
              </div>
            </div>
          </div>

        </aside>
        <DeliveryInfo />
      </div>
    </>
  );
}

export default function CartPage() {
  const { items, ready, count } = useCart();

  const signature = JSON.stringify(
    items.map(({ id, slug }) => ({ id, slug })),
  );

  return (
    <div className="min-h-screen bg-[#F7F7F2] text-[#173D2B] [--store-header-height:129px] sm:[--store-header-height:140px] lg:[--store-header-height:83px]">
      <StoreHeader />

      <main className="mx-auto max-w-7xl px-4 pb-12 pt-4 sm:px-8 sm:pb-16 sm:pt-5">
        <Link
          href="/#catalogue"
          className={`inline-flex min-h-11 items-center gap-2 text-xs text-[#647168] hover:text-[#173D2B] ${focus}`}
        >
          <span aria-hidden="true">←</span> Retour à la boutique
        </Link>

        <div className="mb-6 mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="font-[Georgia] text-3xl tracking-tight sm:text-4xl">Mon panier</h1>
          {ready && <span aria-live="polite" className="rounded-full border border-[#E2E5D9] bg-white px-3 py-1.5 text-xs text-[#647168]">{count} article{count > 1 ? "s" : ""}</span>}
        </div>

        {!ready ? (
          <p role="status">Chargement du panier…</p>
        ) : items.length === 0 ? (
          <section className="rounded-2xl border border-[#E5E6DC] bg-white px-6 py-12 text-center sm:py-16">
            <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#EFF1E6] text-[#86682E]">
              <BagIcon className="size-7" />
            </span>

            <h2 className="mt-6 font-[Georgia] text-3xl">
              Tout commence par une envie.
            </h2>

            <p className="mx-auto mt-4 max-w-sm text-sm leading-7 text-[#647168]">
              Votre panier est vide. Découvrez notre sélection de mode,
              beauté et maison.
            </p>

            <Link
              href="/#catalogue"
              className={`mt-7 inline-flex min-h-12 items-center rounded-xl bg-[#173D2B] px-6 text-sm font-semibold text-white hover:bg-[#24573E] ${focus}`}
            >
              Découvrir la boutique →
            </Link>
          </section>
        ) : (
          <CartContents
            key={signature}
            signature={signature}
            items={items}
          />
        )}
        {ready && <CartSuggestions excludeIds={items.map((item) => item.id)} />}
      </main>
      <SiteFooter />
    </div>
  );
}
