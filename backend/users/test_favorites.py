from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from catalog.models import Category, Product
from .models import Favorite


class FavoriteTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="favorite-test", email="favorite@example.com", password="Test-Favorites!2026")
        self.other = get_user_model().objects.create_user(username="other-favorite", email="other-favorite@example.com", password="Test-Favorites!2026")
        self.category = Category.objects.create(name="Beauté", slug="beaute")
        self.product = Product.objects.create(category=self.category, name="Soin test", slug="soin-test", price=1500, stock=2, is_active=True, image="products/test.jpg")
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.cookies[settings.JWT_ACCESS_COOKIE_NAME] = str(RefreshToken.for_user(self.user).access_token)
        self.csrf = self.client.get(reverse("users:csrf")).json()["csrfToken"]
        self.url = reverse("users:favorites")
        self.detail = reverse("users:favorite-detail", args=[self.product.pk])

    def put(self, data=None):
        return self.client.put(self.detail, data or {}, format="json", HTTP_X_CSRFTOKEN=self.csrf)

    def delete(self):
        return self.client.delete(self.detail, HTTP_X_CSRFTOKEN=self.csrf)

    def test_put_is_idempotent_and_returns_current_product(self):
        self.assertEqual(self.put().status_code, 201)
        self.assertEqual(self.put().status_code, 200)
        self.assertEqual(Favorite.objects.count(), 1)
        Product.objects.filter(pk=self.product.pk).update(price=2300, stock=0)
        data = self.client.get(self.url).data
        self.assertEqual(data["user_id"], self.user.pk)
        product = data["results"][0]["product"]
        self.assertEqual(product["price"], "2300")
        self.assertFalse(product["in_stock"])
        self.assertTrue(product["image"].startswith("/media/"))

    def test_favorites_are_private_and_delete_is_idempotent(self):
        Favorite.objects.create(user=self.other, product=self.product)
        self.assertEqual(self.client.get(self.url).data["results"], [])
        self.assertEqual(self.delete().status_code, 204)
        self.put()
        self.assertEqual(self.delete().status_code, 204)
        self.assertEqual(self.delete().status_code, 204)
        self.assertEqual(list(Favorite.objects.values_list("user_id", flat=True)), [self.other.pk])

    def test_authentication_required(self):
        anonymous = APIClient()
        for method, url in [("get", self.url), ("put", self.detail), ("delete", self.detail)]:
            self.assertEqual(getattr(anonymous, method)(url).status_code, 401)

    def test_mutations_require_csrf(self):
        self.assertEqual(self.client.put(self.detail, {}, format="json").status_code, 403)
        self.put()
        self.assertEqual(self.client.delete(self.detail).status_code, 403)
        self.assertEqual(Favorite.objects.count(), 1)

    def test_owner_and_product_cannot_be_overridden(self):
        for data in [{"user": self.other.pk}, {"user_id": self.other.pk}, {"product_id": 999}, {"id": 1}]:
            self.assertEqual(self.put(data).status_code, 400)
        self.assertFalse(Favorite.objects.exists())

    def test_hidden_or_missing_products_cannot_be_added(self):
        self.product.is_active = False
        self.product.save()
        self.assertEqual(self.put().status_code, 404)
        self.product.is_active = True
        self.product.save()
        self.category.is_active = False
        self.category.save()
        self.assertEqual(self.put().status_code, 404)
        self.product.delete()
        self.assertEqual(self.put().status_code, 404)

    def test_hidden_product_details_are_not_exposed_and_favorite_can_be_removed(self):
        self.put()
        for model in (self.product, self.category):
            model.is_active = False
            model.save()
            self.assertEqual(self.client.get(self.url).data["results"], [{"product_id": self.product.pk, "product": None}])
            model.is_active = True
            model.save()
        self.product.is_active = False
        self.product.save()
        self.assertEqual(self.delete().status_code, 204)
        self.assertFalse(Favorite.objects.exists())

    def test_out_of_stock_products_can_be_saved_without_reserving_stock(self):
        self.product.stock = 0
        self.product.save()
        self.assertEqual(self.put().status_code, 201)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 0)

    def test_limit_allows_repeated_put_and_removal(self):
        products = Product.objects.bulk_create([Product(category=self.category, name=f"Produit {i}", slug=f"produit-{i}", price=1000, is_active=True) for i in range(100)])
        Favorite.objects.bulk_create([Favorite(user=self.user, product=product) for product in products])
        self.assertEqual(self.put().status_code, 400)
        self.detail = reverse("users:favorite-detail", args=[products[0].pk])
        self.assertEqual(self.put().status_code, 200)
        self.assertEqual(self.delete().status_code, 204)
        self.detail = reverse("users:favorite-detail", args=[self.product.pk])
        self.assertEqual(self.put().status_code, 201)

    def test_unique_constraint_and_product_deletion(self):
        self.put()
        with self.assertRaises(IntegrityError), transaction.atomic():
            Favorite.objects.create(user=self.user, product=self.product)
        self.product.delete()
        self.assertFalse(Favorite.objects.exists())

    def test_responses_are_not_cached(self):
        self.assertIn("no-store", self.client.get(self.url)["Cache-Control"])
        self.assertIn("no-store", self.put()["Cache-Control"])
