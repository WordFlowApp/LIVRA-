/* LIVRA Premium Book Visuals — photographic-first library */
(function () {
  "use strict";
  const pending = new Set();
  const failedPhotoUrls = new Set();
  const creditByUrl = Object.create(null);
  const PHOTO_CACHE = "livra-photographic-covers-v1";
  const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
  const LIVRA_EDITOR_API = "https://livra-transcription.talitaescuela.workers.dev";
  const COVER_VERSION = 46;
  const usedPhotoUrls = new Set();
  const GENERIC_TERMS = new Set(["mi historia", "mi libro", "historia personal", "sin título", "untitled"]);

  function cleanText(value) {
    return String(value || "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
  }
  function normalize(value) {
    return cleanText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }
  function categoryFor(book) {
    const text = normalize([book.title, book.subtitle, book.summary, book.transcript].join(" "));
    const rules = [
      ["Naturaleza", /\b(naturaleza|naturaleza|bosque|arbol|rio|montana|mar|animal|campo|ecologia|clima|planeta|jardin)\b/],
      ["Negocios y liderazgo", /\b(negocio|empresa|emprend|marketing|ventas|liderazgo|dinero|finanzas|trabajo|startup|marca|economia)\b/],
      ["Psicología", /\b(psicologia|mente|emocion|conducta|ansiedad|relacion|pareja|familia|cerebro|habito|trauma|bienestar emocional)\b/],
      ["Viajes y aventuras", /\b(viaje|viajar|aventura|destino|pais|ciudad|ruta|turismo|explorar|mochil|expedicion)\b/],
      ["Desarrollo personal", /\b(desarrollo personal|motivacion|superacion|crecimiento|autoestima|proposito|disciplina|exito|inspiracion|habitos|mindset)\b/],
      ["Cocina y gastronomía", /\b(cocina|receta|chef|gastronomia|comida|alimento|panaderia|restaurant)\b/],
      ["Arte y creatividad", /\b(arte|musica|pintura|creatividad|diseno|fotografia|escritura|literatura|poesia)\b/],
      ["Salud y bienestar", /\b(salud|bienestar|fitness|ejercicio|nutricion|meditacion|yoga|cuerpo)\b/]
    ];
    for (const [label, pattern] of rules) if (pattern.test(text)) return label;
    return "Historias personales";
  }
  function photoQuery(book) {
    const text = normalize([book.title, book.subtitle, book.summary, book.transcript].join(" "));
    const rules = [
      [/\b(naturaleza|bosque|arbol|rio|montana|mar|animal|campo|ecologia|clima|planeta|jardin)\b/, "forest mountain landscape nature wildlife photography"],
      [/\b(negocio|empresa|emprend|marketing|ventas|liderazgo|dinero|finanzas|trabajo|startup|marca|economia)\b/, "entrepreneur business professional office people photography"],
      [/\b(psicologia|mente|emocion|conducta|ansiedad|relacion|pareja|familia|cerebro|habito|trauma)\b/, "human portrait thoughtful person psychology documentary photography"],
      [/\b(viaje|viajar|aventura|destino|pais|ciudad|ruta|turismo|explorar|mochil|expedicion)\b/, "travel destination scenic landscape documentary photography"],
      [/\b(desarrollo personal|motivacion|superacion|crecimiento|autoestima|proposito|disciplina|exito|inspiracion|habitos|mindset)\b/, "inspiring person sunrise mountain journey photography"],
      [/\b(cocina|receta|chef|gastronomia|comida|alimento|panaderia|restaurant)\b/, "professional food culinary kitchen photography"],
      [/\b(arte|musica|pintura|creatividad|diseno|fotografia|escritura|literatura|poesia)\b/, "artist creative studio art photography"],
      [/\b(salud|bienestar|fitness|ejercicio|nutricion|meditacion|yoga|cuerpo)\b/, "wellness healthy lifestyle fitness photography"]
    ];
    for (const [pattern, query] of rules) if (pattern.test(text)) return query;
    return "authentic human life story portrait documentary photography";
  }
  async function exactGoogleBook(title) {
    if (!title || GENERIC_TERMS.has(normalize(title))) return null;
    try {
      const url = "https://www.googleapis.com/books/v1/volumes?q=" +
        encodeURIComponent('intitle:"' + title + '"') + "&maxResults=8&printType=books";
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) return null;
      const data = await response.json();
      const match = (data.items || []).find(item =>
        normalize(item.volumeInfo && item.volumeInfo.title) === normalize(title) &&
        item.volumeInfo && item.volumeInfo.imageLinks);
      if (!match) return null;
      const image = match.volumeInfo.imageLinks.extraLarge || match.volumeInfo.imageLinks.large ||
        match.volumeInfo.imageLinks.medium || match.volumeInfo.imageLinks.thumbnail;
      if (!image) return null;
      const secure = image.replace(/^http:/, "https:");
      if (failedPhotoUrls.has(secure)) return null;
      return {
        url: secure,
        attribution: "Portada editorial · Google Books",
        sourceUrl: match.volumeInfo.infoLink || "https://books.google.com/",
        license: "Portada bibliográfica; derechos de sus respectivos titulares"
      };
    } catch (_) { return null; }
  }
  async function exactOpenLibraryBook(title) {
    if (!title || GENERIC_TERMS.has(normalize(title))) return null;
    try {
      const url = "https://openlibrary.org/search.json?title=" + encodeURIComponent(title) +
        "&limit=8&fields=title,cover_i,key";
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) return null;
      const data = await response.json();
      const match = (data.docs || []).find(item =>
        normalize(item.title) === normalize(title) && item.cover_i);
      if (!match) return null;
      const coverUrl = "https://covers.openlibrary.org/b/id/" + match.cover_i + "-L.jpg";
      if (failedPhotoUrls.has(coverUrl)) return null;
      return {
        url: coverUrl,
        attribution: "Portada editorial · Open Library",
        sourceUrl: "https://openlibrary.org" + (match.key || ""),
        license: "Portada bibliográfica; derechos de sus respectivos titulares"
      };
    } catch (_) { return null; }
  }
  function bookContent(book) {
    const pages = Array.isArray(book.pages) ? book.pages : [];
    const chapters = pages.filter(page => page && (page.section === "chapter" || page.body))
      .slice(0, 10).map(page => [page.heading, page.body].filter(Boolean).join("\n")).join("\n\n");
    return [book.subtitle, book.summary, book.prologue, chapters, book.transcript]
      .filter(Boolean).join("\n\n").slice(0, 9000);
  }
  function coverArtDirection(book, source) {
    return [
      "BOOK TITLE: " + cleanText(book.title),
      "ACTUAL BOOK CONTENT: " + String(source || "").replace(/\\s+/g, " ").slice(0, 900),
      "Create a unique premium full-color photorealistic editorial BOOK COVER IMAGE based on the actual content above.",
      "VERTICAL PORTRAIT 2:3, full-bleed edge-to-edge photographic artwork, cinematic natural light, rich colors, professional publishing quality, visual depth.",
      "Show a distinctive central scene that reflects this exact book's subject, setting and emotional tone. The artwork must be the dominant visual element.",
      "No geometric rectangles, abstract gradients, book mockups, bookshelves, logos, watermarks, text, lettering, typography, icons or graphic placeholders. Leave calm negative space near the lower third for the app to overlay the title."
    ].join("\\n\\n");
  }
  async function aiGeneratedCover(book, source) {
    const response = await fetch(LIVRA_EDITOR_API + "/cover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: cleanText(book.title || "Mi historia"),
        text: coverArtDirection(book, source),
        aspectRatio: "2:3",
        style: "photorealistic full-color premium editorial book cover",
        livraVersion: "4.6"
      })
    });
    if (!response.ok) {
      let detail = "";
      try { const data = await response.json(); detail = data.error || ""; } catch (_) {}
      throw new Error(detail || "El servicio de portadas respondió " + response.status);
    }
    const blob = await response.blob();
    if (!blob.size || !/^image\//i.test(blob.type || "") || blob.size < 1024) {
      throw new Error("El servicio no devolvió una imagen de portada válida.");
    }
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return {
      url: dataUrl,
      attribution: "Portada original generada por LIVRA",
      sourceUrl: "",
      license: "Imagen creada para este libro"
    };
  }
  async function commonsPhoto(query, title) {
    const titlePhrase = cleanText(title || "");
    const searches = [
      [titlePhrase, query].filter(Boolean).join(" "),
      [query, titlePhrase].filter(Boolean).join(" "),
      query,
      "book reading lifestyle photography"
    ];
    for (const phrase of searches) {
      try {
        const params = new URLSearchParams({
          action: "query", format: "json", origin: "*", generator: "search",
          gsrsearch: "filetype:bitmap " + phrase, gsrnamespace: "6", gsrlimit: "18",
          prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: "1200"
        });
        const response = await fetch(COMMONS_API + "?" + params.toString(), {
          headers: { Accept: "application/json" }
        });
        if (!response.ok) continue;
        const data = await response.json();
        const pages = Object.values((data.query && data.query.pages) || {});
        const candidates = pages.map(page => {
          const info = page.imageinfo && page.imageinfo[0];
          if (!info || !info.thumburl || failedPhotoUrls.has(info.thumburl) || usedPhotoUrls.has(info.thumburl) || !/^image\/(jpeg|png|webp)$/i.test(info.mime || "")) return null;
          const width = Number(info.width || 0), height = Number(info.height || 0);
          const ratio = height ? width / height : 0;
          const fileName = normalize(page.title);
          if (width < 650 || height < 700 || ratio < 0.48 || ratio > 1.65) return null;
          if (/\b(logo|icon|diagram|chart|map|flag|coat of arms|drawing|illustration|screenshot)\b/.test(fileName)) return null;
          const meta = info.extmetadata || {};
          return {
            url: info.thumburl,
            attribution: cleanText(meta.Artist && meta.Artist.value) || "Fotógrafo/a · Wikimedia Commons",
            sourceUrl: info.descriptionurl || "https://commons.wikimedia.org/",
            license: cleanText(meta.LicenseShortName && meta.LicenseShortName.value) || "Licencia indicada en Wikimedia Commons",
            score: Math.min(width * height, 18000000) + (ratio >= 0.58 && ratio <= 1.05 ? 250000 : 0) +
              (/\b(photo|photograph|photography|photographie|fotografia)\b/.test(fileName) ? 500000 : 0)
          };
        }).filter(Boolean).sort((a, b) => b.score - a.score);
        if (candidates.length) {
          usedPhotoUrls.add(candidates[0].url);
          return candidates[0];
        }
      } catch (_) { /* try the next search phrase */ }
    }
    return null;
  }
  async function photographicCover(title, source, fullBook) {
    const book = fullBook || { title: title, summary: source };
    const hasPublishedEdition = Boolean(book.isbn || book.googleBooksId || book.openLibraryKey || book.publishedEditionId || book.sourceType === "published");
    if (hasPublishedEdition) {
      const editorial = await exactGoogleBook(title) || await exactOpenLibraryBook(title);
      if (editorial) return editorial;
    }
    try {
      return await aiGeneratedCover(book, source);
    } catch (error) {
      console.warn("LIVRA: la portada IA no respondió; se buscará una fotografía editorial.", error);
    }
    const photo = await commonsPhoto(photoQuery(book), title);
    if (photo) return photo;
    throw new Error("No encontramos una imagen adecuada para esta historia. El libro permanece guardado.");
  }
  window.__livraCoverCredits = creditByUrl;
  window.generateAICover = async function (title, source) {
    const result = await photographicCover(title, source, { title: title, summary: source });
    creditByUrl[result.url] = result;
    return result.url;
  };

  function makeElement(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function makeCoverCard(book) {
    const shell = makeElement("div", "book-card-shell");
    const button = makeElement("button", "book-card");
    button.type = "button";
    button.setAttribute("aria-label", "Abrir libro " + (book.title || "Mi historia"));
    const cover = makeElement("div", "book-cover");
    const image = document.createElement("img");
    image.className = "book-cover-photo";
    image.src = book.coverImage;
    image.alt = "Fotografía de portada: " + (book.title || "Mi historia");
    image.loading = "lazy";
    image.decoding = "async";
    image.fetchPriority = "low";
    image.addEventListener("error", function () {
      failedPhotoUrls.add(book.coverImage);
      book.coverImage = null;
      book.coverVersion = 0;
      book.coverAttribution = null;
      book.coverSourceUrl = null;
      book.coverLicense = null;
      shell.remove();
      window.putItem("books", book).then(function () { ensureCover(book); }).catch(function () {});
    }, { once: true });
    const shade = makeElement("div", "book-cover-shade");
    const title = makeElement("strong", "book-cover-title", book.title || "Mi historia");
    const meta = makeElement("span", "book-cover-meta", "LIVRA ORIGINAL · " +
      (typeof window.dateText === "function" ? window.dateText(book.createdAt) :
        new Date(book.createdAt || Date.now()).toLocaleDateString("es-AR")));
    cover.append(image, shade, title, meta);
    button.append(cover);
    button.addEventListener("click", function () { window.openBookCoverPreview(book); });
    shell.append(button);
    if (book.coverAttribution && book.coverSourceUrl) {
      const credit = document.createElement("a");
      credit.className = "book-credit";
      credit.href = book.coverSourceUrl;
      credit.target = "_blank";
      credit.rel = "noopener noreferrer";
      credit.textContent = book.coverAttribution + (book.coverLicense ? " · " + book.coverLicense : "");
      credit.title = "Ver fuente y licencia de la fotografía";
      shell.append(credit);
    }
    return shell;
  }
  async function ensureCover(book) {
    if (pending.has(book.id)) return;
    pending.add(book.id);
    try {
      const result = await photographicCover(book.title, bookContent(book), book);
      const url = result.url;
      creditByUrl[url] = result;
      book.coverImage = url;
      book.coverVersion = COVER_VERSION;
      const credit = creditByUrl[url];
      if (credit) {
        book.coverAttribution = credit.attribution;
        book.coverSourceUrl = credit.sourceUrl || "";
        book.coverLicense = credit.license;
      }
      await window.putItem("books", book);
      window.renderLibrary();
    } catch (error) {
      console.warn("LIVRA cover:", error);
    } finally {
      pending.delete(book.id);
    }
  }
  async function emptyLibraryPhoto() {
    const host = document.getElementById("emptyLibrary");
    if (!host || host.dataset.photoLoaded) return;
    host.dataset.photoLoaded = "1";
    const photo = await commonsPhoto("open book reading desk warm natural light photography");
    if (!photo) return;
    const image = makeElement("img", "empty-library-photo");
    image.src = photo.url;
    image.alt = "Fotografía editorial de un libro abierto sobre una mesa";
    image.loading = "lazy";
    image.decoding = "async";
    const credit = document.createElement("a");
    credit.className = "empty-library-credit";
    credit.href = photo.sourceUrl;
    credit.target = "_blank";
    credit.rel = "noopener noreferrer";
    credit.textContent = photo.attribution + " · " + photo.license;
    host.prepend(image);
    host.append(credit);
  }
  window.openBookCoverPreview = function (book) {
    let modal = document.getElementById("livraCoverModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "livraCoverModal";
      modal.className = "livra-cover-modal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-label", "Vista ampliada de la portada");
      modal.innerHTML = '<button type="button" class="livra-cover-close" aria-label="Cerrar portada">×</button><div class="livra-cover-preview"><img class="livra-cover-preview-image" alt=""><div class="livra-cover-preview-caption"><h2></h2><p>LIVRA ORIGINAL</p></div></div><button type="button" class="livra-cover-read">LEER LIBRO</button>';
      document.body.append(modal);
      modal.querySelector(".livra-cover-close").addEventListener("click", function () { modal.classList.remove("is-open"); });
      modal.addEventListener("click", function (event) { if (event.target === modal) modal.classList.remove("is-open"); });
      modal.querySelector(".livra-cover-read").addEventListener("click", function () {
        const selected = modal._livraBook;
        modal.classList.remove("is-open");
        if (selected && typeof window.openBook === "function") window.openBook(selected);
      });
    }
    modal._livraBook = book;
    const image = modal.querySelector(".livra-cover-preview-image");
    image.src = book.coverImage || "";
    image.alt = "Portada completa de " + (book.title || "Mi historia");
    modal.querySelector(".livra-cover-preview-caption h2").textContent = book.title || "Mi historia";
    modal.classList.add("is-open");
  };
  window.renderLibrary = function () {
    window.getAll("books").then(function (items) {
      window.books = items.sort(function (a, b) {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
      const root = document.getElementById("bookGrid");
      const empty = document.getElementById("emptyLibrary");
      if (!root || !empty) return;
      root.replaceChildren();
      const needsCover = [];
      const seenCoverImages = new Set();
      const usable = [];
      window.books.forEach(function (book) {
        const validRemoteImage = /^https:\/\//i.test(book.coverImage || "");
        const validGeneratedImage = /^data:image\/(png|jpeg|webp);base64,/i.test(book.coverImage || "");
        const supportedImage = validRemoteImage || validGeneratedImage;
        const duplicateCover = supportedImage && seenCoverImages.has(book.coverImage);
        if (supportedImage && !duplicateCover) seenCoverImages.add(book.coverImage);
        if (book.coverVersion !== COVER_VERSION || (book.coverImage && !supportedImage) || duplicateCover) {
          book.coverImage = null;
          book.coverAttribution = null;
          book.coverSourceUrl = null;
          book.coverLicense = null;
          book.coverVersion = 0;
          window.putItem("books", book).catch(function () {});
        }
        if (!book.coverImage) needsCover.push(book);
        else usable.push(book);
      });
      document.getElementById("librarySubtitle").textContent = window.books.length
        ? window.books.length + " libro" + (window.books.length === 1 ? "" : "s") + " en tu biblioteca"
        : "Tus historias. Tus libros. Tus próximos comienzos.";
      if (!window.books.length) {
        root.classList.add("hidden");
        empty.classList.remove("hidden");
        empty.replaceChildren(
          makeElement("h2", "", "Tu próxima historia merece una tapa extraordinaria"),
          makeElement("p", "", "Grabá tu voz y LIVRA preparará una portada fotográfica a partir del tema de tu libro.")
        );
        emptyLibraryPhoto();
        return;
      }
      empty.classList.add("hidden");
      root.classList.remove("hidden");
      if (!usable.length) {
        const status = makeElement("div", "cover-preparing");
        status.append(makeElement("span", "cover-preparing-pulse"), makeElement("strong", "", "Preparando las portadas fotográficas"));
        status.append(makeElement("p", "", "Estamos buscando imágenes editoriales reales para tus libros."));
        root.append(status);
      } else {
        const groups = new Map();
        usable.forEach(function (book) {
          const category = categoryFor(book);
          if (!groups.has(category)) groups.set(category, []);
          groups.get(category).push(book);
        });
        groups.forEach(function (groupBooks, category) {
          const section = makeElement("section", "book-collection");
          const heading = makeElement("div", "book-collection-heading");
          const title = makeElement("h2", "", category);
          const count = makeElement("span", "book-collection-count", String(groupBooks.length).padStart(2, "0") + " LIBRO" + (groupBooks.length === 1 ? "" : "S"));
          heading.append(title, count);
          const rail = makeElement("div", "book-shelf-grid");
          groupBooks.forEach(function (book) { rail.append(makeCoverCard(book)); });
          section.append(heading, rail);
          root.append(section);
        });
      }
      needsCover.forEach(ensureCover);
    }).catch(function () {
      if (typeof window.toast === "function") window.toast("No se pudo abrir la biblioteca.");
    });
  };
  document.addEventListener("DOMContentLoaded", function () {
    const empty = document.getElementById("emptyLibrary");
    if (empty) empty.classList.add("premium-empty-library");
  });
})();