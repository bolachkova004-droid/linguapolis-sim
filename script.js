const STORAGE_KEY = "linguapolis_save_v2";

let gameData = null;
let state = null;

function xpToNext(level) {
  return 100 + (level - 1) * 40;
}
function clamp01to100(n) {
  return Math.max(0, Math.min(100, n));
}
function $(id) { return document.getElementById(id); }

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

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isVideo(path) {
  return /\.(mp4|webm)$/i.test(path || "");
}
function isImage(path) {
  return /\.(png|jpg|jpeg|webp|gif)$/i.test(path || "");
}

function renderMedia(path, size = 72, rounded = 999) {
  if (!path) {
    return `<div style="width:${size}px;height:${size}px;border-radius:${rounded}px;background:#e2e8f0;margin:0 auto 10px;"></div>`;
  }

  if (isVideo(path)) {
    return `
      <video
        src="${path}"
        autoplay
        loop
        muted
        playsinline
        preload="metadata"
        style="width:${size}px;height:${size}px;border-radius:${rounded}px;display:block;margin:0 auto 10px;object-fit:cover;background:#e2e8f0;"
      ></video>
    `;
  }

  if (isImage(path)) {
    return `<img src="${path}" alt="" style="width:${size}px;height:${size}px;border-radius:${rounded}px;display:block;margin:0 auto 10px;object-fit:cover;background:#e2e8f0;">`;
  }

  return `<div style="width:${size}px;height:${size}px;border-radius:${rounded}px;background:#e2e8f0;margin:0 auto 10px;"></div>`;
}

function showMainUI() {
  $("char-selection-overlay").style.display = "none";
  $("main-ui").style.display = "grid";
}
function showSelectionUI() {
  $("char-selection-overlay").style.display = "flex";
  $("main-ui").style.display = "none";
}

function renderCharacterGrid() {
  const grid = $("char-grid");
  grid.innerHTML = "";

  gameData.characters.forEach((c) => {
    const btn = document.createElement("div");
    btn.className = "char-btn";

    btn.innerHTML = `
      ${renderMedia(c.avatar, 78, 999)}
      <strong>${escapeHtml(c.name)}</strong><br>
      <small>${escapeHtml(c.description || "")}</small>
    `;

    btn.addEventListener("click", () => startGame(c.id));
    grid.appendChild(btn);
  });
}

function renderProfile() {
  const char = gameData.characters.find((x) => x.id === state.selectedCharacterId);
  if (!char) return;

  $("player-name").innerText = char.name;
  $("player-desc").innerText = char.description || "";

  const avatarBox = $("player-avatar");
  avatarBox.innerHTML = char.avatar
    ? (isVideo(char.avatar)
        ? `<video src="${char.avatar}" autoplay loop muted playsinline preload="metadata" style="width:100%;height:100%;object-fit:cover;"></video>`
        : `<img src="${char.avatar}" alt="${escapeHtml(char.name)}" style="width:100%;height:100%;object-fit:cover;">`
      )
    : "";

  $("bar-confidence").style.width = clamp01to100(state.stats.confidence) + "%";
  $("bar-vocab").style.width = clamp01to100(state.stats.vocabulary) + "%";
  $("bar-fluency").style.width = clamp01to100(state.stats.fluency || 0) + "%";

  $("player-level").textContent = state.level;
  $("player-xp").textContent = state.xp;
  $("player-xp-next").textContent = xpToNext(state.level);
  $("player-coins").textContent = state.coins;
}

function appendChatBubble(text, who = "player") {
  const box = $("chat-box");
  box.innerHTML += `<div class="bubble ${who}">${escapeHtml(text)}</div>`;
  box.scrollTop = box.scrollHeight;
}

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

function startGame(characterId) {
  state = newStateForCharacter(characterId);
  saveState();
  showMainUI();
  $("chat-box").innerHTML = "";
  renderProfile();
  renderQuest();
}

function restoreGame(existingState) {
  state = existingState;
  showMainUI();
  renderProfile();
  renderQuest();
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

    <div class="likes">
      <div class="likes-title">Your sim likes:</div>
      <div>${likes || "<span style='opacity:.7;'>No preferences yet</span>"}</div>
    </div>

    <label class="label">Pick a chunk:</label>
    <select id="chunk-select" ${isDone ? "disabled" : ""}>${options}</select>

    <textarea id="msg-input" placeholder="Type your message..." ${isDone ? "disabled" : ""}></textarea>
    <button id="btn-send" ${isDone ? "disabled" : ""}>Send</button>

    <div id="quest-feedback" class="hint"></div>

    <div class="reward">
      Reward: ${quest.reward?.confidence ? `+${quest.reward.confidence} Confidence` : ""} 
      ${quest.reward?.coins ? ` • +${quest.reward.coins} Coins` : ""} 
      • +XP
    </div>
  `;

  const feedback = $("quest-feedback");
  if (isDone) feedback.textContent = "✅ Completed";

  $("btn-send").addEventListener("click", () => {
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
      renderProfile();
      feedback.textContent = "🎉 Quest complete! Rewards applied.";
    }
  });
}

function attachButtons() {
  $("btn-reset").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });

  $("btn-lesson").addEventListener("click", () => {
    applyReward({ xp: 35, coins: 10 });
    saveState();
    renderProfile();
    appendChatBubble("✅ Lesson completed (+XP)", "npc");
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  gameData = await loadGameData();
  attachButtons();

  const saved = loadState();
  if (saved?.selectedCharacterId) restoreGame(saved);
  else {
    showSelectionUI();
    renderCharacterGrid();
  }
});

