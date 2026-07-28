# Rapport de correction de l’intégration du livre de règles

Date de la revue : 18 juillet 2026  
Application : `dw-builder`  
Source contrôlée : `DW-Rule-Book-4.00_Full_W.pdf`

## 1. Résultat

L’intégration du livre de règles Dystopian Wars 4.00 a été corrigée sur quatre axes :

1. fidélité du texte canonique au PDF ;
2. qualité et rattachement des illustrations ;
3. structure de lecture et rendu typographique ;
4. tests de non-régression et accessibilité.

Le jeu de données passe de la version `2.1.0` à `2.3.0`. Les visuels officiels ont été audités individuellement et seuls les 10 schémas nécessaires à la compréhension sont exposés. Les défauts textuels confirmés ont été corrigés dans les modules canoniques, et les pages de règles ne chargent plus récursivement des chapitres entiers.

## 2. Source et contrôles préalables

Le PDF fourni a été contrôlé avant toute correction :

- chemin : `/Users/sylvainblanchard/Documents/Dropfleet Commander/Rules/DW-Rule-Book-4.00_Full_W.pdf` ;
- nombre de pages PDF : 159 ;
- version imprimée : 4.00, septembre 2025 ;
- SHA-256 : `e063ba47f8e2798873743999716452f91bebaae250906a0ccb094c87820f6fbc` ;
- concordance : le hash correspond à celui déclaré par le manifeste existant.

Le nom de source déclaré dans `manifest.json` et `validation-report.json` a été corrigé : le suffixe erroné ` (2)` a été retiré.

Les corrections portent sur les modules canoniques affichés par l’application. `source-pages.json` conserve volontairement les extractions brutes d’origine, y compris leurs défauts OCR, afin de préserver la traçabilité. Ce fichier d’archive n’est pas rendu dans l’interface.

## 3. Corrections du texte canonique

| Pages imprimées | Bloc                          | Correction                                                                                                                                                     |
| --------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 21              | `rule.arcs`                   | Suppression des libellés de diagramme `FORE`, `PORT`, `STARBOARD`, `AFT` qui avaient été insérés au milieu des phrases ; reconstitution des trois paragraphes. |
| 24–25           | `rule.unit-coherency`         | Suppression du `4''` isolé provenant du diagramme, sans supprimer les valeurs de portée de 4” présentes dans la règle.                                         |
| 30–33           | `rule.weapon-grids`           | Retrait d’une légende d’illustration étrangère au texte de règle ; déplacement du passage « Dear Diary » dans une note `flavour_text` distincte.               |
| 34–37           | `rule.chapter.core-rules`     | Retrait de la pseudo-légende `Image: Mighty fleets…` ajoutée à la note des concepteurs.                                                                        |
| 37              | `rule.initiative`             | Correction de `Initiative Initiative Dial` en `Initiative`.                                                                                                    |
| 38–39           | `rule.checking-visibility`    | Suppression de l’intrusion de légende `Fig. each D Frigate` ; restitution de `each Frigate has a Mass of 1`.                                                   |
| 44–45           | `rule.rolling-dice`           | Restitution de la fin de phrase manquante : `icon, as summarised in the table below.`                                                                          |
| 46–49           | `rule.making-an-action-roll`  | Retranscription complète des cinq étapes ; restauration des introductions tronquées et des exemples A à J, dont l’exemple complet de la page 48.               |
| 57–58           | `rule.effects-of-disorder`    | Restitution de `depending on the level of Disorder it has:` avant la liste des effets.                                                                         |
| 62–63           | `rule.b-draw-cards`           | Suppression de fragments d’en-tête de tableau (`Engagement`, `Hand`) injectés dans la prose.                                                                   |
| 74–75           | `rule.4-make-the-action-roll` | Restitution de `the opposing Admiral makes a Resistance Roll:`.                                                                                                |
| 82–83           | `rule.resolving-a-ram`        | Restitution de la distance manquante : le modèle cible recule de `1”`.                                                                                         |
| 87              | `rule.critical-damage`        | Correction de la face de token `x2`, auparavant extraite sous la forme incomplète `x `.                                                                        |
| 125             | `rule.section.force-creation` | Réunion du titre cassé `FORCE` / `SELECTION`.                                                                                                                  |
| 128             | `rule.attached-units`         | Suppression du mot `unit` dupliqué dans l’exemple du Crown Flagship.                                                                                           |
| 135             | `rule.4-draw-starting-cards`  | Restitution de `determined by the Engagement Scale.`                                                                                                           |

