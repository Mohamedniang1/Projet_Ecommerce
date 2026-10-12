import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E3C783]";
const sections = [
  {
    title: "La boutique",
    links: [
      { label: "Toute la sélection", href: "/#catalogue" },
      { label: "Mode", href: "/?category=mode#catalogue" },
      { label: "Beauté", href: "/?category=beaute#catalogue" },
      { label: "Maison", href: "/?category=maison#catalogue" },
      { label: "Accessoires", href: "/?category=accessoires#catalogue" },
    ],
  },
  {
    title: "Votre espace",
    links: [
      { label: "Mon compte", href: "/mon-compte" },
      { label: "Suivre mes commandes", href: "/mes-commandes" },
      { label: "Mes favoris", href: "/mes-favoris" },
      { label: "Mes adresses", href: "/mes-adresses" },
      { label: "Mon panier", href: "/panier" },
    ],
  },
  {
    title: "Informations pratiques",
    links: [
      { label: "À propos de KeurMayata", href: "/a-propos" },
      { label: "Livraison et tarifs", href: "/livraison-et-retrait" },
      { label: "Nos points de retrait", href: "/livraison-et-retrait#points-de-retrait" },
      { label: "Questions fréquentes", href: "/livraison-et-retrait#questions-frequentes" },
    ],
  },
];

function ServiceIcon({ children }: { children: ReactNode }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-6 shrink-0">{children}</svg>;
}

