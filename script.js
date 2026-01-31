// Загружаем персонажей
let currentCharacter = null;
let characters = [];

// Добавь после function setupEventListeners()
async function loadCharacters() {
    try {
        const response = await fetch('data.json');
        const data = await response.json();
        characters = data.characters;
        showCharacterSelect();
    } catch (error) {
        console.log('Using default characters');
        characters = [
            {
                id: "techie",
                name: "Alex Code",
                avatar: "https://via.placeholder.com/120/4f46e5/ffffff?text=TECH",
                description: "Future developer",
                startingStats: { confidence: 25, vocabulary: 35, fluency: 15 }
            },
            {
                id: "creative", 
                name: "Mia Design",
                avatar: "https://via.placeholder.com/120/ec4899/ffffff?text=CREATIVE",
                description: "Content creator",
                startingStats: { confidence: 40, vocabulary: 20, fluency: 25 }
            },
            {
                id: "professional",
                name: "James Corp",
                avatar: "https://via.placeholder.com/120/10b981/ffffff?text=PRO",
                description: "Career climber",
                startingStats: { confidence: 35, vocabulary: 25, fluency: 20 }
            }
        ];
        showCharacterSelect();
    }
}

function showCharacterSelect() {
    const avatar = document.querySelector('.avatar');
    avatar.innerHTML = `
        <div class="character-select">
            <h3 style="margin-bottom: 20px;">Choose your Linguapolis Sim</h3>
            <div class="character-grid" style="display: flex; flex-direction: column; gap: 12px;">
                ${characters.map((char, index) => `
                    <div class="char-option" data-id="${char.id}" style="cursor: pointer; padding: 16px; background: rgba(60,60,80,0.7); border-radius: 12px; border: 2px solid transparent; transition: all 0.3s;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #${index === 0 ? '4f46e5' : index === 1 ? 'ec4899' : '10b981'}, #${index === 0 ? '3730a3' : index === 1 ? 'be185d' : '059669'}); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; font-size: 14px;">
                                ${char.id.toUpperCase()}
                            </div>
                            <div>
                                <h4 style="margin: 0; font-size: 16px;">${char.name}</h4>
                                <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.8;">${char.description}</p>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    // Клик по персонажу
    document.querySelectorAll('.char-option').forEach(option => {
        option.addEventListener('click', () => {
            option.style.borderColor = '#3b82f6';
            option.style.background = 'rgba(59,130,246,0.2)';
            setTimeout(() => selectCharacter(option.dataset.id), 200);
        });
    });
}

    
    // Обработчики выбора персонажа
    document.addEventListener('DOMContentLoaded', () => {
    loadCharacters(); // Показываем выбор персонажа первым
});

        option.addEventListener('click', () => {
            selectCharacter(option.dataset.id);
        });
    });
}

function selectCharacter(characterId) {
    currentCharacter = characters.find(c => c.id === characterId);
    gameState.confidence = currentCharacter.startingStats.confidence;
    gameState.vocabulary = currentCharacter.startingStats.vocabulary;
    gameState.fluency = currentCharacter.startingStats.fluency;
    
    document.querySelector('.avatar').innerHTML = `
        <img src="${currentCharacter.avatar}" alt="${currentCharacter.name}">
        <div class="char-name">${currentCharacter.name}</div>
    `;
    
    updateStats();
    loadQuest();
}

// Game state
let gameState = {
    confidence: 30,
    vocabulary: 20,
    fluency: 10,
    coins: 0,
    currentQuest: 'residents_chat_01',
    usedChunks: [],
    achievements: []
};

// Квесты (ты меняешь здесь!)
// В самом начале файла замени объект quests на:
const quests = gameState.quests || {
    "residents_chat_01": {
        title: "The First Impression",
        description: "Introduce yourself to neighbors (use 1 chunk)",
        requiredChunks: ["Just moved in", "Looking forward", "Low-key nervous"],
        reward: { confidence: 15, coins: 50 }
    }
};


// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    updateStats();
    loadQuest();
    setupEventListeners();
});

function updateStats() {
    document.getElementById('confidence').textContent = gameState.confidence + '%';
    document.getElementById('vocab').textContent = gameState.vocabulary + '%';
    document.getElementById('fluency').textContent = gameState.fluency + '%';
    
    // Анимация баров
    document.querySelector('#confidence-bar div').style.width = gameState.confidence + '%';
    document.querySelector('#vocab-bar div').style.width = gameState.vocabulary + '%';
    document.querySelector('#fluency-bar div').style.width = gameState.fluency + '%';
}

function loadQuest() {
    const quest = quests[gameState.currentQuest];
    document.getElementById('current-quest').innerHTML = `
        <h4>${quest.title}</h4>
        <p>${quest.description}</p>
        <div class="chunks">
            ${quest.requiredChunks.map(chunk => 
                `<button class="chunk-btn" data-chunk="${chunk}">${chunk}...</button>`
            ).join('')}
        </div>
        <textarea id="message-input" placeholder="Type your message here..."></textarea>
        <button id="send-message">Send Message</button>
    `;
}

function setupEventListeners() {
    // Кластерами
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('chunk-btn')) {
            const chunk = e.target.dataset.chunk;
            const input = document.getElementById('message-input');
            input.value += chunk + '... ';
            input.focus();
        }
    });

    // Отправка сообщения
    document.addEventListener('click', (e) => {
        if (e.target.id === 'send-message') {
            sendMessage();
        }
    });
}

function sendMessage() {
    const message = document.getElementById('message-input').value.trim();
    
    if (!message) return;
    
    // Добавляем сообщение игрока
    addMessage('player', message);
    
    // Проверка на chunks
    const quest = quests[gameState.currentQuest];
    const usedChunks = quest.requiredChunks.filter(chunk => 
        message.toLowerCase().includes(chunk.toLowerCase())
    );
    
    gameState.usedChunks = usedChunks;
    
    // Ответ NPC
    setTimeout(() => {
        const responses = [
            "Welcome to the building! Need help settling in?",
            "Nice to meet you! What brings you to Linguapolis?",
            "Hey neighbor! Coffee chat this weekend?"
        ];
        const response = responses[Math.floor(Math.random() * responses.length)];
        addMessage('npc', response);
        
        // Награда
        if (usedChunks.length > 0) {
            gameState.confidence += quest.reward.confidence;
            gameState.coins += quest.reward.coins;
            gameState.usedChunks.forEach(chunk => {
                showAchievement(`Chunk Master: ${chunk}`);
            });
        }
        
        updateStats();
        document.getElementById('message-input').value = '';
    }, 1500);
}

function addMessage(sender, text) {
    const messages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    messageDiv.innerHTML = `<strong>${sender === 'player' ? 'You' : 'Neighbor'}</strong><br>${text}`;
    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;
}

function showAchievement(name) {
    gameState.achievements.push(name);
    const achievements = document.getElementById('achievements');
    const badge = document.createElement('div');
    badge.className = 'achievement';
    badge.textContent = `🏆 ${name}`;
    achievements.appendChild(badge);
}
