import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import StoreHeader from "@/components/store-header";
import SiteFooter from "@/components/site-footer";

export const metadata: Metadata = {
  title: "À propos de KeurMayata",
  description: "Découvrez KeurMayata, votre boutique de mode, beauté, maison et accessoires. Retrouvez-nous à Dakar, Touba et Tambacounda.",
};

const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#87682F]";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#FAF9F4] text-[#173D2B] [--store-header-height:129px] sm:[--store-header-height:140px] lg:[--store-header-height:83px]">
      <StoreHeader />
      <main className="mx-auto max-w-7xl px-4 pb-14 pt-6 sm:px-8 sm:pb-20">
        <nav aria-label="Fil d’Ariane" className="mb-6 flex items-center gap-3 text-xs text-[#647168]">
          <Link href="/" className={`inline-flex min-h-11 items-center hover:underline ${focus}`}>Accueil</Link><span aria-hidden="true">/</span><span aria-current="page">À propos</span>
        </nav>

        <section className="grid overflow-hidden rounded-3xl bg-[#173D2B] text-white md:grid-cols-[1.1fr_1fr]">
          <div className="px-6 py-10 sm:p-10 lg:p-14">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#E3C783]">À propos de KeurMayata</p>
            <h1 className="mt-5 font-[Georgia] text-4xl leading-[1.15] tracking-tight sm:text-5xl">Le style qui<br /><span className="italic text-[#E3C783]">vous ressemble.</span></h1>
            <p className="mt-6 max-w-lg text-sm leading-7 text-[#DCE6DC]">KeurMayata réunit une sélection d’articles de mode, de beauté, de maison et d’accessoires. Des envies à découvrir, des essentiels à retrouver, des petits détails pour votre quotidien.</p>
            <Link href="/#catalogue" className={`mt-7 inline-flex min-h-12 items-center gap-5 rounded-xl bg-[#E3C783] px-5 text-sm font-medium text-[#173D2B] hover:bg-[#EDD6A3] ${focus}`}>Découvrir la boutique <span aria-hidden="true">→</span></Link>
          </div>
          <div className="relative min-h-64 md:min-h-full">
            <Image src="/keurmayata-boutique-connexion.png" alt="L’univers KeurMayata : une cliente dans une boutique de beauté." fill preload sizes="(min-width: 768px) 50vw, 100vw" className="object-cover object-[center_20%]" />
          </div>
        </section>

        <section className="mt-10 grid gap-6 rounded-2xl border border-[#E4E6DA] bg-white p-6 sm:p-9 md:grid-cols-2 md:gap-12">
          <div><p className="text-[10px] uppercase tracking-[0.18em] text-[#87682F]">Une boutique, proche de vous</p><h2 className="mt-3 font-[Georgia] text-3xl leading-tight">À Dakar, Touba<br />et Tambacounda.</h2></div>
          <div><p className="text-sm leading-7 text-[#647168]">Choisissez la livraison à votre adresse ou le retrait gratuit dans l’un de nos points de retrait. Votre espace personnel vous permet de retrouver vos commandes, vos favoris et vos adresses.</p><Link href="/livraison-et-retrait" className={`mt-4 inline-flex min-h-11 items-center gap-4 text-sm underline underline-offset-4 ${focus}`}>Voir les tarifs et les points de retrait <span aria-hidden="true">→</span></Link></div>
        </section>

        <section id="contact" aria-labelledby="contact-title" className="mt-10 scroll-mt-[calc(var(--store-header-height)+2rem)]">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#87682F]">Restons en contact</p>
          <h2 id="contact-title" className="mt-3 font-[Georgia] text-3xl">Une question ? Parlons-en.</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <a href="tel:+33672150549" className={`rounded-2xl border border-[#E4E6DA] bg-white p-6 transition-colors hover:border-[#A3B49F] ${focus}`}><span className="block text-xs text-[#647168]">Par téléphone</span><span className="mt-3 block text-lg">+33 6 72 15 05 49 <span aria-hidden="true">↗</span></span></a>
            <a href="mailto:mohamedniang0606@gmail.com" className={`min-w-0 rounded-2xl border border-[#E4E6DA] bg-white p-6 transition-colors hover:border-[#A3B49F] ${focus}`}><span className="block text-xs text-[#647168]">Par e-mail</span><span className="mt-3 block break-words text-base sm:text-lg">mohamedniang0606@gmail.com <span aria-hidden="true">↗</span></span></a>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
            <p className="mr-2 text-xs text-[#647168]">Retrouvez-nous aussi sur</p>
            <a href="https://www.instagram.com/mohamedniang03/" target="_blank" rel="noopener noreferrer" aria-label="Instagram : mohamedniang03 (nouvel onglet)" className={`inline-flex min-h-11 items-center gap-4 rounded-full border border-[#DCE2D5] px-5 hover:bg-[#EEF1E6] ${focus}`}>Instagram <span aria-hidden="true">↗</span></a>
            <a href="https://www.tiktok.com/@mniang188" target="_blank" rel="noopener noreferrer" aria-label="TikTok : @mniang188 (nouvel onglet)" className={`inline-flex min-h-11 items-center gap-4 rounded-full border border-[#DCE2D5] px-5 hover:bg-[#EEF1E6] ${focus}`}>TikTok <span aria-hidden="true">↗</span></a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
