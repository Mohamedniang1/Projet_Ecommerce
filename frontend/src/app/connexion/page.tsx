"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    const form = event.currentTarget;
    const formData = new FormData(form);

    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const remember = formData.get("remember") === "on";

    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      // Récupérer le jeton CSRF avant d'envoyer les identifiants.
      const csrfResponse = await fetch("/api/users/csrf/", {
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });

      if (!csrfResponse.ok) {
        setError("Impossible de préparer la connexion. Réessayez.");
        return;
      }

      const csrfData = await csrfResponse.json();

      if (typeof csrfData.csrfToken !== "string") {
        setError("La réponse du serveur est invalide. Réessayez.");
        return;
      }

      // Envoyer les identifiants à Django.
      const response = await fetch("/api/users/login/", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfData.csrfToken,
        },
        body: JSON.stringify({ email, password, remember }),
        signal: AbortSignal.timeout(10000),
      });

      if (response.status === 400 || response.status === 401) {
        setError("Adresse e-mail ou mot de passe incorrect.");
        return;
      }

      if (response.status === 403) {
        setError("La vérification de sécurité a échoué. Réessayez.");
        return;
      }

      if (!response.ok) {
        setError("La connexion est momentanément indisponible.");
        return;
      }

      form.reset();
      setShowPassword(false);
      setSuccess("Connexion réussie. Vous êtes connecté à votre compte.");
      const destination = new URLSearchParams(
        window.location.search,
      ).get("next");

      window.location.replace(
        destination && (["/", "/#catalogue", "/commande", "/mes-commandes", "/mes-adresses", "/mes-favoris"].includes(destination) || /^\/produits\/[a-zA-Z0-9_-]+$/.test(destination))
        ? destination
        : "/",
      );

    } catch {
      setError("Le service ne répond pas. Réessayez dans quelques instants.");
    } finally {
      setIsSubmitting(false);
    }
  }

      return (
    <main className="grid min-h-screen bg-[#FCFBF8] text-[#173D2B] lg:grid-cols-[54%_46%]">
      {/* Photo de boutique */}
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
            <span className="italic text-[#D4B163]">
              ressemble.
            </span>
          </h2>

          <p className="mt-6 max-w-md text-sm leading-7 text-white/85">
            Retrouvez vos essentiels et vos nouvelles envies,
            de la garde-robe à la maison.
          </p>
        </div>
      </section>

      {/* Logo et formulaire */}
      <section className="flex min-h-screen flex-col px-6 py-8 sm:px-12 xl:px-20">
        {/* Fenêtre affichant la version horizontale du logo fourni */}
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
              href="/"
              className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-[#526052] hover:text-[#1F633F]"
            >
              <span aria-hidden="true">←</span>
              Retour à la boutique
            </Link>

            <header className="mt-9">
              <h1
                className="text-[42px] leading-tight"
                style={{ fontFamily: "Georgia, serif" }}
              >
                Connexion
              </h1>

              <p className="mt-3 text-sm leading-6 text-[#626B64]">
                Retrouvez votre compte et vos envies.
              </p>
            </header>

            <form
              onSubmit={handleSubmit}
              aria-busy={isSubmitting}
              className="mt-10 space-y-7"
            >
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
                  autoComplete="username"
                  placeholder="vous@exemple.com"
                  required
                  className="mt-2 h-14 w-full border-0 border-b border-[#D4D8CE] bg-transparent px-1 text-base outline-none transition placeholder:text-[#737A73] focus:border-[#1F633F] focus:ring-2 focus:ring-[#1F633F]/20"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-[11px] font-medium uppercase tracking-[0.18em] text-[#46564B]"
                >
                  Mot de passe
                </label>

                <div className="relative mt-2">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    className="h-14 w-full border-0 border-b border-[#D4D8CE] bg-transparent pl-1 pr-14 text-base outline-none transition focus:border-[#1F633F] focus:ring-2 focus:ring-[#1F633F]/20"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-controls="password"
                    aria-label={
                      showPassword
                        ? "Masquer le mot de passe"
                        : "Afficher le mot de passe"
                    }
                    className="absolute top-1 right-0 flex h-12 w-12 items-center justify-center text-[#626B64] hover:text-[#1F633F] focus-visible:outline-2 focus-visible:outline-[#1F633F]"
                  >
                    <svg
                      aria-hidden="true"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                      {showPassword && <path d="M3 3l18 18" />}
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <label
                  htmlFor="remember"
                  className="flex cursor-pointer items-center gap-2 text-[#626B64]"
                >
                  <input
                    id="remember"
                    name="remember"
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer accent-[#1F633F]"
                  />
                  Rester connecté
                </label>

                <Link
                  href="/mot-de-passe-oublie"
                  className="italic text-[#89651F] hover:underline"
                >
                  Mot de passe oublié ?
                </Link>
              </div>

              {error && (
                <p
                  role="alert"
                  className="border-l-2 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                  {error}
                </p>
              )}

              {success && (
                <p
                  role="status"
                  className="border-l-2 border-[#1F633F] bg-[#EDF7EF] px-4 py-3 text-sm text-[#245C3B]"
                >
                  {success}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="h-14 w-full bg-[#173D2B] px-5 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-md transition hover:bg-[#1F633F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F633F] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Connexion en cours…" : "Se connecter"}
              </button>
            </form>

            <div className="mt-10 border-t border-[#D4D8CE] pt-7">
              <p className="text-center text-sm leading-6 text-[#626B64]">
                Nouveau chez KeurMayata ?{" "}
                <Link
                  href="/inscription"
                  className="border-b border-[#D4B163] pb-1 font-medium text-[#173D2B] hover:border-[#173D2B]"
                >
                  Créer un compte
                </Link>
              </p>
            </div>

            <p className="mt-8 text-center text-[10px] leading-5 tracking-[0.14em] text-[#626B64]">
              NE PARTAGEZ JAMAIS VOTRE MOT DE PASSE
            </p>
          </div>
        </div>

        <p className="text-center text-[10px] uppercase leading-5 tracking-[0.2em] text-[#626B64]">
          KeurMayata · Mode, beauté et maison
        </p>
      </section>
    </main>
  );
}
