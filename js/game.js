// GAME.JS — Logique complète du jeu
// Système financier + achats + revenus + château + banque

// === Chargement du joueur ===
function getUser() {
  const user = JSON.parse(localStorage.getItem("edf_user"));
  if (!user) {
    window.location.href = "index.html";
  }
  return user;
}

let user = getUser();

// === Variables du jeu ===
let capital = user.capital || 10000;            // argent total
let liquidites = user.liquidites || 5000;       // argent cash
let revenusParMinute = user.revenus || 50;      // revenus automatiques
let biens = user.biens || 0;                    // nombre de biens
let chateauNiveau = user.chateau || 1;          // niveau château

// === Mise à jour de l'affichage ===
function updateUI() {
  document.getElementById("capital").innerText = capital;
  document.getElementById("liquidites").innerText = liquidites;
  document.getElementById("revenus").innerText = revenusParMinute;
  document.getElementById("biens").innerText = biens;
  document.getElementById("chateau-niveau").innerText = chateauNiveau;
}

// === Sauvegarde ===
function saveGame() {
  const save = {
    ...user,
    capital,
    liquidites,
    revenus: revenusParMinute,
    biens,
    chateau: chateauNiveau
  };
  localStorage.setItem("edf_user", JSON.stringify(save));
}

// === Revenus automatiques ===
setInterval(() => {
  capital += revenusParMinute;
  updateUI();
  saveGame();
}, 60000); // 1 minute

// === Collecter manuellement les revenus ===
document.getElementById("gain-auto").addEventListener("click", () => {
  capital += revenusParMinute;
  updateUI();
  saveGame();
});

// === Achat d'un bien ===
document.getElementById("acheter-bien").addEventListener("click", () => {
  const prix = 5000;

  if (capital < prix) {
    alert("Pas assez de capital !");
    return;
  }

  capital -= prix;
  biens++;
  revenusParMinute += 10;
  updateUI();
  saveGame();
});

// === Banque ===
document.getElementById("depot").addEventListener("click", () => {
  if (capital < 1000) {
    alert("Pas assez de capital !");
    return;
  }

  capital -= 1000;
  liquidites += 1000;
  updateUI();
  saveGame();
});

document.getElementById("retrait").addEventListener("click", () => {
  if (liquidites < 1000) {
    alert("Liquidités insuffisantes !");
    return;
  }

  liquidites -= 1000;
  capital += 1000;
  updateUI();
  saveGame();
});

// === Amélioration du château ===
document.getElementById("upgrade-chateau").addEventListener("click", () => {
  const prix = 50000 * chateauNiveau;

  if (capital < prix) {
    alert("Pas assez de capital pour améliorer le château !");
    return;
  }

  capital -= prix;
  chateauNiveau++;
  revenusParMinute += 50;
  updateUI();
  saveGame();
});

// === Initialisation ===
updateUI();
