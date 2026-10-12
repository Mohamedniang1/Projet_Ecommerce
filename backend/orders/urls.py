from django.urls import path

from .views import (
    OrderDetailView,
    OrderListCreateView,
    PickupPointListView,
)


app_name = "orders"

urlpatterns = [
    path(
        "",
        OrderListCreateView.as_view(),
        name="list-create",
    ),
    path(
        "pickup-points/",
        PickupPointListView.as_view(),
        name="pickup-points",
    ),
    path(
        "<uuid:pk>/",
        OrderDetailView.as_view(),
        name="detail",
    ),
]