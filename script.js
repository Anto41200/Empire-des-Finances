// ======================================
// EMPIRE DES FINANCES - SCRIPT.JS
// ======================================

// GLOBALS
let player = null;
let capital = 300000;   // patrimoine de départ
let liquidites = 50000; // liquidités initiales
let biens = [];
let entreprises = [];
let tickInterval = null;
let chatUnsub = null;

// DOM
const loginCard = document.getElementById("loginCard");
const playerCard = document.getElementById("playerCard");
const menuCard = document.getElementById("menuCard");
const content = document.getElementById("content");

const emailDisplay = document.getElementById("emailDisplay");
const usernameDisplay = document.getElementById("usernameDisplay");
const capitalDisplay = document.getElementById("capitalDisplay");
const liquiditeDisplay = document.getElementById("liquiditeDisplay");
const nbBiensDisplay = document.getElementById("nbBiensDisplay");
const nbEntreprisesDisplay = document.getElementById("nbEntreprisesDisplay");

// ==============================
// LOGIN
// ==============================
document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("emailInput").value;
  const username = document.getElementById("usernameInput").value || "Joueur";
  if (!email) return alert("Email requis");
  
  player = { email, username };
  await loadPlayer();
  initGame();
});

document.getElementById("googleLoginBtn").addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    player = { email: user.email, username: user.displayName || "Joueur" };
    await loadPlayer();
    initGame();
  } catch (err) {
    alert("Erreur login Google : " + err.message);
  }
});

// ==============================
// LOAD PLAYER
// ==============================
async function loadPlayer() {
  const docRef = window.db.collection("players").doc(player.email);
  const docSnap = await docRef.get();
  if (docSnap.exists) {
    const data = docSnap.data();
    capital = data.capital || 300000;
    liquidites = data.liquidites || 50000;
    biens = data.biens || [];
    entreprises = data.entreprises || [];
  } else {
    // créer nouveau joueur
    await docRef.set({ capital, liquidites, biens, entreprises });
  }
}

// ==============================
// INIT GAME
// ==============================
function initGame() {
  loginCard.classList.add("hidden");
  playerCard.classList.remove("hidden");
  menuCard.classList.remove("hidden");
  content.classList.remove("hidden");

  updatePlayerCard();
  startTicks();
  startChat();
}

// ==============================
// UPDATE UI
// ==============================
function updatePlayerCard() {
  emailDisplay.textContent = player.email;
  usernameDisplay.textContent = player.username;
  capitalDisplay.textContent = capital.toLocaleString();
  liquiditeDisplay.textContent = liquidites.toLocaleString();
  nbBiensDisplay.textContent = biens.length;
  nbEntreprisesDisplay.textContent = entreprises.length;
}

// ==============================
// NAVIGATION
// ==============================
function showAccueil() {
  content.innerHTML = `<h2>Accueil</h2><p>Bienvenue ${player.username} !</p>`;
}
function showProprietes() {
  renderBiens();
}
function showEntreprises() {
  renderEntreprises();
}
function showBanque() {
  content.innerHTML = `<h2>Banque</h2><p>Liquidités : ${liquidites.toLocaleString()} €</p>`;
}
function showFinances() {
  content.innerHTML = `<h2>Finances</h2><p>Capital total : ${capital.toLocaleString()} €</p>`;
}
function showDemocratie() {
  content.innerHTML = `<h2>Démocratie</h2><p>Page vide pour l'instant.</p>`;
}
function showOptions() {
  content.innerHTML = `<h2>Options</h2><p>Paramètres langue / devise etc.</p>`;
}
function showChat() {
  content.innerHTML = `<h2>Chat</h2>
    <div id="chatBox" style="height:300px;overflow:auto;border:1px solid #aaa;padding:5px;"></div>
    <input id="chatInput" type="text" placeholder="Tapez un message"/>
    <button class="btn" onclick="sendChat()">Envoyer</button>`;
}

// ==============================
// TICKS
// ==============================
function startTicks() {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(() => {
    // mise à jour temps réel, intérêts, événements aléatoires...
    // pour exemple simple, ajout 0.1% liquidités par tick
    liquidites *= 1.001;
    updatePlayerCard();
    savePlayer();
  }, 5000);
}

// ==============================
// SAVE PLAYER
// ==============================
async function savePlayer() {
  await window.db.collection("players").doc(player.email).set({
    capital, liquidites, biens, entreprises
  }, { merge: true });
}

// ==============================
// LOGOUT
// ==============================
function logout() {
  player = null;
  loginCard.classList.remove("hidden");
  playerCard.classList.add("hidden");
  menuCard.classList.add("hidden");
  content.classList.add("hidden");
}

