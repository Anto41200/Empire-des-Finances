// script.js (module)
// Utilise Firestore exposé dans window.db (initialisé dans index.html)
import { doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

/* ================= CONFIG JEU ================= */
const STARTING_CAPITAL = 200000;
const RENT_BASE_PERCENT = 0.03; // 3% / jour (base) - note: we convert monthly/daily later
const CLEAN_COST_PERCENT = 0.01; // 1% du prix pour le nettoyage
const CLEAN_BENEFIT = 0.05; // +5% loyer si nettoyé
const NO_CLEAN_PENALTY = -0.10; // -10% si pas nettoyé (après délai)
const EMBELLISH_INCREASE = 0.25; // +25% valeur à l'embellissement
const LOAN_MAX_MULTIPLIER = 3.5; // 350% du patrimoine max empruntable
const LOAN_MONTHLY_RATE = 0.05; // 5% par mois
// Entreprises : tu as demandé (agricole 3%, commerciale 4%, petro 8%)
const ENTERPRISE_TYPES = {
  agricole: { minPrice: 350_000, monthlyRate: 0.03 },
  commerciale: { minPrice: 750_000, monthlyRate: 0.04 },
  petroliere: { minPrice: 50_000_000, monthlyRate: 0.08 }
};

// Temps : 1 mois = 4 heures réelles ; on définit 1 mois = 30 jours -> 1 jour = 8 minutes = 480000 ms
const REAL_MS_PER_DAY = (4 * 60 * 60 * 1000) / 30; // = 480000 ms = 8 minutes
// For convenience define month/day helpers
const MS_PER_DAY = REAL_MS_PER_DAY;
const DAYS_PER_MONTH = 30;

// Cleaning auto default: every 10 in-game days
const DEFAULT_CLEAN_INTERVAL_DAYS = 10;

/* ================= ÉTAT ================= */
let db = window.db;
let userEmail = null;      // document id (email)
let displayName = null;    // username displayed
let userData = null;       // loaded from Firestore

// Large property list (ajouté plus de propriétés)
const MARKET = [
  { id: "studio01", nom: "Studio 20m²", prix: 60000, type: "appartement" },
  { id: "app45", nom: "Appartement 45m²", prix: 90000, type: "appartement" },
  { id: "maisonville", nom: "Maison de ville", prix: 150000, type: "maison" },
  { id: "loft", nom: "Loft industriel", prix: 220000, type: "appartement" },
  { id: "villa01", nom: "Villa moderne", prix: 700000, type: "villa" },
  { id: "gite01", nom: "Gîte montagnard", prix: 120000, type: "gite" },
  { id: "immeuble1", nom: "Immeuble 6 logements", prix: 350000, type: "immeuble" },
  { id: "palais01", nom: "Manoir", prix: 1200000, type: "manoir" },
  { id: "hotel01", nom: "Hôtel boutique", prix: 2000000, type: "hotel" },
  { id: "commerceSmall", nom: "Local commercial petit", prix: 110000, type: "commerce" },
  { id: "commerceLarge", nom: "Local commercial grand", prix: 400000, type: "commerce" },
  { id: "terrain01", nom: "Terrain constructible", prix: 50000, type: "terrain" },
  { id: "chateau01", nom: "Château ancien", prix: 4500000, type: "chateau" },
  { id: "farmSmall", nom: "Ferme familiale", prix: 380000, type: "ferme" },
  { id: "farmLarge", nom: "Ferme industrielle", prix: 1200000, type: "ferme" }
];

// ---------------- utilitaires ----------------
function fmt(n){ return Math.round(n).toLocaleString(); }
function now() { return Date.now(); }

// calcule la valeur totale des biens
function totalValueBiens() {
  return (userData.biens || []).reduce((s,b)=> s + (b.prix || 0), 0);
}
// calcule la valeur totale des entreprises
function totalValueEntreprises() {
  return (userData.entreprises || []).reduce((s,e)=> s + (e.capital || 0), 0);
}
// patrimoine = liquidité + valeur biens + valeur entreprises - dette
function computePatrimoine() {
  const liquid = userData.liquidite || 0;
  const biens = totalValueBiens();
  const ent = totalValueEntreprises();
  const debt = userData.debt || 0;
  return Math.round(liquid + biens + ent - debt);
}

/* ================= Persistence ================= */
async function saveUser() {
  if (!db || !userEmail) return;
  const ref = doc(db, "joueurs", userEmail);
  await setDoc(ref, userData, { merge: true });
}

/* ================= LOGIN ================= */
document.getElementById("loginBtn").addEventListener("click", async ()=>{
  const email = document.getElementById("emailInput").value.trim().toLowerCase();
  const name = document.getElementById("usernameInput").value.trim() || email.split("@")[0];
  if (!email) return alert("Entre ton email valide");
  userEmail = email;
  displayName = name;

  // load or create
  const ref = doc(db, "joueurs", userEmail);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    // create default structure
    userData = {
      email: userEmail,
      name: displayName,
      liquidite: STARTING_CAPITAL,
      biens: [],
      entreprises: [],
      debt: 0,
      transactions: [],
      lastTick: now(),          // timestamp ms
      lastCleanTick: now(),     // last cleaning schedule
      cleanIntervalDays: DEFAULT_CLEAN_INTERVAL_DAYS
    };
    await setDoc(ref, userData);
  } else {
    userData = snap.data();
    // if fields missing add defaults
    userData.liquidite = userData.liquidite ?? STARTING_CAPITAL;
    userData.biens = userData.biens ?? [];
    userData.entreprises = userData.entreprises ?? [];
    userData.debt = userData.debt ?? 0;
    userData.transactions = userData.transactions ?? [];
    userData.lastTick = userData.lastTick ?? now();
    userData.lastCleanTick = userData.lastCleanTick ?? now();
    userData.cleanIntervalDays = userData.cleanIntervalDays ?? DEFAULT_CLEAN_INTERVAL_DAYS;
  }

  // hide login, show game UI
  document.getElementById("loginCard").classList.add("hidden");
  document.getElementById("playerCard").classList.remove("hidden");
  document.getElementById("menuCard").classList.remove("hidden");
  document.getElementById("content").classList.remove("hidden");

  // expose functions global for onclick
  window.showBoutique = showBoutique;
  window.showMesProprietes = showMesProprietes;
  window.showEntreprises = showEntreprises;
  window.showBanque = showBanque;
  window.showFinances = showFinances;
  window.showOptions = showOptions;
  window.acheterBien = acheterBien;
  window.embellirBien = embellirBien;
  window.louerBien = louerBien;
  window.stopLocation = stopLocation;
  window.vendreBien = vendreBien;
  window.nettoyerBien = nettoyerBien;
  window.buyEnterprise = buyEnterprise;
  window.extractOil = extractOil;
  window.takeLoan = takeLoan;
  window.repayLoan = repayLoan;
  window.advanceDay = advanceDay;
  window.advanceMonth = advanceMonth;
  window.resetGame = resetGame;
  window.logout = logout;

  // apply updates for elapsed time
  await applyElapsedTicks();

  refreshHeader();
  showAccueil();
});

