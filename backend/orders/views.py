from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache

from rest_framework import generics
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from users.authentication import CookieJWTAuthentication

from .models import Order, PickupPoint
from .serializers import (
    OrderCreateSerializer,
    OrderSerializer,
    PickupPointSerializer,
)
from .services import create_order_request


class OrderPagination(PageNumberPagination):
    page_size = 10


@method_decorator(never_cache, name="dispatch")
class PickupPointListView(generics.ListAPIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    serializer_class = PickupPointSerializer
    pagination_class = None

    queryset = PickupPoint.objects.filter(is_active=True)


@method_decorator(never_cache, name="dispatch")
class OrderListCreateView(generics.ListAPIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = OrderSerializer
    pagination_class = OrderPagination

    def get_queryset(self):
        return (
            Order.objects
            .filter(user=self.request.user)
            .prefetch_related("items__product")
        )

    def post(self, request):
        serializer = OrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        order, created = create_order_request(
            user=request.user,
            data=serializer.validated_data,
        )

        return Response(
            OrderSerializer(order).data,
            status=201 if created else 200,
        )


@method_decorator(never_cache, name="dispatch")
class OrderDetailView(generics.RetrieveAPIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = OrderSerializer

    def get_queryset(self):
        return (
            Order.objects
            .filter(user=self.request.user)
            .prefetch_related("items__product")
        )
