import re
from django.conf import settings

from rest_framework import serializers

from .models import City, Order, OrderItem, PickupPoint


class StrictSerializer(serializers.Serializer):
    def to_internal_value(self, data):
        if isinstance(data, dict):
            unknown = set(data) - set(self.fields)

            if unknown:
                raise serializers.ValidationError({
                    field: "Ce champ n’est pas accepté."
                    for field in sorted(unknown)
                })

        return super().to_internal_value(data)


class OrderItemInputSerializer(StrictSerializer):
    product_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(
        min_value=1,
        max_value=99,
    )


class OrderCreateSerializer(StrictSerializer):
    request_key = serializers.UUIDField()
    customer_name = serializers.CharField(max_length=200)
    phone = serializers.CharField(max_length=30)
    fulfillment = serializers.ChoiceField(
        choices=Order.Fulfillment.choices,
    )
    city = serializers.ChoiceField(choices=City.choices)
    delivery_address = serializers.CharField(
        max_length=1000,
        required=False,
        allow_blank=True,
        default="",
    )
    pickup_point_id = serializers.IntegerField(
        min_value=1,
        required=False,
        allow_null=True,
        default=None,
    )
    payment_method = serializers.ChoiceField(
        choices=Order.PaymentMethod.choices,
    )
    customer_note = serializers.CharField(
        max_length=1000,
        required=False,
        allow_blank=True,
        default="",
    )
    items = OrderItemInputSerializer(
        many=True,
        allow_empty=False,
        max_length=50,
    )

    def validate_phone(self, value):
        value = re.sub(r"[\s().-]", "", value)

        if value.startswith("00221"):
            value = "+221" + value[5:]

        if re.fullmatch(r"[0-9]{9}", value):
            value = "+221" + value

        if not re.fullmatch(r"\+221[0-9]{9}", value):
            raise serializers.ValidationError(
                "Saisissez un numéro sénégalais de 9 chiffres, "
                "avec ou sans +221."
            )

        return value

    def validate_items(self, items):
        ids = [item["product_id"] for item in items]

        if len(ids) != len(set(ids)):
            raise serializers.ValidationError(
                "Un produit ne doit apparaître qu’une seule fois."
            )

        return items

    def validate(self, data):
        if data["fulfillment"] == Order.Fulfillment.PICKUP:
            if data["pickup_point_id"] is None:
                raise serializers.ValidationError({
                    "pickup_point_id": "Choisissez un point de retrait.",
                })

            if data["delivery_address"]:
                raise serializers.ValidationError({
                    "delivery_address": (
                        "L’adresse de livraison doit être vide "
                        "pour un retrait."
                    ),
                })

        else:
            if not data["delivery_address"]:
                raise serializers.ValidationError({
                    "delivery_address": "Renseignez votre adresse.",
                })

            if data["pickup_point_id"] is not None:
                raise serializers.ValidationError({
                    "pickup_point_id": (
                        "Ne choisissez pas de point de retrait "
                        "pour une livraison."
                    ),
                })

        return data


class PickupPointSerializer(serializers.ModelSerializer):
    city_label = serializers.CharField(
        source="get_city_display",
        read_only=True,
    )

    class Meta:
        model = PickupPoint
        fields = (
            "id",
            "name",
            "city",
            "city_label",
            "address",
            "opening_hours",
            "phone",
        )


class OrderItemSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    def get_image(self, obj):
        image = obj.product.image
        return image.url if image else None

    line_total = serializers.DecimalField(
        max_digits=16,
        decimal_places=0,
        read_only=True,
    )

    class Meta:
        model = OrderItem
        fields = (
            "product_id",
            "product_name",
            "image",
            "unit_price",
            "quantity",
            "line_total",
        )


class OrderSerializer(serializers.ModelSerializer):
    payment_instructions = serializers.SerializerMethodField()

    def get_payment_instructions(self, obj):
        if (
            obj.payment_status != Order.PaymentStatus.UNPAID
            or obj.status != Order.Status.CONFIRMED
            or obj.total is None
        ):
            return None
        recipient = settings.MANUAL_PAYMENT_RECIPIENTS.get(obj.payment_method, {})
        phone = recipient.get("phone", "")
        name = recipient.get("name", "")
        available = bool(
            settings.MANUAL_PAYMENTS_ENABLED
            and re.fullmatch(r"\+221[0-9]{9}", phone)
            and name
        )
        return {
            "available": available,
            "test_mode": settings.MANUAL_PAYMENTS_TEST_MODE,
            "method_label": obj.get_payment_method_display(),
            "amount": str(obj.total),
            "reference": str(obj.pk),
            "recipient_phone": phone if available else None,
            "recipient_name": name if available else None,
        }

    items = OrderItemSerializer(many=True, read_only=True)
    payment_status_label = serializers.CharField(
        source="get_payment_status_display",
        read_only=True,
    )
    status_label = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )
    city_label = serializers.CharField(
        source="get_city_display",
        read_only=True,
    )
    total = serializers.DecimalField(
        max_digits=16,
        decimal_places=0,
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = Order
        fields = (
            "id",
            "request_key",
            "customer_name",
            "phone",
            "fulfillment",
            "city",
            "city_label",
            "delivery_address",
            "pickup_point_id",
            "pickup_name",
            "pickup_address",
            "payment_method",
            "status",
            "status_label",
            "payment_status",
            "payment_status_label",
            "payment_instructions",
            "subtotal",
            "delivery_fee",
            "total",
            "customer_note",
            "items",
            "created_at",
        )
        read_only_fields = fields
