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
        appendMessage(data.text);
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

// ─── Quick Actions ───
document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => sendMessage(btn.dataset.prompt));
});

// ─── Events ───
sendBtn.addEventListener('click', () => sendMessage());
voiceBtn.addEventListener('click', toggleVoice);
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
$('#clear-chat-btn')?.addEventListener('click', () => {
    chatContainer.innerHTML = '';
    appendMessage("Chat cleared. How can I help?");
});

// ─── Init ───
fetchTodos();
fetchMemories();
