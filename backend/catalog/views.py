from rest_framework import filters, generics
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny

from .models import Category, Product
from .serializers import CategorySerializer, ProductSerializer


class ProductPagination(PageNumberPagination):
    page_size = 12


class CategoryListView(generics.ListAPIView):
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    pagination_class = None

    queryset = Category.objects.filter(is_active=True)


class PublishedProductMixin:
    serializer_class = ProductSerializer
    permission_classes = [AllowAny]
    authentication_classes = []

    def get_queryset(self):
        return Product.objects.filter(
            is_active=True,
            category__is_active=True,
        ).select_related("category").prefetch_related("images")


class ProductListView(
    PublishedProductMixin,
    generics.ListAPIView,
):
    pagination_class = ProductPagination

    filter_backends = [
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    search_fields = (
        "name",
        "description",
    )
    ordering_fields = (
        "price",
        "name",
        "created_at",
    )
    ordering = ("-created_at", "-pk")

    def get_queryset(self):
        queryset = super().get_queryset()

        category = self.request.query_params.get("category")

        if category:
            queryset = queryset.filter(
                category__slug=category,
            )

        return queryset


class ProductDetailView(
    PublishedProductMixin,
    generics.RetrieveAPIView,
):
    lookup_field = "slug"