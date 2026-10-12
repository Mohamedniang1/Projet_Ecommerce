from django.conf import settings
from django.http import JsonResponse
from django.middleware.csrf import get_token, rotate_token
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import (
    csrf_protect,
    ensure_csrf_cookie,
)
from django.views.decorators.http import require_GET

from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from .authentication import CookieJWTAuthentication
from .cookies import clear_auth_cookies, set_auth_cookies
from .serializers import (
    LoginSerializer,
    ProfileSerializer,
    RegisterSerializer,
)


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]


@require_GET
@never_cache
@ensure_csrf_cookie
def csrf_token_view(request):
    return JsonResponse({
        "csrfToken": get_token(request),
    })


@method_decorator(csrf_protect, name="dispatch")
@method_decorator(never_cache, name="dispatch")
class LoginView(generics.GenericAPIView):
    serializer_class = LoginSerializer
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]
        remember = serializer.validated_data["remember"]

        refresh = RefreshToken.for_user(user)

        # Conserver le choix dans le jeton signé.
        refresh["remember"] = remember
        access = refresh.access_token

        rotate_token(request)

        response = Response({
            "message": "Connexion réussie.",
            "user": {
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
            },
            "csrfToken": get_token(request),
        })

        return set_auth_cookies(
            response,
            access,
            refresh,
            remember=remember,
        )


@method_decorator(never_cache, name="dispatch")
class MeView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = ProfileSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        serializer = ProfileSerializer(
            request.user,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data)

@method_decorator(csrf_protect, name="dispatch")
@method_decorator(never_cache, name="dispatch")
class CookieRefreshView(TokenRefreshView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get(
            settings.JWT_REFRESH_COOKIE_NAME
        )

        if not refresh_token:
            raise InvalidToken(
                "Cookie de renouvellement absent."
            )

        try:
            # Vérifier le jeton avant de lire le choix enregistré.
            current_refresh = RefreshToken(refresh_token)
            remember = (
                current_refresh.get("remember", False) is True
            )

            serializer = self.get_serializer(
                data={"refresh": refresh_token}
            )
            serializer.is_valid(raise_exception=True)

        except TokenError as error:
            raise InvalidToken(
                "Jeton de renouvellement invalide ou expiré."
            ) from error

        tokens = serializer.validated_data

        response = Response({
            "message": "Connexion renouvelée.",
        })

        return set_auth_cookies(
            response,
            tokens["access"],
            tokens["refresh"],
            remember=remember,
        )


@method_decorator(csrf_protect, name="dispatch")
@method_decorator(never_cache, name="dispatch")
class LogoutView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.COOKIES.get(
            settings.JWT_REFRESH_COOKIE_NAME
        )

        if refresh_token:
            try:
                RefreshToken(refresh_token).blacklist()
            except TokenError:
                # Supprimer les cookies même si le jeton
                # est déjà expiré ou révoqué.
                pass

        response = Response({
            "message": "Déconnexion réussie.",
        })

        return clear_auth_cookies(response)