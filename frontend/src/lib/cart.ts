"use client";

import { useMemo, useSyncExternalStore } from "react";

export type CartItem = {
  id: number;
  slug: string;
  quantity: number;
};

export type CartProduct = {
  id: number;
  slug: string;
  name: string;
  price: string;
  image: string | null;
  image_alt: string;
  available_quantity: number;
  category: {
    name: string;
  };
};

const STORAGE_KEY = "keurmayata-cart-v1";
const CHANGE_EVENT = "keurmayata-cart-change";

export const MAX_QUANTITY = 99;
const MAX_PRODUCTS = 50;

export const money = (amount: number) =>
  `${new Intl.NumberFormat("fr-SN", {
    maximumFractionDigits: 0,
  }).format(amount)} FCFA`;

function readSnapshot(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function serverSnapshot(): null {
  return null;
}

function parseCart(raw: string | null): CartItem[] {
  try {
    const data: unknown = JSON.parse(raw ?? "[]");

    if (!Array.isArray(data)) return [];

    const result: CartItem[] = [];
    const seen = new Set<number>();

    for (const value of data) {
      if (
        !value ||
        typeof value !== "object" ||
        !Number.isSafeInteger(value.id) ||
        value.id < 1 ||
        typeof value.slug !== "string" ||
        !/^[a-zA-Z0-9_-]+$/.test(value.slug) ||
        !Number.isInteger(value.quantity) ||
        value.quantity < 1 ||
        value.quantity > MAX_QUANTITY ||
        seen.has(value.id)
      ) {
        continue;
      }

      result.push({
        id: value.id,
        slug: value.slug,
        quantity: value.quantity,
      });

      seen.add(value.id);

      if (result.length === MAX_PRODUCTS) break;
    }

    return result;
  } catch {
    return [];
  }
}

function subscribe(callback: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY || event.key === null) callback();
  }

  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function save(items: CartItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    throw new Error(
      "Le panier ne peut pas être enregistré. Vérifiez que votre navigateur autorise le stockage du site.",
    );
  }

  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useCart() {
  const raw = useSyncExternalStore(
    subscribe,
    readSnapshot,
    serverSnapshot,
  );

  const items = useMemo(() => parseCart(raw), [raw]);

  return {
    items,
    ready: raw !== null,
    count: items.reduce((total, item) => total + item.quantity, 0),
  };
}

export function addToCart(product: CartProduct, quantity: number) {
  const items = parseCart(readSnapshot());
  const existing = items.find((item) => item.id === product.id);
  const total = (existing?.quantity ?? 0) + quantity;

  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Choisissez une quantité valide.");
  }

  if (total > product.available_quantity) {
    throw new Error(
      `Stock disponible : ${product.available_quantity}. Votre panier contient déjà ${existing?.quantity ?? 0} exemplaire(s).`,
    );
  }

  if (total > MAX_QUANTITY) {
    throw new Error(`Maximum ${MAX_QUANTITY} exemplaires par produit.`);
  }

  if (!existing && items.length >= MAX_PRODUCTS) {
    throw new Error("Votre panier contient déjà 50 produits différents.");
  }

  save(
    existing
      ? items.map((item) =>
          item.id === product.id
            ? { ...item, slug: product.slug, quantity: total }
            : item,
        )
      : [...items, { id: product.id, slug: product.slug, quantity }],
  );
}

export function setCartQuantity(id: number, quantity: number) {
  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_QUANTITY
  ) {
    throw new Error("Quantité invalide.");
  }

  save(
    parseCart(readSnapshot()).map((item) =>
      item.id === id ? { ...item, quantity } : item,
    ),
  );
}

export function removeFromCart(id: number) {
  save(parseCart(readSnapshot()).filter((item) => item.id !== id));
}

export async function fetchCartProduct(
  slug: string,
  signal?: AbortSignal,
): Promise<CartProduct | null> {
  const timeout = AbortSignal.timeout(15000);

  const response = await fetch(
    `/api/catalog/products/${encodeURIComponent(slug)}/`,
    {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: signal
        ? AbortSignal.any([signal, timeout])
        : timeout,
    },
  );

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error("Impossible de vérifier ce produit. Réessayez.");
  }

  const product: CartProduct = await response.json();

  if (
    !Number.isSafeInteger(Number(product.price)) ||
    Number(product.price) < 1 ||
    !Number.isInteger(product.available_quantity) ||
    product.available_quantity < 0
  ) {
    throw new Error("Le prix ou le stock du produit est indisponible.");
  }

  return product;
}

export function clearCartIfUnchanged(expected: CartItem[]): boolean {
  const current = parseCart(readSnapshot());

  const normalize = (items: CartItem[]) =>
    JSON.stringify(
      [...items]
        .sort((a, b) => a.id - b.id)
        .map(({ id, slug, quantity }) => ({ id, slug, quantity })),
    );

  if (normalize(current) !== normalize(expected)) {
    return false;
  }

  save([]);
  return true;
}