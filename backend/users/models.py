from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from config.locations import City


class User(AbstractUser):
    class Role(models.TextChoices):
        CLIENT = "CLIENT", "Client"
        MANAGER = "MANAGER", "Gestionnaire"

    email = models.EmailField(unique=True)

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.CLIENT,
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]


class SavedAddress(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="saved_addresses")
    label = models.CharField("nom de l’adresse", max_length=60)
    customer_name = models.CharField("destinataire", max_length=200)
    phone = models.CharField("téléphone", max_length=30)
    city = models.CharField("ville", max_length=20, choices=City.choices)
    delivery_address = models.TextField("adresse et indications", max_length=1000)
    is_default = models.BooleanField("adresse par défaut", default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_default", "-updated_at", "-pk"]
        verbose_name = "adresse enregistrée"
        verbose_name_plural = "adresses enregistrées"
        constraints = [models.UniqueConstraint(
            fields=["user"], condition=models.Q(is_default=True),
            name="users_one_default_address",
        )]

    def __str__(self):
        return f"{self.label} — {self.get_city_display()}"


class Favorite(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorites")
    product = models.ForeignKey("catalog.Product", on_delete=models.CASCADE, related_name="favorites")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-pk"]
        constraints = [models.UniqueConstraint(fields=["user", "product"], name="users_unique_favorite")]
        verbose_name = "favori"
        verbose_name_plural = "favoris"
