/* script.js — Empire des Finances
   Implémente: boutique, achat, gestion (louer/vendre/rénover),
   entretien auto 0.5% du prix/jour, revenu locatif 3%/j,
   banque simple (emprunt jusqu'à 300% du patrimoine),
   impôts (vente 5% + plus-value 10%), sauvegarde locale.
*/

console.log("script.js chargé");

// --------------------- Données & état ---------------------
const STORAGE_KEY = "edf_state_v1";

let state = {
  liquidite: 200000,     // capital initial
  properties: [],        // biens possédés
  debt: 0,               // dette totale
  lastUpdate: new Date().toISOString(),
  history: []            // pour futur usage / graphiques
};

// Liste de propriétés disponibles (classiques + prestige)
const MARKET = [
  { id: "studio01", nom: "Studio 20m² (centre)", prix: 60000, type: "studio" },
  { id: "app45", nom: "Appartement 45m²", prix: 90000, type: "appartement" },
  { id: "maisonville", nom: "Maison de ville", prix: 150000, type: "maison" },
  { id: "immeuble1", nom: "Immeuble de rapport (6 logements)", prix: 350000, type: "immeuble" },
  { id: "villa01", nom: "Villa moderne", prix: 700000, type: "villa" },
  { id: "hotel01", nom: "Hôtel particulier", prix: 2000000, type: "hotel" },
  { id: "casino01", nom: "Casino", prix: 3500000, type: "casino" },
  { id: "manoir01", nom: "Manoir", prix: 1200000, type: "manoir" },
  { id: "chateau01", nom: "Château ancien", prix: 4500000, type: "chateau" },
  { id: "localpetit", nom: "Petit local commercial", prix: 110000, type: "commerce" },
  { id: "localgrand", nom: "Grand local commercial", prix: 380000, type: "commerce" },
  { id: "terrain01", nom: "Terrain constructible", prix: 50000, type: "terrain" }
];

// Paramètres du jeu
const RENT_RATE_BASE = 0.03;       // 3% / jour
const MAINTENANCE_RATE = 0.005;    // 0.5% / jour
const LOAN_INTEREST_DAILY = 0.03;  // 3% / jour sur la dette
const SALE_TAX = 0.05;             // 5% sur la vente
const PLUSVALUE_TAX = 0.10;        // 10% sur la plus-value
const WEALTH_TAX_THRESHOLD = 1000000; // >1M triggers wealth tax
const WEALTH_TAX_RATE = 0.01;      // 1% daily on excess (moderate)

// --------------------- utilitaires ---------------------
function saveState() {
  state.lastUpdate = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      state = Object.assign(state, parsed);
      if (!state.lastUpdate) state.lastUpdate = new Date().toISOString();
    } catch (e) {
      console.error("Erreur lecture storage:", e);
    }
  } else {
    saveState();
  }
}

function fmt(x) { return Math.round(x).toLocaleString() + " €"; }
function getPatrimoine() {
  const sumProps = state.properties.reduce((s,p)=>s + p.price,0);
  return Math.round(state.liquidite + sumProps - state.debt);
}

// --------------------- mécanique journalière ---------------------
function applyDailyUpdates() {
  const now = new Date();
  const last = new Date(state.lastUpdate || now.toISOString());
  // calc nombre de jours écoulés (entiers)
  const diffDays = Math.floor((now - last) / (1000*60*60*24));
  if (diffDays <= 0) return;

  let totalRent = 0;
  let totalMaintenance = 0;
  let totalLoanInterest = 0;

  state.properties.forEach(p => {
    // rent
    if (p.rented) {
      // rent per day = rentRate * price
      const rentPerDay = (p.rentRate || RENT_RATE_BASE) * p.price;
      totalRent += rentPerDay * diffDays;
    }
    // maintenance
    totalMaintenance += p.price * MAINTENANCE_RATE * diffDays;
  });

  // loan interest
  totalLoanInterest = state.debt * LOAN_INTEREST_DAILY * diffDays;

  // wealth tax if patrimoine > threshold
  const patrimoine = getPatrimoine();
  let wealthTax = 0;
  if (patrimoine > WEALTH_TAX_THRESHOLD) {
    const excess = patrimoine - WEALTH_TAX_THRESHOLD;
    wealthTax = excess * WEALTH_TAX_RATE * diffDays;
  }

  // Appliquer : ajouter loyers, soustraire maintenance, intérêts et impôts
  state.liquidite += totalRent;
  state.liquidite -= totalMaintenance;
  state.debt += totalLoanInterest; // intérêts ajoutés à la dette
  state.liquidite -= wealthTax;

  // Si liquide négative, on laisse négatif (dette implicite) ou on convertit en dette
  if (state.liquidite < 0) {
    // convert immediate negative to debt
    state.debt += Math.abs(state.liquidite);
    state.liquidite = 0;
  }

  // journaliser
  state.history.push({
    when: new Date().toISOString(),
    days: diffDays,
    rent: totalRent,
    maintenance: totalMaintenance,
    loanInterest: totalLoanInterest,
    wealthTax
  });

  saveState();
}