/* ================= UI / Header ================= */
function refreshHeader() {
  document.getElementById("emailDisplay").textContent = userData.email || "";
  document.getElementById("usernameDisplay").textContent = userData.name || "";
  document.getElementById("liquiditeDisplay").textContent = fmt(userData.liquidite || 0);
  document.getElementById("capitalDisplay").textContent = fmt(computePatrimoine());
  document.getElementById("nbBiensDisplay").textContent = (userData.biens||[]).length;
  document.getElementById("nbEntreprisesDisplay").textContent = (userData.entreprises||[]).length;
}

/* ================= CONTENT PAGES ================= */
function setContent(html){ document.getElementById("content").innerHTML = html; }
function showAccueil(){
  setContent(`<h2>Accueil</h2><p>1 mois = 4h réelles → 1 jour ≈ ${Math.round(MS_PER_DAY/60000)} minutes.</p>
    <p class="small">Patrimoine: ${fmt(computePatrimoine())} €, liquidité: ${fmt(userData.liquidite)}</p>
    <div class="controls"><button class="btn" onclick="advanceDay()">Avancer 1 jour (test)</button>
    <button class="btn" onclick="advanceMonth()">Avancer 1 mois (test)</button></div>`);
}

/* ---------- Boutique ---------- */
function showBoutique(){
  let html = `<h2>Boutique</h2><div class="grid">`;
  MARKET.forEach((m, i)=>{
    html += `<div class="card"><strong>${m.nom}</strong><p>Prix: ${fmt(m.prix)} €</p><p>Type: ${m.type}</p>
      <div class="controls"><button class="btn" onclick="acheterBien(${i})">Acheter</button></div></div>`;
  });
  html += `</div>`;
  setContent(html);
}

