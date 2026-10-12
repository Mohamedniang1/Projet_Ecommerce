"use client";

import { useCallback, useEffect, useState } from "react";
import { authenticatedGet } from "@/lib/api";

export type HeaderSession =
  | { status: "loading" | "guest" | "error" }
  | { status: "connected"; name: string; fullName: string; initials: string };

export function useHeaderSession() {
  const [session, setSession] = useState<HeaderSession>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  const refreshSession = useCallback(() => {
    setSession(current => current.status === "error" ? { status: "loading" } : current);
    setAttempt(value => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function loadSession() {
      try {
        const response = await authenticatedGet("/api/users/me/", controller.signal);
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          setSession({ status: "guest" });
          return;
        }
        if (!response.ok) throw new Error("Session indisponible");
        const profile = await response.json();
        if (!profile || !Number.isSafeInteger(profile.id)) throw new Error("Profil invalide");
        const clean = (value: unknown) => typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
        const firstName = clean(profile.first_name);
        const lastName = clean(profile.last_name);
        if (!controller.signal.aborted) {
          setSession({
            status: "connected",
            name: firstName,
            fullName: [firstName, lastName].filter(Boolean).join(" "),
            initials: [firstName, lastName].map(name => Array.from(name)[0] ?? "").join("").toLocaleUpperCase("fr-FR"),
          });
        }
      } catch {
        if (!controller.signal.aborted) setSession({ status: "error" });
      }
    }
    void loadSession();
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    // Recheck after a profile edit or a session change in another tab.
    window.addEventListener("focus", refreshSession);
    return () => window.removeEventListener("focus", refreshSession);
  }, [refreshSession]);

  return { session, refreshSession };
}
