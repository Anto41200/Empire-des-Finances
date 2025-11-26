/* =====================================================
   EMPIRE IMMO — SCRIPT PRINCIPAL
   Système : gestion immobilière, revenus, sauvegarde
   Auteur : Antonin Duwicquet (2025)
===================================================== */

/* =========================
   VARIABLES PRINCIPALES
========================= */

let users = {};                    // Tous les comptes
let currentUser = "joueur";        // Nom de compte par défaut
let liquidite = 100000;            // Argent initial
let lastUpdate = null;             // Date de dernier revenu

// Biens proposés dans la boutique
const boutique = [
    { nom: "Petit appartement", prix: 50000, revenue: 300 },
    { nom: "Maison de ville", prix: 120000, revenue: 750 },
    { nom: "Immeuble locatif", prix: 350000, revenue: 2000 },
    { nom: "Villa de luxe", prix: 800000, revenue: 4500 },
    { nom: "Hôtel particulier", prix: 2500000, revenue: 9000 }
];

/* =========================
   SAUVEGARDES
========================= */

function saveGame() {
    if (!users[currentUser]) {
        users[currentUser] = { biens: [] };
    }

    users[currentUser].liquidite = liquidite;
    localStorage.setItem("empireUsers", JSON.stringify(users));
}

function saveLastUpdate() {
    localStorage.setItem("empireLastUpdate", lastUpdate.toString());
}

function loadGame() {
    if (localStorage.getItem("empireUsers")) {
        users = JSON.parse(localStorage.getItem("empireUsers"));
    }

    if (!users[currentUser]) {
        users[currentUser] = { biens: [] };
    }

    if (localStorage.getItem("empireLastUpdate")) {
        lastUpdate = new Date(localStorage.getItem("empireLastUpdate"));
    } else {
        lastUpdate = new Date();
        saveLastUpdate();
    }

    liquidite = users[currentUser].liquidite || 0;

    updateStats();
}

/* =========================
   AFFICHAGE DES STATISTIQUES
========================= */

function updateStats() {
    document.getElementById("usernameDisplay").textContent = currentUser;
    document.getElementById("liquiditeDisplay").textContent = liquidite.toLocaleString();
    document.getElementById("nbBiensDisplay").textContent = users[currentUser].biens.length;
}

/* =========================
   REVENUS JOURNALIERS
========================= */

function checkDailyUpdate() {
    const now = new Date();

    if (!lastUpdate) {
        lastUpdate = now;
        saveLastUpdate();
        return;
    }

    const diffTime = now - lastUpdate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays >= 1) {
        let total = 0;

        users[currentUser].biens.forEach(bien => {
            if (bien.locationActive) {
                total += bien.revenue * diffDays;
            }
        });

        liquidite += total;
        saveGame();

        lastUpdate = now;
        saveLastUpdate();
    }
}

/* =========================
   AFFICHAGE DES PAGES
========================= */

function setContent(html) {
    document.getElementById("content").innerHTML = html;
}

/* --- Boutique --- */
function showBoutique() {
    let html = `<h2>Boutique</h2>`;

    boutique.forEach((b, i) => {
        html += `
            <div class="card">
                <h3>${b.nom}</h3>
                <p>Prix : ${b.prix.toLocaleString()} €</p>
                <p>Revenu journalier : ${b.revenue} €</p>
                <button class="btn" onclick="acheterBien(${i})">Acheter</button>
            </div>
        `;
    });

    setContent(html);
}

/* --- Mes propriétés --- */
function showMesProprietes() {
    let biens = users[currentUser].biens;

    if (biens.length === 0) {
        setContent("<h2>Mes Propriétés</h2><p>Tu ne possèdes encore aucun bien.</p>");
        return;
    }

    let html = `<h2>Mes Propriétés</h2>`;

    biens.forEach((b, i) => {
        html += `
            <div class="card">
                <h3>${b.nom}</h3>
                <p>Valeur : ${b.prix.toLocaleString()} €</p>
                <p>Revenu journalier : ${b.revenue} €</p>
                <p>Location : ${b.locationActive ? "✔ Active" : "❌ Désactivée"}</p>

                <button class="btn" onclick="toggleLocation(${i})">
                    ${b.locationActive ? "Arrêter la location" : "Activer la location"}
                </button>

                <button class="btn" onclick="embellirBien(${i})">Embellir</button>
                <button class="btn" onclick="vendreBien(${i})">Vendre</button>
            </div>
        `;
    });

    setContent(html);
}

/* --- Banque (placeholder) --- */
function showBanque() {
    setContent(`
        <h2>Banque</h2>
        <p>Fonctionnalités bancaires à venir : prêts, crédits, intérêts, etc.</p>
    `);
}

/* --- Options --- */
function showOptions() {
    setContent(`
        <h2>Options</h2>
        <button class="btn" onclick="resetGame()">🔄 Réinitialiser le jeu</button>
    `);
}

/* =========================
   ACTIONS DU JOUEUR
========================= */

function acheterBien(index) {
    let item = boutique[index];

    if (liquidite < item.prix) {
        alert("Tu n'as pas assez d'argent !");
        return;
    }

    liquidite -= item.prix;

    users[currentUser].biens.push({
        nom: item.nom,
        prix: item.prix,
        revenue: item.revenue,
        locationActive: true
    });

    saveGame();
    updateStats();
    showMesProprietes();
}

function embellirBien(index) {
    let bien = users[currentUser].biens[index];
    let cout = Math.floor(bien.prix * 0.5);

    if (liquidite < cout) {
        alert("Pas assez d'argent pour embellir ce bien.");
        return;
    }

    liquidite -= cout;

    bien.prix = Math.floor(bien.prix * 1.25);
    bien.revenue = Math.floor(bien.revenue * 1.20);

    saveGame();
    updateStats();
    showMesProprietes();
}

function vendreBien(index) {
    if (!confirm("Veux-tu vraiment vendre ce bien ?")) return;

    let bien = users[currentUser].biens[index];

    let prixVente = Math.floor(bien.prix * 0.8); // 80% de la valeur

    liquidite += prixVente;
    users[currentUser].biens.splice(index, 1);

    saveGame();
    updateStats();
    showMesProprietes();
}

function toggleLocation(index) {
    let bien = users[currentUser].biens[index];
    bien.locationActive = !bien.locationActive;

    saveGame();
    showMesProprietes();
}

/* =========================
   RESET TOTAL
========================= */

function resetGame() {
    if (!confirm("Réinitialiser complètement le jeu ?")) return;

    localStorage.clear();
    location.reload();
}

/* =========================
   INITIALISATION
========================= */

window.onload = () => {
    loadGame();
    checkDailyUpdate();
};