/* ---------- Mes propriétés ---------- */
function showMesProprietes(){
  const biens = userData.biens || [];
  if (biens.length === 0) { setContent("<h2>Mes Propriétés</h2><p>Aucun bien.</p>"); return; }
  let html = `<h2>Mes Propriétés</h2><div class="grid">`;
  biens.forEach((b,i)=>{
    const nettoyeBadge = b.nettoye ? `<span class="badge">Nettoyé</span>` : "";
    const embBadge = b.embelli ? `<span class="embelli-badge">Embellie</span>` : "";
    html += `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center">
      <div><strong>${b.nom}</strong>${embBadge}${nettoyeBadge}<div class="small">Type: ${b.type || "—"}</div></div>
      <div><span class="small">Valeur: ${fmt(b.prix)} €</span></div></div>
      <p>Status: ${b.enLocation ? "Loué" : "Libre"}</p>
      <p>Revenu potentiel/jour: ${fmt(calcDailyRent(b))} €</p>
      <div class="controls">
        ${b.enLocation ? `<button class="btn alt" onclick="stopLocation(${i})">Arrêter location</button>` : `<button class="btn" onclick="louerBien(${i})">Louer</button>`}
        <button class="btn" onclick="vendreBien(${i})">Vendre (80%)</button>
        ${b.embelli ? "" : `<button class="btn alt" onclick="embellirBien(${i})">Embellir (+25% valeur)</button>`}
        <button class="btn" onclick="nettoyerBien(${i})">Nettoyer (1% valeur)</button>
      </div></div>`;
  });
  html += `</div>`;
  setContent(html);
}

/* ---------- Entreprises (BETA) ---------- */
function showEntreprises(){
  const list = userData.entreprises || [];
  let html = `<h2>Entreprises (BETA)</h2>
    <div class="controls">
      <button class="btn" onclick="buyEnterprise('agricole')">Acheter Ferme (min ${fmt(ENTERPRISE_TYPES.agricole.minPrice)} €)</button>
      <button class="btn" onclick="buyEnterprise('commerciale')">Acheter Entreprise commerciale (min ${fmt(ENTERPRISE_TYPES.commerciale.minPrice)} €)</button>
      <button class="btn" onclick="buyEnterprise('petroliere')">Acheter Entreprise pétrolière (min ${fmt(ENTERPRISE_TYPES.petroliere.minPrice)} €)</button>
    </div>`;

  if (list.length === 0) {
    html += "<p>Aucune entreprise possédée.</p>";
  } else {
    html += "<div class='grid'>";
    list.forEach((e, idx)=>{
      html += `<div class="card"><strong>${e.type.toUpperCase()}</strong><p>Capital investi: ${fmt(e.capital)} €</p>
        <p>Revenu mensuel: ${Math.round(e.monthlyRate*100)}%</p>
        <p>${e.type === 'petroliere' ? `<button class="btn" onclick="extractOil(${idx})">Forer / Extraire</button>` : ''}</p>
      </div>`;
    });
    html += "</div>";
  }
  setContent(html);
}

/* ---------- Finances (transactions) ---------- */
function showFinances(){
  const tx = userData.transactions || [];
  if (tx.length === 0) { setContent("<h2>Finances</h2><p>Aucune transaction.</p>"); return; }
  let html = `<h2>Finances</h2><table class="table"><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Montant</th></tr></thead><tbody>`;
  tx.slice().reverse().forEach(t=>{
    html += `<tr><td>${t.date}</td><td>${t.type}</td><td>${t.desc}</td><td style="color:${t.type==='revenu'?'green':'red'};">${fmt(t.amount)} €</td></tr>`;
  });
  html += "</tbody></table>";
  setContent(html);
}

