# Espace enseignant RLS

Interface reprenant la maquette fournie par le professeur. Le code est public ; aucun document pédagogique, nom d’élève, diagnostic, point ou remarque n’est inclus dans ce dépôt.

## Fonctionnement

- GitHub Pages sert l’interface.
- Supabase Auth identifie le professeur. Une liste privée d’adresses vérifiées autorise son compte uniquement.
- PostgreSQL conserve les points, remarques et événements datés. Une fonction transactionnelle vérifie les droits et écrit la valeur et son historique ensemble. Les identifiants de requêtes empêchent les doubles points après une nouvelle tentative réseau. Une remarque périmée est refusée plutôt qu’écrasée.
- La fonction `rls-gateway` vérifie la session et l’autorisation avant de lire `BPDRED/rls-teaching`. Un jeton GitHub de lecture, limité à ce seul dépôt, reste exclusivement dans les secrets serveur de Supabase.
- Le navigateur ouvre les documents et leurs images sous leurs chemins d’origine, via un service worker. Aucun fichier n’est publié avec le code ni mis en cache localement. Les accents et sous-dossiers sont conservés. Les dossiers de travail, le cloud et le dossier d’identité passif sont exclus du service.
- Seule la session de connexion est conservée temporairement dans `sessionStorage`. Les données élèves ne sont jamais sauvegardées dans le navigateur. Les brouillons non enregistrés restent en mémoire avec un avertissement avant fermeture. La synchronisation relit le serveur toutes les 20 secondes et à l’actualisation.
- Le catalogue se cale sur un commit du dépôt privé. La mise à jour de la source devient disponible après actualisation du site, avec un cache serveur de catalogue de 30 secondes maximum. Une séance prévue n’est jamais présentée comme enseignée.

## Développement et vérifications

Node 22 ou plus récent. `npm ci`, `npm test`, puis `npm run build`. Servir `dist/` sur localhost ou HTTPS ; le service worker est indispensable aux documents privés. Les tests PostgreSQL s’exécutent dans PGlite, avec droits des rôles, refus d’accès anonyme, historique, dédoublonnage et conflit de version.

Les migrations et le code de fonction se trouvent dans `supabase/`. `web/config.js` ne contient que l’adresse du projet et sa clé publiable, qui n’accorde aucun droit sans les règles de base.

## Configuration du déploiement

1. Appliquer les migrations à un projet Supabase gratuit et déployer `rls-gateway`.
2. Configurer le secret serveur `GITHUB_READ_TOKEN` avec un jeton de lecture Contents limité à `BPDRED/rls-teaching`. Aucun secret dans Git, dans l’URL ou dans le code public.
3. Ajouter l’adresse personnelle du professeur à `rls_private.teacher_emails` depuis l’administration. La migration n’embarque aucune adresse personnelle. Le compte est autorisé après vérification de cette adresse par Supabase.
4. Autoriser l’URL du site dans les URL de redirection Supabase Auth et définir le Site URL. Pour les liens email, utiliser le fournisseur SMTP du projet et vérifier effectivement la livraison.
5. Activer GitHub Pages avec la source GitHub Actions. Le workflow ne publie que `dist/`.
6. Publier la structure pédagogique approuvée dans le dépôt privé. Un dépôt avec l’ancienne structure produit une erreur explicite, sans faux catalogue de démonstration.

Vérifier depuis deux sessions authentifiées : point, remarque, historique, rechargement, erreur réseau, perte de session et ouverture d’un HTML avec ses images. Un déploiement de l’interface seul ne prouve pas que les documents privés sont connectés.
