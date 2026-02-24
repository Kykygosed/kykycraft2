'use strict';

// ══════════════════════════════════════════════════════════════
//  CHAT SYSTÈME
//  C = ouvrir/fermer · Entrée = envoyer · Échap = fermer
// ══════════════════════════════════════════════════════════════

let chatOpen = false;
const PLAYER_NAME   = 'Test';
const MAX_HISTORY   = 100;
const SHOW_LINES    = 10;

const chatHistory = []; // { text, cls }

// ── Création DOM ──────────────────────────────────────────────
const chatRoot = document.createElement('div');
chatRoot.id = 'chat';
document.body.appendChild(chatRoot);

const chatLog = document.createElement('div');
chatLog.id = 'chat-log';
chatRoot.appendChild(chatLog);

const chatBar = document.createElement('div');
chatBar.id = 'chat-bar';
chatRoot.appendChild(chatBar);

const chatInput = document.createElement('input');
chatInput.id      = 'chat-input';
chatInput.type    = 'text';
chatInput.maxLength = 200;
chatInput.autocomplete = 'off';
chatInput.spellcheck   = false;
chatInput.placeholder  = 'Message... (/ pour commande)';
chatBar.appendChild(chatInput);

// ── Open / Close ──────────────────────────────────────────────
function openChat() {
  chatOpen = true;
  chatRoot.classList.add('open');
  chatInput.value = '';
  // Petit délai pour éviter que le "C" lui-même soit saisi
  setTimeout(() => chatInput.focus(), 20);
  renderChatLog();
}

function closeChat() {
  chatOpen = false;
  chatRoot.classList.remove('open');
  chatInput.blur();
  // Garder les messages visibles 8s puis fade
  chatRoot.classList.add('recent');
  clearTimeout(chatRoot._fade);
  chatRoot._fade = setTimeout(() => chatRoot.classList.remove('recent'), 8000);
}

// ── Affichage des messages ────────────────────────────────────
function renderChatLog() {
  const lines = chatHistory.slice(-SHOW_LINES);
  chatLog.innerHTML = lines.map(m =>
    `<div class="chat-msg ${m.cls}">${esc(m.text)}</div>`
  ).join('');
  chatLog.scrollTop = chatLog.scrollHeight;
}

function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function addChatMsg(text, cls = 'msg-normal') {
  chatHistory.push({ text, cls });
  if (chatHistory.length > MAX_HISTORY) chatHistory.shift();
  renderChatLog();
  // Flash du log si chat fermé
  if (!chatOpen) {
    chatRoot.classList.add('recent');
    clearTimeout(chatRoot._fade);
    chatRoot._fade = setTimeout(() => chatRoot.classList.remove('recent'), 8000);
  }
}

// ── Envoi ─────────────────────────────────────────────────────
function sendChat() {
  const text = chatInput.value.trim();
  chatInput.value = '';
  closeChat();
  if (!text) return;

  if (text.startsWith('/')) {
    handleCommand(text.slice(1));
  } else {
    addChatMsg(`${PLAYER_NAME}: ${text}`, 'msg-normal');
  }
}

// ══════════════════════════════════════════════════════════════
//  COMMANDES
// ══════════════════════════════════════════════════════════════
const COMMANDS = {
  tp: {
    desc: '/tp @s <x> <y> <z>  —  Téléporte le joueur aux coordonnées',
    exec(args) {
      if (args.length !== 4)   return 'syntax';
      if (args[0] !== '@s')    return 'syntax';
      const x = parseFloat(args[1]);
      const y = parseFloat(args[2]);
      const z = parseFloat(args[3]);
      if (isNaN(x) || isNaN(y) || isNaN(z)) return 'syntax';
      if (y > Y_MAX || y < Y_MIN) {
        addChatMsg(`Système : Y doit être entre ${Y_MIN} et ${Y_MAX}.`, 'msg-sys');
        return null;
      }
      camera.position.set(x + 0.5, y + 1.8, z + 0.5);
      velY = 0;
      addChatMsg(`Système : Téléporté en (${Math.floor(x)}, ${Math.floor(y)}, ${Math.floor(z)})`, 'msg-sys');
      return null;
    }
  },
  help: {
    desc: '/help  —  Affiche la liste des commandes',
    exec(args) {
      addChatMsg('══ Commandes disponibles ══', 'msg-sys');
      for (const [, cmd] of Object.entries(COMMANDS)) {
        addChatMsg(cmd.desc, 'msg-sys');
      }
      return null;
    }
  }
};

function handleCommand(raw) {
  addChatMsg('/' + raw, 'msg-cmd');
  const parts = raw.trim().split(/\s+/);
  const name  = parts[0].toLowerCase();
  const args  = parts.slice(1);
  const cmd   = COMMANDS[name];

  if (!cmd) {
    addChatMsg('Commande introuvable. Tapez /help pour la liste des commandes.', 'msg-err');
    return;
  }
  const result = cmd.exec(args);
  if (result === 'syntax') {
    addChatMsg('Erreur de syntaxe dans la commande.', 'msg-err');
  }
}

// ── Clavier (capture = avant input.js) ───────────────────────
document.addEventListener('keydown', e => {
  if (inventoryOpen) return;

  if (e.code === 'KeyC' && !chatOpen) {
    e.preventDefault();
    e.stopPropagation();
    openChat();
    return;
  }

  if (chatOpen) {
    if (e.code === 'Enter')  { e.preventDefault(); e.stopPropagation(); sendChat(); }
    if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); closeChat(); }
    // Bloquer tout déplacement
    e.stopPropagation();
  }
}, true); // capture phase
