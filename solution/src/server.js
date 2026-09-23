const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { findBookById, findBooksByAuthor, addBook } = require('./data');

const PROTO_PATH = path.join(__dirname, '..', 'proto', 'library.proto');
const DEFAULT_PORT = 50051;

// Lecture du fichier .proto (fourni).
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: false,
  longs: String,
  defaults: true,
});
const libraryProto = grpc.loadPackageDefinition(packageDefinition).library;

// Etape 3 et 4 : methode unary GetBook.
// call.request contient la requete envoyee par le client (ici { id }).
// callback(error, response) renvoie la reponse au client.
function getBook(call, callback) {
  const book = findBookById(call.request.id);
  if (!book) {
    callback({ code: grpc.status.NOT_FOUND, message: 'Book not found' });
    return;
  }
  callback(null, book);
}

// Etape 5 : methode server streaming ListBooks.
// Le serveur envoie plusieurs messages avec call.write(...), puis termine avec call.end().
function listBooks(call) {
  const books = findBooksByAuthor(call.request.author);
  for (const book of books) {
    call.write(book);
  }
  call.end();
}

// Etape 6 (bonus) : methode client streaming AddBooks.
// Le client envoie plusieurs livres. Le serveur les recoit avec call.on('data', ...)
// et repond une seule fois, quand le client a fini (call.on('end', ...)).
function addBooks(call, callback) {
  let count = 0;
  call.on('data', (book) => {
    addBook(book);
    count += 1;
  });
  call.on('end', () => {
    callback(null, { addedCount: count });
  });
}

// Cree le serveur et lui associe les methodes du service (fourni).
function createServer() {
  const server = new grpc.Server();
  server.addService(libraryProto.LibraryService.service, {
    getBook,
    listBooks,
    addBooks,
  });
  return server;
}

// Demarre le serveur sur un port (fourni).
function startServer(port = DEFAULT_PORT) {
  const server = createServer();
  server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (error) => {
    if (error) {
      console.error('Impossible de demarrer le serveur :', error.message);
      return;
    }
    console.log(`Serveur gRPC demarre sur le port ${port}`);
  });
  return server;
}

module.exports = { createServer, startServer };

// Ce bloc s'execute seulement avec "node src/server.js".
if (require.main === module) {
  startServer();
}
