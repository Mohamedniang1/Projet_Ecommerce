"use client";

// Plusieurs demandes dans le même onglet peuvent partager
// un seul renouvellement en cours.
let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const csrfResponse = await fetch("/api/users/csrf/", {
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });

  if (!csrfResponse.ok) {
    throw new Error("Impossible de préparer le renouvellement.");
  }

  const csrfData = await csrfResponse.json();

  if (typeof csrfData.csrfToken !== "string") {
    throw new Error("Réponse CSRF invalide.");
  }

  const response = await fetch("/api/users/refresh/", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "X-CSRFToken": csrfData.csrfToken,
    },
    signal: AbortSignal.timeout(10000),
  });

  // Le jeton de renouvellement est absent, invalide ou expiré.
  if (response.status === 401) {
    return false;
  }

  if (!response.ok) {
    throw new Error("Impossible de renouveler la connexion.");
  }

  return true;
}

function refreshSessionOnce(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = refreshSession().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

// Cette fonction sert uniquement aux lectures GET de notre API.
export async function authenticatedGet(
  path: string,
  signal?: AbortSignal
): Promise<Response> {
  if (!path.startsWith("/api/")) {
    throw new Error("Une adresse de notre API est attendue.");
  }

  const request = () =>
    fetch(path, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(10000)])
        : AbortSignal.timeout(10000),
    });

  const response = await request();

  if (response.status !== 401) {
    return response;
  }

  signal?.throwIfAborted();

  const refreshed = await refreshSessionOnce();

  signal?.throwIfAborted();

  if (!refreshed) {
    return response;
  }

  // Une seule nouvelle tentative, pour éviter une boucle.
  return request();
}