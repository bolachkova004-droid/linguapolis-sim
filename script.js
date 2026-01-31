const chars = [
    { id: 'techie', name: 'Alex Code', desc: 'Tech Enthusiast', confidence: 30, vocab: 40, color: '#4f46e5' },
    { id: 'creative', name: 'Mia Design', desc: 'Creative Soul', confidence: 50, vocab: 20, color: '#ec4899' },
    { id: 'pro', name: 'James Corp', desc: 'Business Pro', confidence: 40, vocab: 30, color: '#10b981' }
];

document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('char-grid');
    chars.forEach(c => {
        const btn = document.createElement('div');
        btn.className = 'char-btn';
        btn.innerHTML = `<div style="width:50px; height:50px; background:${c.color}; border-radius:50%; margin: 0 auto 10px;"></div><strong>${c.name}</strong><br><small>${c.desc}</small>`;
        btn.onclick = () => startGame(c);
        grid.appendChild(btn);
    });
});

function startGame(character) {
    document.getElementById('char-selection-overlay').style.display = 'none';
    document.getElementById('main-ui').style.display = 'grid';
    
    document.getElementById('player-name').innerText = character.name;
    document.getElementById('player-desc').innerText = character.desc;
    document.getElementById('bar-confidence').style.width = character.confidence + '%';
    document.getElementById('bar-vocab').style.width = character.vocab + '%';
    
    loadQuest();
}

function loadQuest() {
    const content = document.getElementById('quest-content');
    content.innerHTML = `
        <p>Introduce yourself to neighbors using "Low-key"</p>
        <textarea id="msg-input" placeholder="Type here..."></textarea>
        <button onclick="sendMsg()">Send</button>
    `;
}

function sendMsg() {
    const val = document.getElementById('msg-input').value;
    if(!val) return;
    
    const box = document.getElementById('chat-box');
    box.innerHTML += `<div class="bubble player">${val}</div>`;
    
    setTimeout(() => {
        box.innerHTML += `<div class="bubble npc">Welcome! Happy to have you here.</div>`;
        if(val.toLowerCase().includes('low-key')) {
            alert('Quest Complete! Confidence Boosted!');
        }
    }, 1000);
}
