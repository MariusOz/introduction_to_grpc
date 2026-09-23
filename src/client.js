const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = path.join(__dirname, '..', 'proto', 'library.proto');
const SERVER_ADDRESS = 'localhost:50051';

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: false,
  longs: String,
  defaults: true,
});
const libraryProto = grpc.loadPackageDefinition(packageDefinition).library;

// Cree le stub : l'objet qui permet d'appeler le serveur comme une fonction locale (fourni).
function createClient(address = SERVER_ADDRESS) {
  return new libraryProto.LibraryService(address, grpc.credentials.createInsecure());
}

// Etape 3 : appel unary.
// Doit renvoyer une Promise qui se resout avec le livre recu.
function getBook(client, id) {
  return new Promise((resolve, reject) => {
    // TODO etape 3 : appeler client.getBook({ id }, (error, book) => { ... })
    // Si error existe, appeler reject(error). Sinon, appeler resolve(book).

    reject(new Error('getBook is not implemented yet'));
  });
}

// Etape 5 : appel server streaming.
// Doit renvoyer une Promise qui se resout avec le tableau de tous les livres recus.
function listBooks(client, author) {
  return new Promise((resolve, reject) => {
    const books = [];
    // TODO etape 5 :
    // const call = client.listBooks({ author });
    // call.on('data', (book) => ...)   ajouter le livre dans books
    // call.on('end', () => ...)        appeler resolve(books)
    // call.on('error', (error) => ...) appeler reject(error)

    reject(new Error('listBooks is not implemented yet'));
  });
}

async function main() {
  const client = createClient();

  const book = await getBook(client, 1);
  console.log('Livre 1 :', book);

  const books = await listBooks(client, 'Victor Hugo');
  console.log('Livres de Victor Hugo :', books);

  client.close();
}

module.exports = { createClient, getBook, listBooks };

if (require.main === module) {
  main().catch((error) => {
    console.error('Erreur :', error.message);
    process.exit(1);
  });
}
