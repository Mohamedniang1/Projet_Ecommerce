from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils.decorators import method_decorator
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect

from rest_framework import generics, serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)

from .cookies import clear_auth_cookies


User = get_user_model()

INVALID_LINK_MESSAGE = (
    "Ce lien est invalide ou a expiré. "
    "Veuillez demander un nouveau lien."
)


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField(max_length=128)
    token = serializers.CharField(max_length=256)

    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        max_length=128,
        style={"input_type": "password"},
    )

    password_confirm = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        max_length=128,
        style={"input_type": "password"},
    )

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({
                "password_confirm": (
                    "Les deux mots de passe ne correspondent pas."
                ),
            })

        return attrs


class PasswordResetConfirmThrottle(AnonRateThrottle):
    scope = "password_reset_confirm"
    rate = "10/hour"


@method_decorator(csrf_protect, name="dispatch")
@method_decorator(never_cache, name="dispatch")
class PasswordResetConfirmView(generics.GenericAPIView):
    serializer_class = PasswordResetConfirmSerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [PasswordResetConfirmThrottle]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data

        # Décoder l'identifiant présent dans le lien.
        try:
            user_id = force_str(
                urlsafe_base64_decode(data["uid"])
            )

            if not user_id.isascii() or not user_id.isdecimal():
                raise ValueError

            user_id = int(user_id)

            if not 0 < user_id <= 9223372036854775807:
                raise ValueError

        except (ValueError, TypeError, OverflowError):
            raise serializers.ValidationError({
                "detail": INVALID_LINK_MESSAGE,
            })

        # Verrouiller le compte pendant la vérification et la
        # modification pour empêcher deux utilisations simultanées.
        with transaction.atomic():
            user = (
                User.objects.select_for_update()
                .filter(pk=user_id, is_active=True)
                .first()
            )

            if (
                user is None
                or not user.has_usable_password()
                or not default_token_generator.check_token(
                    user,
                    data["token"],
                )
            ):
                raise serializers.ValidationError({
                    "detail": INVALID_LINK_MESSAGE,
                })

            try:
                validate_password(
                    data["password"],
                    user=user,
                )
            except DjangoValidationError as exc:
                raise serializers.ValidationError({
                    "password": list(exc.messages),
                })

            # Django chiffre le mot de passe avec son mécanisme
            # de hachage ; le mot de passe brut n'est pas enregistré.
            user.set_password(data["password"])
            user.save(update_fields=["password"])

            # Révoquer les jetons de renouvellement existants.
            for outstanding_token in (
                OutstandingToken.objects.filter(user=user).iterator()
            ):
                BlacklistedToken.objects.get_or_create(
                    token=outstanding_token,
                )

        response = Response({
            "message": (
                "Votre mot de passe a été modifié. "
                "Vous pouvez maintenant vous connecter."
            ),
        })

        return clear_auth_cookies(response)