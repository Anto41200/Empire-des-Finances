// script.js (version ultra complète pour Empire des Finances)
// Module Firebase (Firestore + Auth)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// ================= CONFIG =================
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
const provider = new GoogleAuthProvider();

// ================= CONSTANTES JEU =================
const STARTING_CAPITAL = 300_000;
const RENT_BASE_PERCENT = 0.03;
const CLEAN_COST_PERCENT = 0.01;
const CLEAN_BENEFIT = 0.05;
const NO_CLEAN_PENALTY = -0.1;
const EMBELLISH_INCREASE = 0.25;
const LOAN_MAX_MULTIPLIER = 3.5;
const LOAN_MONTHLY_RATE = 0.05;
const REAL_MS_PER_DAY = (4 * 60 * 60 * 1000) / 30; // 1 jour = 8min
const MS_PER_DAY = REAL_MS_PER_DAY;
const DAYS_PER_MONTH = 30;
const DEFAULT_CLEAN_INTERVAL_DAYS = 10;

// Entreprises
const ENTERPRISE_TYPES = {
  agricole: [{ nom: "Ferme familiale", prix: 380_000 }, { nom: "Ferme industrielle", prix: 1_200_000 }],
  commerciale: [{ nom: "Commerce petit", prix: 110_000 }, { nom: "Commerce grand", prix: 400_000 }],
  petroliere: [{ nom: "Champ pétrolier", prix: 50_000_000 }]
};

// Biens personnels
const MARKET_BIENS = [
  { id: "studio01", nom: "Studio 20m²", prix: 60_000, type: "appartement" },
  { id: "app45", nom: "Appartement 45m²", prix: 90_000, type: "appartement" },
  { id: "maisonville", nom: "Maison de ville", prix: 150_000, type: "maison" },
  { id: "loft", nom: "Loft industriel", prix: 220_000, type: "appartement" },
  { id: "villa01", nom: "Villa moderne", prix: 700_000, type: "villa" },
  { id: "manoir01", nom: "Manoir", prix: 1_200_000, type: "manoir" },
  { id: "chateau01", nom: "Château ancien", prix: 4_500_000, type: "chateau" } // tourisme
];

// ================= ÉTAT =================
let userData = null;
let userEmail = null;
let displayName = null;
let chatUnsub = null;

// ================= UTILITAIRES =================
const fmt = n => Math.round(n).toLocaleString();
const now = () => Date.now();

function totalValueBiens() {
  return (userData.biens || []).reduce((s, b) => s + (b.prix || 0), 0);
}
function totalValueEntreprises() {
  return (userData.entreprises || []).reduce((s, e) => s + (e.capital || 0), 0);
}
function computePatrimoine() {
  const liquid = userData.liquidite || 0;
  const biens = totalValueBiens();
  const ent = totalValueEntreprises();
  const debt = userData.debt || 0;
  return Math.round(liquid + biens + ent - debt);
}
async function saveUser() {
  if (!userData || !userEmail) return;
  const ref = doc(db, "joueurs", userEmail);
  await setDoc(ref, userData, { merge: true });
}

// ================= LOGIN =================
async function loginEmail() {
  const email = document.getElementById("emailInput").value.trim().toLowerCase();
  const name = document.getElementById("usernameInput").value.trim() || email.split("@")[0];
  if (!email) return alert("Entre ton email valide");
  userEmail = email;
  displayName = name;
  await loadOrCreateUser();
}

async function loginGoogle() {
  const result = await signInWithPopup(auth, provider);
  userEmail = result.user.email;
  displayName = result.user.displayName || result.user.email.split("@")[0];
  await loadOrCreateUser();
}

async function loadOrCreateUser() {
  const ref = doc(db, "joueurs", userEmail);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    userData = {
      email: userEmail,
      name: displayName,
      liquidite: STARTING_CAPITAL,
      biens: [],
      entreprises: [],
      debt: 0,
      transactions: [],
      lastTick: now(),
      lastCleanTick: now(),
      cleanIntervalDays: DEFAULT_CLEAN_INTERVAL_DAYS
    };
    await setDoc(ref, userData);
  } else {
    userData = snap.data();
  }
  showGameUI();
  await applyElapsedTicks();
  setupChat();
}

// Auto reconnexion Google
onAuthStateChanged(auth, user => {
  if (user) {
    userEmail = user.email;
    displayName = user.displayName || user.email.split("@")[0];
    loadOrCreateUser();
  }
});

// ================= UI =================
function showGameUI() {
  document.getElementById("loginCard").classList.add("hidden");
  document.getElementById("playerCard").classList.remove("hidden");
  document.getElementById("menuCard").classList.remove("hidden");
  document.getElementById("content").classList.remove("hidden");
  refreshHeader();
}

