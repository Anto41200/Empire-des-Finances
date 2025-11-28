import { doc, setDoc, getDoc, collection, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { signInWithPopup } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

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

let currentPlayer = null;
let playerData = null;

// INITIAL PLAYER STRUCTURE
const defaultPlayerData = {
    capital: 300000,
    liquidite: 50000,
    biens: [],
    entreprises: [],
    historique: [],
    timestamp: new Date().toISOString()
};

// LOGIN
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

// LOAD OR CREATE PLAYER
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

// UPDATE UI
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

// LOGOUT
function logout(){
    currentPlayer = null;
    playerData = null;
    loginCard.classList.remove("hidden");
    playerCard.classList.add("hidden");
    content.classList.add("hidden");
}

// NAVIGATION
window.showAccueil = () => { content.innerHTML = "<h2>Accueil</h2><p>Bienvenue à Empire des Finances.</p>"; };
window.showProprietes = () => { renderBiens(); };
window.showEntreprises = () => { renderEntreprises(); };
window.showBanque = () => { content.innerHTML = "<h2>Banque</h2><p>Vos comptes et transactions seront ici.</p>"; };
window.showDemocratie = () => { content.innerHTML = "<h2>Démocratie</h2><p>Page vide pour l'instant.</p>"; };
window.showChat = () => { renderChat(); };

// BIENS PERSONNELS
const biensList = ["Appartement","Maison","Villa","Loft","Manoir","Château"];
function renderBiens(){
    let html = `<h2>Propriétés</h2><div class="grid">`;
    biensList.forEach((bien,i) => {
        html += `<div class="card">
            <h3>${bien}</h3>
            <p>Options: ${bien==="Château"?"Tourisme, Monument Historique, Événement": "Location classique"}</p>
            <button class="btn" onclick="acheterBien('${bien}')">Acheter</button>
            <button class="btn alt" onclick="vendreBien('${bien}')">Vendre</button>
        </div>`;
    });
    html += "</div>";
    content.innerHTML = html;
}

// ENTREPRISES
const entreprisesList = ["Ferme","Commerce","Service"];
function renderEntreprises(){
    let html = `<h2>Entreprises</h2><div class="grid">`;
    entreprisesList.forEach(ent => {
        html += `<div class="card">
            <h3>${ent}</h3>
            <button class="btn" onclick="creerEntreprise('${ent}')">Créer</button>
            <button class="btn alt" onclick="dissoudreEntreprise('${ent}')">Dissoudre</button>
        </div>`;
    });
    html += "</div>";
    content.innerHTML = html;
}

// FUNCTIONS BIENS
window.acheterBien = (bien) => {
    playerData.biens.push({ type: bien, date: new Date().toISOString() });
    savePlayer();
    updateUI();
    alert(bien + " acheté !");
};

window.vendreBien = (bien) => {
    const index = playerData.biens.findIndex(b => b.type === bien);
    if(index>-1){ playerData.biens.splice(index,1); savePlayer(); updateUI(); alert(bien + " vendu !"); }
    else alert("Vous ne possédez pas ce bien.");
};

// FUNCTIONS ENTREPRISES
window.creerEntreprise = (ent) => {
    playerData.entreprises.push({ type: ent, date: new Date().toISOString() });
    savePlayer();
    updateUI();
    alert(ent + " créée !");
};

window.dissoudreEntreprise = (ent) => {
    const index = playerData.entreprises.findIndex(e => e.type===ent);
    if(index>-1){ playerData.entreprises.splice(index,1); savePlayer(); updateUI(); alert(ent + " dissoute !"); }
    else alert("Vous n'avez pas cette entreprise.");
};

// SAVE PLAYER
async function savePlayer(){
    if(!currentPlayer) return;
    const docRef = doc(window.db, "players", currentPlayer);
    await setDoc(docRef, playerData);
}

// CHAT
function renderChat(){
    content.innerHTML = `<h2>Chat Global</h2>
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

// AUTO SAVE PERIODIQUE
setInterval(() => { savePlayer(); }, 15000);

// NAVIGATION POUR PROPRIETES
window.showProprietes = () => { 
    document.getElementById("proprietesContent").classList.remove("hidden"); 
    document.getElementById("acheterSection").classList.remove("hidden");
    document.getElementById("gererSection").classList.add("hidden");
};

window.showAcheter = () => { 
    document.getElementById("acheterSection").classList.remove("hidden"); 
    document.getElementById("gererSection").classList.add("hidden");
};

window.showGerer = () => { 
    document.getElementById("gererSection").classList.remove("hidden"); 
    document.getElementById("acheterSection").classList.add("hidden");
};

// BIENS DANS "Gérer" (à afficher seulement pour les biens déjà possédés)
function renderGererBiens() {
    let html = `<h2>Mes Propriétés</h2><div class="grid">`;
    playerData.biens.forEach(bien => {
        html += `<div class="card">
            <h3>${bien.type}</h3>
            <p>Propriétaire depuis: ${new Date(bien.date).toLocaleDateString()}</p>
            <button class="btn" onclick="renommerBien('${bien.type}')">Renommer</button>
            <button class="btn alt" onclick="vendreBien('${bien.type}')">Vendre</button>
        </div>`;
    });
    html += "</div>";
    document.getElementById("gererSection").innerHTML = html;
}
