/******************************************************************
 * EMPIRE DES FINANCES — SCRIPT.JS COMPLET
 * BLOC 1/5 — CONST, INIT, PLAYER SYSTEM
 ******************************************************************/

import { 
    doc, setDoc, getDoc, collection, addDoc, onSnapshot, getDocs 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

import { 
    signInWithPopup, GoogleAuthProvider 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

/***************************************************************
 * CONSTANTES ET CONFIG
 ***************************************************************/
const TICK_INTERVAL = 5000; // 5 sec
const LOYER_INTERVAL = 4 * 60 * 60 * 1000; // 4h
const IMPOTS_INTERVAL = 24 * 60 * 60 * 1000; // 24h
const EVENEMENT_INTERVAL = 8 * 60 * 60 * 1000; // 8h

const biensList = [
    "Appartement", "Maison", "Villa", "Loft", 
    "Manoir", "Château", "Terrain constructible"
];

const basePrices = {
    "Appartement": 80000,
    "Maison": 150000,
    "Villa": 300000,
    "Loft": 250000,
    "Manoir": 600000,
    "Château": 2000000,
    "Terrain constructible": 120000
};

const loyersList = {
    "Appartement": 700,
    "Maison": 1200,
    "Villa": 2500,
    "Loft": 1700,
    "Manoir": 4500,
    "Château": 8000,
    "Terrain constructible": 0
};

const defaultPlayerData = {
    username: "",
    capital: 300000,
    liquidite: 50000,
    biens: [],
    entreprises: [],
    dettes: [],
    historique: [],
    reputation: 50, // 0-100
    niveau: 1,
    xp: 0,
    lastLoyer: Date.now(),
    lastImpots: Date.now(),
    lastEvenement: Date.now(),
    lastTick: Date.now()
};

/***************************************************************
 * UI ELEMENTS
 ***************************************************************/
const loginCard = document.getElementById("loginCard");
const playerCard = document.getElementById("playerCard");
const content = document.getElementById("content");
const proprietesPage = document.getElementById("proprietesPage");

const emailInput = document.getElementById("emailInput");
const usernameInput = document.getElementById("usernameInput");
const loginBtn = document.getElementById("loginBtn");
const googleLoginBtn = document.getElementById("googleLoginBtn");

const emailDisplay = document.getElementById("emailDisplay");
const usernameDisplay = document.getElementById("usernameDisplay");
const capitalDisplay = document.getElementById("capitalDisplay");
const liquiditeDisplay = document.getElementById("liquiditeDisplay");
const nbBiensDisplay = document.getElementById("nbBiensDisplay");
const nbEntreprisesDisplay = document.getElementById("nbEntreprisesDisplay");
const reputationDisplay = document.getElementById("reputationDisplay");
const niveauDisplay = document.getElementById("niveauDisplay");

/***************************************************************
 * PLAYER DATA
 ***************************************************************/
let currentPlayer = null;
let playerData = null;

/***************************************************************
 * LOGIN FUNCTIONS
 ***************************************************************/
loginBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const username = usernameInput.value.trim() || "Joueur";

    if (!email) {
        alert("Email requis !");
        return;
    }
    currentPlayer = email;
    await loadPlayer(email, username);
});

googleLoginBtn.addEventListener("click", async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(window.auth, provider);
    const email = result.user.email;
    const username = result.user.displayName || "Joueur Google";
    currentPlayer = email;
    await loadPlayer(email, username);
});

/***************************************************************
 * LOAD PLAYER
 ***************************************************************/
async function loadPlayer(email, username) {
    const docRef = doc(window.db, "players", email);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        await setDoc(docRef, { ...defaultPlayerData, username });
        playerData = { ...defaultPlayerData, username };
    } else {
        playerData = docSnap.data();
    }

    updateUI();
}

/***************************************************************
 * UPDATE UI
 ***************************************************************/
