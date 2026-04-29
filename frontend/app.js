/* ═══════════ AETHER · Voice AI Agent · Frontend Logic ═══════════ */

const $ = (sel) => document.querySelector(sel);
const chatContainer = $('#chat-container');
const chatInput = $('#chat-input');
const sendBtn = $('#send-btn');
const voiceBtn = $('#voice-btn');
const listeningIndicator = $('#listening-indicator');
const todoList = $('#todo-list');
const memoryList = $('#memory-list');
const taskCount = $('#task-count');
const memoryCount = $('#memory-count');
const statMemories = $('#stat-memories');
const statTasks = $('#stat-tasks');

// ─── Speech Synthesis (TTS) ───
let selectedVoice = null;
let voicesLoaded = false;

// Known high-quality female voice names across platforms
const PREFERRED_FEMALE_VOICES = [
    'Samantha',           // macOS default female
    'Zoe',                // macOS premium
    'Victoria',           // macOS
    'Karen',              // macOS Australian
    'Moira',              // macOS Irish
    'Tessa',              // macOS South African
    'Google UK English Female',  // Chrome
    'Microsoft Zira',     // Windows
    'Microsoft Hazel',    // Windows UK
];

function selectBestVoice() {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return false;
    
    // Try preferred voices in order
    for (const name of PREFERRED_FEMALE_VOICES) {
        const match = voices.find(v => v.name === name && v.lang.startsWith('en'));
        if (match) {
            selectedVoice = match;
            console.log('[AETHER TTS] Selected voice:', match.name, match.lang);
            voicesLoaded = true;
            return true;
        }
    }
    
    // Fallback: any English female voice
    const anyFemale = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female'));
    if (anyFemale) {
        selectedVoice = anyFemale;
        console.log('[AETHER TTS] Fallback female voice:', anyFemale.name);
        voicesLoaded = true;
        return true;
    }
    
    // Last resort: any English voice
    const anyEnglish = voices.find(v => v.lang.startsWith('en'));
    if (anyEnglish) {
        selectedVoice = anyEnglish;
        console.log('[AETHER TTS] Fallback English voice:', anyEnglish.name);
        voicesLoaded = true;
        return true;
    }
    
    voicesLoaded = true;
    return false;
}

// Load voices — handle both sync and async loading
if (window.speechSynthesis) {
    selectBestVoice();  // Try immediately (works in some browsers)
    window.speechSynthesis.onvoiceschanged = selectBestVoice;  // Async fallback
}

function speak(text) {
    if (!window.speechSynthesis || !text || !text.trim()) return;
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Re-select voice if not yet loaded
    if (!selectedVoice) selectBestVoice();
    if (selectedVoice) utterance.voice = selectedVoice;
    
    utterance.pitch = 1.05;
    utterance.rate = 0.95;  // Slightly slower for natural feel
    utterance.volume = 1.0;
    
    window.speechSynthesis.speak(utterance);
}

const sessionId = "aether_" + Math.random().toString(36).substr(2, 9);
let mediaRecorder, audioChunks = [], isRecording = false;

// ─── Messages ───
function appendMessage(text, isUser = false) {
    const msg = document.createElement('div');
    msg.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
    const icon = isUser ? 'fa-user' : 'fa-atom';
    const name = isUser ? 'You' : 'AETHER';
    msg.innerHTML = `
        <div class="msg-avatar"><i class="fa-solid ${icon}"></i></div>
        <div class="msg-body">
            <div class="msg-name">${name}</div>
            <div class="msg-bubble">${text.replace(/\n/g,'<br>')}</div>
        </div>`;
    chatContainer.appendChild(msg);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function showTyping() {
    const id = "t-" + Date.now();
    const el = document.createElement('div');
    el.id = id; el.className = 'message ai-message';
    el.innerHTML = `<div class="msg-avatar"><i class="fa-solid fa-atom"></i></div>
        <div class="msg-body"><div class="msg-name">AETHER</div>
        <div class="msg-bubble"><i class="fa-solid fa-ellipsis fa-fade"></i> Thinking...</div></div>`;
    chatContainer.appendChild(el);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return id;
}
function hideTyping(id) { const el = document.getElementById(id); if (el) el.remove(); }

function handleResponse(data, tid) {
    hideTyping(tid);
    if (data.success) {
        if (data.text) {
            appendMessage(data.text);
            speak(data.text);
        }
        if (data.tool_calls && data.tool_calls.length > 0) { fetchTodos(); fetchMemories(); }
    } else { appendMessage("Error: " + (data.error || "Unknown error")); }
}

// ─── API: Chat ───
async function sendMessage(text = null) {
    const msg = text || chatInput.value.trim();
    if (!msg) return;
    if (!text) chatInput.value = '';
    appendMessage(msg, true);
    const tid = showTyping();
    try {
        const res = await fetch('/api/chat', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ message: msg, session_id: sessionId })
        });
        handleResponse(await res.json(), tid);
    } catch (e) { hideTyping(tid); appendMessage("Connection error."); }
}

// ─── API: Todos ───
async function fetchTodos() {
    try {
        const todos = await (await fetch('/api/todos')).json();
        taskCount.textContent = todos.length;
        statTasks.textContent = todos.length;
        todoList.innerHTML = '';
        if (!todos.length) { todoList.innerHTML = '<div class="empty-state"><i class="fa-regular fa-circle-check"></i><p>No tasks yet</p></div>'; return; }
        todos.forEach(t => {
            const ic = t.status === 'completed' ? 'fa-circle-check' : 'fa-circle';
            const cl = t.status === 'completed' ? 'var(--success)' : 'var(--warn)';
            todoList.innerHTML += `<div class="todo-item">
                <i class="fa-regular ${ic} todo-icon" style="color:${cl}"></i>
                <div><div class="todo-text">${t.description}</div>
                <span class="todo-status ${t.status}">${t.status}</span></div></div>`;
        });
    } catch(e) { console.error(e); }
}

