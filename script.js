console.log("script.js chargé");

let users = {};
let currentUser = "joueur";
let liquidite = 100000;
let lastUpdate = null;

const boutique = [
    { nom: "Petit appartement", prix: 50000, revenue: 300 },
    { nom: "Maison de ville", prix: 120000, revenue: 750 },
    { nom: "Immeuble locatif", prix: 350000, revenue: 2000 },
    { nom: "Villa de luxe", prix: 800000, revenue: 4500 },
    { nom: "Hôtel particulier", prix: 2500000, revenue: 9000 }
];

/* -------- Sauvegarde -------- */
function saveGame() {
    if (!users[currentUser]) users[currentUser] = { biens: [] };
    users[currentUser].liquidite = liquidite;
    localStorage.setItem("empireUsers", JSON.stringify(users));
}

function saveLastUpdate() { localStorage.setItem("empireLastUpdate", lastUpdate); }

function loadGame() {
    if (localStorage.getItem("empireUsers")) users = JSON.parse(localStorage.getItem("empireUsers"));
    if (!users[currentUser]) users[currentUser] = { biens: [] };
    lastUpdate = new Date(localStorage.getItem("empireLastUpdate") || Date.now());
    liquidite = users[currentUser].liquidite || 0;
    updateStats();
}

/* -------- Stats joueur -------- */
function updateStats() {
    document.getElementById("usernameDisplay").textContent = currentUser;
    document.getElementById("liquiditeDisplay").textContent = liquidite.toLocaleString();
    document.getElementById("nbBiensDisplay").textContent = users[currentUser].biens.length;
}

/* -------- Revenus journaliers -------- */
function checkDailyUpdate() {
    const now = new Date();
    if (!lastUpdate) lastUpdate = now;
    const diffDays = Math.floor((now - lastUpdate)/(1000*60*60*24));
    if (diffDays>=1) {
        let total = 0;
        users[currentUser].biens.forEach(b=>{ if(b.locationActive) total+=b.revenue*diffDays; });
        liquidite += total;
        saveGame();
        lastUpdate = now;
        saveLastUpdate();
    }
}

/* -------- Contenu dynamique -------- */
function setContent(html){ document.getElementById("content").innerHTML = html; }

function showBoutique() {
    let html = `<h2>Boutique</h2>`;
    boutique.forEach((b,i)=>{
        html += `<div class="card">
            <h3>${b.nom}</h3>
            <p>Prix : ${b.prix.toLocaleString()} €</p>
            <p>Revenu journalier : ${b.revenue} €</p>
            <button class="btn" onclick="acheterBien(${i})">Acheter</button>
        </div>`;
    });
    setContent(html);
}

function showMesProprietes() {
    let biens = users[currentUser].biens;
    if(biens.length===0){ setContent("<h2>Mes Propriétés</h2><p>Tu ne possèdes encore aucun bien.</p>"); return; }
    let html = `<h2>Mes Propriétés</h2>`;
    biens.forEach((b,i)=>{
        html+=`<div class="card">
            <h3>${b.nom}</h3>
            <p>Valeur : ${b.prix.toLocaleString()} €</p>
            <p>Revenu journalier : ${b.revenue} €</p>
            <p>Location : ${b.locationActive?"✔ Active":"❌ Désactivée"}</p>
            <button class="btn" onclick="toggleLocation(${i})">
                ${b.locationActive?"Arrêter la location":"Activer la location"}
            </button>
            <button class="btn" onclick="embellirBien(${i})">Embellir</button>
            <button class="btn" onclick="vendreBien(${i})">Vendre</button>
        </div>`;
    });
    setContent(html);
}

function showBanque(){ setContent(`<h2>Banque</h2><p>Fonctionnalités bancaires à venir.</p>`); }
function showOptions(){ setContent(`<h2>Options</h2><button class="btn" onclick="resetGame()">🔄 Réinitialiser le jeu</button>`); }

/* -------- Actions joueur -------- */
function acheterBien(index){
    let item=boutique[index];
    if(liquidite<item.prix){ alert("Tu n'as pas assez d'argent !"); return; }
    liquidite-=item.prix;
    users[currentUser].biens.push({nom:item.nom,prix:item.prix,revenue:item.revenue,locationActive:true});
    saveGame(); updateStats(); showMesProprietes();
}

function embellirBien(index){
    let bien=users[currentUser].biens[index];
    let cout=Math.floor(bien.prix*0.5);
    if(liquidite<cout){ alert("Pas assez d'argent pour embellir ce bien."); return; }
    liquidite-=cout;
    bien.prix=Math.floor(bien.prix*1.25);
    bien.revenue=Math.floor(bien.revenue*1.20);
    saveGame(); updateStats(); showMesProprietes();
}

function vendreBien(index){
    if(!confirm("Veux-tu vraiment vendre ce bien ?")) return;
    let bien=users[currentUser].biens[index];
    liquidite+=Math.floor(bien.prix*0.8);
    users[currentUser].biens.splice(index,1);
    saveGame(); updateStats(); showMesProprietes();
}

function toggleLocation(index){
    let bien=users[currentUser].biens[index];
    bien.locationActive=!bien.locationActive;
    saveGame(); showMesProprietes();
}

/* -------- Reset complet -------- */
function resetGame(){
    if(!confirm("Réinitialiser complètement le jeu ?")) return;
    localStorage.clear(); location.reload();
}

/* -------- Initialisation -------- */
window.onload=()=>{
    loadGame();
    checkDailyUpdate();
};
