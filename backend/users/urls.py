from django.urls import path

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
    path("register/", RegisterView.as_view(), name="register"),
    path("csrf/", csrf_token_view, name="csrf"),
    path("login/", LoginView.as_view(), name="login"),
    path("me/", MeView.as_view(), name="me"),
    path("refresh/", CookieRefreshView.as_view(), name="refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
]