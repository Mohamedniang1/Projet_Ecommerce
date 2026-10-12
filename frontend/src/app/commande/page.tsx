"use client";

import Image from "next/image";
import Link from "next/link";
import SiteFooter from "@/components/site-footer";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { authenticatedGet } from "@/lib/api";
import { addressCities, fetchAddresses, type SavedAddress } from "@/lib/addresses";
import { startOrderRefresh } from "@/lib/order-refresh";
import { OrderSyncStatus } from "@/components/order-sync-status";
import { PaymentInstructions, type PaymentInstructionsData } from "@/components/payment-instructions";
import {
  clearCartIfUnchanged,
  fetchCartProduct,
  money,
  useCart,
  type CartItem,
  type CartProduct,
} from "@/lib/cart";

type User = {
  id: number;
  first_name: string;
  last_name: string;
};

type PickupPoint = {
  id: number;
  name: string;
  city: string;
  address: string;
  opening_hours: string;
  phone: string;
};

type RequestBody = {
  request_key: string;
  customer_name: string;
  phone: string;
  fulfillment: "pickup" | "delivery";
  city: string;
  delivery_address: string;
  pickup_point_id: number | null;
  payment_method: string;
  customer_note: string;
  items: {
    product_id: number;
    quantity: number;
  }[];
};

type PendingRequest = {
  userId: number;
  body: RequestBody;
  cart: CartItem[];
};

type Order = {
  payment_instructions?: PaymentInstructionsData | null;
  id: string;
  customer_name: string;
  fulfillment: "pickup" | "delivery";
  status_label: string;
  status: string;
  payment_status_label: string;
  city_label: string;
  pickup_name: string;
  pickup_address: string;
  delivery_address: string;
  payment_method: string;
  subtotal: string;
  delivery_fee: string | null;
  total: string | null;
};

type LoadedData = {
  signature: string;
  user: User;
  lastPhone: string;
  addresses: SavedAddress[];
  addressesUnavailable: boolean;
  points: PickupPoint[];
  products: (CartProduct | null)[];
};

const cities = addressCities;

const inputStyle =
  "mt-2 min-h-12 w-full rounded-lg border border-[#D6DFD5] bg-white px-4 text-sm text-[#173D2B] outline-none focus:border-[#1F633F] focus:ring-2 focus:ring-[#1F633F]/15";

const buttonStyle =
  "inline-flex min-h-12 items-center justify-center rounded-lg bg-[#173D2B] px-6 text-sm font-semibold text-white hover:bg-[#24573E] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F633F] disabled:cursor-not-allowed disabled:opacity-50";

function pendingKey(userId: number) {
  return `keurmayata-order-pending-${userId}`;
}

async function loadLastPhone(signal: AbortSignal): Promise<string> {
  try {
    // Le préremplissage reste facultatif si l’historique est indisponible.
    const response = await authenticatedGet(
      "/api/orders/?page=1",
      AbortSignal.any([signal, AbortSignal.timeout(3000)]),
    );
    if (!response.ok) return "";

    const history = await response.json();
    const phone = Array.isArray(history?.results)
      ? history.results[0]?.phone
      : undefined;
    return typeof phone === "string" ? phone : "";
  } catch {
    return "";
  }
}

async function loadAddressBook(signal: AbortSignal) {
  try {
    const addresses = await fetchAddresses(AbortSignal.any([signal, AbortSignal.timeout(5000)]));
    return { addresses, addressesUnavailable: false };
  } catch {
    // La saisie manuelle reste disponible si le carnet ne peut pas être lu.
    return { addresses: [] as SavedAddress[], addressesUnavailable: true };
  }
}

function errorText(value: unknown): string {
  if (typeof value === "string") return value;

  if (Array.isArray(value)) {
    return value.map(errorText).filter(Boolean).join(" ");
  }

  if (value && typeof value === "object") {
    return Object.values(value)
      .map(errorText)
      .filter(Boolean)
      .join(" ");
  }

  return "";
}

