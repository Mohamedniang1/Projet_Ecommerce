from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction

from rest_framework.exceptions import APIException, ValidationError

from catalog.models import Product

from .models import Order, OrderItem, PickupPoint


class RequestConflict(APIException):
    status_code = 409
    default_detail = (
        "Cette demande a déjà été utilisée avec un contenu différent. "
        "Créez une nouvelle demande."
    )
    default_code = "request_conflict"


def matches_existing_order(order, data):
    fields = (
        "customer_name",
        "phone",
        "fulfillment",
        "city",
        "delivery_address",
        "pickup_point_id",
        "payment_method",
        "customer_note",
    )

    if any(
        getattr(order, field) != data[field]
        for field in fields
    ):
        return False

    existing_items = sorted(
        (item.product_id, item.quantity)
        for item in order.items.all()
    )
    requested_items = sorted(
        (item["product_id"], item["quantity"])
        for item in data["items"]
    )

    return existing_items == requested_items


@transaction.atomic
def create_order_request(user, data):
    # Deux demandes simultanées du même client sont traitées
    # l’une après l’autre, notamment pour éviter les doublons.
    get_user_model().objects.select_for_update().get(pk=user.pk)

    existing = (
        Order.objects
        .filter(
            user=user,
            request_key=data["request_key"],
        )
        .prefetch_related("items")
        .first()
    )

    if existing:
        if not matches_existing_order(existing, data):
            raise RequestConflict()

        return existing, False

    pickup = None

    if data["fulfillment"] == Order.Fulfillment.PICKUP:
        pickup = (
            PickupPoint.objects
            .select_for_update()
            .filter(
                pk=data["pickup_point_id"],
                is_active=True,
            )
            .first()
        )

        if pickup is None:
            raise ValidationError({
                "pickup_point_id": (
                    "Ce point de retrait n’est plus disponible."
                ),
            })

        if pickup.city != data["city"]:
            raise ValidationError({
                "city": (
                    "La ville ne correspond pas au point de retrait."
                ),
            })

    requested_items = data["items"]
    ids = [item["product_id"] for item in requested_items]

    # Ordre stable de verrouillage pour les demandes concurrentes.
    products = {
        product.pk: product
        for product in (
            Product.objects
            .filter(
                pk__in=ids,
                is_active=True,
                category__is_active=True,
            )
            .order_by("pk")
            .select_for_update(of=("self",))
        )
    }

    errors = []
    subtotal = Decimal("0")

    for item in requested_items:
        product = products.get(item["product_id"])

        if product is None:
            errors.append({
                "product_id": item["product_id"],
                "message": "Ce produit n’est plus disponible.",
            })
            continue

        if item["quantity"] > product.stock:
            errors.append({
                "product_id": product.pk,
                "message": (
                    f"{product.name} : seulement "
                    f"{product.stock} exemplaire(s) disponible(s)."
                ),
            })
            continue

        subtotal += product.price * item["quantity"]

    if errors:
        raise ValidationError({"items": errors})

    delivery_fee = Decimal("1500") if (
        data["fulfillment"] == Order.Fulfillment.DELIVERY
        and data["city"] == "dakar"
    ) else Decimal("0")

    order = Order(
        user=user,
        request_key=data["request_key"],
        customer_name=data["customer_name"],
        phone=data["phone"],
        fulfillment=data["fulfillment"],
        city=data["city"],
        delivery_address=data["delivery_address"],
        pickup_point=pickup,
        pickup_name=pickup.name if pickup else "",
        pickup_address=pickup.address if pickup else "",
        payment_method=data["payment_method"],
        customer_note=data["customer_note"],
        subtotal=subtotal,
        delivery_fee=delivery_fee,
        status=Order.Status.CONFIRMED,
        payment_status=Order.PaymentStatus.UNPAID,
    )

    order.full_clean()
    order.save()

    OrderItem.objects.bulk_create([
        OrderItem(
            order=order,
            product=products[item["product_id"]],
            product_name=products[item["product_id"]].name,
            unit_price=products[item["product_id"]].price,
            quantity=item["quantity"],
        )
        for item in requested_items
    ])

    # Les produits restent verrouillés jusqu’à la fin de la transaction.
    # Le retour anticipé d’une demande déjà enregistrée évite une double déduction.
    for item in requested_items:
        products[item["product_id"]].stock -= item["quantity"]

    Product.objects.bulk_update(list(products.values()), ["stock"])

    return order, True


@transaction.atomic
def cancel_unpaid_order(order_id):
    order = Order.objects.select_for_update().get(pk=order_id)

    if order.status == Order.Status.CANCELLED:
        return order, False

    if order.payment_status != Order.PaymentStatus.UNPAID:
        raise ValidationError(
            "Cette commande est payée. Son annulation nécessite "
            "une procédure de remboursement."
        )

    # Seules les commandes confirmées par le parcours actuel ont
    # déduit leur stock. Les anciennes demandes restent à régulariser.
    # Une commande expédiée ou terminée nécessite un retour physique.
    if order.status not in {Order.Status.CONFIRMED, Order.Status.READY}:
        raise ValidationError(
            "Seule une commande confirmée ou prête pour retrait, "
            "non payée et non expédiée, peut être annulée ici."
        )

    items = list(order.items.all())
    products = {
        product.pk: product
        for product in Product.objects.filter(
            pk__in=[item.product_id for item in items]
        ).order_by("pk").select_for_update()
    }
    for item in items:
        products[item.product_id].stock += item.quantity

    Product.objects.bulk_update(list(products.values()), ["stock"])
    order.status = Order.Status.CANCELLED
    order.save(update_fields=["status", "updated_at"])
    return order, True


@transaction.atomic
def advance_order(order_id, target_status):
    order = Order.objects.select_for_update().get(pk=order_id)
    routes = {
        Order.Status.READY: (Order.Fulfillment.PICKUP, Order.Status.CONFIRMED),
        Order.Status.SHIPPED: (Order.Fulfillment.DELIVERY, Order.Status.CONFIRMED),
        Order.Status.COMPLETED: (
            order.fulfillment,
            Order.Status.READY if order.fulfillment == Order.Fulfillment.PICKUP
            else Order.Status.SHIPPED,
        ),
    }
    if target_status not in routes:
        raise ValidationError("Cette étape de commande n’est pas proposée.")
    fulfillment, source_status = routes[target_status]
    if order.fulfillment != fulfillment:
        raise ValidationError("Cette action ne correspond pas au mode de réception choisi.")
    if order.payment_status != Order.PaymentStatus.PAID:
        raise ValidationError("Enregistrez d’abord le paiement reçu et vérifié.")
    if order.status == target_status:
        return order, False
    if order.status != source_status:
        raise ValidationError(
            f"Cette action nécessite le statut « {Order.Status(source_status).label} ». "
            f"Statut actuel : « {order.get_status_display()} »."
        )
    order.status = target_status
    order.save(update_fields=["status", "updated_at"])
    return order, True