// --------------------- affichage UI ---------------------
function renderHeader() {
  document.getElementById("liquiditeDisplay").innerText = fmt(state.liquidite);
  document.getElementById("patrimoineDisplay").innerText = fmt(getPatrimoine());
  document.getElementById("detteDisplay").innerText = fmt(state.debt);
}

function showHome() {
  const content = document.getElementById("content");
  content.innerHTML = `
    <h2>Accueil</h2>
    <div class="card">
      <p>Capital : <strong>${fmt(state.liquidite)}</strong></p>
      <p>Patrimoine (liquidité + biens - dette) : <strong>${fmt(getPatrimoine())}</strong></p>
      <p>Nombre de biens possédés : <strong>${state.properties.length}</strong></p>
      <div class="controls">
        <button class="btn" onclick="showBoutique()">Aller à la Boutique</button>
        <button class="btn alt" onclick="showProprietes()">Gérer mes Propriétés</button>
      </div>
      <p class="footer-note">Les mises à jour journalières (loyers, entretien, intérêts) sont appliquées automatiquement lors du chargement.</p>
    </div>
  `;
  renderHeader();
}

// --------------------- BOUTIQUE (ACHAT) ---------------------
function showBoutique() {
  const content = document.getElementById("content");
  let html = `<h2>Boutique</h2><div class="grid">`;
  MARKET.forEach((m, idx) => {
    html += `<div class="card">
      <div class="property-title"><strong>${m.nom}</strong><span class="small">${m.type}</span></div>
      <p class="small">Prix : <b>${fmt(m.prix)}</b></p>
      <div class="controls">
        <button class="btn" onclick="buyProperty(${idx})">Acheter</button>
        <button class="btn alt" onclick="showDetailsMarket(${idx})">Détails</button>
      </div>
    </div>`;
  });
  html += `</div>`;
  content.innerHTML = html;
  renderHeader();
}

function showDetailsMarket(idx) {
  const m = MARKET[idx];
  const content = document.getElementById("content");
  content.innerHTML = `<h2>${m.nom}</h2>
  <div class="card">
    <p>Type : ${m.type}</p>
    <p>Prix : <b>${fmt(m.prix)}</b></p>
    <p>Revenu locatif attendu (base) : <b>${(RENT_RATE_BASE*100).toFixed(2)}% / jour</b></p>
    <div class="controls">
      <button class="btn" onclick="buyProperty(${idx})">Acheter</button>
      <button class="btn alt" onclick="showBoutique()">Retour</button>
    </div>
  </div>`;
}

function buyProperty(idx) {
  const m = MARKET[idx];
  if (state.liquidite < m.prix) {
    alert("Pas assez de liquidité pour acheter ce bien.");
    return;
  }
  state.liquidite -= m.prix;
  // propriété copiée
  state.properties.push({
    id: m.id + "_" + Date.now(),
    marketId: m.id,
    name: m.nom,
    price: m.prix,
    boughtPrice: m.prix,
    type: m.type,
    rented: false,
    rentRate: RENT_RATE_BASE,
    renovated: false
  });
  saveState();
  renderHeader();
  alert("Achat effectué !");
  showProprietes("gestion");
}

// --------------------- MES PROPRIÉTÉS (sous-pages Achat / Gestion) ---------------------
function showProprietes(tab = "achat") {
  const content = document.getElementById("content");
  let html = `<h2>Mes Propriétés</h2>
    <div class="controls">
      <button class="btn" onclick="showProprietes('achat')">Achat (Boutique)</button>
      <button class="btn alt" onclick="showProprietes('gestion')">Gestion</button>
    </div>
    <p class="small">Liquidité : <b>${fmt(state.liquidite)}</b> — Dette : <b>${fmt(state.debt)}</b></p>
  `;
  if (tab === "achat") {
    // redirect to boutique
    content.innerHTML = html;
    showBoutique();
    return;
  }
  // gestion
  html += `<div class="card"><p class="small">Revenu locatif de base : <b>${(RENT_RATE_BASE*100).toFixed(2)}% / jour</b><br>
           Entretien automatique : <b>${(MAINTENANCE_RATE*100).toFixed(2)}% / jour</b></p></div>`;
  if (state.properties.length === 0) {
    html += `<div class="card"><p>Aucune propriété possédée.</p></div>`;
    content.innerHTML = html;
    renderHeader();
    return;
  }

  html += `<div class="grid">`;
  state.properties.forEach((p, i) => {
    html += `<div class="card">
      <div class="property-title"><div>
        <strong>${p.name}</strong>
        <div class="small">${p.type}</div>
      </div>
      <div class="right badge">${p.rented ? "Loué" : "Libre"}</div></div>
      <p>Valeur actuelle : <b>${fmt(p.price)}</b></p>
      <p>Prix d'achat : <span class="small">${fmt(p.boughtPrice)}</span></p>
      <p>Revenu locatif (jour) : <b>${fmt(p.price * (p.rentRate || RENT_RATE_BASE))}</b></p>
      <div class="controls">
        ${p.rented ? `<button class="btn alt" onclick="stopRent(${i})">Arrêter location</button>` : `<button class="btn" onclick="startRent(${i})">Louer (activer)</button>`}
        <button class="btn" onclick="sellProperty(${i})">Vendre</button>
        <button class="btn alt" onclick="openRenovate(${i})">Rénovation (50% prix)</button>
      </div>
    </div>`;
  });
  html += `</div>`;
  content.innerHTML = html;
  renderHeader();
}