// ─── API: Memories ───
async function fetchMemories() {
    try {
        const mems = await (await fetch('/api/memories')).json();
        memoryCount.textContent = mems.length;
        statMemories.textContent = mems.length;
        memoryList.innerHTML = '';
        if (!mems.length) { memoryList.innerHTML = '<div class="empty-state"><i class="fa-regular fa-lightbulb"></i><p>No memories stored</p></div>'; return; }
        mems.reverse().forEach(m => {
            const tags = m.tags.map(t => `<span class="mem-tag">${t}</span>`).join('');
            memoryList.innerHTML += `<div class="memory-item">
                <div class="memory-text">${m.content}</div>
                <div class="memory-tags">${tags}</div></div>`;
        });
    } catch(e) { console.error(e); }
}

// ─── Voice ───
async function toggleVoice() { isRecording ? stopRecording() : startRecording(); }

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.onstop = async () => {
            sendVoice(new Blob(audioChunks, { type: 'audio/webm' }));
        };
        mediaRecorder.start();
        isRecording = true;
        voiceBtn.classList.add('active');
        listeningIndicator.classList.remove('hidden');
    } catch (err) { appendMessage("Mic error: " + err.message); }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        voiceBtn.classList.remove('active');
        listeningIndicator.classList.add('hidden');
    }
}

async function sendVoice(blob) {
    const fd = new FormData();
    fd.append('audio', blob, 'rec.webm');
    fd.append('session_id', sessionId);
    const tid = showTyping();
    try {
        const res = await fetch('/api/voice', { method:'POST', body: fd });
        if (!res.ok) throw new Error("Server " + res.status);
        const data = await res.json();
        if (data.transcription) appendMessage(data.transcription, true);
        handleResponse(data, tid);
    } catch (e) { hideTyping(tid); appendMessage("Voice error: " + e.message); }
}

// ─── Audio Engine Unlocker ───
// Browsers block TTS if it fires after an async fetch (user gesture timeout).
// We bypass this by playing a silent utterance immediately on click.
let audioUnlocked = false;
function unlockAudio() {
    if (audioUnlocked || !window.speechSynthesis) return;
    const prime = new SpeechSynthesisUtterance(' ');
    prime.volume = 0;
    prime.rate = 10;
    window.speechSynthesis.speak(prime);
    audioUnlocked = true;
    console.log('[AETHER TTS] Audio engine unlocked permanently for this session.');
}

// ─── Quick Actions ───
document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => { 
        unlockAudio(); 
        sendMessage(btn.dataset.prompt); 
    });
});

// ─── Events ───
sendBtn.addEventListener('click', () => { unlockAudio(); sendMessage(); });
voiceBtn.addEventListener('click', () => { unlockAudio(); toggleVoice(); });
chatInput.addEventListener('keypress', (e) => { 
    if (e.key === 'Enter') { unlockAudio(); sendMessage(); } 
});
$('#clear-chat-btn')?.addEventListener('click', () => {
    unlockAudio();
    chatContainer.innerHTML = '';
    appendMessage("Chat cleared. How can I help?");
});

// ─── Init ───
fetchTodos();
fetchMemories();

// ─── JARVIS Boot Sequence ───
(function bootSequence() {
    const overlay = document.getElementById('boot-overlay');
    const bootText = document.getElementById('boot-text');
    if (!overlay) return;
    const msgs = ['INITIALIZING AETHER...', 'LOADING NEURAL CORE...', 'SYSTEMS ONLINE'];
    let i = 0;
    const iv = setInterval(() => {
        i++;
        if (i < msgs.length) { bootText.textContent = msgs[i]; }
        else { clearInterval(iv); setTimeout(() => overlay.classList.add('fade-out'), 400); }
    }, 800);
})();

// ─── Live HUD Clock ───
(function hudClock() {
    const el = document.getElementById('hud-clock');
    if (!el) return;
    setInterval(() => {
        const now = new Date();
        el.textContent = now.toTimeString().slice(0,8);
    }, 1000);
})();

// ─── Particle System ───
(function particles() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h, pts = [];
    function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
    resize(); window.addEventListener('resize', resize);
    for (let i = 0; i < 50; i++) {
        pts.push({ x: Math.random()*w, y: Math.random()*h, vx: (Math.random()-0.5)*0.3, vy: (Math.random()-0.5)*0.3, r: Math.random()*1.5+0.5 });
    }
    function draw() {
        ctx.clearRect(0,0,w,h);
        for (let i=0;i<pts.length;i++) {
            const p = pts[i];
            p.x += p.vx; p.y += p.vy;
            if (p.x<0||p.x>w) p.vx*=-1;
            if (p.y<0||p.y>h) p.vy*=-1;
            ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
            ctx.fillStyle='rgba(0,240,255,0.4)'; ctx.fill();
            for (let j=i+1;j<pts.length;j++) {
                const q=pts[j], dx=p.x-q.x, dy=p.y-q.y, d=Math.sqrt(dx*dx+dy*dy);
                if (d<120) { ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(q.x,q.y);
                    ctx.strokeStyle=`rgba(0,240,255,${0.15*(1-d/120)})`; ctx.lineWidth=0.5; ctx.stroke(); }
            }
        }
        requestAnimationFrame(draw);
    }
    draw();
})();