function updateUI() {
    loginCard.classList.add("hidden");
    playerCard.classList.remove("hidden");
    content.classList.remove("hidden");

    emailDisplay.textContent = currentPlayer;
    usernameDisplay.textContent = playerData.username;
    capitalDisplay.textContent = playerData.capital.toLocaleString();
    liquiditeDisplay.textContent = playerData.liquidite.toLocaleString();
    nbBiensDisplay.textContent = playerData.biens.length;
    nbEntreprisesDisplay.textContent = playerData.entreprises.length;

    if(reputationDisplay) reputationDisplay.textContent = playerData.reputation;
    if(niveauDisplay) niveauDisplay.textContent = playerData.niveau;
}

/***************************************************************
 * LOGOUT
 ***************************************************************/
function logout() {
    currentPlayer = null;
    playerData = null;
    loginCard.classList.remove("hidden");
    playerCard.classList.add("hidden");
    content.classList.add("hidden");
}
window.logout = logout;
/******************************************************************
 * EMPIRE DES FINANCES — SCRIPT.JS COMPLET
 * BLOC 2/5 — NAVIGATION, PROPRIÉTÉS, MARCHÉ DYNAMIQUE
 ******************************************************************/

/***************************************************************
 * NAVIGATION PRINCIPALE
 ***************************************************************/
window.showAccueil = () => {
    proprietesPage?.classList.add("hidden");
    content.innerHTML = `
        <h2>🏡 Accueil</h2>
        <p>Bienvenue ${playerData?.username || ""}! Le temps avance automatiquement. Événements, impôts, loyers et intérêts fonctionnent même hors connexion.</p>
        <p>Votre réputation actuelle : ${playerData?.reputation || 50}</p>
    `;
};

window.showProprietes = () => {
    content.innerHTML = "";
    proprietesPage?.classList.remove("hidden");
    showAcheter();
};

window.showEntreprises = () => {
    proprietesPage?.classList.add("hidden");
    content.innerHTML = "<h2>🏢 Entreprises</h2><p>Fonctionnalité à venir...</p>";
};

window.showBanque = () => {
    proprietesPage?.classList.add("hidden");
    renderBanque();
};

window.showDemocratie = () => {
    proprietesPage?.classList.add("hidden");
    content.innerHTML = "<h2>⚖️ Démocratie</h2><p>Fonctionnalité bientôt disponible.</p>";
};

window.showChat = () => {
    proprietesPage?.classList.add("hidden");
    renderChat();
};

/***************************************************************
 * PROPRIÉTÉS — ACHETER / GÉRER
 ***************************************************************/
window.showAcheter = () => {
    document.getElementById("acheterSection")?.classList.remove("hidden");
    document.getElementById("gererSection")?.classList.add("hidden");
    renderAcheterBiens();
};

window.showGerer = () => {
    document.getElementById("gererSection")?.classList.remove("hidden");
    document.getElementById("acheterSection")?.classList.add("hidden");
    renderGererBiens();
};

/***************************************************************
 * CALCUL DES PRIX ET LOYERS
 ***************************************************************/
function calculerPrix(bien) {
    const base = basePrices[bien] || 100000;
    const fluct = 1 + (Math.random() * 0.3 - 0.15); // -15% à +15%
    return Math.floor(base * fluct);
}

function calculerLoyer(bien) {
    return loyersList[bien] || 0;
}

/***************************************************************
 * APPLICATION DES LOYERS
 ***************************************************************/
function appliquerLoyers() {
    if (!playerData) return;
    const now = Date.now();
    if (now - playerData.lastLoyer < LOYER_INTERVAL) return;

    let total = 0;
    playerData.biens.forEach(b => total += calculerLoyer(b.type));
    playerData.liquidite += total;
    playerData.lastLoyer = now;
    savePlayer();
}

/***************************************************************
 * APPLICATION DES IMPÔTS
 ***************************************************************/
function appliquerImpots() {
    if (!playerData) return;
    const now = Date.now();
    if (now - playerData.lastImpots < IMPOTS_INTERVAL) return;

    const impot = Math.floor(playerData.capital * 0.02);
    playerData.liquidite -= impot;
    playerData.lastImpots = now;
    savePlayer();
}

/***************************************************************
 * ÉVÉNEMENTS ALÉATOIRES
 ***************************************************************/
