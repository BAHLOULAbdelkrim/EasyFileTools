# EasyFile Tools — Lot 5 : dépendances, origines réseau et licences

État : audit préparatoire **non exhaustif** sur le code de la V4.2 avec lots 1–4. Ne constitue ni un avis juridique ni une attestation de conformité.

## 1. Ressources utilisées par le site actif

| Composant | Source dans le projet | Chargement | Licence / vérification |
|---|---|---|---|
| FFmpeg.wasm / cœur FFmpeg | `themes/high-tech-theme/static/js/audio/convert-audio/lib/ffmpeg.js`, `ffmpeg-core.js`, `ffmpeg-core.wasm` | Local, à l'utilisation | **Point juridique prioritaire** : le package `@ffmpeg/core` annonce `GPL-2.0-or-later` ; le wrapper `@ffmpeg/ffmpeg` annonce MIT. Voir section 2. |
| pdf-lib | `themes/high-tech-theme/static/js/vendor/pdf-lib/pdf-lib.min.js` | Fichier local, seulement certaines pages | MIT selon dépôt amont ; préserver notices de licences des dépendances regroupées dans le bundle. |
| PDF.js | `themes/high-tech-theme/static/js/common/optional-dependencies.js` | CDN cdnjs, 3.11.174, différé | Apache-2.0, vérifier attribution/NOTICE requis. |
| JSZip | Même chargeur | CDN cdnjs, 3.10.1, différé | Licence au choix MIT ou GPLv3 (choisir et respecter les notices adéquates). |
| ONNX Runtime Web | `themes/high-tech-theme/static/js/image/remove-background/background-removal-worker.js` | CDN jsDelivr, version 1.30.0, uniquement si suppression IA | MIT ; le module et les fichiers WASM proviennent d'un tiers. |
| Modèle IS-Net quantized | Même worker | Hugging Face `Ko033/isnet-general-use-onnx`, URL `resolve/main` | Dépôt déclaré Apache-2.0 ; vérifier notices/conditions applicables aux poids utilisés et à leur provenance. |
| Google Fonts (Inter/Orbitron) | `layouts/partials/head.html` | CSS externe Google, optionnel | Vérifier notices et exigences de confidentialité applicables ; un visiteur contacte les serveurs de polices. |
| Icônes locales | `static/icons/*.svg` | Local | Vérifier provenance et licence des icônes Lucide ou dérivées. |

À vérifier également : les contenus, images, symboles et tout asset issu de tiers non répertorié ici. Aucune vérification complète de SBOM/transitivité n'a été effectuée.

## 2. FFmpeg : point à résoudre **avant diffusion publique**

Le fichier `ffmpeg-core.wasm` est **distribué au navigateur** depuis le site : il ne s'agit pas d'un traitement backend invisible. L'archive contient également un bundle JS qui mentionne le cœur `@ffmpeg/core@0.12.9`, sans que cette seule chaîne prouve à elle seule l'origine exacte du binaire local.

- `@ffmpeg/ffmpeg` (wrapper JS) est publié sous **MIT**.
- `@ffmpeg/core` (binaire FFmpeg/WebAssembly) est publié sous **GPL-2.0-or-later** dans ses métadonnées de package actuelles. Les obligations de redistribution, d'accès aux sources correspondantes, de notices, et les éventuelles conséquences pour l'intégration commerciale doivent être clarifiées.
- Des bibliothèques/encodeurs activés dans la construction de FFmpeg peuvent imposer des conditions additionnelles ; la licence exacte du fichier WASM local dépend de sa provenance et de sa configuration de compilation. **Ne pas supposer** qu'il est simplement MIT ou LGPL.

**Actions demandées avant lancement** : confirmer la version/provenance du binaire, récupérer les informations de licence et les sources exactes/recette de construction du cœur, vérifier les codecs compilés et publier les notices et sources requises. Si l'on vise un produit propriétaire/premium, obtenir un avis juridique ou choisir une distribution technique dont les obligations sont compatibles avec le modèle retenu. Cela ne signifie pas automatiquement « usage commercial interdit » : il faut déterminer et respecter les obligations concrètes.

SHA-256 du WASM audité : `9f57947a5bd530d8f00c5b3f2cb2a3492faa7e5d823315342d6a8656d0a6b7b7`

## 3. Dépendances externes : risques résiduels

- PDF.js / JSZip : URL de version explicite, **aucune intégrité SRI n'est actuellement fournie** par le chargeur dynamique. Ne pas ajouter une valeur `integrity` improvisée ; obtenir les hash cryptographiques exacts des fichiers CDN ou auto-héberger après validation fonctionnelle.
- ONNX Runtime : version épinglée (1.30.0) mais chargement dynamique depuis jsDelivr. Vérifier également les WASM complémentaires et leur origine effective.
- Modèle IA : le segment `resolve/main` désigne une révision mouvante ; prévoir le **commit SHA** Hugging Face après validation du modèle choisi.
- Google Fonts : la requête externe reste présente ; les mentions de confidentialité devront décrire les ressources distantes utilisées lorsque cela est requis.
- Import par URL : l'utilisateur autorise le navigateur à contacter le site distant ; une politique CSP `connect-src` très restrictive pourrait casser cette fonctionnalité.

## 4. Politique CSP du lot 5

Le fichier `static/_headers` active seulement des restrictions **peu invasives** : `base-uri`, `object-src`, `frame-ancestors`, `form-action`, plus des en-têtes classiques. Il **n'interdit pas** le JavaScript tiers, les scripts inline, les workers, le chargement des modèles, ou les connexions réseau. Une CSP complète nécessitera un inventaire de tous les scripts inline, des `onload`, des workers, des WebAssembly, des CDN, des données `blob:` / `data:` et des URL importables ; faire d'abord ce travail en prévisualisation Cloudflare (éventuellement avec une politique Report-Only mesurée).

Ne pas ajouter `Cross-Origin-Embedder-Policy: require-corp` sans vérifier les CORS/CORP du modèle et des CDN, ni ajouter `Strict-Transport-Security`/`includeSubDomains` sans contrôler précisément les domaines concernés et leur disponibilité en HTTPS.

## Sources amont (à consulter à la date du déploiement)

- Cloudflare Pages `_headers` : https://developers.cloudflare.com/pages/configuration/headers/
- `@ffmpeg/core` : https://github.com/ffmpegwasm/ffmpeg.wasm/blob/main/packages/core/package.json
- `@ffmpeg/ffmpeg` : https://github.com/ffmpegwasm/ffmpeg.wasm/blob/main/packages/ffmpeg/package.json
- FFmpeg licensing : https://ffmpeg.org/legal.html
- pdf-lib : https://github.com/Hopding/pdf-lib
- PDF.js : https://github.com/mozilla/pdf.js/blob/master/LICENSE
- JSZip : https://github.com/Stuk/jszip
- ONNX Runtime : https://github.com/microsoft/onnxruntime/blob/main/js/web/package.json
- Modèle IA : https://huggingface.co/Ko033/isnet-general-use-onnx