/* ---------- Banque placeholder ---------- */
function showBanque(){
  setContent(`<h2>Banque</h2>
    <p>Dette actuelle: ${fmt(userData.debt || 0)} €</p>
    <p>Patrimoine: ${fmt(computePatrimoine())} €</p>
    <div class="controls"><input id="loanAmount" placeholder="Montant emprunt" style="padding:8px;border-radius:6px;border:1px solid #ddd"/>
      <button class="btn" onclick="takeLoan()">Emprunter</button>
      <button class="btn alt" onclick="repayLoan()">Rembourser</button></div>
    <p class="small">Max empruntable: ${fmt(computePatrimoine() * LOAN_MAX_MULTIPLIER)} € (350% du patrimoine)</p>`);
}

/* ---------- Options ---------- */
function showOptions(){
  setContent(`<h2>Options</h2>
    <div class="controls"><button class="btn" onclick="advanceDay()">Avancer 1 jour</button>
    <button class="btn" onclick="advanceMonth()">Avancer 1 mois</button>
    <button class="btn alt" onclick="resetGame()">Réinitialiser</button></div>
    <p class="small">Nettoyage auto tous les ${userData.cleanIntervalDays || DEFAULT_CLEAN_INTERVAL_DAYS} jours (configurable plus tard)</p>`);
}

/* ================= ACTIONS PROPRIÉTÉS ================= */
async function acheterBien(index){
  const item = MARKET[index];
  if (userData.liquidite < item.prix) return alert("Pas assez de liquidités !");
  userData.liquidite -= item.prix;
  const newProp = {
    id: item.id + "_" + Date.now(),
    nom: item.nom,
    prix: item.prix,
    type: item.type,
    enLocation: false,
    embelli: false,
    nettoye: false,
    lastClean: Date.now()
  };
  userData.biens.push(newProp);
  addTransaction('depense', item.prix, `Achat bien ${item.nom}`);
  await saveUser();
  refreshHeader();
  showMesProprietes();
}

function calcDailyRent(bien) {
  // base daily rent = RENT_BASE_PERCENT * prix (we can consider base is per day)
  // Apply embellish: increases price already, so rent uses price
  // Apply cleaning bonus/penalty
  let base = bien.prix * RENT_BASE_PERCENT;
  // cleaning modifier
  let cleaningMod = 0;
  // if nettoye true -> +5% of rent; if lastClean older than interval -> -10%
  if (bien.nettoye) cleaningMod += CLEAN_BENEFIT;
  // check if not cleaned for a while: find days since lastClean
  const lastClean = bien.lastClean || userData.lastTick || Date.now();
  const daysSinceClean = Math.floor((now() - lastClean) / MS_PER_DAY);
  if (daysSinceClean > (userData.cleanIntervalDays || DEFAULT_CLEAN_INTERVAL_DAYS)) cleaningMod += NO_CLEAN_PENALTY;
  const rent = Math.max(0, base * (1 + cleaningMod));
  return Math.floor(rent);
}

async function louerBien(index){
  const bien = userData.biens[index];
  if (bien.enLocation) return alert("Déjà loué");
  // On active la location ; payer 1 jour immediate? We credit rent per day now
  // We'll credit a single day immediately to simulate
  const rent = calcDailyRent(bien);
  userData.liquidite += rent;
  bien.enLocation = true;
  addTransaction('revenu', rent, `Loyer jour pour ${bien.nom}`);
  await saveUser();
  refreshHeader();
  showMesProprietes();
}

async function stopLocation(index){
  const bien = userData.biens[index];
  bien.enLocation = false;
  await saveUser();
  showMesProprietes();
}

