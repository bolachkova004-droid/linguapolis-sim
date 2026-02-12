const STORAGE_KEY = "linguapolis_save_autofix_v2";

// Ищем медиа и так, и так (чтобы не зависеть от того, куда ты положила файлы)
const IMAGE_FOLDERS = ["assets/avatars", "assets"];
const VIDEO_FOLDERS = ["assets/videos", "assets"];
const IMG_EXTS = ["webp", "png", "jpg", "jpeg", "gif"];
const VID_EXTS = ["mp4", "webm"];

let gameData = null;
let state = null;
let showVideoInProfile = false;

function $(id) { return document.getElementById(id); }
function safeEl(id) { return document.getElementById(id) || null; }

function clamp01to100(n) { return Math.max(0, Math.min(100, n)); }
function xpToNext(level) { return 100 + (level - 1) * 40; }

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function loadGameData() {
  const res = await fetch("./data.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load data.json");
  return await res.json();
}

function showMainUI() {
  const overlay = safeEl("char-selection-overlay");
  const main = safeEl("main-ui");
  if (overlay) overlay.style.display = "none";
  if (main) main.style.display = "grid";
}
function showSelectionUI() {
  const overlay = safeEl("char-selection-overlay");
  const main = safeEl("main-ui");
  if (overlay) overlay.style.display = "flex";
  if (main) main.style.display = "none";
}