function evenementAleatoire() {
    if (!playerData) return;
    const now = Date.now();
    if (now - playerData.lastEvenement < EVENEMENT_INTERVAL) return;

    const chance = Math.random();

    // Catastrophe 20%
    if (chance < 0.2) {
        if (playerData.biens.length > 0) {
            const index = Math.floor(Math.random() * playerData.biens.length);
            playerData.liquidite -= 5000;
            alert("🌪️ Catastrophe ! Une réparation coûte 5 000 §");
        }
    }
    // Événement positif 20%
    else if (chance < 0.4) {
        const gain = Math.floor(5000 + Math.random() * 20000);
        playerData.liquidite += gain;
        alert("🎁 Événement positif ! Vous gagnez " + gain + " §");
    }

    playerData.lastEvenement = now;
    savePlayer();
}

/***************************************************************
 * RENDER ACHETER BIENS
 ***************************************************************/
function renderAcheterBiens() {
    if (!playerData) return;
    let html = "<div class='grid'>";
    biensList.forEach(b => {
        const prix = calculerPrix(b);
        html += `
            <div class="card">
                <h3>${b}</h3>
                <p>Prix : ${prix.toLocaleString()} §</p>
                <button class="btn" onclick="acheterBien('${b}', ${prix})">Acheter</button>
            </div>`;
    });
    html += "</div>";
    document.getElementById("acheterSection")!.innerHTML = html;
}

/***************************************************************
 * ACHETER UN BIEN
 ***************************************************************/
window.acheterBien = (bien, prix) => {
    if (!playerData) return;
    if (playerData.liquidite < prix) return alert("Fonds insuffisants !");
    playerData.liquidite -= prix;
    playerData.biens.push({ type: bien, date: new Date().toISOString() });
    savePlayer();
    updateUI();
    renderAcheterBiens();
};

/***************************************************************
 * RENDER GÉRER BIENS
 ***************************************************************/
function renderGererBiens() {
    if (!playerData) return;
    let html = "<div class='grid'>";
    playerData.biens.forEach((b, i) => {
        html += `
            <div class="card">
                <h3>${b.type}</h3>
                <p>Depuis le : ${new Date(b.date).toLocaleDateString()}</p>

                ${b.type === "Terrain constructible" && !b.construction ? `
                    <button class="btn" onclick="construire(${i})">Construire dessus</button>
                ` : ""}

                <button class="btn alt" onclick="vendreBien(${i})">Vendre</button>
            </div>`;
    });
    html += "</div>";
    document.getElementById("gererSection")!.innerHTML = html;
}

/***************************************************************
 * CONSTRUIRE SUR TERRAIN
 ***************************************************************/
window.construire = (index) => {
    if (!playerData) return;
    const choix = prompt("Que construire ? Ex : Maison, Villa, Loft…");
    if (!choix) return;
    playerData.biens[index].construction = choix;
    savePlayer();
    renderGererBiens();
};

/***************************************************************
 * VENDRE UN BIEN
 ***************************************************************/
window.vendreBien = (index) => {
    if (!playerData) return;
    playerData.biens.splice(index, 1);
    savePlayer();
    renderGererBiens();
};
/******************************************************************
 * EMPIRE DES FINANCES — SCRIPT.JS COMPLET
 * BLOC 3/5 — BANQUE, EMPRUNTS, PLACEMENTS, BOURSE
 ******************************************************************/

/***************************************************************
 * RENDER BANQUE
 ***************************************************************/
function renderBanque() {
    if (!playerData) return;
    content.innerHTML = `
        <h2>🏦 Banque</h2>
        <p>Liquidité : ${playerData.liquidite.toLocaleString()} §</p>
        <p>Capital total : ${playerData.capital.toLocaleString()} §</p>
        <button class="btn" onclick="ouvrirPret()">💰 Faire un emprunt</button>
        <button class="btn alt" onclick="investirBourse()">📈 Investir en Bourse</button>

        <h3>Mes dettes</h3>
    `;

    playerData.dettes.forEach((d, i) => {
        content.innerHTML += `
            <div class="card">
                <p>Montant restant : ${d.restant.toLocaleString()} §</p>
                <p>Mensualité : ${d.mensualite.toLocaleString()} §</p>
                <button class="btn alt" onclick="rembourser(${i})">Rembourser 1 mensualité</button>
            </div>`;
    });
}

