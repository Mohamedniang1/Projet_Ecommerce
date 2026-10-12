import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F633F]";

export function Arrow({ className = "size-5" }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M4 12h15m-6-6 6 6-6 6" /></svg>;
}

export function HomeHero() {
  return (
    <section aria-labelledby="welcome-title" className="bg-[#F8F5EE]">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 pb-10 pt-8 sm:gap-12 sm:px-8 sm:py-12 lg:grid-cols-[1fr_1fr] lg:gap-16 lg:py-14">
        <div>
          <h1 id="welcome-title" className="font-[Georgia] text-[46px] leading-[1.07] tracking-[-0.045em] text-[#173D2B] sm:text-[62px] lg:text-[76px]">
            Vos envies.<br />Votre style.<br /><span className="italic text-[#7C6339]">Tout simplement.</span>
          </h1>
          <p className="mt-6 max-w-sm text-sm leading-7 text-[#5D685E] sm:text-base sm:leading-7">
            Une touche de beauté, une envie de mode, un détail pour la maison. Trouvez ce qui vous ressemble.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-3 sm:mt-8 sm:gap-x-6">
            <a href="#catalogue" className={`inline-flex min-h-13 items-center justify-center gap-3 rounded-full bg-[#173D2B] px-5 py-3 text-xs font-semibold text-white transition-colors hover:bg-[#28563C] sm:gap-5 sm:px-6 sm:text-sm ${focus}`}>
              <span className="sm:hidden">Voir la sélection</span><span className="hidden sm:inline">Découvrir la sélection</span> <Arrow className="size-4" />
            </a>
            <a href="#univers" className={`inline-flex min-h-11 items-center text-xs underline decoration-[#B8BDAE] underline-offset-6 hover:decoration-[#173D2B] sm:text-sm ${focus}`}><span className="sm:hidden">Nos univers</span><span className="hidden sm:inline">Explorer nos univers</span></a>
          </div>
          <div className="mt-8 hidden items-start gap-3 border-t border-[#DFDFD2] pt-5 sm:flex lg:mt-10">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mt-0.5 size-5 shrink-0 text-[#87682F]"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>
            <p className="text-xs leading-5 text-[#5D685E]"><span className="font-medium text-[#173D2B]">Tout près de vous.</span><br />Livraison et retrait à Dakar, Touba et Tambacounda.</p>
          </div>
        </div>

        <div className="relative pb-6 pl-3 sm:pl-6">
          <div className="relative aspect-[5/4] overflow-hidden rounded-[90px_16px_16px_16px] bg-[#173D2B] sm:aspect-[5/4] lg:aspect-[0.92] lg:rounded-tl-[150px]">
            <Image src="/keurmayata-boutique-connexion.png" alt="Une femme en tenue de lin choisit ses essentiels dans une boutique chaleureuse." fill preload sizes="(min-width: 1280px) 576px, (min-width: 1024px) 45vw, 100vw" className="object-cover object-top lg:object-[center_20%]" />
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#102D20]/35 via-transparent to-transparent" />
          </div>
          <a href="#catalogue" className={`absolute bottom-0 left-0 right-6 flex items-center justify-between gap-4 rounded-xl border border-[#E5E2D7] bg-[#FFFEFA] px-5 py-4 shadow-[0_12px_32px_-18px_rgba(23,61,43,0.28)] sm:right-10 sm:px-7 sm:py-5 ${focus}`}>
            <span><span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.18em] text-[#87682F]">Des envies à découvrir</span><span className="font-[Georgia] text-xl tracking-tight sm:text-2xl">Le style qui vous ressemble.</span></span>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#E8CE8F] text-[#173D2B]"><Arrow /></span>
          </a>
        </div>
      </div>
    </section>
  );
}

const universes: Record<string, { description: string; color: string; icon: ReactNode }> = {
  mode: {
    description: "Votre style, à votre façon",
    color: "#EFE5D9",
    icon: <><path d="m17 12 8-5 7 5 7-5 8 5-6 10-5-3v26H21V19l-5 3-6-10 7-4" /><path d="M25 7c0 8 14 8 14 0" /><path d="M24 39h9" /></>,
  },
  beaute: {
    description: "Un moment rien qu’à vous",
    color: "#F2E4DF",
    icon: <><rect x="12" y="21" width="22" height="27" rx="4" /><path d="M18 21v-6h10v6M23 15V9h16v5M17 33h12" /><rect x="40" y="30" width="11" height="18" rx="2" /><path d="M42 30V20h7v10" /></>,
  },
  maison: {
    description: "Du beau dans votre quotidien",
    color: "#E6EBDD",
    icon: <><path d="M11 36V25a5 5 0 0 1 5-5h27a5 5 0 0 1 5 5v11M7 31h9v10h27V31h9v15H7zM12 46v5m35-5v5M29 21v19" /><path d="M40 11h11l3 7H37l3-7Zm5-6v6" /></>,
  },
  accessoires: {
    description: "Le détail qui change tout",
    color: "#ECE6D5",
    icon: <><path d="M15 22h31l4 27H11l4-27ZM23 25V14a8 8 0 0 1 16 0v11" /><path d="M16 37c8 5 21 5 29 0M28 35h6v7h-6z" /></>,
  },
};

export function HomeUniverses({ categories, onSelect }: {
  categories: { id: number; name: string; slug: string }[];
  onSelect: (slug: string) => void;
}) {
  if (!categories.length) return null;
  const sorted = [...categories].sort((a, b) => {
    const order = ["mode", "beaute", "maison", "accessoires"];
    const rank = (slug: string) => order.includes(slug) ? order.indexOf(slug) : order.length;
    return rank(a.slug) - rank(b.slug);
  });
  return (
    <section id="univers" aria-labelledby="universes-title" className="mx-auto max-w-7xl scroll-mt-[calc(var(--store-header-height)+1rem)] px-5 py-12 sm:px-8 sm:py-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#87682F]">Suivez vos envies</p><h2 id="universes-title" className="mt-3 font-[Georgia] text-3xl tracking-tight sm:text-4xl">À chacun son univers.</h2></div>
        <p className="max-w-xs text-sm leading-6 text-[#657065]">De vous à votre intérieur,<br className="hidden sm:block" /> des idées pour chaque jour.</p>
      </div>
      <div className="mt-7 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {sorted.map((category, index) => {
          const universe = universes[category.slug];
          return (
            <button key={category.id} type="button" aria-label={`Explorer l’univers ${category.name}`} onClick={() => onSelect(category.slug)} style={{ backgroundColor: universe?.color ?? "#E6EBDD" }} className={`group flex min-w-0 flex-col rounded-xl p-4 text-left text-[#173D2B] motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-1 sm:p-6 ${focus}`}>
              <span className="flex h-18 w-full items-start justify-between gap-2 sm:h-22"><span aria-hidden="true" className="font-[Georgia] text-xs text-[#747761]">{String(index + 1).padStart(2, "0")}</span><svg aria-hidden="true" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className="size-16 shrink-0 text-[#53664F] motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:rotate-6 sm:size-20">{universe?.icon ?? <path d="M12 22 32 12l20 10-20 10-20-10Zm0 0v24l20 10 20-10V22M32 32v24" />}</svg></span>
              <span className="mt-3 flex w-full items-center justify-between gap-2"><span className="min-w-0 break-words font-[Georgia] text-xl tracking-tight sm:text-2xl">{category.name}</span><Arrow className="size-4 shrink-0 motion-safe:transition-transform motion-safe:group-hover:translate-x-1" /></span>
              <span className="mt-2 text-[11px] leading-5 text-[#526052] sm:text-xs">{universe?.description ?? "Découvrez la sélection"}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function HomeVisit() {
  return (
    <section aria-labelledby="home-visit-title" className="mx-auto max-w-7xl px-5 pb-14 sm:px-8 sm:pb-18">
      <div className="flex flex-col items-start justify-between gap-6 border-y border-[#DEDCCF] py-8 sm:flex-row sm:items-center sm:py-10">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#87682F]">En ligne, et tout près de vous</p><h2 id="home-visit-title" className="mt-3 font-[Georgia] text-2xl tracking-tight sm:text-3xl">Vos envies, à votre rythme.</h2><p className="mt-3 max-w-lg text-sm leading-6 text-[#657065]">Faites-vous livrer ou retrouvez-nous dans nos points de retrait à Dakar, Touba et Tambacounda.</p></div>
        <Link href="/livraison-et-retrait" className={`inline-flex min-h-12 shrink-0 items-center gap-5 rounded-full border border-[#B8C3B2] px-5 py-3 text-sm font-medium transition-colors hover:bg-[#EAF0E5] ${focus}`}>Livraison & retrait <Arrow className="size-4" /></Link>
      </div>
    </section>
  );
}
