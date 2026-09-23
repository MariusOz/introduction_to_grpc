// Script de verification du mini-projet gRPC.
//
// Utilisation :
//   node check.js        verifie toutes les etapes
//   node check.js 3      verifie seulement l'etape 3
//   node check.js --solution   verifie le corrige (dossier solution/)

const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const useSolution = args.includes('--solution');
const requestedStep = args.find((arg) => /^[1-6]$/.test(arg));

const ROOT = useSolution ? path.join(__dirname, 'solution') : __dirname;
const PROTO_PATH = path.join(ROOT, 'proto', 'library.proto');
const TIMEOUT_MS = 3000;

let failures = 0;

function pass(label) {
  console.log(`  [OK]    ${label}`);
}

function fail(label, hint) {
  failures += 1;
  console.log(`  [ECHEC] ${label}`);
  if (hint) {
    console.log(`          Indice : ${hint}`);
  }
}

function withTimeout(promise, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`pas de reponse apres ${TIMEOUT_MS} ms (${label})`)), TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function loadLibraryPackage() {
  const grpc = require('@grpc/grpc-js');
  const protoLoader = require('@grpc/proto-loader');
  const packageDefinition = protoLoader.loadSync(PROTO_PATH, { keepCase: false, longs: String, defaults: true });
  return { packageDefinition, library: grpc.loadPackageDefinition(packageDefinition).library };
}

// Demarre le serveur de l'etudiant sur un port libre et renvoie { server, client }.
async function startTestServer() {
  const grpc = require('@grpc/grpc-js');
  const { createServer } = require(path.join(ROOT, 'src', 'server.js'));
  const server = createServer();
  const port = await new Promise((resolve, reject) => {
    server.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (error, boundPort) => {
      if (error) reject(error);
      else resolve(boundPort);
    });
  });
  const { library } = loadLibraryPackage();
  const client = new library.LibraryService(`127.0.0.1:${port}`, grpc.credentials.createInsecure());
  return { server, client, address: `127.0.0.1:${port}` };
}

function stopTestServer(context) {
  context.client.close();
  context.server.forceShutdown();
}

function callGetBook(client, id) {
  return withTimeout(
    new Promise((resolve, reject) => {
      client.getBook({ id }, (error, book) => (error ? reject(error) : resolve(book)));
    }),
    'GetBook',
  );
}

function callListBooks(client, author) {
  return withTimeout(
    new Promise((resolve, reject) => {
      const books = [];
      const call = client.listBooks({ author });
      call.on('data', (book) => books.push(book));
      call.on('end', () => resolve(books));
      call.on('error', reject);
    }),
    'ListBooks',
  );
}

function callAddBooks(client, books) {
  return withTimeout(
    new Promise((resolve, reject) => {
      const call = client.addBooks((error, response) => (error ? reject(error) : resolve(response)));
      for (const book of books) {
        call.write(book);
      }
      call.end();
    }),
    'AddBooks',
  );
}

// Etape 1 : installation
async function checkStep1() {
  const [major] = process.versions.node.split('.').map(Number);
  if (major >= 18) pass(`Node.js ${process.versions.node}`);
  else fail(`Node.js ${process.versions.node} est trop ancien`, 'installer Node.js 18 ou plus recent.');

  for (const dependency of ['@grpc/grpc-js', '@grpc/proto-loader']) {
    try {
      require.resolve(dependency);
      pass(`dependance ${dependency} installee`);
    } catch (error) {
      fail(`dependance ${dependency} absente`, 'lancer "npm install" a la racine du projet.');
    }
  }

  try {
    const serverModule = require(path.join(ROOT, 'src', 'server.js'));
    if (typeof serverModule.createServer === 'function') pass('src/server.js exporte createServer');
    else fail('src/server.js n\'exporte pas createServer', 'ne pas supprimer la ligne module.exports.');
  } catch (error) {
    fail('src/server.js ne se charge pas', error.message);
  }
}

// Etape 2 : fichier .proto
async function checkStep2() {
  let packageDefinition;
  try {
    ({ packageDefinition } = loadLibraryPackage());
    pass('le fichier .proto se charge sans erreur');
  } catch (error) {
    fail('le fichier .proto contient une erreur', error.message);
    return;
  }

  const request = packageDefinition['library.ListBooksRequest'];
  if (!request) {
    fail('le message ListBooksRequest est introuvable', 'verifier le nom exact : ListBooksRequest.');
  } else {
    const field = request.type.field.find((f) => f.name === 'author');
    if (field && field.type === 'TYPE_STRING' && field.number === 1) pass('ListBooksRequest contient le champ author (string, numero 1)');
    else fail('ListBooksRequest doit contenir "string author = 1;"');
  }

  const service = packageDefinition['library.LibraryService'];
  const method = service && service.ListBooks;
  if (!method) {
    fail('la methode ListBooks n\'est pas declaree dans LibraryService');
  } else if (!method.requestStream && method.responseStream) {
    pass('ListBooks est declaree en server streaming');
  } else {
    fail('ListBooks n\'a pas le bon type', 'le mot "stream" doit etre uniquement devant le type de retour.');
  }
}

