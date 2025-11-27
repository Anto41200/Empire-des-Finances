// script.js complet - Empire des Finances v2
// ================= CONFIG =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBAuJkFTlYHoKyZiHiAAi-VxcNpZ-FAA9k",
  authDomain: "empire-des-finances.firebaseapp.com",
  projectId: "empire-des-finances",
  storageBucket: "empire-des-finances.appspot.com",
  messagingSenderId: "276513960656",
  appId: "1:276513960656:web:b4440b88b797a4a6fa64d5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
window.db = db;

// ================= CONSTANTES JEU =================
const STARTING_CAPITAL = 300000;
const RENT_BASE_PERCENT = 0.03;
const CLEAN_COST_PERCENT = 0.01;
const CLEAN_BENEFIT = 0.05;
const NO_CLEAN_PENALTY = -0.10;
const EMBELLISH_INCREASE = 0.25;
const LOAN_MAX_MULTIPLIER = 3.5;
const LOAN_MONTHLY_RATE = 0.05;
const REAL_MS_PER_DAY = (4*60*60*1000)/30;
const MS_PER_DAY = REAL_MS_PER_DAY;
const DAYS_PER_MONTH = 30;
const DEFAULT_CLEAN_INTERVAL_DAYS = 10;

const ENTERPRISE_TYPES = {
  agricole: { minPrice: 350_000, monthlyRate: 0.03 },
  commerciale: { minPrice: 750_000, monthlyRate: 0.04 },
  petroliere: { minPrice: 50_000_000, monthlyRate: 0.08 },
  ferme: { minPrice: 200_000, monthlyRate: 0.02 },
  terrain: { minPrice: 100_000, monthlyRate: 0.01 }
};

// ================= ÉTAT =================
let userData = null;
let userId = null;
let displayName = null;

const MARKET_BIENS = [
  { id: 'studio01', nom: 'Studio 20m²', prix: 60000, type: 'appartement' },
  { id: 'app45', nom: 'Appartement 45m²', prix: 90000, type: 'appartement' },
  { id: 'maisonville', nom: 'Maison de ville', prix: 150000, type: 'maison' },
  { id: 'loft', nom: 'Loft industriel', prix: 220000, type: 'appartement' },
  { id: 'villa01', nom: 'Villa moderne', prix: 700000, type: 'villa' },
  { id: 'manoir01', nom: 'Manoir', prix: 1200000, type: 'manoir' },
  { id: 'chateau01', nom: 'Château ancien', prix: 4500000, type: 'chateau', tourisme: true }
];

const MARKET_ENT = [
  { type: 'agricole', nom: 'Ferme', minPrice: 350000 },
  { type: 'commerciale', nom: 'Entreprise commerciale', minPrice: 750000 },
  { type: 'petroliere', nom: 'Entreprise pétrolière', minPrice: 50000000 },
  { type: 'ferme', nom: 'Ferme terrain', minPrice: 200000 },
  { type: 'terrain', nom: 'Terrain constructible', minPrice: 100000 }
];

// ================= UTILITAIRES =================
function fmt(n){ return Math.round(n).toLocaleString(); }
function now(){ return Date.now(); }
function computePatrimoine(){
  const liquid = userData.liquidite||0;
  const biens = (userData.biens||[]).reduce((s,b)=>s+(b.prix||0),0);
  const ent = (userData.entreprises||[]).reduce((s,e)=>s+(e.capital||0),0);
  const debt = userData.debt||0;
  return Math.round(liquid+biens+ent-debt);
}

// ================= FIREBASE / AUTH =================
const provider = new GoogleAuthProvider();

async function googleLogin(){
  const result = await signInWithPopup(auth, provider);
  const user = result.user;
  userId = user.uid;
  displayName = user.displayName || user.email.split('@')[0];
  await loadOrCreateUser(userId, displayName);
}

onAuthStateChanged(auth, async user => {
  if(user){
    userId = user.uid;
    displayName = user.displayName || user.email.split('@')[0];
    await loadOrCreateUser(userId, displayName);
  } else {
    document.getElementById('loginCard').classList.remove('hidden');
  }
});

async function logout(){
  await signOut(auth);
  location.reload();
}

// ================= LOAD / SAVE =================
async function loadOrCreateUser(id, name){
  const ref = doc(db,'joueurs',id);
  const snap = await getDoc(ref);
  if(!snap.exists()){
    userData = {
      email: name,
      name: name,
      liquidite: STARTING_CAPITAL,
      biens: [],
      entreprises: [],
      debt: 0,
      transactions: [],
      lastTick: now(),
      cleanIntervalDays: DEFAULT_CLEAN_INTERVAL_DAYS
    };
    await setDoc(ref,userData);
  } else {
    userData = snap.data();
  }
  document.getElementById('loginCard').classList.add('hidden');
  document.getElementById('playerCard').classList.remove('hidden');
  document.getElementById('menuCard').classList.remove('hidden');
  document.getElementById('content').classList.remove('hidden');
  refreshHeader();
  showAccueil();
  setupChat();
  applyElapsedTicks();
}

