from django.urls import path

from .views import LoginView, MeView, RegisterView, csrf_token_view


app_name = "users"

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("csrf/", csrf_token_view, name="csrf"),
    path("login/", LoginView.as_view(), name="login"),
    path("me/", MeView.as_view(), name="me"),
]