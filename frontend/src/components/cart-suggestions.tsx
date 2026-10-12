"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { money, type CartProduct } from "@/lib/cart";

type Suggestion = CartProduct & { in_stock: boolean };
const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F633F]";

function SuggestionCard({ product }: { product: Suggestion }) {
  const [failed, setFailed] = useState(false);

  return (
    <Link href={`/produits/${encodeURIComponent(product.slug)}`} aria-label={`Découvrir ${product.name}`} className={`group flex min-w-0 flex-col rounded-2xl border border-[#E5E6DC] bg-white p-3 transition-colors hover:border-[#AABAA5] ${focus}`}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#F5F4EE]">
        {product.image && !failed ? <Image src={product.image} alt="" fill unoptimized sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 280px" onError={() => setFailed(true)} className="object-contain p-4 motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-105" /> : <div className="flex h-full items-center justify-center p-4 text-center text-xs text-[#647168]">Photo à venir</div>}
      </div>
      <div className="flex flex-1 flex-col px-1 pb-1 pt-4">
        <p className="text-[9px] uppercase tracking-[0.14em] text-[#87682F]">{product.category.name}</p>
        <h3 title={product.name} className="mb-4 mt-2 line-clamp-2 min-h-10 break-words text-sm font-normal leading-5">{product.name}</h3>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold sm:text-base">{money(Number(product.price))}</p><span aria-hidden="true" className="text-lg">→</span></div>
      </div>
    </Link>
  );
}

export default function CartSuggestions({ excludeIds }: { excludeIds: number[] }) {
  const [products, setProducts] = useState<Suggestion[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/catalog/products/?ordering=-created_at", {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
        });
        if (!response.ok) return;
        const data: { results?: Suggestion[] } = await response.json();
        if (!controller.signal.aborted && Array.isArray(data.results)) setProducts(data.results);
      } catch {
        // Suggestions are optional: a failed request must not block the cart.
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  const suggestions = products.filter((product) => product.in_stock && !excludeIds.includes(product.id)).slice(0, 4);
  if (!suggestions.length) return null;

  return (
    <section aria-labelledby="cart-suggestions-title" className="mt-10 sm:mt-12">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 id="cart-suggestions-title" className="font-[Georgia] text-2xl tracking-tight">À découvrir aussi</h2>
        <Link href="/#catalogue" className={`inline-flex min-h-11 items-center gap-3 text-xs underline underline-offset-4 ${focus}`}>Toute la sélection <span aria-hidden="true">→</span></Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
        {suggestions.map((product) => <SuggestionCard key={`${product.id}-${product.image}`} product={product} />)}
      </div>
    </section>
  );
}
