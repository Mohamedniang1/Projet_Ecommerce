"use client";

type Props = {
  checkedAt: number | null;
  error: string;
  refreshing: boolean;
  onRefresh: () => void;
};

export function OrderSyncStatus({ checkedAt, error, refreshing, onRefresh }: Props) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${error ? "border-[#E8D3A1] bg-[#FFFAED]" : "border-[#DEE6DF] bg-[#F5F8F5]"}`}>
      <div className="min-w-0 text-xs leading-5">
        <p className={`flex items-center gap-2 font-medium ${error ? "text-[#715719]" : "text-[#24623E]"}`}>
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
          {error ? "Suivi momentanément indisponible" : "Votre suivi se met à jour automatiquement"}
        </p>
        {error && <p role="status" className="mt-1 text-[#715719]">{error} Les dernières informations reçues restent affichées.</p>}
        {checkedAt && <p className="mt-0.5 text-[#647168]">Dernière vérification à <time dateTime={new Date(checkedAt).toISOString()}>{new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(checkedAt)}</time></p>}
      </div>
      <button type="button" disabled={refreshing} onClick={onRefresh} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold text-[#173D2B] transition hover:bg-[#E8EFE8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173D2B] disabled:opacity-50">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={`size-4 ${refreshing ? "motion-safe:animate-spin" : ""}`}><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 6.1A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.9 5.9" /></svg>
        {refreshing ? "Vérification…" : error ? "Réessayer" : "Actualiser"}
      </button>
    </div>
  );
}
