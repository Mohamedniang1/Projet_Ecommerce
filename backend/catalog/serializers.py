from rest_framework import serializers

from .models import Category, Product, ProductImage


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = (
            "id",
            "name",
            "slug",
            "description",
        )


class ProductImageSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage
        fields = (
            "id",
            "image",
            "image_alt",
            "position",
        )

    def get_image(self, obj):
        if not obj.image:
            return None

        return obj.image.url


class ProductSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    image = serializers.SerializerMethodField()
    images = ProductImageSerializer(many=True, read_only=True)
    in_stock = serializers.SerializerMethodField()
    available_quantity = serializers.IntegerField(source="stock", read_only=True)

    class Meta:
        model = Product
        fields = (
            "id",
            "name",
            "slug",
            "description",
            "price",
            "image",
            "image_alt",
            "images",
            "category",
            "in_stock",
            "is_featured",
            "in_stock",
            "available_quantity",
            "is_featured",
        )

    def get_image(self, obj):
        if not obj.image:
            return None

        return obj.image.url

    def get_in_stock(self, obj):
        return obj.stock > 0