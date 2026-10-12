from django.urls import path
from .addresses import AddressDetailView, AddressListCreateView
from .favorites import FavoriteDetailView, FavoriteListView

from .password_reset import PasswordResetRequestView
from .password_reset_confirm import PasswordResetConfirmView
from .views import (
    CookieRefreshView,
    LoginView,
    LogoutView,
    MeView,
    RegisterView,
    csrf_token_view,
)


app_name = "users"

urlpatterns = [
    path("favorites/", FavoriteListView.as_view(), name="favorites"),
    path("favorites/<int:product_id>/", FavoriteDetailView.as_view(), name="favorite-detail"),
    path("addresses/", AddressListCreateView.as_view(), name="addresses"),
    path("addresses/<int:pk>/", AddressDetailView.as_view(), name="address-detail"),
    path("register/", RegisterView.as_view(), name="register"),
    path("csrf/", csrf_token_view, name="csrf"),
    path("login/", LoginView.as_view(), name="login"),
    path("me/", MeView.as_view(), name="me"),
    path("refresh/", CookieRefreshView.as_view(), name="refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path(
        "password-reset/",
        PasswordResetRequestView.as_view(),
        name="password-reset",
    ),
    path(
        "password-reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="password-reset-confirm",
    ),
]
