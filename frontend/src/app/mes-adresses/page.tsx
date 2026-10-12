"use client";

import Image from "next/image";
import Link from "next/link";
import SiteFooter from "@/components/site-footer";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { authenticatedGet } from "@/lib/api";
import { AddressError, addressCities, fetchAddresses, saveAddressChange, type AddressInput, type SavedAddress } from "@/lib/addresses";

type Profile = { id: number; first_name: string; last_name: string };
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F633F] disabled:cursor-not-allowed disabled:opacity-50";
const input = "mt-2 min-h-12 w-full rounded-lg border border-[#D6DFD5] bg-white px-3 text-sm text-[#173D2B] outline-none focus:border-[#1F633F] focus:ring-2 focus:ring-[#1F633F]/15";

function Pin({ large = false }: { large?: boolean }) {
  return <svg aria-hidden="true" width={large ? 30 : 22} height={large ? 30 : 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>;
}

function AddressEditor({ address, fullName, first, busy, error, onSave, onCancel }: {
  address: SavedAddress | null; fullName: string; first: boolean; busy: boolean; error: string;
  onSave: (data: AddressInput) => void; onCancel: () => void;
}) {
  const labelRef = useRef<HTMLInputElement>(null);
  useEffect(() => { labelRef.current?.focus(); }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSave({
      label: String(form.get("label") ?? "").trim(),
      customer_name: String(form.get("customer_name") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      city: String(form.get("city")) as AddressInput["city"],
      delivery_address: String(form.get("delivery_address") ?? "").trim(),
      is_default: Boolean(first || address?.is_default || form.get("is_default") === "on"),
    });
  }

  return (
    <section aria-labelledby="address-editor-title" className="mb-6 rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-[0_4px_20px_-14px_rgba(23,61,43,0.2)] sm:p-7">
      <h2 id="address-editor-title" className="font-[Georgia] text-2xl">{address ? "Modifier mon adresse" : "Une nouvelle adresse"}</h2>
      <p className="mt-2 text-sm leading-6 text-[#647168]">Indiquez un repère précis pour faciliter la livraison.</p>
      <form onSubmit={submit} className="mt-5" aria-busy={busy}>
        <fieldset disabled={busy} className="min-w-0 disabled:opacity-60">
          <legend className="sr-only">Coordonnées de livraison</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">Nom de l’adresse
              <input ref={labelRef} name="label" required maxLength={60} defaultValue={address?.label ?? ""} placeholder="Maison, bureau, famille…" className={input} />
            </label>
            <div>
              <label htmlFor="address-city" className="text-sm font-medium">Ville</label>
              <select id="address-city" name="city" required defaultValue={address?.city ?? "dakar"} className={input}>{addressCities.map((city) => <option key={city.value} value={city.value}>{city.label}</option>)}</select>
            </div>
            <label className="text-sm font-medium">Nom du destinataire
              <input name="customer_name" autoComplete="shipping name" required maxLength={200} defaultValue={address?.customer_name ?? fullName} className={input} />
            </label>
            <label className="text-sm font-medium">Téléphone
              <input name="phone" type="tel" inputMode="tel" autoComplete="shipping tel" required maxLength={30} defaultValue={address?.phone ?? ""} placeholder="77 123 45 67" className={input} />
            </label>
            <label className="text-sm font-medium sm:col-span-2">Adresse et indications
              <textarea name="delivery_address" autoComplete="shipping street-address" required maxLength={1000} rows={3} defaultValue={address?.delivery_address ?? ""} placeholder="Quartier, rue, numéro de maison et repère…" className={`${input} py-3`} />
            </label>
          </div>
          {first || address?.is_default ? (
            <p className="mt-4 rounded-lg bg-[#F0F5EE] px-4 py-3 text-xs leading-5 text-[#386548]">{first ? "Votre première adresse sera proposée par défaut lors d’une livraison." : "Cette adresse est votre adresse par défaut."}</p>
          ) : (
            <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input name="is_default" type="checkbox" className="size-4 accent-[#173D2B]" />Utiliser comme adresse par défaut</label>
          )}
          {error && <p role="alert" className="mt-4 rounded-lg bg-[#FFF0EE] p-4 text-sm leading-6 text-[#96392D]">{error}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="submit" className={`${button} bg-[#173D2B] text-white hover:bg-[#24573E]`}>{busy ? "Enregistrement…" : "Enregistrer l’adresse"}</button>
            <button type="button" onClick={onCancel} className={`${button} border border-[#DCE5DC] hover:bg-[#F5F7F5]`}>Annuler</button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}

export default function AddressesPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");
  const [retry, setRetry] = useState(0);
  const [editor, setEditor] = useState<SavedAddress | "new" | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const changing = useRef(false);
  const addButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await authenticatedGet("/api/users/me/", controller.signal);
        if (!response.ok) throw new AddressError("Impossible de vérifier votre connexion.", response.status);
        const user: Profile = await response.json();
        const book = await fetchAddresses(controller.signal);
        if (!controller.signal.aborted) {
          setProfile(user);
          setAddresses(book);
          setNeedsLogin(false);
          setLoadError("");
        }
      } catch (caught) {
        if (!controller.signal.aborted) {
          if (caught instanceof AddressError && (caught.status === 401 || caught.status === 403)) {
            setNeedsLogin(true);
            setAddresses([]);
            setProfile(null);
          } else setLoadError(caught instanceof Error ? caught.message : "Impossible de charger vos adresses.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [retry]);

  function closeEditor() {
    setEditor(null);
    setActionError("");
    requestAnimationFrame(() => addButton.current?.focus());
  }

  async function change(method: "POST" | "PATCH" | "DELETE", message: string, id?: number, data?: Partial<AddressInput>) {
    if (!profile || changing.current) return;
    changing.current = true;
    setBusy(true);
    setSuccess("");
    setActionError("");
    let saved = false;
    try {
      await saveAddressChange(profile.id, method, id, data);
      saved = true;
      setEditor(null);
      setDeleting(null);
      setSuccess(message);
      const book = await fetchAddresses();
      setAddresses(book);
      requestAnimationFrame(() => addButton.current?.focus());
    } catch (caught) {
      if (caught instanceof AddressError && caught.status === 401) {
        setNeedsLogin(true);
        setAddresses([]);
        setProfile(null);
        setEditor(null);
      } else if (!saved && caught instanceof AddressError && [400, 403].includes(caught.status)) {
        setActionError(caught.message);
      } else {
        setEditor(null);
        setDeleting(null);
        setLoadError(saved ? "La modification a été enregistrée, mais le carnet n’a pas pu être rechargé. Actualisez-le ci-dessous." : "Nous n’avons pas pu confirmer la modification. Actualisez le carnet pour vérifier avant de réessayer.");
      }
    } finally {
      changing.current = false;
      setBusy(false);
    }
  }

  function reload() { setLoading(true); setActionError(""); setRetry((value) => value + 1); }
  function openEditor(address: SavedAddress | "new") { setActionError(""); setSuccess(""); setDeleting(null); setEditor(address); }
  const fullName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "";

  return (
    <>
    <main className="min-h-screen bg-[#F5F7F5] text-[#173D2B]">
      <header className="border-b border-[#E1E7E1] bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link href="/" aria-label="KeurMayata — accueil" className="relative block aspect-[4/1] w-[190px] overflow-hidden sm:w-[220px]">
            <Image src="/keurmayata-logo-original.png" alt="KeurMayata" width={1448} height={1086} priority className="absolute left-0 top-[-64%] h-auto w-full" />
          </Link>
          <Link href="/mon-compte" className={`${button} border border-[#DCE5DC] hover:bg-[#F5F7F5]`}>← Mon compte</Link>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
        <nav aria-label="Fil d’Ariane" className="text-xs text-[#647168]"><Link href="/mon-compte" className="hover:underline">Mon compte</Link><span aria-hidden="true" className="mx-3">/</span><span aria-current="page">Mes adresses</span></nav>
        <div className="mb-7 mt-7 flex flex-wrap items-end justify-between gap-5">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#86682E]">Vos lieux du quotidien</p><h1 className="mt-3 font-[Georgia] text-3xl sm:text-4xl">Mes adresses</h1><p className="mt-3 max-w-lg text-sm leading-6 text-[#647168]">Enregistrez vos coordonnées une fois, retrouvez-les à chaque commande.</p></div>
          {!loading && !needsLogin && !loadError && !editor && <button ref={addButton} type="button" disabled={busy || addresses.length >= 10} onClick={() => openEditor("new")} className={`${button} bg-[#173D2B] text-white hover:bg-[#24573E]`}><span aria-hidden="true" className="text-lg font-normal">+</span>Ajouter une adresse</button>}
        </div>

        {loading ? <p role="status" className="rounded-2xl bg-white p-8 text-sm">Chargement de vos adresses…</p>
          : needsLogin ? <section className="rounded-2xl border border-[#DCE5DC] bg-white p-8"><h2 className="font-[Georgia] text-2xl">Vos adresses vous attendent</h2><p className="mt-3 text-sm leading-6 text-[#647168]">Connectez-vous pour retrouver et gérer vos adresses de livraison.</p><Link href="/connexion?next=/mes-adresses" className={`${button} mt-6 bg-[#173D2B] text-white`}>Se connecter</Link></section>
          : loadError ? <section role="alert" className="rounded-2xl border border-[#DCE5DC] bg-white p-6"><p className="text-sm leading-6 text-[#96392D]">{loadError}</p><button type="button" onClick={reload} className={`${button} mt-4 border border-[#DCE5DC]`}>Actualiser le carnet</button></section>
          : <>
            {success && <p role="status" className="mb-5 rounded-xl border border-[#D6E5D8] bg-[#EAF3EC] px-4 py-3 text-sm">{success}</p>}
            {actionError && !editor && <p role="alert" className="mb-5 rounded-xl bg-[#FFF0EE] px-4 py-3 text-sm text-[#96392D]">{actionError}</p>}
            {editor && <AddressEditor key={editor === "new" ? "new" : editor.id} address={editor === "new" ? null : editor} fullName={fullName} first={addresses.length === 0} busy={busy} error={actionError} onCancel={closeEditor} onSave={(data) => void change(editor === "new" ? "POST" : "PATCH", "Votre adresse a été enregistrée.", editor === "new" ? undefined : editor.id, data)} />}
            {!editor && (!addresses.length ? <section className="rounded-2xl border border-dashed border-[#CAD8CB] bg-white px-6 py-12 text-center"><div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#F0F5EE] text-[#86682E]"><Pin large /></div><h2 className="mt-5 font-[Georgia] text-2xl">Où souhaitez-vous être livré ?</h2><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#647168]">Maison, bureau ou chez un proche : ajoutez votre première adresse pour préparer vos prochaines commandes.</p><button type="button" onClick={() => openEditor("new")} className={`${button} mt-6 bg-[#173D2B] text-white hover:bg-[#24573E]`}>Enregistrer ma première adresse</button></section> : <>
              <p className="mb-4 text-xs text-[#647168]">{addresses.length} adresse{addresses.length > 1 ? "s" : ""} enregistrée{addresses.length > 1 ? "s" : ""}{addresses.length >= 10 ? " · Limite de 10 adresses atteinte" : ""}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {addresses.map((address) => <article key={address.id} aria-label={`${address.label}, ${address.city_label}`} className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-white ${address.is_default ? "border-[#A9BFAA] shadow-[0_3px_16px_-10px_rgba(23,61,43,0.18)]" : "border-[#DEE6DF]"}`}>
                  <div className="flex-1 p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#F0F5EE] text-[#86682E]"><Pin /></span>{address.is_default && <span className="rounded-full bg-[#EAF3EC] px-3 py-1.5 text-[11px] font-semibold">Par défaut</span>}</div>
                    <h2 className="mt-4 break-words font-[Georgia] text-2xl">{address.label}</h2><p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#86682E]">{address.city_label}</p>
                    <p className="mt-4 whitespace-pre-line break-words text-sm leading-6">{address.delivery_address}</p>
                    <div className="mt-4 border-t border-[#E8EDE8] pt-4 text-sm leading-6 text-[#647168]"><p className="break-words">{address.customer_name}</p><p>{address.phone}</p></div>
                    {!address.is_default && <button type="button" disabled={busy} onClick={() => void change("PATCH", "Votre adresse par défaut a été mise à jour.", address.id, { is_default: true })} className="mt-3 min-h-11 text-xs font-medium underline decoration-[#B1C3B4] underline-offset-4 hover:text-[#86682E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F633F] disabled:opacity-50">Choisir par défaut</button>}
                  </div>
                  <div className="border-t border-[#E8EDE8] bg-[#FAFBFA] px-5 py-3 sm:px-6">
                    {deleting === address.id ? <div><p className="text-sm leading-6">Supprimer cette adresse du carnet ? Vos commandes passées seront conservées.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void change("DELETE", "L’adresse a été supprimée de votre carnet.", address.id)} className={`${button} bg-[#96392D] text-white hover:bg-[#7C2D24]`}>{busy ? "Suppression…" : "Supprimer"}</button><button type="button" disabled={busy} onClick={() => { setDeleting(null); setActionError(""); }} className={`${button} border border-[#DCE5DC]`}>Conserver</button></div></div>
                      : <div className="flex flex-wrap items-center justify-between gap-2"><button type="button" disabled={busy} onClick={() => openEditor(address)} className={`${button} -ml-3 hover:bg-[#EAF0EA]`} aria-label={`Modifier ${address.label}`}>Modifier <span aria-hidden="true">↗</span></button><button type="button" disabled={busy} onClick={() => { setDeleting(address.id); setEditor(null); setActionError(""); setSuccess(""); }} className={`${button} -mr-3 text-[#86665E] hover:bg-[#FFF0EE] hover:text-[#96392D]`} aria-label={`Supprimer ${address.label}`}>Supprimer</button></div>}
                  </div>
                </article>)}
              </div>
            </>)}
            <p className="mt-6 text-xs leading-6 text-[#647168]">Livraison disponible à Dakar, Touba et Tambacounda. Le choix d’une adresse se fait lors de la commande.</p>
          </>}
      </div>
    </main>
    <SiteFooter />
    </>
  );
}
