/******************************************************************
 *  EMPIRE DES FINANCES — SCRIPT.JS COMPLET
 *  Version : ULTRA ÉVOLUÉE + TERRAINS + IMPÔTS + ÉVÉNEMENTS + BANQUE
 ******************************************************************/

import {
    doc, setDoc, getDoc, collection, addDoc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

import { signInWithPopup } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

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

/***************************************************************
 * PLAYER DATA
 ***************************************************************/
let currentPlayer = null;
let playerData = null;

// Default player structure
const defaultPlayerData = {
    username: "",
    capital: 300000,
    liquidite: 50000,
    biens: [],
    entreprises: [],
    dettes: [],
    historique: [],
    timestamp: new Date().toISOString(),
    lastLoyer: Date.now(),
    lastImpots: Date.now(),
    lastEvenement: Date.now(),
};

/***************************************************************
 * LOGIN
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
    const provider = new window.GoogleAuthProvider();
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
 * NAVIGATION
 ***************************************************************/
window.showAccueil = () => {
    proprietesPage.classList.add("hidden");
    content.innerHTML = `
        <h2>Accueil</h2>
        <p>Bienvenue ! Le temps avance automatiquement. Événements, impôts, loyers 
        et intérêts fonctionnent même hors connexion.</p>
    `;
};

window.showProprietes = () => {
    content.innerHTML = "";
    proprietesPage.classList.remove("hidden");
    showAcheter();
};

window.showEntreprises = () => {
    proprietesPage.classList.add("hidden");
    content.innerHTML = "<h2>Entreprises</h2><p>À venir.</p>";
};

window.showBanque = () => {
    proprietesPage.classList.add("hidden");
    renderBanque();
};

window.showDemocratie = () => {
    proprietesPage.classList.add("hidden");
    content.innerHTML = "<h2>Démocratie</h2><p>Bientôt disponible.</p>";
};

window.showChat = () => {
    proprietesPage.classList.add("hidden");
    renderChat();
};

/***************************************************************
 * PROPRIETES — Acheter / Gérer
 ***************************************************************/
window.showAcheter = () => {
    document.getElementById("acheterSection").classList.remove("hidden");
    document.getElementById("gererSection").classList.add("hidden");
    renderAcheterBiens();
};

window.showGerer = () => {
    document.getElementById("gererSection").classList.remove("hidden");
    document.getElementById("acheterSection").classList.add("hidden");
    renderGererBiens();
};

/***************************************************************
 * LISTE DES BIENS
 ***************************************************************/
const biensList = [
    "Appartement",
    "Maison",
    "Villa",
    "Loft",
    "Manoir",
    "Château",
    "Terrain constructible"
];

/***************************************************************
 * MARCHÉ DYNAMIQUE
 ***************************************************************/
function calculerPrix(bien) {
    const basePrices = {
        "Appartement": 80000,
        "Maison": 150000,
        "Villa": 300000,
        "Loft": 250000,
        "Manoir": 600000,
        "Château": 2000000,
        "Terrain constructible": 120000
    };

    const base = basePrices[bien] || 100000;

    // fluctuation de -15% à +15%
    const fluct = 1 + (Math.random() * 0.3 - 0.15);

    return Math.floor(base * fluct);
}

/***************************************************************
 * LOYERS (toutes les 4 heures)
 ***************************************************************/
function calculerLoyer(bien) {
    const loyers = {
        "Appartement": 700,
        "Maison": 1200,
        "Villa": 2500,
        "Loft": 1700,
        "Manoir": 4500,
        "Château": 8000,
        "Terrain constructible": 0
    };
    return loyers[bien] || 0;
}

function appliquerLoyers() {
    const now = Date.now();
    const fourHours = 4 * 60 * 60 * 1000;

    if (now - playerData.lastLoyer < fourHours) return;

    let total = 0;
    playerData.biens.forEach(b => total += calculerLoyer(b.type));

    playerData.liquidite += total;
    playerData.lastLoyer = now;

    savePlayer();
}

/***************************************************************
 * IMPÔTS (1 fois par jour)
 ***************************************************************/
function appliquerImpots() {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    if (now - playerData.lastImpots < day) return;

    const impot = Math.floor(playerData.capital * 0.02);
    playerData.liquidite -= impot;
    playerData.lastImpots = now;
    savePlayer();
}

/***************************************************************
 * EVENEMENTS ALEATOIRES (toutes les 8h)
 ***************************************************************/
function evenementAleatoire() {
    const now = Date.now();
    const eightHours = 8 * 60 * 60 * 1000;

    if (now - playerData.lastEvenement < eightHours) return;

    const chance = Math.random();

    // catastrophes 20%
    if (chance < 0.2) {
        if (playerData.biens.length > 0) {
            const index = Math.floor(Math.random() * playerData.biens.length);
            playerData.liquidite -= 5000;
            alert("🌪️ Catastrophe ! Une réparation coûte 5 000 §");
        }
    }

    // événements positifs 20%
    else if (chance < 0.4) {
        const gain = Math.floor(5000 + Math.random() * 20000);
        playerData.liquidite += gain;
        alert("🎁 Événement positif ! Vous gagnez " + gain + " §");
    }

    playerData.lastEvenement = now;
    savePlayer();
}

/***************************************************************
 * ACHATS / VENTES / TERRAINS + CONSTRUCTION
 ***************************************************************/
function renderAcheterBiens() {
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
    document.getElementById("acheterSection").innerHTML = html;
}

window.acheterBien = (bien, prix) => {
    if (playerData.liquidite < prix) return alert("Fonds insuffisants !");
    playerData.liquidite -= prix;
    playerData.biens.push({ type: bien, date: new Date().toISOString() });
    savePlayer();
    updateUI();
    renderAcheterBiens();
};

function renderGererBiens() {
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
    document.getElementById("gererSection").innerHTML = html;
}

window.construire = (index) => {
    const choix = prompt("Que construire ? Ex : Maison, Villa, Loft…");
    if (!choix) return;

    playerData.biens[index].construction = choix;
    savePlayer();
    renderGererBiens();
};

window.vendreBien = (index) => {
    playerData.biens.splice(index, 1);
    savePlayer();
    renderGererBiens();
};

/***************************************************************
 * SYSTEME BANCAIRE — EMPRUNTS
 ***************************************************************/
function renderBanque() {
    content.innerHTML = `
        <h2>Banque</h2>
        <p>Liquidité : ${playerData.liquidite.toLocaleString()} §</p>
        <button class="btn" onclick="ouvrirPret()">💰 Faire un emprunt</button>

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

window.ouvrirPret = () => {
    const montant = parseInt(prompt("Montant du prêt ?"), 10);
    if (!montant) return;

    const interet = 1.05; // 5%
    const mensualite = Math.floor(montant * interet / 10); // remboursé en 10 fois

    playerData.liquidite += montant;
    playerData.dettes.push({
        restant: Math.floor(montant * interet),
        mensualite
    });

    savePlayer();
    renderBanque();
};

window.rembourser = (index) => {
    const dette = playerData.dettes[index];
    if (playerData.liquidite < dette.mensualite) return alert("Pas assez d'argent !");

    playerData.liquidite -= dette.mensualite;
    dette.restant -= dette.mensualite;

    if (dette.restant <= 0) playerData.dettes.splice(index, 1);

    savePlayer();
    renderBanque();
};

/***************************************************************
 * CHAT GLOBAL
 ***************************************************************/
function renderChat() {
    content.innerHTML = `
        <h2>Chat Global</h2>
        <div id="chatContainer">
            <div id="chatMessages"></div>
            <div id="chatInput">
                <input id="chatMsg" type="text" placeholder="Message...">
                <button onclick="sendMessage()">Envoyer</button>
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
    });
}

window.sendMessage = async () => {
    const msgInput = document.getElementById("chatMsg");
    if (!msgInput.value.trim()) return;

    await addDoc(collection(window.db, "chat"), {
        username: playerData.username,
        message: msgInput.value.trim(),
        timestamp: new Date().toISOString()
    });

    msgInput.value = "";
};

/***************************************************************
 * SAUVEGARDE AUTOMATIQUE
 ***************************************************************/
async function savePlayer() {
    if (!currentPlayer) return;
    await setDoc(doc(window.db, "players", currentPlayer), playerData);
}

/***************************************************************
 * TICK AUTOMATIQUE
 ***************************************************************/
setInterval(() => {
    appliquerLoyers();
    appliquerImpots();
    evenementAleatoire();
    savePlayer();
}, 5000);
