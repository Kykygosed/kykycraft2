'use strict';
// ══════════════════════════════════════════════════════════════
//  CHAT  — aucun listener ici, tout est dans input.js
// ══════════════════════════════════════════════════════════════

let chatOpen = false;
const PLAYER_NAME = 'Test';
const chatHistory = [];

// ── Création DOM ──────────────────────────────────────────────
const chatRoot = document.createElement('div');
chatRoot.id = 'chat';
chatRoot.style.cssText =
  'position:fixed;bottom:80px;left:14px;width:min(420px,calc(100vw - 28px));' +
  'z-index:200;font-family:"Press Start 2P",monospace;';
document.body.appendChild(chatRoot);

const chatLog = document.createElement('div');
chatLog.id = 'chat-log';
chatLog.style.cssText =
  'display:none;flex-direction:column;gap:3px;max-height:200px;overflow:hidden;' +
  'padding:6px 8px;background:rgba(0,0,0,0.5);margin-bottom:4px;';
chatRoot.appendChild(chatLog);

const chatBarEl = document.createElement('div');
chatBarEl.style.cssText =
  'display:none;background:rgba(80,80,80,0.9);' +
  'border:1px solid rgba(255,255,255,0.3);padding:5px 8px;align-items:center;';
chatRoot.appendChild(chatBarEl);

const chatInput = document.createElement('input');
chatInput.type        = 'text';
chatInput.maxLength   = 200;
chatInput.autocomplete = 'off';
chatInput.spellcheck  = false;
chatInput.placeholder = 'Message… ( / pour commande)';
chatInput.style.cssText =
  'flex:1;background:rgba(255,255,255,0.12);border:none;outline:none;' +
  'color:#fff;font-family:"Press Start 2P",monospace;font-size:8px;' +
  'padding:4px 6px;caret-color:#fff;width:100%;';
chatBarEl.appendChild(chatInput);

// ── Open / Close ──────────────────────────────────────────────
function openChat() {
  chatOpen = true;
  chatLog.style.display   = 'flex';
  chatBarEl.style.display = 'flex';
  chatInput.value = '';
  renderChatLog();
  document.exitPointerLock?.();
  setTimeout(() => chatInput.focus(), 20);
}

function closeChat() {
  chatOpen = false;
  chatBarEl.style.display = 'none';
  // Laisser le log visible quelques secondes
  clearTimeout(chatRoot._fade);
  chatRoot._fade = setTimeout(() => {
    if (!chatOpen) chatLog.style.display = 'none';
  }, 7000);
}

// ── Rendu ─────────────────────────────────────────────────────
function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function renderChatLog() {
  chatLog.innerHTML = chatHistory.slice(-10)
    .map(m => `<div style="font-size:7px;line-height:1.7;word-break:break-word;
      text-shadow:1px 1px 0 #000;padding:1px 4px;
      color:${m.cls==='msg-err'?'#ff6060':m.cls==='msg-sys'?'#aaddff':m.cls==='msg-cmd'?'#ffe066':'#f0f0f0'}">
      ${esc(m.text)}</div>`).join('');
  chatLog.scrollTop = chatLog.scrollHeight;
}
function addChatMsg(text, cls = 'msg-normal') {
  chatHistory.push({ text, cls });
  if (chatHistory.length > 100) chatHistory.shift();
  renderChatLog();
  // Montrer le log même si chat fermé
  chatLog.style.display = 'flex';
  clearTimeout(chatRoot._fade);
  chatRoot._fade = setTimeout(() => {
    if (!chatOpen) chatLog.style.display = 'none';
  }, 7000);
}

// ── Envoi ─────────────────────────────────────────────────────
function sendChat() {
  const text = chatInput.value.trim();
  closeChat();
  if (!text) return;
  if (text.startsWith('/')) handleCommand(text.slice(1));
  else addChatMsg(`${PLAYER_NAME}: ${text}`, 'msg-normal');
}

// ══════════════════════════════════════════════════════════════
//  COMMANDES
// ══════════════════════════════════════════════════════════════
const COMMANDS = {
  tp: {
    usage: '/tp @s <x> <y> <z>',
    desc:  'Téléporte le joueur aux coordonnées',
    exec(args) {
      if (args.length !== 4 || args[0] !== '@s') return 'syntax';
      const x = parseFloat(args[1]), y = parseFloat(args[2]), z = parseFloat(args[3]);
      if (isNaN(x)||isNaN(y)||isNaN(z)) return 'syntax';
      if (y < Y_MIN || y > Y_MAX) {
        addChatMsg(`Y doit être entre ${Y_MIN} et ${Y_MAX}.`, 'msg-sys'); return null;
      }
      camera.position.set(x+0.5, y+1.8, z+0.5);
      velY = 0;
      addChatMsg(`Téléporté en (${x|0}, ${y|0}, ${z|0})`, 'msg-sys');
      return null;
    }
  },
  help: {
    usage: '/help',
    desc:  'Affiche la liste des commandes',
    exec() {
      addChatMsg('══ Commandes ══', 'msg-sys');
      for (const cmd of Object.values(COMMANDS))
        addChatMsg(`${cmd.usage} — ${cmd.desc}`, 'msg-sys');
      return null;
    }
  }
};

function handleCommand(raw) {
  addChatMsg('/' + raw, 'msg-cmd');
  const parts = raw.trim().split(/\s+/);
  const cmd   = COMMANDS[parts[0].toLowerCase()];
  if (!cmd) { addChatMsg('Commande introuvable. Tapez /help pour la liste.', 'msg-err'); return; }
  if (cmd.exec(parts.slice(1)) === 'syntax')
    addChatMsg('Erreur de syntaxe dans la commande.', 'msg-err');
}

// Listener direct sur l'input (le plus fiable pour capturer les touches)
chatInput.addEventListener('keydown', e => {
  e.stopPropagation(); // ne pas propager vers document
  if (e.key === 'Enter')  { e.preventDefault(); sendChat(); }
  if (e.key === 'Escape') { e.preventDefault(); closeChat(); }
});
