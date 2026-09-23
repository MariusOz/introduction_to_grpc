# Mini-projet : une bibliothèque en gRPC

Durée : une demi-journée (environ 3h30).
Prérequis : avoir suivi le cours d'introduction à gRPC et savoir écrire une fonction en JavaScript.

## Objectif

Vous allez construire un petit service `LibraryService` qui permet de consulter des livres.
Un serveur garde la liste des livres, un client l'interroge avec gRPC.

À la fin du TP, vous saurez :

- lire et écrire un fichier `.proto` simple ;
- écrire un serveur gRPC et un client gRPC en Node.js ;
- utiliser deux des quatre modes vus en cours : **unary** et **server streaming** ;
- renvoyer une erreur gRPC propre.

Une étape bonus aborde un troisième mode, le **client streaming**.

## Organisation du projet

```
proto/library.proto   le contrat entre le client et le serveur
src/data.js           les livres (déjà écrit, ne pas modifier)
src/server.js         le serveur, à compléter
src/client.js         le client, à compléter
check.js              le script de vérification
```

Dans les fichiers, les zones à compléter sont marquées par `TODO`.
Le reste du code est fourni : lisez-le, il vous sert de modèle.

## Règles de nommage

Tout le code est écrit en anglais. Respectez ces conventions :

| Élément | Convention | Exemple |
|---|---|---|
| service, message, méthode rpc (fichier `.proto`) | PascalCase | `LibraryService`, `GetBookRequest`, `ListBooks` |
| champ d'un message (fichier `.proto`) | snake_case | `added_count` |
| fonction ou variable JavaScript | camelCase | `getBook`, `addedCount` |

Remarque : la bibliothèque `@grpc/proto-loader` convertit automatiquement les noms.
Le rpc `GetBook` devient `getBook` en JavaScript, et le champ `added_count` devient `addedCount`.

## Vérifier son travail

Un seul script sert à valider chaque étape :

```bash
node check.js 3     # vérifie l'étape 3
node check.js       # vérifie toutes les étapes
```

Chaque vérification affiche `[OK]` ou `[ECHEC]`. En cas d'échec, lisez l'indice affiché en dessous.
Passez à l'étape suivante seulement quand l'étape en cours est entièrement `[OK]`.

---

## Étape 1 : installation (15 min)

1. Installez Node.js 18 ou plus récent si besoin (`node -v` pour vérifier).
2. À la racine du projet, lancez :

   ```bash
   npm install
   ```

3. Vérifiez :

   ```bash
   node check.js 1
   ```

4. Démarrez le serveur pour voir qu'il fonctionne :

   ```bash
   npm run server
   ```

   Le message `Serveur gRPC demarre sur le port 50051` doit s'afficher. Arrêtez-le avec `Ctrl + C`.

## Étape 2 : le contrat `.proto` (30 min)

Ouvrez `proto/library.proto`. Ce fichier décrit ce que le serveur sait faire, comme dans l'exemple `UserService` du cours.

À comprendre avant d'écrire :

- `message` décrit une structure de données. Chaque champ a un **type**, un **nom** et un **numéro**.
- Le numéro (`= 1`, `= 2`...) identifie le champ dans le format binaire. Il ne doit jamais changer une fois le service en production.
- `service` liste les méthodes appelables à distance avec `rpc`.
- Le mot `stream` indique qu'un côté envoie plusieurs messages.

Travail demandé :

1. Créez le message `ListBooksRequest` avec un champ `string author = 1;`.
2. Dans `LibraryService`, déclarez la méthode `ListBooks`. Elle reçoit un `ListBooksRequest` et renvoie un **flux** de `Book` :

   ```proto
   rpc ListBooks (ListBooksRequest) returns (stream Book);
   ```

Vérifiez avec `node check.js 2`.

## Étape 3 : premier appel unary `GetBook` (45 min)

Mode unary : une requête, une réponse. C'est le mode le plus proche d'un appel REST classique.

### Côté serveur (`src/server.js`)

Complétez la fonction `getBook(call, callback)` :

- `call.request.id` contient l'identifiant demandé par le client ;
- `findBookById(id)` renvoie le livre correspondant ;
- `callback(null, book)` envoie le livre au client.

