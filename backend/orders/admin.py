from django.contrib import admin, messages
from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import Order, OrderItem, PickupPoint
from .services import advance_order, cancel_unpaid_order


@admin.register(PickupPoint)
class PickupPointAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "city",
        "phone",
        "is_active",
    )
    list_filter = ("city", "is_active")
    search_fields = ("name", "address", "phone")
    fields = (
        "name",
        "city",
        "address",
        "opening_hours",
        "phone",
        "is_active",
    )


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    can_delete = False

    fields = (
        "product",
        "product_name",
        "unit_price",
        "quantity",
        "line_amount",
    )
    readonly_fields = fields

    @admin.display(description="Montant en FCFA")
    def line_amount(self, obj):
        return obj.line_total

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "customer_name",
        "city",
        "fulfillment",
        "status",
        "payment_status",
        "payment_method",
        "subtotal",
        "delivery_fee",
        "total_amount",
        "created_at",
    )
    list_filter = (
        "status",
        "payment_status",
        "fulfillment",
        "city",
        "payment_method",
    )
    search_fields = (
        "customer_name",
        "phone",
        "user__email",
    )
    list_select_related = ("user", "pickup_point")
    date_hierarchy = "created_at"
    inlines = (OrderItemInline,)
    actions = (
        "mark_payment_received", "mark_ready", "mark_shipped",
        "mark_completed", "cancel_order",
    )

    readonly_fields = (
        "id",
        "user",
        "request_key",
        "customer_name",
        "phone",
        "fulfillment",
        "city",
        "delivery_address",
        "pickup_point",
        "pickup_name",
        "pickup_address",
        "payment_method",
        "status",
        "payment_status",
        "subtotal",
        "delivery_fee",
        "total_amount",
        "customer_note",
        "created_at",
        "updated_at",
    )

    fieldsets = (
        (
            "Commande",
            {
                "fields": (
                    "id",
                    "user",
                    "status",
                    "created_at",
                    "updated_at",
                ),
            },
        ),
        (
            "Client et réception",
            {
                "fields": (
                    "customer_name",
                    "phone",
                    "fulfillment",
                    "city",
                    "delivery_address",
                    "pickup_point",
                    "pickup_name",
                    "pickup_address",
                    "customer_note",
                ),
            },
        ),
        (
            "Montants et paiement",
            {
                "description": (
                    "Tarifs automatiques : livraison gratuite à Touba et "
                    "Tambacounda, 1 500 FCFA à Dakar. Retrait gratuit "
                    "partout. Les anciennes commandes conservent "
                    "leurs montants enregistrés."
                ),
                "fields": (
                    "subtotal",
                    "delivery_fee",
                    "total_amount",
                    "payment_method",
                    "payment_status",
                ),
            },
        ),
        (
            "Référence technique",
            {
                "classes": ("collapse",),
                "fields": ("request_key",),
            },
        ),
    )

    @transaction.atomic
    def changeform_view(
        self,
        request,
        object_id=None,
        form_url="",
        extra_context=None,
    ):
        return super().changeform_view(
            request,
            object_id,
            form_url,
            extra_context,
        )

    def get_object(self, request, object_id, from_field=None):
        obj = super().get_object(request, object_id, from_field)

        if obj is not None and request.method == "POST":
            # Sérialiser l'enregistrement de la fiche avec les actions.
            obj = (
                Order.objects
                .select_for_update()
                .get(pk=obj.pk)
            )

        return obj

    def save_model(self, request, obj, form, change):
        # La fiche est en lecture seule ; les actions contrôlées
        # enregistrent leurs propres changements.
        pass

    @admin.display(description="Total en FCFA")
    def total_amount(self, obj):
        if obj.total is None:
            return "À préciser"

        return obj.total

    @admin.action(
        description="Enregistrer le paiement reçu et vérifié",
        permissions=["change"],
    )
    def mark_payment_received(self, request, queryset):
        selected_ids = list(
            queryset.values_list("pk", flat=True)[:2]
        )

        if len(selected_ids) != 1:
            self.message_user(
                request,
                "Sélectionnez une seule commande à la fois.",
                level=messages.WARNING,
            )
            return

        with transaction.atomic():
            order = (
                Order.objects
                .select_for_update()
                .get(pk=selected_ids[0])
            )

            if not self.has_change_permission(request, order):
                self.message_user(
                    request,
                    "Vous ne pouvez pas modifier cette commande.",
                    level=messages.ERROR,
                )
                return

            if order.status == Order.Status.CANCELLED:
                self.message_user(
                    request,
                    "Cette commande est annulée.",
                    level=messages.ERROR,
                )
                return

            if order.payment_status == Order.PaymentStatus.PAID:
                self.message_user(
                    request,
                    "Le paiement est déjà enregistré.",
                    level=messages.INFO,
                )
                return

            allowed_statuses = {
                Order.Status.CONFIRMED,
                Order.Status.READY,
                Order.Status.SHIPPED,
                Order.Status.COMPLETED,
            }

            if order.status not in allowed_statuses:
                self.message_user(
                    request,
                    "Cette ancienne demande doit être régularisée "
                    "avant d'enregistrer son paiement.",
                    level=messages.WARNING,
                )
                return

            if order.total is None:
                self.message_user(
                    request,
                    "Cette ancienne commande a des frais inconnus. "
                    "Régularisez-la avant d'enregistrer son paiement.",
                    level=messages.WARNING,
                )
                return

            order.payment_status = Order.PaymentStatus.PAID
            order.save(
                update_fields=["payment_status", "updated_at"]
            )

            self.log_change(
                request,
                order,
                (
                    "Paiement intégral déclaré reçu et vérifié : "
                    f"{order.total} FCFA via "
                    f"{order.get_payment_method_display()}."
                ),
            )

        self.message_user(
            request,
            "Paiement enregistré. Le statut de la commande "
            "reste inchangé.",
            level=messages.SUCCESS,
        )

    @admin.action(
        description="Annuler la commande non payée et remettre en stock",
        permissions=["change"],
    )
    def cancel_order(self, request, queryset):
        selected_ids = list(queryset.values_list("pk", flat=True)[:2])
        if len(selected_ids) != 1:
            self.message_user(request, "Sélectionnez une seule commande à la fois.", messages.WARNING)
            return

        try:
            with transaction.atomic():
                order = Order.objects.select_for_update().get(pk=selected_ids[0])
                if not self.has_change_permission(request, order):
                    self.message_user(request, "Vous ne pouvez pas modifier cette commande.", messages.ERROR)
                    return
                order, changed = cancel_unpaid_order(order.pk)
                if changed:
                    self.log_change(
                        request, order,
                        "Commande non payée annulée. Articles remis en stock. "
                        "Historique et montants conservés.",
                    )
        except ValidationError as error:
            self.message_user(request, " ".join(str(message) for message in error.detail), messages.WARNING)
            return

        self.message_user(
            request,
            "Commande annulée et articles remis en stock."
            if changed else "Cette commande est déjà annulée. Le stock n’a pas été modifié.",
            messages.SUCCESS if changed else messages.INFO,
        )

    def _advance_order(self, request, queryset, target_status):
        selected_ids = list(queryset.values_list("pk", flat=True)[:2])
        if len(selected_ids) != 1:
            self.message_user(request, "Sélectionnez une seule commande à la fois.", messages.WARNING)
            return
        try:
            with transaction.atomic():
                order = Order.objects.select_for_update().get(pk=selected_ids[0])
                if not self.has_change_permission(request, order):
                    self.message_user(request, "Vous ne pouvez pas modifier cette commande.", messages.ERROR)
                    return
                old_label = order.get_status_display()
                order, changed = advance_order(order.pk, target_status)
                if changed:
                    self.log_change(request, order, f"Statut : {old_label} → {order.get_status_display()}.")
        except ValidationError as error:
            self.message_user(request, " ".join(str(message) for message in error.detail), messages.WARNING)
            return
        self.message_user(
            request,
            f"Commande : {order.get_status_display()}." if changed
            else "La commande est déjà à cette étape. Aucun changement effectué.",
            messages.SUCCESS if changed else messages.INFO,
        )

    @admin.action(description="Marquer prête pour retrait", permissions=["change"])
    def mark_ready(self, request, queryset):
        self._advance_order(request, queryset, Order.Status.READY)

    @admin.action(description="Marquer en cours de livraison", permissions=["change"])
    def mark_shipped(self, request, queryset):
        self._advance_order(request, queryset, Order.Status.SHIPPED)

    @admin.action(description="Terminer — articles remis au client", permissions=["change"])
    def mark_completed(self, request, queryset):
        self._advance_order(request, queryset, Order.Status.COMPLETED)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
