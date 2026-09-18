from django.contrib.auth import get_user_model
from django.urls import reverse
from django.conf import settings

from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from .serializers import LoginSerializer

User = get_user_model()

# Teste l'endpoint d'inscription (POST /register/).
# Vérifie qu'un compte est bien créé avec le rôle CLIENT, que le mot de
# passe est validé et haché, que les emails en double sont rejetés
# (même avec une casse différente), et surtout qu'un utilisateur ne peut
# pas s'auto-attribuer des droits admin (role, is_staff, is_superuser)
# en les envoyant dans la requête.
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

# Teste le LoginSerializer de manière isolée, sans passer par une
# requête HTTP complète. Vérifie la logique d'authentification pure :
# identifiants valides acceptés, email normalisé (espaces/casse),
# mot de passe erroné ou email inconnu rejetés avec un message
# générique (non_field_errors) pour ne pas révéler quel champ est
# fautif, et un compte désactivé (is_active=False) bloqué.
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

# Teste le flux complet de connexion par cookies HTTP (POST /login/),
# avec la vérification CSRF réellement activée (enforce_csrf_checks).
# Vérifie que les cookies JWT posés sont bien httpOnly, SameSite=Lax,
# avec un "path" restreint pour le refresh token, que les tokens
# n'apparaissent jamais dans le corps de la réponse, que /me/ devient
# accessible juste après connexion, et que la connexion échoue sans
# token CSRF ou avec un mauvais mot de passe (sans poser de cookies).
class CookieLoginTests(APITestCase):
    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)

        self.password = "Test-Uniquement!48-Rivage"
        self.user = User.objects.create_user(
            username="cookie_test",
            email="cookies@example.com",
            password=self.password,
        )

        self.login_url = reverse("users:login")
        self.csrf_url = reverse("users:csrf")
        self.me_url = reverse("users:me")

    def login_with_csrf(self, password=None):
        csrf_response = self.client.get(self.csrf_url)
        self.assertEqual(csrf_response.status_code, 200)
        csrf_token = csrf_response.json()["csrfToken"]

        return self.client.post(
            self.login_url,
            {
                "email": self.user.email,
                "password": (
                    self.password if password is None else password
                ),
            },
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

    def test_login_sets_httponly_cookies(self):
        response = self.login_with_csrf()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user"]["id"], self.user.id)

        access = response.cookies[settings.JWT_ACCESS_COOKIE_NAME]
        refresh = response.cookies[settings.JWT_REFRESH_COOKIE_NAME]

        self.assertTrue(access["httponly"])
        self.assertTrue(refresh["httponly"])
        self.assertEqual(access["samesite"], "Lax")
        self.assertEqual(refresh["samesite"], "Lax")
        self.assertEqual(access["path"], "/api/")
        self.assertEqual(refresh["path"], "/api/users/")

        body = response.content.decode()
        self.assertNotIn(access.value, body)
        self.assertNotIn(refresh.value, body)
        self.assertNotIn(self.password, body)

    def test_profile_is_accessible_after_login(self):
        login_response = self.login_with_csrf()
        self.assertEqual(login_response.status_code, 200)

        response = self.client.get(self.me_url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], self.user.id)
        self.assertEqual(response.data["email"], self.user.email)
        self.assertNotIn("password", response.data)

    def test_profile_without_cookie_is_rejected(self):
        response = self.client.get(self.me_url)

        self.assertEqual(response.status_code, 401)
        self.assertNotIn("email", response.data)

    def test_login_without_csrf_is_rejected(self):
        response = self.client.post(
            self.login_url,
            {
                "email": self.user.email,
                "password": self.password,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertNotIn(
            settings.JWT_ACCESS_COOKIE_NAME,
            response.cookies,
        )
        self.assertNotIn(
            settings.JWT_REFRESH_COOKIE_NAME,
            response.cookies,
        )

    def test_wrong_password_does_not_issue_tokens(self):
        response = self.login_with_csrf(
            password="Mot-de-passe-incorrect!",
        )

        self.assertEqual(response.status_code, 400)
        self.assertNotIn(
            settings.JWT_ACCESS_COOKIE_NAME,
            response.cookies,
        )
        self.assertNotIn(
            settings.JWT_REFRESH_COOKIE_NAME,
            response.cookies,
        )


# Teste l'endpoint de rafraîchissement du token (POST /refresh/), qui
# permet d'obtenir un nouvel access token sans se reconnecter. Vérifie
# que le refresh remplace bien les cookies, qu'un ancien refresh token
# déjà utilisé ne peut pas être rejoué (rotation/blacklist), que le
# refresh fonctionne même sans cookie d'access token mais échoue sans
# cookie de refresh token, et que la protection CSRF s'applique aussi
# ici sans "consommer" le refresh token en cas de tentative refusée.
class CookieRefreshTests(APITestCase):
    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)

        self.password = "Test-Uniquement!48-Rivage"
        self.user = User.objects.create_user(
            username="refresh_test",
            email="refresh@example.com",
            password=self.password,
        )

        self.refresh_url = reverse("users:refresh")

        csrf_response = self.client.get(reverse("users:csrf"))
        csrf_token = csrf_response.json()["csrfToken"]

        login_response = self.client.post(
            reverse("users:login"),
            {
                "email": self.user.email,
                "password": self.password,
            },
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(login_response.status_code, 200)

        self.csrf_token = login_response.data["csrfToken"]
        self.old_refresh = self.client.cookies[
            settings.JWT_REFRESH_COOKIE_NAME
        ].value

    def refresh(self):
        return self.client.post(
            self.refresh_url,
            {},
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )

    def test_refresh_replaces_cookies(self):
        response = self.refresh()

        self.assertEqual(response.status_code, 200)

        access = response.cookies[settings.JWT_ACCESS_COOKIE_NAME]
        refresh = response.cookies[settings.JWT_REFRESH_COOKIE_NAME]

        self.assertTrue(access["httponly"])
        self.assertTrue(refresh["httponly"])
        self.assertNotEqual(refresh.value, self.old_refresh)

        body = response.content.decode()
        self.assertNotIn(access.value, body)
        self.assertNotIn(refresh.value, body)

        profile = self.client.get(reverse("users:me"))
        self.assertEqual(profile.status_code, 200)
        self.assertEqual(profile.data["id"], self.user.id)

    def test_old_refresh_cannot_be_reused(self):
        response = self.refresh()
        self.assertEqual(response.status_code, 200)

        self.client.cookies[
            settings.JWT_REFRESH_COOKIE_NAME
        ] = self.old_refresh

        response = self.refresh()

        self.assertEqual(response.status_code, 401)
        self.assertNotIn(
            settings.JWT_ACCESS_COOKIE_NAME,
            response.cookies,
        )
        self.assertNotIn(
            settings.JWT_REFRESH_COOKIE_NAME,
            response.cookies,
        )

    def test_refresh_without_access_cookie_succeeds(self):
        del self.client.cookies[settings.JWT_ACCESS_COOKIE_NAME]

        response = self.refresh()

        self.assertEqual(response.status_code, 200)

        profile = self.client.get(reverse("users:me"))
        self.assertEqual(profile.status_code, 200)

    def test_refresh_without_refresh_cookie_is_rejected(self):
        del self.client.cookies[settings.JWT_REFRESH_COOKIE_NAME]

        response = self.refresh()

        self.assertEqual(response.status_code, 401)

    def test_refresh_without_csrf_header_is_rejected(self):
        response = self.client.post(
            self.refresh_url,
            {},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

        # La tentative refusée ne doit pas consommer le refresh token.
        valid_response = self.refresh()
        self.assertEqual(valid_response.status_code, 200)

class LogoutTests(APITestCase):
    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)

        self.password = "Test-Uniquement!48-Rivage"
        self.user = User.objects.create_user(
            username="logout_test",
            email="logout@example.com",
            password=self.password,
        )

        self.logout_url = reverse("users:logout")
        self.refresh_url = reverse("users:refresh")
        self.me_url = reverse("users:me")

        csrf_response = self.client.get(reverse("users:csrf"))
        csrf_token = csrf_response.json()["csrfToken"]

        login_response = self.client.post(
            reverse("users:login"),
            {
                "email": self.user.email,
                "password": self.password,
            },
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(login_response.status_code, 200)

        self.csrf_token = login_response.data["csrfToken"]
        self.old_refresh = self.client.cookies[
            settings.JWT_REFRESH_COOKIE_NAME
        ].value

    def logout(self):
        return self.client.post(
            self.logout_url,
            {},
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )

    def test_logout_clears_cookies_and_blocks_profile(self):
        response = self.logout()

        self.assertEqual(response.status_code, 200)

        expected_paths = {
            settings.JWT_ACCESS_COOKIE_NAME: "/api/",
            settings.JWT_REFRESH_COOKIE_NAME: "/api/users/",
        }

        for name, path in expected_paths.items():
            cookie = response.cookies[name]
            self.assertEqual(cookie.value, "")
            self.assertEqual(cookie["max-age"], 0)
            self.assertEqual(cookie["path"], path)

        profile = self.client.get(self.me_url)
        self.assertEqual(profile.status_code, 401)

    def test_logout_revokes_refresh_token(self):
        response = self.logout()
        self.assertEqual(response.status_code, 200)

        # On essaie de réutiliser le jeton conservé avant la déconnexion.
        self.client.cookies[
            settings.JWT_REFRESH_COOKIE_NAME
        ] = self.old_refresh

        response = self.client.post(
            self.refresh_url,
            {},
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )

        self.assertEqual(response.status_code, 401)
        self.assertNotIn(
            settings.JWT_ACCESS_COOKIE_NAME,
            response.cookies,
        )

    def test_logout_without_csrf_is_rejected(self):
        response = self.client.post(
            self.logout_url,
            {},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

        # La tentative refusée ne doit pas déconnecter le client.
        profile = self.client.get(self.me_url)
        self.assertEqual(profile.status_code, 200)

    def test_logout_without_access_cookie_succeeds(self):
        del self.client.cookies[settings.JWT_ACCESS_COOKIE_NAME]

        response = self.logout()

        self.assertEqual(response.status_code, 200)

    def test_logout_can_be_repeated(self):
        first_response = self.logout()
        second_response = self.logout()

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)