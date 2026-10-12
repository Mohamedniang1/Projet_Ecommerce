"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);

  const inputClass =
    "mt-2 h-14 w-full border-0 border-b border-[#D4D8CE] bg-transparent px-1 text-base outline-none transition placeholder:text-[#737A73] focus:border-[#1F633F] focus:ring-2 focus:ring-[#1F633F]/20";

  const labelClass =
    "block text-[11px] font-medium uppercase tracking-[0.18em] text-[#46564B]";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    const form = event.currentTarget;
    const formData = new FormData(form);

    const firstName = String(formData.get("first_name") ?? "").trim();
    const lastName = String(formData.get("last_name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirmation") ?? "");

    setErrors([]);

    if (!firstName || !lastName) {
      setErrors(["Renseignez votre prénom et votre nom."]);
      return;
    }

    if (password !== confirmation) {
      setErrors(["Les deux mots de passe ne correspondent pas."]);
      return;
    }

    setIsSubmitting(true);

    try {
      const csrfResponse = await fetch("/api/users/csrf/", {
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });

      if (!csrfResponse.ok) {
        setErrors(["Impossible de préparer l’inscription. Réessayez."]);
        return;
      }

      const csrfData = await csrfResponse.json();

      if (typeof csrfData.csrfToken !== "string") {
        setErrors(["La réponse du serveur est invalide. Réessayez."]);
        return;
      }

      const response = await fetch("/api/users/register/", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-CSRFToken": csrfData.csrfToken,
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          password,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (response.status === 400) {
        const data: Record<string, unknown> = await response.json();

        const labels: Record<string, string> = {
          first_name: "Prénom",
          last_name: "Nom",
          email: "Adresse e-mail",
          password: "Mot de passe",
          non_field_errors: "Inscription",
        };

        const messages = Object.entries(data).flatMap(([field, value]) => {
          const details = Array.isArray(value) ? value : [value];

          return details
            .filter((detail): detail is string => typeof detail === "string")
            .map((detail) => `${labels[field] ?? field} : ${detail}`);
        });

        setErrors(
          messages.length
            ? messages
            : ["Vérifiez les informations saisies."]
        );
        return;
      }

      if (response.status === 403) {
        setErrors(["La vérification de sécurité a échoué. Réessayez."]);
        return;
      }

      if (response.status !== 201) {
        setErrors(["L’inscription est momentanément indisponible."]);
        return;
      }

      form.reset();
      setShowPassword(false);
      setSuccess(true);
    } catch {
      setErrors([
        "Impossible de confirmer l’inscription. Si vous aviez envoyé le formulaire, essayez de vous connecter avant de recommencer.",
      ]);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-[#FCFBF8] text-[#173D2B] lg:grid-cols-[54%_46%]">
      {/* Visuel de la boutique */}
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

      {/* Inscription */}
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

            <header className="mt-8">
              <h1
                className="text-[40px] leading-tight"
                style={{ fontFamily: "Georgia, serif" }}
              >
                Créer un compte
              </h1>

              <p className="mt-3 text-sm leading-6 text-[#626B64]">
                Bienvenue chez KeurMayata.
              </p>
            </header>

            {success ? (
              <div className="mt-8">
                <p
                  role="status"
                  className="border-l-2 border-[#1F633F] bg-[#EDF7EF] px-4 py-4 text-sm leading-6"
                >
                  Votre compte a été créé. Vous pouvez maintenant
                  vous connecter avec votre adresse e-mail et votre
                  mot de passe.
                </p>

                <Link
                  href="/connexion"
                  className="mt-6 block bg-[#173D2B] px-5 py-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-white hover:bg-[#1F633F]"
                >
                  Se connecter
                </Link>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                aria-busy={isSubmitting}
                className="mt-8"
              >
                <fieldset
                  disabled={isSubmitting}
                  className="min-w-0 space-y-5"
                >
                  <legend className="sr-only">
                    Vos informations d’inscription
                  </legend>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="first_name" className={labelClass}>
                        Prénom
                      </label>

                      <input
                        id="first_name"
                        name="first_name"
                        type="text"
                        autoComplete="given-name"
                        maxLength={150}
                        required
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label htmlFor="last_name" className={labelClass}>
                        Nom
                      </label>

                      <input
                        id="last_name"
                        name="last_name"
                        type="text"
                        autoComplete="family-name"
                        maxLength={150}
                        required
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className={labelClass}>
                      Adresse e-mail
                    </label>

                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="vous@exemple.com"
                      maxLength={254}
                      required
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label htmlFor="password" className={labelClass}>
                      Mot de passe
                    </label>

                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={8}
                      required
                      aria-describedby="password-help"
                      className={inputClass}
                    />

                    <p
                      id="password-help"
                      className="mt-2 text-xs leading-5 text-[#626B64]"
                    >
                      Au moins 8 caractères. Évitez les mots de passe
                      courants, uniquement numériques ou proches de
                      vos informations personnelles.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="confirmation" className={labelClass}>
                      Confirmer le mot de passe
                    </label>

                    <input
                      id="confirmation"
                      name="confirmation"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={8}
                      required
                      className={inputClass}
                    />
                  </div>

                  <label className="flex cursor-pointer items-center gap-2 text-sm text-[#626B64]">
                    <input
                      type="checkbox"
                      checked={showPassword}
                      onChange={(event) =>
                        setShowPassword(event.target.checked)
                      }
                      aria-controls="password confirmation"
                      className="h-4 w-4 accent-[#1F633F]"
                    />
                    Afficher les mots de passe
                  </label>

                  {errors.length > 0 && (
                    <div
                      role="alert"
                      className="border-l-2 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-800"
                    >
                      <ul className="list-disc space-y-2 pl-4">
                        {errors.map((message, index) => (
                          <li key={`${index}-${message}`}>
                            {message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="h-14 w-full bg-[#173D2B] px-5 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-md transition hover:bg-[#1F633F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F633F] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting
                      ? "Création en cours…"
                      : "Créer mon compte"}
                  </button>
                </fieldset>
              </form>
            )}

            {!success && (
              <p className="mt-7 text-center text-sm text-[#626B64]">
                Déjà un compte ?{" "}
                <Link
                  href="/connexion"
                  className="border-b border-[#D4B163] pb-1 font-medium text-[#173D2B] hover:border-[#173D2B]"
                >
                  Se connecter
                </Link>
              </p>
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