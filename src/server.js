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
  // TODO etape 3 : chercher le livre avec findBookById(call.request.id)
  // puis le renvoyer avec callback(null, book).
  //
  // TODO etape 4 : si le livre n'existe pas, renvoyer une erreur :
  // callback({ code: grpc.status.NOT_FOUND, message: 'Book not found' });

  callback({ code: grpc.status.UNIMPLEMENTED, message: 'getBook is not implemented yet' });
}

// Etape 5 : methode server streaming ListBooks.
// Le serveur envoie plusieurs messages avec call.write(...), puis termine avec call.end().
function listBooks(call) {
  // TODO etape 5 : recuperer les livres avec findBooksByAuthor(call.request.author),
  // les envoyer un par un avec call.write(book), puis appeler call.end().

  call.emit('error', { code: grpc.status.UNIMPLEMENTED, message: 'listBooks is not implemented yet' });
}

// Etape 6 (bonus) : methode client streaming AddBooks.
// Le client envoie plusieurs livres. Le serveur les recoit avec call.on('data', ...)
// et repond une seule fois, quand le client a fini (call.on('end', ...)).
function addBooks(call, callback) {
  // TODO etape 6 : a chaque livre recu, appeler addBook(book) et compter.
  // A la fin, renvoyer callback(null, { addedCount: count }).

  callback({ code: grpc.status.UNIMPLEMENTED, message: 'addBooks is not implemented yet' });
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