// --------------------- GESTION ACTIONS ---------------------
function startRent(i) {
  state.properties[i].rented = true;
  saveState();
  showProprietes("gestion");
}
function stopRent(i) {
  state.properties[i].rented = false;
  saveState();
  showProprietes("gestion");
}

// vente : applique taxes (sale tax + plus-value tax)
function sellProperty(i) {
  const p = state.properties[i];
  if (!confirm(`Vendre ${p.name} pour ${fmt(p.price)} ? Une taxe de vente ${Math.round(SALE_TAX*100)}% et une taxe sur plus-value ${Math.round(PLUSVALUE_TAX*100)}% s'appliqueront.`)) return;
  const salePrice = p.price;
  const saleTax = salePrice * SALE_TAX;
  const plusValue = Math.max(0, salePrice - p.boughtPrice);
  const plusTax = plusValue * PLUSVALUE_TAX;
  const totalTax = saleTax + plusTax;
  const net = salePrice - totalTax;

  state.liquidite += net;
  // retirer propriété
  state.properties.splice(i,1);

  // paiement automatique des impôts si possible ; si pas assez, convertir en dette
  if (state.liquidite < 0) {
    state.debt += Math.abs(state.liquidite);
    state.liquidite = 0;
  }

  saveState();
  alert(`Vendu : net reçu ${fmt(net)} (taxes ${fmt(totalTax)})`);
  showProprietes("gestion");
}

// rénovation : payer 50% du prix (coût immédiat) -> +15% price & +15% rentRate
function openRenovate(i) {
  const p = state.properties[i];
  const cost = Math.floor(p.price * 0.5);
  if (!confirm(`Rénovation : payer ${fmt(cost)} pour augmenter valeur et loyer de 15% ?`)) return;
  if (state.liquidite < cost) {
    alert("Pas assez de liquidité pour rénover.");
    return;
  }
  state.liquidite -= cost;
  p.price = Math.round(p.price * 1.15);
  p.rentRate = (p.rentRate || RENT_RATE_BASE) * 1.15;
  p.renovated = true;
  saveState();
  alert("Rénovation terminée !");
  showProprietes("gestion");
}

// --------------------- BANQUE ---------------------
function showBanque() {
  const content = document.getElementById("content");
  content.innerHTML = `<h2>Banque</h2>
  <div class="card">
    <p>Dette actuelle : <b>${fmt(state.debt)}</b></p>
    <p>Patrimoine total : <b>${fmt(getPatrimoine())}</b></p>
    <p>Montant max empruntable = <b>${fmt(getPatrimoine() * 3)}</b> (300% du patrimoine)</p>

    <div style="margin-top:10px" class="controls">
      <input id="loanAmount" placeholder="Montant emprunt (ex: 50000)" style="padding:8px;border-radius:6px;border:1px solid #ddd" />
      <button class="btn" onclick="takeLoan()">Emprunter</button>
      <button class="btn alt" onclick="repayLoan()">Rembourser (manuel)</button>
    </div>

    <p class="small footer-note">Intérêts quotidiens : ${Math.round(LOAN_INTEREST_DAILY*100)}% appliqués automatiquement à la dette.</p>
  </div>`;
  renderHeader();
}

function takeLoan() {
  const input = document.getElementById("loanAmount");
  const amount = Math.max(0, Number(input.value || 0));
  const max = Math.floor(getPatrimoine() * 3);
  if (amount <= 0) { alert("Montant invalide"); return; }
  if (amount > max) { alert("Montant supérieur au maximum empruntable."); return; }
  state.debt += amount;
  state.liquidite += amount;
  saveState();
  alert(`Emprunt accordé : ${fmt(amount)}`);
  showBanque();
}

