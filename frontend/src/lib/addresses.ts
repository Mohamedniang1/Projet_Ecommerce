import { authenticatedGet } from "@/lib/api";

export const addressCities = [
  { value: "dakar", label: "Dakar" },
  { value: "touba", label: "Touba" },
  { value: "tambacounda", label: "Tambacounda" },
] as const;

export type AddressCity = typeof addressCities[number]["value"];
export type AddressInput = {
  label: string;
  customer_name: string;
  phone: string;
  city: AddressCity;
  delivery_address: string;
  is_default: boolean;
};
export type SavedAddress = AddressInput & { id: number; city_label: string };

export class AddressError extends Error {
  constructor(message: string, public status = 0) { super(message); }
}

export function isSavedAddress(value: unknown): value is SavedAddress {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return Number.isSafeInteger(item.id) && Number(item.id) > 0 &&
    ["label", "customer_name", "phone", "delivery_address", "city_label"].every((key) => typeof item[key] === "string") &&
    addressCities.some((city) => city.value === item.city) && typeof item.is_default === "boolean";
}

export async function fetchAddresses(signal?: AbortSignal): Promise<SavedAddress[]> {
  const response = await authenticatedGet("/api/users/addresses/", signal);
  if (!response.ok) throw new AddressError(response.status === 401 ? "Reconnectez-vous pour retrouver vos adresses." : "Impossible de charger vos adresses. Réessayez.", response.status);
  const data: unknown = await response.json();
  if (!Array.isArray(data) || !data.every(isSavedAddress)) throw new AddressError("Le carnet d’adresses reçu est incomplet.");
  return data;
}

function errorMessage(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(errorMessage).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(errorMessage).join(" ");
  return "";
}

export async function saveAddressChange(userId: number, method: "POST" | "PATCH" | "DELETE", id?: number, data?: Partial<AddressInput>) {
  const session = await authenticatedGet("/api/users/me/");
  if (!session.ok) throw new AddressError("Reconnectez-vous avant de modifier vos adresses.", session.status);
  const user = await session.json();
  if (user.id !== userId) throw new AddressError("Le compte connecté a changé. Rechargez la page avant de continuer.", 401);

  const csrfResponse = await fetch("/api/users/csrf/", { credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!csrfResponse.ok) throw new AddressError("Impossible de préparer l’enregistrement. Réessayez.");
  const csrf = await csrfResponse.json();
  if (typeof csrf.csrfToken !== "string") throw new AddressError("Impossible de vérifier la sécurité de l’enregistrement.");

  const response = await fetch(id === undefined ? "/api/users/addresses/" : `/api/users/addresses/${id}/`, {
    method, credentials: "same-origin", cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRFToken": csrf.csrfToken },
    body: data ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new AddressError(errorMessage(detail) || "La modification n’a pas pu être confirmée.", response.status);
  }
}