// ==============================
// BIENS
// ==============================
const BIENS_DISPONIBLES = [
  { nom: "Appartement", prix: 100000 },
  { nom: "Maison", prix: 200000 },
  { nom: "Villa", prix: 500000 },
  { nom: "Loft", prix: 300000 },
  { nom: "Manoir", prix: 800000 },
  { nom: "Château", prix: 5000000 }
];

function renderBiens() {
  let html = `<h2>Propriétés</h2>`;
  html += `<div class="grid">`;
  BIENS_DISPONIBLES.forEach(b => {
    html += `<div class="card">
      <h3>${b.nom}</h3>
      <p>Prix : ${b.prix.toLocaleString()} €</p>
      <button class="btn" onclick="acheterBien('${b.nom}')">Acheter</button>
      ${b.nom === "Château" ? '<button class="btn" onclick="ouvrirTourisme()">Mettre en tourisme</button>' : ''}
    </div>`;
  });
  html += `</div>`;
  html += `<h3>Mes biens :</h3><ul>`;
  biens.forEach(b => html += `<li>${b.nom}</li>`);
  html += `</ul>`;
  content.innerHTML = html;
}

function acheterBien(nom) {
  const bien = BIENS_DISPONIBLES.find(b => b.nom === nom);
  if (!bien) return;
  if (liquidites < bien.prix) return alert("Pas assez de liquidités !");
  liquidites -= bien.prix;
  biens.push({ nom, date: Date.now() });
  updatePlayerCard();
  renderBiens();
  savePlayer();
}

// ==============================
// ENTREPRISES
// ==============================
const ENTREPRISES_DISPONIBLES = [
  { type: "Agriculture", prix: 200000 },
  { type: "Commerce", prix: 150000 },
  { type: "Services", prix: 100000 }
];

function renderEntreprises() {
  let html = `<h2>Entreprises</h2>`;
  html += `<div class="grid">`;
  ENTREPRISES_DISPONIBLES.forEach(e => {
    html += `<div class="card">
      <h3>${e.type}</h3>
      <p>Prix : ${e.prix.toLocaleString()} €</p>
      <button class="btn" onclick="acheterEntreprise('${e.type}')">Acheter</button>
    </div>`;
  });
  html += `</div>`;

  html += `<h3>Mes entreprises :</h3><ul>`;
  entreprises.forEach((e, i) => {
    html += `<li>${e.type} - <button class="btn small" onclick="dissoudreEntreprise(${i})">Dissoudre</button></li>`;
  });
  html += `</ul>`;
  content.innerHTML = html;
}

function acheterEntreprise(type) {
  const ent = ENTREPRISES_DISPONIBLES.find(e => e.type === type);
  if (!ent) return;
  if (liquidites < ent.prix) return alert("Pas assez de liquidités !");
  liquidites -= ent.prix;
  entreprises.push({ type, date: Date.now() });
  updatePlayerCard();
  renderEntreprises();
  savePlayer();
}

function dissoudreEntreprise(index) {
  if (!confirm("Voulez-vous vraiment dissoudre cette entreprise ?")) return;
  entreprises.splice(index, 1);
  updatePlayerCard();
  renderEntreprises();
  savePlayer();
}

// ==============================
// CHAT
// ==============================
async function startChat() {
  const chatBox = document.getElementById("chatBox");
  if (!chatBox) return;

  const chatRef = window.db.collection("chat").orderBy("timestamp", "asc");

  if (chatUnsub) chatUnsub(); // unsubscribe previous
  chatUnsub = chatRef.onSnapshot(snapshot => {
    chatBox.innerHTML = "";
    snapshot.forEach(doc => {
      const data = doc.data();
      chatBox.innerHTML += `<p><b>${data.username}:</b> ${data.message}</p>`;
    });
    chatBox.scrollTop = chatBox.scrollHeight;
  });
}

async function sendChat() {
  const input = document.getElementById("chatInput");
  if (!input.value.trim()) return;
  await window.db.collection("chat").add({
    username: player.username,
    message: input.value.trim(),
    timestamp: Date.now()
  });
  input.value = "";
}


// ================= EXPORT GLOBAL =================
window.loginEmail=loginEmail;
window.loginGoogle=loginGoogle;
window.showProprietes=showProprietes;
window.showEntreprises=showEntreprises;
window.showBanque=showBanque;
window.showDemocratie=showDemocratie;
window.acheterBien=acheterBien;
window.louerBien=louerBien;
window.vendreBien=vendreBien;
window.embellirBien=embellirBien;
window.nettoyerBien=nettoyerBien;
window.organiserTourisme=organiserTourisme;
window.acheterEntreprise=acheterEntreprise;
window.extractOil=extractOil;
window.takeLoan=takeLoan;
window.repayLoan=repayLoan;
window.sendMessage=sendMessage;
window.logout=logout;

// ================= START =================
applyElapsedTicks();
