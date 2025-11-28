import { doc, setDoc, getDoc, collection, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { signInWithPopup } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// ------------------ VARIABLES ------------------
const loginCard = document.getElementById("loginCard");
const playerCard = document.getElementById("playerCard");
const content = document.getElementById("content");
const proprietesContent = document.getElementById("proprietesContent");

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

// ------------------ PLAYER STRUCTURE ------------------
const defaultPlayerData = {
    capital: 300000,
    liquidite: 50000,
    biens: [],
    entreprises: [],
    historique: [],
    emprunts: [],
    timestamp: new Date().toISOString()
};

// ------------------ LOGIN ------------------
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

// ------------------ LOAD PLAYER ------------------
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

// ------------------ UPDATE UI ------------------
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

// ------------------ LOGOUT ------------------
function logout(){
    currentPlayer = null;
    playerData = null;
    loginCard.classList.remove("hidden");
    playerCard.classList.add("hidden");
    content.classList.add("hidden");
}

// ------------------ NAVIGATION ------------------
window.showAccueil = () => { 
    content.innerHTML = "<h2>Accueil</h2><p>Bienvenue à Empire des Finances.</p>"; 
    proprietesContent.classList.add("hidden");
};

window.showProprietes = () => { 
    proprietesContent.classList.remove("hidden"); 
    showAcheter(); 
};

window.showEntreprises = () => { renderEntreprises(); };
window.showBanque = () => { renderBanque(); };
window.showDemocratie = () => { content.innerHTML = "<h2>Démocratie</h2><p>Page vide pour l'instant.</p>"; };
window.showChat = () => { renderChat(); };

// ------------------ BIENS ------------------
const biensList = [
    {type:"Appartement",valeur:50000},
    {type:"Maison",valeur:120000},
    {type:"Villa",valeur:250000},
    {type:"Loft",valeur:180000},
    {type:"Manoir",valeur:400000},
    {type:"Château",valeur:1000000}
];

window.showAcheter = () => {
    let html = "<h3>🏠 Acheter des biens</h3><div class='grid'>";
    biensList.forEach((b) => {
        html += `<div class="card">
            <h4>${b.type}</h4>
            <p>Valeur: ${b.valeur.toLocaleString()} §</p>
            <button class="btn" onclick="acheterBien('${b.type}',${b.valeur})">Acheter</button>
        </div>`;
    });
    html += "</div>";
    document.getElementById("proprietesDetail").innerHTML = html;
};

// ------------------ GESTION BIENS ------------------
window.showGerer = () => {
    let html = "<h3>⚙️ Gérer vos biens</h3><div class='grid'>";
    if(playerData.biens.length===0){ html+="<p>Vous ne possédez aucun bien.</p>"; }
    
    playerData.biens.forEach((b,i)=>{
        html += `<div class="card">
            <h4>${b.type}</h4>
            <p>Valeur: ${b.value.toLocaleString()}</p>
            <p>Loyer potentiel: ${calculateRent(b)} § / 4h</p>
            <div class="controls">
                <button class="btn alt" onclick="vendreBien(${i})">Vendre</button>
                <button class="btn" onclick="mettreEnLocation(${i})">Mettre en location</button>
                <button class="btn" onclick="embellirBien(${i})">Embellissement</button>
                <button class="btn alt" onclick="toggleServiceNettoyage(${i})">Service nettoyage ${b.nettoyage?"✅":"❌"}</button>`;
        
        if(b.type==="Château"){
            html += `<button class="btn" onclick="evenementChateau(${i})">Événement culturel / tourisme</button>
                     <button class="btn" onclick="serviceJardin(${i})">Service jardin</button>`;
        }
        html += `</div></div>`;
    });
    html += "</div>";
    document.getElementById("proprietesDetail").innerHTML = html;
};

// ------------------ ACTIONS BIENS ------------------
function calculateRent(bien){
    let base = bien.value || 50000;
    let rent = base*0.03;
    if(bien.embelli) rent *=1.25;
    if(bien.nettoyage) rent *=1.05;
    else rent *=0.9;
    return Math.floor(rent);
}

window.acheterBien = (type,valeur)=>{
    playerData.biens.push({type,value:valeur,date:new Date().toISOString(),embelli:false,nettoyage:false});
    savePlayer();
    updateUI();
    showAcheter();
    alert(`${type} acheté !`);
};

window.mettreEnLocation = (index)=>{
    const bien = playerData.biens[index];
    const revenu = calculateRent(bien);
    playerData.liquidite += revenu;
    playerData.historique.push({type:"loyer",bien:bien.type,revenu,date:new Date().toISOString()});
    savePlayer();
    updateUI();
    alert(`${bien.type} a généré ${revenu} § de loyer !`);
};

window.embellirBien = (index)=>{
    const bien = playerData.biens[index];
    if(bien.embelli){ alert("Déjà embelli !"); return; }
    bien.embelli = true;
    bien.value = bien.value*1.25;
    savePlayer();
    updateUI();
    showGerer();
    alert(`${bien.type} embelli ! Valeur et loyer augmentés de 25%`);
};

window.toggleServiceNettoyage = (index)=>{
    const bien = playerData.biens[index];
    bien.nettoyage = !bien.nettoyage;
    const cost = bien.value*0.005;
    if(bien.nettoyage) playerData.liquidite -= cost;
    savePlayer();
    updateUI();
    showGerer();
    alert(`${bien.type} service nettoyage ${bien.nettoyage?"activé":"désactivé"} (coût ${cost.toLocaleString()} §)`);
};

window.evenementChateau = (index)=>{
    const bien = playerData.biens[index];
    const gain = 20000;
    playerData.liquidite += gain;
    playerData.historique.push({type:"evenement",bien:bien.type,gain,date:new Date().toISOString()});
    savePlayer();
    updateUI();
    alert(`Événement culturel pour le ${bien.type}! Gain ${gain} §`);
};

window.serviceJardin = (index)=>{
    const bien = playerData.biens[index];
    const cost = 10000;
    if(playerData.liquidite<cost){ alert("Pas assez de liquidités"); return; }
    playerData.liquidite -= cost;
    playerData.historique.push({type:"jardin",bien:bien.type,cost,date:new Date().toISOString()});
    savePlayer();
    updateUI();
    alert(`${bien.type} : service jardin effectué (-${cost} §)`);
};

window.vendreBien = (index)=>{
    const bien = playerData.biens[index];
    const prixVente = bien.value;
    playerData.capital += prixVente;
    playerData.biens.splice(index,1);
    savePlayer();
    updateUI();
    showGerer();
    alert(`${bien.type} vendu pour ${prixVente.toLocaleString()} §`);
};

// ------------------ ENTREPRISES ------------------
const entreprisesList = ["Ferme","Commerce","Service"];
function renderEntreprises(){
    let html = "<h2>Entreprises</h2><div class='grid'>";
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

// ------------------ BANQUE ------------------
function renderBanque(){
    let html = `<h2>Banque</h2>
    <p>Patrimoine: ${playerData.capital.toLocaleString()} §</p>
    <p>Liquidité: ${playerData.liquidite.toLocaleString()} §</p>
    <div class="controls">
        <button class="btn" onclick="emprunterBanque()">💰 Emprunter</button>
    </div>`;
    content.innerHTML = html;
}

window.emprunterBanque = () => {
    let montant = prompt("Montant emprunt (max 50% patrimoine) §");
    montant = parseInt(montant);
    if(isNaN(montant) || montant <=0 || montant>playerData.capital*0.5){ alert("Montant invalide"); return; }
    const taux = 0.05; // 5% intérêts
    const mensualites = Math.ceil(montant*(1+taux)/12);
    playerData.emprunts.push({montant,taux,mensualites,date:new Date().toISOString()});
    playerData.liquidite += montant;
    savePlayer();
    updateUI();
    renderBanque();
    alert(`Emprunt accepté: ${montant} §, mensualités: ${mensualites} §`);
};

// ------------------ CHAT ------------------
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

// ------------------ AUTO SAVE ------------------
setInterval(() => { savePlayer(); }, 15000);

// ------------------ SAVE PLAYER ------------------
async function savePlayer(){
    if(!currentPlayer) return;
    const docRef = doc(window.db, "players", currentPlayer);
    await setDoc(docRef, playerData);
}