export default function SiteFooter() {
  return (
    <footer aria-label="Pied de page KeurMayata" className="bg-[#173D2B] text-[#F6F7F1]">
      <div className="border-y border-[#DDE5D9] bg-[#F1F5EE] text-[#173D2B]">
        <div className="mx-auto grid max-w-7xl divide-y divide-[#D8E2D3] px-5 md:grid-cols-3 md:divide-x md:divide-y-0 md:py-7 sm:px-8">
          <Link href="/livraison-et-retrait" className="group flex items-center gap-4 py-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#173D2B] md:py-1 md:pr-6">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-[#D8DECD] text-[#86682E]"><ServiceIcon><path d="M3 4h11v13H3zM14 9h4l3 4v4h-7" /><circle cx="6.5" cy="18" r="2" /><circle cx="17.5" cy="18" r="2" /></ServiceIcon></span>
            <span><span className="block text-sm font-semibold group-hover:underline">Livraison à votre adresse</span><span className="mt-1 block text-xs leading-5 text-[#58665C]">Dakar : 1 500 FCFA<br />Touba et Tambacounda : gratuit</span></span>
          </Link>
          <Link href="/livraison-et-retrait#points-de-retrait" className="group flex items-center gap-4 py-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#173D2B] md:px-6 md:py-1">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-[#D8DECD] text-[#86682E]"><ServiceIcon><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></ServiceIcon></span>
            <span><span className="block text-sm font-semibold group-hover:underline">Retrait toujours gratuit</span><span className="mt-1 block text-xs leading-5 text-[#58665C]">Retrouvez-nous à Dakar,<br />Touba et Tambacounda.</span></span>
          </Link>
          <Link href="/mes-commandes" className="group flex items-center gap-4 py-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#173D2B] md:py-1 md:pl-6">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-[#D8DECD] text-[#86682E]"><ServiceIcon><path d="m12 3 9 5-9 5-9-5 9-5ZM3 8v9l9 5 9-5V8M12 13v9M7.5 5.5l9 5" /></ServiceIcon></span>
            <span><span className="block text-sm font-semibold group-hover:underline">Vos commandes, pas à pas</span><span className="mt-1 block text-xs leading-5 text-[#58665C]">Retrouvez vos achats et leur suivi<br />dans votre espace personnel.</span></span>
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid grid-cols-2 gap-x-6 gap-y-9 py-10 md:grid-cols-3 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr] lg:gap-x-10 lg:py-14">
          <div className="col-span-2 md:col-span-3 lg:col-span-1">
            <Link href="/" aria-label="KeurMayata — accueil" className={`inline-block font-[Georgia] text-[34px] leading-tight tracking-tight ${focus}`}>KeurMayata<span className="text-[#E3C783]">.</span></Link>
            <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.22em] text-[#E3C783]">Mode · Beauté · Maison</p>
            <p className="mt-5 max-w-xs text-sm leading-7 text-[#C8D8CC]">Les essentiels qui vous plaisent,<br />les petits détails qui font votre quotidien.</p>
            <Link href="/#catalogue" className={`mt-5 inline-flex min-h-11 items-center gap-5 text-sm font-medium text-[#E3C783] underline-offset-4 hover:underline ${focus}`}>Découvrez notre univers <span aria-hidden="true">→</span></Link>
            <div className="mt-5">
              <p className="mb-3 text-xs text-[#C8D8CC]">Retrouvez-nous aussi sur</p>
              <div className="flex flex-wrap gap-2">
                <a href="https://www.instagram.com/mohamedniang03/" target="_blank" rel="noopener noreferrer" aria-label="Instagram : mohamedniang03 (nouvel onglet)" className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 px-4 text-xs font-medium transition-colors hover:border-[#E3C783] hover:bg-white/5 hover:text-[#E3C783] ${focus}`}>
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-4"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>
                  Instagram <span aria-hidden="true">↗</span>
                </a>
                <a href="https://www.tiktok.com/@mniang188" target="_blank" rel="noopener noreferrer" aria-label="TikTok : @mniang188 (nouvel onglet)" className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 px-4 text-xs font-medium transition-colors hover:border-[#E3C783] hover:bg-white/5 hover:text-[#E3C783] ${focus}`}>
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-4"><path d="M14 3v13a4.5 4.5 0 1 1-4-4.5M14 3c0 4 2.5 6 6 6" /></svg>
                  TikTok <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
          </div>

          {sections.map((section, index) => (
            <nav key={section.title} aria-label={section.title} className={index === 2 ? "col-span-2 md:col-span-1" : "min-w-0"}>
              <h2 className="mb-3 text-sm font-semibold text-white">{section.title}</h2>
              <ul>
                {section.links.map((link) => <li key={link.href}><Link href={link.href} className={`inline-flex min-h-11 items-center py-2 text-sm leading-5 text-[#C8D8CC] transition-colors underline-offset-4 hover:text-[#E3C783] hover:underline ${focus}`}>{link.label}</Link></li>)}
              </ul>
              {index === 2 && <div className="mt-4 border-t border-white/15 pt-4">
                <h3 className="mb-1 text-sm font-semibold text-white">Besoin d’aide ?</h3>
                <a href="tel:+33672150549" className={`inline-flex min-h-11 items-center gap-3 text-sm text-[#C8D8CC] underline-offset-4 hover:text-[#E3C783] hover:underline ${focus}`}>
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0"><path d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a15 15 0 0 1-7-7l2-2-2-5Z" /></svg>
                  +33 6 72 15 05 49
                </a>
                <a href="mailto:mohamedniang0606@gmail.com" className={`inline-flex min-h-11 max-w-full items-center gap-3 text-sm text-[#C8D8CC] underline-offset-4 hover:text-[#E3C783] hover:underline ${focus}`}>
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></svg>
                  <span className="min-w-0 [overflow-wrap:anywhere]">mohamedniang0606@gmail.com</span>
                </a>
              </div>}
            </nav>
          ))}
        </div>

        <div className="flex flex-col gap-6 border-t border-white/15 py-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <p className="text-xs text-[#C8D8CC]">Modes de paiement proposés</p>
            <div aria-label="Wave et Orange Money" className="flex flex-wrap gap-2">
              <span className="inline-flex h-14 w-28 items-center justify-center rounded-lg bg-white px-3">
                {/* Logo officiel : https://www.wave.com/img/nav-logo.png */}
                <Image src="/payments/wave.png" alt="Wave" width={230} height={101} unoptimized className="h-auto w-full object-contain" />
              </span>
              <span className="inline-flex h-14 w-[148px] items-center justify-center gap-2 rounded-lg bg-white px-3 text-xs font-semibold text-[#171717]">
                {/* Logo officiel : https://www.orange.sn/sites/default/files/om.svg */}
                <Image src="/payments/orange-money.svg" alt="" width={32} height={32} unoptimized className="size-8 shrink-0" />
                <span>Orange Money</span>
              </span>
            </div>
          </div>
          <p className="text-xs tracking-wide text-[#C8D8CC]">Dakar <span aria-hidden="true" className="mx-2 text-[#E3C783]">·</span> Touba <span aria-hidden="true" className="mx-2 text-[#E3C783]">·</span> Tambacounda</p>
        </div>
      </div>

      <div className="border-t border-white/10 bg-[#123323]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-8 gap-y-2 px-5 py-4 sm:px-8">
          <p className="text-[11px] leading-6 text-[#C8D8CC]">© {new Date().getFullYear()} KeurMayata. Le style qui vous ressemble.</p>
          <a href="#haut-de-page" className={`inline-flex min-h-11 items-center gap-3 text-xs font-medium text-[#E3C783] underline-offset-4 hover:underline ${focus}`}>Haut de page <span aria-hidden="true" className="text-lg">↑</span></a>
        </div>
      </div>
    </footer>
  );
}
