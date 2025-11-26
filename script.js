import { doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

let currentUser = null;
let userData = null;
const startingCapital = 200000;
const revenuPourcent = 3; // 3% du prix du bien pour location

// Biens disponibles
const boutique = [
    { nom: "Petit appartement", prix: 50000 },
    { nom: "Maison de ville", prix: 120000 },
    { nom: "Immeuble locatif", prix: 350000 },
    { nom: "Villa de luxe", prix: 800000 },
    { nom: "Hôtel particulier", prix: 2500000 }
];

// -------------------------------------------
// LOGIN
// -------------------------------------------
document.getElementById("loginBtn").addEventListener("click", login);

async function login() {
    const username = document.getElementById("usernameInput").value.trim();
    if (!username) return alert("Entre un nom valide");

    currentUser = username;
    const userRef = doc(db, "joueurs", currentUser);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        // Créer un nouveau joueur
        userData = {
            capital: startingCapital,
            biens: []
        };
        await setDoc(userRef, userData);
    } else {
        userData = userSnap.data();
    }

    // Afficher interface
    document.getElementById("loginCard").classList.add("hidden");
    document.getElementById("playerCard").classList.remove("hidden");
    document.getElementById("menuCard").classList.remove("hidden");
    document.getElementById("content").classList.remove("hidden");

    updateStats();
    showAccueil();

    // Rendre fonctions globales pour onclick
    window.showBoutique = showBoutique;
    window.showMesProprietes = showMesProprietes;
    window.showBanque = showBanque;
    window.showOptions = showOptions;
    window.acheterBien = acheterBien;
    window.toggleLocation = toggleLocation;
    window.vendreBien = vendreBien;
    window.louerBien = louerBien;
    window.resetGame = resetGame;
    window.logout = logout;
}

// -------------------------------------------
// LOGOUT
// -------------------------------------------
function logout() {
    location.reload();
}

// -------------------------------------------
// STATS
// -------------------------------------------
function updateStats() {
    document.getElementById("usernameDisplay").textContent = currentUser;
    document.getElementById("liquiditeDisplay").textContent = userData.capital.toLocaleString();
    document.getElementById("nbBiensDisplay").textContent = userData.biens.length;
}

// -------------------------------------------
// AFFICHAGE PAGES
// -------------------------------------------
function setContent(html) {
    document.getElementById("content").innerHTML = html;
}

function showAccueil() {
    setContent("<h2>Bienvenue dans Empire Des Finances</h2><p>Commence par acheter un bien pour lancer ton empire.</p>");
}

// --- Boutique ---
function showBoutique() {
    let html = `<h2>Boutique</h2>`;
    boutique.forEach((b, i) => {
        html += `
            <div class="card">
                <h3>${b.nom}</h3>
                <p>Prix : ${b.prix.toLocaleString()} €</p>
                <button class="btn" onclick="acheterBien(${i})">Acheter</button>
            </div>
        `;
    });
    setContent(html);
}

// --- Mes Propriétés ---
function showMesProprietes() {
    if (userData.biens.length === 0) {
        setContent("<h2>Mes Propriétés</h2><p>Tu ne possèdes encore aucun bien.</p>");
        return;
    }

    let html = `<h2>Mes Propriétés</h2>`;
    userData.biens.forEach((b, i) => {
        html += `
            <div class="card">
                <h3>${b.nom}</h3>
                <p>Valeur : ${b.prix.toLocaleString()} €</p>
                <p>Status : ${b.enLocation ? "En location" : "Libre"}</p>
                <button class="btn" onclick="louerBien(${i})">Louer (3%)</button>
                <button class="btn" onclick="vendreBien(${i})">Vendre</button>
            </div>
        `;
    });
    setContent(html);
}

// --- Banque ---
function showBanque() {
    setContent("<h2>Banque</h2><p>Fonctionnalités bancaires à venir.</p>");
}

// --- Options ---
function showOptions() {
    setContent(`<h2>Options</h2><button class="btn" onclick="resetGame()">Réinitialiser le jeu</button>`);
}

// -------------------------------------------
// ACTIONS
// -------------------------------------------
async function acheterBien(index) {
    const item = boutique[index];
    if (userData.capital < item.prix) return alert("Pas assez d'argent !");
    userData.capital -= item.prix;
    userData.biens.push({ nom: item.nom, prix: item.prix, enLocation: false });
    await saveUser();
    updateStats();
    showMesProprietes();
}

async function vendreBien(index) {
    const bien = userData.biens[index];
    if (!confirm(`Vendre ${bien.nom} pour 80% du prix ?`)) return;
    const prixVente = Math.floor(bien.prix * 0.8);
    userData.capital += prixVente;
    userData.biens.splice(index, 1);
    await saveUser();
    updateStats();
    showMesProprietes();
}

async function louerBien(index) {
    const bien = userData.biens[index];
    if (bien.enLocation) return alert("Ce bien est déjà loué !");
    const revenu = Math.floor(bien.prix * (revenuPourcent / 100));
    userData.capital += revenu;
    bien.enLocation = true;
    await saveUser();
    updateStats();
    showMesProprietes();
}

// -------------------------------------------
// SAUVEGARDE
// -------------------------------------------
async function saveUser() {
    const userRef = doc(window.db, "joueurs", currentUser);
    await setDoc(userRef, userData);
}

// -------------------------------------------
// RESET
// -------------------------------------------
function resetGame() {
    if (!confirm("Réinitialiser le jeu ?")) return;
    userData = { capital: startingCapital, biens: [] };
    saveUser();
    updateStats();
    showAccueil();
}
