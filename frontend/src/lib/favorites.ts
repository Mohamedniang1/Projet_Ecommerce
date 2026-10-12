import { authenticatedGet } from "@/lib/api";

export type FavoriteProduct = {
  id: number;
  name: string;
  slug: string;
  price: string;
  image: string | null;
  image_alt: string;
  category: string;
  in_stock: boolean;
};
export type FavoriteItem = { product_id: number; product: FavoriteProduct | null };
export type FavoriteBook = { user_id: number; results: FavoriteItem[] };

export class FavoriteError extends Error {
  constructor(message: string, public status = 0) { super(message); }
}

function isFavorite(value: unknown): value is FavoriteItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  if (!Number.isSafeInteger(item.product_id) || Number(item.product_id) < 1) return false;
  if (item.product === null) return true;
  if (!item.product || typeof item.product !== "object") return false;
  const product = item.product as Record<string, unknown>;
  return product.id === item.product_id &&
    ["name", "slug", "price", "image_alt", "category"].every((key) => typeof product[key] === "string") &&
    /^[a-zA-Z0-9_-]+$/.test(String(product.slug)) && Number.isSafeInteger(Number(product.price)) && Number(product.price) > 0 &&
    (product.image === null || typeof product.image === "string") && typeof product.in_stock === "boolean";
}

export async function fetchFavorites(signal?: AbortSignal): Promise<FavoriteBook> {
  const response = await authenticatedGet("/api/users/favorites/", signal);
  if (!response.ok) throw new FavoriteError("Impossible de charger vos favoris. Réessayez.", response.status);
  const data = await response.json();
  if (!Number.isSafeInteger(data?.user_id) || data.user_id < 1 || !Array.isArray(data.results) || !data.results.every(isFavorite)) {
    throw new FavoriteError("La liste de favoris reçue est incomplète.");
  }
  return data;
}

export async function saveFavorite(userId: number, productId: number, saved: boolean) {
  const session = await authenticatedGet("/api/users/me/");
  if (!session.ok) throw new FavoriteError("Reconnectez-vous pour gérer vos favoris.", session.status);
  const profile = await session.json();
  if (profile.id !== userId) throw new FavoriteError("Le compte connecté a changé. Reconnectez-vous.", 401);
  const csrfResponse = await fetch("/api/users/csrf/", { cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(10000) });
  if (!csrfResponse.ok) throw new FavoriteError("Impossible de préparer l’enregistrement. Réessayez.");
  const csrf = await csrfResponse.json();
  if (typeof csrf.csrfToken !== "string") throw new FavoriteError("Impossible de préparer l’enregistrement.");
  const response = await fetch(`/api/users/favorites/${productId}/`, {
    method: saved ? "PUT" : "DELETE", credentials: "same-origin", cache: "no-store",
    headers: { Accept: "application/json", "X-CSRFToken": csrf.csrfToken },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const message = response.status === 404 ? "Ce produit n’est plus disponible dans le catalogue." :
      Array.isArray(data) ? data.join(" ") : typeof data?.detail === "string" ? data.detail : "Impossible de modifier vos favoris. Réessayez.";
    throw new FavoriteError(message, response.status);
  }
}
