// script.js — robust for GitHub Pages (MP4 avatar + PNG fallback)
// Supports both paths: assets/avatars/file.mp4 and assets/file.mp4

const DATA_URL = "data.json";

document.addEventListener("DOMContentLoaded", () => {
  boot().catch((e) => {
    console.error(e);
    showError("#char-grid", "Could not load characters. Open Console.");
  });
});

async function boot() {
  const grid = document.getElementById("char-grid");
  if (!grid) {
    console.warn("No #char-grid on this page. Skipping.");
    return;
  }

  const data = await loadJson(DATA_URL);
  const characters = Array.isArray(data) ? data : data.characters;

  if (!Array.isArray(characters)) {
    throw new Error("data.json must contain { characters: [...] } (or be an array)");
  }

  renderCharacters(grid, characters);
}

async function loadJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${url}: HTTP ${res.status}`);
  return await res.json();
}

function renderCharacters(grid, characters) {
  grid.innerHTML = "";
  const frag = document.createDocumentFragment();

  for (const raw of characters) {
    const ch = normalizeChar(raw);
    frag.appendChild(makeCharCard(ch));
  }

  grid.appendChild(frag);
  console.log("Rendered:", characters.length);
}

function normalizeChar(c) {
  return {
    id: String(c.id ?? "").trim(),
    name: String(c.name ?? "Unnamed").trim(),
    description: String(c.description ?? "").trim(),
    avatar: String(c.avatar ?? "").trim(),
    startingStats: c.startingStats ?? {},
    preferredChunks: Array.isArray(c.preferredChunks) ? c.preferredChunks : [],
  };
}

function makeCharCard(ch) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "char-card";
  btn.dataset.id = ch.id;

  const media = document.createElement("div");
  media.className = "char-media";

  const img = document.createElement("img");
  img.className = "char-img is-visible";
  img.alt = ch.name;
  img.loading = "lazy";

  // Ставим сначала путь из JSON; если он не сработает — fallback на assets/<file>.png
  img.src = fallbackPngFromAvatar(ch.avatar, ch.id);

  img.onerror = () => {
    const current = img.getAttribute("src") || "";

    // 1) если был путь assets/avatars/*.png -> пробуем assets/*.png
    if (/assets\/avatars\/.*\.png$/i.test(current)) {
      img.src = current.replace("assets/avatars/", "assets/");
      return;
    }

    // 2) если .png не найден — пробуем .jpg
    if (/\.png$/i.test(current)) {
      img.src = current.replace(/\.png$/i, ".jpg");
      return;
    }

    // 3) если assets/avatars/*.jpg -> пробуем assets/*.jpg
    if (/assets\/avatars\/.*\.jpg$/i.test(current)) {
      img.src = current.replace("assets/avatars/", "assets/");
      return;
    }

    // 4) красивый встроенный placeholder вместо "битой картинки"
    img.src =
      "data:image/svg+xml;utf8," +
      encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#eef2ff"/>
              <stop offset="1" stop-color="#ecfeff"/>
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" rx="48" fill="url(#g)"/>
          <circle cx="400" cy="300" r="120" fill="rgba(15,23,42,0.10)"/>
          <rect x="220" y="450" width="360" height="190" rx="90" fill="rgba(15,23,42,0.10)"/>
          <text x="400" y="730" text-anchor="middle" fill="rgba(15,23,42,0.45)" font-size="30" font-family="Arial">
            avatar missing
          </text>
        </svg>
      `);
    img.classList.add("is-visible");
  };

  if (isVideo(ch.avatar)) {
    const v = document.createElement("video");
    v.className = "char-video";
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.autoplay = true;
    v.preload = "metadata";

    // Сначала пробуем путь из JSON
    v.src = ch.avatar;

    let triedRootAssets = false;

    v.addEventListener("error", () => {
      const current = v.getAttribute("src") || "";
      console.warn("Video failed:", current);

      // Если JSON указывает на assets/avatars/, а реально файлы лежат в assets/
      if (!triedRootAssets && /assets\/avatars\//i.test(current)) {
        triedRootAssets = true;
        v.src = current.replace("assets/avatars/", "assets/");
        v.load();
        return;
      }

      // Видео не загрузилось — остаёмся на картинке
      v.remove();
      img.classList.add("is-visible");
    });

    v.addEventListener("loadeddata", async () => {
      try {
        await v.play();
        img.classList.remove("is-visible");
      } catch (e) {
        console.warn("Autoplay blocked:", e.message);
        img.classList.add("is-visible");
      }
    });

    media.appendChild(v);
    media.appendChild(img);
  } else {
    // Если avatar — картинка
    if (ch.avatar) img.src = ch.avatar;
    media.appendChild(img);
  }

  const meta = document.createElement("div");
  meta.className = "char-meta";
  meta.innerHTML = `
    <div class="char-name">${esc(ch.name)}</div>
    <div class="char-desc">${esc(ch.description)}</div>
  `;

  btn.appendChild(media);
  btn.appendChild(meta);

  btn.addEventListener("click", () => {
    localStorage.setItem("linguapolis_selected_character", JSON.stringify(ch));
    console.log("Selected:", ch.id);

    const overlay = document.getElementById("char-selection-overlay");
    const mainUI = document.getElementById("main-ui");

    if (overlay) overlay.classList.add("hidden");
    if (mainUI) mainUI.style.display = "grid";
  });

  return btn;
}

function isVideo(p) {
  p = (p || "").toLowerCase();
  return p.endsWith(".mp4") || p.endsWith(".webm") || p.endsWith(".mov");
}

function fallbackPngFromAvatar(avatarPath, id) {
  // assets/avatars/tech_01.mp4 -> assets/avatars/tech_01.png
  // дальше onerror сам попробует assets/tech_01.png
  if (avatarPath) return avatarPath.replace(/\.(mp4|webm|mov)$/i, ".png");
  return `assets/${id}.png`;
}

function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showError(selector, msg) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.innerHTML = `<p class="error">${esc(msg)}</p>`;
}
