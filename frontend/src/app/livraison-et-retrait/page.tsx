import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CartLink } from "@/components/cart-controls";
import PickupLocations from "@/components/pickup-locations";
import SiteFooter from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Livraison et retrait | KeurMayata",
  description: "Livraison gratuite à Touba et Tambacounda, 1 500 FCFA à Dakar. Retrouvez les adresses de nos points de retrait gratuits.",
};

const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F633F]";

function ReceptionIcon({ pickup = false }: { pickup?: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="size-7">{pickup ? <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></> : <><path d="M3 4h11v13H3zM14 9h4l3 4v4h-7" /><circle cx="6.5" cy="18" r="2" /><circle cx="17.5" cy="18" r="2" /></>}</svg>;
}

export default function DeliveryPage() {
  return (
    <div className="min-h-screen bg-[#F6F8F4] text-[#173D2B]">
      <header className="border-b border-[#E1E7DD] bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link href="/" aria-label="KeurMayata — accueil" className={`relative block aspect-[4/1] w-[190px] overflow-hidden sm:w-[220px] ${focus}`}><Image src="/keurmayata-logo-original.png" alt="KeurMayata" width={1448} height={1086} preload className="absolute left-0 top-[-64%] h-auto w-full" /></Link>
          <nav aria-label="Boutique et panier" className="flex flex-wrap items-center gap-3"><Link href="/#catalogue" className={`inline-flex min-h-11 items-center px-2 text-sm hover:underline ${focus}`}>← La boutique</Link><CartLink /></nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-12 pt-7 sm:px-8 sm:pt-10">
        <nav aria-label="Fil d’Ariane" className="mb-7 text-xs text-[#647168]"><Link href="/" className="hover:underline">Accueil</Link><span aria-hidden="true" className="mx-3">/</span><span aria-current="page">Livraison et retrait</span></nav>

        <section className="overflow-hidden rounded-2xl bg-[#173D2B] px-7 py-9 text-white sm:px-10 sm:py-12">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#E3C783]">Vos envies, à votre rythme</p>
          <h1 className="mt-4 max-w-2xl font-[Georgia] text-4xl leading-tight sm:text-5xl">Chez vous.<br /><span className="italic text-[#E3C783]">Ou près de chez vous.</span></h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-[#DFE8DF]">Faites-vous livrer ou récupérez votre sélection dans un point de retrait. Choisissez ce qui vous convient au moment de commander.</p>
          <a href="#points-de-retrait" className={`mt-6 inline-flex min-h-11 items-center gap-6 rounded-lg bg-[#E3C783] px-5 text-sm font-semibold text-[#173D2B] hover:bg-[#EED69D] ${focus}`}>Trouver mon point de retrait <span aria-hidden="true">↓</span></a>
        </section>

        <section aria-labelledby="reception-title" className="mt-9 sm:mt-12">
          <h2 id="reception-title" className="font-[Georgia] text-2xl sm:text-3xl">Deux façons de recevoir votre commande</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <article className="rounded-2xl border border-[#DBE4D9] bg-white p-6 sm:p-8">
              <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-[#F3EFDF] text-[#86682E]"><ReceptionIcon /></div>
              <h3 className="font-[Georgia] text-2xl">À votre adresse</h3><p className="mt-2 text-sm leading-6 text-[#647168]">Renseignez votre adresse et un repère pour faciliter la livraison.</p>
              <dl className="mt-6 divide-y divide-[#E7ECE4] text-sm">
                {[{ city: "Dakar", price: "1 500 FCFA" }, { city: "Touba", price: "Gratuit" }, { city: "Tambacounda", price: "Gratuit" }].map((item) => <div key={item.city} className="flex flex-wrap items-center justify-between gap-3 py-4"><dt>{item.city}</dt><dd className={`font-semibold ${item.price === "Gratuit" ? "text-[#386548]" : ""}`}>{item.price}</dd></div>)}
              </dl>
              <p className="mt-3 text-xs leading-6 text-[#647168]">Les frais sont inclus dans le total affiché avant la confirmation de votre commande.</p>
            </article>
            <article className="flex flex-col rounded-2xl border border-[#DBE4D9] bg-white p-6 sm:p-8">
              <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-[#F3EFDF] text-[#86682E]"><ReceptionIcon pickup /></div>
              <h3 className="font-[Georgia] text-2xl">Dans un point de retrait</h3><p className="mt-2 text-sm leading-6 text-[#647168]">Choisissez votre ville et le point qui vous convient.</p>
              <p className="my-6 font-[Georgia] text-4xl">Toujours gratuit<span className="mt-2 block font-sans text-xs text-[#647168]">Aucun frais de retrait.</span></p>
              <p className="text-sm leading-7 text-[#58665C]">Retrouvez la disponibilité de votre commande dans « Mes commandes ». Le statut « Prête pour retrait » vous indique quand venir la récupérer.</p>
              <Link href="/mes-commandes" className={`mt-auto inline-flex min-h-11 items-center gap-4 self-start pt-5 text-sm font-semibold underline-offset-4 hover:underline ${focus}`}>Suivre ma commande <span aria-hidden="true">→</span></Link>
            </article>
          </div>
        </section>

        <section id="points-de-retrait" aria-labelledby="pickup-title" className="mt-10 scroll-mt-6 sm:mt-12">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#86682E]">On se retrouve ici</p><h2 id="pickup-title" className="mt-3 font-[Georgia] text-3xl">Nos points de retrait</h2><p className="mb-6 mt-3 text-sm leading-6 text-[#647168]">Choisissez une ville pour consulter les adresses et les coordonnées.</p>
          <PickupLocations />
        </section>

        <section id="questions-frequentes" aria-labelledby="questions-title" className="mt-10 scroll-mt-6 sm:mt-12">
          <h2 id="questions-title" className="mb-5 font-[Georgia] text-2xl">Quelques repères avant de commander</h2>
          <div className="divide-y divide-[#E1E7DD] rounded-2xl border border-[#DBE4D9] bg-white px-6 sm:px-8">
            {[
              { question: "Livrez-vous dans d’autres villes ?", answer: "Pour le moment, la livraison est proposée à Dakar, Touba et Tambacounda. Ces trois villes sont disponibles dans le formulaire de commande." },
              { question: "Comment retrouver le suivi de ma commande ?", answer: "Connectez-vous, puis ouvrez « Mes commandes ». Vous y retrouverez vos articles, le paiement et les étapes de livraison ou de retrait." },
              { question: "Dois-je saisir mon adresse à chaque fois ?", answer: "Vous pouvez enregistrer vos adresses dans « Mon compte → Mes adresses », puis en choisir une lors de votre prochaine livraison." },
            ].map((item) => <details key={item.question} className="py-2"><summary className={`cursor-pointer py-4 text-sm font-medium marker:text-[#86682E] ${focus}`}>{item.question}</summary><p className="max-w-2xl pb-5 text-sm leading-7 text-[#647168]">{item.answer}</p></details>)}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
