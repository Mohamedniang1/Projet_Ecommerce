"use client";

import Image from "next/image";
import Link from "next/link";
import SiteFooter from "@/components/site-footer";
import { useEffect, useRef, useState } from "react";
import { authenticatedGet } from "@/lib/api";
import { startOrderRefresh } from "@/lib/order-refresh";
import { OrderSyncStatus } from "@/components/order-sync-status";
import { PaymentInstructions, type PaymentInstructionsData } from "@/components/payment-instructions";

type OrderItem = {
  product_id: number;
  product_name: string;
  image: string | null;
  unit_price: string;
  quantity: number;
  line_total: string;
};

type Order = {
  id: string;
  created_at: string;
  status: string;
  status_label: string;
  payment_status: string;
  payment_status_label: string;
  payment_method: string;
  payment_instructions?: PaymentInstructionsData | null;
  fulfillment: "pickup" | "delivery";
  customer_name: string;
  phone: string;
  city_label: string;
  pickup_name: string;
  pickup_address: string;
  delivery_address: string;
  customer_note: string;
  subtotal: string;
  delivery_fee: string | null;
  total: string | null;
  items: OrderItem[];
};

type OrderPage = {
  count: number;
  next: string | null;
  previous: string | null;
  results: Order[];
};

const money = (value: string | null) => value === null
  ? "À préciser"
  : `${new Intl.NumberFormat("fr-SN").format(Number(value))} FCFA`;

const date = (value: string) => new Intl.DateTimeFormat("fr-FR", {
  day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Dakar",
}).format(new Date(value));

const button = "inline-flex min-h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#173D2B]";

function ProductPhoto({ item }: { item: OrderItem }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E8EDE8] bg-[#F7F9F7] sm:h-24 sm:w-24">
      {item.image && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.image} alt={item.product_name} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-contain p-2" />
      ) : <span className="px-2 text-center text-xs text-[#647168]">Photo indisponible</span>}
    </div>
  );
}

function OrderProgress({ order }: { order: Order }) {
  if (order.status === "cancelled") {
    return (
      <div className="border-t border-[#E8EDE8] pt-4 text-sm text-[#96392D]">
        Le suivi de cette commande est arrêté.
      </div>
    );
  }

  const middleStatus = order.fulfillment === "pickup" ? "ready" : "shipped";
  const currentStep = order.status === "completed" ? 2 : order.status === middleStatus ? 1 : 0;
  const steps = [
    "Commandée le",
    order.fulfillment === "pickup" ? "Prête pour retrait" : "En cours de livraison",
    "Terminée",
  ];

  return (
    <ol aria-label="Étapes de la commande" className="grid grid-cols-3 border-t border-[#E8EDE8] pt-5">
      {steps.map((label, index) => {
        const reached = index <= currentStep;
        const done = index < currentStep || order.status === "completed";
        return (
          <li key={label} aria-current={index === currentStep ? "step" : undefined} className="relative min-w-0 text-center">
            {index < steps.length - 1 && (
              <span aria-hidden="true" className={`absolute left-1/2 top-[15px] h-0.5 w-full ${index < currentStep ? "bg-[#173D2B]" : "bg-[#E1E7E1]"}`} />
            )}
            <span aria-hidden="true" className={`relative mx-auto flex h-8 w-8 items-center justify-center rounded-full border-4 border-white text-xs font-bold ${done ? "bg-[#173D2B] text-white" : reached ? "bg-[#E3C783] text-[#173D2B] ring-1 ring-[#B79A52]" : "bg-[#E8EDE8] text-[#647168]"}`}>
              {done ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="m5 12 4 4L19 6" /></svg>
              ) : index + 1}
            </span>
            <p className={`mt-2 px-1 text-[11px] leading-4 sm:text-xs ${reached ? "font-semibold text-[#173D2B]" : "text-[#647168]"}`}>{label}</p>
            {index === 0 && <time dateTime={order.created_at} className="mt-1 block px-1 text-[11px] leading-4 text-[#647168] sm:text-xs">{date(order.created_at)}</time>}
            <span className="sr-only">{done ? "Étape accomplie" : reached ? "Étape actuelle" : "Étape à venir"}</span>
          </li>
        );
      })}
    </ol>
  );
}

