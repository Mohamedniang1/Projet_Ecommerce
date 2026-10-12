"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, type FormEvent } from "react";
import { CartLink } from "@/components/cart-controls";
import { FavoritesLink } from "@/components/favorites";
import StoreMenu from "@/components/store-menu";
import { useHeaderSession } from "@/lib/header-session";

const focusStyle = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F633F]";

export default function StoreHeader({ search = "", onSearch }: {
  search?: string;
  onSearch?: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const headerRef = useRef<HTMLElement>(null);
  const { session, refreshSession } = useHeaderSession();
  const accountName = session.status === "connected" ? session.fullName : "";
  const accountLabel = accountName ? `${accountName} — Mon compte` : "Mon compte";

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const measureHeader = () => {
      const bounds = header.getBoundingClientRect();
      header.parentElement?.style.setProperty("--store-header-height", `${bounds.height}px`);
      header.parentElement?.style.setProperty("--store-header-bottom", `${bounds.bottom}px`);
    };
    let frame = 0;
    const measureOnScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measureHeader);
    };
    measureHeader();
    const observer = new ResizeObserver(measureHeader);
    observer.observe(header);
    window.addEventListener("scroll", measureOnScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", measureOnScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header ref={headerRef} className="sticky top-0 z-50 border-b border-[#E5EAE3] bg-white shadow-[0_4px_20px_-12px_rgba(23,61,43,0.22)]">
      <div className="relative mx-auto grid max-w-7xl grid-cols-[auto_1fr] items-center gap-x-2 gap-y-3 px-3 py-3 sm:gap-x-5 sm:px-8 sm:py-4 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-x-6">
        <div className="flex items-center gap-2 lg:gap-3">
        <StoreMenu session={session} refreshSession={refreshSession} />
        <Link href="/" aria-label="KeurMayata — Accueil" className={`shrink-0 ${focusStyle}`}>
          <div className="relative aspect-[4/1] w-[92px] overflow-hidden min-[360px]:w-[124px] sm:w-[180px]">
            <Image src="/keurmayata-logo-original.png" alt="KeurMayata — Mode, beauté, maison" width={1448} height={1086} preload sizes="(min-width: 640px) 180px, (min-width: 360px) 124px, 92px" className="absolute left-0 top-[-64%] h-auto w-full max-w-none" />
          </div>
        </Link>
        </div>

        <form role="search" action="/#catalogue" method="get" onSubmit={onSearch} className="col-span-2 row-start-2 flex min-w-0 items-center rounded-full border border-[#D6DFD5] bg-[#F5F7F3] transition focus-within:border-[#577862] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#1F633F]/15 lg:col-span-1 lg:col-start-2 lg:row-start-1">
          <label htmlFor="catalog-search" className="sr-only">Rechercher un produit</label>
          <input key={search} id="catalog-search" type="search" name="search" defaultValue={search} placeholder="Rechercher un produit…" maxLength={150} enterKeyHint="search" className="h-12 min-w-0 flex-1 rounded-l-full bg-transparent pl-5 pr-2 text-base outline-none placeholder:text-[#778277] sm:text-sm" />
          <button type="submit" aria-label="Rechercher" className={`mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#173D2B] text-white transition-colors hover:bg-[#245C3B] ${focusStyle}`}>
            <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
          </button>
        </form>

        <nav aria-label="Compte et panier" className="col-start-2 row-start-1 flex items-center justify-end gap-1.5 md:gap-2 lg:col-start-3">
          <FavoritesLink compactOnMobile />
          <CartLink compactOnMobile />
          <Link href="/mon-compte" title={accountLabel} aria-label={accountLabel} className={`inline-flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-full border border-[#DCE5DC] text-xs font-medium transition-colors hover:bg-[#F3F6F2] md:w-auto md:pl-2 md:pr-4 md:text-sm ${focusStyle}`}>
            {session.status === "connected" && session.initials ? (
              <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#EAF0E4] text-xs font-medium text-[#173D2B]">{session.initials}</span>
            ) : (
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="shrink-0 md:ml-2"><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></svg>
            )}
            <span className="sr-only md:not-sr-only md:max-w-[120px] md:truncate lg:max-w-[160px]">{accountName || "Mon compte"}</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
