/* LIVRA 4.9.3 — text-only editorial covers. No remote or AI image requests. */
(function () {
  "use strict";
  function el(tag, cls, value) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (value !== undefined) node.textContent = value;
    return node;
  }
  function card(book, index) {
    const button = el("button", "book-card text-only-book-card");
    button.type = "button";
    button.setAttribute("aria-label", "Abrir libro " + (book.title || "Mi historia"));
    const tone = Number.isInteger(book.coverTone) ? (book.coverTone % 5) + 1 : (index % 5) + 1;
    const cover = el("div", "book-cover text-only-book-cover cover-tone-" + tone);
    cover.append(
      el("span", "book-cover-kicker", "LIVRA ORIGINAL"),
      el("span", "book-cover-ornament", "✦"),
      el("strong", "book-cover-title", book.title || "Mi historia"),
      el("span", "book-cover-subtitle", book.subtitle || "Una historia contada con tu voz"),
      el("span", "book-cover-meta", typeof window.dateText === "function" ? window.dateText(book.createdAt) : new Date(book.createdAt || Date.now()).toLocaleDateString("es-AR"))
    );
    button.append(cover);
    button.addEventListener("click", function () { window.openBookCoverPreview(book); });
    return button;
  }
  function preview(book) {
    let modal = document.getElementById("livraCoverModal");
    if (!modal) {
      modal = el("div", "livra-cover-modal");
      modal.id = "livraCoverModal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-label", "Portada del libro");
      const close = el("button", "livra-cover-close", "×");
      close.type = "button";
      const cover = el("div", "livra-cover-preview text-only-book-cover");
      cover.append(el("span", "book-cover-kicker", "LIVRA ORIGINAL"), el("span", "book-cover-ornament", "✦"), el("h2", "livra-cover-preview-title"), el("p", "livra-cover-preview-subtitle"), el("span", "livra-cover-preview-footer", "TU VOZ · TU HISTORIA · TU LIBRO"));
      const read = el("button", "livra-cover-read", "LEER LIBRO");
      read.type = "button";
      modal.append(close, cover, read);
      document.body.append(modal);
      close.addEventListener("click", function () { modal.classList.remove("is-open"); });
      modal.addEventListener("click", function (event) { if (event.target === modal) modal.classList.remove("is-open"); });
      read.addEventListener("click", function () {
        const selected = modal._livraBook;
        modal.classList.remove("is-open");
        if (selected && typeof window.openBook === "function") window.openBook(selected);
      });
    }
    modal._livraBook = book;
    modal.querySelector(".livra-cover-preview-title").textContent = book.title || "Mi historia";
    modal.querySelector(".livra-cover-preview-subtitle").textContent = book.subtitle || "Una historia contada con tu voz";
    modal.classList.add("is-open");
  }
  window.openBookCoverPreview = preview;
  window.renderLibrary = function () {
    const root = document.getElementById("bookGrid");
    const empty = document.getElementById("emptyLibrary");
    if (!root || !empty) return;
    window.getAll("books").then(function (items) {
      const books = (items || []).sort(function (a, b) { return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); });
      window.books = books;
      root.replaceChildren();
      root.classList.remove("hidden");
      root.classList.toggle("is-empty", books.length === 0);
      root.setAttribute("aria-label", "Biblioteca con " + books.length + " libros");
      const subtitle = document.getElementById("librarySubtitle");
      if (subtitle) subtitle.textContent = books.length ? books.length + " libro" + (books.length === 1 ? "" : "s") + " en tu biblioteca" : "Tus historias. Tus libros. Tus próximos comienzos.";
      if (!books.length) {
        root.classList.add("hidden");
        empty.classList.remove("hidden");
        empty.replaceChildren(el("h2", "", "Tu primer libro empieza con tu voz"), el("p", "", "Grabá tu historia y LIVRA la convertirá en un libro con una portada editorial tipográfica."));
        return;
      }
      empty.classList.add("hidden");
      books.forEach(function (book, index) { root.append(card(book, index)); });
      for (let index = books.length; index < 9; index++) {
        const placeholder = el("button", "book-card book-card-placeholder");
        placeholder.type = "button";
        placeholder.setAttribute("aria-label", "Crear tu próximo libro");
        const cover = el("div", "book-cover empty-book-cover text-only-book-cover");
        cover.append(el("span", "book-cover-kicker", "LIVRA ORIGINAL"), el("span", "book-cover-ornament", "✧"), el("strong", "book-cover-title", "TU PRÓXIMO LIBRO"), el("span", "book-cover-meta", "TU VOZ · TU HISTORIA"));
        placeholder.append(cover);
        placeholder.addEventListener("click", function () { if (typeof window.requestMicThenRecord === "function") window.requestMicThenRecord(); });
        root.append(placeholder);
      }
    }).catch(function (error) {
      console.error("LIVRA: no se pudo cargar la biblioteca", error);
      if (typeof window.toast === "function") window.toast("No se pudo cargar la biblioteca. Tus libros siguen guardados.");
    });
  };
  document.addEventListener("DOMContentLoaded", function () {
    const empty = document.getElementById("emptyLibrary");
    if (empty) empty.classList.add("premium-empty-library");
  });
})();
