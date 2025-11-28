// Collecte revenu manuel
document.getElementById("gain-auto")?.addEventListener("click", async () => {
  EDF.state.capital += EDF.state.revenus;
  await db.collection('users').doc(EDF.currentUserId).set(EDF.state);
});

// Acheter un bien
document.getElementById("acheter-bien")?.addEventListener("click", async () => {
  if(EDF.state.capital < 5000) return alert("Pas assez de capital !");
  EDF.state.capital -= 5000;
  EDF.state.biens++;
  EDF.state.revenus += 10;
  await db.collection('users').doc(EDF.currentUserId).set(EDF.state);
});

// Banque
document.getElementById("depot")?.addEventListener("click", async () => {
  if(EDF.state.capital < 1000) return alert("Pas assez de capital !");
  EDF.state.capital -= 1000;
  EDF.state.liquidites += 1000;
  await db.collection('users').doc(EDF.currentUserId).set(EDF.state);
});
document.getElementById("retrait")?.addEventListener("click", async () => {
  if(EDF.state.liquidites < 1000) return alert("Pas assez de liquidités !");
  EDF.state.liquidites -= 1000;
  EDF.state.capital += 1000;
  await db.collection('users').doc(EDF.currentUserId).set(EDF.state);
});

// Château
document.getElementById("upgrade-chateau")?.addEventListener("click", async () => {
  const prix = 50000 * EDF.state.chateau;
  if(EDF.state.capital < prix) return alert("Pas assez de capital !");
  EDF.state.capital -= prix;
  EDF.state.chateau++;
  EDF.state.revenus += 50;
  await db.collection('users').doc(EDF.currentUserId).set(EDF.state);
});
