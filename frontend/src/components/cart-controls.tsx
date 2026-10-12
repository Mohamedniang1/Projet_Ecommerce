"use client";

import Link from "next/link";
import { useState } from "react";
import {
  addToCart,
  fetchCartProduct,
  MAX_QUANTITY,
  useCart,
} from "@/lib/cart";

export function CartLink({ compactOnMobile = false }: { compactOnMobile?: boolean }) {
  const { count, ready } = useCart();

  return (
    <Link
      href="/panier"
      title="Mon panier"
      aria-label={`Mon panier, ${ready ? count : 0} article(s)`}
      className={`relative inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-[#D6DFD5] text-xs font-medium text-[#173D2B] transition-colors hover:bg-[#F3F6F0] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F633F] sm:text-sm ${compactOnMobile ? "w-11 md:w-auto md:gap-2 md:px-4" : "gap-2 px-4"}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        className="h-5 w-5"
      >
        <path d="M5 7h14l1 14H4L5 7Z" />
        <path d="M8 8V6a4 4 0 0 1 8 0v2" />
      </svg>

      <span className={compactOnMobile ? "sr-only md:not-sr-only" : undefined}>Panier</span>

      <span className={`flex items-center justify-center rounded-full bg-[#173D2B] text-[10px] text-white ${compactOnMobile ? "absolute -right-1 -top-1 min-w-5 px-1 py-0.5 ring-2 ring-white md:static md:min-w-6 md:px-1.5 md:py-1 md:ring-0" : "min-w-6 px-1.5 py-1"}`}>
        {ready ? count : 0}
      </span>
    </Link>
  );
}

export function AddToCartButton({
  product,
}: {
  product: {
    id: number;
    slug: string;
    in_stock: boolean;
  };
}) {
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleAdd() {
    setBusy(true);
    setMessage("");
    setSuccess(false);

    try {
      const current = await fetchCartProduct(product.slug);

      if (!current || current.id !== product.id) {
        throw new Error("Ce produit n’est plus disponible.");
      }

      addToCart(current, quantity);

      setSuccess(true);
      setMessage(
        quantity > 1
          ? `${quantity} articles ajoutés à votre panier.`
          : "Article ajouté à votre panier.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Impossible d’ajouter ce produit.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <p className="mb-3 text-xs font-medium text-[#58665C]">
        Quantité
      </p>

      <div className="flex flex-wrap gap-3">
        <div
          role="group"
          aria-label="Quantité à ajouter"
          className="flex h-14 items-center rounded-full border border-[#D6DFD5] bg-[#F8F9F4]"
        >
          <button
            type="button"
            aria-label="Diminuer la quantité"
            disabled={busy || quantity <= 1 || !product.in_stock}
            onClick={() => setQuantity((value) => value - 1)}
            className="h-full w-11 rounded-l-full text-xl hover:bg-[#E8EEE2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F633F] disabled:opacity-30"
          >
            −
          </button>

          <span
            aria-live="polite"
            className="w-9 text-center text-sm font-semibold"
          >
            {quantity}
          </span>

          <button
            type="button"
            aria-label="Augmenter la quantité"
            disabled={
              busy || quantity >= MAX_QUANTITY || !product.in_stock
            }
            onClick={() => setQuantity((value) => value + 1)}
            className="h-full w-11 rounded-r-full text-xl hover:bg-[#E8EEE2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F633F] disabled:opacity-30"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={busy || !product.in_stock}
          className="flex min-h-14 min-w-[180px] flex-1 items-center justify-center gap-3 rounded-full bg-[#173D2B] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#24573E] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F633F] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-5 shrink-0"><path d="M5 7h14l1 14H4L5 7ZM8 8V6a4 4 0 0 1 8 0v2" /></svg>
          {busy
            ? "Ajout en cours…"
            : product.in_stock
              ? "Ajouter au panier"
              : "Rupture de stock"}
        </button>
      </div>

      <div role="status" aria-live="polite" aria-atomic="true">
        {message && (
          <div
            className={`mt-4 rounded-lg px-4 py-3 text-sm leading-6 ${
              success
                ? "bg-[#EDF5EE] text-[#285B3B]"
                : "bg-[#FFF0EE] text-[#96392D]"
            }`}
          >
            <p>{message}</p>

            {success && (
              <Link
                href="/panier"
                className="mt-2 inline-block font-semibold underline underline-offset-4"
              >
                Voir mon panier →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
