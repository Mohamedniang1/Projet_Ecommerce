from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from .serializers import LoginSerializer

User = get_user_model()


class RegistrationTests(APITestCase):
    def setUp(self):
        self.url = reverse("users:register")
        self.data = {
            "email": "nouveau@example.com",
            "first_name": "Mohamed",
            "last_name": "Niang",
            "password": "Test-Uniquement!48-Rivage",
        }

    def test_registration_creates_client(self):
        response = self.client.post(self.url, self.data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(User.objects.count(), 1)

        user = User.objects.get(email=self.data["email"])

        self.assertEqual(user.role, User.Role.CLIENT)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.check_password(self.data["password"]))
        self.assertNotEqual(user.password, self.data["password"])
        self.assertNotIn("password", response.data)

    def test_weak_password_is_rejected(self):
        self.data["password"] = "123"

        response = self.client.post(self.url, self.data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)
        self.assertEqual(User.objects.count(), 0)

    def test_duplicate_email_is_rejected(self):
        User.objects.create_user(
            username="existing",
            email=self.data["email"],
            password=self.data["password"],
        )

        response = self.client.post(self.url, self.data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)
        self.assertEqual(User.objects.count(), 1)

    def test_duplicate_email_with_different_case_is_rejected(self):
        User.objects.create_user(
            username="existing",
            email=self.data["email"],
            password=self.data["password"],
        )
        self.data["email"] = self.data["email"].upper()

        response = self.client.post(self.url, self.data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)
        self.assertEqual(User.objects.count(), 1)

    def test_registration_cannot_grant_admin_rights(self):
        self.data.update({
            "role": "MANAGER",
            "is_staff": True,
            "is_superuser": True,
        })

        response = self.client.post(self.url, self.data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(email=self.data["email"])

        self.assertEqual(user.role, User.Role.CLIENT)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

class LoginSerializerTests(APITestCase):
    def setUp(self):
        self.password = "Test-Uniquement!48-Rivage"

        self.user = User.objects.create_user(
            username="login_test",
            email="connexion@example.com",
            password=self.password,
        )

    def test_valid_credentials_are_accepted(self):
        serializer = LoginSerializer(data={
            "email": "connexion@example.com",
            "password": self.password,
        })

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(
            serializer.validated_data["user"],
            self.user,
        )
        self.assertNotIn("password", serializer.validated_data)

    def test_email_is_normalized(self):
        serializer = LoginSerializer(data={
            "email": " CONNEXION@EXAMPLE.COM ",
            "password": self.password,
        })

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(
            serializer.validated_data["user"],
            self.user,
        )

    def test_wrong_password_is_rejected(self):
        serializer = LoginSerializer(data={
            "email": "connexion@example.com",
            "password": "Mauvais-mot-de-passe!",
        })

        self.assertFalse(serializer.is_valid())
        self.assertIn("non_field_errors", serializer.errors)

    def test_unknown_email_is_rejected(self):
        serializer = LoginSerializer(data={
            "email": "inconnu@example.com",
            "password": self.password,
        })

        self.assertFalse(serializer.is_valid())
        self.assertIn("non_field_errors", serializer.errors)

    def test_inactive_user_is_rejected(self):
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])

        serializer = LoginSerializer(data={
            "email": "connexion@example.com",
            "password": self.password,
        })

        self.assertFalse(serializer.is_valid())
        self.assertIn("non_field_errors", serializer.errors)