/***************************************************************
 * OUVRIR UN PRÊT
 ***************************************************************/
window.ouvrirPret = () => {
    if (!playerData) return;
    const montant = parseInt(prompt("Montant du prêt ?"), 10);
    if (!montant) return;
    const interet = 1.05; // 5%
    const mensualite = Math.floor(montant * interet / 10); // remboursé en 10 fois
    playerData.liquidite += montant;
    playerData.dettes.push({ restant: Math.floor(montant * interet), mensualite });
    savePlayer();
    renderBanque();
};

/***************************************************************
 * REMBOURSER UN PRÊT
 ***************************************************************/
window.rembourser = (index) => {
    if (!playerData) return;
    const dette = playerData.dettes[index];
    if (playerData.liquidite < dette.mensualite) return alert("Pas assez d'argent !");
    playerData.liquidite -= dette.mensualite;
    dette.restant -= dette.mensualite;
    if (dette.restant <= 0) playerData.dettes.splice(index, 1);
    savePlayer();
    renderBanque();
};

/***************************************************************
 * BOURSE — INVESTISSEMENTS
 ***************************************************************/
const actions = [
    { name: "TechCorp", prix: 100, evolution: 0 },
    { name: "AgriPlus", prix: 80, evolution: 0 },
    { name: "ImmobilierX", prix: 200, evolution: 0 },
    { name: "Energia", prix: 150, evolution: 0 }
];

window.investirBourse = () => {
    if (!playerData) return;
    let html = "<h3>📈 Bourse</h3><div class='grid'>";
    actions.forEach((a, i) => {
        html += `
            <div class="card">
                <h4>${a.name}</h4>
                <p>Prix : ${a.prix} §</p>
                <p>Évolution : ${a.evolution.toFixed(2)}%</p>
                <button class="btn" onclick="acheterAction(${i})">Acheter</button>
            </div>`;
    });
    html += "</div>";
    content.innerHTML = html;
};

/***************************************************************
 * ACHETER UNE ACTION
 ***************************************************************/
window.acheterAction = (index) => {
    if (!playerData) return;
    const action = actions[index];
    if (playerData.liquidite < action.prix) return alert("Pas assez de liquidités !");
    playerData.liquidite -= action.prix;
    if (!playerData.portefeuille) playerData.portefeuille = [];
    playerData.portefeuille.push({ name: action.name, prixAchat: action.prix });
    savePlayer();
    investirBourse();
};

/***************************************************************
 * MISE À JOUR DE LA BOURSE
 ***************************************************************/
function evolutionBourse() {
    actions.forEach(a => {
        const change = (Math.random() * 10 - 5); // -5% à +5%
        a.evolution = change;
        a.prix = Math.max(1, Math.floor(a.prix * (1 + change / 100)));
    });

    // Mise à jour du portefeuille du joueur
    if (playerData?.portefeuille) {
        playerData.portefeuille.forEach(p => {
            const action = actions.find(a => a.name === p.name);
            if (action) p.valeur = action.prix;
        });
    }
}

/***************************************************************
 * DIVIDENDES ET GAINS
 ***************************************************************/
function distribuerDividendes() {
    if (!playerData || !playerData.portefeuille) return;
    let total = 0;
    playerData.portefeuille.forEach(p => {
        total += Math.floor(Math.random() * 50); // gains aléatoires
    });
    playerData.liquidite += total;
    if (total > 0) alert(`💰 Dividendes reçus : ${total} §`);
}

/***************************************************************
 * INTERVALS AUTOMATIQUES
 ***************************************************************/
