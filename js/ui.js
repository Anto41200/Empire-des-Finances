import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

export const EDF = { state: null, currentUserId: null };

onAuthStateChanged(auth, (user) => {
  if(!user) { window.location.href="index.html"; return; }
  EDF.currentUserId = user.uid;

  const elCapital = document.getElementById("capital");
  const elLiquid = document.getElementById("liquidites");
  const elRevenus = document.getElementById("revenus");
  const elBiens = document.getElementById("biens");
  const elChateau = document.getElementById("chateau-niveau");
  const logoutBtn = document.getElementById("logout-btn");

  logoutBtn?.addEventListener('click', ()=> auth.signOut());

  const userDoc = doc(db, 'users', EDF.currentUserId);
  onSnapshot(userDoc, (docSnap)=>{
    const data = docSnap.data();
    EDF.state = data;
    elCapital.textContent = data.capital;
    elLiquid.textContent = data.liquidites;
    elRevenus.textContent = data.revenus;
    elBiens.textContent = data.biens;
    elChateau.textContent = data.chateau;
  });
});
