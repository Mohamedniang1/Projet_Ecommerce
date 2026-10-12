"use client";

import Image from "next/image";
import Link from "next/link";
import SiteFooter from "@/components/site-footer";
import { useState } from "react";
import { CartLink } from "@/components/cart-controls";
import { FavoriteButton, FavoritesProvider, Heart, useFavorites } from "@/components/favorites";
import { money } from "@/lib/cart";
import type { FavoriteItem } from "@/lib/favorites";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F633F]";
const action = `inline-flex min-h-11 items-center justify-center gap-3 rounded-lg px-5 text-sm font-semibold transition ${focus}`;

function FavoriteCard({ item }: { item: FavoriteItem }) {
  const [failedImage, setFailedImage] = useState(false);
  const product = item.product;
  const photo = product?.image && !failedImage ? <Image src={product.image} alt={product.image_alt || product.name} fill unoptimized sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-contain p-4 motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-[1.03]" onError={() => setFailedImage(true)} /> : <div className="flex h-full flex-col items-center justify-center gap-3 px-5 text-center text-xs text-[#7C877D]"><Heart className="size-8 text-[#A5B5A5]" />{product ? "Photo à venir" : "Article indisponible"}</div>;

  return (
    <article aria-label={product?.name ?? "Article indisponible"} className="group flex min-w-0 flex-col rounded-2xl border border-[#E0E7DF] bg-white">
      <div className="relative p-3">
        {product ? <Link href={`/produits/${product.slug}`} aria-label={`Découvrir ${product.name}`} className={`relative block aspect-[5/4] overflow-hidden rounded-xl bg-[#F3F6F1] ${focus}`}>{photo}</Link> : <div className="relative aspect-[5/4] overflow-hidden rounded-xl bg-[#F3F6F1]">{photo}</div>}
        <div className="absolute right-5 top-5"><FavoriteButton productId={item.product_id} name={product?.name ?? `l’article indisponible n°${item.product_id}`} compact /></div>
      </div>
      <div className="flex flex-1 flex-col px-5 pb-5 pt-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#86682E]">{product?.category ?? "Votre sélection"}</p>
        <h2 className="mt-2 break-words font-[Georgia] text-xl leading-7">{product ? <Link href={`/produits/${product.slug}`} className={`hover:underline ${focus}`}>{product.name}</Link> : "Ce produit a quitté le catalogue"}</h2>
        {product ? <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{money(Number(product.price))}</p><p className={`rounded-full px-2.5 py-1 text-[11px] ${product.in_stock ? "bg-[#EDF5EE] text-[#386548]" : "bg-[#F4F0E7] text-[#796035]"}`}>{product.in_stock ? "En stock" : "Épuisé pour le moment"}</p></div>
          <Link href={`/produits/${product.slug}`} className={`${action} mt-5 border border-[#DCE5DC] text-sm hover:border-[#173D2B] hover:bg-[#F0F5EE]`}>Voir le produit <span aria-hidden="true">→</span></Link>
        </> : <p className="mt-3 text-sm leading-6 text-[#647168]">Vous pouvez le retirer de vos favoris avec le cœur ci-dessus.</p>}
      </div>
    </article>
  );
}

function FavoritesContent() {
  const { status, book, refresh } = useFavorites();
  const items = book?.results ?? [];
  const [stockOnly, setStockOnly] = useState(false);
  const visible = stockOnly ? items.filter((item) => item.product?.in_stock) : items;

  return (
    <>
    <main className="min-h-screen bg-[#F5F7F5] text-[#173D2B]">
      <header className="border-b border-[#E1E7E1] bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link href="/" aria-label="KeurMayata — accueil" className={`relative block aspect-[4/1] w-[190px] overflow-hidden sm:w-[220px] ${focus}`}><Image src="/keurmayata-logo-original.png" alt="KeurMayata" width={1448} height={1086} preload className="absolute left-0 top-[-64%] h-auto w-full" /></Link>
          <nav aria-label="Compte et panier" className="flex flex-wrap items-center gap-3"><Link href="/mon-compte" className={`inline-flex min-h-11 items-center px-2 text-xs hover:underline sm:text-sm ${focus}`}>← Mon compte</Link><CartLink /></nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        <nav aria-label="Fil d’Ariane" className="text-xs text-[#647168]"><Link href="/mon-compte" className="hover:underline">Mon compte</Link><span aria-hidden="true" className="mx-3">/</span><span aria-current="page">Mes favoris</span></nav>
        <div className="my-8 flex flex-wrap items-end justify-between gap-5">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#86682E]">Un peu, beaucoup, à la folie</p><h1 className="mt-3 font-[Georgia] text-4xl sm:text-5xl">Mes favoris</h1><p className="mt-3 max-w-lg text-sm leading-6 text-[#647168]">Ces petits coups de cœur que l’on aime retrouver.</p></div>
          <Link href="/#catalogue" className={`${action} border border-[#D3DFD4] bg-white hover:bg-[#EDF3ED]`}>Continuer à découvrir <span aria-hidden="true">↗</span></Link>
        </div>

        {status === "loading" ? <p role="status" className="rounded-2xl bg-white p-8 text-sm">Chargement de vos coups de cœur…</p>
          : status === "guest" ? <section className="rounded-2xl border border-[#DCE5DC] bg-white px-6 py-12 text-center"><Heart className="mx-auto size-10 text-[#A17D35]" /><h2 className="mt-5 font-[Georgia] text-2xl">Gardez vos envies à portée de main</h2><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#647168]">Connectez-vous pour enregistrer vos produits préférés et les retrouver sur tous vos appareils.</p><Link href="/connexion?next=/mes-favoris" className={`${action} mt-6 bg-[#173D2B] text-white hover:bg-[#24573E]`}>Se connecter</Link></section>
          : status === "error" ? <section role="alert" className="rounded-2xl border border-[#DCE5DC] bg-white p-6"><p className="text-sm leading-6 text-[#96392D]">Nous n’avons pas pu actualiser vos favoris. Rechargez la liste pour vérifier vos articles enregistrés.</p><button type="button" onClick={() => void refresh()} className={`${action} mt-4 border border-[#DCE5DC]`}>Réessayer</button></section>
          : !items.length ? <section className="rounded-2xl border border-dashed border-[#CBD9CA] bg-white px-6 py-14 text-center"><div className="mx-auto flex size-20 items-center justify-center rounded-full bg-[#F7EFD8]"><Heart className="size-9 text-[#947130]" /></div><h2 className="mt-6 font-[Georgia] text-2xl sm:text-3xl">Votre prochain coup de cœur vous attend</h2><p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[#647168]">Un produit vous plaît ? Touchez son cœur pour le garder ici et le retrouver plus tard.</p><Link href="/#catalogue" className={`${action} mt-6 bg-[#173D2B] text-white hover:bg-[#24573E]`}>Découvrir la sélection <span aria-hidden="true">→</span></Link></section>
          : <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-y border-[#DDE5DB] py-4"><p className="text-sm"><span className="font-semibold">{items.length}</span> article{items.length > 1 ? "s" : ""} enregistré{items.length > 1 ? "s" : ""}</p><label className="flex min-h-11 cursor-pointer items-center gap-3 text-xs sm:text-sm"><input type="checkbox" checked={stockOnly} onChange={(event) => setStockOnly(event.target.checked)} className="size-4 accent-[#173D2B]" />Uniquement en stock</label></div>
            {visible.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{visible.map((item) => <FavoriteCard key={item.product_id} item={item} />)}</div> : <section className="rounded-2xl border border-[#E0E7DF] bg-white p-8 text-center"><p className="text-sm leading-6">Vos favoris ne sont pas en stock pour le moment.</p><button type="button" onClick={() => setStockOnly(false)} className={`${action} mt-4 border border-[#DCE5DC]`}>Voir tous mes favoris</button></section>}
            <p className="mt-7 text-xs leading-6 text-[#647168]">Les prix et disponibilités sont actualisés lorsque vous consultez vos favoris. Les articles ne sont pas réservés.</p>
          </>}
      </div>
    </main>
    <SiteFooter />
    </>
  );
}

export default function FavoritesPage() {
  return <FavoritesProvider><FavoritesContent /></FavoritesProvider>;
}