### Action Roll

Le bloc `MAKING AN ACTION ROLL` était le défaut le plus important : des débuts de phrases manquaient dans plusieurs paragraphes et un exemple complet n’avait pas été intégré. Il contient maintenant :

- l’explication de l’Action Roll Chart ;
- les cinq étapes dans le bon ordre ;
- les règles des Exploding Strikes ;
- le moment exact des Re-rolls ;
- le décompte des 17 Hits et des 6 Hits annulés ;
- les 11 Hits restants ;
- le regroupement final en 2 Successes ;
- les références cohérentes aux figures A à J.

### Notes et texte d’ambiance

Le texte d’ambiance n’est plus mélangé à la règle canonique :

- `Dear Diary… Admiral Bamforth` est conservé ;
- il est désormais représenté par la note `rule.weapon-grids.flavour-1` ;
- l’interface le rend comme un encart de récit, distinct de la règle.

## 4. Tableaux, tokens et nombres parasites

Les chiffres de renvoi de page avaient été concaténés aux termes de jeu. Les corrections ont été appliquées aux représentations `rows` et `records`, afin d’éviter qu’une vue structurée et une vue de repli divergent.

Tableaux corrigés :

- `disorder-effects` ;
- `attack-action-roll` ;
- `critical-damage-effects` ;
- `boarding-action-roll` ;
- `attack-run-roll`.

Exemples de nettoyage :

- `Action Roll3` → `Action Roll` ;
- `Converted4` → `Converted` ;
- `Re-rolls5` → `Re-rolls` ;
- `Obscured2` → `Obscured` ;
- `Terrain Feature3` → `Terrain Feature` ;
- `Hampered4` → `Hampered` ;
- `Escort5` / `Escort6` → `Escort` ;
- `Supporting6` → `Supporting` ;
- `Crippled2` → `Crippled` ;
- `Rally3` → `Rally` ;
- `Come About4` → `Come About` ;
- `Full Reverse5` / `Full Reverse6` → `Full Reverse` ;
- `Unit Benefits6` → `Unit Benefits`.

Les mêmes corrections sont présentes dans les effets critiques spécialisés :

- `critical.breach` ;
- `critical.hazard` ;
- `critical.navigation-lock` ;
- `critical.system-failure`.

Les nombres de jeu réels ont été conservés. Des tests ciblés protègent notamment les niveaux de Disorder, les Mass 1/3/4, les 17/11 Hits, les 2 Successes, la portée de 1” du Ram et le token `x2`.

## 5. Illustrations

### Audit de nécessité

Les 34 captures candidates ont été examinées individuellement avec leur règle associée. Les captures décoratives, les exemples déjà entièrement décrits par le texte, les références de jetons évidentes et les cadrages insuffisamment explicites ont été retirés.

Dix schémas sont conservés : arcs, cohérence d’unité, visibilité, gabarit de virage, faces de dés, piles SRS, proximité du terrain et trois cartes de déploiement distinctes. Une seule carte standard est mutualisée entre Meeting Engagement, Salvage Rights, Blockade Run et Recon Duty.

### Cadrages nettoyés

Huit images ont été recadrées ou recomposées à partir des ressources officielles :

