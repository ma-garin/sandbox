import { searchBooks } from '../api.js';
import { loadSession, addRecentSearch, loadRecentSearches, clearRecentSearches } from '../store.js';
import { validateQuery, validateIsbn } from '../validate.js';
import { showError, clearError, setLoading } from '../ui.js';

const form = document.getElementById('search-form');
const errorBox = document.getElementById('search-error');
const results = document.getElementById('results');
const submit = document.getElementById('search-submit');

function renderRecent(list) {
  const ul = document.getElementById('recent-list');
  ul.innerHTML = '';
  for (const q of list) {
    const li = document.createElement('li');
    li.textContent = q;
    ul.appendChild(li);
  }
}

function renderResults(books) {
  results.innerHTML = '';
  document.getElementById('result-count').textContent = String(books.length);
  if (books.length === 0) {
    const li = document.createElement('li');
    li.textContent = '該当する本はありません。検索語を変えてお試しください';
    li.classList.add('is-empty');
    results.appendChild(li);
    return;
  }
  for (const book of books) {
    const li = document.createElement('li');
    li.textContent = `${book.title} / ${book.author}`;
    if (!book.available) li.classList.add('is-unavailable');
    results.appendChild(li);
  }
}

async function handleSearch(event) {
  event.preventDefault();
  clearError(errorBox);
  const session = loadSession();
  if (!session) {
    window.location.href = '../index.html';
    return;
  }
  const query = document.getElementById('query').value;
  const isbn = document.getElementById('isbn-filter').value;
  const category = document.getElementById('category').value;
  const queryError = validateQuery(query);
  if (queryError) {
    showError(errorBox, queryError);
    return;
  }
  if (isbn !== '') {
    const isbnError = validateIsbn(isbn);
    if (isbnError) {
      showError(errorBox, isbnError);
      return;
    }
  }
  setLoading(submit, true);
  try {
    const books = await searchBooks(query.trim(), category, session.token);
    const onlyAvailable = document.getElementById('available-only').checked;
    renderResults(onlyAvailable ? books.filter((b) => b.available) : books);
    renderRecent(addRecentSearch(query.trim()));
  } catch (err) {
    showError(errorBox, err.message || '検索に失敗しました。時間をおいて再度お試しください');
  } finally {
    setLoading(submit, false);
  }
}

form.addEventListener('submit', handleSearch);
document.getElementById('clear-recent').addEventListener('click', () => {
  clearRecentSearches();
  renderRecent([]);
});
renderRecent(loadRecentSearches());