function refreshHeader() {
  document.getElementById("emailDisplay").textContent = userData.email || "";
  document.getElementById("usernameDisplay").textContent = userData.name || "";
  document.getElementById("liquiditeDisplay").textContent = fmt(userData.liquidite || 0);
  document.getElementById("capitalDisplay").textContent = fmt(computePatrimoine());
  document.getElementById("nbBiensDisplay").textContent = (userData.biens || []).length;
  document.getElementById("nbEntreprisesDisplay").textContent = (userData.entreprises || []).length;
}

// ================= PAGES =================
function setContent(html){ document.getElementById("content").innerHTML = html; }

function showProprietes() {
  const biens = userData.biens || [];
  let html = `<h2>Mes Propriétés</h2>`;
  if (!biens.length) { html += "<p>Aucun bien.</p>"; setContent(html); return; }
  html += `<div class="grid">`;
  biens.forEach((b,i)=>{
    const nettoyeBadge = b.nettoye ? `<span class="badge">Nettoyé</span>` : "";
    const embBadge = b.embelli ? `<span class="embelli-badge">Embellie</span>` : "";
    const tourismBadge = b.type==="chateau" ? `<span class="badge-tourisme">Tourisme</span>` : "";
    html += `<div class="card">
      <strong>${b.nom}</strong>${embBadge}${nettoyeBadge}${tourismBadge}<p>Valeur: ${fmt(b.prix)} €</p>
      <p>Status: ${b.enLocation ? "Loué" : b.type==="chateau"?"Tourisme":"Libre"}</p>
      <div class="controls">`;
    if(b.type==="chateau") html += `<button class="btn" onclick="organiserTourisme(${i})">Organiser tourisme</button>`;
    else html += `<button class="btn" onclick="louerBien(${i})">Louer</button>`;
    html += `<button class="btn alt" onclick="vendreBien(${i})">Vendre (80%)</button>
      <button class="btn" onclick="embellirBien(${i})">Embellir (+25%)</button>
      <button class="btn" onclick="nettoyerBien(${i})">Nettoyer</button>
      </div></div>`;
  });
  html += `</div>`;
  setContent(html);
}

function showEntreprises() {
  let html = `<h2>Entreprises</h2>`;
  html += `<div class="controls">
    <button class="btn" onclick="acheterEntreprise('agricole')">Acheter Ferme</button>
    <button class="btn" onclick="acheterEntreprise('commerciale')">Acheter Commerce</button>
    <button class="btn" onclick="acheterEntreprise('petroliere')">Acheter Pétrole</button>
  </div>`;
  const list = userData.entreprises || [];
  if(!list.length) html += "<p>Aucune entreprise possédée.</p>";
  else {
    html += `<div class="grid">`;
    list.forEach((e,idx)=>{
      html += `<div class="card"><strong>${e.type.toUpperCase()}</strong><p>Capital investi: ${fmt(e.capital)}</p>
      <p>Revenu mensuel: ${Math.round(e.monthlyRate*100)}%</p>
      <p>${e.type==='petroliere'?`<button class="btn" onclick="extractOil(${idx})">Forer / Extraire</button>`:""}</p></div>`;
    });
    html += `</div>`;
  }
  setContent(html);
}

function showBanque() {
  setContent(`<h2>Banque</h2>
    <p>Dette actuelle: ${fmt(userData.debt)}</p>
    <p>Patrimoine: ${fmt(computePatrimoine())}</p>
    <div class="controls"><input id="loanAmount" placeholder="Montant emprunt"/>
      <button class="btn" onclick="takeLoan()">Emprunter</button>
      <button class="btn alt" onclick="repayLoan()">Rembourser</button></div>`);
}

function showDemocratie() {
  setContent(`<h2>Démocratie</h2><p>Page vide.</p>`);
}

// ================= ACTIONS =================
function addTransaction(type, amount, desc){
  userData.transactions = userData.transactions || [];
  userData.transactions.push({ type, amount, desc, date: new Date().toLocaleString("fr-FR") });
}

async function acheterBien(index){
  const item = MARKET_BIENS[index];
  if(userData.liquidite<item.prix) return alert("Pas assez de liquidités !");
  userData.liquidite -= item.prix;
  userData.biens.push({ ...item, enLocation:false, embelli:false, nettoye:false, lastClean: now() });
  addTransaction('depense', item.prix, `Achat ${item.nom}`);
  await saveUser();
  refreshHeader();
  showProprietes();
}

async function louerBien(index){
  const bien = userData.biens[index];
  if(bien.enLocation) return alert("Déjà loué");
  bien.enLocation=true;
  addTransaction('revenu', Math.floor(bien.prix*RENT_BASE_PERCENT), `Loyer ${bien.nom}`);
  userData.liquidite += Math.floor(bien.prix*RENT_BASE_PERCENT);
  await saveUser();
  refreshHeader();
  showProprietes();
}

async function vendreBien(index){
  const bien = userData.biens[index];
  const sale = Math.floor(bien.prix*0.8);
  if(!confirm(`Vendre ${bien.nom} pour ${fmt(sale)} € ?`)) return;
  userData.liquidite += sale;
  addTransaction('revenu', sale, `Vente ${bien.nom}`);
  userData.biens.splice(index,1);
  await saveUser();
  refreshHeader();
  showProprietes();
}

