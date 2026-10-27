# EasyFile Tools — Préparer R2 et Cloudflare Pages

**Base** : `EasyFileTools(20261027-020000).zip` (27 octobre 2026).  
**Statut** : fichiers de préparation produits localement ; ni R2 ni Pages ne sont configurés. Ne pas publier avant d'avoir téléchargé le WASM sur R2 et validé les tests réels.

## Livrables

- `SOURCE_CLOUDFLARE_...zip` : sources Hugo nettoyées, fonction Contact conservée, scripts et tests conservés, **sans** le WASM de 30,74 Mio. **Ne pas l'utiliser pour tester FFmpeg sans URL R2.**
- `R2_FFMPEG_...zip` : le fichier WASM d'origine, inchangé, dans l'arborescence d'upload.
- `CORRECTIF_PREPARATION_...zip` : fichiers modifiés/ajoutés à appliquer sur la source complète (ne retire pas les fichiers déjà présents ; appliquer le manifeste de nettoyage en complément).

## Étape 1 — R2 (dans ton compte Cloudflare)

1. Tableau de bord Cloudflare → **R2 Object Storage** → créer un bucket réservé aux moteurs publics, par exemple `easyfiletools-public-engines`. **Ne pas y envoyer les fichiers personnels des utilisateurs**.
2. Ouvrir le bucket → **Upload** → envoyer exactement `ffmpeg-core.9f57947a5bd5.wasm` avec la clé/chemin :
   `engines/ffmpeg/core-original/ffmpeg-core.9f57947a5bd5.wasm`.
3. Vérifier les données de l'objet : `32,232,419` octets (soit 30.74 Mio) ; SHA-256 : `9f57947a5bd530d8f00c5b3f2cb2a3492faa7e5d823315342d6a8656d0a6b7b7`. L'objet doit être servi sans transformation ni modification des octets.
4. Pour les premiers tests, R2 → Bucket → Settings → **Public Development URL** → activer `r2.dev` ; il s'agit d'un endpoint de test et non d'une solution de production. Ensuite, préférer un domaine comme `assets.easyfiletools.app` rattaché au bucket avec CDN/cache.
5. Content-Type recommandé : `application/wasm`. Pour une clé versionnée (empreinte dans le nom) : `Cache-Control: public, max-age=31536000, immutable` sur domaine personnalisé une fois validé.
6. Bucket → Settings → **CORS Policy** : importer le JSON d'exemple `R2_CORS_EXEMPLE_DASHBOARD.json`, puis **adapter le nom du projet Pages** si différent de `easyfiletools`. Les sous-domaines de preview ont souvent la forme `<hash-ou-branche>.<projet>.pages.dev`. Éviter le wildcard `*` non ciblé sauf nécessité.
7. Construire l'URL complète de l'objet en collant le domaine public R2 et le chemin de l'étape 2, par exemple `https://assets.easyfiletools.app/engines/ffmpeg/core-original/ffmpeg-core.9f57947a5bd5.wasm` (exemple seulement, **pas une URL réelle vérifiée**).

## Étape 2 — Configurer Hugo (pas besoin de modifier les moteurs)

Le chargeur lit maintenant la balise `<meta name="easyfile-ffmpeg-wasm-url" ...>` générée par Hugo à partir de `params.ffmpegWasmURL`. `ffmpeg-core.js` continue à venir de Pages ; **seul le WASM** est chargé sur R2, à la demande lorsque FFmpeg est nécessaire.

- Pour travailler sur Windows en local avec le **nouveau paquet allégé** :

```powershell
$env:HUGO_PARAMS_FFMPEGWASMURL = "https://TON-DOMAINE-R2/engines/ffmpeg/core-original/ffmpeg-core.9f57947a5bd5.wasm"
hugo --minify --cleanDestinationDir --environment production
node scripts/check-cloudflare-build.mjs public
node scripts/serve-public.mjs public 4173
```

- Pour Cloudflare Pages → projet → Settings → Environment variables (et pour les environnements Production/Preview nécessaires) :

  - `HUGO_PARAMS_FFMPEGWASMURL` : URL R2 exacte et accessible par HTTPS.
  - `HUGO_VERSION` : **recopier exactement le résultat de `hugo version` depuis ton PC** (numéro de version au format attendu par Pages), ne pas deviner.
  - `HUGO_PARAMS_SEOINDEXABLE` : `false` tant que la prévisualisation n'est pas ouverte officiellement (le thème prend ce paramètre en compte dans ses métadonnées ; contrôler `noindex` dans la page générée).

