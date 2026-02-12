/* script.js — robust персонажи + mp4 avatar + fallback image */

const DATA_URL = "data.json";

document.addEventListener("DOMContentLoaded", () => {
  initCharacters().catch((err) => {
    console.error("Init error:", err);
    showFatalError("Could not load characters. Check console for details.");
  });
});

async function initCharacters() {
  const grid = document.getElementById("char-grid");
  if (!grid) {
    // Скрипт не падает, даже если на другой странице нет char-grid
    console.warn("No #char-grid found on this page. Skipping render.");
    return;
  }

  const characters = await loadCharacters(DATA_URL);
  renderCharacterGrid(grid, characters);
}

async function loadCharacters(url) {
  let res;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch (e) {
    throw new Error(`Fetch failed for ${url}: ${e.message}`);
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} while loading ${url}`);
  }

  const data = await res.json();

  // Поддержка формата: либо массив, либо { characters: [...] }
  const characters = Array.isArray(data) ? data : data.characters;
  if (!Array.isArray(characters)) {
    throw new Error("data.json must be an array OR an object with { characters: [] }");
  }

  return characters;
}

function renderCharacterGrid(grid, characters) {
  grid.innerHTML = "";

  if (!characters.length) {
    grid.innerHTML = `<p class="muted">No characters found in data.json</p>`;
    return;
  }

  const frag = document.createDocumentFragment();

  characters.forEach((ch) => {
    const card = createCharacterCard(ch);
    frag.appendChild(card);
  });

  grid.appendChild(frag);
}

function createCharacterCard(ch) {
  const id = safeText(ch.id || "");
  const name = safeText(ch.name || "Unnamed");
  const desc = safeText(ch.description || "");
  const avatar = (ch.avatar || "").trim();

  const card = document.createElement("button");
  card.type = "button";
  card.className = "char-card";
  card.setAttribute("data-id", id);

  const media = document.createElement("div");
  media.className = "char-media";

  // Всегда делаем image fallback
  const fallbackImg = document.createElement("img");
  fallbackImg.className = "char-img";
  fallbackImg.alt = name;
  fallbackImg.loading = "lazy";
  fallbackImg.src = guessFallbackImage(avatar, id);

  // Если avatar mp4/webm — пробуем видео, иначе показываем картинку
  if (isVideo(avatar)) {
    const video = document.createElement("video");
    video.className = "char-video";
    video.src = avatar;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.autoplay = true;
    video.preload = "metadata";

    // если видео не загрузилось — скрываем и оставляем img
    video.addEventListener("error", () => {
      console.warn("Video failed:", avatar);
      video.remove();
      fallbackImg.classList.add("is-visible");
    });

    // если видео загрузилось — показываем видео, img прячем
    video.addEventListener("loadeddata", async () => {
      try {
        // Safari иногда блокирует autoplay — пробуем play()
        await video.play();
      } catch (e) {
        // если autoplay не разрешён — просто оставим видео как постер (первый кадр может не пойти),
        // а картинка всё равно будет видна.
        console.warn("Autoplay blocked:", e.message);
        fallbackImg.classList.add("is-visible");
        return;
      }
      fallbackImg.classList.remove("is-visible");
    });

    media.appendChild(video);
    media.appendChild(fallbackImg);
  } else {
    // не видео — просто картинка (avatar может быть .png/.jpg)
    fallbackImg.src = avatar || fallbackImg.src;
    fallbackImg.classList.add("is-visible");
    media.appendChild(fallbackImg);
  }

  const meta = document.createElement("div");
  meta.className = "char-meta";
  meta.innerHTML = `
    <div class="char-name">${escapeHtml(name)}</div>
    <div class="char-desc">${escapeHtml(desc)}</div>
  `;

  card.appendChild(media);
  card.appendChild(meta);

  card.addEventListener("click", () => {
    // демо: сохраняем выбранного персонажа
    try {
      localStorage.setItem("linguapolis_selected_character", JSON.stringify(ch));
    } catch (e) {
      console.warn("localStorage failed:", e.message);
    }
    console.log("Selected character:", ch);
    // тут дальше можешь делать переход на страницу квестов/кабинета
    // location.href = "dashboard.html";
  });

  return card;
}

function isVideo(path) {
  const p = (path || "").toLowerCase();
  return p.endsWith(".mp4") || p.endsWith(".webm") || p.endsWith(".mov");
}

// Если avatar=.../tech_01.mp4 => .../tech_01.jpg (или .png если так сделаешь)
// Если avatar пустой — пробуем assets/avatars/<id>.jpg
function guessFallbackImage(avatarPath, id) {
  if (avatarPath) {
    return avatarPath.replace(/\.(mp4|webm|mov)$/i, ".jpg");
  }
  return `assets/avatars/${id}.jpg`;
}

// безопасные штуки
function safeText(s) {
  return String(s).trim();
}
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showFatalError(msg) {
  const grid = document.getElementById("char-grid");
  if (!grid) return;
  grid.innerHTML = `<p class="error">${escapeHtml(msg)}</p>`;
}

