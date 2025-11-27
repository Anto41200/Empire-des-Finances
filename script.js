// script.js (module)
// =================== IMPORT FIRESTORE ===================
import { doc, getDoc, setDoc, updateDoc, collection, onSnapshot, addDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

/* ================= CONFIG JEU ================= */
const STARTING_CAPITAL = 300000;
const RENT_BASE_PERCENT = 0.03;
const CLEAN_COST_PERCENT = 0.01;
const CLEAN_BENEFIT = 0.05;
const NO_CLEAN_PENALTY = -0.10;
const EMBELLISH_INCREASE = 0.25;
const LOAN_MAX_MULTIPLIER = 3.5;
const LOAN_MONTHLY_RATE = 0.05;

const ENTERPRISE_TYPES = {
  agricole: { minPrice: 350_000, monthlyRate: 0.03, items: ["Ferme familiale","Ferme industrielle"] },
  commerciale: { minPrice: 750_000, monthlyRate: 0.04, items: ["Local commercial petit","Local commercial grand"] },
  petroliere: { minPrice: 50_000_000, monthlyRate: 0.08, items: ["Plateforme pétrolière"] },
  ferme: { minPrice: 300_000, monthlyRate: 0.03, items: ["Terrain agricole","Ferme exploitée"] }
};

const MS_PER_DAY = (4*60*60*1000)/30; // 1 jour = 8 min
const DAYS_PER_MONTH = 30;
const DEFAULT_CLEAN_INTERVAL_DAYS = 10;

let db = window.db;
let auth = getAuth();
let user = null;
let userData = null;

// ================== BIENS ==================
const PERSONAL_MARKET = [
  { id: "studio01", nom: "Studio 20m²", prix: 60000, type: "appartement" },
  { id: "app45", nom: "Appartement 45m²", prix: 90000, type: "appartement" },
  { id: "maisonville", nom: "Maison de ville", prix: 150000, type: "maison" },
  { id: "loft", nom: "Loft industriel", prix: 220000, type: "appartement" },
  { id: "villa01", nom: "Villa moderne", prix: 700000, type: "villa" },
  { id: "manoir01", nom: "Manoir", prix: 1200000, type: "manoir" },
  { id: "chateau01", nom: "Château ancien", prix: 4500000, type: "chateau" }
];

// ================== UTILITAIRES ==================
const fmt = n => Math.round(n).toLocaleString();
const now = () => Date.now();

function totalValueBiens() { return (userData.biens || []).reduce((s,b)=> s+(b.prix||0),0);}
function totalValueEntreprises() { return (userData.entreprises || []).reduce((s,e)=> s+(e.capital||0),0);}
function computePatrimoine() { 
  return Math.round((userData.liquidite||0)+totalValueBiens()+totalValueEntreprises()-(userData.debt||0)); 
}
function addTransaction(type, amount, desc){
  userData.transactions = userData.transactions || [];
  userData.transactions.push({ type, amount, desc, date: new Date().toLocaleString("fr-FR",{timeZone:"Europe/Paris"}) });
}

// ================== FIREBASE / AUTH ==================
const provider = new GoogleAuthProvider();

async function googleLogin() {
  try {
    const result = await signInWithPopup(auth, provider);
    user = result.user;
    await loadOrCreateUser(user.uid, user.displayName, user.email);
  } catch(e){ console.error(e); alert("Erreur connexion Google"); }
}

onAuthStateChanged(auth, async u => {
  if(u) { user = u; await loadOrCreateUser(user.uid, user.displayName, user.email); }
});

async function loadOrCreateUser(uid, name, email){
  const ref = doc(db, "joueurs", uid);
  const snap = await getDoc(ref);
  if(!snap.exists()){
    userData = {
      email, uid, name, liquidite: STARTING_CAPITAL, biens: [], entreprises: [], debt: 0,
      transactions: [], lastTick: now(), lastCleanTick: now(), cleanIntervalDays: DEFAULT_CLEAN_INTERVAL_DAYS
    };
    await setDoc(ref, userData);
  } else {
    userData = snap.data();
  }
  exposeFunctions();
  refreshHeader();
  showAccueil();
  startRealtimeChat();
}

// ================== HEADER ==================
function refreshHeader(){
  document.getElementById("emailDisplay").textContent = userData.email||"";
  document.getElementById("usernameDisplay").textContent = userData.name||"";
  document.getElementById("liquiditeDisplay").textContent = fmt(userData.liquidite||0);
  document.getElementById("capitalDisplay").textContent = fmt(computePatrimoine());
  document.getElementById("nbBiensDisplay").textContent = (userData.biens||[]).length;
  document.getElementById("nbEntreprisesDisplay").textContent = (userData.entreprises||[]).length;
}

// ================== AFFICHAGE ==================
function setContent(html){ document.getElementById("content").innerHTML = html; }

function showAccueil(){
  setContent(`<h2>Accueil</h2>
  <p>1 mois = 4h réelles → 1 jour ≈ ${Math.round(MS_PER_DAY/60000)} min</p>
  <p class="small">Patrimoine: ${fmt(computePatrimoine())} €, Liquidité: ${fmt(userData.liquidite)}</p>
  <div class="controls">
    <button class="btn" onclick="advanceDay()">Avancer 1 jour</button>
    <button class="btn" onclick="advanceMonth()">Avancer 1 mois</button>
  </div>`);
}

function showProprietes(){
  const biens = userData.biens || [];
  if(biens.length===0){ setContent("<h2>Propriétés</h2><p>Aucun bien.</p>"); return; }
  let html = "<h2>Propriétés</h2><div class='grid'>";
  biens.forEach((b,i)=>{
    let mode = b.type==="chateau" ? "Tourisme" : b.enLocation?"Loué":"Libre";
    let nettoyeBadge = b.nettoye?`<span class="badge">Nettoyé</span>`:"";
    let embBadge = b.embelli?`<span class="embelli-badge">Embellie</span>`:"";
    html+=`<div class="card">
      <strong>${b.nom}</strong> ${embBadge} ${nettoyeBadge}
      <p>Type: ${b.type}</p>
      <p>Status: ${mode}</p>
      <p>Revenu potentiel/jour: ${fmt(calcDailyRent(b))} €</p>
      <div class="controls">`;
    if(b.type==="chateau") html+=`<button class="btn" onclick="organiserEvenement(${i})">Organiser événement</button>`;
    else html+= b.enLocation?`<button class="btn alt" onclick="stopLocation(${i})">Arrêter location</button>`:`<button class="btn" onclick="louerBien(${i})">Louer</button>`;
    html+=`<button class="btn" onclick="vendreBien(${i})">Vendre (80%)</button>`;
    if(!b.embelli) html+=`<button class="btn alt" onclick="embellirBien(${i})">Embellir (+25%)</button>`;
    html+=`<button class="btn" onclick="nettoyerBien(${i})">Nettoyer (1%)</button></div></div>`;
  });
  html+="</div>";
  setContent(html);
}

function showEntreprises(){
  const types = Object.keys(ENTERPRISE_TYPES);
  let html="<h2>Entreprises</h2>";
  types.forEach(t=>{
    html+=`<h3>${t.toUpperCase()}</h3><div class="controls">`;
    ENTERPRISE_TYPES[t].items.forEach(item=>{
      html+=`<button class="btn" onclick="buyEnterprise('${t}','${item}')">${item} (min ${fmt(ENTERPRISE_TYPES[t].minPrice)} €)</button>`;
    });
    html+="</div>";
  });
  if(userData.entreprises.length>0){
    html+="<div class='grid'>";
    userData.entreprises.forEach((e,i)=>{
      html+=`<div class="card">
        <strong>${e.type.toUpperCase()}</strong><p>${e.item}</p>
        <p>Capital investi: ${fmt(e.capital)} €</p>
        <p>Revenu mensuel: ${Math.round(e.monthlyRate*100)}%</p>
        ${e.type==="petroliere"?`<button class="btn" onclick="extractOil(${i})">Forer / Extraire</button>`:""}
      </div>`;
    });
    html+="</div>";
  }
  setContent(html);
}

function showDemocratie(){ setContent("<h2>Démocratie</h2><p>Page vide</p>"); }

function showFinances(){
  const tx = userData.transactions||[];
  if(tx.length===0){ setContent("<h2>Finances</h2><p>Aucune transaction</p>"); return;}
  let html="<h2>Finances</h2><table class='table'><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Montant</th></tr></thead><tbody>";
  tx.slice().reverse().forEach(t=>{
    html+=`<tr><td>${t.date}</td><td>${t.type}</td><td>${t.desc}</td><td style="color:${t.type==='revenu'?'green':'red'}">${fmt(t.amount)} €</td></tr>`;
  });
  html+="</tbody></table>";
  setContent(html);
}

// ================== BIENS ACTIONS ==================
function calcDailyRent(bien){
  let base = bien.prix*RENT_BASE_PERCENT;
  let mod=0;
  if(bien.nettoye) mod+=CLEAN_BENEFIT;
  const lastClean = bien.lastClean||userData.lastTick||now();
  const daysSinceClean = Math.floor((now()-lastClean)/MS_PER_DAY);
  if(daysSinceClean>(userData.cleanIntervalDays||DEFAULT_CLEAN_INTERVAL_DAYS)) mod+=NO_CLEAN_PENALTY;
  return Math.max(0, Math.floor(base*(1+mod)));
}

async function acheterBien(index){
  const item = PERSONAL_MARKET[index];
  if(userData.liquidite<item.prix) return alert("Pas assez de liquidité");
  userData.liquidite-=item.prix;
  const prop={ id:item.id+"_"+Date.now(), nom:item.nom, prix:item.prix, type:item.type, enLocation:false, embelli:false, nettoye:false, lastClean:now() };
  userData.biens.push(prop);
  addTransaction('depense',item.prix,`Achat bien ${item.nom}`);
  await saveUser(); refreshHeader(); showProprietes();
}

async function louerBien(index){
  const bien=userData.biens[index]; if(bien.enLocation) return alert("Déjà loué");
  bien.enLocation=true;
  const rent=calcDailyRent(bien); userData.liquidite+=rent;
  addTransaction('revenu',rent,`Loyer journalier ${bien.nom}`);
  await saveUser(); refreshHeader(); showProprietes();
}

async function stopLocation(index){ userData.biens[index].enLocation=false; await saveUser(); showProprietes(); }
async function vendreBien(index){
  const bien=userData.biens[index];
  if(!confirm(`Vendre ${bien.nom} pour 80% ?`)) return;
  const vente=Math.floor(bien.prix*0.8); userData.liquidite+=vente;
  addTransaction('revenu',vente,`Vente ${bien.nom}`);
  userData.biens.splice(index,1); await saveUser(); refreshHeader(); showProprietes();
}
async function embellirBien(index){
  const b=userData.biens[index];
  if(b.embelli) return alert("Déjà embelli"); const cost=Math.floor(b.prix*EMBELLISH_INCREASE);
  if(userData.liquidite<cost) return alert("Pas assez"); if(!confirm(`Payer ${fmt(cost)} € pour embellir ${b.nom}?`)) return;
  userData.liquidite-=cost; b.prix=Math.round(b.prix*(1+EMBELLISH_INCREASE)); b.embelli=true;
  addTransaction('depense',cost,`Embellissement ${b.nom}`); await saveUser(); refreshHeader(); showProprietes();
}
async function nettoyerBien(index){ const b=userData.biens[index]; const cost=Math.floor(b.prix*CLEAN_COST_PERCENT);
  if(userData.liquidite<cost) return alert("Pas assez"); userData.liquidite-=cost; b.nettoye=true; b.lastClean=now();
  addTransaction('depense',cost,`Nettoyage ${b.nom}`); await saveUser(); refreshHeader(); showProprietes();
}

// ================== ENTREPRISES ACTIONS ==================
async function buyEnterprise(type,item){
  const def=ENTERPRISE_TYPES[type]; if(!def) return alert("Type invalide");
  if(userData.liquidite<def.minPrice) return alert("Pas assez"); userData.liquidite-=def.minPrice;
  const ent={ id:type+"_"+Date.now(), type, item, capital:def.minPrice, monthlyRate:def.monthlyRate, lastPayout:now() };
  userData.entreprises.push(ent); addTransaction('depense',def.minPrice,`Achat entreprise ${item}`);
  await saveUser(); refreshHeader(); showEntreprises();
}
async function extractOil(index){
  const e=userData.entreprises[index]; if(!e || e.type!=="petroliere") return;
  const yieldAmt=Math.floor(e.capital*0.005); userData.liquidite+=yieldAmt;
  addTransaction('revenu',yieldAmt,`Extraction pétrole ${e.item}`); await saveUser(); refreshHeader(); showEntreprises();
}

// ================== CHATEAU EVENEMENT ==================
async function organiserEvenement(index){
  const b=userData.biens[index]; if(b.type!=="chateau") return;
  const gain=Math.floor(b.prix*0.02); userData.liquidite+=gain;
  addTransaction('revenu',gain,`Événement local ${b.nom}`); await saveUser(); refreshHeader(); showProprietes();
}

// ================== PRETS ==================
async function takeLoan(){
  const val=Math.max(0,Number(document.getElementById("loanAmount")?.value||0));
  if(val>computePatrimoine()*LOAN_MAX_MULTIPLIER) return alert("Montant trop élevé");
  userData.debt=(userData.debt||0)+val; userData.liquidite+=val;
  addTransaction('revenu',val,"Emprunt"); await saveUser(); refreshHeader(); showBanque();
}
async function repayLoan(){ const repay=Math.min(userData.debt||0,userData.liquidite||0);
  if(repay<=0) return alert("Rien à rembourser"); userData.debt-=repay; userData.liquidite-=repay;
  addTransaction('depense',repay,"Remboursement dette"); await saveUser(); refreshHeader(); showBanque();
}

// ================== TIME / TICKS ==================
async function applyElapsedTicks(){
  const last=userData.lastTick||now();
  const elapsedDays=Math.floor((now()-last)/MS_PER_DAY); if(elapsedDays<=0){ scheduleNextTick(); return;}
  for(let d=0; d<elapsedDays; d++){
    userData.biens.forEach(b=>{
      if(b.enLocation) { const r=calcDailyRent(b); userData.liquidite+=r; addTransaction('revenu',r,`Loyer journalier ${b.nom}`);}
      const m=Math.floor(b.prix*0.005); userData.liquidite-=m; addTransaction('depense',m,`Entretien ${b.nom}`);
    });
  }
  const elapsedMonths=Math.floor(elapsedDays/DAYS_PER_MONTH);
  for(let m=0;m<elapsedMonths;m++){
    userData.entreprises.forEach(e=>{ const r=Math.floor(e.capital*e.monthlyRate); userData.liquidite+=r; addTransaction('revenu',r,`Paiement ${e.item}`);});
    if(userData.debt>0){ const i=Math.floor(userData.debt*LOAN_MONTHLY_RATE); userData.debt+=i; addTransaction('depense',i,"Intérêts emprunt");}
  }
  userData.lastTick=last+elapsedDays*MS_PER_DAY; await saveUser(); refreshHeader(); scheduleNextTick();
}
function scheduleNextTick(){ const last=userData.lastTick||now(); const untilNext=MS_PER_DAY-((now()-last)%MS_PER_DAY);
  setTimeout(()=>applyElapsedTicks(),Math.max(1000,untilNext));
}
async function advanceDay(){ userData.lastTick=(userData.lastTick||now())+MS_PER_DAY; await applyElapsedTicks(); alert("1 jour simulé");}
async function advanceMonth(){ userData.lastTick=(userData.lastTick||now())+MS_PER_DAY*DAYS_PER_MONTH; await applyElapsedTicks(); alert("1 mois simulé
window.showAccueil = showAccueil;
window.showProprietes = showProprietes;
window.showEntreprises = showEntreprises;
window.showDemocratie = showDemocratie;
window.showFinances = showFinances;
window.acheterBien = acheterBien;
window.louerBien = louerBien;
window.stopLocation = stopLocation;
window.vendreBien = vendreBien;
window.embellirBien = embellirBien;
window.nettoyerBien = nettoyerBien;
window.organiserEvenement = organiserEvenement;
window.buyEnterprise = buyEnterprise;
window.extractOil = extractOil;
window.advanceDay = advanceDay;
window.advanceMonth = advanceMonth;
window.takeLoan = takeLoan;
window.repayLoan = repayLoan;
