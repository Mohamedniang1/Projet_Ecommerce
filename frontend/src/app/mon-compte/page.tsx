"use client";

import Image from "next/image";
import Link from "next/link";
import SiteFooter from "@/components/site-footer";
import { useEffect, useState } from "react";

import { authenticatedGet } from "@/lib/api";
import ProfileDetails from "@/components/profile-details";

type Profile = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
};

const services = [
  {
    title: "Mes commandes",
    description: "Suivi et historique de vos achats.",
    paths: [
      "M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8Z",
      "m3.3 7 8.7 5 8.7-5",
      "M12 12v10",
      "m7.5 4.5 9 5",
    ],
  },
  {
    title: "Mes adresses",
    description: "Vos adresses de livraison.",
    paths: [
      "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z",
      "M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
    ],
  },
  {
    title: "Mes favoris",
    description: "Vos coups de cœur au même endroit.",
    paths: [
      "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
    ],
  },
];

export default function AccountPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState("");

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadProfile() {
      try {
        const response = await authenticatedGet(
          "/api/users/me/",
          controller.signal
        );

        if (controller.signal.aborted) return;

        if (response.status === 401) {
          setNeedsLogin(true);
          return;
        }

        if (!response.ok) {
          setError("Impossible de charger votre profil. Réessayez.");
          return;
        }

        const data: Profile = await response.json();

        if (!controller.signal.aborted) {
          setProfile(data);
        }
      } catch {
        if (!controller.signal.aborted) {
          setError("Le service est indisponible. Réessayez.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadProfile();

    return () => controller.abort();
  }, []);

  async function handleLogout() {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    setLogoutError("");

    try {
      const csrfResponse = await fetch("/api/users/csrf/", {
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!csrfResponse.ok) {
        setLogoutError("Impossible de préparer la déconnexion. Réessayez.");
        return;
      }

      const csrfData = await csrfResponse.json();

      if (typeof csrfData.csrfToken !== "string") {
        setLogoutError("La réponse du serveur est invalide. Réessayez.");
        return;
      }

      const response = await fetch("/api/users/logout/", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "X-CSRFToken": csrfData.csrfToken,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        setLogoutError("La déconnexion a échoué. Réessayez.");
        return;
      }

      setProfile(null);
      setNeedsLogin(true);
      window.location.replace("/connexion");
    } catch {
      setLogoutError(
        "Impossible de confirmer la déconnexion. Vérifiez votre connexion et réessayez."
      );
    } finally {
      setIsLoggingOut(false);
    }
  }

  const fullName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(" ")
    : "";

  const initials = profile
    ? (
        (profile.first_name.trim().charAt(0) || "") +
        (profile.last_name.trim().charAt(0) || "")
      ).toUpperCase() || profile.email.charAt(0).toUpperCase()
    : "";

  return (
    <>
    <main className="min-h-screen bg-[#F5F7F5] text-[#173D2B]">
      <header className="border-b border-[#E1E7E1] bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-5 py-4 sm:px-8">
          <Link
            href="/"
            aria-label="KeurMayata — accueil"
            className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F633F]"
          >
            <div className="relative aspect-[4/1] w-[190px] overflow-hidden sm:w-[220px]">
              <Image
                src="/keurmayata-logo-original.png"
                alt="KeurMayata — Mode, beauté, maison"
                width={1448}
                height={1086}
                priority
                sizes="220px"
                className="absolute left-0 top-[-64%] h-auto w-full max-w-none"
              />
            </div>
          </Link>

          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-3 rounded-full border border-[#DCE5DC] px-5 text-sm font-medium transition hover:border-[#173D2B] hover:bg-[#F5F7F5] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F633F]"
          >
            <span aria-hidden="true">←</span>
            Retour à la boutique
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 pb-10 pt-6 sm:px-8 sm:pt-7">
        <nav aria-label="Fil d’Ariane" className="text-xs text-[#647168]">
          <ol className="flex items-center gap-3">
            <li>
              <Link
                href="/"
                className="hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F633F]"
              >
                Accueil
              </Link>
            </li>

            <li aria-hidden="true">/</li>

            <li aria-current="page" className="text-[#173D2B]">
              Mon compte
            </li>
          </ol>
        </nav>

        <section className="mt-6" aria-busy={isLoading}>
          <header className="mb-6 sm:mb-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#85652C]">
              Votre espace personnel
            </p>

            <h1
              className="mt-3 text-4xl leading-tight sm:text-5xl"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Mon compte
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-7 text-[#647168] sm:text-base">
              {profile
                ? `Bonjour${
                    profile.first_name ? ` ${profile.first_name}` : ""
                  }, bienvenue dans votre espace KeurMayata.`
                : "Retrouvez vos informations et votre espace personnel."}
            </p>
          </header>

          {isLoading && (
            <div className="rounded-2xl border border-[#E1E7E1] bg-white p-8">
              <p role="status" className="text-sm text-[#647168]">
                Chargement de votre profil…
              </p>

              <div
                aria-hidden="true"
                className="mt-6 space-y-4 motion-safe:animate-pulse"
              >
                <div className="h-5 w-1/3 rounded bg-[#EDF1ED]" />
                <div className="h-4 w-2/3 rounded bg-[#EDF1ED]" />
                <div className="h-4 w-1/2 rounded bg-[#EDF1ED]" />
              </div>
            </div>
          )}

          {!isLoading && needsLogin && (
            <div className="rounded-2xl border border-[#E1E7E1] bg-white px-6 py-10 sm:p-10">
              <h2
                className="text-2xl"
                style={{ fontFamily: "Georgia, serif" }}
              >
                Heureux de vous retrouver.
              </h2>

              <p className="mt-3 text-sm leading-7 text-[#647168]">
                Connectez-vous pour accéder à vos informations personnelles.
              </p>

              <Link
                href="/connexion"
                className="mt-6 inline-flex min-h-12 items-center justify-center rounded-lg bg-[#173D2B] px-7 text-sm font-semibold text-white transition hover:bg-[#245C3B] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F633F]"
              >
                Se connecter
                <span aria-hidden="true" className="ml-5">
                  →
                </span>
              </Link>
            </div>
          )}

          {!isLoading && error && (
            <div className="rounded-2xl border border-red-200 bg-white p-7">
              <p role="alert" className="text-sm leading-6 text-red-800">
                {error}
              </p>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-4 min-h-11 font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F633F]"
              >
                Réessayer
              </button>
            </div>
          )}

          {!isLoading && profile && (
            <>
              <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
                <aside className="min-w-0 rounded-2xl bg-[#173D2B] p-6 text-white sm:p-7">
                  <div
                    aria-hidden="true"
                    className="flex h-14 w-14 items-center justify-center rounded-full border border-[#D4B163]/50 bg-white/5 text-lg font-medium text-[#E8CE95]"
                  >
                    {initials}
                  </div>

                  <p
                    className="mt-4 break-words text-2xl leading-snug"
                    style={{ fontFamily: "Georgia, serif" }}
                  >
                    {fullName || "Bienvenue"}
                  </p>

                  <p className="mt-2 break-all text-sm leading-6 text-white/75">
                    {profile.email}
                  </p>

                  <div className="mt-6 border-t border-white/15 pt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#E8CE95]">
                      Chez KeurMayata
                    </p>

                    <p className="mt-2 text-sm leading-7 text-white/80">
                      Le style qui vous ressemble, jusque dans les petits
                      détails.
                    </p>
                  </div>
                </aside>

                <ProfileDetails
                  profile={profile}
                  onSaved={setProfile}
                />
              </div>

              <section aria-labelledby="services-title" className="mt-8">
                <h2
                  id="services-title"
                  className="mb-5 text-2xl"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  Mes services
                </h2>

                <div className="grid gap-4 sm:grid-cols-3">
                  {services.map((service) => (
                    <article
                      key={service.title}
                      className="min-w-0 rounded-xl border border-[#E1E7E1] bg-white p-6"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#F3F6F2] text-[#85652C]">
                        <svg
                          aria-hidden="true"
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          {service.paths.map((path) => (
                            <path key={path} d={path} />
                          ))}
                        </svg>
                      </div>

                      <h3
                        className="mt-4 text-xl"
                        style={{ fontFamily: "Georgia, serif" }}
                      >
                        {service.title}
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-[#647168]">
                        {service.description}
                      </p>

                      {service.title === "Mes commandes" ? (
                        <Link href="/mes-commandes" className="mt-5 inline-flex min-h-11 items-center gap-4 rounded-lg bg-[#173D2B] px-4 text-sm font-semibold text-white transition hover:bg-[#24573E] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#173D2B]">
                          Voir mes commandes <span aria-hidden="true">→</span>
                        </Link>
                      ) : service.title === "Mes adresses" ? (
                        <Link href="/mes-adresses" className="mt-5 inline-flex min-h-11 items-center gap-4 rounded-lg bg-[#173D2B] px-4 text-sm font-semibold text-white transition hover:bg-[#24573E] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#173D2B]">
                          Gérer mes adresses <span aria-hidden="true">→</span>
                        </Link>
                      ) : (
                        <Link href="/mes-favoris" className="mt-5 inline-flex min-h-11 items-center gap-4 rounded-lg bg-[#173D2B] px-4 text-sm font-semibold text-white transition hover:bg-[#24573E] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#173D2B]">
                          Voir mes favoris <span aria-hidden="true">→</span>
                        </Link>
                      )}
                    </article>
                  ))}
                </div>
              </section>

              <section
                aria-labelledby="security-title"
                className="mt-6 flex flex-col gap-5 rounded-xl border border-[#E1E7E1] bg-white p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7"
              >
                <div>
                  <h2
                    id="security-title"
                    className="text-base font-semibold"
                  >
                    Mot de passe
                  </h2>

                  <p className="mt-2 max-w-lg text-sm leading-6 text-[#647168]">
                    Recevez un lien par e-mail pour choisir un nouveau
                    mot de passe.
                  </p>
                </div>

                <Link
                  href="/mot-de-passe-oublie"
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-4 rounded-lg border border-[#C9D5CA] px-5 text-sm font-medium transition hover:border-[#173D2B] hover:bg-[#F3F6F2] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F633F]"
                >
                  Réinitialiser
                  <span aria-hidden="true">↗</span>
                </Link>
              </section>

              <div className="mt-7 flex flex-col gap-4 border-t border-[#DCE4DC] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-6 text-[#647168]">
                  Sur un appareil partagé, pensez à vous déconnecter.
                </p>

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-3 rounded-lg px-4 text-sm font-semibold transition hover:bg-[#E8EEE8] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F633F] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <svg
                    aria-hidden="true"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 5H5v14h4M9 12h12m-4-4 4 4-4 4" />
                  </svg>

                  {isLoggingOut
                    ? "Déconnexion en cours…"
                    : "Se déconnecter"}
                </button>
              </div>

              {logoutError && (
                <p
                  role="alert"
                  className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
                >
                  {logoutError}
                </p>
              )}
            </>
          )}
        </section>

      </div>
    </main>
    <SiteFooter />
    </>
  );
}
