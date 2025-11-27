// script.js - Empire des Finances COMPLET v1.0

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

/* ================= CONFIG ================= */
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

/* ================= CONSTANTES ================= */
const STARTING_CAPITAL = 300000;
const RENT_BASE_PERCENT = 0.03;
const CLEAN_COST_PERCENT = 0.01;
const CLEAN_BENEFIT = 0.05;
const NO_CLEAN_PENALTY = -0.1;
const EMBELLISH_INCREASE = 0.25;
const LOAN_MAX_MULTIPLIER = 3.5;
const LOAN_MONTHLY_RATE = 0.05;
const REAL_MS_PER_DAY = (4*60*60*1000)/30;
const MS_PER_DAY = REAL_MS_PER_DAY;
const DAYS_PER_MONTH = 30;
const DEFAULT_CLEAN_INTERVAL_DAYS = 10;

/* ================= ÉTAT ================= */
let userData = null;
let userEmail = null;
let displayName = null;
let userDocRef = null;

/* ================= LISTES ================= */
const PERSONAL_PROPERTIES = [
  {id:"studio01", nom:"Studio 20m²", prix:60000, type:"appartement"},
  {id:"app45", nom:"Appartement 45m²", prix:90000, type:"appartement"},
  {id:"maisonville", nom:"Maison de ville", prix:150000, type:"maison"},
  {id:"loft", nom:"Loft industriel", prix:220000, type:"appartement"},
  {id:"villa01", nom:"Villa moderne", prix:700000, type:"villa"},
  {id:"manoir01", nom:"Manoir", prix:1200000, type:"manoir"},
  {id:"chateau01", nom:"Château ancien", prix:4500000, type:"chateau"}
];

const ENTERPRISE_TYPES = {
  agricole: [
    {id:"farmSmall", nom:"Ferme familiale", prix:380000},
    {id:"farmLarge", nom:"Ferme industrielle", prix:1200000},
    {id:"terrainFerme", nom:"Terrain agricole", prix:150000}
  ],
  commerciale: [
    {id:"commerceSmall", nom:"Local commercial petit", prix:110000},
    {id:"commerceLarge", nom:"Local commercial grand", prix:400000}
  ],
  petroliere: [
    {id:"petro01", nom:"Champ pétrolier", prix:50000000}
  ]
};

/* ================= UTILITAIRES ================= */
const fmt = n=>Math.round(n).toLocaleString();
const now = ()=>Date.now();
function computePatrimoine(){
  const liquid = userData.liquidite||0;
  const biens = (userData.biens||[]).reduce((s,b)=>s+(b.prix||0),0);
  const ent = (userData.entreprises||[]).reduce((s,e)=>s+(e.capital||0),0);
  const debt = userData.debt||0;
  return Math.round(liquid + biens + ent - debt);
}

/* ================= SAUVEGARDE ================= */
async function saveUser(){
  if(!userDocRef || !userData) return;
  await setDoc(userDocRef, userData, {merge:true});
}

/* ================= LOGIN ================= */
async function loginWithGoogle(){
  const provider = new GoogleAuthProvider();
  signInWithPopup(auth, provider).then(async (res)=>{
    userEmail = res.user.email;
    displayName = res.user.displayName||userEmail.split("@")[0];
    userDocRef = doc(db,"joueurs",userEmail);
    const snap = await getDoc(userDocRef);
    if(!snap.exists()){
      userData = {
        email:userEmail,
        name:displayName,
        liquidite:STARTING_CAPITAL,
        biens:[],
        entreprises:[],
        debt:0,
        transactions:[],
        lastTick:now(),
        lastCleanTick:now(),
        cleanIntervalDays:DEFAULT_CLEAN_INTERVAL_DAYS
      };
      await saveUser();
    } else {
      userData = snap.data();
      userData.liquidite = userData.liquidite??STARTING_CAPITAL;
      userData.biens = userData.biens??[];
      userData.entreprises = userData.entreprises??[];
      userData.debt = userData.debt??0;
      userData.transactions = userData.transactions??[];
      userData.lastTick = userData.lastTick??now();
      userData.lastCleanTick = userData.lastCleanTick??now();
      userData.cleanIntervalDays = userData.cleanIntervalDays??DEFAULT_CLEAN_INTERVAL_DAYS;
    }
    initUI();
    await applyElapsedTicks();
  }).catch(e=>alert("Erreur login : "+e));
}