async function embellirBien(index){
  const bien = userData.biens[index];
  const cost = Math.floor(bien.prix*EMBELLISH_INCREASE);
  if(userData.liquidite<cost) return alert("Pas assez de liquidités !");
  bien.prix = Math.floor(bien.prix*(1+EMBELLISH_INCREASE));
  bien.embelli=true;
  userData.liquidite -= cost;
  addTransaction('depense', cost, `Embellissement ${bien.nom}`);
  await saveUser();
  refreshHeader();
  showProprietes();
}

async function nettoyerBien(index){
  const bien = userData.biens[index];
  const cost = Math.floor(bien.prix*CLEAN_COST_PERCENT);
  if(userData.liquidite<cost) return alert("Pas assez de liquidité !");
  bien.nettoye=true; bien.lastClean=now();
  userData.liquidite-=cost;
  addTransaction('depense', cost, `Nettoyage ${bien.nom}`);
  await saveUser();
  refreshHeader();
  showProprietes();
}

async function organiserTourisme(index){
  const bien = userData.biens[index];
  alert(`Organisation d'événements et visites pour ${bien.nom} (mode tourisme)`);
}

// ================= ENTREPRISES =================
async function acheterEntreprise(type){
  const options = ENTERPRISE_TYPES[type];
  const item = options[0]; // simplifié : prend le premier
  if(userData.liquidite<item.prix) return alert("Pas assez de liquidité !");
  userData.liquidite-=item.prix;
  userData.entreprises.push({ id:type+'_'+Date.now(), type, capital:item.prix, monthlyRate:0.03 });
  addTransaction('depense', item.prix, `Achat entreprise ${type}`);
  await saveUser();
  refreshHeader();
  showEntreprises();
}

async function extractOil(idx){
  const ent = userData.entreprises[idx];
  if(ent.type!=='petroliere') return;
  const gain = Math.floor(ent.capital*0.005);
  userData.liquidite+=gain;
  addTransaction('revenu', gain, `Extraction pétrole ${ent.id}`);
  await saveUser();
  refreshHeader();
  showEntreprises();
}

// ================= BANQUE =================
async function takeLoan(){
  const val = Number(document.getElementById("loanAmount").value || 0);
  const max = Math.floor(computePatrimoine()*LOAN_MAX_MULTIPLIER);
  if(val>max) return alert("Montant trop élevé !");
  userData.liquidite+=val; userData.debt+=(userData.debt||0)+val;
  addTransaction('revenu', val, "Emprunt");
  await saveUser();
  refreshHeader();
  showBanque();
}

async function repayLoan(){
  const repay = Math.min(userData.liquidite||0, userData.debt||0);
  if(repay<=0) return alert("Rien à rembourser !");
  userData.liquidite-=repay; userData.debt-=repay;
  addTransaction('depense', repay, "Remboursement dette");
  await saveUser();
  refreshHeader();
  showBanque();
}

// ================= TICKS =================
async function applyElapsedTicks(){
  // simulate simple daily updates
  userData.lastTick = userData.lastTick || now();
  await saveUser();
  refreshHeader();
  setTimeout(applyElapsedTicks, MS_PER_DAY);
}

// ================= CHAT =================
async function setupChat(){
  const chatCol = collection(db,"chat");
  const chatList = document.getElementById("chatList");
  if(chatUnsub) chatUnsub();
  chatUnsub = onSnapshot(query(chatCol, orderBy("timestamp","asc")), snap=>{
    chatList.innerHTML="";
    snap.forEach(doc=>{
      const data = doc.data();
      const div = document.createElement("div");
      div.innerHTML=`<b>${data.name}:</b> ${data.message}`;
      chatList.appendChild(div);
    });
    chatList.scrollTop = chatList.scrollHeight;
  });
}

async function sendMessage(){
  const input = document.getElementById("chatInput");
  const msg = input.value.trim();
  if(!msg) return;
  await addDoc(collection(db,"chat"), { name:displayName, message:msg, timestamp:now() });
  input.value="";
}

// ================= LOGOUT =================
function logout(){ signOut(auth).then(()=>location.reload()); }

// ================= EXPORT GLOBAL =================
window.loginEmail=loginEmail;
window.loginGoogle=loginGoogle;
window.showProprietes=showProprietes;
window.showEntreprises=showEntreprises;
window.showBanque=showBanque;
window.showDemocratie=showDemocratie;
window.acheterBien=acheterBien;
window.louerBien=louerBien;
window.vendreBien=vendreBien;
window.embellirBien=embellirBien;
window.nettoyerBien=nettoyerBien;
window.organiserTourisme=organiserTourisme;
window.acheterEntreprise=acheterEntreprise;
window.extractOil=extractOil;
window.takeLoan=takeLoan;
window.repayLoan=repayLoan;
window.sendMessage=sendMessage;
window.logout=logout;

// ================= START =================
applyElapsedTicks();
