"use client";

import { useEffect, useState } from "react";
import { addressCities } from "@/lib/addresses";

type PickupPoint = {
  id: number;
  name: string;
  city: string;
  city_label: string;
  address: string;
  opening_hours: string;
  phone: string;
};

function isPickupPoint(value: unknown): value is PickupPoint {
  if (!value || typeof value !== "object") return false;
  const point = value as Record<string, unknown>;
  return Number.isSafeInteger(point.id) && Number(point.id) > 0 &&
    ["name", "city", "city_label", "address", "opening_hours", "phone"].every((key) => typeof point[key] === "string");
}

function phoneLink(phone: string) {
  let number = phone.replace(/[\s().-]/g, "");
  if (/^\d{9}$/.test(number)) number = `+221${number}`;
  if (number.startsWith("00221")) number = `+${number.slice(2)}`;
  return /^\+221\d{9}$/.test(number) ? `tel:${number}` : null;
}

export default function PickupLocations() {
  const [city, setCity] = useState("dakar");
  const [points, setPoints] = useState<PickupPoint[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F633F]";

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/orders/pickup-points/", {
          headers: { Accept: "application/json" }, cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
        });
        if (!response.ok) throw new Error("Points indisponibles");
        const data: unknown = await response.json();
        if (!Array.isArray(data) || !data.every(isPickupPoint)) throw new Error("Réponse invalide");
        if (!controller.signal.aborted) { setPoints(data); setStatus("ready"); }
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    }
    void load();
    return () => controller.abort();
  }, [attempt]);

  const available = points.filter((point) => point.city === city);
  const cityLabel = addressCities.find((item) => item.value === city)?.label;

  return (
    <div>
      <div role="group" aria-label="Choisir une ville" className="mb-6 flex flex-wrap gap-2">
        {addressCities.map((item) => (
          <button key={item.value} type="button" onClick={() => setCity(item.value)} aria-pressed={city === item.value}
            className={`min-h-11 rounded-full border px-5 text-sm transition ${focus} ${city === item.value ? "border-[#173D2B] bg-[#173D2B] text-white" : "border-[#D6DFD5] bg-white hover:border-[#173D2B]"}`}>
            {item.label}
          </button>
        ))}
      </div>

      {status === "loading" ? <p role="status" className="rounded-xl border border-[#E1E7DD] bg-white p-6 text-sm text-[#647168]">Chargement des points de retrait…</p>
        : status === "error" ? <div role="alert" className="rounded-xl border border-[#E1E7DD] bg-white p-6"><p className="text-sm leading-6 text-[#647168]">Les points de retrait ne peuvent pas être affichés pour le moment.</p><button type="button" onClick={() => { setStatus("loading"); setAttempt((value) => value + 1); }} className={`mt-4 min-h-11 rounded-lg border border-[#D6DFD5] px-5 text-sm font-medium hover:bg-[#F3F6F2] ${focus}`}>Réessayer</button></div>
        : !available.length ? <p role="status" className="rounded-xl border border-dashed border-[#CBD8CA] bg-white p-6 text-sm leading-6 text-[#647168]">Aucun point de retrait n’est proposé à {cityLabel} pour le moment. Vous pouvez choisir la livraison à domicile lors de votre commande.</p>
        : <div className="grid gap-4 sm:grid-cols-2" aria-label={`Points de retrait à ${cityLabel}`}>
          {available.map((point) => {
            const call = phoneLink(point.phone);
            return <article key={point.id} aria-label={point.name} className="flex min-w-0 flex-col rounded-2xl border border-[#DBE4D9] bg-white p-6 sm:p-7">
              <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#86682E]">{point.city_label}</p><span className="rounded-full bg-[#EEF5ED] px-3 py-1 text-[11px] font-medium text-[#386548]">Retrait gratuit</span></div>
              <h3 className="mt-4 break-words font-[Georgia] text-2xl">{point.name}</h3>
              <p className="mt-3 whitespace-pre-line break-words text-sm leading-7 text-[#58665C]">{point.address}</p>
              <div className="mt-5 border-t border-[#E5EBE3] pt-4 text-xs leading-6 text-[#647168]">
                <p className="whitespace-pre-line">{point.opening_hours || "Contactez le point pour connaître ses horaires."}</p>
                {point.phone && <p className="mt-1">Téléphone : {point.phone}</p>}
              </div>
              {call && <a href={call} className={`mt-5 inline-flex min-h-11 items-center justify-center gap-3 self-start rounded-lg border border-[#CFDBCD] px-5 text-sm font-medium hover:bg-[#F0F5EE] ${focus}`}><span aria-hidden="true">↗</span>Appeler le point</a>}
            </article>;
          })}
        </div>}
    </div>
  );
}
