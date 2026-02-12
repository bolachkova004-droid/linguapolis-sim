// ========== CONFIG ==========
const STORAGE_KEY = "linguapolis_save_autofix_v1";

// Где искать ассеты (код сам попробует оба варианта)
const IMAGE_FOLDERS = ["assets/avatars", "assets"];
const VIDEO_FOLDERS = ["assets/videos", "assets"];

const IMG_EXTS = ["webp", "png", "jpg", "jpeg", "gif"];
const VID_EXTS = ["mp4", "webm"];

// ========== STATE ==========
let gameData = null;
let state = null;
let showVideoInProfile = false;

function $(id) { return document.getElementById(id); }
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
  } catch { return null; }
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
  $("char-selection-overlay").style.display = "none";
  $("main-ui").style.display = "grid";
}
function showSelectionUI() {
  $("char-selection-overlay").style.display = "flex";
  $("main-ui").style.display = "none";
}

// ========== ASSET RESOLVER ==========
// Попробуем найти существующую картинку/видео по id, перебирая папки и расширения.
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

async function renderThumbMedia(container, key, label) {
  // Для сетки выбора персонажа: сначала картинка, если нет — видео
  const imgUrl = await resolveImageUrl(key);
  if (imgUrl) {
    container.innerHTML = `<img class="media-thumb" src="${imgUrl}" alt="${escapeHtml(label)}">`;
    return { imgUrl, videoUrl: null };
  }
  const videoUrl = await resolveVideoUrl(key);
  if (videoUrl) {
    container.innerHTML = `
      <video class="media-thumb" src="${videoUrl}" autoplay loop muted playsinline preload="metadata"></video>
    `;
    return { imgUrl: null, videoUrl };
  }
  container.innerHTML = `<div class="media-thumb" style="display:flex;align-items:center;justify-content:center;font-weight:900;opacity:.6;">No media</div>`;
  return { imgUrl: null, videoUrl: null };
}

async function renderProfileMedia(container, key, label) {
  // В профиле: по кнопке — показываем видео, иначе картинку. Если видео нет — всегда картинка.
  const imgUrl = await resolveImageUrl(key);
  const videoUrl = await resolveVideoUrl(key);

  const btn = $("btn-toggle-media");
  btn.disabled = !videoUrl;

  const showVideo = !!(videoUrl && showVideoInProfile);

  if (showVideo) {
    container.innerHTML = `
      <video src="${videoUrl}" autoplay loop muted playsinline preload="metadata"
        style="width:100%;height:100%;object-fit:cover;"></video>
    `;
    btn.textContent = "Image";
  } else {
    if (imgUrl) {
      container.innerHTML = `
        <img src="${imgUrl}" alt="${escapeHtml(label)}"
          style="width:100%;height:100%;object-fit:cover;">
      `;
    } else if (videoUrl) {
      // если картинки нет, но видео есть — покажем видео
      container.innerHTML = `
        <video src="${videoUrl}" autoplay loop muted playsinline preload="metadata"
          style="width:100%;height:100%;object-fit:cover;"></video>
      `;
      btn.textContent = "Image";
      showVideoInProfile = true;
    } else {
      container.innerHTML = "";
    }
    if (!showVideoInProfile) btn.textContent = "Animate";
  }

  return { imgUrl, videoUrl };
}

// ========== GAME LOGIC ==========
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
  const box = $("chat-box");
  box.innerHTML += `<div class="bubble ${who}">${escapeHtml(text)}</div>`;
  box.scrollTop = box.scrollHeight;
}

async function renderCharacterGrid() {
  const grid = $("char-grid");
  grid.innerHTML = "";

  for (const c of gameData.characters) {
    const btn = document.createElement("div");
    btn.className = "char-btn";

    const mediaHolder = document.createElement("div");
    mediaHolder.innerHTML = `<div class="media-thumb"></div>`;
    await renderThumbMedia(mediaHolder, c.id, c.name);

    const title = document.createElement("div");
    title.innerHTML = `<strong>${escapeHtml(c.name)}</strong><br><small>${escapeHtml(c.description || "")}</small>`;

    btn.appendChild(mediaHolder);
    btn.appendChild(title);

    btn.addEventListener("click", () => startGame(c.id));
    grid.appendChild(btn);
  }
}

