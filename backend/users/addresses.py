import re

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import generics, serializers
from rest_framework.permissions import IsAuthenticated

from .authentication import CookieJWTAuthentication
from .models import SavedAddress


class AddressSerializer(serializers.ModelSerializer):
    city_label = serializers.CharField(source="get_city_display", read_only=True)

    class Meta:
        model = SavedAddress
        fields = ("id", "label", "customer_name", "phone", "city", "city_label", "delivery_address", "is_default")
        read_only_fields = ("id", "city_label")
        # Le propriétaire vient exclusivement de la session. La contrainte
        # sur l’adresse par défaut est appliquée dans la transaction ci-dessous.
        validators = []

    def to_internal_value(self, data):
        if isinstance(data, dict):
            forbidden = set(data) - (set(self.fields) - set(self.Meta.read_only_fields))
            if forbidden:
                raise serializers.ValidationError({field: "Ce champ n’est pas accepté." for field in sorted(forbidden)})
        return super().to_internal_value(data)

    def validate_phone(self, value):
        value = re.sub(r"[\s().-]", "", value)
        if value.startswith("00221"):
            value = "+221" + value[5:]
        if re.fullmatch(r"[0-9]{9}", value):
            value = "+221" + value
        if not re.fullmatch(r"\+221[0-9]{9}", value):
            raise serializers.ValidationError("Saisissez un numéro sénégalais de 9 chiffres, avec ou sans +221.")
        return value

    def validate_is_default(self, value):
        if self.instance and self.instance.is_default and not value:
            raise serializers.ValidationError("Choisissez d’abord une autre adresse par défaut.")
        return value


class AddressAccessMixin:
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = AddressSerializer

    def get_queryset(self):
        return SavedAddress.objects.filter(user=self.request.user)

    def lock_book(self):
        # Sérialise les modifications d’un même carnet, y compris lorsqu’il
        # est vide, pour conserver une seule adresse par défaut.
        get_user_model().objects.select_for_update().get(pk=self.request.user.pk)


@method_decorator(never_cache, name="dispatch")
class AddressListCreateView(AddressAccessMixin, generics.ListCreateAPIView):
    pagination_class = None

    @transaction.atomic
    def perform_create(self, serializer):
        self.lock_book()
        addresses = self.get_queryset()
        if addresses.count() >= 10:
            raise serializers.ValidationError({"detail": "Vous pouvez conserver jusqu’à 10 adresses. Modifiez ou supprimez une adresse pour en ajouter une."})
        default = serializer.validated_data.get("is_default", False) or not addresses.exists()
        if default:
            addresses.filter(is_default=True).update(is_default=False)
        serializer.save(user=self.request.user, is_default=default)


@method_decorator(never_cache, name="dispatch")
class AddressDetailView(AddressAccessMixin, generics.RetrieveUpdateDestroyAPIView):
    http_method_names = ["get", "patch", "delete", "head", "options"]

    @transaction.atomic
    def patch(self, request, *args, **kwargs):
        self.lock_book()
        return super().patch(request, *args, **kwargs)

    def perform_update(self, serializer):
        if serializer.validated_data.get("is_default"):
            self.get_queryset().exclude(pk=serializer.instance.pk).filter(is_default=True).update(is_default=False)
        serializer.save()

    @transaction.atomic
    def delete(self, request, *args, **kwargs):
        self.lock_book()
        return super().delete(request, *args, **kwargs)

    def perform_destroy(self, instance):
        was_default = instance.is_default
        instance.delete()
        if was_default:
            replacement = self.get_queryset().first()
            if replacement:
                replacement.is_default = True
                replacement.save(update_fields=["is_default", "updated_at"])
