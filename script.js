// script.js — robust for GitHub Pages (MP4 avatar + PNG fallback)

const DATA_URL = "data.json";

document.addEventListener("DOMContentLoaded", () => {
  boot().catch((e) => {
    console.error(e);
    showError(`#char-grid`, "Could not load characters. Open Console.");
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

  // optional: quests (у тебя есть)
  const quests = data.quests || {};
  console.log("quests keys:", Object.keys(quests));

  renderCharacters(grid, characters);

  // если у тебя есть overlay выбора персонажа — убедимся, что он не блокирует клики случайно
  // (НЕ скрываем насильно, просто лог)
  const overlay = document.getElementById("char-selection-overlay");
  if (overlay) console.log("Overlay present:", getComputedStyle(overlay).display);
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

  // Fallback PNG рядом с mp4: assets/avatars/tech_01.mp4 -> assets/avatars/tech_01.png
  const img = document.createElement("img");
  img.className = "char-img is-visible";
  img.alt = ch.name;
  img.loading = "lazy";
  img.src = fallbackPngFromAvatar(ch.avatar, ch.id);

  // Если png вдруг не найден — попробуем jpg (на всякий)
  img.onerror = () => {
    const s = (img.src || "").toLowerCase();
    if (s.endsWith(".png")) img.src = img.src.replace(/\.png$/i, ".jpg");
  };

  if (isVideo(ch.avatar)) {
    const v = document.createElement("video");
    v.className = "char-video";
    v.src = ch.avatar;
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.autoplay = true;
    v.preload = "metadata";

    v.addEventListener("error", () => {
      console.warn("Video failed:", ch.avatar);
      v.remove();
      img.classList.add("is-visible");
    });

    v.addEventListener("loadeddata", async () => {
      try {
        await v.play();
        img.classList.remove("is-visible");
      } catch (e) {
        // autoplay может быть заблокирован — оставляем картинку
        console.warn("Autoplay blocked:", e.message);
        img.classList.add("is-visible");
      }
    });

    media.appendChild(v);
    media.appendChild(img);
  } else {
    // если avatar вдруг картинка — используем её
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
    // сохраняем выбор
    localStorage.setItem("linguapolis_selected_character", JSON.stringify(ch));
    console.log("Selected:", ch.id);

    // если у тебя есть overlay выбора — можно скрыть после выбора
    const overlay = document.getElementById("char-selection-overlay");
    if (overlay) overlay.classList.add("hidden");
  });

  return btn;
}

function isVideo(p) {
  p = (p || "").toLowerCase();
  return p.endsWith(".mp4") || p.endsWith(".webm") || p.endsWith(".mov");
}

function fallbackPngFromAvatar(avatarPath, id) {
  if (avatarPath) return avatarPath.replace(/\.(mp4|webm|mov)$/i, ".png");
  return `assets/avatars/${id}.png`;
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

