/* script.js — Linguapolis Sim
   Robust character grid + MP4 avatar + PNG fallback + safe clicks
*/

const DATA_URL = "data.json";

document.addEventListener("DOMContentLoaded", () => {
  initCharacters().catch((err) => {
    console.error("Init error:", err);
    showFatalError("Could not load characters. Open DevTools → Console for details.");
  });
});

async function initCharacters() {
  const grid = document.getElementById("char-grid");
  if (!grid) {
    // На других страницах (например videos.html) может не быть грида — не падаем
    console.warn("No #char-grid on this page. Skipping character render.");
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

  if (!res.ok) throw new Error(`HTTP ${res.status} while loading ${url}`);

  const data = await res.json();

  // Поддержка двух форматов:
  // 1) [ ...characters ]
  // 2) { "characters": [ ... ] }
  const characters = Array.isArray(data) ? data : data.characters;

  if (!Array.isArray(characters)) {
    throw new Error("data.json must be an array OR an object with { characters: [] }");
  }

  // Нормализуем поля, чтобы не было undefined
  return characters.map((c) => ({
    id: String(c.id ?? "").trim(),
    name: String(c.name ?? "Unnamed").trim(),
    description: String(c.description ?? "").trim(),
    startingStats: c.startingStats ?? {},
    preferredChunks: c.preferredChunks ?? [],
    avatar: String(c.avatar ?? "").trim(),
  }));
}

function renderCharacterGrid(grid, characters) {
  grid.innerHTML = "";

  if (!characters.length) {
    grid.innerHTML = `<p class="muted">No characters found in data.json</p>`;
    return;
  }

  const frag = document.createDocumentFragment();
  for (const ch of characters) frag.appendChild(createCharacterCard(ch));
  grid.appendChild(frag);

  // маленький дебаг, чтобы видеть, что всё загрузилось
  console.log(`Rendered characters: ${characters.length}`);
}

function createCharacterCard(ch) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "char-card";
  card.setAttribute("data-id", ch.id);

  // MEDIA
  const media = document.createElement("div");
  media.className = "char-media";

  // fallback IMG (PNG)
  const img = document.createElement("img");
  img.className = "char-img is-visible"; // по умолчанию видимая
  img.alt = ch.name;
  img.loading = "lazy";
  img.src = guessFallbackPng(ch.avatar, ch.id);

  // если PNG вдруг не найден — попробуем JPG
  img.onerror = () => {
    const src = (img.src || "").toLowerCase();
    if (src.endsWith(".png")) {
      img.src = img.src.replace(/\.png$/i, ".jpg");
    }
  };

  // VIDEO (если mp4/webm/mov)
  if (isVideo(ch.avatar)) {
    const video = document.createElement("video");
    video.className = "char-video";
    video.src = ch.avatar;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.autoplay = true;
    video.preload = "metadata";

    // если видео упало — просто оставим PNG
    video.addEventListener("error", () => {
      console.warn("Video failed to load:", ch.avatar);
      video.remove();
      img.classList.add("is-visible");
    });

    // если видео загрузилось — пытаемся включить и скрываем картинку
    video.addEventListener("loadeddata", async () => {
      try {
        await video.play();
        img.classList.remove("is-visible");
      } catch (e) {
        // autoplay может быть заблокирован — тогда оставим PNG
        console.warn("Autoplay blocked:", e.message);
        img.classList.add("is-visible");
      }
    });

    media.appendChild(video);
    media.appendChild(img);
  } else {
    // если avatar не видео, а вдруг картинка — используем её
    if (ch.avatar) img.src = ch.avatar;
    media.appendChild(img);
  }

  // META
  const meta = document.createElement("div");
  meta.className = "char-meta";
  meta.innerHTML = `
    <div class="char-name">${escapeHtml(ch.name)}</div>
    <div class="char-desc">${escapeHtml(ch.description)}</div>
  `;

  card.appendChild(media);
  card.appendChild(meta);

  // CLICK
  card.addEventListener("click", () => {
    // сохраняем выбранного персонажа
    try {
      localStorage.setItem("linguapolis_selected_character", JSON.stringify(ch));
    } catch (e) {
      console.warn("localStorage failed:", e.message);
    }

    // быстрый визуальный фидбек (можешь убрать)
    card.classList.add("is-selected");
    setTimeout(() => card.classList.remove("is-selected"), 250);

    console.log("Selected character:", ch);

    // Дальше можно делать переход:
    // location.href = "dashboard.html";
  });

  return card;
}

function isVideo(path) {
  const p = (path || "").toLowerCase();
  return p.endsWith(".mp4") || p.endsWith(".webm") || p.endsWith(".mov");
}

function guessFallbackPng(avatarPath, id) {
  // assets/avatars/tech_01.mp4 -> assets/avatars/tech_01.png
  if (avatarPath) return avatarPath.replace(/\.(mp4|webm|mov)$/i, ".png");
  return `assets/avatars/${id}.png`;
}

function showFatalError(msg) {
  const grid = document.getElementById("char-grid");
  if (!grid) return;
  grid.innerHTML = `<p class="error">${escapeHtml(msg)}</p>`;
}

/* HTML escaping */
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

