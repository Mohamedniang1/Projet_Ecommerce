"use client";

import { useRef, useState, type FormEvent } from "react";
import { authenticatedGet } from "@/lib/api";

type Profile = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
};

type Props = {
  profile: Profile;
  onSaved: (profile: Profile) => void;
};

export default function ProfileDetails({ profile, onSaved }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const editButton = useRef<HTMLButtonElement>(null);
  const saving = useRef(false);

  function closeEditor() {
    setIsEditing(false);
    setError("");

    requestAnimationFrame(() => {
      editButton.current?.focus();
    });
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving.current) return;

    const data = new FormData(event.currentTarget);
    const firstName = String(data.get("first_name") ?? "").trim();
    const lastName = String(data.get("last_name") ?? "").trim();

    setError("");
    setSuccess("");

    if (!firstName || !lastName) {
      setError("Renseignez votre prénom et votre nom.");
      return;
    }

    saving.current = true;
    setIsSaving(true);

    try {
      // Renouveler la connexion si nécessaire avant l'enregistrement.
      const sessionResponse = await authenticatedGet("/api/users/me/");

      if (sessionResponse.status === 401) {
        setError(
          "Votre session a expiré. Reconnectez-vous avant de modifier votre profil."
        );
        return;
      }

      if (!sessionResponse.ok) {
        setError("Impossible de vérifier votre connexion. Réessayez.");
        return;
      }

      const csrfResponse = await fetch("/api/users/csrf/", {
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });

      if (!csrfResponse.ok) {
        setError("Impossible de préparer la modification. Réessayez.");
        return;
      }

      const csrfData = await csrfResponse.json();

      if (typeof csrfData.csrfToken !== "string") {
        setError("La réponse du serveur est invalide. Réessayez.");
        return;
      }

      const response = await fetch("/api/users/me/", {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRFToken": csrfData.csrfToken,
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (response.status === 400) {
        setError(
          "Vérifiez votre prénom et votre nom : chaque champ doit contenir entre 1 et 150 caractères."
        );
        return;
      }

      if (response.status === 401) {
        setError("Votre session a expiré. Reconnectez-vous.");
        return;
      }

      if (response.status === 403) {
        setError("La vérification de sécurité a échoué. Réessayez.");
        return;
      }

      if (!response.ok) {
        setError("Impossible d’enregistrer les modifications pour le moment.");
        return;
      }

      const updatedProfile: Profile = await response.json();

      onSaved(updatedProfile);
      setSuccess("Vos informations ont été mises à jour.");
      closeEditor();
    } catch {
      setError(
        "Nous n’avons pas pu confirmer l’enregistrement. Actualisez la page pour vérifier vos informations."
      );
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  }

  const labelClass =
    "block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#647168]";

  const inputClass =
    "mt-2 h-12 w-full rounded-lg border border-[#CBD7CC] bg-white " +
    "px-3 text-base text-[#173D2B] outline-none transition " +
    "focus:border-[#1F633F] focus:ring-2 focus:ring-[#1F633F]/15";

  return (
    <section
      aria-labelledby="profile-title"
      className="min-w-0 rounded-2xl border border-[#E1E7E1] bg-white p-6 sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E8ECE8] pb-5">
        <div>
          <h2
            id="profile-title"
            className="text-2xl sm:text-[28px]"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Mes informations
          </h2>

          <p className="mt-2 text-sm leading-6 text-[#647168]">
            {isEditing
              ? "Mettez à jour votre prénom et votre nom."
              : "Les coordonnées associées à votre compte."}
          </p>
        </div>

        {!isEditing && (
          <button
            ref={editButton}
            type="button"
            onClick={() => {
              setError("");
              setSuccess("");
              setIsEditing(true);
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#D5DFD5] px-4 text-sm font-medium transition hover:border-[#173D2B] hover:bg-[#F3F6F2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F633F]"
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m16 3 5 5-12 12-6 1 1-6L16 3Z" />
              <path d="m13 6 5 5" />
            </svg>
            Modifier
          </button>
        )}
      </div>

      {isEditing ? (
        <form onSubmit={handleSave} aria-busy={isSaving} className="mt-6">
          <fieldset disabled={isSaving} className="disabled:opacity-60">
            <legend className="sr-only">
              Modifier mes informations personnelles
            </legend>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="profile-first-name" className={labelClass}>
                  Prénom
                </label>
                <input
                  id="profile-first-name"
                  name="first_name"
                  autoComplete="given-name"
                  defaultValue={profile.first_name}
                  maxLength={150}
                  required
                  autoFocus
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="profile-last-name" className={labelClass}>
                  Nom
                </label>
                <input
                  id="profile-last-name"
                  name="last_name"
                  autoComplete="family-name"
                  defaultValue={profile.last_name}
                  maxLength={150}
                  required
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mt-6">
              <p className={labelClass}>Adresse e-mail</p>
              <p className="mt-2 break-all text-sm">{profile.email}</p>
              <p className="mt-1 text-xs leading-6 text-[#647168]">
                L’adresse e-mail ne peut pas être modifiée ici.
              </p>
            </div>

            {error && (
              <p
                role="alert"
                className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800"
              >
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                className="min-h-12 rounded-lg bg-[#173D2B] px-5 text-sm font-semibold text-white transition hover:bg-[#245C3B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F633F] disabled:cursor-wait"
              >
                {isSaving ? "Enregistrement…" : "Enregistrer"}
              </button>

              <button
                type="button"
                onClick={closeEditor}
                className="min-h-12 rounded-lg border border-[#D5DFD5] px-5 text-sm font-medium transition hover:bg-[#F3F6F2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F633F]"
              >
                Annuler
              </button>
            </div>
          </fieldset>
        </form>
      ) : (
        <dl className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <div>
            <dt className={labelClass}>Prénom</dt>
            <dd className="mt-2 break-words text-base font-medium">
              {profile.first_name || "Non renseigné"}
            </dd>
          </div>

          <div>
            <dt className={labelClass}>Nom</dt>
            <dd className="mt-2 break-words text-base font-medium">
              {profile.last_name || "Non renseigné"}
            </dd>
          </div>

          <div className="sm:col-span-2">
            <dt className={labelClass}>Adresse e-mail</dt>
            <dd className="mt-2 break-all text-base font-medium">
              {profile.email}
            </dd>
          </div>
        </dl>
      )}

      {success && (
        <p
          role="status"
          className="mt-5 rounded-lg bg-[#EDF6EE] px-4 py-3 text-sm text-[#245C3B]"
        >
          {success}
        </p>
      )}
    </section>
  );
}