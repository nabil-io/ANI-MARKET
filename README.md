# ANI MARKET — Boutique en ligne & Espace Administrateur (v2.0)

Boutique en ligne luxueuse, réactive et connectée à WhatsApp pour **ANI MARKET**, accompagnée d'un espace administrateur secret et sécurisé (/admin), conçue selon la direction artistique **« La maison dorée »**.

Site pur **HTML / CSS / JavaScript** sans framework ni étape de compilation (*no-build*), compatible avec tout type d'hébergement.

---

## Guide de déploiement en 7 étapes

### Étape 1 : Choisir votre mode d'hébergement
- **Option A (Recommandée - Mode 1 Direct avec PHP) :**
  Tout hébergement mutualisé ou VPS disposant de PHP 7.4 ou supérieur (ex. *o2switch, Hostinger, OVH, LWS, cPanel, Namecheap*). Les modifications faites dans l'espace `/admin` sont publiées **instantanément**.
- **Option B (Mode 2 Export statique) :**
  Tout hébergeur de fichiers statiques (*GitHub Pages, Cloudflare Pages, Netlify, Vercel, hébergement Web gratuit*). Les modifications se font dans le navigateur et se publient en téléchargeant un paquet ZIP.

### Étape 2 : Déposer les fichiers
Transférez l'ensemble des fichiers et dossiers du projet à la racine de votre hébergement (via FTP, gestionnaire de fichiers cPanel, glisser-déposer ou Git) :
```text
/
├── index.html
├── api.php
├── robots.txt
├── sitemap.xml
├── README.md
├── admin/
├── data/
├── uploads/
└── assets/
```
> **Important :** Lors des futures mises à jour du code, **ne remplacez jamais** les dossiers `data/` et `uploads/` sur votre serveur pour ne pas écraser les produits et photos ajoutés par la commerçante.

### Étape 3 : Ouvrir l'espace d'administration
Rendez-vous dans votre navigateur à l'adresse de votre site suivie de `/admin` :
```text
https://votre-domaine.com/admin
```

### Étape 4 : Créer votre code d'accès personnel
Au premier lancement, l'administration détecte qu'aucun code n'existe et affiche l'écran **« Créer mon code d'accès »**.
- Saisissez un code d'au moins 8 caractères.
- Confirmez-le et validez.
- Le code est immédiatement haché de manière sécurisée (`password_hash` en PHP) et stocké dans `data/secret.php` inaccessible depuis le Web.

### Étape 5 : Personnaliser les réglages de la boutique
Dans l'onglet **Réglages** :
1. Vérifiez le numéro WhatsApp (format international sans le `+`, ex : `2290196273834`).
2. Renseignez si vous le souhaitez l'adresse de la boutique, le lien d'invitation du groupe WhatsApp, ainsi que les modalités de livraison et de paiement.
3. Cliquez sur **Enregistrer les réglages**.

### Étape 6 : Gérer les produits depuis un smartphone ou un ordinateur
Dans l'onglet **Produits** :
- Cliquez sur **Ajouter un produit** : prenez une photo en direct ou choisissez depuis votre galerie (compression automatique fluide).
- Renseignez le nom, la catégorie, le prix en FCFA et l'unité (ex. *les 4 yards*, *50 ml*).
- Vous pouvez marquer un produit comme « Nouveau » ou « Populaire », ou basculer l'interrupteur rapide en « Épuisé ».

### Étape 7 (Uniquement si hébergement statique - Mode Export)
Si votre hébergeur ne supporte pas PHP :
1. Le bandeau doré **Mode export** s'affiche en haut de l'admin.
2. Effectuez vos ajouts ou modifications.
3. Cliquez sur **Télécharger le paquet (ZIP)** dans l'onglet *Compte & Système*.
4. Déposez simplement le contenu du ZIP (les dossiers `data/` et `uploads/` mis à jour) sur votre hébergeur pour actualiser le site public.

---

## Sécurité & Confidentialité

- **Espace `/admin` invisible du public :** Aucun lien n'y mène depuis la boutique publique, balise `noindex, nofollow`, exclu du sitemap et de `robots.txt`.
- **Fichier `data/secret.php` protégé :** Contient l'instruction `<?php exit; ?>` et est protégé par `data/.htaccess`. Une requête directe HTTP ne renvoie rien.
- **Dossier `uploads/.htaccess` :** Bloque l'exécution de tout script PHP ou exécutable.
- **Protection contre les attaques de force brute :** 5 échecs de mot de passe consécutifs par IP entraînent un blocage temporaire de 15 minutes.
- **Sessions sécurisées :** Durée de 12 heures, cookies `HttpOnly`, `SameSite=Strict`, `Secure`.
- **Protection XSS :** Échappement HTML strict sur tous les champs injectés dynamiquement.

---

## Test local rapide

- **En Mode statique (Mode 2) :**
  ```powershell
  python -m http.server 8000
  ```
  Ouvrez ensuite `http://localhost:8000` (site public) et `http://localhost:8000/admin` (admin).

- **En Mode direct PHP (Mode 1) :**
  ```bash
  php -S localhost:8000
  ```
