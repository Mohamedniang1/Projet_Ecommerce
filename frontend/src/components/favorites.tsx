"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { FavoriteError, fetchFavorites, saveFavorite, type FavoriteBook } from "@/lib/favorites";

type FavoriteState = { status: "loading" | "ready" | "guest" | "error"; book: FavoriteBook | null };
type FavoriteContext = FavoriteState & { busy: boolean; refresh: () => Promise<void>; change: (productId: number, saved: boolean) => Promise<void> };
const Context = createContext<FavoriteContext | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FavoriteState>({ status: "loading", book: null });
  const [busy, setBusy] = useState(false);
  const changing = useRef(false);
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    if (changing.current) return;
    const current = ++generation.current;
    try {
      const book = await fetchFavorites();
      if (current === generation.current) setState({ status: "ready", book });
    } catch (error) {
      if (current === generation.current) setState({ status: error instanceof FavoriteError && error.status === 401 ? "guest" : "error", book: null });
    }
  }, []);

  useEffect(() => {
    const requests = generation;
    const current = ++requests.current;
    void fetchFavorites().then((book) => {
      if (current === requests.current) setState({ status: "ready", book });
    }).catch((error) => {
      if (current === requests.current) setState({ status: error instanceof FavoriteError && error.status === 401 ? "guest" : "error", book: null });
    });
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => { requests.current++; window.removeEventListener("focus", onFocus); };
  }, [refresh]);

  async function change(productId: number, saved: boolean) {
    if (changing.current || state.status !== "ready" || !state.book) return;
    changing.current = true;
    setBusy(true);
    const current = ++generation.current;
    try {
      await saveFavorite(state.book.user_id, productId, saved);
      const book = await fetchFavorites();
      if (book.user_id !== state.book.user_id) throw new FavoriteError("Le compte connecté a changé.", 401);
      if (current === generation.current) setState({ status: "ready", book });
    } catch (error) {
      if (current === generation.current) {
        if (error instanceof FavoriteError && error.status === 401) setState({ status: "guest", book: null });
        else if (!(error instanceof FavoriteError && [400, 403].includes(error.status))) setState({ status: "error", book: null });
      }
      throw error;
    } finally {
      changing.current = false;
      setBusy(false);
    }
  }

  return <Context.Provider value={{ ...state, busy, refresh, change }}>{children}</Context.Provider>;
}

export function useFavorites() {
  const value = useContext(Context);
  if (!value) throw new Error("FavoritesProvider est requis.");
  return value;
}

export function Heart({ filled = false, className = "size-5" }: { filled?: boolean; className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /></svg>;
}

export function FavoritesLink({ compactOnMobile = false }: { compactOnMobile?: boolean }) {
  return <Link href="/mes-favoris" title="Mes favoris" className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-[#DCE5DC] text-xs font-medium text-[#173D2B] transition hover:bg-[#F3F6F2] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F633F] sm:text-sm ${compactOnMobile ? "w-11 md:w-auto md:px-4" : "px-4"}`}><Heart /><span className={compactOnMobile ? "sr-only md:not-sr-only" : undefined}>Favoris</span></Link>;
}

export function FavoriteButton({ productId, name, compact = false }: { productId: number; name: string; compact?: boolean }) {
  const { status, book, busy, refresh, change } = useFavorites();
  const router = useRouter();
  const pathname = usePathname();
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const saved = book?.results.some((item) => item.product_id === productId) ?? false;
  const label = status === "error" ? "Recharger les favoris" : `${saved ? "Retirer" : "Ajouter"} ${name} ${saved ? "des" : "aux"} favoris`;

  async function activate() {
    setMessage("");
    setFailed(false);
    if (status === "guest") {
      router.push(`/connexion?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (status === "error") { await refresh(); return; }
    try {
      await change(productId, !saved);
      setMessage(saved ? "Article retiré des favoris." : "Article enregistré dans vos favoris.");
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "Impossible de modifier vos favoris.");
    }
  }

  return (
    <div className={compact ? "relative" : "mt-4"}>
      <button type="button" onClick={() => void activate()} disabled={busy || status === "loading"} aria-label={label} aria-pressed={saved} title={label}
        className={`inline-flex min-h-11 items-center justify-center gap-2 border text-[#173D2B] transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F633F] disabled:cursor-wait disabled:opacity-60 ${compact ? "size-11 rounded-full shadow-sm" : "rounded-lg px-4 text-sm"} ${saved ? "border-[#D8C38E] bg-[#F7EFD8] hover:bg-[#F0E2BC]" : "border-[#DCE5DC] bg-white hover:bg-[#F0F5EE]"}`}>
        <Heart filled={saved} />{!compact && <span>{saved ? "Dans mes favoris" : "Ajouter à mes favoris"}</span>}
      </button>
      {message && <p role={failed ? "alert" : "status"} className={compact ? (failed ? "absolute right-0 top-full z-20 mt-2 w-56 rounded-lg border border-[#E7C7C0] bg-white p-3 text-xs leading-5 text-[#96392D] shadow-md" : "sr-only") : `mt-2 text-xs leading-5 ${failed ? "text-[#96392D]" : "text-[#386548]"}`}>{message}</p>}
    </div>
  );
}
