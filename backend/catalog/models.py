from django.core.validators import MinValueValidator
from django.db import models


class Category(models.Model):
    name = models.CharField(
        "nom",
        max_length=100,
        unique=True,
    )
    slug = models.SlugField(
        "identifiant dans l’adresse",
        max_length=120,
        unique=True,
    )
    description = models.TextField(
        "description",
        blank=True,
    )
    is_active = models.BooleanField(
        "visible dans la boutique",
        default=True,
    )
    position = models.PositiveIntegerField(
        "ordre d’affichage",
        default=0,
    )

    class Meta:
        ordering = ["position", "name"]
        verbose_name = "catégorie"
        verbose_name_plural = "catégories"

    def __str__(self):
        return self.name


class Product(models.Model):
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products",
        verbose_name="catégorie",
    )
    name = models.CharField(
        "nom",
        max_length=200,
    )
    slug = models.SlugField(
        "identifiant dans l’adresse",
        max_length=220,
        unique=True,
    )
    description = models.TextField(
        "description",
        blank=True,
    )
    price = models.DecimalField(
        "prix en FCFA",
        max_digits=12,
        decimal_places=0,
        validators=[MinValueValidator(1)],
        help_text="Montant entier, par exemple : 15000.",
    )
    image = models.ImageField(
        "photo principale",
        upload_to="products/%Y/%m/",
        blank=True,
    )
    image_alt = models.CharField(
        "description de la photo",
        max_length=250,
        blank=True,
        help_text="Décrivez brièvement le produit visible.",
    )
    stock = models.PositiveIntegerField(
        "quantité en stock",
        default=0,
    )
    is_active = models.BooleanField(
        "publié dans la boutique",
        default=False,
        help_text="Cochez après avoir vérifié la fiche et la photo.",
    )
    is_featured = models.BooleanField(
        "mettre en avant",
        default=False,
    )
    created_at = models.DateTimeField(
        "créé le",
        auto_now_add=True,
    )
    updated_at = models.DateTimeField(
        "modifié le",
        auto_now=True,
    )

    class Meta:
        ordering = ["-created_at", "-pk"]
        verbose_name = "produit"
        verbose_name_plural = "produits"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(price__gte=1),
                name="catalog_product_price_positive",
            ),
        ]

    def __str__(self):
        return self.name

class ProductImage(models.Model):
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="images",
        verbose_name="produit",
    )
    image = models.ImageField(
        "photo",
        upload_to="products/gallery/%Y/%m/",
    )
    image_alt = models.CharField(
        "description de la photo",
        max_length=250,
        blank=True,
        help_text="Exemple : vue de dos du flacon.",
    )
    position = models.PositiveIntegerField(
        "ordre d’affichage",
        default=0,
        help_text="Les plus petits nombres apparaissent en premier.",
    )

    class Meta:
        ordering = ["position", "pk"]
        verbose_name = "photo supplémentaire"
        verbose_name_plural = "photos supplémentaires"

    def __str__(self):
        return f"Photo de {self.product.name}"

