from datetime import datetime, timedelta
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken


User = get_user_model()


@override_settings(PASSWORD_RESET_TIMEOUT=1800)
class PasswordResetConfirmTests(APITestCase):
    old_password = "Ancien-MotDePasse!482"
    new_password = "Nouveau-MotDePasse!957"

    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)

        self.client = APIClient(enforce_csrf_checks=True)

        self.user = User.objects.create_user(
            username="reset-confirm-client",
            email="confirmation@example.com",
            password=self.old_password,
            first_name="Awa",
            last_name="Diop",
        )

        self.url = reverse("users:password-reset-confirm")
        self.uid = urlsafe_base64_encode(
            force_bytes(self.user.pk)
        )
        self.token = default_token_generator.make_token(
            self.user
        )

        response = self.client.get(reverse("users:csrf"))
        self.assertEqual(response.status_code, 200)
        self.csrf_token = response.json()["csrfToken"]

    def payload(self, **changes):
        data = {
            "uid": self.uid,
            "token": self.token,
            "password": self.new_password,
            "password_confirm": self.new_password,
        }
        data.update(changes)
        return data

    def confirm_reset(self, **changes):
        return self.client.post(
            self.url,
            self.payload(**changes),
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )

    def assert_old_password_unchanged(self):
        self.user.refresh_from_db()
        self.assertTrue(
            self.user.check_password(self.old_password)
        )

    def test_valid_link_changes_password(self):
        response = self.confirm_reset()

        self.assertEqual(response.status_code, 200)

        self.user.refresh_from_db()

        self.assertTrue(
            self.user.check_password(self.new_password)
        )
        self.assertFalse(
            self.user.check_password(self.old_password)
        )

        # Le mot de passe brut ne doit pas être stocké.
        self.assertNotEqual(
            self.user.password,
            self.new_password,
        )

    def test_used_link_cannot_be_reused(self):
        first_response = self.confirm_reset()
        self.assertEqual(first_response.status_code, 200)

        second_response = self.confirm_reset(
            password="Encore-UnMotDePasse!781",
            password_confirm="Encore-UnMotDePasse!781",
        )

        self.assertEqual(second_response.status_code, 400)
        self.assertIn("detail", second_response.json())

        self.user.refresh_from_db()
        self.assertTrue(
            self.user.check_password(self.new_password)
        )

    def test_expired_link_is_rejected(self):
        issued_at = datetime(2026, 1, 1, 12, 0, 0)

        with patch.object(
            default_token_generator,
            "_now",
            return_value=issued_at,
        ):
            token = default_token_generator.make_token(
                self.user
            )

        # Simuler 31 minutes écoulées pour un lien valable 30 minutes.
        with patch.object(
            default_token_generator,
            "_now",
            return_value=issued_at + timedelta(minutes=31),
        ):
            response = self.confirm_reset(token=token)

        self.assertEqual(response.status_code, 400)
        self.assert_old_password_unchanged()

    def test_invalid_token_is_rejected(self):
        response = self.confirm_reset(
            token="jeton-invalide"
        )

        self.assertEqual(response.status_code, 400)
        self.assert_old_password_unchanged()

    def test_invalid_uid_is_rejected(self):
        response = self.confirm_reset(uid="!!!")

        self.assertEqual(response.status_code, 400)
        self.assert_old_password_unchanged()

    def test_mismatched_passwords_are_rejected(self):
        response = self.confirm_reset(
            password_confirm="Autre-MotDePasse!123"
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn(
            "password_confirm",
            response.json(),
        )
        self.assert_old_password_unchanged()

    def test_weak_password_is_rejected(self):
        response = self.confirm_reset(
            password="123",
            password_confirm="123",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("password", response.json())
        self.assert_old_password_unchanged()

    def test_request_without_csrf_is_rejected(self):
        client_without_csrf = APIClient(
            enforce_csrf_checks=True
        )

        response = client_without_csrf.post(
            self.url,
            self.payload(),
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assert_old_password_unchanged()

    def test_inactive_user_is_rejected(self):
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])

        response = self.confirm_reset()

        self.assertEqual(response.status_code, 400)
        self.assert_old_password_unchanged()

    def test_existing_refresh_tokens_are_revoked(self):
        first_refresh = str(
            RefreshToken.for_user(self.user)
        )
        second_refresh = str(
            RefreshToken.for_user(self.user)
        )

        response = self.confirm_reset()

        self.assertEqual(response.status_code, 200)

        for token in (first_refresh, second_refresh):
            with self.subTest(token=token):
                with self.assertRaises(TokenError):
                    RefreshToken(token)

    def test_success_clears_auth_cookies(self):
        refresh = RefreshToken.for_user(self.user)

        access_name = settings.JWT_ACCESS_COOKIE_NAME
        refresh_name = settings.JWT_REFRESH_COOKIE_NAME

        self.client.cookies[access_name] = str(
            refresh.access_token
        )
        self.client.cookies[refresh_name] = str(refresh)

        response = self.confirm_reset()

        self.assertEqual(response.status_code, 200)

        for name, path in (
            (access_name, "/api/"),
            (refresh_name, "/api/users/"),
        ):
            with self.subTest(cookie=name):
                self.assertIn(name, response.cookies)
                cookie = response.cookies[name]

                self.assertEqual(cookie.value, "")
                self.assertEqual(
                    str(cookie["max-age"]),
                    "0",
                )
                self.assertEqual(cookie["path"], path)