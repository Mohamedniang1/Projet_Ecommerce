"use client";

import { useState } from "react";

export type PaymentInstructionsData = {
  available: boolean;
  test_mode: boolean;
  method_label: string;
  amount: string;
  reference: string;
  recipient_phone: string | null;
  recipient_name: string | null;
};

export function PaymentInstructions({ instructions }: { instructions?: PaymentInstructionsData | null }) {
  const [feedback, setFeedback] = useState("");
  if (!instructions) return null;
  const ready = instructions.available && instructions.recipient_phone && instructions.recipient_name;
  const amount = `${new Intl.NumberFormat("fr-SN").format(Number(instructions.amount))} FCFA`;

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback(`${label} copié.`);
    } catch {
      setFeedback("La copie automatique n’est pas disponible. Sélectionnez le texte pour le copier.");
    }
  }

  const copyButton = "min-h-11 shrink-0 rounded-lg border border-[#C9D5CA] bg-white px-3 text-xs font-semibold hover:bg-[#EDF3EE] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173D2B]";

  return (
    <section aria-label="Instructions de paiement" className="rounded-xl border border-[#DCE5DC] bg-white p-5 text-[#173D2B]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#86682E]">{instructions.method_label}</p>
          <h3 className="mt-1 text-base font-semibold">{ready ? (instructions.test_mode ? "Aperçu des coordonnées" : "Régler votre commande") : "Votre paiement"}</h3>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#647168]">Montant total</p>
          <p className="mt-1 text-xl font-semibold">{amount}</p>
        </div>
      </div>

      {ready && instructions.test_mode && (
        <p className="mt-4 rounded-lg border border-[#E7C675] bg-[#FFF7E2] p-4 text-sm font-semibold leading-6 text-[#705719]">
          Mode test : ne pas effectuer de transfert. Ces coordonnées sont affichées uniquement pour vérifier la présentation du site.
        </p>
      )}

      {!ready ? (
        <p className="mt-4 rounded-lg bg-[#F5F7F5] p-4 text-sm leading-6 text-[#647168]">
          Le paiement n’est pas encore disponible. Votre commande est enregistrée ; aucun transfert n’est demandé pour le moment.
        </p>
      ) : (
        <>
          <div className="mt-4 rounded-lg bg-[#F5F7F5] p-4">
            <p className="text-xs text-[#647168]">Numéro du bénéficiaire</p>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
              <p className="select-all text-lg font-semibold">{instructions.recipient_phone}</p>
              <button type="button" className={copyButton} onClick={() => copy(instructions.recipient_phone!, "Numéro")}>Copier le numéro</button>
            </div>
            <p className="mt-3 text-xs text-[#647168]">Nom à vérifier avant le transfert</p>
            <p className="mt-1 break-words text-sm font-semibold">{instructions.recipient_name}</p>
          </div>
          {instructions.test_mode ? (
            <p className="mt-4 text-sm leading-6 text-[#647168]">Le numéro et le nom ci-dessus sont prêts pour la future version de paiement. Aucun justificatif ne doit être envoyé pendant le mode test.</p>
          ) : (
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-[#647168]">
              <li>Ouvrez votre application {instructions.method_label} et saisissez le numéro ci-dessus.</li>
              <li>Vérifiez le nom du bénéficiaire et le montant de {amount} avant de valider.</li>
              <li>Conservez le justificatif du transfert et la référence de votre commande.</li>
            </ol>
          )}
          <div className="mt-4 border-t border-[#E1E7E1] pt-4">
            <p className="text-xs text-[#647168]">Référence de commande</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <p className="min-w-0 select-all break-all font-mono text-xs">{instructions.reference}</p>
              <button type="button" className={copyButton} onClick={() => copy(instructions.reference, "Référence")}>Copier la référence</button>
            </div>
          </div>
          {!instructions.test_mode && <p className="mt-4 text-xs leading-5 text-[#647168]">Après le transfert, le paiement sera vérifié par KeurMayata. Si vous avez déjà payé, ne renvoyez pas d’argent pendant cette vérification.</p>}
        </>
      )}
      <p role="status" className="mt-2 text-xs text-[#24623E]">{feedback}</p>
    </section>
  );
}
