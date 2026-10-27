# EasyFile Tools — Lot 5 : installation et vérification avant publication

**Base : site V4.2 et lots 1 à 4 déjà installés.** Ce lot n'altère aucun moteur de conversion, script client ou CSS. Les fichiers ajoutés sont :

- `static/_headers` — directives pour Cloudflare Pages (uniquement sur réponses statiques).
- `scripts/audit-v1-security.mjs` — contrôle des directives et inventaire des ressources.
- `tests/test-v1-lot5-prepublication-security.mjs` — tests ciblés.
- `docs/V1_LOT5_DEPENDANCES_ET_LICENCES.md` — inventaire et sujets juridiques à résoudre.
- `docs/V1_LOT5_VALIDATION_CLOUDFLARE.md` — ce guide.

## A. Contrôles locaux (Windows / PowerShell)

```powershell
node --test tests/*.mjs
node scripts/audit-v1-security.mjs
hugo --minify --cleanDestinationDir
node scripts/audit-v1-security.mjs public
node scripts/verify-v3-build.mjs public
node scripts/verify-v4-build.mjs public
node scripts/verify-v4.2-build.mjs public
node scripts/check-seo.mjs public
node scripts/audit-v1-links.mjs
```

Résultat attendu : tests existants et nouveaux réussis ; audit sécurité **0 erreur**. Le script affiche aussi des messages INFO : **ils ne valent pas validation juridique**. Le fichier `_headers` doit apparaître à la racine de `public` après Hugo.

## B. Vérifier les en-têtes **après un déploiement de prévisualisation** Cloudflare Pages

Le serveur local `node scripts/serve-public.mjs public 4173` ne simule pas les en-têtes Cloudflare Pages. Depuis PowerShell :

```powershell
curl.exe -I "https://ADRESSE-DE-LA-PREVISUALISATION.pages.dev/"
curl.exe -I "https://ADRESSE-DE-LA-PREVISUALISATION.pages.dev/audio/convert-audio/"
```

Contrôler la présence de `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy` et `Content-Security-Policy`. Sur une prévisualisation privée, vérifier également l'absence d'indexation par les robots. Ne pas employer cet exemple d'URL comme une vraie adresse.

**Attention** : si des routes sont servies par des Pages Functions ou des Workers, les règles `_headers` peuvent ne pas s'appliquer à ces réponses ; vérifier leur chemin serveur indépendamment.

## C. Parcours navigateur à valider après déploiement

1. **Audio/Video** : FFmpeg local, importer un fichier, convertir, télécharger, vérifier le résultat.
2. **Documents/PDF** : ouvrir ou découper un PDF (chargement à la demande de PDF.js/pdf-lib), télécharger.
3. **Archives** : générer un ZIP via JSZip depuis plusieurs résultats, ouvrir l'archive.
4. **Remove Background** : ouvrir l'outil, télécharger le runtime ONNX et le modèle IS-Net, vérifier le traitement et le cache. Ce scénario requiert une connexion réseau.
5. **Import par URL** : URL HTTPS directe sur un serveur qui autorise CORS ; vérifier que la politique de sécurité ne bloque pas sa récupération.
6. **Navigation** : vérifier le menu mobile et les fenêtres modales. Ouvrir la console navigateur : relever les éventuelles violations CSP.

## D. Points non résolus par le patch

- **Prioritaire avant public** : licence du binaire `@ffmpeg/core`, conditions de redistribution, notices et sources exactes.
- CSP complète `script-src`, `worker-src` et `connect-src` **non activée** ; la politique partielle ne constitue pas une protection complète contre XSS.
- CDN PDF.js / JSZip sans SRI ; dépendances externes et leur intégrité à auditer.
- HSTS, headers sur Functions/Workers, configuration de domaine, mentions légales, politique de confidentialité, gestion des comptes (futures versions) non traités ici.

## E. Restauration

Pour revenir exactement à l'état du lot 4, supprimer les cinq fichiers ajoutés (listés au début). Aucun fichier préexistant n'a été remplacé. Garder une sauvegarde du répertoire du site avant l'installation.