| Page imprimée | Asset                                    | Nouveau cadrage                                                                                                |
| ------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 23            | `proximity.webp`                         | Retrait de l’encart `PAGE REFERENCES` et du numéro de page ; navires, gabarit, flèches et distances inchangés. |
| 25            | `unit-coherency-examples.webp`           | Conservation exclusive des quatre exemples A à D ; retrait de la prose voisine et du personnage latéral.       |
| 41            | `coming-about-and-turning-template.webp` | Réunion des deux schémas de rotation et du rappel du gabarit ; retrait des paragraphes environnants.           |
| 93            | `aerial-weapon-target-sequence.webp`     | Conservation du diagramme tactique seul.                                                                       |
| 107           | `srs-stack-examples.webp`                | Conservation des figures A à D et de l’explication utile de la pile mixte ; retrait du bloc de références.     |
| 113           | `interception-worked-example.webp`       | Conservation des trois panneaux E à G ; retrait du texte supérieur et de l’illustration maritime inférieure.   |
| 121           | `marker-types.webp`                      | Extraction propre des quatre marqueurs d’objectif, du Minefield et du Wreck, sans colonne de texte.            |
| 144           | `encounter-oil-fields-map.webp`          | Conservation de la carte de déploiement carrée seule.                                                          |

Pour `proximity.webp`, l’encart de références chevauchait une zone maritime qui ne pouvait pas être supprimée par un rectangle sans laisser un vide visible. Une retouche localisée a généré uniquement un petit échantillon de texture d’océan, ensuite composité dans l’image officielle. La variante complète générée n’a pas été utilisée : tous les éléments de jeu et tous les pixels hors de cette zone restent ceux de l’original.

Les dimensions et SHA-256 des huit fichiers retouchés ont été recalculés dans `visuals.json`.

### Politique d’affichage

- Les diagrammes marqués `requiredForUnderstanding: true` sont visibles immédiatement.
- Les autres visuels restent repliables pour ne pas interrompre la lecture.
- Chaque visuel conserve un titre, une description et un texte alternatif.
- La lightbox est fermable par `Échap`, piège le focus clavier et le restitue au bouton d’origine.

## 6. Typographie et structure du texte

Le rendu ne traite plus tout le contenu comme une suite de paragraphes.

Le parseur produit maintenant :

- des titres internes avec une hiérarchie `h3` à `h5` adaptée au contexte ;
- des listes à puces sémantiques ;
- des listes ordonnées décimales ;
- des listes ordonnées alphabétiques ;
- des sous-paragraphes rattachés à la bonne étape ;
- des réparations ciblées des retours de ligne d’extraction.

Les termes de règles sont remis en gras à leur première occurrence dans chaque bloc de lecture. Le dictionnaire provient des renvois canoniques et est complété pour le vocabulaire des dés : `Pool`, `Action Pool`, `Resistance Pool`, `Success Threshold`, `Bonus Dice`, `Valour Effect`, les Strikes et les Counters.

Cette restitution est sémantique : le JSON d’origine ne conserve pas les coordonnées des glyphes gras du PDF. Elle évite l’ancien défaut, où aucun terme n’était en gras, ainsi que l’excès inverse consistant à mettre chaque occurrence en gras.

## 7. Navigation et mise en page

### Sections

Avant correction, ouvrir une sous-section pouvait consolider son parent et tous ses descendants dans une seule page très longue. Cela provoquait :

- des pages massives ;
- des tableaux agrégés trop tôt ;
- des ancres ambiguës ;
- une lecture difficile sur mobile.

Chaque section est maintenant une page de lecture indépendante. Les sections parentes affichent des cartes `In this section` qui pointent vers leurs enfants directs.

Les conteneurs ne répètent plus les tableaux de leurs descendants. Les règles et tableaux sont toujours dédupliqués par identifiant canonique.

### Procédures et actions

Les étapes qui partagent un même `ruleBlockId` n’affichent plus le bloc complet à chaque ouverture.

