"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";

export default function ForgotPasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim();

    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const csrfResponse = await fetch("/api/users/csrf/", {
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });

      if (!csrfResponse.ok) {
        setError("Impossible de préparer votre demande. Réessayez.");
        return;
      }

      const csrfData = await csrfResponse.json();

      if (typeof csrfData.csrfToken !== "string") {
        setError("La réponse du serveur est invalide. Réessayez.");
        return;
      }

      const response = await fetch("/api/users/password-reset/", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRFToken": csrfData.csrfToken,
        },
        body: JSON.stringify({ email }),
        signal: AbortSignal.timeout(15000),
      });

      if (response.status === 400) {
        setError("Vérifiez votre adresse e-mail.");
        return;
      }

      if (response.status === 403) {
        setError("La vérification de sécurité a échoué. Réessayez.");
        return;
      }

      if (response.status === 429) {
        setError(
          "Trop de demandes ont été envoyées. Patientez avant de réessayer."
        );
        return;
      }

      if (!response.ok) {
        setError(
          "Le service est momentanément indisponible. Réessayez plus tard."
        );
        return;
      }

      form.reset();

      setSuccess(
        "Si un compte actif correspond à cette adresse, vous recevrez " +
          "un e-mail contenant un lien pour choisir un nouveau mot de passe."
      );
    } catch {
      setError(
        "Nous n’avons pas pu confirmer l’envoi. Vérifiez votre boîte mail " +
          "avant de réessayer."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-[#FCFBF8] text-[#173D2B] lg:grid-cols-[54%_46%]">
      <section className="relative hidden min-h-[850px] overflow-hidden bg-[#173D2B] lg:block">
        <Image
          src="/keurmayata-boutique-connexion.png"
          alt="Une cliente dans une boutique de beauté."
          fill
          priority
          sizes="54vw"
          className="object-cover object-top"
        />

        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#09291C]/95 via-[#09291C]/15 to-black/10"
        />

        <div className="absolute inset-x-0 bottom-0 z-10 px-10 pb-16 xl:px-12">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#D4B163]">
            Mode · Beauté · Maison
          </p>

          <h2
            className="mt-7 max-w-xl text-5xl leading-[1.08] text-white xl:text-6xl"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Le style qui vous
            <br />
            <span className="italic text-[#D4B163]">ressemble.</span>
          </h2>

          <p className="mt-6 max-w-md text-sm leading-7 text-white/85">
            Retrouvez vos essentiels et vos nouvelles envies,
            de la garde-robe à la maison.
          </p>
        </div>
      </section>

      <section className="flex min-h-screen flex-col px-6 py-8 sm:px-12 xl:px-20">
        <Link
          href="/"
          aria-label="KeurMayata — accueil"
          className="mx-auto block w-[250px] max-w-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F633F]"
        >
          <div className="relative aspect-[4/1] overflow-hidden">
            <Image
              src="/keurmayata-logo-original.png"
              alt="KeurMayata — Mode, beauté, maison"
              width={1448}
              height={1086}
              priority
              sizes="250px"
              className="absolute left-0 top-[-64%] h-auto w-full max-w-none"
            />
          </div>
        </Link>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px]">
            <Link
              href="/connexion"
              className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-[#526052] hover:text-[#1F633F]"
            >
              <span aria-hidden="true">←</span>
              Retour à la connexion
            </Link>

            <header className="mt-9">
              <h1
                className="text-[38px] leading-tight sm:text-[42px]"
                style={{ fontFamily: "Georgia, serif" }}
              >
                Mot de passe oublié ?
              </h1>

              <p className="mt-4 text-sm leading-7 text-[#626B64]">
                Saisissez l’adresse e-mail de votre compte.
                Nous vous enverrons un lien pour créer un nouveau
                mot de passe.
              </p>
            </header>

            {success ? (
              <div className="mt-8">
                <div
                  role="status"
                  className="border-l-2 border-[#1F633F] bg-[#EDF7EF] px-5 py-4 text-sm leading-7 text-[#245C3B]"
                >
                  {success}
                </div>

                <p className="mt-5 text-sm leading-6 text-[#626B64]">
                  Pensez également à vérifier vos courriers indésirables.
                  Le lien est valable 30 minutes.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setSuccess("");
                    setError("");
                  }}
                  className="mt-6 text-sm font-medium text-[#173D2B] underline underline-offset-4 hover:text-[#1F633F]"
                >
                  Utiliser une autre adresse e-mail
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                aria-busy={isSubmitting}
                className="mt-10"
              >
                <fieldset
                  disabled={isSubmitting}
                  className="space-y-7 disabled:opacity-70"
                >
                  <legend className="sr-only">
                    Demander un lien de réinitialisation
                  </legend>

                  <div>
                    <label
                      htmlFor="email"
                      className="block text-[11px] font-medium uppercase tracking-[0.18em] text-[#46564B]"
                    >
                      Adresse e-mail
                    </label>

                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      placeholder="vous@exemple.com"
                      maxLength={254}
                      required
                      className="mt-2 h-14 w-full border-0 border-b border-[#D4D8CE] bg-transparent px-1 text-base outline-none transition placeholder:text-[#737A73] focus:border-[#1F633F] focus:ring-2 focus:ring-[#1F633F]/20"
                    />
                  </div>

                  {error && (
                    <p
                      role="alert"
                      className="border-l-2 border-red-700 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
                    >
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="min-h-14 w-full bg-[#173D2B] px-5 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-white shadow-md transition hover:bg-[#1F633F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F633F] disabled:cursor-not-allowed"
                  >
                    {isSubmitting
                      ? "Envoi en cours…"
                      : "Recevoir le lien"}
                  </button>
                </fieldset>
              </form>
            )}

            <div className="mt-10 border-t border-[#D4D8CE] pt-7">
              <p className="text-center text-sm leading-6 text-[#626B64]">
                Vous connaissez votre mot de passe ?{" "}
                <Link
                  href="/connexion"
                  className="border-b border-[#D4B163] pb-1 font-medium text-[#173D2B] hover:border-[#173D2B]"
                >
                  Se connecter
                </Link>
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-[10px] uppercase leading-5 tracking-[0.2em] text-[#626B64]">
          KeurMayata · Mode, beauté et maison
        </p>
      </section>
    </main>
  );
}