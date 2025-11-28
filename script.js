import { doc, setDoc, getDoc, collection, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { signInWithPopup } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// -------------------- ELEMENTS --------------------
const loginCard = document.getElementById("loginCard");
const playerCard = document.getElementById("playerCard");
const content = document.getElementById("content");

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

// -------------------- VARIABLES --------------------
let currentPlayer = null;
let playerData = null;

// BIENS / ENTREPRISES
const biensList = ["Terrain constructible","Appartement","Maison","Villa","Loft","Manoir","Château"];
const entreprisesList = ["Ferme","Commerce","Service"];

// -------------------- STRUCTURE INITIAL --------------------
const defaultPlayerData = {
    username: "Joueur",
    capital: 300000,
    liquidite: 50000,
    biens: [],
    entreprises: [],
    historique: [],
    emprunts: [],
    timestamp: new Date().toISOString()
};

// -------------------- LOGIN --------------------
loginBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const username = usernameInput.value.trim() || "Joueur";
    if (!email) { alert("Email requis"); return; }
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

// -------------------- LOAD PLAYER --------------------
async function loadPlayer(email, username){
    const docRef = doc(window.db, "players", email);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()){
        await setDoc(docRef, { ...defaultPlayerData, username });
        playerData = { ...defaultPlayerData, username };
    } else {
        playerData = docSnap.data();
    }
    updateUI();
}