Supprimez la ligne qui renvoie `UNIMPLEMENTED` une fois votre code écrit.

### Côté client (`src/client.js`)

Complétez la fonction `getBook(client, id)`. Elle doit appeler le serveur et renvoyer une `Promise` :

```js
client.getBook({ id }, (error, book) => {
  // si error existe : reject(error)
  // sinon : resolve(book)
});
```

Remarquez que l'appel ressemble à un appel de fonction locale. C'est le principe du RPC vu en cours : le stub s'occupe de sérialiser la requête et de l'envoyer.

### Tester à la main

Dans un premier terminal :

```bash
npm run server
```

Dans un second terminal :

```bash
npm run client
```

Vérifiez avec `node check.js 3`.

## Étape 4 : gérer une erreur (20 min)

Que se passe-t-il si le client demande le livre `999`, qui n'existe pas ?

gRPC définit des codes d'erreur standard. Pour une ressource absente, on utilise `NOT_FOUND` :

```js
callback({ code: grpc.status.NOT_FOUND, message: 'Book not found' });
```

Modifiez `getBook` dans le serveur pour renvoyer cette erreur quand `findBookById` ne trouve rien.
N'oubliez pas le `return` après ce `callback`, sinon la fonction continue.

Vérifiez avec `node check.js 4`.

## Étape 5 : server streaming `ListBooks` (45 min)

Mode server streaming : le client envoie une seule requête, le serveur répond avec plusieurs messages, l'un après l'autre.

### Côté serveur

Complétez `listBooks(call)` :

1. récupérez les livres avec `findBooksByAuthor(call.request.author)` ;
2. envoyez chaque livre avec `call.write(book)` ;
3. terminez le flux avec `call.end()`.

Il n'y a pas de `callback` ici : c'est `call.end()` qui indique au client que le flux est fini.

### Côté client

Complétez `listBooks(client, author)`. Le client écoute des **événements** :

| Événement | Quand | Que faire |
|---|---|---|
| `data` | un livre arrive | l'ajouter au tableau `books` |
| `end` | le serveur a terminé | `resolve(books)` |
| `error` | une erreur survient | `reject(error)` |

Vérifiez avec `node check.js 5`, puis relancez `npm run client`.

## Étape 6 (bonus) : client streaming `AddBooks` (30 min)

Mode client streaming : le client envoie plusieurs messages, le serveur répond une seule fois à la fin.

1. Dans le `.proto`, créez le message `AddBooksResponse` avec `int32 added_count = 1;`.
2. Déclarez la méthode :

   ```proto
   rpc AddBooks (stream Book) returns (AddBooksResponse);
   ```

3. Dans le serveur, complétez `addBooks(call, callback)` :
   - `call.on('data', (book) => { ... })` est appelé pour chaque livre reçu : ajoutez-le avec `addBook(book)` et comptez-le ;
   - `call.on('end', () => { ... })` est appelé quand le client a fini : répondez avec `callback(null, { addedCount: count })`.

Vérifiez avec `node check.js 6`.

Pour aller plus loin, écrivez dans `src/client.js` une fonction `addBooks(client, books)` qui utilise `client.addBooks(callback)`, puis `call.write(book)` pour chaque livre et `call.end()`.

---

## Bilan (15 min)

Répondez en quelques lignes, à l'écrit ou à l'oral :

1. Quel est le rôle du fichier `.proto` ? Que se passe-t-il si le client et le serveur n'utilisent pas le même ?
2. Pourquoi `ListBooks` est-il en server streaming et non en unary ? Donnez un cas réel où ce choix compte.
3. Pourquoi ne peut-on pas tester ce service directement avec un navigateur ?
4. Citez une situation où vous choisiriez plutôt une API REST.

## Pour aller plus loin

Le cours présente d'autres notions que ce TP n'aborde pas : le streaming bidirectionnel, les deadlines, les intercepteurs, le Health Checking, la Server Reflection et l'outil `grpcurl`.
La documentation officielle est disponible sur [grpc.io](https://grpc.io/docs/languages/node/).

## Note pour l'enseignant

Le dossier `solution/` contient le corrigé. Pour vérifier qu'il passe toutes les étapes :

```bash
node check.js --solution
```

Pensez à retirer ce dossier avant de distribuer le projet aux étudiants.
