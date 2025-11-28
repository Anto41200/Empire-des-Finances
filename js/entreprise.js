import { EDF } from './ui.js';
import { db } from './firebase-config.js';
import { doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";

const btnAgri = document.getElementById('create-agri');
const btnCom = document.getElementById('create-com');
const listeDiv = document.getElementById('liste');
const detailsPanel = document.getElementById('details-panel');
const detNom = document.getElementById('det-nom');
const detType = document.getElementById('det-type');
const detInvest = document.getElementById('det-invest');
const detRevenus = document.getElementById('det-revenus');
const btnCollect = document.getElementById('collect-revenus');
const btnClose = document.getElementById('close-details');

let currentEntreprise = null;

onSnapshot(doc(db, 'users', EDF.currentUserId), () => {
  renderListe();
});

btnAgri?.addEventListener('click', ()=>creerEntreprise('agricole'));
btnCom?.addEventListener('click', ()=>creerEntreprise('commerciale'));

async function creerEntreprise(type){
  const prix = type==='agricole'?20000:30000;
  const docRef = doc(db, 'users', EDF.currentUserId);
  const userDoc = await getDoc(docRef);
  const data = userDoc.data();
  if(data.capital < prix){ return alert("Pas assez de capital !"); }
  data.capital -= prix;
  if(!data.entreprises) data.entreprises=[];
  const entreprise = {
    id: Date.now(),
    type,
    nom: type.charAt(0).toUpperCase() + type.slice(1)+' '+(data.entreprises.length+1),
    investissement: prix,
    revenus: type==='agricole'?50:75
  };
  data.entreprises.push(entreprise);
  await setDoc(docRef, data);
  renderListe();
}

async function renderListe(){
  const docRef = doc(db, 'users', EDF.currentUserId);
  const userDoc = await getDoc(docRef);
  const data = userDoc.data();
  listeDiv.innerHTML = '';
  if(!data.entreprises || data.entreprises.length===0){ listeDiv.innerHTML='<p>Aucune entreprise</p>'; return; }
  data.entreprises.forEach(e=>{
    const div = document.createElement('div');
    div.className='entreprise-item';
    div.innerHTML=`<strong>${e.nom}</strong> (${e.type}) <button data-id='${e.id}'>Voir</button>`;
    div.querySelector('button').addEventListener('click', ()=>voirEntreprise(e.id));
    listeDiv.appendChild(div);
  });
}

async function voirEntreprise(id){
  const docRef = doc(db, 'users', EDF.currentUserId);
  const userDoc = await getDoc(docRef);
  const data = userDoc.data();
  const e = data.entreprises.find(x=>x.id===id);
  if(!e) return;
  currentEntreprise = e;
  detNom.textContent = e.nom;
  detType.textContent = e.type;
  detInvest.textContent = e.investissement;
  detRevenus.textContent = e.revenus;
  detailsPanel.classList.remove('hidden');
}

btnClose?.addEventListener('click', ()=>{ detailsPanel.classList.add('hidden'); currentEntreprise=null; });

btnCollect?.addEventListener('click', async ()=>{
  if(!currentEntreprise) return;
  const docRef = doc(db, 'users', EDF.currentUserId);
  const userDoc = await getDoc(docRef);
  const data = userDoc.data();
  data.capital += currentEntreprise.revenus;
  await setDoc(docRef, data);
  alert(`Revenus ${currentEntreprise.revenus} € collectés !`);
  renderListe();
});

// Revenus automatiques toutes les minutes
setInterval(async ()=>{
  const docRef = doc(db, 'users', EDF.currentUserId);
  const userDoc = await getDoc(docRef);
  const data = userDoc.data();
  if(!data.entreprises) return;
  let total=0;
  data.entreprises.forEach(e=> total+=e.revenus);
  data.capital += total;
  await setDoc(docRef, data);
  renderListe();
},60000);
