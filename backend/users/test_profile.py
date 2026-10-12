from django.contrib.auth import get_user_model
from django.urls import reverse

from rest_framework.test import APIClient, APITestCase


User = get_user_model()


class ProfileUpdateTests(APITestCase):
    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)

        self.user = User.objects.create_user(
            username="profile-client",
            email="profil@example.com",
            password="Profil-Test!482",
            first_name="Awa",
            last_name="Diop",
        )

        self.other_user = User.objects.create_user(
            username="other-client",
            email="autre@example.com",
            password="Autre-Test!957",
            first_name="Fatou",
            last_name="Fall",
        )

        self.url = reverse("users:me")

        csrf_response = self.client.get(
            reverse("users:csrf")
        )

        login_response = self.client.post(
            reverse("users:login"),
            {
                "email": self.user.email,
                "password": "Profil-Test!482",
            },
            format="json",
            HTTP_X_CSRFTOKEN=csrf_response.json()["csrfToken"],
        )
        self.assertEqual(login_response.status_code, 200)

        # La connexion renouvelle le jeton CSRF.
        self.csrf_token = login_response.json()["csrfToken"]

    def patch_profile(self, data):
        return self.client.patch(
            self.url,
            data,
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )

    def assert_names_unchanged(self):
        self.user.refresh_from_db()
        self.other_user.refresh_from_db()

        self.assertEqual(self.user.first_name, "Awa")
        self.assertEqual(self.user.last_name, "Diop")
        self.assertEqual(self.other_user.first_name, "Fatou")
        self.assertEqual(self.other_user.last_name, "Fall")

    def test_update_changes_only_connected_user(self):
        response = self.patch_profile({
            "first_name": "Aminata",
            "last_name": "Ndiaye",
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["first_name"], "Aminata")
        self.assertEqual(response.json()["last_name"], "Ndiaye")

        self.user.refresh_from_db()
        self.other_user.refresh_from_db()

        self.assertEqual(self.user.first_name, "Aminata")
        self.assertEqual(self.user.last_name, "Ndiaye")
        self.assertEqual(self.other_user.first_name, "Fatou")
        self.assertEqual(self.other_user.last_name, "Fall")

        # Vérifier également les informations relues par l'API.
        profile_response = self.client.get(self.url)

        self.assertEqual(profile_response.status_code, 200)
        self.assertEqual(
            profile_response.json()["first_name"],
            "Aminata",
        )

    def test_update_without_login_is_rejected(self):
        anonymous_client = APIClient(
            enforce_csrf_checks=True
        )

        csrf_response = anonymous_client.get(
            reverse("users:csrf")
        )

        response = anonymous_client.patch(
            self.url,
            {"first_name": "Modification"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_response.json()["csrfToken"],
        )

        self.assertEqual(response.status_code, 401)
        self.assert_names_unchanged()

    def test_update_without_csrf_header_is_rejected(self):
        response = self.client.patch(
            self.url,
            {"first_name": "Modification"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assert_names_unchanged()

    def test_cannot_target_another_user(self):
        response = self.patch_profile({
            "id": self.other_user.pk,
            "first_name": "Modification",
        })

        self.assertEqual(response.status_code, 400)
        self.assert_names_unchanged()

    def test_sensitive_fields_are_rejected(self):
        original_password_hash = self.user.password

        forbidden_changes = {
            "role": "MANAGER",
            "is_staff": True,
            "is_superuser": True,
            "email": "nouvelle@example.com",
            "password": "Nouveau-Test!123",
        }

        for field, value in forbidden_changes.items():
            with self.subTest(field=field):
                response = self.patch_profile({
                    "first_name": "Modification",
                    field: value,
                })

                self.assertEqual(response.status_code, 400)
                self.assert_names_unchanged()

                self.assertEqual(self.user.role, "CLIENT")
                self.assertFalse(self.user.is_staff)
                self.assertFalse(self.user.is_superuser)
                self.assertEqual(
                    self.user.email,
                    "profil@example.com",
                )
                self.assertEqual(
                    self.user.password,
                    original_password_hash,
                )