// -------------------- UPDATE UI --------------------
function updateUI(){
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

// -------------------- LOGOUT --------------------
function logout(){
    currentPlayer = null;
    playerData = null;
    loginCard.classList.remove("hidden");
    playerCard.classList.add("hidden");
    content.classList.add("hidden");
}

// -------------------- NAVIGATION --------------------
window.showAccueil = () => {
    content.innerHTML = `
        <div class="card">
            <h2>🏡 Accueil</h2>
            <p>Bienvenue à Empire des Finances !</p>
        </div>
    `;
};

window.showProprietes = () => {
    content.innerHTML = `
        <div class="card">
            <h2>🏠 Propriétés</h2>
            <div class="subnav">
                <button class="sub-btn" onclick="showAcheter()">🏦 Acheter</button>
                <button class="sub-btn" onclick="showGerer()">📁 Gérer</button>
            </div>
            <div id="subContent"></div>
        </div>
    `;
    showAcheter(); // default
};

window.showAcheter = () => {
    document.getElementById("subContent").innerHTML = renderAcheterBiens();
};

window.showGerer = () => {
    document.getElementById("subContent").innerHTML = renderGererBiens();
};

window.showEntreprises = () => {
    let html = `<h2>🏢 Entreprises</h2><div class="grid">`;
    entreprisesList.forEach(ent => {
        html += `<div class="card">
            <h3>${ent}</h3>
            <button class="btn" onclick="creerEntreprise('${ent}')">Créer</button>
            <button class="btn alt" onclick="dissoudreEntreprise('${ent}')">Dissoudre</button>
        </div>`;
    });
    html += "</div>";
    content.innerHTML = html;
};

window.showBanque = () => {
    content.innerHTML = `
        <div class="card">
            <h2>🏦 Banque</h2>
            <p>Emprunts et finances personnelles ici.</p>
        </div>
    `;
};

window.showDemocratie = () => {
    content.innerHTML = `
        <div class="card">
            <h2>⚖️ Démocratie</h2>
            <p>Page en construction.</p>
        </div>
    `;
};

window.showChat = () => {
    renderChat();
};

// -------------------- BIENS --------------------
function calculerPrix(bien){
    const base = { "Terrain constructible":50000,"Appartement":100000,"Maison":200000,"Villa":500000,"Loft":350000,"Manoir":800000,"Château":2000000 };
    return base[bien] || 100000;
}

function renderAcheterBiens(){
    let html = "<div class='grid'>";
    biensList.forEach(bien => {
        html += `<div class="card">
            <h3>${bien}</h3>
            <p>Prix : ${calculerPrix(bien).toLocaleString()} §</p>
            <button class="btn" onclick="acheterBien('${bien}')">Acheter</button>
        </div>`;
    });
    html += "</div>";
    return html;
}

function renderGererBiens(){
    if(playerData.biens.length===0) return "<p>Aucun bien possédé.</p>";
    let html = "<div class='grid'>";
    playerData.biens.forEach((bien,index) => {
        const constr = bien.construction ? `🏗️ ${bien.construction}` : "Aucune construction";
        html += `<div class="card">
            <h3>${bien.type}</h3>
            <p>Construction : ${constr}</p>
            ${bien.type==="Terrain constructible" && !bien.construction ? `<button class="btn" onclick="construireSurTerrain(${index})">Construire</button>` : ""}
            <button class="btn alt" onclick="vendreBienIndex(${index})">Vendre</button>
        </div>`;
    });
    html += "</div>";
    return html;
}

// -------------------- ACHETER / VENDRE --------------------
window.acheterBien = (bien) => {
    const prix = calculerPrix(bien);
    if(playerData.liquidite<prix){ alert("Pas assez de liquidités !"); return; }
    playerData.liquidite -= prix;
    playerData.biens.push({ type: bien, date: new Date().toISOString() });
    savePlayer();
    showGerer();
};

window.vendreBienIndex = (index) => {
    const bien = playerData.biens[index];
    const prix = calculerPrix(bien.type)*0.8; // revente 80%
    playerData.liquidite += prix;
    playerData.biens.splice(index,1);
    savePlayer();
    showGerer();
};

window.construireSurTerrain = (index) => {
    const options = ["Appartement","Maison","Villa","Loft","Manoir","Château"];
    const choix = prompt("Quelle construction ?\n"+options.join(", "));
    if(options.includes(choix)){
        playerData.biens[index].construction = choix;
        savePlayer();
        showGerer();
    } else alert("Construction invalide");
};

// -------------------- ENTREPRISES --------------------
window.creerEntreprise = (ent) => {
    playerData.entreprises.push({ type: ent, date: new Date().toISOString() });
    savePlayer();
    showEntreprises();
};

window.dissoudreEntreprise = (ent) => {
    const index = playerData.entreprises.findIndex(e => e.type===ent);
    if(index>-1){ playerData.entreprises.splice(index,1); savePlayer(); showEntreprises(); }
    else alert("Vous n'avez pas cette entreprise.");
};

// -------------------- SAVE PLAYER --------------------
async function savePlayer(){
    if(!currentPlayer) return;
    const docRef = doc(window.db, "players", currentPlayer);
    await setDoc(docRef, playerData);
    updateUI();
}

// -------------------- CHAT --------------------
function renderChat(){
    content.innerHTML = `<h2>💬 Chat Global</h2>
    <div id="chatContainer">
        <div id="chatMessages"></div>
        <div id="chatInput">
            <input type="text" id="chatMsg" placeholder="Écrire un message...">
            <button onclick="sendMessage()">Envoyer</button>
        </div>
    </div>`;

    const chatRef = collection(window.db, "chat");
    const chatMessages = document.getElementById("chatMessages");

    onSnapshot(chatRef, snapshot => {
        chatMessages.innerHTML = "";
        snapshot.docs.forEach(doc => {
            const msg = doc.data();
            const p = document.createElement("p");
            p.innerHTML = `<b>${msg.username}:</b> ${msg.message}`;
            chatMessages.appendChild(p);
        });
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

window.sendMessage = async () => {
    const msgInput = document.getElementById("chatMsg");
    if(!msgInput.value.trim()) return;
    await addDoc(collection(window.db,"chat"), {
        username: playerData.username,
        message: msgInput.value.trim(),
        timestamp: new Date().toISOString()
    });
    msgInput.value = "";
};

// -------------------- AUTO SAVE --------------------
setInterval(() => { savePlayer(); }, 15000);

// -------------------- LOYERS AUTOMATIQUES --------------------
setInterval(() => {
    if(!playerData) return;
    let revenu = 0;
    playerData.biens.forEach(b => {
        if(b.type!=="Terrain constructible"){
            revenu += calculerPrix(b.type)*0.01; // 1% du prix toutes les 4h
        }
    });
    playerData.liquidite += revenu;
    savePlayer();
}, 240*60*1000); // 4h = 240min