async function renderProfile() {
  const char = gameData.characters.find((x) => x.id === state.selectedCharacterId);
  if (!char) return;

  $("player-name").innerText = char.name;
  $("player-desc").innerText = char.description || "";

  await renderProfileMedia($("player-avatar"), char.id, char.name);

  $("bar-confidence").style.width = clamp01to100(state.stats.confidence) + "%";
  $("bar-vocab").style.width = clamp01to100(state.stats.vocabulary) + "%";
  $("bar-fluency").style.width = clamp01to100(state.stats.fluency || 0) + "%";

  $("player-level").textContent = state.level;
  $("player-xp").textContent = state.xp;
  $("player-xp-next").textContent = xpToNext(state.level);
  $("player-coins").textContent = state.coins;
}

function renderQuest() {
  const questId = state.currentQuestId;
  const quest = questId ? gameData.quests?.[questId] : null;
  const content = $("quest-content");

  if (!quest) {
    content.innerHTML = `<p>No quests yet.</p>`;
    return;
  }

  const isDone = state.completedQuests.includes(questId);
  const char = gameData.characters.find((x) => x.id === state.selectedCharacterId);

  const options = quest.requiredChunks
    .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
    .join("");

  const likes = (char?.preferredChunks || [])
    .map((c) => `<span class="pill">${escapeHtml(c)}</span>`)
    .join("");

  content.innerHTML = `
    <h4 class="quest-title">${escapeHtml(quest.title)}</h4>
    <p class="quest-desc">${escapeHtml(quest.description)}</p>

    <div style="margin:8px 0 10px;">
      <div style="font-weight:900;margin-bottom:6px;">Your sim likes:</div>
      <div>${likes || "<span style='opacity:.7;'>No preferences yet</span>"}</div>
    </div>

    <label class="label">Pick a chunk:</label>
    <select id="chunk-select" ${isDone ? "disabled" : ""}>${options}</select>

    <textarea id="msg-input" placeholder="Type your message..." ${isDone ? "disabled" : ""}></textarea>
    <button id="btn-send" ${isDone ? "disabled" : ""}>Send</button>

    <div id="quest-feedback" class="hint"></div>
    <div class="reward">Reward: +Confidence • +Coins • +XP</div>
  `;

  const feedback = $("quest-feedback");
  if (isDone) feedback.textContent = "✅ Completed";

  $("btn-send").addEventListener("click", async () => {
    const typed = $("msg-input").value.trim();
    const chunk = $("chunk-select").value;
    if (!typed) return;

    appendChatBubble(typed, "player");
    setTimeout(() => appendChatBubble("Welcome! Happy to have you here.", "npc"), 600);

    const ok = typed.toLowerCase().includes(chunk.toLowerCase());
    if (!ok) {
      feedback.textContent = `Try to include the chunk: “${chunk}”`;
      return;
    }

    if (!state.completedQuests.includes(questId)) {
      state.completedQuests.push(questId);
      applyReward(quest.reward);
      saveState();
      await renderProfile();
      feedback.textContent = "🎉 Quest complete! Rewards applied.";
    }
  });
}

async function startGame(characterId) {
  state = newStateForCharacter(characterId);
  saveState();
  showMainUI();
  $("chat-box").innerHTML = "";
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
  $("btn-reset").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });

  $("btn-lesson").addEventListener("click", async () => {
    applyReward({ xp: 35, coins: 10 });
    saveState();
    await renderProfile();
    appendChatBubble("✅ Lesson completed (+XP)", "npc");
  });

  $("btn-toggle-media").addEventListener("click", async () => {
    showVideoInProfile = !showVideoInProfile;
    await renderProfile();
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    gameData = await loadGameData();
  } catch (e) {
    alert("data.json not found or invalid. Check repository root.");
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
