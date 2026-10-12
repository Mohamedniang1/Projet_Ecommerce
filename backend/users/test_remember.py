from django.conf import settings
from django.contrib.auth import get_user_model
from django.urls import reverse

from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import RefreshToken


User = get_user_model()


class RememberLoginTests(APITestCase):
    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)

        self.user = User.objects.create_user(
            username="remember-client",
            email="remember@example.com",
            password="Connexion-Test!482",
        )

    def post_with_csrf(self, url_name, data):
        csrf_response = self.client.get(
            reverse("users:csrf")
        )
        self.assertEqual(csrf_response.status_code, 200)

        return self.client.post(
            reverse(url_name),
            data,
            format="json",
            HTTP_X_CSRFTOKEN=csrf_response.json()["csrfToken"],
        )

    def login(self, **extra):
        return self.post_with_csrf(
            "users:login",
            {
                "email": self.user.email,
                "password": "Connexion-Test!482",
                **extra,
            },
        )

    def assert_cookie_mode(self, response, remember):
        self.assertEqual(response.status_code, 200)

        cookies = (
            (
                settings.JWT_ACCESS_COOKIE_NAME,
                "ACCESS_TOKEN_LIFETIME",
            ),
            (
                settings.JWT_REFRESH_COOKIE_NAME,
                "REFRESH_TOKEN_LIFETIME",
            ),
        )

        for name, lifetime in cookies:
            with self.subTest(cookie=name, remember=remember):
                cookie = response.cookies[name]

                self.assertTrue(cookie["httponly"])

                if remember:
                    expected = int(
                        settings.SIMPLE_JWT[
                            lifetime
                        ].total_seconds()
                    )

                    self.assertEqual(
                        int(cookie["max-age"]),
                        expected,
                    )
                    self.assertTrue(cookie["expires"])
                else:
                    self.assertEqual(cookie["max-age"], "")
                    self.assertEqual(cookie["expires"], "")

        refresh = RefreshToken(
            response.cookies[
                settings.JWT_REFRESH_COOKIE_NAME
            ].value
        )

        self.assertEqual(refresh["remember"], remember)

    def test_default_login_uses_session_cookies(self):
        response = self.login()

        self.assert_cookie_mode(response, remember=False)

    def test_checked_login_uses_persistent_cookies(self):
        response = self.login(remember=True)

        self.assert_cookie_mode(response, remember=True)

    def test_refresh_preserves_both_modes(self):
        for remember in (False, True):
            with self.subTest(remember=remember):
                self.client = APIClient(
                    enforce_csrf_checks=True
                )

                login_response = self.login(
                    remember=remember
                )
                self.assert_cookie_mode(
                    login_response,
                    remember,
                )

                # Vérifier que le choix est conservé pendant
                # deux renouvellements successifs.
                for _ in range(2):
                    refresh_response = self.post_with_csrf(
                        "users:refresh",
                        {},
                    )
                    self.assert_cookie_mode(
                        refresh_response,
                        remember,
                    )