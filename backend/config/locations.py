from django.db import models


class City(models.TextChoices):
    DAKAR = "dakar", "Dakar"
    TOUBA = "touba", "Touba"
    TAMBACOUNDA = "tambacounda", "Tambacounda"