function logout(){ auth.signOut(); location.reload(); }

/* ================= INIT UI ================= */
function initUI(){
  document.getElementById("loginCard").classList.add("hidden");
  document.getElementById("playerCard").classList.remove("hidden");
  document.getElementById("menuCard").classList.remove("hidden");
  document.getElementById("content").classList.remove("hidden");
  refreshHeader();
  window.showProprietes=showProprietes;
  window.showEntreprises=showEntreprises;
  window.showBoutique=showBoutique;
  window.showBanque=showBanque;
  window.showFinances=showFinances;
  window.showOptions=showOptions;
  window.showDemocratie=showDemocratie;
  window.acheterBien=acheterBien;
  window.embellirBien=embellirBien;
  window.louerBien=louerBien;
  window.stopLocation=stopLocation;
  window.vendreBien=vendreBien;
  window.nettoyerBien=nettoyerBien;
  window.buyEnterprise=buyEnterprise;
  window.extractOil=extractOil;
  window.takeLoan=takeLoan;
  window.repayLoan=repayLoan;
  window.organiserEvenement=organiserEvenement;
  window.resetGame=resetGame;
  window.advanceDay=advanceDay;
  window.advanceMonth=advanceMonth;
  window.logout=logout;
  setupChat();
}

/* ================= HEADER ================= */
function refreshHeader(){
  document.getElementById("emailDisplay").textContent=userData.email||"";
  document.getElementById("usernameDisplay").textContent=userData.name||"";
  document.getElementById("liquiditeDisplay").textContent=fmt(userData.liquidite||0);
  document.getElementById("capitalDisplay").textContent=fmt(computePatrimoine());
  document.getElementById("nbBiensDisplay").textContent=(userData.biens||[]).length;
  document.getElementById("nbEntreprisesDisplay").textContent=(userData.entreprises||[]).length;
}

/* ================= CONTENU ================= */
function setContent(html){ document.getElementById("content").innerHTML=html; }

function showProprietes(){
  const biens=userData.biens||[];
  if(!biens.length){ setContent("<h2>Mes Propriétés</h2><p>Aucun bien.</p>"); return; }
  let html=`<h2>Mes Propriétés</h2><div class="grid">`;
  biens.forEach((b,i)=>{
    const nettoyeBadge = b.nettoye?'<span class="badge">Nettoyé</span>':'';
    const embBadge = b.embelli?'<span class="embelli-badge">Embellie</span>':'';
    const typeLabel = b.type==="chateau"?"Château / Tourisme":b.type;
    const locationBtn = b.type==="chateau"?`<button class="btn" onclick="organiserEvenement(${i})">Organiser événement</button>`:b.enLocation?`<button class="btn alt" onclick="stopLocation(${i})">Arrêter location</button>`:`<button class="btn" onclick="louerBien(${i})">Louer</button>`;
    html+=`<div class="card"><div style="display:flex;justify-content:space-between;align-items:center">
      <div><strong>${b.nom}</strong>${embBadge}${nettoyeBadge}<div class="small">Type: ${typeLabel}</div></div>
      <div><span class="small">Valeur: ${fmt(b.prix)} €</span></div></div>
      <p>Status: ${b.enLocation?"Loué":"Libre"}</p>
      <p>Revenu potentiel/jour: ${fmt(calcDailyRent(b))} €</p>
      <div class="controls">
        ${locationBtn}
        <button class="btn" onclick="vendreBien(${i})">Vendre (80%)</button>
        ${b.embelli?"":`<button class="btn alt" onclick="embellirBien(${i})">Embellir (+25%)</button>`}
        <button class="btn" onclick="nettoyerBien(${i})">Nettoyer (1% valeur)</button>
      </div></div>`;
  });
  html+="</div>";
  setContent(html);
}

