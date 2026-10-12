import uuid
from unittest.mock import patch
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse

from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from catalog.models import Category, Product

from .models import Order, PickupPoint
from .services import advance_order, cancel_unpaid_order
from rest_framework.exceptions import ValidationError


class OrderRequestTests(TestCase):
    def setUp(self):
        User = get_user_model()

        self.user = User.objects.create_user(
            username="order-client",
            email="order-client@example.com",
            password="Test-Commandes!2026",
        )
        self.other_user = User.objects.create_user(
            username="other-client",
            email="other-client@example.com",
            password="Test-Commandes!2026",
        )

        category = Category.objects.create(
            name="Beauté",
            slug="beaute",
            is_active=True,
        )

        self.product = Product.objects.create(
            category=category,
            name="Huile démaquillante",
            slug="huile",
            price=1500,
            stock=2,
            is_active=True,
        )

        self.pickup = PickupPoint.objects.create(
            name="Cité Fadia",
            city="dakar",
            address="Adresse de test à Dakar",
            is_active=True,
        )

        self.client = APIClient(enforce_csrf_checks=True)
        self.authenticate(self.user)

        csrf = self.client.get(reverse("users:csrf"))
        self.csrf_token = csrf.json()["csrfToken"]

        self.url = reverse("orders:list-create")

    def authenticate(self, user):
        token = RefreshToken.for_user(user)
        self.client.cookies[
            settings.JWT_ACCESS_COOKIE_NAME
        ] = str(token.access_token)

    def payload(self):
        return {
            "request_key": str(uuid.uuid4()),
            "customer_name": "Client Test",
            "phone": "77 123 45 67",
            "fulfillment": "pickup",
            "city": "dakar",
            "pickup_point_id": self.pickup.pk,
            "payment_method": "wave",
            "items": [
                {
                    "product_id": self.product.pk,
                    "quantity": 2,
                },
            ],
        }

    def send(self, data):
        return self.client.post(
            self.url,
            data,
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )

    def test_pickup_is_free_and_uses_database_prices(self):
        response = self.send(self.payload())

        self.assertEqual(response.status_code, 201)

        order = Order.objects.get()

        self.assertEqual(order.user, self.user)
        self.assertEqual(order.phone, "+221771234567")
        self.assertEqual(order.subtotal, Decimal("3000"))
        self.assertEqual(order.delivery_fee, Decimal("0"))
        self.assertEqual(order.total, Decimal("3000"))
        self.assertEqual(
            order.status,
            Order.Status.CONFIRMED,
        )
        self.assertEqual(order.pickup_name, self.pickup.name)

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 0)
        self.assertEqual(order.payment_status, Order.PaymentStatus.UNPAID)
        self.assertEqual(response.data["payment_status"], "unpaid")

    def test_dakar_delivery_has_fixed_fee_and_total(self):
        data = self.payload()
        data.update({
            "fulfillment": "delivery",
            "pickup_point_id": None,
            "delivery_address": "Maison 12, adresse de test",
            "payment_method": "orange_money",
        })

        response = self.send(data)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Decimal(response.data["delivery_fee"]), Decimal("1500"))
        self.assertEqual(Decimal(response.data["total"]), Decimal("4500"))
        self.assertEqual(
            response.data["status"],
            Order.Status.CONFIRMED,
        )
        self.assertEqual(response.data["payment_status"], "unpaid")
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 0)

    def test_delivery_is_free_in_touba_and_tambacounda(self):
        for city in ("touba", "tambacounda"):
            with self.subTest(city=city):
                data = self.payload()
                data.update({
                    "fulfillment": "delivery", "city": city,
                    "pickup_point_id": None,
                    "delivery_address": "Adresse de test",
                })
                data["items"][0]["quantity"] = 1
                response = self.send(data)
                self.assertEqual(response.status_code, 201)
                self.assertEqual(Decimal(response.data["delivery_fee"]), Decimal("0"))
                self.assertEqual(Decimal(response.data["total"]), Decimal("1500"))
                self.assertEqual(response.data["status"], Order.Status.CONFIRMED)

    def test_pickup_is_free_in_each_city(self):
        self.product.stock = 3
        self.product.save(update_fields=["stock"])
        for city in ("dakar", "touba", "tambacounda"):
            with self.subTest(city=city):
                point = PickupPoint.objects.create(
                    name="Retrait test", city=city, address="Adresse de test",
                    is_active=True,
                )
                data = self.payload()
                data.update({"city": city, "pickup_point_id": point.pk})
                data["items"][0]["quantity"] = 1
                response = self.send(data)
                self.assertEqual(response.status_code, 201)
                self.assertEqual(Decimal(response.data["delivery_fee"]), Decimal("0"))
                self.assertEqual(Decimal(response.data["total"]), Decimal("1500"))

    def test_client_cannot_override_dakar_delivery_fee(self):
        data = self.payload()
        data.update({
            "fulfillment": "delivery", "pickup_point_id": None,
            "delivery_address": "Adresse de test", "delivery_fee": "0",
        })
        self.assertEqual(self.send(data).status_code, 400)
        self.assertFalse(Order.objects.exists())

    def test_retry_preserves_previously_recorded_delivery_fee(self):
        data = self.payload()
        data.update({
            "fulfillment": "delivery", "pickup_point_id": None,
            "delivery_address": "Adresse de test",
        })
        self.assertEqual(self.send(data).status_code, 201)
        # Simuler une commande passée avant le changement de tarif.
        Order.objects.update(delivery_fee=Decimal("2000"))
        response = self.send(data)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Decimal(response.data["delivery_fee"]), Decimal("2000"))
        self.assertEqual(Decimal(response.data["total"]), Decimal("5000"))

    def test_same_request_does_not_create_a_second_order(self):
        data = self.payload()

        first = self.send(data)
        second = self.send(data)

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.data["id"], second.data["id"])
        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual(Order.objects.get().items.count(), 1)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 0)

    def test_another_client_cannot_order_stock_already_committed(self):
        self.assertEqual(self.send(self.payload()).status_code, 201)
        self.authenticate(self.other_user)
        self.assertEqual(self.send(self.payload()).status_code, 400)
        self.assertEqual(Order.objects.count(), 1)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 0)

    def test_stock_write_failure_rolls_back_order_and_items(self):
        with patch("orders.services.Product.objects.bulk_update", side_effect=RuntimeError("Stock write failed")):
            with self.assertRaises(RuntimeError):
                self.send(self.payload())
        self.assertFalse(Order.objects.exists())
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 2)

    def test_one_unavailable_item_leaves_other_stock_unchanged(self):
        unavailable = Product.objects.create(
            category=self.product.category, name="Indisponible", slug="indisponible",
            price=1000, stock=0, is_active=True,
        )
        data = self.payload()
        data["items"].append({"product_id": unavailable.pk, "quantity": 1})
        self.assertEqual(self.send(data).status_code, 400)
        self.assertFalse(Order.objects.exists())
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 2)

    def test_reused_key_with_changed_content_is_rejected(self):
        data = self.payload()
        self.send(data)

        data["items"][0]["quantity"] = 1
        response = self.send(data)

        self.assertEqual(response.status_code, 409)
        self.assertEqual(Order.objects.count(), 1)

    def test_insufficient_stock_creates_no_order(self):
        data = self.payload()
        data["items"][0]["quantity"] = 3

        response = self.send(data)

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Order.objects.exists())

    def test_unpublished_product_is_rejected(self):
        self.product.is_active = False
        self.product.save(update_fields=["is_active"])

        response = self.send(self.payload())

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Order.objects.exists())

    def test_inactive_pickup_is_rejected(self):
        self.pickup.is_active = False
        self.pickup.save(update_fields=["is_active"])

        response = self.send(self.payload())

        self.assertEqual(response.status_code, 400)

    def test_pickup_city_must_match(self):
        data = self.payload()
        data["city"] = "touba"

        response = self.send(data)

        self.assertEqual(response.status_code, 400)

    def test_client_cannot_choose_price_status_or_owner(self):
        for field, value in (
            ("subtotal", "1"),
            ("delivery_fee", "0"),
            ("status", "confirmed"),
            ("payment_status", "paid"),
            ("user", self.other_user.pk),
        ):
            with self.subTest(field=field):
                data = self.payload()
                data[field] = value

                response = self.send(data)

                self.assertEqual(response.status_code, 400)

        self.assertFalse(Order.objects.exists())

    def test_authentication_is_required(self):
        self.client.cookies.pop(
            settings.JWT_ACCESS_COOKIE_NAME,
            None,
        )

        response = self.send(self.payload())

        self.assertEqual(response.status_code, 401)

    def test_csrf_is_required(self):
        response = self.client.post(
            self.url,
            self.payload(),
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_client_cannot_read_another_clients_order(self):
        created = self.send(self.payload())
        self.assertEqual(created.status_code, 201)

        self.authenticate(self.other_user)

        detail = self.client.get(
            reverse(
                "orders:detail",
                kwargs={"pk": created.data["id"]},
            )
        )
        listing = self.client.get(self.url)

        self.assertEqual(detail.status_code, 404)
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.data["count"], 0)

    def test_history_preserves_purchase_details_and_shows_current_payment(self):
        created = self.send(self.payload())
        self.assertEqual(created.status_code, 201)
        Order.objects.filter(pk=created.data["id"]).update(
            payment_status=Order.PaymentStatus.PAID,
        )
        self.product.name = "Nouveau nom"
        self.product.price = 9000
        self.product.image = "products/test-history.jpg"
        self.product.save(update_fields=["name", "price", "image"])

        listing = self.client.get(self.url)
        self.assertEqual(listing.status_code, 200)
        order = listing.data["results"][0]
        self.assertEqual(order["payment_status"], "paid")
        item = order["items"][0]
        self.assertEqual(item["product_name"], "Huile démaquillante")
        self.assertEqual(Decimal(item["unit_price"]), Decimal("1500"))
        self.assertEqual(Decimal(item["line_total"]), Decimal("3000"))
        self.assertEqual(item["image"], self.product.image.url)
        detail = self.client.get(reverse("orders:detail", kwargs={"pk": order["id"]}))
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["items"], order["items"])

    def test_history_handles_missing_product_image(self):
        self.assertEqual(self.send(self.payload()).status_code, 201)
        listing = self.client.get(self.url)
        self.assertEqual(listing.status_code, 200)
        self.assertIsNone(listing.data["results"][0]["items"][0]["image"])

    def test_cancellation_restores_stock_once_and_preserves_history(self):
        data = self.payload()
        created = self.send(data)
        order, changed = cancel_unpaid_order(created.data["id"])
        self.assertTrue(changed)
        self.assertEqual(order.status, Order.Status.CANCELLED)
        self.assertEqual(order.payment_status, Order.PaymentStatus.UNPAID)
        self.assertEqual(order.items.count(), 1)
        self.assertEqual(order.total, Decimal("3000"))
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 2)
        _, changed = cancel_unpaid_order(order.pk)
        self.assertFalse(changed)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 2)
        # Un ancien envoi répété ne recrée pas une commande annulée.
        retried = self.send(data)
        self.assertEqual(retried.status_code, 200)
        self.assertEqual(retried.data["status"], "cancelled")
        self.assertEqual(Order.objects.count(), 1)
        listing = self.client.get(self.url)
        self.assertEqual(listing.data["results"][0]["status"], "cancelled")

    def test_paid_order_cannot_be_cancelled(self):
        created = self.send(self.payload())
        Order.objects.update(payment_status=Order.PaymentStatus.PAID)
        with self.assertRaises(ValidationError):
            cancel_unpaid_order(created.data["id"])
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 0)
        self.assertEqual(Order.objects.get().status, Order.Status.CONFIRMED)

    def test_cancellation_rejects_shipped_completed_and_legacy_orders(self):
        created = self.send(self.payload())
        for status in (Order.Status.SHIPPED, Order.Status.COMPLETED, Order.Status.AWAITING_PAYMENT):
            with self.subTest(status=status):
                Order.objects.update(status=status)
                with self.assertRaises(ValidationError):
                    cancel_unpaid_order(created.data["id"])
                self.product.refresh_from_db()
                self.assertEqual(self.product.stock, 0)
                self.assertEqual(Order.objects.get().status, status)

    def test_cancellation_failure_rolls_back_stock(self):
        created = self.send(self.payload())
        with patch("orders.services.Order.save", side_effect=RuntimeError("Write failed")):
            with self.assertRaises(RuntimeError):
                cancel_unpaid_order(created.data["id"])
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 0)
        self.assertEqual(Order.objects.get().status, Order.Status.CONFIRMED)

    def test_admin_cancellation_logs_once_and_payment_stays_blocked(self):
        from django.contrib import admin
        from django.contrib.admin.models import LogEntry
        from django.contrib.messages.storage.fallback import FallbackStorage
        from django.test import RequestFactory
        from .admin import OrderAdmin

        self.send(self.payload())
        self.other_user.is_staff = True
        self.other_user.is_superuser = True
        self.other_user.save(update_fields=["is_staff", "is_superuser"])
        request = RequestFactory().post("/admin/orders/order/")
        request.user = self.other_user
        request.session = {}
        request._messages = FallbackStorage(request)
        model_admin = OrderAdmin(Order, admin.site)
        model_admin.cancel_order(request, Order.objects.all())
        model_admin.cancel_order(request, Order.objects.all())
        model_admin.mark_payment_received(request, Order.objects.all())
        self.assertEqual(LogEntry.objects.count(), 1)
        self.assertEqual(Order.objects.get().status, Order.Status.CANCELLED)
        self.assertEqual(Order.objects.get().payment_status, Order.PaymentStatus.UNPAID)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 2)

    def test_order_progression_enforces_routes_payment_and_preserves_stock(self):
        created = self.send(self.payload())
        order_id = created.data["id"]
        for fulfillment in (Order.Fulfillment.PICKUP, Order.Fulfillment.DELIVERY):
            for paid in (Order.PaymentStatus.UNPAID, Order.PaymentStatus.PAID):
                for source in Order.Status.values:
                    for target in (Order.Status.READY, Order.Status.SHIPPED, Order.Status.COMPLETED):
                        with self.subTest(fulfillment=fulfillment, paid=paid, source=source, target=target):
                            Order.objects.filter(pk=order_id).update(
                                fulfillment=fulfillment,
                                pickup_point=self.pickup if fulfillment == Order.Fulfillment.PICKUP else None,
                                payment_status=paid, status=source,
                            )
                            middle = Order.Status.READY if fulfillment == Order.Fulfillment.PICKUP else Order.Status.SHIPPED
                            allowed = paid == Order.PaymentStatus.PAID and (
                                (target == middle and source in (Order.Status.CONFIRMED, middle))
                                or (target == Order.Status.COMPLETED and source in (middle, Order.Status.COMPLETED))
                            )
                            if allowed:
                                order, changed = advance_order(order_id, target)
                                self.assertEqual(order.status, target)
                                self.assertEqual(changed, source != target)
                            else:
                                with self.assertRaises(ValidationError):
                                    advance_order(order_id, target)
                            current = Order.objects.get(pk=order_id)
                            self.assertEqual(current.status, target if allowed else source)
                            self.assertEqual(current.payment_status, paid)
                            self.assertEqual(current.total, Decimal("3000"))
                            self.product.refresh_from_db()
                            self.assertEqual(self.product.stock, 0)

    def test_admin_progression_requires_permission_logs_once_and_updates_history(self):
        from django.contrib import admin
        from django.contrib.admin.models import LogEntry
        from django.contrib.messages.storage.fallback import FallbackStorage
        from django.test import RequestFactory
        from .admin import OrderAdmin

        self.send(self.payload())
        Order.objects.update(payment_status=Order.PaymentStatus.PAID)
        request = RequestFactory().post("/admin/orders/order/")
        request.user = self.other_user
        request.session = {}
        request._messages = FallbackStorage(request)
        model_admin = OrderAdmin(Order, admin.site)
        model_admin.mark_ready(request, Order.objects.all())
        self.assertEqual(Order.objects.get().status, Order.Status.CONFIRMED)
        self.assertEqual(LogEntry.objects.count(), 0)
        self.other_user.is_staff = True
        self.other_user.is_superuser = True
        self.other_user.save(update_fields=["is_staff", "is_superuser"])
        request.user = get_user_model().objects.get(pk=self.other_user.pk)
        model_admin.mark_ready(request, Order.objects.all())
        model_admin.mark_ready(request, Order.objects.all())
        model_admin.mark_completed(request, Order.objects.all())
        self.assertEqual(LogEntry.objects.count(), 2)
        response = self.client.get(self.url)
        self.assertEqual(response.data["results"][0]["status"], "completed")
        self.assertEqual(response.data["results"][0]["payment_status"], "paid")
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 0)

    @override_settings(
        MANUAL_PAYMENTS_ENABLED=True,
        MANUAL_PAYMENT_RECIPIENTS={
            "wave": {"phone": "+221770000000", "name": "Bénéficiaire test Wave"},
            "orange_money": {"phone": "+221780000000", "name": "Bénéficiaire test Orange"},
        },
    )
    def test_payment_instructions_match_method_and_server_total(self):
        data = self.payload()
        data.update({
            "fulfillment": "delivery", "pickup_point_id": None,
            "delivery_address": "Adresse de test", "payment_method": "orange_money",
        })
        response = self.send(data)
        self.assertEqual(response.status_code, 201)
        instructions = response.data["payment_instructions"]
        self.assertTrue(instructions["available"])
        self.assertEqual(instructions["method_label"], "Orange Money")
        self.assertEqual(instructions["recipient_phone"], "+221780000000")
        self.assertEqual(instructions["recipient_name"], "Bénéficiaire test Orange")
        self.assertEqual(Decimal(instructions["amount"]), Decimal("4500"))
        self.assertEqual(instructions["reference"], response.data["id"])
        self.assertEqual(Order.objects.get().payment_status, Order.PaymentStatus.UNPAID)

    def test_payment_instructions_fail_closed_and_hide_for_ineligible_orders(self):
        created = self.send(self.payload())
        detail_url = reverse("orders:detail", kwargs={"pk": created.data["id"]})
        for enabled, recipient in (
            (False, {"phone": "+221770000000", "name": "Test"}),
            (True, {}),
            (True, {"phone": "invalid", "name": "Test"}),
            (True, {"phone": "+221770000000", "name": ""}),
        ):
            with self.subTest(enabled=enabled, recipient=recipient):
                with override_settings(MANUAL_PAYMENTS_ENABLED=enabled, MANUAL_PAYMENT_RECIPIENTS={"wave": recipient}):
                    instructions = self.client.get(detail_url).data["payment_instructions"]
                    self.assertFalse(instructions["available"])
                    self.assertIsNone(instructions["recipient_phone"])
                    self.assertIsNone(instructions["recipient_name"])
        for status, payment in (
            (Order.Status.CONFIRMED, Order.PaymentStatus.PAID),
            (Order.Status.CANCELLED, Order.PaymentStatus.UNPAID),
            (Order.Status.AWAITING_PAYMENT, Order.PaymentStatus.UNPAID),
            (Order.Status.COMPLETED, Order.PaymentStatus.UNPAID),
        ):
            with self.subTest(status=status, payment=payment):
                Order.objects.update(status=status, payment_status=payment)
                self.assertIsNone(self.client.get(detail_url).data["payment_instructions"])
        Order.objects.update(
            status=Order.Status.CONFIRMED, payment_status=Order.PaymentStatus.UNPAID,
            fulfillment=Order.Fulfillment.DELIVERY, pickup_point=None, delivery_fee=None,
        )
        self.assertIsNone(self.client.get(detail_url).data["payment_instructions"])

    def test_only_active_pickup_points_are_public(self):
        PickupPoint.objects.create(
            name="Point fermé",
            city="touba",
            address="Adresse de test",
            is_active=False,
        )

        response = APIClient().get(
            reverse("orders:pickup-points")
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], self.pickup.pk)
