const STORAGE_KEY = "linguapolis_save_v1";

let gameData = null;
let state = null;

// ---------- helpers ----------
function xpToNext(level) {
  return 100 + (level - 1) * 40;
}

function clamp01to100(n) {
  return Math.max(0, Math.min(100, n));
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
  // IMPORTANT: data.json must sit next to index.html
  const res = await fetch("./data.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load data.json");
  return await res.json();
}

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---------- UI ----------
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

    const avatarHtml = c.avatar
      ? `<img src="${c.avatar}" alt="${escapeHtml(c.name)}" style="width:72px;height:72px;border-radius:50%;display:block;margin:0 auto 10px;object-fit:cover;">`
      : `<div style="width:72px;height:72px;background:var(--primary);border-radius:50%;margin:0 auto 10px;"></div>`;

    btn.innerHTML = `
      ${avatarHtml}
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
    ? `<img src="${char.avatar}" alt="${escapeHtml(char.name)}" style="width:100%;height:100%;object-fit:cover;">`
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

// ---------- game logic ----------
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
    .map((c) => `<span style="display:inline-block;margin:6px 6px 0 0;padding:6px 10px;border-radius:999px;background:#f8fafc;border:1px solid #e2e8f0;font-size:12px;">${escapeHtml(c)}</span>`)
    .join("");

  content.innerHTML = `
    <h4 style="margin:0 0 6px;">${escapeHtml(quest.title)}</h4>
    <p style="margin:0 0 10px;opacity:.85;">${escapeHtml(quest.description)}</p>

    <div style="margin:8px 0 10px;">
      <div style="font-weight:800;margin-bottom:6px;">Your sim likes:</div>
      <div>${likes || "<span style='opacity:.7;'>No preferences yet</span>"}</div>
    </div>

    <label style="display:block;margin:8px 0 6px;">Pick a chunk:</label>
    <select id="chunk-select" ${isDone ? "disabled" : ""}>
      ${options}
    </select>

    <textarea id="msg-input" placeholder="Type your message..." ${isDone ? "disabled" : ""}></textarea>
    <button id="btn-send" ${isDone ? "disabled" : ""}>Send</button>

    <div id="quest-feedback" style="margin-top:10px;opacity:.85;"></div>
    <div style="margin-top:10px;opacity:.8;font-size:13px;">
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

    setTimeout(() => {
      appendChatBubble("Welcome! Happy to have you here.", "npc");
    }, 700);

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

// ---------- demo buttons ----------
function attachButtons() {
  const resetBtn = $("btn-reset");
  resetBtn.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });

  const lessonBtn = $("btn-lesson");
  lessonBtn.addEventListener("click", () => {
    // quick demo reward for a lesson
    applyReward({ xp: 35, coins: 10 });
    saveState();
    renderProfile();
    appendChatBubble("✅ Lesson completed (+XP)", "npc");
  });
}

// ---------- boot ----------
document.addEventListener("DOMContentLoaded", async () => {
  try {
    gameData = await loadGameData();
  } catch (e) {
    console.error(e);
    // If data.json is missing, the page still works (fallback)
    gameData = {
      characters: [
        { id: "techie", name: "Alex Code", description: "Tech Enthusiast", startingStats: { confidence: 30, vocabulary: 40, fluency: 15 }, preferredChunks: [] },
        { id: "creative", name: "Mia Design", description: "Creative Soul", startingStats: { confidence: 50, vocabulary: 20, fluency: 25 }, preferredChunks: [] },
        { id: "executive", name: "James Corp", description: "Business Pro", startingStats: { confidence: 40, vocabulary: 30, fluency: 20 }, preferredChunks: [] }
      ],
      quests: {
        residents_chat_01: {
          title: "The First Impression",
          description: "Introduce yourself to neighbors (use 1 chunk)",
          requiredChunks: ["Low-key"],
          reward: { confidence: 15, coins: 50, xp: 35 }
        }
      }
    };
  }

  attachButtons();

  const saved = loadState();
  if (saved?.selectedCharacterId) {
    restoreGame(saved);
  } else {
    showSelectionUI();
    renderCharacterGrid();
  }
});