- Si la règle contient une liste numérotée, l’étape correspondante est extraite par son numéro.
- Si la règle est une suite de paragraphes, le paragraphe le plus pertinent est choisi par correspondance lexicale déterministe.
- Les Actions dotées d’une procédure affichent directement cette procédure, sans répéter d’abord toute la règle canonique.

La procédure `Making an Action Roll`, étape 2, a été vérifiée dans le navigateur : elle contient uniquement `Resolve Exploding Strikes` et ne contient pas l’étape 3.

### Tokens et terrain

Les fiches spécialisées affichaient surtout leurs métadonnées. Elles montrent maintenant également :

- le texte explicatif complet de chaque token ;
- la définition et les paragraphes de chaque Environmental Feature ;
- la définition et les règles de chaque Terrain Feature ;
- le texte complet de chaque Marker.

### Mobile et accessibilité

Le tiroir mobile :

- se ferme par clic extérieur ou `Échap` ;
- maintient le focus à l’intérieur lorsqu’il est ouvert ;
- rend le focus au bouton d’ouverture après fermeture.

Les contrôles de copie de lien, le sommaire, les vues spécialisées et les images gardent des noms accessibles.

## 8. Tests ajoutés ou renforcés

La suite comprend maintenant 19 tests, tous passants.

Invariants couverts :

- unicité des IDs canoniques ;
- résolution de toutes les références ;
- indépendance des pages de section ;
- déduplication des règles ;
- présence exclusive des 10 visuels nécessaires ;
- mutualisation de la carte de déploiement standard ;
- existence de chaque fichier WebP ;
- concordance des dimensions JSON/fichier ;
- concordance des SHA-256 JSON/fichier ;
- recherche avec normalisation des apostrophes et diacritiques ;
- stabilité des liens profonds ;
- rendu sémantique des listes et titres ;
- absence de correspondances partielles ou superposées dans le gras ;
- extraction isolée des étapes de procédure ;
- absence des artefacts PDF connus ;
- présence des formulations et nombres critiques ;
- fin complète de chaque bloc de prose ;
- absence de suffixes de renvoi dans la prose, les tableaux, les tokens et le terrain.

## 9. Validation exécutée

Commandes :

- `npm run lint` : réussi, aucune erreur ni avertissement ;
- `npm test -- --run` : 19 tests réussis, 0 échec, 0 test ignoré ;
- `npm run build` : build TypeScript et Vite réussi ;
- `git diff --check` : aucune erreur d’espace ou de fin de ligne.

Validation navigateur :

- desktop : 1440 × 1000 ;
- mobile : 390 × 844 ;
- aucun débordement horizontal ;
- hiérarchie de titres correcte ;
- liste Action Roll de cinq éléments ;
- diagrammes requis visibles ;
- fiches Terrain et Tokens lisibles ;
- tiroir mobile testé au clavier ;
- lightbox testée au clavier avec retour de focus.

## 10. Fichiers modifiés

Données :

- `public/data/manifest.json`
- `public/data/rule-blocks.json`
- `public/data/tables.json`
- `public/data/tokens.json`
- `public/data/validation-report.json`
- `public/data/visuals.json`
- huit fichiers sous `public/data/assets/rules/`

Application :

- `src/rulebook/data.ts`
- `src/rulebook/data.test.ts`
- `src/rulebook/types.ts`
- `src/components/rules/RulebookPage.tsx`
- `src/components/rules/RulebookPrimitives.tsx`
- `src/components/rules/RulebookSectionView.tsx`
- `src/components/rules/RulebookSpecialViews.tsx`

## 11. Modification locale préexistante préservée

Le bloc `rule.rallying-a-model` contenait déjà une modification locale transformant trois puces hétérogènes en trois puces `-` cohérentes. Cette modification ne fait pas partie de cette intervention ; elle a été expressément préservée et les nouvelles listes sémantiques la rendent correctement.
