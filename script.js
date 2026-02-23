// Linguapolis Sim demo script
// Robust character rendering + MP4 avatar + PNG fallback
// Supports both paths: assets/avatars/file.mp4 and assets/file.mp4

const DATA_URL = "data.json";
const STORAGE_KEYS = {
  selectedCharacter: "linguapolis_selected_character",
  playerState: "linguapolis_player_state"
};

let APP_DATA = null;

document.addEventListener("DOMContentLoaded", () => {
  boot().catch((e) => {
    console.error("Boot error:", e);
    showError("#char-grid", "Could not load characters. Open Console.");
  });
});

async function boot() {
  APP_DATA = await loadJson(DATA_URL);

  const characters = Array.isArray(APP_DATA) ? APP_DATA : APP_DATA.characters;
  if (!Array.isArray(characters)) {
    throw new Error("data.json must contain { characters: [...] } or be an array");
  }

  const grid = document.getElementById("char-grid");
  if (grid) renderCharacters(grid, characters);

  setupMainUIButtons();
  restoreIfCharacterAlreadySelected(characters);
}

async function loadJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${url}: HTTP ${res.status}`);
  return res.json();
}

function renderCharacters(grid, characters) {
  grid.innerHTML = "";
  const frag = document.createDocumentFragment();

  for (const raw of characters) {
    const ch = normalizeChar(raw);
    frag.appendChild(createCharacterCard(ch));
  }

  grid.appendChild(frag);
  console.log("Rendered characters:", characters.length);
}

function normalizeChar(c) {
  return {
    id: String(c.id ?? "").trim(),
    name: String(c.name ?? "Unnamed").trim(),
    description: String(c.description ?? "").trim(),
    avatar: String(c.avatar ?? "").trim(),
    startingStats: c.startingStats ?? {},
    preferredChunks: Array.isArray(c.preferredChunks) ? c.preferredChunks : []
  };
}

function createCharacterCard(ch) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "char-card";
  btn.dataset.id = ch.id;

  // media
  const media = document.createElement("div");
  media.className = "char-media";

  const img = document.createElement("img");
  img.className = "char-img is-visible";
  img.alt = ch.name;
  img.loading = "lazy";
  img.src = fallbackPngFromAvatar(ch.avatar, ch.id);

  img.onerror = () => {
    const current = img.getAttribute("src") || "";

    // Try root assets path if json says assets/avatars/
    if (/assets\/avatars\/.*\.png$/i.test(current)) {
      img.src = current.replace("assets/avatars/", "assets/");
      return;
    }

    // Try jpg
    if (/\.png$/i.test(current)) {
      img.src = current.replace(/\.png$/i, ".jpg");
      return;
    }

    // Try root assets path for jpg
    if (/assets\/avatars\/.*\.jpg$/i.test(current)) {
      img.src = current.replace("assets/avatars/", "assets/");
      return;
    }

    // Embedded placeholder (avoids broken image icon)
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

    v.src = ch.avatar;
    let retriedRootPath = false;

    v.addEventListener("error", () => {
      const current = v.getAttribute("src") || "";
      console.warn("Video failed:", current);

      // If JSON path is assets/avatars/, retry assets/
      if (!retriedRootPath && /assets\/avatars\//i.test(current)) {
        retriedRootPath = true;
        v.src = current.replace("assets/avatars/", "assets/");
        v.load();
        return;
      }

      // Keep fallback image visible
      v.remove();
      img.classList.add("is-visible");
    });

    v.addEventListener("loadeddata", async () => {
      try {
        await v.play();
        img.classList.remove("is-visible");
      } catch (e) {
        // Autoplay can be blocked; keep image
        console.warn("Autoplay blocked:", e.message);
        img.classList.add("is-visible");
      }
    });

    media.appendChild(v);
    media.appendChild(img);
  } else {
    if (ch.avatar) img.src = ch.avatar;
    media.appendChild(img);
  }

  // meta
  const meta = document.createElement("div");
  meta.className = "char-meta";
  meta.innerHTML = `
    <div class="char-name">${esc(ch.name)}</div>
    <div class="char-desc">${esc(ch.description)}</div>
  `;

  btn.appendChild(media);
  btn.appendChild(meta);

  // click
  btn.addEventListener("click", () => selectCharacter(ch));

  return btn;
}

function selectCharacter(ch) {
  try {
    localStorage.setItem(STORAGE_KEYS.selectedCharacter, JSON.stringify(ch));

    const state = {
      level: 1,
      xp: 0,
      xpNext: 100,
      coins: 0,
      confidence: clamp01to100(ch.startingStats?.confidence ?? 20),
      vocabulary: clamp01to100(ch.startingStats?.vocabulary ?? 20),
      fluency: clamp01to100(ch.startingStats?.fluency ?? 20)
    };
    localStorage.setItem(STORAGE_KEYS.playerState, JSON.stringify(state));
  } catch (e) {
    console.warn("localStorage error:", e.message);
  }

  showMainUI();
  hydrateMainUI(ch);
  renderQuest();
  seedChat(ch);
}

function restoreIfCharacterAlreadySelected(characters) {
  let savedChar = null;
  let savedState = null;

  try {
    savedChar = JSON.parse(localStorage.getItem(STORAGE_KEYS.selectedCharacter) || "null");
    savedState = JSON.parse(localStorage.getItem(STORAGE_KEYS.playerState) || "null");
  } catch {
    // ignore parse errors
  }

  if (!savedChar) return;

  // if data changed, re-link by id
  const normalizedChars = characters.map(normalizeChar);
  const actualChar = normalizedChars.find(c => c.id === savedChar.id) || normalizeChar(savedChar);

  showMainUI();
  hydrateMainUI(actualChar, savedState || undefined);
  renderQuest();
  seedChat(actualChar, true);
}

function showMainUI() {
  const overlay = document.getElementById("char-selection-overlay");
  const mainUI = document.getElementById("main-ui");

  if (overlay) overlay.classList.add("hidden");
  if (mainUI) mainUI.style.display = "grid";
}

function hydrateMainUI(ch, stateOverride) {
  setText("#player-name", ch.name);
  setText("#player-desc", ch.description);

  const state = stateOverride || getPlayerState();

  setText("#player-level", String(state.level));
  setText("#player-xp", String(state.xp));
  setText("#player-xp-next", String(state.xpNext));
  setText("#player-coins", `${state.coins} 🪙`);

  setBar("#bar-confidence", state.confidence);
  setBar("#bar-vocab", state.vocabulary);
  setBar("#bar-fluency", state.fluency);

  renderPlayerAvatar("#player-avatar", ch);
}

function getPlayerState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.playerState) || "null");
    if (s) {
      return {
        level: Number(s.level ?? 1),
        xp: Number(s.xp ?? 0),
        xpNext: Number(s.xpNext ?? 100),
        coins: Number(s.coins ?? 0),
        confidence: clamp01to100(s.confidence ?? 20),
        vocabulary: clamp01to100(s.vocabulary ?? 20),
        fluency: clamp01to100(s.fluency ?? 20)
      };
    }
  } catch {}
  return { level: 1, xp: 0, xpNext: 100, coins: 0, confidence: 20, vocabulary: 20, fluency: 20 };
}

function savePlayerState(state) {
  try {
    localStorage.setItem(STORAGE_KEYS.playerState, JSON.stringify(state));
  } catch (e) {
    console.warn("Failed to save state:", e.message);
  }
}

function setupMainUIButtons() {
  const resetBtn = document.getElementById("btn-reset");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEYS.selectedCharacter);
      localStorage.removeItem(STORAGE_KEYS.playerState);

      const overlay = document.getElementById("char-selection-overlay");
      const mainUI = document.getElementById("main-ui");
      if (overlay) overlay.classList.remove("hidden");
      if (mainUI) mainUI.style.display = "none";

      const chat = document.getElementById("chat-box");
      if (chat) chat.innerHTML = "";
    });
  }

  const lessonBtn = document.getElementById("btn-lesson");
  if (lessonBtn) {
    lessonBtn.addEventListener("click", () => {
      const state = getPlayerState();
      state.xp += 25;
      state.coins += 10;
      state.confidence = clamp01to100(state.confidence + 2);
      state.vocabulary = clamp01to100(state.vocabulary + 1);
      state.fluency = clamp01to100(state.fluency + 2);

      while (state.xp >= state.xpNext) {
        state.xp -= state.xpNext;
        state.level += 1;
        state.xpNext = Math.round(state.xpNext * 1.25);
      }

      savePlayerState(state);

      setText("#player-level", String(state.level));
      setText("#player-xp", String(state.xp));
      setText("#player-xp-next", String(state.xpNext));
      setText("#player-coins", `${state.coins} 🪙`);
      setBar("#bar-confidence", state.confidence);
      setBar("#bar-vocab", state.vocabulary);
      setBar("#bar-fluency", state.fluency);

      addChatBubble("npc", "Nice work! You earned XP and improved your speaking skills.");
    });
  }
}

function renderQuest() {
  const box = document.getElementById("quest-content");
  if (!box) return;

  const quests = APP_DATA?.quests || {};
  const firstKey = Object.keys(quests)[0];

  if (!firstKey) {
    box.innerHTML = `<p class="quest-desc">No quests found yet.</p>`;
    return;
  }

  const q = quests[firstKey];
  const required = Array.isArray(q.requiredChunks) ? q.requiredChunks : [];
  const reward = q.reward || {};

  box.innerHTML = `
    <p class="quest-desc">${esc(q.description || "")}</p>

    <div class="likes">
      <div class="likes-title">Suggested chunks</div>
      ${required.map(chunk => `<span class="pill">${esc(chunk)}</span>`).join("")}
    </div>

    <label class="label" for="quest-reply">Your reply</label>
    <textarea id="quest-reply" placeholder="Write 2–4 sentences..."></textarea>

    <button id="btn-submit-quest" type="button">Send reply</button>

    <div class="reward">
      Reward: +${Number(reward.confidence || 0)} confidence · +${Number(reward.coins || 0)} coins · +${Number(reward.xp || 0)} XP
    </div>
    <div class="hint">Tip: Use at least one suggested chunk.</div>
  `;

  const btn = document.getElementById("btn-submit-quest");
  const textarea = document.getElementById("quest-reply");

  if (btn && textarea) {
    btn.addEventListener("click", () => {
      const text = textarea.value.trim();
      if (!text) return;

      addChatBubble("player", text);

      const usedChunk = required.some(chunk =>
        text.toLowerCase().includes(String(chunk).toLowerCase())
      );

      const state = getPlayerState();
      state.coins += Number(reward.coins || 0);
      state.xp += Number(reward.xp || 0);
      if (usedChunk) state.confidence = clamp01to100(state.confidence + Number(reward.confidence || 0));

      while (state.xp >= state.xpNext) {
        state.xp -= state.xpNext;
        state.level += 1;
        state.xpNext = Math.round(state.xpNext * 1.25);
      }

      savePlayerState(state);

      setText("#player-level", String(state.level));
      setText("#player-xp", String(state.xp));
      setText("#player-xp-next", String(state.xpNext));
      setText("#player-coins", `${state.coins} 🪙`);
      setBar("#bar-confidence", state.confidence);
      setBar("#bar-vocab", state.vocabulary);
      setBar("#bar-fluency", state.fluency);

      addChatBubble(
        "npc",
        usedChunk
          ? "Great reply! Nice chunk usage 👏 Reward added."
          : "Good attempt! Reward added. Next time try using one suggested chunk."
      );

      textarea.value = "";
    });
  }
}

function seedChat(ch, skipIfAlreadyFilled = false) {
  const chat = document.getElementById("chat-box");
  if (!chat) return;
  if (skipIfAlreadyFilled && chat.children.length > 0) return;

  chat.innerHTML = "";
  addChatBubble("npc", `Hi ${ch.name}! Welcome to Linguapolis.`);
  addChatBubble("npc", "Your first quest is ready. Introduce yourself to your neighbors.");
}

function addChatBubble(type, text) {
  const chat = document.getElementById("chat-box");
  if (!chat) return;

  const b = document.createElement("div");
  b.className = `bubble ${type}`;
  b.textContent = text;
  chat.appendChild(b);
  chat.scrollTop = chat.scrollHeight;
}

function renderPlayerAvatar(selector, ch) {
  const host = document.querySelector(selector);
  if (!host) return;
  host.innerHTML = "";

  const img = document.createElement("img");
  img.alt = ch.name;
  img.src = fallbackPngFromAvatar(ch.avatar, ch.id);

  img.onerror = () => {
    const current = img.getAttribute("src") || "";

    if (/assets\/avatars\/.*\.png$/i.test(current)) {
      img.src = current.replace("assets/avatars/", "assets/");
      return;
    }
    if (/\.png$/i.test(current)) {
      img.src = current.replace(/\.png$/i, ".jpg");
      return;
    }
    if (/assets\/avatars\/.*\.jpg$/i.test(current)) {
      img.src = current.replace("assets/avatars/", "assets/");
      return;
    }
  };

  if (isVideo(ch.avatar)) {
    const v = document.createElement("video");
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.autoplay = true;
    v.preload = "metadata";
    v.src = ch.avatar;

    let retriedRootPath = false;

    v.addEventListener("error", () => {
      const current = v.getAttribute("src") || "";

      if (!retriedRootPath && /assets\/avatars\//i.test(current)) {
        retriedRootPath = true;
        v.src = current.replace("assets/avatars/", "assets/");
        v.load();
        return;
      }

      v.remove();
      host.appendChild(img);
    });

    v.addEventListener("loadeddata", async () => {
      try {
        await v.play();
        host.innerHTML = "";
        host.appendChild(v);
      } catch {
        host.innerHTML = "";
        host.appendChild(img);
      }
    });

    host.appendChild(img); // immediate fallback
    return;
  }

  host.appendChild(img);
}

/* helpers */

function isVideo(p) {
  p = (p || "").toLowerCase();
  return p.endsWith(".mp4") || p.endsWith(".webm") || p.endsWith(".mov");
}

function fallbackPngFromAvatar(avatarPath, id) {
  if (avatarPath) return avatarPath.replace(/\.(mp4|webm|mov)$/i, ".png");
  return `assets/${id}.png`;
}

function setText(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
}

function setBar(selector, value) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.style.width = `${clamp01to100(value)}%`;
}

function clamp01to100(n) {
  n = Number(n);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
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
