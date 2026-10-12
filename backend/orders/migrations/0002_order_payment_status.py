from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("orders", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="order",
            name="payment_status",
            field=models.CharField(
                choices=[("unpaid", "Non reçu"), ("paid", "Reçu et vérifié")],
                default="unpaid",
                max_length=20,
                verbose_name="statut du paiement",
            ),
        ),
        migrations.AlterField(
            model_name="order",
            name="status",
            field=models.CharField(
                choices=[
                    ("awaiting_quote", "Frais de livraison à confirmer"),
                    ("awaiting_acceptance", "En attente d’accord du client"),
                    ("awaiting_payment", "En attente de paiement"),
                    ("payment_review", "Paiement à vérifier"),
                    ("confirmed", "Commande confirmée"),
                    ("ready", "Prête pour retrait"),
                    ("shipped", "En cours de livraison"),
                    ("completed", "Terminée"),
                    ("cancelled", "Annulée"),
                ],
                default="confirmed",
                max_length=30,
                verbose_name="statut",
            ),
        ),
    ]
