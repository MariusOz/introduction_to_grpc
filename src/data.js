// Donnees de la bibliotheque (fichier fourni, pas besoin de le modifier).

const BOOKS = [
  { id: 1, title: 'Les Miserables', author: 'Victor Hugo', year: 1862 },
  { id: 2, title: 'Notre-Dame de Paris', author: 'Victor Hugo', year: 1831 },
  { id: 3, title: "L'Etranger", author: 'Albert Camus', year: 1942 },
  { id: 4, title: 'La Peste', author: 'Albert Camus', year: 1947 },
  { id: 5, title: 'Vingt mille lieues sous les mers', author: 'Jules Verne', year: 1870 },
];

function findBookById(id) {
  return BOOKS.find((book) => book.id === id);
}

function findBooksByAuthor(author) {
  if (!author) {
    return BOOKS;
  }
  return BOOKS.filter((book) => book.author === author);
}

function addBook(book) {
  const newId = Math.max(...BOOKS.map((b) => b.id)) + 1;
  const newBook = { id: newId, title: book.title, author: book.author, year: book.year };
  BOOKS.push(newBook);
  return newBook;
}

module.exports = { BOOKS, findBookById, findBooksByAuthor, addBook };