export default function CheckoutPage() {
  const { items, ready } = useCart();
  const signature = JSON.stringify(items);

  const [loaded, setLoaded] = useState<LoadedData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [retry, setRetry] = useState(0);

  const [fulfillment, setFulfillment] =
    useState<"pickup" | "delivery">("pickup");
  const [city, setCity] = useState("dakar");
  const [pickupId, setPickupId] = useState("");
  const [addressChoice, setAddressChoice] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const cityChosen = useRef(false);

  const [pending, setPending] = useState<PendingRequest | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [trackingError, setTrackingError] = useState("");
  const [trackingBusy, setTrackingBusy] = useState(false);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);

  const sending = useRef(false);
  const confirmationRef = useRef<HTMLHeadingElement>(null);
  const refreshOrderRef = useRef<(() => void) | null>(null);
  const orderId = order?.id;

  useEffect(() => {
    if (!ready || order) return;

    const controller = new AbortController();
    const snapshot: CartItem[] = JSON.parse(signature);

    async function load() {
      try {
        const meResponse = await authenticatedGet(
          "/api/users/me/",
          controller.signal,
        );

        if (controller.signal.aborted) return;

        if (meResponse.status === 401) {
          setNeedsLogin(true);
          return;
        }

        if (!meResponse.ok) {
          throw new Error("Impossible de vérifier votre connexion.");
        }

        const user: User = await meResponse.json();

        // Une demande incertaine est récupérée avant tout nouvel envoi.
        const saved = sessionStorage.getItem(pendingKey(user.id));

        if (saved) {
          const previous: PendingRequest = JSON.parse(saved);

          if (
            previous.userId !== user.id ||
            !previous.body?.request_key ||
            !Array.isArray(previous.cart)
          ) {
            throw new Error(
              "La demande précédente ne peut pas être récupérée.",
            );
          }

          if (!controller.signal.aborted) {
            setPending(previous);
            setLoaded({
              signature,
              user,
              lastPhone: "",
              addresses: [],
              addressesUnavailable: false,
              points: [],
              products: [],
            });
            setLoadError("");
            setNeedsLogin(false);
          }

          return;
        }

        const [pointsResponse, products, lastPhone, addressBook] = await Promise.all([
          fetch("/api/orders/pickup-points/", {
            cache: "no-store",
            headers: { Accept: "application/json" },
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(15000),
            ]),
          }),
          Promise.all(
            snapshot.map((item) =>
              fetchCartProduct(item.slug, controller.signal),
            ),
          ),
          loadLastPhone(controller.signal),
          loadAddressBook(controller.signal),
        ]);

        if (!pointsResponse.ok) {
          throw new Error("Impossible de charger les points de retrait.");
        }

        const points: PickupPoint[] = await pointsResponse.json();

        if (!controller.signal.aborted) {
          setLoaded({ signature, user, points, products, lastPhone, ...addressBook });
          setLoadError("");
          setNeedsLogin(false);
        }
      } catch (caught) {
        if (!controller.signal.aborted) {
          setLoadError(
            caught instanceof Error
              ? caught.message
              : "Impossible de préparer votre commande.",
          );
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [ready, signature, retry, order]);

  useEffect(() => {
    if (orderId) confirmationRef.current?.focus();
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;
    const tracking = startOrderRefresh(async (signal) => {
      setTrackingBusy(true);
      try {
        const response = await authenticatedGet(`/api/orders/${orderId}/`, signal);
        if (signal.aborted) return false;
        if (response.status === 401 || response.status === 403) {
          setNeedsLogin(true);
          return false;
        }
        if (response.status === 404) {
          setNeedsLogin(true);
          return false;
        }
        if (!response.ok) throw new Error("Impossible de vérifier le suivi pour le moment.");
        const current: Order = await response.json();
        if (current.id !== orderId || !current.status_label || !current.payment_status_label) {
          throw new Error("Les informations de suivi sont incomplètes.");
        }
        if (!signal.aborted) {
          setOrder(current);
          setCheckedAt(Date.now());
          setTrackingError("");
          setNeedsLogin(false);
        }
      } catch (caught) {
        if (!signal.aborted) setTrackingError(caught instanceof Error ? caught.message : "La connexion a été interrompue.");
      } finally {
        if (!signal.aborted) setTrackingBusy(false);
      }
      return true;
    });
    refreshOrderRef.current = tracking.refresh;
    return () => {
      tracking.stop();
      refreshOrderRef.current = null;
    };
  }, [orderId]);

  async function sendRequest(request: PendingRequest) {
    if (sending.current) return;

    sending.current = true;
    setBusy(true);
    setError("");

    try {
      // Renouvelle la connexion si nécessaire avant l’envoi.
      const meResponse = await authenticatedGet("/api/users/me/");

      if (meResponse.status === 401) {
        throw new Error(
          "Votre session a expiré. Reconnectez-vous, puis revenez ici.",
        );
      }

      if (!meResponse.ok) {
        throw new Error("Impossible de vérifier votre connexion.");
      }

      const currentUser: User = await meResponse.json();

      if (currentUser.id !== request.userId) {
        throw new Error(
          "Reconnectez-vous au compte utilisé pour cette demande.",
        );
      }

      const csrfResponse = await fetch("/api/users/csrf/", {
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });

      if (!csrfResponse.ok) {
        throw new Error("Impossible de préparer l’envoi.");
      }

      const csrf: { csrfToken: string } = await csrfResponse.json();

      if (typeof csrf.csrfToken !== "string") {
        throw new Error("Impossible de préparer l’envoi.");
      }

      const response = await fetch("/api/orders/", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRFToken": csrf.csrfToken,
        },
        body: JSON.stringify(request.body),
        signal: AbortSignal.timeout(20000),
      });

      const result: unknown = await response.json();

      if (!response.ok) {
        // Un refus de validation signifie qu’aucune commande
        // n’a été créée : le client peut corriger le formulaire.
        if (response.status === 400) {
          sessionStorage.removeItem(pendingKey(request.userId));
          setPending(null);
          setRetry((value) => value + 1);
        }

        throw new Error(
          errorText(result) || "L’envoi n’a pas pu être confirmé.",
        );
      }

      const savedOrder = result as Order;

      if (!savedOrder.id || !savedOrder.status_label) {
        throw new Error("La réponse du serveur est incomplète.");
      }

      // La confirmation s’affiche même si le nettoyage local échoue.
      setOrder(savedOrder);

      try {
        const cleared = clearCartIfUnchanged(request.cart);
        sessionStorage.removeItem(pendingKey(request.userId));
        setPending(null);

        if (!cleared) {
          setNotice(
            "Votre panier a changé pendant l’envoi et a été conservé. Vérifiez-le avant une nouvelle demande.",
          );
        }
      } catch {
        setNotice(
          "Votre demande est enregistrée, mais le panier n’a pas pu être nettoyé. Ne renvoyez pas les mêmes articles.",
        );
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "La connexion a été interrompue. Réessayez la même demande.",
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  function applySavedAddress(address: SavedAddress, explicit = true) {
    setAddressChoice(String(address.id));
    setCity(address.city);
    setPickupId("");
    setDeliveryAddress(address.delivery_address);
    // La proposition par défaut ne remplace pas les coordonnées déjà saisies.
    if (explicit || customerName === null) setCustomerName(address.customer_name);
    if (explicit || customerPhone === null) setCustomerPhone(address.phone);
  }

  function chooseFulfillment(value: "pickup" | "delivery") {
    setFulfillment(value);
    if (value === "delivery" && addressChoice === null) {
      const preferred = loaded?.addresses.find((address) => address.is_default);
      if (preferred && (!cityChosen.current || preferred.city === city)) {
        applySavedAddress(preferred, false);
      } else setAddressChoice("");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !loaded || sending.current || pending || invalidCart ||
      (fulfillment === "pickup" && !selectedPoint)
    ) return;

    const form = new FormData(event.currentTarget);

    const request: PendingRequest = {
      userId: loaded.user.id,
      cart: items.map((item) => ({ ...item })),
      body: {
        request_key: crypto.randomUUID(),
        customer_name: String(form.get("customer_name") ?? "").trim(),
        phone: String(form.get("phone") ?? "").trim(),
        fulfillment,
        city,
        delivery_address:
          fulfillment === "delivery"
            ? String(form.get("delivery_address") ?? "").trim()
            : "",
        pickup_point_id:
          fulfillment === "pickup" ? selectedPoint!.id : null,
        payment_method: String(form.get("payment_method") ?? ""),
        customer_note: String(form.get("customer_note") ?? "").trim(),
        items: items.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
        })),
      },
    };

    try {
      // Enregistrement avant l’appel réseau pour conserver la même
      // clé en cas d’actualisation ou de réponse perdue.
      sessionStorage.setItem(
        pendingKey(request.userId),
        JSON.stringify(request),
      );

      setPending(request);
      void sendRequest(request);
    } catch {
      setError(
        "Votre navigateur ne permet pas de conserver la demande. Autorisez le stockage du site avant de continuer.",
      );
    }
  }

  const points = loaded?.points.filter((point) => point.city === city) ?? [];
  const deliveryFee = fulfillment === "delivery" && city === "dakar" ? 1500 : 0;
  const selectedPoint = points.find(
    (point) => String(point.id) === pickupId,
  ) ?? (points.length === 1 ? points[0] : undefined);
  const cityLabel = cities.find((item) => item.value === city)?.label;

  const loadedCurrentCart = loaded?.signature === signature;

  const invalidCart =
    !loadedCurrentCart ||
    items.length === 0 ||
    items.some((item, index) => {
      const product = loaded?.products[index];

      return (
        !product ||
        product.id !== item.id ||
        product.available_quantity < item.quantity
      );
    });

  const subtotal = items.reduce((total, item, index) => {
    const product = loaded?.products[index];
    return total + (product ? Number(product.price) * item.quantity : 0);
  }, 0);

  let content;

  if (order && !needsLogin) {
    content = (
      <section className="mx-auto max-w-2xl rounded-2xl border border-[#DCE5DC] bg-white p-6 sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#86682E]">
          Merci pour votre commande
        </p>

        <h1
          ref={confirmationRef}
          tabIndex={-1}
          className="mt-4 font-[Georgia] text-3xl outline-none sm:text-4xl"
        >
          {order.status === "confirmed"
            ? "Votre commande est confirmée."
            : order.status === "ready" ? "Votre commande est prête."
            : order.status === "shipped" ? "Votre commande est en route."
            : order.status === "completed" ? "Votre commande est terminée."
            : order.status === "cancelled" ? "Votre commande est annulée."
            : "Votre commande est enregistrée."}
        </h1>

        <p className="mt-5 rounded-lg bg-[#EDF5EE] p-4 text-sm">
          {order.status_label}
        </p>

        <div className="mt-4"><OrderSyncStatus checkedAt={checkedAt} error={trackingError} refreshing={trackingBusy} onRefresh={() => refreshOrderRef.current?.()} /></div>

        <p className="mt-6 text-xs text-[#647168]">Référence à conserver</p>
        <p className="mt-1 break-all font-mono text-sm">{order.id}</p>

        <dl className="mt-7 space-y-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt>Produits</dt>
            <dd>{money(Number(order.subtotal))}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>
              {order.fulfillment === "pickup" ? "Retrait" : "Livraison"}
            </dt>
            <dd>
              {order.delivery_fee === null
                ? "À confirmer"
                : money(Number(order.delivery_fee))}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-[#E1E7DD] pt-4 font-semibold">
            <dt>Total</dt>
            <dd>
              {order.total === null
                ? "À confirmer"
                : money(Number(order.total))}
            </dd>
          </div>
        </dl>

        <p className="mt-7 whitespace-pre-line text-sm leading-7 text-[#647168]">
          {order.fulfillment === "pickup"
            ? `${order.pickup_name} — ${order.city_label}\n${order.pickup_address}`
            : `${order.city_label}\n${order.delivery_address}`}
        </p>

        <p className="mt-5 text-sm leading-7 text-[#647168]">
          {order.status === "cancelled"
            ? "Cette commande a été annulée. Vous pouvez la retrouver dans votre historique."
            : order.status === "completed"
            ? "Vos articles vous ont été remis. Merci pour votre confiance."
            : order.status === "ready"
            ? "Vos articles vous attendent au point de retrait indiqué."
            : order.status === "shipped"
            ? "Votre commande est en cours de livraison à l’adresse indiquée."
            : order.fulfillment === "delivery"
            ? order.delivery_fee === null
              ? "Les frais de cette ancienne commande restent à préciser."
              : "Les frais de livraison sont inclus dans le total de votre commande."
            : "Vos articles seront préparés pour le point de retrait indiqué. Nous vous préciserons quand les récupérer."}
        </p>

        <p className="mt-3 text-sm">
          Paiement choisi :{" "}
          {order.payment_method === "wave" ? "Wave" : "Orange Money"}.
          {" "}Paiement : {order.payment_status_label}.
        </p>

        {order.payment_instructions && !trackingError && <div className="mt-6"><PaymentInstructions instructions={order.payment_instructions} /></div>}
        {notice && (
          <p role="status" className="mt-5 rounded-lg bg-[#FFF6E4] p-4 text-sm">
            {notice}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link href="/mes-commandes" className={buttonStyle}>
            Voir mes commandes →
          </Link>
          <Link href="/" className="inline-flex min-h-12 items-center px-3 text-sm underline underline-offset-4">
            Retour à la boutique
          </Link>
        </div>
      </section>
    );
  } else if (needsLogin) {
    content = (
      <section className="rounded-2xl bg-white p-8 text-center">
        <h1 className="font-[Georgia] text-3xl">Connectez-vous pour continuer.</h1>
        <p className="mt-4 text-sm text-[#647168]">
          {order ? "Reconnectez-vous pour retrouver le suivi dans vos commandes." : "Votre panier sera conservé pendant la connexion."}
        </p>
        <Link href={order ? "/connexion?next=/mes-commandes" : "/connexion?next=/commande"} className={`${buttonStyle} mt-7`}>
          Se connecter
        </Link>
      </section>
    );
  } else if (pending) {
    content = (
      <section className="mx-auto max-w-2xl rounded-2xl bg-white p-8">
        <h1 className="font-[Georgia] text-3xl">
          {busy ? "Envoi de votre demande…" : "Vérifier votre demande"}
        </h1>
        <p className="mt-4 text-sm leading-7 text-[#647168]">
          {busy
            ? "Patientez pendant l’enregistrement."
            : "Une demande est en cours ou sa réponse n’a pas été reçue. Réessayez avec le bouton ci-dessous : la même référence sera utilisée pour éviter un doublon."}
        </p>
        <p className="mt-4 text-sm">
          Destinataire : {pending.body.customer_name}
        </p>

        {error && (
          <p role="alert" className="mt-5 rounded-lg bg-[#FFF0EE] p-4 text-sm text-[#96392D]">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => void sendRequest(pending)}
          className={`${buttonStyle} mt-6`}
        >
          {busy ? "Envoi en cours…" : "Vérifier et réessayer"}
        </button>

        {!busy && (
          <Link
            href="/connexion?next=/commande"
            className="mt-5 block text-sm underline underline-offset-4"
          >
            Me reconnecter si nécessaire
          </Link>
        )}
      </section>
    );
  } else if (loadError) {
    content = (
      <section className="rounded-2xl bg-white p-8">
        <p role="alert">{loadError}</p>
        <button
          type="button"
          onClick={() => {
            setLoadError("");
            setRetry((value) => value + 1);
          }}
          className={`${buttonStyle} mt-5`}
        >
          Réessayer
        </button>
      </section>
    );
  } else if (!ready || !loadedCurrentCart) {
    content = <p role="status" className="py-16">Préparation de votre commande…</p>;
  } else if (items.length === 0) {
    content = (
      <section className="rounded-2xl bg-white p-10 text-center">
        <h1 className="font-[Georgia] text-3xl">Votre panier est vide.</h1>
        <Link href="/#catalogue" className={`${buttonStyle} mt-7`}>
          Découvrir la sélection
        </Link>
      </section>
    );
  } else {
    content = (
      <>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#86682E]">
          Votre sélection, bientôt chez vous
        </p>
        <h1 className="mt-3 font-[Georgia] text-4xl sm:text-5xl">
          Ma commande
        </h1>
        <p className="mb-7 mt-3 text-sm leading-6 text-[#647168]">
          Vérifiez vos coordonnées, choisissez la réception, puis confirmez.
        </p>

        <form onSubmit={handleSubmit} className="grid items-start gap-7 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-4">
            <fieldset className="min-w-0 rounded-2xl border border-[#E1E7DD] bg-white p-5 sm:p-6">
              <legend className="sr-only">Vos coordonnées</legend>
              <h2 className="flex items-center gap-3 font-[Georgia] text-xl sm:text-2xl">
                <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#F0F5EE] font-sans text-xs font-semibold">1</span>
                Vos coordonnées
              </h2>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-sm">
                  Nom complet
                  <input
                    name="customer_name"
                    autoComplete="name"
                    required
                    maxLength={200}
                    value={customerName ?? `${loaded?.user.first_name ?? ""} ${loaded?.user.last_name ?? ""}`.trim()}
                    onChange={(event) => setCustomerName(event.target.value)}
                    className={inputStyle}
                  />
                </label>

                <div className="text-sm">
                  <label htmlFor="checkout-phone">Téléphone</label>
                  <input
                    id="checkout-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    required
                    maxLength={30}
                    placeholder="77 123 45 67"
                    value={customerPhone ?? loaded?.lastPhone ?? ""}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    aria-describedby={customerPhone === null && loaded?.lastPhone ? "phone-hint" : undefined}
                    className={inputStyle}
                  />
                  {customerPhone === null && loaded?.lastPhone && (
                    <span id="phone-hint" className="mt-2 block text-xs leading-5 text-[#647168]">
                      Repris de votre dernière commande. Modifiable ici.
                    </span>
                  )}
                </div>
              </div>
            </fieldset>

            <fieldset className="min-w-0 rounded-2xl border border-[#E1E7DD] bg-white p-5 sm:p-6">
              <legend className="sr-only">Réception des articles</legend>
              <h2 className="flex items-center gap-3 font-[Georgia] text-xl sm:text-2xl">
                <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#F0F5EE] font-sans text-xs font-semibold">2</span>
                Comment recevoir vos articles ?
              </h2>

              <fieldset className="mt-5 min-w-0">
                <legend className="text-sm font-medium">Votre ville</legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {cities.map((item) => (
                    <label key={item.value} className="cursor-pointer">
                      <input
                        type="radio"
                        name="city"
                        value={item.value}
                        checked={city === item.value}
                        onChange={() => {
                          cityChosen.current = true;
                          setCity(item.value);
                          setPickupId("");
                          if (addressChoice) {
                            setAddressChoice("");
                            setDeliveryAddress("");
                          }
                        }}
                        className="peer sr-only"
                      />
                      <span className="inline-flex min-h-11 items-center rounded-full border border-[#DCE5DC] px-4 text-sm transition-colors hover:border-[#173D2B] peer-checked:border-[#173D2B] peer-checked:bg-[#173D2B] peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#1F633F]">
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  { value: "pickup", title: "Je récupère sur place", text: "Gratuit", detail: "Dans votre point de retrait" },
                  { value: "delivery", title: "Je me fais livrer", text: city === "dakar" ? "1 500 FCFA" : "Gratuit", detail: `À votre adresse à ${cityLabel}` },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#1F633F] ${
                      fulfillment === option.value
                        ? "border-[#173D2B] bg-[#F0F5EE]"
                        : "border-[#DCE5DC]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="fulfillment"
                      value={option.value}
                      checked={fulfillment === option.value}
                      onChange={() =>
                        chooseFulfillment(option.value as "pickup" | "delivery")
                      }
                      className="mt-1 accent-[#173D2B]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{option.title}</span>
                      <span className="mt-1 block text-xs leading-5 text-[#647168]">{option.detail}</span>
                      <span className="mt-3 inline-block text-sm font-semibold">{option.text}</span>
                    </span>
                  </label>
                ))}
              </div>

              {fulfillment === "delivery" && (
                <div className="mt-5 rounded-xl border border-[#DCE5DC] bg-[#F5F8F3] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Mon carnet d’adresses</p>
                    <Link href="/mes-adresses" className="inline-flex min-h-11 items-center text-xs underline underline-offset-4 hover:text-[#86682E]">Gérer mes adresses ↗</Link>
                  </div>
                  {loaded?.addresses.length ? (
                    <>
                      <label htmlFor="saved-delivery-address" className="block text-xs text-[#647168]">Choisir une adresse enregistrée</label>
                        <select id="saved-delivery-address" value={addressChoice ?? ""} onChange={(event) => {
                          const selected = loaded.addresses.find((address) => String(address.id) === event.target.value);
                          if (selected) applySavedAddress(selected);
                          else { setAddressChoice(""); setDeliveryAddress(""); }
                        }} className={inputStyle}>
                          <option value="">Saisir une autre adresse</option>
                          {loaded.addresses.map((address) => <option key={address.id} value={address.id}>{address.label} — {address.city_label}{address.is_default ? " · Par défaut" : ""}</option>)}
                        </select>
                      <p className="mt-2 text-xs leading-5 text-[#647168]">La sélection remplit vos coordonnées et la livraison. Les modifications ci-dessous concernent uniquement cette commande.</p>
                    </>
                  ) : <p className="text-xs leading-6 text-[#647168]">{loaded?.addressesUnavailable ? "Vos adresses enregistrées sont momentanément indisponibles. Vous pouvez saisir l’adresse ci-dessous." : "Vous pouvez saisir votre adresse ci-dessous ou en enregistrer une dans votre carnet."}</p>}
                </div>
              )}

              {fulfillment === "pickup" ? (
                <fieldset className="mt-5 min-w-0">
                  <legend className="text-sm font-medium">
                    {points.length === 1 ? "Votre point de retrait" : "Choisissez votre point de retrait"}
                  </legend>
                  {points.length === 0 && (
                    <p role="status" className="mt-3 text-sm text-[#96392D]">
                      Aucun point de retrait n’est disponible dans cette ville.
                    </p>
                  )}
                  <div className="mt-3 space-y-2">
                    {points.map((point) => (
                      <label key={point.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#1F633F] ${selectedPoint?.id === point.id ? "border-[#CAD8CB] bg-[#F4F7F1]" : "border-[#DCE5DC]"}`}>
                        <input
                          type="radio"
                          name="pickup_point_id"
                          value={point.id}
                          checked={selectedPoint?.id === point.id}
                          onChange={() => setPickupId(String(point.id))}
                          required
                          className="mt-1 shrink-0 accent-[#173D2B]"
                        />
                        <span className="min-w-0 text-sm">
                          <span className="block font-semibold">{point.name}</span>
                          <span className="mt-1 block whitespace-pre-line leading-6 text-[#647168]">{point.address}</span>
                          {point.opening_hours && <span className="mt-1 block text-xs leading-5 text-[#647168]">{point.opening_hours}</span>}
                          {point.phone && <span className="block text-xs leading-5 text-[#647168]">Téléphone : {point.phone}</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : (
                <div className="mt-5 text-sm">
                  <label htmlFor="checkout-delivery-address">Adresse de livraison</label>
                  <textarea
                    id="checkout-delivery-address"
                    name="delivery_address"
                    autoComplete="street-address"
                    required
                    maxLength={1000}
                    rows={2}
                    value={deliveryAddress}
                    onChange={(event) => setDeliveryAddress(event.target.value)}
                    placeholder="Quartier, rue, numéro de maison et repère…"
                    className={`${inputStyle} py-3`}
                  />
                  <span className="mt-2 block text-xs leading-6 text-[#647168]">
                    {city === "dakar"
                      ? "Livraison à Dakar : tarif fixe de 1 500 FCFA."
                      : "La livraison est gratuite à Touba et Tambacounda."}
                  </span>
                </div>
              )}
            </fieldset>

            <fieldset className="min-w-0 rounded-2xl border border-[#E1E7DD] bg-white p-5 sm:p-6">
              <legend className="sr-only">Mode de paiement</legend>
              <h2 className="flex items-center gap-3 font-[Georgia] text-xl sm:text-2xl">
                <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#F0F5EE] font-sans text-xs font-semibold">3</span>
                Votre paiement
              </h2>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  { value: "wave", label: "Wave" },
                  { value: "orange_money", label: "Orange Money" },
                ].map((method) => (
                  <label key={method.value} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-[#DCE5DC] px-4 text-sm font-semibold has-checked:border-[#173D2B] has-checked:bg-[#F0F5EE] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#1F633F]">
                    <input
                      type="radio"
                      name="payment_method"
                      value={method.value}
                      required
                      defaultChecked={method.value === "wave"}
                      className="accent-[#173D2B]"
                    />
                    {method.label}
                  </label>
                ))}
              </div>

              <p className="mt-4 text-xs leading-6 text-[#647168]">
                Les instructions s’afficheront après confirmation. Ce bouton ne déclenche aucun débit.
              </p>
            </fieldset>

            <details className="rounded-xl border border-[#E1E7DD] bg-white px-5 py-4">
              <summary className="cursor-pointer text-sm font-medium marker:text-[#86682E] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F633F]">
                Ajouter une précision <span className="font-normal text-[#647168]">(facultatif)</span>
              </summary>
              <label className="mt-4 block text-sm">
                Votre message
                <textarea name="customer_note" rows={2} maxLength={1000} placeholder="Une indication utile pour préparer votre commande…" className={`${inputStyle} py-3`} />
              </label>
            </details>
          </div>

          <aside aria-label="Récapitulatif de votre commande" className="min-w-0 rounded-2xl bg-[#173D2B] p-6 text-white lg:sticky lg:top-6">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#E3C783]">
              Votre sélection
            </p>
            <h2 className="mt-3 font-[Georgia] text-3xl">Récapitulatif</h2>

            <ul className="mt-6 space-y-4">
              {items.map((item, index) => {
                const product = loaded?.products[index];

                return (
                  <li key={item.id} className="flex justify-between gap-4 text-sm leading-6">
                    <span className="min-w-0 break-words">
                      <span className="line-clamp-2">{product?.name ?? "Produit indisponible"}</span>
                      <span className="mt-1 block text-xs text-[#C9D7CD]">Quantité : {item.quantity}</span>
                    </span>
                    <span className="shrink-0">
                      {product ? money(Number(product.price) * item.quantity) : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-5 rounded-lg bg-white/5 px-3 py-3 text-xs leading-5" aria-live="polite">
              <p className="font-semibold">{fulfillment === "pickup" ? "Retrait" : "Livraison"} à {cityLabel}</p>
              {fulfillment === "pickup" && (
                <p className="mt-1 text-[#C9D7CD]">{selectedPoint?.name ?? (points.length ? "Choisissez un point de retrait." : "Aucun point de retrait disponible.")}</p>
              )}
            </div>

            <dl className="mt-6 space-y-4 border-t border-white/20 pt-6 text-sm">
              <div className="flex justify-between gap-3">
                <dt>Produits</dt>
                <dd>{invalidCart ? "À vérifier" : money(subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>{fulfillment === "pickup" ? "Retrait" : "Livraison"}</dt>
                <dd>{deliveryFee === 0 ? "Gratuit" : money(deliveryFee)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-white/20 pt-4 font-semibold">
                <dt>Total</dt>
                <dd aria-live="polite" aria-atomic="true" className="text-xl">
                  {invalidCart
                    ? "À vérifier"
                    : money(subtotal + deliveryFee)}
                </dd>
              </div>
            </dl>

            {invalidCart && (
              <p role="alert" className="mt-5 text-sm leading-6 text-[#F3D591]">
                Un article est indisponible ou sa quantité dépasse le stock.
                Corrigez votre panier avant de continuer.
              </p>
            )}

            {error && (
              <p role="alert" className="mt-5 rounded-lg bg-white p-4 text-sm text-[#96392D]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={
                invalidCart ||
                busy ||
                (fulfillment === "pickup" && !selectedPoint)
              }
              className="mt-6 min-h-14 w-full rounded-lg bg-[#E3C783] px-4 text-sm font-semibold text-[#173D2B] transition-colors hover:bg-[#EED69D] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E3C783] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Confirmer ma commande
            </button>

            <Link href="/panier" className="mt-3 block py-2 text-center text-xs underline underline-offset-4">
              Modifier mon panier
            </Link>
          </aside>
        </form>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7F5] text-[#173D2B]">
      <header className="border-b border-[#E1E7DD] bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-6 sm:px-8">
          <Link
            href="/"
            aria-label="KeurMayata — Accueil"
            className="relative block aspect-[4/1] w-[190px] overflow-hidden"
          >
            <Image
              src="/keurmayata-logo-original.png"
              alt="KeurMayata"
              width={1448}
              height={1086}
              className="absolute left-0 top-[-64%] h-auto w-full max-w-none"
            />
          </Link>
          <Link href="/panier" className="text-sm hover:underline">
            ← Mon panier
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-12">
        {content}
      </main>
      <SiteFooter />
    </div>
  );
}
