# Paiement manuel

Les instructions sont en lecture seule. Aucun transfert ni changement de statut
de paiement n'est déclenché par leur affichage ou par les boutons de copie.

Configuration dans le fichier `.env` à la racine du projet :

```dotenv
MANUAL_PAYMENTS_ENABLED=true
MANUAL_PAYMENTS_TEST_MODE=true
PAYMENT_WAVE_PHONE=
PAYMENT_WAVE_NAME=
PAYMENT_ORANGE_MONEY_PHONE=
PAYMENT_ORANGE_MONEY_NAME=
```

Les numéros doivent être au format `+221` suivi de neuf chiffres, sans espaces.
Les noms doivent correspondre aux bénéficiaires que les clients verront dans
leur application. Ces coordonnées sont publiques pour les clients concernés ;
ne jamais utiliser ces variables pour un code PIN ou une clé API.

Le mode aperçu est actif quand `MANUAL_PAYMENTS_TEST_MODE=true` : les coordonnées
s'affichent, mais aucun transfert ne doit être effectué. Pour les paiements réels,
passer cette variable à `false` seulement au lancement. Après modification du `.env`,
recréer le service : `docker compose up -d --force-recreate backend`.

Les instructions sont présentées seulement pour une commande confirmée,
non payée, avec un total connu. Chaque commande affiche uniquement le moyen
de paiement sélectionné. Si sa configuration est absente ou invalide, le client
voit que le paiement n'est pas encore disponible.

L'administrateur vérifie la réception dans son compte, puis utilise l'action
« Enregistrer le paiement reçu et vérifié ». La confirmation et l’historique
vérifient automatiquement le suivi toutes les 30 secondes lorsque la page est
visible et la connexion disponible, ainsi qu’au retour sur l’onglet. Le bouton
« Actualiser » permet aussi une vérification immédiate. Ce suivi ne déclenche
aucun paiement et ne valide pas lui-même la réception d’argent.
Les coordonnées affichées sont celles de la configuration
actuelle, elles ne sont pas enregistrées dans chaque commande.
