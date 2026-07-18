# Dystopian Wars Builder

Application web locale pour consulter les unités et les règles de Dystopian Wars, composer des listes de flotte, puis les exporter ou les imprimer.

## Prérequis

- Node.js 24 ou plus récent
- npm

## Démarrage

```sh
npm install
npm run dev
```

Vite affiche l'adresse locale de l'application dans le terminal. Les listes sont enregistrées dans le `localStorage` du navigateur ; aucun serveur applicatif n'est requis.

## Vérifications

```sh
npm run format:check
npm run lint
npm test
npm run build
```

- Prettier contrôle le formatage de tous les fichiers maintenus.
- ESLint analyse TypeScript avec les informations de types.
- Les tests couvrent la logique métier, les migrations de stockage et l'intégrité des données du builder et du livre de règles.
- Le build TypeScript/Vite vérifie la compilation de production.

Utiliser `npm run format` pour appliquer automatiquement le formatage.

## Organisation

- `src/components` : interface React, organisée par domaine.
- `src/store` : état Zustand et chargement des données.
- `src/utils` : logique métier pure, persistance, export et impression.
- `src/rulebook` : modèle, indexation et tests du livre de règles.
- `public/data` : factions, unités, Battlefleets, doctrines et contenu du livre de règles.
- `public/assets` : illustrations et ressources statiques.

Les identifiants des entités de `public/data` sont persistés dans les listes des utilisateurs. Toute modification d'identifiant ou de structure doit donc être accompagnée d'une migration et de tests adaptés.

## Production

```sh
npm run build
npm run preview
```

Le résultat statique est généré dans `dist/`. Les vues lourdes du livre de règles et de l'impression sont chargées à la demande afin de réduire le JavaScript initial.