function showBoutique(){
  let html="<h2>Boutique</h2><div class='grid'>";
  PERSONAL_PROPERTIES.forEach((m,i)=>{
    html+=`<div class="card"><strong>${m.nom}</strong><p>Prix: ${fmt(m.prix)} €</p><p>Type: ${m.type}</p>
    <div class="controls"><button class="btn" onclick="acheterBien(${i})">Acheter</button></div></div>`;
  });
  html+="</div>";
  setContent(html);
}

function showEntreprises(){
  const list=userData.entreprises||[];
  let html="<h2>Entreprises</h2>";
  html+="<div class='controls'>";
  Object.keys(ENTERPRISE_TYPES).forEach(type=>{
    ENTERPRISE_TYPES[type].forEach((ent,idx)=>{
      html+=`<button class="btn" onclick="buyEnterprise('${type}',${idx})">Acheter ${ent.nom} (${fmt(ent.prix)} €)</button>`;
    });
  });
  html+="</div>";
  if(!list.length) html+="<p>Aucune entreprise possédée.</p>";
  else{
    html+="<div class='grid'>";
    list.forEach((e,idx)=>{
      html+=`<div class="card"><strong>${e.nom}</strong><p>Capital investi: ${fmt(e.capital)} €</p>
      <p>Revenu mensuel: ${Math.round((e.monthlyRate||0)*100)}%</p>
      ${e.type==="petroliere"?`<button class="btn" onclick="extractOil(${idx})">Forer / Extraire</button>`:""}
      </div>`;
    });
    html+="</div>";
  }
  setContent(html);
}

function showBanque(){
  setContent(`<h2>Banque</h2>
    <p>Dette actuelle: ${fmt(userData.debt||0)} €</p>
    <p>Patrimoine: ${fmt(computePatrimoine())} €</p>
    <div class="controls"><input id="loanAmount" placeholder="Montant emprunt" style="padding:8px;border-radius:6px;border:1px solid #ddd"/>
      <button class="btn" onclick="takeLoan()">Emprunter</button>
      <button class="btn alt" onclick="repayLoan()">Rembourser</button></div>
    <p class="small">Max empruntable: ${fmt(computePatrimoine()*LOAN_MAX_MULTIPLIER)} € (350% du patrimoine)</p>`);
}

function showFinances(){
  const tx=userData.transactions||[];
  if(!tx.length){ setContent("<h2>Finances</h2><p>Aucune transaction.</p>"); return; }
  let html=`<h2>Finances</h2><table class="table"><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Montant</th></tr></thead><tbody>`;
  tx.slice().reverse().forEach(t=>{
    html+=`<tr><td>${t.date}</td><td>${t.type}</td><td>${t.desc}</td><td style="color:${t.type==='revenu'?'green':'red'};">${fmt(t.amount)} €</td></tr>`;
  });
  html+="</tbody></table>";
  setContent(html);
}

function showOptions(){
  setContent(`<h2>Options</h2>
    <div class="controls"><button class="btn" onclick="advanceDay()">Avancer 1 jour</button>
    <button class="btn" onclick="advanceMonth()">Avancer 1 mois</button>
    <button class="btn alt" onclick="resetGame()">Réinitialiser</button></div>
    <p class="small">Nettoyage auto tous les ${userData.cleanIntervalDays||DEFAULT_CLEAN_INTERVAL_DAYS} jours</p>`);
}

function showDemocratie(){
  setContent("<h2>Démocratie</h2><p>Page vide.</p>");
}

