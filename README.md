# Budget 50·30·20 — PWA

Gestionnaire financier personnel en français, devise MGA (Ariary), avec stockage local dans le navigateur.

## Fonctionnalités
- Revenu initial de 450 000 Ar, modifiable.
- Répartition automatique : 50 % besoins, 30 % envies, 20 % épargne.
- Enregistrement des opérations datées et catégorisées.
- Historique mensuel.
- Objectif ordinateur initial de 1 080 000 Ar et suivi des contributions.
- Export / import des données en JSON.
- Service worker pour utilisation hors connexion après la première visite.
- Installation sur l'écran d'accueil (PWA).

## Lancer localement
Une PWA et son service worker nécessitent `localhost` ou un site HTTPS. Ouvrir directement `index.html` en `file://` ne permet pas l'installation ni le mode hors connexion.

Avec Python :
```bash
python -m http.server 8000
```
Puis ouvrir `http://localhost:8000`.

Avec Node :
```bash
npx serve .
```

## Installer sur Android
1. Déployer le dossier sur un hébergement HTTPS (GitHub Pages, Netlify, Vercel, etc.).
2. Ouvrir l'URL avec Chrome sur Android.
3. Choisir « Installer l'application » ou « Ajouter à l'écran d'accueil ».
4. Ouvrir l'application depuis l'écran d'accueil.

## Stockage et confidentialité
Les données sont conservées dans `localStorage` sur l'appareil et le navigateur utilisés. Aucun serveur, compte ou synchronisation cloud. Effacer les données du navigateur ou désinstaller/retirer le profil peut supprimer les données. Utiliser régulièrement Exporter mes données et conserver le fichier JSON dans un endroit sûr.

## Personnalisation
Modifier `DEFAULT` dans `app.js` pour changer le salaire initial, le montant cible ou les valeurs de départ.
