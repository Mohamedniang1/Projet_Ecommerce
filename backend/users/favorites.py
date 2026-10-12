from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.models import Product
from .authentication import CookieJWTAuthentication
from .models import Favorite


class FavoriteSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField(read_only=True)
    product = serializers.SerializerMethodField()

    class Meta:
        model = Favorite
        fields = ("product_id", "product")

    def get_product(self, obj):
        product = obj.product
        # Un produit dépublié reste retirable du carnet sans exposer sa fiche.
        if not product.is_active or not product.category.is_active:
            return None
        return {
            "id": product.pk,
            "name": product.name,
            "slug": product.slug,
            "price": str(product.price),
            "image": product.image.url if product.image else None,
            "image_alt": product.image_alt,
            "category": product.category.name,
            "in_stock": product.stock > 0,
        }


@method_decorator(never_cache, name="dispatch")
class FavoriteListView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        favorites = Favorite.objects.filter(user=request.user).select_related("product__category")
        return Response({"user_id": request.user.pk, "results": FavoriteSerializer(favorites, many=True).data})


@method_decorator(never_cache, name="dispatch")
class FavoriteDetailView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def put(self, request, product_id):
        if request.data:
            raise serializers.ValidationError("Aucun champ supplémentaire n’est accepté.")
        get_user_model().objects.select_for_update().get(pk=request.user.pk)
        product = get_object_or_404(Product, pk=product_id, is_active=True, category__is_active=True)
        favorites = Favorite.objects.filter(user=request.user)
        existing = favorites.filter(product=product).first()
        if existing:
            return Response(FavoriteSerializer(existing).data)
        if favorites.count() >= 100:
            raise serializers.ValidationError("Vous avez atteint 100 favoris. Retirez un article pour en enregistrer un autre.")
        favorite = Favorite.objects.create(user=request.user, product=product)
        return Response(FavoriteSerializer(favorite).data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def delete(self, request, product_id):
        if request.data:
            raise serializers.ValidationError("Aucun champ supplémentaire n’est accepté.")
        get_user_model().objects.select_for_update().get(pk=request.user.pk)
        Favorite.objects.filter(user=request.user, product_id=product_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
