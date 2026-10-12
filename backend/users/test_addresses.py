from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from orders.models import Order
from .models import SavedAddress


class AddressBookTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="address-client", email="address@example.com", password="Test-Addresses!2026")
        self.other = get_user_model().objects.create_user(username="other-address", email="other-address@example.com", password="Test-Addresses!2026")
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.cookies[settings.JWT_ACCESS_COOKIE_NAME] = str(RefreshToken.for_user(self.user).access_token)
        self.csrf = self.client.get(reverse("users:csrf")).json()["csrfToken"]
        self.url = reverse("users:addresses")

    def payload(self, **changes):
        return {"label": "Maison", "customer_name": "Client Test", "phone": "77 123 45 67", "city": "dakar", "delivery_address": "Quartier de test, maison 12", "is_default": False, **changes}

    def create(self, **changes):
        return self.client.post(self.url, self.payload(**changes), format="json", HTTP_X_CSRFTOKEN=self.csrf)

    def detail(self, pk):
        return reverse("users:address-detail", args=[pk])

    def patch(self, pk, data):
        return self.client.patch(self.detail(pk), data, format="json", HTTP_X_CSRFTOKEN=self.csrf)

    def delete(self, pk):
        return self.client.delete(self.detail(pk), HTTP_X_CSRFTOKEN=self.csrf)

    def test_first_address_is_default_and_phone_is_normalized(self):
        response = self.create()
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["is_default"])
        self.assertEqual(response.data["phone"], "+221771234567")
        self.assertEqual(SavedAddress.objects.get().user, self.user)
        self.assertNotIn("user", response.data)

    def test_only_own_addresses_can_be_listed_read_changed_or_deleted(self):
        mine = self.create().data["id"]
        foreign = SavedAddress.objects.create(user=self.other, **self.payload(is_default=True))
        self.assertEqual([item["id"] for item in self.client.get(self.url).data], [mine])
        self.assertEqual(self.client.get(self.detail(foreign.pk)).status_code, 404)
        self.assertEqual(self.patch(foreign.pk, {"label": "Intrusion"}).status_code, 404)
        self.assertEqual(self.delete(foreign.pk).status_code, 404)
        foreign.refresh_from_db()
        self.assertEqual(foreign.label, "Maison")
        self.assertTrue(foreign.is_default)

    def test_anonymous_access_is_rejected_for_all_operations(self):
        address = self.create().data["id"]
        anonymous = APIClient(enforce_csrf_checks=True)
        for method, url, data in [("get", self.url, None), ("get", self.detail(address), None), ("post", self.url, self.payload()), ("patch", self.detail(address), {"label": "Test"}), ("delete", self.detail(address), None)]:
            with self.subTest(method=method, url=url):
                response = getattr(anonymous, method)(url, data, format="json")
                self.assertEqual(response.status_code, 401)
        self.assertEqual(SavedAddress.objects.count(), 1)

    def test_all_mutations_require_csrf(self):
        address = self.create().data["id"]
        for method, url, data in [("post", self.url, self.payload()), ("patch", self.detail(address), {"label": "Test"}), ("delete", self.detail(address), None)]:
            with self.subTest(method=method):
                response = getattr(self.client, method)(url, data, format="json")
                self.assertEqual(response.status_code, 403)
        self.assertEqual(SavedAddress.objects.get().label, "Maison")

    def test_identity_and_read_only_fields_cannot_be_injected(self):
        for field, value in [("user", self.other.pk), ("user_id", self.other.pk), ("id", 12), ("city_label", "Fausse ville"), ("created_at", "2020-01-01")]:
            with self.subTest(field=field):
                self.assertEqual(self.create(**{field: value}).status_code, 400)
        self.assertFalse(SavedAddress.objects.exists())

    def test_switching_default_on_create_and_patch_preserves_one_default(self):
        first = self.create().data["id"]
        second = self.create(label="Bureau").data["id"]
        self.assertEqual(SavedAddress.objects.get(is_default=True).pk, first)
        self.assertEqual(self.patch(second, {"is_default": True}).status_code, 200)
        self.assertEqual(self.patch(second, {"is_default": True}).status_code, 200)
        self.assertEqual(SavedAddress.objects.get(is_default=True).pk, second)
        third = self.create(label="Famille", is_default=True).data["id"]
        self.assertEqual(SavedAddress.objects.get(is_default=True).pk, third)
        self.assertEqual(self.client.get(self.url).data[0]["id"], third)

    def test_default_cannot_be_unset_without_replacement(self):
        address = self.create().data["id"]
        self.assertEqual(self.patch(address, {"is_default": False}).status_code, 400)
        self.assertTrue(SavedAddress.objects.get().is_default)

    def test_deleting_default_promotes_a_remaining_address(self):
        first = self.create().data["id"]
        second = self.create(label="Bureau").data["id"]
        self.assertEqual(self.delete(first).status_code, 204)
        self.assertTrue(SavedAddress.objects.get(pk=second).is_default)
        self.assertEqual(self.delete(first).status_code, 404)
        self.assertEqual(self.delete(second).status_code, 204)
        self.assertEqual(self.client.get(self.url).data, [])
        self.assertTrue(self.create().data["is_default"])

    def test_deleting_nondefault_preserves_default_and_other_users_book(self):
        first = self.create().data["id"]
        second = self.create(label="Bureau").data["id"]
        foreign = SavedAddress.objects.create(user=self.other, **self.payload(is_default=True))
        self.delete(second)
        self.assertTrue(SavedAddress.objects.get(pk=first).is_default)
        self.assertTrue(SavedAddress.objects.get(pk=foreign.pk).is_default)

    def test_invalid_fields_and_unserved_cities_are_rejected(self):
        for changes in [{"phone": "123"}, {"phone": "+33123456789"}, {"city": "saint-louis"}, {"label": " "}, {"customer_name": ""}, {"delivery_address": " "}, {"label": "x" * 61}, {"delivery_address": "x" * 1001}]:
            with self.subTest(changes=changes):
                self.assertEqual(self.create(**changes).status_code, 400)
        self.assertFalse(SavedAddress.objects.exists())

    def test_all_supported_cities_and_phone_formats(self):
        for city, phone in [("dakar", "77 123 45 67"), ("touba", "+221 77 123 45 67"), ("tambacounda", "00221 77 123 45 67")]:
            response = self.create(city=city, phone=phone)
            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.data["phone"], "+221771234567")

    def test_ten_address_limit_still_allows_editing(self):
        for number in range(10):
            self.assertEqual(self.create(label=f"Adresse {number}").status_code, 201)
        self.assertEqual(self.create().status_code, 400)
        first = SavedAddress.objects.first()
        self.assertEqual(self.patch(first.pk, {"label": "Renommée"}).status_code, 200)
        self.assertEqual(SavedAddress.objects.count(), 10)

    def test_database_prevents_two_defaults_for_one_user(self):
        self.create()
        with self.assertRaises(IntegrityError), transaction.atomic():
            SavedAddress.objects.create(user=self.user, **self.payload(is_default=True))

    def test_edits_and_deletion_do_not_change_existing_orders(self):
        address = self.create().data["id"]
        order = Order.objects.create(user=self.user, customer_name="Client Test", phone="+221771234567", fulfillment="delivery", city="dakar", delivery_address="Quartier de test, maison 12", payment_method="wave", subtotal=3000, delivery_fee=1500)
        self.assertEqual(self.patch(address, {"city": "touba", "delivery_address": "Nouvelle adresse"}).status_code, 200)
        self.delete(address)
        order.refresh_from_db()
        self.assertEqual(order.city, "dakar")
        self.assertEqual(order.delivery_address, "Quartier de test, maison 12")
        self.assertEqual(order.total, 4500)

    def test_responses_are_not_cacheable(self):
        address = self.create().data["id"]
        for url in [self.url, self.detail(address)]:
            self.assertIn("no-store", self.client.get(url)["Cache-Control"])
