import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

let currentUser = null;
let userData = null;
const startingCapital = 200000;
const revenuPourcent = 3; // 3% du prix du bien pour location
const entretienPourcent = 0.5; // 0.5% du prix des biens

const boutique = [
    { nom: "Petit appartement", prix: 50000 },
    { nom: "Maison de ville", prix: 120000 },
    { nom: "Immeuble locatif", prix: 350000 },
    { nom: "Villa de luxe", prix: 800000 },
    { nom: "Hôtel particulier", prix: 2500000 }
];

// ---------------- LOGIN ----------------
document.getElementById("loginBtn").addEventListener("click", login);

async function login() {
    const email = document.getElementById("emailInput").value.trim();
    const username = document.getElementById("usernameInput").value.trim();
    if (!email || !username) return alert("Email et nom valides requis");

    currentUser = username;
    const userRef = doc(db, "joueurs", currentUser);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        userData = {
            email: email,
            capital: startingCapital,
            liquidite: startingCapital,
            biens: [],
            entreprises: []
        };
        await setDoc(userRef, userData);
    } else {
        userData = userSnap.data();
    }

    // Affichage interface
    document.getElementById("loginCard").classList.add("hidden");
    document.getElementById("playerCard").classList.remove("hidden");
    document.getElementById("menuCard").classList.remove("hidden");
    document.getElementById("content").classList.remove("hidden");

    updateStats();
    showAccueil();
    checkDailyUpdate();

    // Rendre fonctions globales pour onclick
    window.showBoutique = showBoutique;
    window.showMesProprietes = showMesProprietes;
    window.showBanque = showBanque;
    window.showOptions = showOptions;
    window.acheterBien = acheterBien;
    window.louerBien = louerBien;
    window.vendreBien = vendreBien;
    window.resetGame = resetGame;
    window.logout = logout;
}

// ---------------- STATS ----------------
function updateStats() {
    document.getElementById("emailDisplay").textContent = userData.email;
    document.getElementById("usernameDisplay").textContent = currentUser;
    document.getElementById("capitalDisplay").textContent = userData.capital.toLocaleString();
    document.getElementById("liquiditeDisplay").textContent = userData.liquidite.toLocaleString();
    document.getElementById("nbBiensDisplay").textContent = userData.biens.length;
    document.getElementById("nbEntreprisesDisplay").textContent = userData.entreprises.length;
}

// ---------------- CONTENU ----------------
function setContent(html) {
    document.getElementById("content").innerHTML = html;
}

function showAccueil() {
    setContent("<h2>Bienvenue dans Empire Des Finances</h2><p>Commence par acheter un bien pour lancer ton empire.</p>");
}

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

function showBanque() { setContent("<h2>Banque</h2><p>Fonctionnalités bancaires à venir.</p>"); }
function showOptions() { setContent(`<h2>Options</h2><button class="btn" onclick="resetGame()">Réinitialiser le jeu</button>`); }

// ---------------- ACTIONS ----------------
async function acheterBien(index) {
    const item = boutique[index];
    if (userData.liquidite < item.prix) return alert("Pas assez de liquidités !");
    userData.liquidite -= item.prix;
    userData.biens.push({ nom: item.nom, prix: item.prix, enLocation: false });
    await saveUser();
    updateStats();
    showMesProprietes();
}

async function vendreBien(index) {
    const bien = userData.biens[index];
    if (!confirm(`Vendre ${bien.nom} pour 80% du prix ?`)) return;
    const prixVente = Math.floor(bien.prix * 0.8);
    userData.liquidite += prixVente;
    userData.biens.splice(index, 1);
    await saveUser();
    updateStats();
    showMesProprietes();
}

async function louerBien(index) {
    const bien = userData.biens[index];
    if (bien.enLocation) return alert("Ce bien est déjà loué !");
    const revenu = Math.floor(bien.prix * (revenuPourcent/100));
    userData.liquidite += revenu;
    bien.enLocation = true;
    await saveUser();
    updateStats();
    showMesProprietes();
}

// ---------------- REVENUS & ENTRETIEN ----------------
async function checkDailyUpdate() {
    const now = new Date();
    const parisTime = now.toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
    const parisDate = new Date(parisTime);
    const lastUpdate = localStorage.getItem("lastUpdate");

    if (!lastUpdate || new Date(lastUpdate).getDate() !== parisDate.getDate()) {
        // Revenu location
        let totalRevenu = 0;
        userData.biens.forEach(b => {
            if (b.enLocation) totalRevenu += Math.floor(b.prix * (revenuPourcent/100));
        });

        // Entretien 0.5%
        let totalEntretien = 0;
        userData.biens.forEach(b => totalEntretien += Math.floor(b.prix * (entretienPourcent/100)));

        userData.liquidite += totalRevenu - totalEntretien;
        await saveUser();
        updateStats();
        localStorage.setItem("lastUpdate", parisDate.toString());
    }

    // Vérifie à nouveau dans 1h
    setTimeout(checkDailyUpdate, 1000*60*60);
}

// ---------------- SAUVEGARDE ----------------
async function saveUser() {
    const userRef = doc(window.db, "joueurs", currentUser);
    await setDoc(userRef, userData);
}

// ---------------- RESET ----------------
function resetGame() {
    if (!confirm("Réinitialiser le jeu ?")) return;
    userData = { email: userData.email, capital: startingCapital, liquidite: startingCapital, biens: [], entreprises: [] };
    saveUser();
    updateStats();
    showAccueil();
}
function logout() { location.reload(); }
