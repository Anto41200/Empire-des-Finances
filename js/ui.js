auth.onAuthStateChanged(user => {
  if(!user) { window.location.href="index.html"; return; }
  EDF.currentUserId = user.uid;

  // Références DOM
  const elCapital = document.getElementById("capital");
  const elLiquid = document.getElementById("liquidites");
  const elRevenus = document.getElementById("revenus");
  const elBiens = document.getElementById("biens");
  const elChateau = document.getElementById("chateau-niveau");

  const logoutBtn = document.getElementById("logout-btn");
  logoutBtn?.addEventListener('click', ()=> auth.signOut());

  // Render toutes les stats depuis Firestore
  db.collection('users').doc(EDF.currentUserId)
    .onSnapshot(doc => {
      const data = doc.data();
      elCapital.textContent = data.capital;
      elLiquid.textContent = data.liquidites;
      elRevenus.textContent = data.revenus;
      elBiens.textContent = data.biens;
      elChateau.textContent = data.chateau;
      EDF.state = data;
    });
});