async function vendreBien(index){
  const bien = userData.biens[index];
  if (!confirm(`Vendre ${bien.nom} pour 80% ?`)) return;
  const sale = Math.floor(bien.prix * 0.8);
  userData.liquidite += sale;
  addTransaction('revenu', sale, `Vente ${bien.nom}`);
  userData.biens.splice(index,1);
  await saveUser();
  refreshHeader();
  showMesProprietes();
}

async function embellirBien(index){
  const bien = userData.biens[index];
  if (bien.embelli) return alert("Déjà embelli");
  const cost = Math.floor(bien.prix * EMBELLISH_INCREASE); // pay 25% of current price
  if (userData.liquidite < cost) return alert("Pas assez de liquidités pour embellir");
  if (!confirm(`Payer ${fmt(cost)} € pour embellir ${bien.nom} (valeur +25%) ?`)) return;
  userData.liquidite -= cost;
  bien.prix = Math.round(bien.prix * (1 + EMBELLISH_INCREASE)); // increase price by 25%
  bien.embelli = true;
  addTransaction('depense', cost, `Embellissement ${bien.nom}`);
  await saveUser();
  refreshHeader();
  showMesProprietes();
}

async function nettoyerBien(index){
  const bien = userData.biens[index];
  const cost = Math.floor(bien.prix * CLEAN_COST_PERCENT);
  if (userData.liquidite < cost) return alert("Pas assez pour nettoyage");
  userData.liquidite -= cost;
  bien.nettoye = true;
  bien.lastClean = now();
  addTransaction('depense', cost, `Nettoyage ${bien.nom}`);
  await saveUser();
  refreshHeader();
  showMesProprietes();
}

/* ================= ENTREPRISES ================ */
async function buyEnterprise(type){
  const def = ENTERPRISE_TYPES[type];
  if (!def) return alert("Type non valide");
  if (userData.liquidite < def.minPrice) return alert("Pas assez pour acheter ce type d'entreprise");
  // deduct and create enterprise
  userData.liquidite -= def.minPrice;
  const ent = {
    id: `${type}_${Date.now()}`,
    type,
    capital: def.minPrice,
    monthlyRate: def.monthlyRate,
    lastPayout: now()
  };
  userData.entreprises.push(ent);
  addTransaction('depense', def.minPrice, `Achat entreprise ${type}`);
  await saveUser();
  refreshHeader();
  showEntreprises();
}

async function extractOil(index){
  // For petro companies we simulate an extraction action that yields instant revenue
  const ent = userData.entreprises[index];
  if (!ent || ent.type !== 'petroliere') return alert("Entreprise non pétrolière");
  // extraction yields e.g. 0.5% of capital instantly (simulated)
  const yieldAmount = Math.floor(ent.capital * 0.005);
  userData.liquidite += yieldAmount;
  addTransaction('revenu', yieldAmount, `Extraction pétrole (${ent.id})`);
  await saveUser();
  refreshHeader();
  showEntreprises();
}

/* ================= PRETS (Banque) ================= */
async function takeLoan(){
  const input = document.getElementById("loanAmount");
  const val = Math.max(0, Number(input?.value || 0));
  if (!val) return alert("Montant invalide");
  const max = Math.floor(computePatrimoine() * LOAN_MAX_MULTIPLIER);
  if (val > max) return alert("Montant dépasse le maximum empruntable (" + fmt(max) + " €)");
  userData.debt = (userData.debt || 0) + val;
  userData.liquidite += val;
  addTransaction('revenu', val, `Emprunt ${fmt(val)} €`);
  await saveUser();
  refreshHeader();
  showBanque();
}

async function repayLoan(){
  const repay = Math.min(userData.debt || 0, userData.liquidite || 0);
  if (repay <= 0) return alert("Rien à rembourser ou pas de liquidité");
  userData.debt -= repay;
  userData.liquidite -= repay;
  addTransaction('depense', repay, "Remboursement dette");
  await saveUser();
  refreshHeader();
  showBanque();
}