// Etape 3 : GetBook
async function checkStep3() {
  const context = await startTestServer();
  try {
    try {
      const book = await callGetBook(context.client, 1);
      if (book.title === 'Les Miserables' && book.author === 'Victor Hugo') pass('le serveur renvoie le livre 1');
      else fail('le serveur renvoie un livre incorrect', `recu : ${JSON.stringify(book)}`);
    } catch (error) {
      fail('le serveur ne repond pas correctement a GetBook', error.message);
    }

    try {
      const { createClient, getBook } = require(path.join(ROOT, 'src', 'client.js'));
      const studentClient = createClient(context.address);
      const book = await withTimeout(getBook(studentClient, 3), 'getBook du client');
      studentClient.close();
      if (book && book.title === "L'Etranger") pass('la fonction getBook du client renvoie le livre 3');
      else fail('la fonction getBook du client renvoie un resultat incorrect', 'appeler resolve(book) avec le livre recu.');
    } catch (error) {
      fail('la fonction getBook du client echoue', error.message);
    }
  } finally {
    stopTestServer(context);
  }
}

// Etape 4 : gestion d'erreur
async function checkStep4() {
  const grpc = require('@grpc/grpc-js');
  const context = await startTestServer();
  try {
    await callGetBook(context.client, 999);
    fail('GetBook avec un id inconnu devrait renvoyer une erreur', 'utiliser grpc.status.NOT_FOUND.');
  } catch (error) {
    if (error.code === grpc.status.NOT_FOUND) pass('GetBook avec un id inconnu renvoie NOT_FOUND');
    else fail(`GetBook avec un id inconnu renvoie le code ${error.code} au lieu de NOT_FOUND (5)`, error.message);
  } finally {
    stopTestServer(context);
  }
}

// Etape 5 : ListBooks
async function checkStep5() {
  const context = await startTestServer();
  try {
    try {
      const books = await callListBooks(context.client, 'Albert Camus');
      const titles = books.map((b) => b.title).sort();
      if (titles.length === 2 && titles[0] === "L'Etranger" && titles[1] === 'La Peste') pass('ListBooks filtre par auteur');
      else fail('ListBooks ne renvoie pas les bons livres pour Albert Camus', `recu : ${JSON.stringify(titles)}`);
    } catch (error) {
      fail('le serveur ne repond pas correctement a ListBooks', error.message);
    }

    try {
      const books = await callListBooks(context.client, '');
      if (books.length >= 5) pass('ListBooks sans auteur renvoie tous les livres');
      else fail(`ListBooks sans auteur renvoie ${books.length} livre(s)`, 'un auteur vide doit renvoyer tous les livres.');
    } catch (error) {
      fail('ListBooks sans auteur echoue', error.message);
    }

    try {
      const { createClient, listBooks } = require(path.join(ROOT, 'src', 'client.js'));
      const studentClient = createClient(context.address);
      const books = await withTimeout(listBooks(studentClient, 'Victor Hugo'), 'listBooks du client');
      studentClient.close();
      if (Array.isArray(books) && books.length === 2) pass('la fonction listBooks du client renvoie les 2 livres de Victor Hugo');
      else fail('la fonction listBooks du client renvoie un resultat incorrect', 'appeler resolve(books) dans call.on(\'end\').');
    } catch (error) {
      fail('la fonction listBooks du client echoue', error.message);
    }
  } finally {
    stopTestServer(context);
  }
}

// Etape 6 (bonus) : AddBooks
async function checkStep6() {
  let packageDefinition;
  try {
    ({ packageDefinition } = loadLibraryPackage());
  } catch (error) {
    fail('le fichier .proto contient une erreur', error.message);
    return;
  }
  const method = packageDefinition['library.LibraryService'].AddBooks;
  if (!method || !method.requestStream || method.responseStream) {
    fail('AddBooks n\'est pas declaree en client streaming', 'le mot "stream" doit etre uniquement devant le type de la requete.');
    return;
  }
  pass('AddBooks est declaree en client streaming');

  const context = await startTestServer();
  try {
    const newBooks = [
      { title: 'Le Petit Prince', author: 'Antoine de Saint-Exupery', year: 1943 },
      { title: 'Germinal', author: 'Emile Zola', year: 1885 },
      { title: 'Candide', author: 'Voltaire', year: 1759 },
    ];
    const response = await callAddBooks(context.client, newBooks);
    if (response.addedCount === 3) pass('AddBooks renvoie addedCount = 3');
    else fail(`AddBooks renvoie addedCount = ${response.addedCount}`, 'compter chaque livre recu dans call.on(\'data\').');

    const books = await callListBooks(context.client, 'Emile Zola');
    if (books.length === 1 && books[0].title === 'Germinal') pass('les livres ajoutes sont bien enregistres');
    else fail('les livres ajoutes sont introuvables', 'appeler addBook(book) pour chaque livre recu.');
  } catch (error) {
    fail('AddBooks echoue', error.message);
  } finally {
    stopTestServer(context);
  }
}

const STEPS = [
  { number: 1, title: 'Installation', run: checkStep1 },
  { number: 2, title: 'Contrat .proto', run: checkStep2 },
  { number: 3, title: 'Unary GetBook', run: checkStep3 },
  { number: 4, title: 'Erreur NOT_FOUND', run: checkStep4 },
  { number: 5, title: 'Server streaming ListBooks', run: checkStep5 },
  { number: 6, title: 'Bonus : client streaming AddBooks', run: checkStep6 },
];

async function main() {
  if (useSolution && !fs.existsSync(ROOT)) {
    console.log('Le dossier solution/ est introuvable.');
    process.exit(1);
  }
  const selected = requestedStep ? STEPS.filter((s) => s.number === Number(requestedStep)) : STEPS;
  for (const step of selected) {
    console.log(`\nEtape ${step.number} : ${step.title}`);
    try {
      await step.run();
    } catch (error) {
      fail('erreur inattendue pendant la verification', error.message);
    }
  }
  console.log(failures === 0 ? '\nToutes les verifications sont passees.' : `\n${failures} verification(s) en echec.`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