function repayLoan() {
  // repay as much as possible from liquidite (manual)
  if (state.debt <= 0) { alert("Pas de dette."); return; }
  const repay = Math.min(state.liquidite, state.debt);
  if (repay <= 0) { alert("Pas assez de liquidité pour rembourser."); return; }
  state.liquidite -= repay;
  state.debt -= repay;
  saveState();
  alert(`Remboursé ${fmt(repay)}.`);
  showBanque();
}

// --------------------- FINANCES / TABLEAU ---------------------
function showTableau() {
  const content = document.getElementById("content");
  const totalRent = state.properties.reduce((s,p)=> s + (p.rented ? p.price * (p.rentRate || RENT_RATE_BASE) : 0),0);
  const maintenanceDaily = state.properties.reduce((s,p)=> s + p.price * MAINTENANCE_RATE,0);
  content.innerHTML = `<h2>Tableau financier</h2>
    <div class="card">
      <p>Liquidité : <b>${fmt(state.liquidite)}</b></p>
      <p>Dette : <b>${fmt(state.debt)}</b></p>
      <p>Patrimoine total : <b>${fmt(getPatrimoine())}</b></p>
      <p>Revenu locatif journalier actuel : <b>${fmt(totalRent)}</b></p>
      <p>Coût entretien journalier : <b>${fmt(maintenanceDaily)}</b></p>
      <div class="controls">
        <button class="btn" onclick="collectStats()">Sauvegarder état</button>
        <button class="btn alt" onclick="advanceDayPrompt()">Avancer d'un jour (test)</button>
      </div>
    </div>`;
  renderHeader();
}

function collectStats() {
  state.history.push({when: new Date().toISOString(), liquidite: state.liquidite, patrimoine: getPatrimoine(), debt: state.debt});
  saveState();
  alert("État sauvegardé dans l'historique local.");
}

// --------------------- OPTIONS ---------------------
function showOptions() {
  const content = document.getElementById("content");
  content.innerHTML = `<h2>Options & outils</h2>
  <div class="card">
    <p class="small">Mode test : tu peux avancer le temps d'un jour pour tester loyers/entretien/impôts.</p>
    <div class="controls">
      <button class="btn" onclick="advanceDay()">Avancer 1 jour (rapide)</button>
      <button class="btn alt" onclick="resetGame()">Réinitialiser tout</button>
    </div>
  </div>`;
  renderHeader();
}

function resetGame() {
  if (!confirm("Réinitialiser complètement le jeu et supprimer les données locales ?")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = {
    liquidite: 200000,
    properties: [],
    debt: 0,
    lastUpdate: new Date().toISOString(),
    history: []
  };
  saveState();
  renderHeader();
  showHome();
}

// --------------------- aide pour test : avancer jour ---------------------
function advanceDayPrompt() {
  if (!confirm("Avancer d'un jour : appliquer loyers, entretien, intérêts et impôts ?")) return;
  advanceDay();
}

function advanceDay() {
  // Simule 1 jour écoulé : on modifie lastUpdate to yesterday so applyDailyUpdates computes 1 day
  const last = new Date(state.lastUpdate || new Date().toISOString());
  last.setDate(last.getDate() - 1);
  state.lastUpdate = last.toISOString();
  applyDailyUpdates();
  saveState();
  renderHeader();
  alert("1 jour simulé : mises à jour appliquées.");
}

// --------------------- événement aléatoire (léger) ---------------------
function runRandomEvent() {
  // petit proba chaque chargement
  if (Math.random() < 0.12) {
    const events = [
      { txt: "Boom touristique : loyers des commerces +30% pour 3 jours", apply: ()=>applyTemporaryModifier("commerce","rent",1.30,3) },
      { txt: "Crise locale : prix marché -10% (impact sur ventes) pour 5 jours", apply: ()=>applyTemporaryModifier("market","price",0.90,5) },
      { txt: "Entretien augmenté : coûts d'entretien x2 pour 4 jours", apply: ()=>applyTemporaryModifier("maintenance","mult",2,4) }
    ];
    const ev = events[Math.floor(Math.random()*events.length)];
    alert("Événement : " + ev.txt);
    ev.apply();
  }
}
const TEMP_MODIFIERS = []; // stockage des modifs temporaires (non persistées pour la simplicité)

function applyTemporaryModifier(scope, kind, factor, days) {
  TEMP_MODIFIERS.push({scope, kind, factor, until: Date.now() + days*24*60*60*1000});
  // pour la simplicité, cet exemple n'applique pas de code lourd. (Peut être étendu)
}

// --------------------- cycle automatique basique ---------------------
// On applique les calculs journaliers à l'ouverture en fonction du temps écoulé.
function startup() {
  loadState();
  applyDailyUpdates();
  renderHeader();
  showHome();
  runRandomEvent();
  // sauvegarde régulière
  setInterval(()=>{ saveState(); renderHeader(); }, 30*1000);
}

window.addEventListener("load", startup);
