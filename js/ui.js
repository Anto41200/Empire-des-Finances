/* ==================================================
   UI.JS — Empire des Finances
   Gère : affichage, boutons, navigation, logout, panneaux
   (Version propre et séparée)
   ================================================== */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ==========================
   AUTO-INIT
   ==========================*/
(function(){
  try{
    const path = window.location.pathname.split('/').pop();

    // Page index
    if (path === '' || path === 'index.html') {
      if ($('#login-btn')) initIndexUI();
    }

    // Page dashboard
    if (path === 'dashboard.html' || $('#capital')) {
      initDashboardUI();
    }

  } catch(e){ console.error('UI init error', e); }
})();

/* ==========================
   INDEX.html UI
   ==========================*/

function initIndexUI(){
  const loginBtn = $('#login-btn');
  const regBtn = $('#register-btn');

  loginBtn?.addEventListener('click', ()=>{
    const u = $('#login-username').value;
    const p = $('#login-password').value;
    const r = loginAccount(u,p);
    if(!r.ok) return alert(r.msg);
    window.location.href = 'dashboard.html';
  });

  regBtn?.addEventListener('click', ()=>{
    const u = $('#register-username').value;
    const p = $('#register-password').value;
    const r = registerAccount(u,p);
    if(!r.ok) return alert(r.msg);
    alert('Compte créé !');
    loginAccount(u,p);
    window.location.href = 'dashboard.html';
  });
}

/* ==========================
   DASHBOARD UI
   ==========================*/

function initDashboardUI(){
  const user = requireAuth();
  EDF.currentUser = user;
  EDF.state = getUserState(user) || defaultGameState();

  // ==== Références DOM ====
  const elCapital = $('#capital');
  const elLiquid = $('#liquidites');
  const elRevenus = $('#revenus');
  const elBiens = $('#biens');
  const btnCollect = $('#gain-auto');
  const btnBuy = $('#acheter-bien');
  const btnBank = $('#banque-btn');
  const btnChateau = $('#chateau-btn');
  const chateauPanel = $('#chateau-panel');
  const bankPanel = $('#bank-panel');
  const upgradeBtn = $('#upgrade-chateau');
  const chateauN = $('#chateau-niveau');
  const depositBtn = $('#depot');
  const withdrawBtn = $('#retrait');
  const logoutBtn = $('#logout-btn');

  // ==== Affichage ====
  function render(){
    computeDerived(EDF.state);
    elCapital.textContent = formatMoney(EDF.state.capital) + ' €';
    elLiquid.textContent = formatMoney(EDF.state.liquidites) + ' €';
    elRevenus.textContent = formatMoney(EDF.state.revenusPerMin) + ' € / min';
    elBiens.textContent = EDF.state.biens;
    if(chateauN) chateauN.textContent = EDF.state.chateau.niveau;
  }

  // ==== Actions ====

  btnCollect?.addEventListener('click', ()=>{
    EDF.state = collectNow(EDF.state);
    render();
    saveUserState(EDF.currentUser, EDF.state);
  });

  btnBuy?.addEventListener('click', ()=>{
    const res = buyProperty(EDF.state, 5000);
    if(!res.ok) return alert(res.msg);
    render();
    saveUserState(EDF.currentUser, EDF.state);
  });

  upgradeBtn?.addEventListener('click', ()=>{
    const res = upgradeChateau(EDF.state, 50000);
    if(!res.ok) return alert(res.msg);
    render();
    saveUserState(EDF.currentUser, EDF.state);
    alert('Château amélioré !');
  });

  depositBtn?.addEventListener('click', ()=>{
    const r = bankDeposit(EDF.state, 1000);
    if(!r.ok) return alert(r.msg);
    render(); saveUserState(EDF.currentUser, EDF.state);
  });

  withdrawBtn?.addEventListener('click', ()=>{
    const r = bankWithdraw(EDF.state, 1000);
    if(!r.ok) return alert(r.msg);
    render(); saveUserState(EDF.currentUser, EDF.state);
  });

  // ==== Panneaux ====
  btnBank?.addEventListener('click', ()=>{
    bankPanel.classList.toggle('hidden');
    chateauPanel.classList.add('hidden');
  });

  btnChateau?.addEventListener('click', ()=>{
    chateauPanel.classList.toggle('hidden');
    bankPanel.classList.add('hidden');
  });

  // ==== Déconnexion ====
  logoutBtn?.addEventListener('click', ()=>{
    logout();
  });

  // ==== Tick & autosave ====
  EDF.autosaveTimer = setInterval(()=>{
    EDF.state = tickGame(EDF.state);
    saveUserState(EDF.currentUser, EDF.state);
    render();
  }, 15000);

  // Initial
  EDF.state = tickGame(EDF.state);
  render();
}
