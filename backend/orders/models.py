import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from config.locations import City


class PickupPoint(models.Model):
    name = models.CharField(
        "nom du point de retrait",
        max_length=150,
    )
    city = models.CharField(
        "ville",
        max_length=20,
        choices=City.choices,
    )
    address = models.TextField(
        "adresse et indications",
    )
    opening_hours = models.CharField(
        "horaires de retrait",
        max_length=250,
        blank=True,
    )
    phone = models.CharField(
        "téléphone",
        max_length=30,
        blank=True,
    )
    is_active = models.BooleanField(
        "proposé aux clients",
        default=False,
        help_text="Activez uniquement lorsque le point est prêt.",
    )

    class Meta:
        ordering = ["city", "name"]
        verbose_name = "point de retrait"
        verbose_name_plural = "points de retrait"

    def __str__(self):
        return f"{self.name} — {self.get_city_display()}"


class Order(models.Model):
    class Fulfillment(models.TextChoices):
        PICKUP = "pickup", "Retrait sur place"
        DELIVERY = "delivery", "Livraison à domicile"

    class PaymentMethod(models.TextChoices):
        WAVE = "wave", "Wave"
        ORANGE_MONEY = "orange_money", "Orange Money"

    class PaymentStatus(models.TextChoices):
        UNPAID = "unpaid", "Non reçu"
        PAID = "paid", "Reçu et vérifié"

    class Status(models.TextChoices):
        AWAITING_QUOTE = (
            "awaiting_quote",
            "Frais de livraison à confirmer",
        )
        AWAITING_ACCEPTANCE = (
            "awaiting_acceptance",
            "En attente d’accord du client",
        )
        AWAITING_PAYMENT = (
            "awaiting_payment",
            "En attente de paiement",
        )
        PAYMENT_REVIEW = (
            "payment_review",
            "Paiement à vérifier",
        )
        CONFIRMED = "confirmed", "Commande confirmée"
        READY = "ready", "Prête pour retrait"
        SHIPPED = "shipped", "En cours de livraison"
        COMPLETED = "completed", "Terminée"
        CANCELLED = "cancelled", "Annulée"

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="orders",
        verbose_name="client",
    )
    request_key = models.UUIDField(
        "identifiant de la demande",
        default=uuid.uuid4,
        editable=False,
        help_text="Permet d’éviter les demandes envoyées en double.",
    )
    customer_name = models.CharField(
        "nom du destinataire",
        max_length=200,
    )
    phone = models.CharField(
        "téléphone du destinataire",
        max_length=30,
    )
    fulfillment = models.CharField(
        "mode de réception",
        max_length=20,
        choices=Fulfillment.choices,
    )
    city = models.CharField(
        "ville",
        max_length=20,
        choices=City.choices,
    )
    delivery_address = models.TextField(
        "adresse de livraison",
        blank=True,
    )
    pickup_point = models.ForeignKey(
        PickupPoint,
        on_delete=models.PROTECT,
        related_name="orders",
        verbose_name="point de retrait",
        null=True,
        blank=True,
    )

    # Ces copies conservent les indications données au client,
    # même si le point de retrait est modifié ultérieurement.
    pickup_name = models.CharField(
        "nom du point lors de la commande",
        max_length=150,
        blank=True,
    )
    pickup_address = models.TextField(
        "adresse du point lors de la commande",
        blank=True,
    )

    payment_method = models.CharField(
        "mode de paiement",
        max_length=20,
        choices=PaymentMethod.choices,
    )
    status = models.CharField(
        "statut",
        max_length=30,
        choices=Status.choices,
        default=Status.CONFIRMED,
    )
    payment_status = models.CharField(
        "statut du paiement",
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.UNPAID,
    )
    subtotal = models.DecimalField(
        "montant des produits en FCFA",
        max_digits=16,
        decimal_places=0,
        validators=[MinValueValidator(0)],
    )
    delivery_fee = models.DecimalField(
        "frais de livraison en FCFA",
        max_digits=10,
        decimal_places=0,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
        help_text=(
            "Non renseigné : à confirmer. "
            "Pour un retrait : 0 FCFA."
        ),
    )
    customer_note = models.TextField(
        "précisions du client",
        max_length=1000,
        blank=True,
    )
    created_at = models.DateTimeField(
        "créée le",
        auto_now_add=True,
    )
    updated_at = models.DateTimeField(
        "modifiée le",
        auto_now=True,
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "commande"
        verbose_name_plural = "commandes"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "request_key"],
                name="orders_unique_user_request",
            ),
            models.CheckConstraint(
                condition=models.Q(subtotal__gte=0),
                name="orders_subtotal_nonnegative",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(delivery_fee__isnull=True)
                    | models.Q(delivery_fee__gte=0)
                ),
                name="orders_delivery_fee_nonnegative",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        fulfillment="pickup",
                        pickup_point__isnull=False,
                        delivery_fee__isnull=False,
                        delivery_fee=0,
                    )
                    | models.Q(
                        fulfillment="delivery",
                        pickup_point__isnull=True,
                    )
                ),
                name="orders_valid_fulfillment",
            ),
        ]

    @property
    def total(self):
        if self.delivery_fee is None:
            return None

        return self.subtotal + self.delivery_fee

    def clean(self):
        super().clean()

        if self.fulfillment == self.Fulfillment.PICKUP:
            if not self.pickup_point_id:
                raise ValidationError({
                    "pickup_point": "Choisissez un point de retrait.",
                })

            if self.delivery_fee != 0:
                raise ValidationError({
                    "delivery_fee": "Le retrait sur place est gratuit.",
                })

            if self.city != self.pickup_point.city:
                raise ValidationError({
                    "city": "La ville doit correspondre au point de retrait.",
                })

        elif self.fulfillment == self.Fulfillment.DELIVERY:
            if not self.delivery_address.strip():
                raise ValidationError({
                    "delivery_address": "Renseignez l’adresse de livraison.",
                })

            if self.pickup_point_id:
                raise ValidationError({
                    "pickup_point": (
                        "Une livraison ne doit pas avoir de point de retrait."
                    ),
                })

    def __str__(self):
        return f"{self.id} — {self.customer_name}"


class OrderItem(models.Model):
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="items",
        verbose_name="commande",
    )
    product = models.ForeignKey(
        "catalog.Product",
        on_delete=models.PROTECT,
        related_name="order_items",
        verbose_name="produit",
    )

    # Le nom et le prix sont conservés au moment de la commande.
    product_name = models.CharField(
        "nom du produit commandé",
        max_length=200,
    )
    unit_price = models.DecimalField(
        "prix unitaire en FCFA",
        max_digits=12,
        decimal_places=0,
        validators=[MinValueValidator(1)],
    )
    quantity = models.PositiveIntegerField(
        "quantité",
        validators=[MinValueValidator(1)],
    )

    class Meta:
        ordering = ["pk"]
        verbose_name = "article commandé"
        verbose_name_plural = "articles commandés"
        constraints = [
            models.UniqueConstraint(
                fields=["order", "product"],
                name="orders_unique_product_per_order",
            ),
            models.CheckConstraint(
                condition=models.Q(quantity__gte=1),
                name="orders_item_quantity_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(unit_price__gte=1),
                name="orders_item_price_positive",
            ),
        ]

    @property
    def line_total(self):
        return self.unit_price * self.quantity

    def __str__(self):
        return f"{self.product_name} × {self.quantity}"
