from urllib.parse import parse_qs, urlparse

from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode

from rest_framework.test import APIClient, APITestCase


User = get_user_model()


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    DEFAULT_FROM_EMAIL="KeurMayata <noreply@example.com>",
    FRONTEND_URL="http://localhost:3000",
    PASSWORD_RESET_TIMEOUT=1800,
)
class PasswordResetRequestTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)

        self.client = APIClient(enforce_csrf_checks=True)

        self.user = User.objects.create_user(
            username="password-reset-client",
            email="reset@example.com",
            password="Ancien-MotDePasse!482",
            first_name="Awa",
            last_name="Diop",
        )

        self.url = reverse("users:password-reset")

        response = self.client.get(reverse("users:csrf"))
        self.assertEqual(response.status_code, 200)

        self.csrf_token = response.json()["csrfToken"]

    def request_reset(self, email):
        return self.client.post(
            self.url,
            {"email": email},
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )

    def test_existing_user_receives_valid_reset_link(self):
        response = self.request_reset(self.user.email)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)

        email = mail.outbox[0]
        self.assertEqual(email.to, [self.user.email])

        reset_url = next(
            line.strip()
            for line in email.body.splitlines()
            if line.startswith("http://localhost:3000/")
        )

        parsed_url = urlparse(reset_url)

        self.assertEqual(
            parsed_url.path,
            "/reinitialiser-mot-de-passe",
        )

        parameters = parse_qs(parsed_url.query)
        uid = parameters["uid"][0]
        token = parameters["token"][0]

        decoded_id = force_str(urlsafe_base64_decode(uid))

        self.assertEqual(decoded_id, str(self.user.pk))
        self.assertTrue(
            default_token_generator.check_token(self.user, token)
        )

        # Demander un lien ne doit pas changer le mot de passe.
        self.user.refresh_from_db()
        self.assertTrue(
            self.user.check_password("Ancien-MotDePasse!482")
        )

    def test_unknown_email_returns_same_response(self):
        existing_response = self.request_reset(self.user.email)

        self.assertEqual(len(mail.outbox), 1)
        mail.outbox.clear()

        unknown_response = self.request_reset(
            "inconnu@example.com"
        )

        self.assertEqual(unknown_response.status_code, 200)
        self.assertEqual(
            unknown_response.json(),
            existing_response.json(),
        )
        self.assertEqual(len(mail.outbox), 0)

    def test_inactive_user_receives_no_email(self):
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])

        response = self.request_reset(self.user.email)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 0)

    def test_user_with_unusable_password_receives_no_email(self):
        self.user.set_unusable_password()
        self.user.save(update_fields=["password"])

        response = self.request_reset(self.user.email)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 0)

    def test_request_without_csrf_is_rejected(self):
        client_without_csrf = APIClient(
            enforce_csrf_checks=True
        )

        response = client_without_csrf.post(
            self.url,
            {"email": self.user.email},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(len(mail.outbox), 0)

    def test_sixth_request_is_throttled(self):
        for _ in range(5):
            response = self.request_reset(
                "inconnu@example.com"
            )
            self.assertEqual(response.status_code, 200)

        response = self.request_reset(
            "inconnu@example.com"
        )

        self.assertEqual(response.status_code, 429)
        self.assertEqual(len(mail.outbox), 0)