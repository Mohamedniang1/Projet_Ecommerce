"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { HeaderSession } from "@/lib/header-session";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F633F]";
const groups = [
  {
    title: "Votre espace",
    links: [
      { label: "Mon compte", href: "/mon-compte", icon: "M20 21v-2a8 8 0 0 0-16 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" },
      { label: "Mes commandes", href: "/mes-commandes", icon: "m12 3 9 5-9 5-9-5 9-5ZM3 8v9l9 5 9-5V8M12 13v9" },
      { label: "Mes favoris", href: "/mes-favoris", icon: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" },
      { label: "Mes adresses", href: "/mes-adresses", icon: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" },
    ],
  },
  {
    title: "La boutique",
    links: [
      { label: "Tous nos produits", href: "/#catalogue", icon: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" },
      { label: "À propos de l’entreprise", href: "/a-propos", icon: "M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01M10 21v-4h4v4" },
      { label: "Livraison et retrait", href: "/livraison-et-retrait", icon: "M3 4h11v13H3zM14 9h4l3 4v4h-7M9 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM20 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" },
      { label: "Nous contacter", href: "/a-propos#contact", icon: "M3 5h18v14H3zM3 6l9 7 9-7" },
    ],
  },
];

type SessionProps = { session: HeaderSession; refreshSession: () => void };

function MenuContents({ close, session, refreshSession }: SessionProps & { close: () => void }) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const logoutPending = useRef(false);

  async function logout() {
    if (logoutPending.current) return;
    logoutPending.current = true;
    setLoggingOut(true);
    setLogoutError("");
    try {
      const csrfResponse = await fetch("/api/users/csrf/", {
        credentials: "same-origin", cache: "no-store",
        headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000),
      });
      if (!csrfResponse.ok) throw new Error("Impossible de préparer la déconnexion. Réessayez.");
      const data = await csrfResponse.json();
      if (typeof data.csrfToken !== "string" || !data.csrfToken) throw new Error("Impossible de préparer la déconnexion. Réessayez.");
      const response = await fetch("/api/users/logout/", {
        method: "POST", credentials: "same-origin",
        headers: { Accept: "application/json", "X-CSRFToken": data.csrfToken },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error("La déconnexion a échoué. Réessayez.");
      // A full navigation also clears the authenticated UI state of this page.
      window.location.replace("/connexion");
    } catch (error) {
      setLogoutError(error instanceof Error && error.name === "Error"
        ? error.message : "Impossible de confirmer la déconnexion. Vérifiez votre connexion et réessayez.");
      logoutPending.current = false;
      setLoggingOut(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 border-b border-[#E3E7DA] bg-[#F1F4EA] px-5 py-4">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#173D2B] font-[Georgia] text-lg text-[#E3C783]">
          {session.status === "connected" && session.initials ? session.initials : "K"}
        </span>
        <div className="min-w-0">
          <p className="break-words text-sm font-medium">{session.status === "connected" ? `Bonjour${session.name ? `, ${session.name}` : ""}` : "Bienvenue chez KeurMayata"}</p>
          <p className="mt-1 text-xs text-[#647168]">Tout votre univers, à portée de main.</p>
        </div>
      </div>

      <div className="px-3 py-2">
        {groups.map((group) => (
          <div key={group.title} className="py-2">
            <p className="px-3 pb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-[#87682F]">{group.title}</p>
            <ul>
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} onClick={close} className={`group flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[#F1F4EA] ${focus}`}>
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-[18px] shrink-0 text-[#647168]"><path d={link.icon} /></svg>
                    <span>{link.label}</span><span aria-hidden="true" className="ml-auto text-[#879587]">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-[#E5E8DD] px-5 py-4">
        {session.status === "loading" && <p role="status" className="py-2 text-xs text-[#647168]">Vérification de votre connexion…</p>}
        {session.status === "guest" && <Link href="/connexion" onClick={close} className={`flex min-h-11 items-center justify-center gap-3 rounded-lg bg-[#173D2B] px-4 text-sm font-medium text-white hover:bg-[#28553E] ${focus}`}>Se connecter <span aria-hidden="true">→</span></Link>}
        {session.status === "error" && <div><p role="status" className="text-xs leading-5 text-[#647168]">Votre connexion n’a pas pu être vérifiée.</p><button type="button" onClick={refreshSession} className={`mt-1 min-h-11 text-sm underline underline-offset-4 ${focus}`}>Réessayer</button></div>}
        {session.status === "connected" && <button type="button" onClick={() => void logout()} disabled={loggingOut} className={`flex min-h-11 w-full items-center justify-center gap-3 rounded-lg border border-[#E4CEC5] bg-[#FCF5F1] px-4 text-sm text-[#874635] hover:bg-[#F7E8DF] disabled:cursor-wait disabled:opacity-60 ${focus}`}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-[18px]"><path d="M9 5H5v14h4M9 12h12m-4-4 4 4-4 4" /></svg>
          {loggingOut ? "Déconnexion en cours…" : "Se déconnecter"}
        </button>}
        {logoutError && <p role="alert" className="mt-3 text-xs leading-5 text-[#96392D]">{logoutError}</p>}
      </div>
    </>
  );
}

export default function StoreMenu({ session, refreshSession }: SessionProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    }
    function focusOutside(event: FocusEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", focusOutside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", focusOutside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="shrink-0">
      <button ref={buttonRef} type="button" aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={open} aria-controls={panelId} onClick={() => { if (!open) refreshSession(); setOpen(value => !value); }} className={`flex size-11 items-center justify-center rounded-xl border border-[#DCE5DC] text-[#173D2B] transition-colors hover:bg-[#F1F4EA] aria-expanded:border-[#173D2B] aria-expanded:bg-[#173D2B] aria-expanded:text-white ${focus}`}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="size-[22px]">{open ? <path d="m6 6 12 12M6 18 18 6" /> : <path d="M4 6h16M4 12h16M4 18h16" />}</svg>
      </button>
      {open && <nav id={panelId} aria-label="Menu principal" className="absolute left-3 top-[calc(100%+0.5rem)] z-10 max-h-[calc(100dvh-var(--store-header-bottom,var(--store-header-height))-1rem)] w-[min(360px,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-2xl border border-[#DCE4D6] bg-white text-[#173D2B] shadow-[0_18px_50px_-12px_rgba(23,61,43,0.25)] sm:left-8">
        <MenuContents close={() => setOpen(false)} session={session} refreshSession={refreshSession} />
      </nav>}
    </div>
  );
}
