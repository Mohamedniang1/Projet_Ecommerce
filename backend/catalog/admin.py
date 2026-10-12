from django.contrib import admin
from django.utils.html import format_html

from .models import Category, Product, ProductImage


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1
    fields = (
        "preview",
        "image",
        "image_alt",
        "position",
    )
    readonly_fields = ("preview",)
    ordering = ("position", "pk")

    @admin.display(description="Aperçu")
    def preview(self, obj):
        if not obj or not obj.image:
            return "Choisissez une photo puis enregistrez."

        return format_html(
            '<img src="{}" alt="{}" width="90" height="90" '
            'style="object-fit:contain; border-radius:8px; '
            'background:#fff; border:1px solid #d5dfd5;">',
            obj.image.url,
            obj.image_alt or "Photo du produit",
        )


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "position",
        "is_active",
    )
    list_filter = ("is_active",)
    search_fields = ("name",)
    prepopulated_fields = {"slug": ("name",)}
    list_editable = ("position", "is_active")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "category",
        "price",
        "stock",
        "is_active",
        "is_featured",
    )
    list_filter = (
        "category",
        "is_active",
        "is_featured",
    )
    search_fields = (
        "name",
        "description",
    )
    prepopulated_fields = {"slug": ("name",)}
    list_select_related = ("category",)
    autocomplete_fields = ("category",)
    readonly_fields = (
        "created_at",
        "updated_at",
    )
    inlines = (ProductImageInline,)

    fieldsets = (
        (
            "Présentation",
            {
                "fields": (
                    "name",
                    "slug",
                    "category",
                    "description",
                ),
            },
        ),
        (
            "Photo principale",
            {
                "description": (
                    "Cette photo apparaît dans le catalogue. "
                    "Ajoutez les autres vues dans la section "
                    "« Photos supplémentaires » en bas du formulaire."
                ),
                "fields": (
                    "image",
                    "image_alt",
                ),
            },
        ),
        (
            "Prix et disponibilité",
            {
                "fields": (
                    "price",
                    "stock",
                ),
            },
        ),
        (
            "Publication",
            {
                "fields": (
                    "is_active",
                    "is_featured",
                ),
            },
        ),
        (
            "Dates",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                ),
            },
        ),
    )