/* ================= Transactions helper ================= */
function addTransaction(type, amount, desc){
  userData.transactions = userData.transactions || [];
  userData.transactions.push({ type, amount, desc, date: new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" }) });
}

/* ================= TIME & TICKS ================= */
/*
  We calculate elapsed real ms since userData.lastTick.
  For each in-game day passed, we apply:
    - daily rent income for rented properties (calcDailyRent)
    - daily maintenance: 0.5% of price (applied as depense)
  For each in-game month (30 days) passed, we apply:
    - companies monthly payouts (= monthlyRate * capital)
    - loan interest monthly (LOAN_MONTHLY_RATE applied to debt)
*/
async function applyElapsedTicks(){
  const last = userData.lastTick || now();
  const elapsedMs = now() - last;
  const elapsedDays = Math.floor(elapsedMs / MS_PER_DAY);
  if (elapsedDays <= 0){
    // nothing to do now, schedule next check
    scheduleNextTick();
    return;
  }

  // apply daily updates
  let totalRent = 0;
  let totalMaintenance = 0;
  for (let d=0; d<elapsedDays; d++){
    // loop per day to calculate cleaning penalties over time; simpler approach aggregate:
    userData.biens.forEach(b=>{
      if (b.enLocation) {
        const rent = calcDailyRent(b);
        totalRent += rent;
        addTransaction('revenu', rent, `Loyer journalier ${b.nom}`);
      }
      // maintenance per day = 0.5% of price
      const maintenance = Math.floor(b.prix * (0.005));
      totalMaintenance += maintenance;
      addTransaction('depense', maintenance, `Entretien journalier ${b.nom}`);
      // if not cleaned and overdue, no action beyond rent penalty applied in calcDailyRent which checks lastClean
    });
  }
  userData.liquidite += (totalRent - totalMaintenance);

  // monthly updates (every 30 days)
  const elapsedMonths = Math.floor(elapsedDays / DAYS_PER_MONTH);
  for (let m=0; m<elapsedMonths; m++){
    // companies payouts
    if (userData.entreprises && userData.entreprises.length>0) {
      userData.entreprises.forEach(ent=>{
        const payoff = Math.floor(ent.capital * ent.monthlyRate);
        userData.liquidite += payoff;
        addTransaction('revenu', payoff, `Paiement entreprise ${ent.type}`);
      });
    }
    // loan interest
    if (userData.debt && userData.debt > 0) {
      const interest = Math.floor(userData.debt * LOAN_MONTHLY_RATE);
      userData.debt += interest;
      addTransaction('depense', interest, `Intérêts emprunt mensuels`);
    }
  }

  // advance lastTick forward elapsedDays * MS_PER_DAY
  userData.lastTick = last + elapsedDays * MS_PER_DAY;
  // save and refresh
  await saveUser();
  refreshHeader();
  scheduleNextTick();
}

/* schedule next check at next day boundary */
function scheduleNextTick(){
  // compute ms until next in-game day
  const last = userData.lastTick || now();
  const untilNextDay = MS_PER_DAY - ((now() - last) % MS_PER_DAY);
  setTimeout(()=> applyElapsedTicks(), Math.max(1000, untilNextDay));
}

/* manual advance for testing */
async function advanceDay(){
  // simulate one day passing
  userData.lastTick = (userData.lastTick || now()) + MS_PER_DAY;
  await applyElapsedTicks();
  alert("Simulé 1 jour.");
}
async function advanceMonth(){
  userData.lastTick = (userData.lastTick || now()) + (MS_PER_DAY * DAYS_PER_MONTH);
  await applyElapsedTicks();
  alert("Simulé 1 mois.");
}

/* ================= Misc ================= */
async function resetGame(){
  if (!confirm("Réinitialiser le jeu pour cet utilisateur ?")) return;
  userData = {
    email: userData.email,
    name: userData.name,
    liquidite: STARTING_CAPITAL,
    biens: [],
    entreprises: [],
    debt: 0,
    transactions: [],
    lastTick: now(),
    lastCleanTick: now(),
    cleanIntervalDays: DEFAULT_CLEAN_INTERVAL_DAYS
  };
  await saveUser();
  refreshHeader();
  showAccueil();
}
function logout(){ location.reload(); }

/* ================= STARTUP ================= */
// nothing to run until login; but we expose helper global for debugging
window.computePatrimoine = computePatrimoine;
window.applyElapsedTicks = applyElapsedTicks;

