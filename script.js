// Встроенные данные (заменяют data.json)
const charactersData = [
    {
        id: "techie",
        name: "Alex Code",
        avatar: "https://via.placeholder.com/120/4f46e5/ffffff?text=ALEX",
        description: "Future developer. Logic & code master.",
        startingStats: { confidence: 25, vocabulary: 35, fluency: 15 }
    },
    {
        id: "creative", 
        name: "Mia Design",
        avatar: "https://via.placeholder.com/120/ec4899/ffffff?text=MIA",
        description: "Content creator. Vibe & style master.",
        startingStats: { confidence: 40, vocabulary: 20, fluency: 25 }
    },
    {
        id: "professional",
        name: "James Corp",
        avatar: "https://via.placeholder.com/120/10b981/ffffff?text=JAMES",
        description: "Career climber. Networking pro.",
        startingStats: { confidence: 35, vocabulary: 25, fluency: 20 }
    }
];

const questsData = {
    "residents_chat_01": {
        title: "The First Impression",
        description: "Introduce yourself to neighbors (use 1 chunk)",
        requiredChunks: ["Just moved in", "Looking forward", "Low-key nervous"],
        reward: { confidence: 15, coins: 50 }
    }
};

// Состояние игры
let gameState = {
    confidence: 30,
    vocabulary: 20,
    fluency: 10,
    coins: 0,
    currentQuest: 'residents_chat_01',
    currentCharacter: null
};

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    showCharacterSelect();
});

function showCharacterSelect() {
    const avatarArea = document.querySelector('.avatar');
    // Очищаем область и вставляем выбор
    avatarArea.style.border = 'none'; 
    avatarArea.innerHTML = `
        <div style="background: rgba(40,40,70,0.9); padding: 20px; border-radius: 20px; border: 1px solid #3b82f6;">
            <h3 style="color: #fff; margin-bottom: 15px; font-size: 16px;">Choose Your Sim</h3>
            <div id="char-list" style="display: flex; flex-direction: column; gap: 10px;">
                ${charactersData.map(char => `
                    <div class="char-card" data-id="${char.id}" style="cursor: pointer; background: #1e1e2e; padding: 10px; border-radius: 10px; border: 1px solid #444; text-align: left;">
                        <strong style="color: #3b82f6;">${char.name}</strong><br>
                        <small style="color: #aaa; font-size: 10px;">${char.description}</small>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    document.querySelectorAll('.char-card').forEach(card => {
        card.addEventListener('click', () => selectCharacter(card.dataset.id));
    });
}

function selectCharacter(id) {
    const char = charactersData.find(c => c.id === id);
    gameState.currentCharacter = char;
    gameState.confidence = char.startingStats.confidence;
    gameState.vocabulary = char.startingStats.vocabulary;
    gameState.fluency = char.startingStats.fluency;

    const avatarArea = document.querySelector('.avatar');
    avatarArea.style.border = '2px solid #3b82f6';
    avatarArea.innerHTML = `<img src="${char.avatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
    
    // Показываем имя под аватаром
    const nameLabel = document.createElement('div');
    nameLabel.style.cssText = "color: #3b82f6; font-weight: bold; margin-top: 10px; text-align: center;";
    nameLabel.textContent = char.name;
    avatarArea.appendChild(nameLabel);

    updateStats();
    loadQuest();
}

function updateStats() {
    document.getElementById('confidence').textContent = gameState.confidence + '%';
    document.getElementById('vocab').textContent = gameState.vocabulary + '%';
    document.getElementById('fluency').textContent = gameState.fluency + '%';
    document.querySelector('#confidence-bar div').style.width = gameState.confidence + '%';
    document.querySelector('#vocab-bar div').style.width = gameState.vocabulary + '%';
    document.querySelector('#fluency-bar div').style.width = gameState.fluency + '%';
}

function loadQuest() {
    const quest = questsData[gameState.currentQuest];
    const questArea = document.getElementById('current-quest');
    questArea.innerHTML = `
        <h4 style="color: #8b5cf6;">${quest.title}</h4>
        <p style="font-size: 13px; margin: 10px 0;">${quest.description}</p>
        <div style="display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 10px;">
            ${quest.requiredChunks.map(chunk => `
                <button class="chunk-btn" data-chunk="${chunk}" style="background: rgba(139, 92, 246, 0.2); border: 1px solid #8b5cf6; color: #fff; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-size: 12px;">${chunk}</button>
            `).join('')}
        </div>
        <textarea id="message-input" style="width: 100%; height: 60px; background: #151525; color: #fff; border: 1px solid #444; border-radius: 8px; padding: 10px; margin-bottom: 10px;"></textarea>
        <button id="send-btn" style="width: 100%; background: #3b82f6; color: #fff; border: none; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: bold;">Send Message</button>
    `;

    document.querySelectorAll('.chunk-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('message-input').value += btn.dataset.chunk + ' ';
        });
    });

    document.getElementById('send-btn').addEventListener('click', handleSend);
}

function handleSend() {
    const text = document.getElementById('message-input').value;
    if (!text) return;

    addMessage('player', text);
    
    const quest = questsData[gameState.currentQuest];
    const hasChunk = quest.requiredChunks.some(c => text.toLowerCase().includes(c.toLowerCase()));

    setTimeout(() => {
        addMessage('npc', "Welcome to Linguapolis! That sounds great.");
        if (hasChunk) {
            gameState.confidence += 10;
            updateStats();
            alert("Success! Confidence +10%");
        }
    }, 1000);
}

function addMessage(sender, text) {
    const chat = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.style.cssText = `margin-bottom: 10px; padding: 10px; border-radius: 10px; font-size: 13px; ${sender === 'player' ? 'background: #3b82f6; margin-left: 20%;' : 'background: #2a2a3e; margin-right: 20%;'}`;
    div.innerHTML = `<strong>${sender === 'player' ? 'You' : 'Neighbor'}:</strong><br>${text}`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}