**Ne place aucun secret R2 dans ces variables !** L'URL publique du WASM n'est pas un secret. Le bucket ne doit accorder aucun droit d'écriture anonyme.

## Étape 3 — Cloudflare Pages (intégration Git privée recommandée)

- Créer un dépôt Git **privé** (GitHub ou GitLab) avec **le contenu extrait de `SOURCE_CLOUDFLARE`** à la racine, et non le ZIP lui-même.
- Ne pas ajouter `node_modules/`, `public/`, `resources/`, `reports/`, `experiments/` ni le gros WASM : ils sont exclus/retirés du paquet.
- Dans Workers & Pages → Create → Pages → Import existing Git repository :
  - Framework : Hugo.
  - Build command :

    ```sh
    hugo --minify --environment production --baseURL "$CF_PAGES_URL" && node scripts/check-cloudflare-build.mjs public
    ```

  - Build output directory : `public`
  - Root directory : `/`.

Attention : la production `.pages.dev` et les URL de preview sont accessibles publiquement. Un dépôt Git privé ne rend pas le site privé. Les preview de branche reçoivent généralement un `noindex` Cloudflare, mais **contrôler également la production Pages** avec `HUGO_PARAMS_SEOINDEXABLE=false` jusqu'au lancement.

## Étape 4 — Vérifier R2 **avant** d'activer FFmpeg

```powershell
node scripts/check-r2-ffmpeg.mjs --url=https://TON-DOMAINE-R2/engines/ffmpeg/core-original/ffmpeg-core.9f57947a5bd5.wasm --origin=http://127.0.0.1:4173
```

Le script vérifie un petit début de réponse, la signature WASM et les en-têtes CORS sans télécharger tout le fichier (si le serveur ignore Range, le lecteur est annulé). Un résultat positif n'équivaut **pas** à une preuve du bon fonctionnement de FFmpeg ; il faut aussi tester une conversion qui nécessite FFmpeg.

Pour tester CORS à partir de Pages, utiliser l'origine exacte de l'URL de déploiement (`https://...pages.dev`). Si tu modifies la politique CORS sur un domaine mis en cache, purger son cache.

## Étape 5 — Tests indispensables après déploiement

- Convert Video → WebM VP9 Medium et High : vérifier l'absence de vibrations.
- Conversion exigeant FFmpeg : surveiller F12 → Network pour `ffmpeg-core.js` (Pages) et le `.wasm` (R2). Attendre l'opération, pas au simple chargement de la page.
- Compress Video → Pause → Cancel **un seul clic**, puis relancer et vérifier barre à 0 %.
- Trim Video (Fast/Accurate), Video to Audio, Convert Audio, Cut Audio, PDF, image et Remove Background ; ouvrir le formulaire Contact seulement après configuration des secrets nécessaires.
- Analyser les requêtes `r2.dev` en F12 : `200`/`206`, CORS, aucune erreur JS ni Worker. Comparer Lighthouse sur l'URL réellement déployée.

## Limites / exigences conservées

- Aucun bucket ni projet Cloudflare n'a été créé ici ; le binaire Hugo n'était pas disponible pour faire un build réel.
- Le chemin FFmpeg R2 n'est **pas configuré dans l'archive** : le contrôle de build s'arrête volontairement si l'URL publique n'est pas donnée.
- Vérifier les obligations de licence/attribution et redistribution GPL du FFmpeg réellement utilisé **avant la publication**, ainsi que le contenu public Legal/Privacy. Voir `docs/V1_LOT5_DEPENDANCES_ET_LICENCES.md`.
- Trois tests existants attendent toujours `draft: true` pour Legal, Privacy et Contact ; ils doivent être mis à jour après décision éditoriale. Ils ne sont pas liés au changement de WASM.
- Les dépendances tiers (Mediabunny, ONNX, Google Fonts…) restent externes et chargées comme avant.

Sources : https://developers.cloudflare.com/pages/platform/limits/ ; https://developers.cloudflare.com/r2/buckets/public-buckets/ ; https://developers.cloudflare.com/r2/buckets/cors/ ; https://developers.cloudflare.com/pages/framework-guides/deploy-a-hugo-site/ ; https://gohugo.io/configuration/introduction/
