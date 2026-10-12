"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

type ResetLink = {
  uid: string;
  token: string;
};

export default function ResetPasswordPage() {
  const [resetLink, setResetLink] = useState<ResetLink | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const uid = params.get("uid");
    const token = params.get("token");

    if (uid && token) {
      setResetLink({ uid, token });
    } else {
      setInvalidLink(true);
    }

    setIsReady(true);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting || !resetLink) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password") ?? "");
    const passwordConfirm = String(data.get("password_confirm") ?? "");

    setError("");

    if (password !== passwordConfirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

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

      const response = await fetch("/api/users/password-reset/confirm/", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRFToken": csrfData.csrfToken,
        },
        body: JSON.stringify({
          uid: resetLink.uid,
          token: resetLink.token,
          password,
          password_confirm: passwordConfirm,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (response.status === 400) {
        const details: Record<string, unknown> = await response.json();

        if ("detail" in details || "uid" in details || "token" in details) {
          setInvalidLink(true);
          return;
        }

        const messages = ["password", "password_confirm", "non_field_errors"]
          .flatMap((field) => {
            const value = details[field];

            if (typeof value === "string") return [value];

            if (Array.isArray(value)) {
              return value.filter(
                (item): item is string => typeof item === "string"
              );
            }

            return [];
          });

        setError(
          messages.join(" ") ||
            "Vérifiez les mots de passe saisis."
        );
        return;
      }

      if (response.status === 403) {
        setError("La vérification de sécurité a échoué. Réessayez.");
        return;
      }

      if (response.status === 429) {
        setError("Trop de tentatives. Patientez avant de réessayer.");
        return;
      }

      if (!response.ok) {
        setError(
          "Le service est momentanément indisponible. Réessayez plus tard."
        );
        return;
      }

      form.reset();
      setShowPasswords(false);
      setSuccess(true);
      setResetLink(null);

      // Retirer le lien de réinitialisation de l'adresse après réussite.
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname
      );
    } catch {
      setError(
        "Nous n’avons pas pu confirmer la modification. Essayez de vous " +
          "connecter avec votre nouveau mot de passe avant de recommencer."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    "mt-2 h-14 w-full border-0 border-b border-[#D4D8CE] " +
    "bg-transparent px-1 text-base outline-none transition " +
    "focus:border-[#1F633F] focus:ring-2 focus:ring-[#1F633F]/20";

  const buttonClass =
    "inline-flex min-h-14 w-full items-center justify-center " +
    "bg-[#173D2B] px-5 py-4 text-center text-xs font-semibold " +
    "uppercase tracking-[0.15em] text-white shadow-md transition " +
    "hover:bg-[#1F633F] focus-visible:outline-2 " +
    "focus-visible:outline-offset-2 focus-visible:outline-[#1F633F]";

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

            <h1
              className="mt-9 text-[38px] leading-tight sm:text-[42px]"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {success ? "Mot de passe modifié" : "Nouveau mot de passe"}
            </h1>

            {!isReady ? (
              <p role="status" className="mt-6 text-sm text-[#626B64]">
                Chargement…
              </p>
            ) : success ? (
              <div className="mt-6 space-y-7">
                <p
                  role="status"
                  className="border-l-2 border-[#1F633F] bg-[#EDF7EF] px-5 py-4 text-sm leading-7"
                >
                  Votre mot de passe a été modifié. Connectez-vous
                  maintenant avec vos nouveaux identifiants.
                </p>

                <Link href="/connexion" className={buttonClass}>
                  Se connecter
                </Link>
              </div>
            ) : invalidLink ? (
              <div className="mt-6 space-y-7">
                <p
                  role="alert"
                  className="border-l-2 border-red-700 bg-red-50 px-5 py-4 text-sm leading-7 text-red-800"
                >
                  Ce lien est incomplet, invalide ou a expiré.
                  Demandez un nouveau lien pour modifier votre mot de passe.
                </p>

                <Link href="/mot-de-passe-oublie" className={buttonClass}>
                  Demander un nouveau lien
                </Link>
              </div>
            ) : (
              <>
                <p className="mt-4 text-sm leading-7 text-[#626B64]">
                  Choisissez un mot de passe différent de ceux utilisés
                  sur vos autres sites.
                </p>

                <form
                  onSubmit={handleSubmit}
                  aria-busy={isSubmitting}
                  className="mt-8"
                >
                  <fieldset
                    disabled={isSubmitting}
                    className="space-y-6 disabled:opacity-70"
                  >
                    <legend className="sr-only">
                      Choisir un nouveau mot de passe
                    </legend>

                    <div>
                      <label
                        htmlFor="password"
                        className="block text-[11px] font-medium uppercase tracking-[0.18em]"
                      >
                        Nouveau mot de passe
                      </label>

                      <input
                        id="password"
                        name="password"
                        type={showPasswords ? "text" : "password"}
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={128}
                        aria-describedby="password-help"
                        required
                        className={inputClass}
                      />

                      <p
                        id="password-help"
                        className="mt-3 text-xs leading-6 text-[#626B64]"
                      >
                        Au moins 8 caractères. Évitez les mots de passe
                        courants, vos informations personnelles et les
                        suites de chiffres.
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="password_confirm"
                        className="block text-[11px] font-medium uppercase tracking-[0.18em]"
                      >
                        Confirmer le mot de passe
                      </label>

                      <input
                        id="password_confirm"
                        name="password_confirm"
                        type={showPasswords ? "text" : "password"}
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={128}
                        required
                        className={inputClass}
                      />
                    </div>

                    <label className="flex cursor-pointer items-center gap-3 text-sm text-[#626B64]">
                      <input
                        type="checkbox"
                        checked={showPasswords}
                        onChange={(event) =>
                          setShowPasswords(event.target.checked)
                        }
                        className="h-4 w-4 accent-[#1F633F]"
                      />
                      Afficher les mots de passe
                    </label>

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
                      className={`${buttonClass} disabled:cursor-not-allowed`}
                    >
                      {isSubmitting
                        ? "Enregistrement…"
                        : "Enregistrer le mot de passe"}
                    </button>
                  </fieldset>
                </form>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-[10px] uppercase leading-5 tracking-[0.2em] text-[#626B64]">
          KeurMayata · Mode, beauté et maison
        </p>
      </section>
    </main>
  );
}