/* ================= ACTIONS BIENS ================= */
async function acheterBien(index){
  const item=PERSONAL_PROPERTIES[index];
  if(userData.liquidite<item.prix) return alert("Pas assez de liquidités !");
  userData.liquidite-=item.prix;
  const newProp={id:item.id+"_"+Date.now(),nom:item.nom,prix:item.prix,type:item.type,enLocation:false,embelli:false,nettoye:false,lastClean:now()};
  userData.biens.push(newProp);
  addTransaction('depense',item.prix,`Achat bien ${item.nom}`);
  await saveUser();
  refreshHeader();
  showProprietes();
}

function calcDailyRent(bien){
  if(bien.type==="chateau") return 0;
  let base=bien.prix*RENT_BASE_PERCENT;
  let cleaningMod=0;
  if(bien.nettoye) cleaningMod+=CLEAN_BENEFIT;
  const daysSinceClean=Math.floor((now()-(bien.lastClean||userData.lastTick||now()))/MS_PER_DAY);
  if(daysSinceClean>(userData.cleanIntervalDays||DEFAULT_CLEAN_INTERVAL_DAYS)) cleaningMod+=NO_CLEAN_PENALTY;
  return Math.max(0,Math.floor(base*(1+cleaningMod)));
}

async function louerBien(index){
  const b=userData.biens[index];
  if(b.enLocation) return alert("Déjà loué");
  const rent=calcDailyRent(b);
  userData.liquidite+=rent;
  b.enLocation=true;
  addTransaction('revenu',rent,`Loyer jour pour ${b.nom}`);
  await saveUser();
  refreshHeader();
  showProprietes();
}

async function stopLocation(index){ userData.biens[index].enLocation=false; await saveUser(); showProprietes(); }

async function vendreBien(index){
  const b=userData.biens[index];
  if(!confirm(`Vendre ${b.nom} pour 80% ?`)) return;
  const sale=Math.floor(b.prix*0.8);
  userData.liquidite+=sale;
  addTransaction('revenu',sale,`Vente ${b.nom}`);
  userData.biens.splice(index,1);
  await saveUser();
  refreshHeader();
  showProprietes();
}

async function embellirBien(index){
  const b=userData.biens[index];
  if(b.embelli) return alert("Déjà embelli");
  const cost=Math.floor(b.prix*EMBELLISH_INCREASE);
  if(userData.liquidite<cost) return alert("Pas assez pour embellir");
  if(!confirm(`Payer ${fmt(cost)} € pour embellir ${b.nom} ?`)) return;
  userData.liquidite-=cost;
  b.prix=Math.round(b.prix*(1+EMBELLISH_INCREASE));
  b.embelli=true;
  addTransaction('depense',cost,`Embellissement ${b.nom}`);
  await saveUser();
  refreshHeader();
  showProprietes();
}

async function nettoyerBien(index){
  const b=userData.biens[index];
  const cost=Math.floor(b.prix*CLEAN_COST_PERCENT);
  if(userData.liquidite<cost) return alert("Pas assez pour nettoyage");
  userData.liquidite-=cost;
  b.nettoye=true;
  b.lastClean=now();
  addTransaction('depense',cost,`Nettoyage ${b.nom}`);
  await saveUser();
  refreshHeader();
  showProprietes();
}

/* ================= ENTREPRISES ================= */
async function buyEnterprise(type,index){
  const entDef=ENTERPRISE_TYPES[type][index];
  if(userData.liquidite<entDef.prix) return alert("Pas assez pour cette entreprise");
  userData.liquidite-=entDef.prix;
  const ent={id:entDef.id+"_"+Date.now(),nom:entDef.nom,type,capital:entDef.prix,monthlyRate:type==="agricole"?0.03:type==="commerciale"?0.04:0.08,lastPayout:now()};
  userData.entreprises.push(ent);
  addTransaction('depense',entDef.prix,`Achat entreprise ${ent.nom}`);
  await saveUser();
  refreshHeader();
  showEntreprises();
}

async function extractOil(idx){
  const e=userData.entreprises[idx];
  if(!e || e.type!=="pet