setInterval(() => {
    evolutionBourse();
    distribuerDividendes();
}, 15000); // toutes les 15 secondes
/******************************************************************
 * EMPIRE DES FINANCES — SCRIPT.JS COMPLET
 * BLOC 4/5 — CHAT GLOBAL, EVENEMENTS, HISTORIQUE, MISSIONS
 ******************************************************************/

/***************************************************************
 * CHAT GLOBAL
 ***************************************************************/
function renderChat() {
    if (!playerData) return;
    content.innerHTML = `
        <h2>💬 Chat Global</h2>
        <div id="chatContainer">
            <div id="chatMessages"></div>
            <div id="chatInput">
                <input id="chatMsg" type="text" placeholder="Message...">
                <button class="btn" onclick="sendMessage()">Envoyer</button>
            </div>
        </div>
    `;

    const chatRef = collection(window.db, "chat");
    const chatMessages = document.getElementById("chatMessages");

    onSnapshot(chatRef, snap => {
        chatMessages.innerHTML = "";
        snap.docs.forEach(d => {
            const msg = d.data();
            chatMessages.innerHTML += `<p><b>${msg.username}:</b> ${msg.message}</p>`;
        });
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

window.sendMessage = async () => {
    const msgInput = document.getElementById("chatMsg");
    if (!msgInput.value.trim() || !playerData) return;
    await addDoc(collection(window.db, "chat"), {
        username: playerData.username,
        message: msgInput.value.trim(),
        timestamp: new Date().toISOString()
    });
    msgInput.value = "";
};

/***************************************************************
 * EVENEMENTS SPECIAUX
 ***************************************************************/
function evenementAleatoire() {
    if (!playerData) return;
    const now = Date.now();
    const eightHours = 8 * 60 * 60 * 1000;
    if (now - playerData.lastEvenement < eightHours) return;

    const chance = Math.random();

    // Catastrophes 20%
    if (chance < 0.2 && playerData.biens.length > 0) {
        const index = Math.floor(Math.random() * playerData.biens.length);
        const perte = 5000 + Math.floor(Math.random() * 10000);
        playerData.liquidite -= perte;
        alert(`🌪️ Catastrophe ! Réparation de ${perte} § nécessaire sur votre bien.`);
    }
    // Bonus aléatoires 20%
    else if (chance < 0.4) {
        const gain = 5000 + Math.floor(Math.random() * 20000);
        playerData.liquidite += gain;
        alert(`🎁 Événement positif ! Vous gagnez ${gain} §`);
    }
    // Mission spéciale 10%
    else if (chance < 0.5) {
        const missionGain = 10000 + Math.floor(Math.random() * 20000);
        alert(`🏆 Mission spéciale ! Terminez votre prochaine action pour gagner ${missionGain} §`);
        if (!playerData.missions) playerData.missions = [];
        playerData.missions.push({ type: "bonus", gain: missionGain, completed: false });
    }

    playerData.lastEvenement = now;
    savePlayer();
}

/***************************************************************
 * HISTORIQUE DES ACTIONS
 ***************************************************************/
function addHistorique(action) {
    if (!playerData) return;
    if (!playerData.historique) playerData.historique = [];
    playerData.historique.push({ action, date: new Date().toISOString() });
    if (playerData.historique.length > 50) playerData.historique.shift();
    savePlayer();
}

/***************************************************************
 * RENDER HISTORIQUE
 ***************************************************************/
window.showHistorique = () => {
    if (!playerData) return;
    content.innerHTML = "<h2>📜 Historique</h2><div class='grid'>";
    playerData.historique.forEach(h => {
        content.innerHTML += `
            <div class="card">
                <p>${h.action}</p>
                <p><small>${new Date(h.date).toLocaleString()}</small></p>
            </div>`;
    });
    content.innerHTML += "</div>";
};

/***************************************************************
 * MISSIONS
 ***************************************************************/
function verifierMissions() {
    if (!playerData?.missions) return;
    playerData.missions.forEach((m, i) => {
        if (!m.completed) {
            playerData.liquidite += m.gain;
            alert(`🏅 Mission accomplie ! Vous gagnez ${m.gain} §`);
            m.completed = true;
            addHistorique(`Mission complétée : gain ${m.gain} §`);
        }
    });
    savePlayer();
}

/***************************************************************
 * CHECK MISSION ON ACTIONS
 ***************************************************************/
function actionEffectuee(type, montant = 0) {
    if (!playerData) return;
    verifierMissions();
    addHistorique(`Action : ${type}${montant ? ` — ${montant} §` : ""}`);
    updateUI();
}
/******************************************************************
 * EMPIRE DES FINANCES — SCRIPT.JS COMPLET
 * BLOC 5/5 — TICK AUTOMATIQUE, SAUVEGARDE, NOTIFICATIONS
 ******************************************************************/

/***************************************************************
 * SAUVEGARDE AUTOMATIQUE
 ***************************************************************/
async function savePlayer() {
    if (!currentPlayer || !playerData) return;
    try {
        await setDoc(doc(window.db, "players", currentPlayer), playerData);
    } catch (err) {
        console.error("Erreur sauvegarde :", err);
    }
}

/***************************************************************
 * MISE À JOUR UI GLOBALE
 ***************************************************************/
function updateUI() {
    if (!playerData) return;
    loginCard.classList.add("hidden");
    playerCard.classList.remove("hidden");
    content.classList.remove("hidden");

    emailDisplay.textContent = currentPlayer || "";
    usernameDisplay.textContent = playerData.username || "Joueur";
    capitalDisplay.textContent = playerData.capital.toLocaleString();
    liquiditeDisplay.textContent = playerData.liquidite.toLocaleString();
    nbBiensDisplay.textContent = playerData.biens.length;
    nbEntreprisesDisplay.textContent = playerData.entreprises.length;
}

/***************************************************************
 * LOGOUT
 ***************************************************************/
function logout() {
    currentPlayer = null;
    playerData = null;
    loginCard.classList.remove("hidden");
    playerCard.classList.add("hidden");
    content.classList.add("hidden");
}
window.logout = logout;

/***************************************************************
 * TICK AUTOMATIQUE
 ***************************************************************/
function tick() {
    if (!playerData) return;
    appliquerLoyers();
    appliquerImpots();
    evenementAleatoire();
    evolutionBourse();
    distribuerDividendes();
    verifierMissions();
    savePlayer();
    updateUI();
}

/***************************************************************
 * INTERVALLE DE TICK
 ***************************************************************/
setInterval(tick, 5000); // toutes les 5 secondes

/***************************************************************
 * INITIALISATION
 ***************************************************************/
window.onload = () => {
    // Précharge l'UI si joueur déjà connecté
    if (currentPlayer && playerData) updateUI();
};

/***************************************************************
 * NOTIFICATIONS SIMPLES
 ***************************************************************/
function notify(msg) {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
        new Notification("Empire des Finances", { body: msg });
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                new Notification("Empire des Finances", { body: msg });
            }
        });
    }
}

/***************************************************************
 * EXEMPLE D'UTILISATION NOTIFICATION
 ***************************************************************/
function notifLoyer() {
    const totalLoyer = playerData?.biens.reduce((sum, b) => sum + calculerLoyer(b.type), 0) || 0;
    if (totalLoyer > 0) notify(`🏠 Loyers perçus : ${totalLoyer} §`);
}

/***************************************************************
 * RESET JOURNALIER (optionnel)
 ***************************************************************/
function resetJournalier() {
    if (!playerData) return;
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    if (!playerData.lastReset || now - playerData.lastReset > day) {
        playerData.lastReset = now;
        // Par exemple : remises, bonus journaliers
        const bonus = 1000;
        playerData.liquidite += bonus;
        notify(`💵 Bonus journalier : ${bonus} §`);
        savePlayer();
    }
}

/***************************************************************
 * OPTIMISATIONS & CLEANUPS
 ***************************************************************/
function cleanPortefeuille() {
    if (!playerData?.portefeuille) return;
    playerData.portefeuille = playerData.portefeuille.filter(p => p.valeur && p.valeur > 0);
}

/***************************************************************
 * FINALISATION
 ***************************************************************/
console.log("Empire des Finances — Script chargé et prêt !");
