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
const quests = {
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