async function saveUser(){
  if(!userId) return;
  const ref = doc(db,'joueurs',userId);
  await setDoc(ref,userData,{merge:true});
}

// ================= HEADER =================
function refreshHeader(){
  document.getElementById('emailDisplay').textContent = userData.email||'';
  document.getElementById('usernameDisplay').textContent = userData.name||'';
  document.getElementById('liquiditeDisplay').textContent = fmt(userData.liquidite||0);
  document.getElementById('capitalDisplay').textContent = fmt(computePatrimoine());
  document.getElementById('nbBiensDisplay').textContent = (userData.biens||[]).length;
  document.getElementById('nbEntreprisesDisplay').textContent = (userData.entreprises||[]).length;
}

// ================= CONTENT PAGES =================
function setContent(html){ document.getElementById('content').innerHTML = html; }
function showAccueil(){
  setContent(`<h2>Accueil</h2><p>1 mois = 4h réelles → 1 jour ≈ ${Math.round(MS_PER_DAY/60000)} minutes.</p>
  <p class="small">Patrimoine: ${fmt(computePatrimoine())} €, liquidité: ${fmt(userData.liquidite)}</p>
  <div class="controls"><button class="btn" onclick="advanceDay()">Avancer 1 jour</button>
  <button class="btn" onclick="advanceMonth()">Avancer 1 mois</button></div>`);
}

function showProprietes(){
  const biens = userData.biens||[];
  if(biens.length===0){ setContent('<h2>Propriétés</h2><p>Aucun bien.</p>'); return; }
  let html='<h2>Propriétés</h2><div class="grid">';
  biens.forEach((b,i)=>{
    let mode='';
    if(b.type==='chateau') mode='Mode Tourisme';
    const nettoyeBadge = b.nettoye?'<span class="badge">Nettoyé</span>':'';
    const embBadge = b.embelli?'<span class="embelli-badge">Embellie</span>':'';
    html+=`<div class="card" style="transition:all 0.2s;">
      <strong>${b.nom}</strong> ${mode}${nettoyeBadge}${embBadge}
      <p>Valeur: ${fmt(b.prix)} €</p>
      <div class="controls">
        ${b.type!=='chateau'?`<button class="btn" onclick="louerBien(${i})">Louer</button>`:''}
        <button class="btn" onclick="vendreBien(${i})">Vendre (80%)</button>
        ${b.embelli?'':`<button class="btn alt" onclick="embellirBien(${i})">Embellir (+25%)</button>`}
        <button class="btn" onclick="nettoyerBien(${i})">Nettoyer (1% valeur)</button>
      </div></div>`;
  });
  html+='</div>';
  setContent(html);
}

function showEntreprises(){
  let html='<h2>Entreprises</h2><div class="controls">';
  MARKET_ENT.forEach(e=>{
    html+=`<button class="btn" onclick="buyEnterprise('${e.type}')">Acheter ${e.nom} (min ${fmt(e.minPrice)} €)</button>`;
  });
  html+='</div>';
  const list = userData.entreprises||[];
  if(list.length>0){ html+='<div class="grid">';
    list.forEach((ent,i)=>{
      html+=`<div class="card"><strong>${ent.type.toUpperCase()}</strong><p>Capital: ${fmt(ent.capital)} €</p>
      <p>Revenu mensuel: ${Math.round(ent.monthlyRate*100)}%</p>
      ${ent.type==='petroliere'?`<button class="btn" onclick="extractOil(${i})">Forer / Extraire</button>`:''}
      </div>`;
    });
    html+='</div>';
  } else html+='<p>Aucune entreprise possédée.</p>';
  setContent(html);
}

function showDemocratie(){ setContent('<h2>Démocratie</h2><p>Page vide...</p>'); }

// ================= BIENS =================
function calcDailyRent(bien){
  if(bien.type==='chateau') return 0;
  let base = bien.prix*RENT_BASE_PERCENT;
  let mod=0;
  if(bien.nettoye) mod+=CLEAN_BENEFIT;
  const daysSinceClean = Math.floor((now()-(bien.lastClean||now()))/MS_PER_DAY);
  if(daysSinceClean>(userData.cleanIntervalDays||DEFAULT_CLEAN_INTERVAL_DAYS)) mod+=NO_CLEAN_PENALTY;
  return Math.max(0,Math.floor(base*(1+mod)));
}

