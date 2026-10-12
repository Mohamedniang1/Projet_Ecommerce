from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.decorators import method_decorator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect

from rest_framework import generics, serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle


User = get_user_model()


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)

    def validate_email(self, value):
        return value.strip().lower()


class PasswordResetRequestThrottle(AnonRateThrottle):
    scope = "password_reset_request"
    rate = "5/hour"


@method_decorator(csrf_protect, name="dispatch")
@method_decorator(never_cache, name="dispatch")
class PasswordResetRequestView(generics.GenericAPIView):
    serializer_class = PasswordResetRequestSerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [PasswordResetRequestThrottle]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]

        user = User.objects.filter(
            email__iexact=email,
            is_active=True,
        ).first()

        if user is not None and user.has_usable_password():
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)

            query = urlencode({
                "uid": uid,
                "token": token,
            })

            reset_url = (
                f"{settings.FRONTEND_URL}/reinitialiser-mot-de-passe"
                f"?{query}"
            )

            duration_minutes = settings.PASSWORD_RESET_TIMEOUT // 60

            message = (
                "Bonjour,\n\n"
                "Vous avez demandé à modifier votre mot de passe "
                "KeurMayata.\n\n"
                "Ouvrez ce lien pour choisir un nouveau mot de passe :\n"
                f"{reset_url}\n\n"
                f"Ce lien est valable {duration_minutes} minutes.\n\n"
                "Si vous n'avez pas fait cette demande, "
                "vous pouvez ignorer cet e-mail.\n\n"
                "L'équipe KeurMayata"
            )

            send_mail(
                subject="Réinitialiser votre mot de passe KeurMayata",
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )

        # Même réponse, que l'adresse existe ou non.
        return Response({
            "message": (
                "Si un compte actif correspond à cette adresse, "
                "vous recevrez un lien de réinitialisation."
            ),
        })