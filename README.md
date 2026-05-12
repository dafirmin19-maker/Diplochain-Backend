# Déploiement backend DiploChain

Ce backend Express peut être déployé gratuitement sur un service comme Railway ou Render.

## Déploiement recommandé (Railway)

1. Crée un compte sur https://railway.app
2. Crée un nouveau projet et connecte-le à ton dépôt Git si tu veux.
3. Choisis le dossier `backend` comme racine du service.
4. Railway détectera automatiquement `package.json` et installera les dépendances.
5. Utilise la commande de démarrage :
   ```
   npm start
   ```
6. Une URL publique sera fournie, par exemple :
   `https://diplochain-backend.up.railway.app`

## Configuration de l'application Flutter

1. Ouvre `lib/services/api_config.dart`.
2. Remplace `YOUR_PUBLIC_API_HOST` par l'hôte public fourni par Railway.
3. Modifie `mode` pour utiliser `ConnectionMode.public` :
   ```dart
   static ConnectionMode mode = ConnectionMode.public;
   ```
4. Reconstruis l'APK avec la nouvelle configuration.

## Notes

- Le service gratuit Railway peut mettre le backend en veille après une période d'inactivité.
- Pour un déploiement de test temporaire, tu peux aussi utiliser `ngrok` si tu veux exposer ton serveur local.