async function acheterBien(index){
  const item=MARKET_BIENS[index];
  if(userData.liquidite<item.prix) return alert('Pas assez de liquidités');
  userData.liquidite-=item.prix;
  userData.biens.push({ ...item, enLocation:false, embelli:false, nettoye:false, lastClean:now() });
  addTransaction('depense', item.prix, `Achat ${item.nom}`);
  await saveUser();
  refreshHeader();
  showProprietes();
}

async function louerBien(index){
  const bien=userData.biens[index];
  if(bien.enLocation) return alert('Déjà loué');
  const rent=calcDailyRent(bien);
  userData.liquidite+=rent;
  bien.enLocation=true;
  addTransaction('revenu', rent, `Loyer ${bien.nom}`);
  await saveUser();
  refreshHeader();
  showProprietes();
}

async function vendreBien(index){
  const bien=userData.biens[index];
  const val=Math.floor(bien.prix*0.8);
  if(!confirm(`Vendre ${bien.nom} pour ${fmt(val)} €?`)) return;
  userData.liquidite+=val;
  addTransaction('revenu', val, `Vente ${bien.nom}`);
  userData.biens.splice(index,1);
  await saveUser();
  refreshHeader();
  showProprietes();
}

async function embellirBien(index){
  const bien=userData.biens[index];
  if(bien.embelli) return alert('Déjà embelli');
  const cost=Math.floor(bien.prix*EMBELLISH_INCREASE);
  if(userData.liquidite<cost) return alert('Pas assez de liquidités');
  if(!confirm(`Payer ${fmt(cost)} € pour embellir ${bien.nom}?`)) return;
  userData.liquidite-=cost;
  bien.prix=Math.floor(bien.prix*(1+EMBELLISH_INCREASE));
  bien.embelli=true;
  addTransaction('depense', cost, `Embellissement ${bien.nom}`);
  await saveUser();
  refreshHeader();
  showProprietes();
}

async function nettoyerBien(index){
  const bien=userData.biens[index];
  const cost=Math.floor(bien.prix*CLEAN_COST_PERCENT);
  if(userData.liquidite<cost) return alert('Pas assez de liquidités');
  userData.liquidite-=cost;
  bien.nettoye=true;
  bien.lastClean=now();
  addTransaction('depense', cost, `Nettoyage ${bien.nom}`);
  await saveUser();
  refreshHeader();
  showProprietes();
}

// ================= ENTREPRISES =================
async function buyEnterprise(type){
  const def=ENTERPRISE_TYPES[type];
  if(!def) return alert('Type non valide');
  if(userData.liquidite<def.minPrice) return alert('Pas assez pour acheter');
  userData.liquidite-=def.minPrice;
  userData.entreprises.push({ id:`${type}_${Date.now()}`, type, capital:def.minPrice, monthlyRate:def.monthlyRate, lastPayout:now() });
  addTransaction('depense', def.minPrice, `Achat entreprise ${type}`);
  await saveUser();
  refreshHeader();
  showEntreprises();
}

async function extractOil(index){
  const ent=userData.entreprises[index];
  if(!ent||ent.type!=='petroliere') return alert('Non pétrolière');
  const gain=Math.floor(ent.capital*0.005);
  userData.liquidite+=gain;
  addTransaction('revenu', gain, `Extraction ${ent.type}`);
  await saveUser();
  refreshHeader();
  showEntreprises();
}

// ================= TRANSACTIONS =================
function addTransaction(type, amount, desc){
  userData.transactions=userData.transactions||[];
  userData.transactions.push({ type, amount, desc, date:new Date().toLocaleString('fr-FR') });
}

// ================= TICKS =================
async function applyElapsedTicks(){
  const last=userData.lastTick||now();
  const elapsedDays=Math.floor((now()-last)/MS_PER_DAY);
  if(elapsedDays<=0) return scheduleNextTick();
  for(let d=0;d<elapsedDays;d++){
    userData.biens.forEach(b=>{
      if(b.enLocation){
        const rent=calcDailyRent(b);
        userData.liquidite+=rent;
        addTransaction('revenu', rent, `Loyer journalier ${b.nom}`);
      }
      const maintenance=Math.floor(b.prix*0.005);
      userData.liquidite-=maintenance;
      addTransaction('depense', maintenance, `Entretien journalier ${b.nom}`);
    });
  }
  const elapsedMonths=Math.floor(elapsedDays/DAYS_PER_MONTH);
  for(let m=0;m<elapsedMonths;m++){
    userData.entreprises.forEach(e=>{
      const gain=Math.floor(e.capital*e.monthlyRate);
      userData.liquidite+=gain;
      addTransaction('revenu', gain, `Paiement entreprise ${e.type}`);
    });
    if(userData.debt>0){
      const interest=Math.floor(userData.debt*LOAN_MONTHLY_RATE);
      userData.debt+=interest;
      addTransaction('depense', interest