function OrderCard({ order }: { order: Order }) {
  const quantity = order.items.reduce((total, item) => total + item.quantity, 0);
  return (
    <article className="overflow-hidden rounded-2xl border border-[#DEE6DF] bg-white shadow-[0_3px_16px_-10px_rgba(23,61,43,0.18)]">
      <header className="flex items-start justify-between gap-4 border-b border-[#E8EDE8] px-5 py-5 sm:px-6">
        <div className="min-w-0">
          <p className="text-xs text-[#647168]">Commande du <time dateTime={order.created_at}>{date(order.created_at)}</time></p>
          <span className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${order.status === "cancelled" ? "bg-[#FBECE8] text-[#96392D]" : order.status === "shipped" || order.status === "ready" ? "bg-[#FCF3DA] text-[#715719]" : "bg-[#EAF3EC] text-[#173D2B]"}`}>
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
            {order.status_label}
          </span>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-[#647168]">Total</p>
          <p className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">{money(order.total)}</p>
          <p className="mt-1 text-[11px] text-[#647168]">{quantity} article{quantity > 1 ? "s" : ""}</p>
        </div>
      </header>
      <div className="px-5 pt-5 sm:px-6">
        <ul className="divide-y divide-[#E8EDE8]">
          {order.items.map((item) => (
            <li key={item.product_id} className="flex items-center gap-4 py-4 first:pt-0">
              <ProductPhoto key={`${item.product_id}:${item.image}`} item={item} />
              <div className="min-w-0 flex-1">
                <h2 className="break-words text-sm font-semibold leading-6 sm:text-base">{item.product_name}</h2>
                <p className="mt-1 text-xs leading-5 text-[#647168]">Quantité : {item.quantity} · {money(item.unit_price)} / unité</p>
                <p className="mt-2 text-sm font-semibold sm:hidden">{money(item.line_total)}</p>
              </div>
              <p className="hidden shrink-0 text-sm font-semibold sm:block">{money(item.line_total)}</p>
            </li>
          ))}
        </ul>
        <div className="mb-5 mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs">
          <p className="text-[#647168]">{order.fulfillment === "pickup" ? "Retrait sur place" : "Livraison à domicile"} · {order.city_label}</p>
          <p className={order.payment_status === "paid" ? "font-medium text-[#24623E]" : "font-medium text-[#86682E]"}>Paiement : {order.payment_status_label}</p>
        </div>
        <OrderProgress order={order} />
        <details className="group mt-5 border-t border-[#E8EDE8]">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-semibold text-[#173D2B] hover:text-[#86682E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173D2B] [&::-webkit-details-marker]:hidden">
            <span>Voir les détails <span className="sr-only">de la commande {order.id}</span></span>
            <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F3F6F2] transition-transform group-open:rotate-180">↓</span>
          </summary>
          <div className="mb-5 grid gap-6 rounded-xl bg-[#F5F7F5] p-5 sm:grid-cols-2">
            <div className="min-w-0 border-b border-[#DCE5DC] pb-4 sm:col-span-2">
              <p className="text-xs font-medium text-[#647168]">Référence complète</p>
              <p className="mt-1 select-all break-all font-mono text-xs leading-5">{order.id}</p>
            </div>
            <section>
              <h3 className="font-[Georgia] text-xl">{order.fulfillment === "pickup" ? "Votre retrait" : "Votre livraison"}</h3>
              <p className="mt-4 text-sm font-semibold">{order.customer_name}</p>
              <p className="mt-1 text-sm">{order.phone}</p>
              <p className="mt-3 text-sm">{order.city_label}</p>
              {order.fulfillment === "pickup" ? <>
                <p className="mt-1 text-sm font-medium">{order.pickup_name}</p>
                <p className="mt-1 whitespace-pre-line break-words text-sm leading-6 text-[#647168]">{order.pickup_address}</p>
              </> : <p className="mt-1 whitespace-pre-line break-words text-sm leading-6 text-[#647168]">{order.delivery_address}</p>}
            </section>
            <section>
              <h3 className="font-[Georgia] text-xl">Récapitulatif</h3>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4"><dt>Produits</dt><dd>{money(order.subtotal)}</dd></div>
                <div className="flex justify-between gap-4"><dt>{order.fulfillment === "pickup" ? "Retrait" : "Livraison"}</dt><dd>{order.delivery_fee !== null && Number(order.delivery_fee) === 0 ? "Gratuit" : money(order.delivery_fee)}</dd></div>
                <div className="flex justify-between gap-4 border-t border-[#DCE5DC] pt-3 font-semibold"><dt>Total</dt><dd>{money(order.total)}</dd></div>
              </dl>
              <p className="mt-4 text-sm text-[#647168]">Mode de paiement : {order.payment_method === "wave" ? "Wave" : "Orange Money"}</p>
            </section>
            {order.payment_instructions && <div className="sm:col-span-2"><PaymentInstructions instructions={order.payment_instructions} /></div>}
            {order.customer_note && <section className="border-t border-[#DCE5DC] pt-4 sm:col-span-2">
              <h3 className="text-sm font-semibold">Vos précisions</h3>
              <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-[#647168]">{order.customer_note}</p>
            </section>}
          </div>
        </details>
      </div>
    </article>
  );
}

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<OrderPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const refreshRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const tracking = startOrderRefresh(async (signal) => {
      setRefreshing(true);
      try {
        const response = await authenticatedGet(`/api/orders/?page=${page}`, signal);
        if (signal.aborted) return false;
        if (response.status === 401 || response.status === 403) {
          setNeedsLogin(true);
          setData(null);
          setCheckedAt(null);
          setError("");
          return false;
        }
        if (!response.ok) throw new Error("Impossible de charger vos commandes.");
        const result: OrderPage = await response.json();
        if (!Array.isArray(result.results)) throw new Error("La réponse du serveur est incomplète.");
        if (!signal.aborted) {
          setData(result);
          setCheckedAt(Date.now());
          setNeedsLogin(false);
          setError("");
        }
      } catch (caught) {
        if (!signal.aborted) setError(caught instanceof Error ? caught.message : "La connexion a été interrompue.");
      } finally {
        if (!signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
      return true;
    });
    refreshRef.current = tracking.refresh;
    return () => {
      tracking.stop();
      refreshRef.current = null;
    };
  }, [page]);

  function refresh() { refreshRef.current?.(); }
  function changePage(nextPage: number) {
    setLoading(true);
    setData(null);
    setError("");
    setCheckedAt(null);
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
    <main className="min-h-screen bg-[#F5F7F5] text-[#173D2B]">
      <header className="border-b border-[#E1E7E1] bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link href="/" aria-label="KeurMayata — accueil">
            <div className="relative aspect-[4/1] w-[190px] overflow-hidden sm:w-[220px]">
              <Image src="/keurmayata-logo-original.png" alt="KeurMayata" width={1448} height={1086} priority className="absolute left-0 top-[-64%] h-auto w-full" />
            </div>
          </Link>
          <Link href="/mon-compte" className={`${button} border border-[#DCE5DC] hover:bg-[#F5F7F5]`}>← Mon compte</Link>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
        <nav aria-label="Fil d’Ariane" className="text-xs text-[#647168]">
          <Link href="/mon-compte" className="hover:underline">Mon compte</Link><span className="mx-3" aria-hidden="true">/</span><span aria-current="page">Mes commandes</span>
        </nav>
        <div className="mb-7 mt-6 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="font-[Georgia] text-3xl sm:text-4xl">Mes commandes</h1>
            <p className="mt-2 max-w-lg text-sm leading-6 text-[#647168]">Vos achats et leur suivi, au même endroit.</p>
          </div>
        </div>
        {data && !needsLogin && <div className="mb-5"><OrderSyncStatus checkedAt={checkedAt} error={error} refreshing={refreshing} onRefresh={refresh} /></div>}
        {loading ? <p role="status" className="rounded-2xl bg-white p-8">Chargement de vos commandes…</p>
          : needsLogin ? <section className="rounded-2xl border border-[#DCE5DC] bg-white p-8">
            <h2 className="font-[Georgia] text-2xl">Retrouvez vos commandes</h2>
            <p className="mt-3 text-sm text-[#647168]">Connectez-vous au compte utilisé lors de votre achat.</p>
            <Link href="/connexion?next=/mes-commandes" className={`${button} mt-6 bg-[#173D2B] text-white`}>Se connecter</Link>
          </section>
          : error && !data ? <div role="alert" className="rounded-xl bg-white p-6">
            <p className="text-[#96392D]">{error}</p>
            <button type="button" disabled={refreshing} onClick={refresh} className={`${button} mt-4 border border-[#DCE5DC] disabled:opacity-50`}>{refreshing ? "Vérification…" : "Réessayer"}</button>
          </div>
          : data && data.count === 0 ? <section className="rounded-2xl border border-[#DCE5DC] bg-white px-6 py-14 text-center">
            <h2 className="font-[Georgia] text-2xl">Votre première commande vous attend</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#647168]">Après votre achat, vous retrouverez ici vos articles et toutes les informations de votre commande.</p>
            <Link href="/#catalogue" className={`${button} mt-6 bg-[#173D2B] text-white`}>Découvrir la boutique</Link>
          </section>
          : data ? <>
            <div className="mb-4 flex items-center justify-between gap-3 text-xs text-[#647168]">
              <p>{data.count} commande{data.count > 1 ? "s" : ""}</p>
              <p>Les plus récentes en premier</p>
            </div>
            <div className="space-y-5">{data.results.map((order) => <OrderCard key={order.id} order={order} />)}</div>
            {(data.previous || data.next) && <nav aria-label="Pagination des commandes" className="mt-8 flex items-center justify-between gap-3">
              <button type="button" disabled={!data.previous} onClick={() => changePage(page - 1)} className={`${button} border border-[#DCE5DC] bg-white disabled:opacity-40`}>← Précédent</button>
              <span className="text-sm">Page {page}</span>
              <button type="button" disabled={!data.next} onClick={() => changePage(page + 1)} className={`${button} border border-[#DCE5DC] bg-white disabled:opacity-40`}>Suivant →</button>
            </nav>}
          </> : null}
      </div>
    </main>
    <SiteFooter />
    </>
  );
}
