import { EDF } from './ui.js';
import { db } from './firebase-config.js';
import { doc, setDoc, getDoc } from "firebase/firestore";

// Collecte revenu manuel
document.getElementById("gain-auto")?.addEventListener("click", async () => {
  EDF.state.capital += EDF.state.revenus;
  await setDoc(doc(db, 'users', EDF.currentUserId), EDF.state);
});

// Acheter un bien
document.getElementById("acheter-bien")?.addEventListener("click", async () => {
  if(EDF.state.capital < 5000) return alert("Pas assez de capital !");
  EDF.state.capital -= 5000;
  EDF.state.biens++;
  EDF.state.revenus += 10;
  await setDoc(doc(db, 'users', EDF.currentUserId), EDF.state);
});

// Banque
document.getElementById("depot")?.addEventListener("click", async () => {
  if(EDF.state.capital < 1000) return alert("Pas assez de capital !");
  EDF.state.capital -= 1000;
  EDF.state.liquidites += 1000;
  await setDoc(doc(db, 'users', EDF.currentUserId), EDF.state);
});
document.getElementById("retrait")?.addEventListener("click", async () => {
  if(EDF.state.liquidites < 1000) return alert("Pas assez de liquidités !");
  EDF.state.liquidites -= 1000;
  EDF.state.capital += 1000;
  await setDoc(doc(db, 'users', EDF.currentUserId), EDF.state);
});

// Château
document.getElementById("upgrade-chateau")?.addEventListener("click", async () => {
  const prix = 50000 * EDF.state.chateau;
  if(EDF.state.capital < prix) return alert("Pas assez de capital !");
  EDF.state.capital -= prix;
  EDF.state.chateau++;
  EDF.state.revenus += 50;
  await setDoc(doc(db, 'users', EDF.currentUserId), EDF.state);
});