// ---------- asset resolving (ищем существующий файл) ----------
async function urlExists(url) {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

async function resolveImageUrl(key) {
  for (const folder of IMAGE_FOLDERS) {
    for (const ext of IMG_EXTS) {
      const url = `${folder}/${encodeURIComponent(key)}.${ext}`;
      if (await urlExists(url)) return url;
    }
  }
  return null;
}

function canPlayVideoExt(ext) {
  const v = document.createElement("video");
  const type = ext === "webm" ? "video/webm" : "video/mp4";
  const verdict = v.canPlayType(type);
  return verdict === "probably" || verdict === "maybe";
}

async function resolveVideoUrl(key) {
  for (const folder of VIDEO_FOLDERS) {
    for (const ext of VID_EXTS) {
      if (!canPlayVideoExt(ext)) continue;
      const url = `${folder}/${encodeURIComponent(key)}.${ext}`;
      if (await urlExists(url)) return url;
    }
  }
  return null;
}

// ---------- UI helpers ----------
function setText(id, value) {
  const el = safeEl(id);
  if (el) el.textContent = value;
}
function setWidth(id, percent) {
  const el = safeEl(id);
  if (el) el.style.width = percent;
}

async function renderThumbInto(holder, key, label) {
  const imgUrl = await resolveImageUrl(key);
  if (imgUrl) {
    holder.innerHTML = `<img class="media-thumb" src="${imgUrl}" alt="${escapeHtml(label)}">`;
    return { imgUrl, videoUrl: null };
  }
  const videoUrl = await resolveVideoUrl(key);
  if (videoUrl) {
    holder.innerHTML = `<video class="media-thumb" src="${videoUrl}" autoplay loop muted playsinline preload="metadata"></video>`;
    return { imgUrl: null, videoUrl };
  }
  holder.innerHTML = `<div class="media-thumb" style="display:flex;align-items:center;justify-content:center;font-weight:900;opacity:.5;">No media</div>`;
  return { imgUrl: null, videoUrl: null };
}

async function renderProfileMedia(key, label) {
  const box = safeEl("player-avatar");
  if (!box) return;

  const btn = safeEl("btn-toggle-media");

  const imgUrl = await resolveImageUrl(key);
  const videoUrl = await resolveVideoUrl(key);

  // если кнопки нет в твоём index.html — просто показываем картинку и не падаем
  if (btn) {
    btn.disabled = !videoUrl;
    btn.textContent = showVideoInProfile && videoUrl ? "Image" : "Animate";
  }

  if (showVideoInProfile && videoUrl) {
    box.innerHTML = `<video src="${videoUrl}" autoplay loop muted playsinline preload="metadata" style="width:100%;height:100%;object-fit:cover;"></video>`;
    return;
  }

  if (imgUrl) {
    box.innerHTML = `<img src="${imgUrl}" alt="${escapeHtml(label)}" style="width:100%;height:100%;object-fit:cover;">`;
    return;
  }

  if (videoUrl) {
    // если картинки нет, но видео есть
    box.innerHTML = `<video src="${videoUrl}" autoplay loop muted playsinline preload="metadata" style="width:100%;height:100%;object-fit:cover;"></video>`;
    if (btn) btn.textContent = "Image";
    showVideoInProfile = true;
    return;
  }

  box.innerHTML = "";
}

// ---------- game ----------
function newStateForCharacter(characterId) {
  const char = gameData.characters.find((x) => x.id === characterId);
  const starting = char?.startingStats || { confidence: 25, vocabulary: 25, fluency: 10 };

  return {
    selectedCharacterId: characterId,
    stats: { ...starting },
    coins: 0,
    level: 1,
    xp: 0,
    completedQuests: [],
    currentQuestId: Object.keys(gameData.quests || {})[0] || null
  };
}

function applyReward(reward) {
  if (!reward) return;
  if (reward.confidence) state.stats.confidence = clamp01to100(state.stats.confidence + reward.confidence);
  if (reward.vocabulary) state.stats.vocabulary = clamp01to100(state.stats.vocabulary + reward.vocabulary);
  if (reward.fluency) state.stats.fluency = clamp01to100((state.stats.fluency || 0) + reward.fluency);
  if (reward.coins) state.coins += reward.coins;

  const rewardXp = reward.xp ?? 35;
  state.xp += rewardXp;

  while (state.xp >= xpToNext(state.level)) {
    state.xp -= xpToNext(state.level);
    state.level += 1;
  }
}

function appendChatBubble(text, who = "player") {
  const box = safeEl("chat-box");
  if (!box) return;
  box.innerHTML += `<div class="bubble ${who}">${escapeHtml(text)}</div>`;
  box.scrollTop = box.scrollHeight;
}

async function renderCharacterGrid() {
  const grid = safeEl("char-grid");
  if (!grid) return;

  grid.innerHTML = "";

  // если вдруг data.json не тот
  if (!gameData?.characters?.length) {
    grid.innerHTML = `<div style="opacity:.75;font-weight:800;">No characters found in data.json</div>`;
    return;
  }

  for (const c of gameData.characters) {
    const btn = document.createElement("div");
    btn.className = "char-btn";

    const mediaHolder = document.createElement("div");
    mediaHolder.innerHTML = `<div class="media-thumb"></div>`;

    // важно: имя файла = id персонажа
    await renderThumbInto(mediaHolder, c.id, c.name || c.id);

    const title = document.createElement("div");
    title.innerHTML = `<strong>${escapeHtml(c.name || c.id)}</strong><br><small>${escapeHtml(c.description || "")}</small>`;

    btn.appendChild(mediaHolder);
    btn.appendChild(title);

    btn.addEventListener("click", () => startGame(c.id));
    grid.appendChild(btn);
  }
}

async function renderProfile() {
  const char = gameData.characters.find((x) => x.id === state.selectedCharacterId);
  if (!char) return;

  setText("player-name", char.name || char.id);
  setText("player-desc", char.description || "");

  await renderProfileMedia(char.id, char.name || char.id);

  setWidth("bar-confidence", clamp01to100(state.stats.confidence) + "%");
  setWidth("bar-vocab", clamp01to100(state.stats.vocabulary) + "%");
  setWidth("bar-fluency", clamp01to100(state.stats.fluency || 0) + "%");

  setText("player-level", state.level);
  setText("player-xp", state.xp);
  setText("player-xp-next", xpToNext(state.level));
  setText("player-coins", state.coins);
}

function renderQuest() {
  const content = safeEl("quest-content");
  if (!content) return;

  const questId = state.currentQuestId;
  const quest = questId ? gameData.quests?.[questId] : null;

  if (!quest) {
    content.innerHTML = `<p>No quests yet.</p>`;
    return;
  }

  const isDone = state.completedQuests.includes(questId);

  const options = (quest.requiredChunks || [])
    .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
    .join("");

  content.innerHTML = `
    <h4 class="quest-title">${escapeHtml(quest.title || "Quest")}</h4>
    <p class="quest-desc">${escapeHtml(quest.description || "")}</p>

    <label class="label">Pick a chunk:</label>
    <select id="chunk-select" ${isDone ? "disabled" : ""}>${options}</select>

    <textarea id="msg-input" placeholder="Type your message..." ${isDone ? "disabled" : ""}></textarea>
    <button id="btn-send" ${isDone ? "disabled" : ""}>Send</button>

    <div id="quest-feedback" class="hint"></div>
  `;

  const feedback = safeEl("quest-feedback");
  if (isDone && feedback) feedback.textContent = "✅ Completed";

  const btnSend = safeEl("btn-send");
  if (!btnSend) return;

  btnSend.addEventListener("click", async () => {
    const typed = (safeEl("msg-input")?.value || "").trim();
    const chunk = safeEl("chunk-select")?.value || "";
    if (!typed) return;

    appendChatBubble(typed, "player");
    setTimeout(() => appendChatBubble("Welcome! Happy to have you here.", "npc"), 600);

    const ok = chunk && typed.toLowerCase().includes(chunk.toLowerCase());
    if (!ok) {
      if (feedback) feedback.textContent = `Try to include the chunk: “${chunk}”`;
      return;
    }

    if (!state.completedQuests.includes(questId)) {
      state.completedQuests.push(questId);
      applyReward(quest.reward);
      saveState();
      await renderProfile();
      if (feedback) feedback.textContent = "🎉 Quest complete!";
    }
  });
}

async function startGame(characterId) {
  state = newStateForCharacter(characterId);
  saveState();
  showMainUI();
  const chat = safeEl("chat-box");
  if (chat) chat.innerHTML = "";
  await renderProfile();
  renderQuest();
}

async function restoreGame(existingState) {
  state = existingState;
  showMainUI();
  await renderProfile();
  renderQuest();
}

function attachButtons() {
  const reset = safeEl("btn-reset");
  if (reset) {
    reset.addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    });
  }

  const lesson = safeEl("btn-lesson");
  if (lesson) {
    lesson.addEventListener("click", async () => {
      applyReward({ xp: 35, coins: 10 });
      saveState();
      await renderProfile();
      appendChatBubble("✅ Lesson completed (+XP)", "npc");
    });
  }

  const toggle = safeEl("btn-toggle-media");
  if (toggle) {
    toggle.addEventListener("click", async () => {
      showVideoInProfile = !showVideoInProfile;
      await renderProfile();
    });
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    gameData = await loadGameData();
  } catch (e) {
    alert("data.json not found or invalid JSON.");
    console.error(e);
    return;
  }

  attachButtons();

  const saved = loadState();
  if (saved?.selectedCharacterId) await restoreGame(saved);
  else {
    showSelectionUI();
    await renderCharacterGrid();
  }
});
