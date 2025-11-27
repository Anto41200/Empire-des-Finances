// script.js (module) - version refactorisée MVC + fonctionnalités demandées

import {
  doc, getDoc, setDoc, updateDoc, arrayUnion
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// ========== CONFIG JEU ==========
const STARTING_CAPITAL = 200_000;
const RENT_BASE_PERCENT = 0.03; // base par jour (3% du prix) - tu peux ajuster
const CLEAN_COST_PERCENT = 0.01;
const CLEAN_BENEFIT = 0.05;
const NO_CLEAN_PENALTY = -0.10;
const EMBELLISH_INCREASE = 0.25;
const LOAN_MAX_MULTIPLIER = 3.5;
const LOAN_MONTHLY_RATE = 0.05;

const ENTERPRISE_TYPES = {
  agricole: { minPrice: 350_000, monthlyRate: 0.03 },
  commerciale: { minPrice: 750_000, monthlyRate: 0.04 },
  petroliere: { minPrice: 50_000_000, monthlyRate: 0.08 }
};

// Temps : 1 mois = 4 heures réelles ; 1 mois = 30 jours -> 1 jour = 8 minutes = 480000 ms
const REAL_MS_PER_MONTH = 4 * 60 * 60 * 1000;
const MS_PER_DAY = REAL_MS_PER_MONTH / 30;
const DAYS_PER_MONTH = 30;
const DEFAULT_CLEAN_INTERVAL_DAYS = 10;

// i18n / devise
let CURRENCY = "§"; // la devise demandée

// Firebase exposé dans window.__FIREBASE
const { auth, db, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, createUserWithEmailAndPassword } = window.__FIREBASE;

// ========== MODEL ==========
const Model = {
  userId: null,
  userData: null,
  dirty: false, // indique si besoin sauvegarder
  autoSaveInterval: null,
  autosaveMs: 10_000, // auto-save toutes les 10s (configurable)
  scheduleTimeout: null, // pour ticks
  chart: null,

  MARKET: [
    { id: "studio01", nom: "Studio 20m²", prix: 60000, type: "appartement" },
    { id: "app45", nom: "Appartement 45m²", prix: 90000, type: "appartement" },
    { id: "maisonville", nom: "Maison de ville", prix: 150000, type: "maison" },
    { id: "loft", nom: "Loft industriel", prix: 220000, type: "appartement" },
    { id: "villa01", nom: "Villa moderne", prix: 700000, type: "villa" },
    { id: "gite01", nom: "Gîte montagnard", prix: 120000, type: "gite" },
    { id: "immeuble1", nom: "Immeuble 6 logements", prix: 350000, type: "immeuble" },
    { id: "palais01", nom: "Manoir", prix: 1200000, type: "manoir" },
    { id: "hotel01", nom: "Hôtel boutique", prix: 2000000, type: "hotel" },
    { id: "commerceSmall", nom: "Local commercial petit", prix: 110000, type: "commerce" },
    { id: "commerceLarge", nom: "Local commercial grand", prix: 400000, type: "commerce" },
    { id: "terrain01", nom: "Terrain constructible", prix: 50000, type: "terrain" },
    { id: "chateau01", nom: "Château ancien", prix: 4500000, type: "chateau" },
    { id: "farmSmall", nom: "Ferme familiale", prix: 380000, type: "ferme" },
    { id: "farmLarge", nom: "Ferme industrielle", prix: 1200000, type: "ferme" }
  ],

  fmt(n){ return Math.round(n).toLocaleString(); },

  computeTotalBiens(){
    return (this.userData.biens || []).reduce((s,b)=> s + (b.prix || 0), 0);
  },
  computeTotalEntreprises(){
    return (this.userData.entreprises || []).reduce((s,e)=> s + (e.capital || 0), 0);
  },
  computePatrimoine(){
    const liquid = this.userData.liquidite || 0;
    const biens = this.computeTotalBiens();
    const ent = this.computeTotalEntreprises();
    const debt = this.userData.debt || 0;
    return Math.round(liquid + biens + ent - debt);
  },

  async loadUser(uid, displayName, email){
    this.userId = uid;
    const ref = doc(db, "joueurs", uid);
    const snap = await getDoc(ref).catch(()=>null);
    if (!snap || !snap.exists()) {
      // create default
      this.userData = {
        uid,
        email: email || "",
        name: displayName || (email ? email.split("@")[0] : "Joueur"),
        liquidite: STARTING_CAPITAL,
        biens: [],
        entreprises: [],
        debt: 0,
        transactions: [],
        lastTick: Date.now(),
        lastCleanTick: Date.now(),
        cleanIntervalDays: DEFAULT_CLEAN_INTERVAL_DAYS,
        history: [] // {date, patrimoine, liquidite}
      };
      await setDoc(ref, this.userData);
    } else {
      this.userData = snap.data();
      // defaults
      this.userData.liquidite = this.userData.liquidite ?? STARTING_CAPITAL;
      this.userData.biens = this.userData.biens ?? [];
      this.userData.entreprises = this.userData.entreprises ?? [];
      this.userData.debt = this.userData.debt ?? 0;
      this.userData.transactions = this.userData.transactions ?? [];
      this.userData.lastTick = this.userData.lastTick ?? Date.now();
      this.userData.cleanIntervalDays = this.userData.cleanIntervalDays ?? DEFAULT_CLEAN_INTERVAL_DAYS;
      this.userData.history = this.userData.history ?? [];
    }
    // ensure at least one history snapshot
    if (!this.userData.history || this.userData.history.length === 0) {
      this.pushHistorySnapshot();
    }
    this.scheduleNextTick();
    this.startAutoSave();
    this.markDirty(); // to ensure UI loads
  },

  markDirty(){ this.dirty = true; },

  async saveIfNeeded(){
    if (!this.dirty || !this.userId) return;
    const ref = doc(db, "joueurs", this.userId);
    const copy = { ...this.userData };
    // Avoid saving firebase circular things if any - keep simple
    await setDoc(ref, copy, { merge: true }).catch(e => console.error("save err", e));
    this.dirty = false;
  },

  startAutoSave(){
    if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
    this.autoSaveInterval = setInterval(()=> this.saveIfNeeded(), this.autosaveMs);
  },

  stopAutoSave(){
    if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
    this.autoSaveInterval = null;
  },

  addTransaction(type, amount, desc){
    this.userData.transactions = this.userData.transactions || [];
    this.userData.transactions.push({
      type, amount, desc,
      date: new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })
    });
    // keep last 500 transactions max
    if (this.userData.transactions.length > 500) {
      this.userData.transactions = this.userData.transactions.slice(-500);
    }
    this.markDirty();
  },

  pushHistorySnapshot(){
    const snap = { date: new Date().toISOString(), patrimoine: this.computePatrimoine(), liquidite: this.userData.liquidite || 0 };
    this.userData.history = this.userData.history || [];
    this.userData.history.push(snap);
    // cap history length to avoid bloat
    if (this.userData.history.length > 365) this.userData.history.shift();
    this.markDirty();
    return snap;
  },

  // calcDailyRent: optimized, uses bien state at time of calculation
  calcDailyRent(bien){
    let base = bien.prix * RENT_BASE_PERCENT;
    let cleaningMod = 0;
    if (bien.nettoye) cleaningMod += CLEAN_BENEFIT;
    const lastClean = bien.lastClean || this.userData.lastTick || Date.now();
    const daysSinceClean = Math.floor((Date.now() - lastClean) / MS_PER_DAY);
    if (daysSinceClean > (this.userData.cleanIntervalDays || DEFAULT_CLEAN_INTERVAL_DAYS)) cleaningMod += NO_CLEAN_PENALTY;
    const rent = Math.max(0, base * (1 + cleaningMod));
    return Math.floor(rent);
  },

  // apply elapsed time in bulk (optimisé)
  async applyElapsedTicks(){
    const last = this.userData.lastTick || Date.now();
    const elapsedMs = Date.now() - last;
    const elapsedDays = Math.floor(elapsedMs / MS_PER_DAY);
    if (elapsedDays <= 0) {
      this.scheduleNextTick();
      return;
    }

    // compute aggregated values without inner per-day loops where possible
    let totalRent = 0;
    let totalMaintenance = 0;
    const biens = this.userData.biens || [];
    for (const b of biens) {
      if (b.enLocation) {
        // assume rented each day => rentPerDay * elapsedDays
        const rentPerDay = this.calcDailyRent(b);
        totalRent += rentPerDay * elapsedDays;
        this.userData.transactions.push({
          type: 'revenu',
          amount: rentPerDay * elapsedDays,
          desc: `Loyer ${b.nom} (${elapsedDays}j)`,
          date: new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })
        });
      }
      // maintenance per day = 0.5% * price
      const maintenance = Math.floor(b.prix * 0.005) * elapsedDays;
      totalMaintenance += maintenance;
      this.userData.transactions.push({
        type: 'depense',
        amount: maintenance,
        desc: `Entretien ${b.nom} (${elapsedDays}j)`,
        date: new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })
      });
    }

    // apply aggregated rents and maintenance
    this.userData.liquidite += (totalRent - totalMaintenance);

    // monthly updates
    const elapsedMonths = Math.floor(elapsedDays / DAYS_PER_MONTH);
    for (let m = 0; m < elapsedMonths; m++){
      // entreprises payouts
      const entList = this.userData.entreprises || [];
      for (const ent of entList) {
        const payoff = Math.floor(ent.capital * ent.monthlyRate);
        this.userData.liquidite += payoff;
        this.userData.transactions.push({
          type: 'revenu', amount: payoff, desc: `Paiement entreprise ${ent.type}`, date: new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })
        });
        // simple growth: small chance of reinvestment or growth event
        // but we'll not auto-alter capital without explicit reinvest action
      }
      // loan interest
      if (this.userData.debt && this.userData.debt > 0) {
        const interest = Math.floor(this.userData.debt * LOAN_MONTHLY_RATE);
        this.userData.debt += interest;
        this.userData.transactions.push({
          type: 'depense', amount: interest, desc: 'Intérêts emprunt mensuels', date: new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })
        });
      }
      // push monthly snapshot to history
      this.pushHistorySnapshot();
    }

    // random events chance per month elapsed (e.g. market up/down, entreprise événement)
    for (let m=0; m<elapsedMonths; m++){
      this.maybeTriggerRandomEvent();
    }

    // advance lastTick by elapsedDays * MS_PER_DAY
    this.userData.lastTick = last + elapsedDays * MS_PER_DAY;
    this.markDirty();
    await this.saveIfNeeded();
    this.scheduleNextTick();
  },

  scheduleNextTick(){
    if (this.scheduleTimeout) clearTimeout(this.scheduleTimeout);
    const last = this.userData.lastTick || Date.now();
    const untilNextDay = MS_PER_DAY - ((Date.now() - last) % MS_PER_DAY);
    this.scheduleTimeout = setTimeout(()=> this.applyElapsedTicks(), Math.max(1000, untilNextDay));
  },

  // random events: small, to spice gameplay
  maybeTriggerRandomEvent(){
    // simple probability
    const p = Math.random();
    if (p < 0.05) {
      // small market drop: decrease value of some properties by random 2-6%
      const biens = this.userData.biens || [];
      if (biens.length === 0) return;
      const idx = Math.floor(Math.random() * biens.length);
      const b = biens[idx];
      const drop = 0.02 + Math.random()*0.04;
      b.prix = Math.max(1000, Math.round(b.prix * (1 - drop)));
      this.userData.transactions.push({ type: 'depense', amount: 0, desc: `Marché: ${b.nom} perd ${Math.round(drop*100)}%` , date: new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" }) });
      this.markDirty();
    } else if (p < 0.08) {
      // entreprise boom: choose a random entreprise and increase capital payout temporarily
      const ent = (this.userData.entreprises || [])[Math.floor(Math.random() * (this.userData.entreprises || []).length)];
      if (!ent) return;
      const bonus = Math.floor(ent.capital * 0.05);
      this.userData.liquidite += bonus;
      this.userData.transactions.push({ type: 'revenu', amount: bonus, desc: `Événement entreprise: boost ${ent.type}`, date: new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" }) });
      this.markDirty();
    }
  },

  // helper to persist immediately (exposed)
  async saveNow(){
    await this.saveIfNeeded();
  }
};

// ========== VIEW (minimise DOM ops) ==========
const View = {
  el: {
    loginCard: document.getElementById("loginCard"),
    emailInput: document.getElementById("emailInput"),
    usernameInput: document.getElementById("usernameInput"),
    loginBtn: document.getElementById("loginBtn"),
    googleBtn: document.getElementById("googleBtn"),
    playerCard: document.getElementById("playerCard"),
    emailDisplay: document.getElementById("emailDisplay"),
    usernameDisplay: document.getElementById("usernameDisplay"),
    liquiditeDisplay: document.getElementById("liquiditeDisplay"),
    capitalDisplay: document.getElementById("capitalDisplay"),
    menuCard: document.getElementById("menuCard"),
    content: document.getElementById("content"),
    logoutBtn: document.getElementById("logoutBtn"),
    accueilBtn: document.getElementById("accueilBtn"),
    boutiqueBtn: document.getElementById("boutiqueBtn"),
    proprietesBtn: document.getElementById("proprietesBtn"),
    entreprisesBtn: document.getElementById("entreprisesBtn"),
    banqueBtn: document.getElementById("banqueBtn"),
    financesBtn: document.getElementById("financesBtn"),
    optionsBtn: document.getElementById("optionsBtn")
  },

  show(element){
    element.classList.remove("hidden");
  },
  hide(element){
    element.classList.add("hidden");
  },

  renderHeader(){
    const u = Model.userData;
    if (!u) return;
    this.el.emailDisplay.textContent = u.email || "";
    this.el.usernameDisplay.textContent = u.name || "";
    this.el.liquiditeDisplay.textContent = `${CURRENCY} ${Model.fmt(u.liquidite || 0)}`;
    this.el.capitalDisplay.textContent = `${CURRENCY} ${Model.fmt(Model.computePatrimoine())}`;
  },

  setContent(html){
    // update only innerHTML of content
    this.el.content.innerHTML = html;
    // after rendering content we might need to attach click handlers for dynamic content
    // Controller will rebind when necessary
  },

  renderAccueil(){
    const html = `<h2>Accueil</h2>
      <p>1 mois = 4h réelles → 1 jour ≈ ${Math.round(MS_PER_DAY/60000)} minutes.</p>
      <p class="small">Patrimoine: ${CURRENCY} ${Model.fmt(Model.computePatrimoine())} , liquidité: ${CURRENCY} ${Model.fmt(Model.userData.liquidite)}</p>
      <div class="controls">
        <button class="btn" id="advanceDayBtn">Avancer 1 jour (test)</button>
        <button class="btn" id="advanceMonthBtn">Avancer 1 mois (test)</button>
      </div>
      <h3>Historique du patrimoine</h3>
      <canvas id="historyChart" style="max-width:100%;height:300px"></canvas>
      <div class="footer-note">Les snapshots d'historique sont ajoutés chaque mois automatiquement (ou lors d'actions notables).</div>`;
    this.setContent(html);
    // draw chart
    Controller.bindAccueil();
  },

  renderBoutique(){
    let html = `<h2>Boutique</h2><div class="grid">`;
    Model.MARKET.forEach((m,i)=>{
      html += `<div class="card small-card"><strong>${m.nom}</strong>
        <div class="small">Prix: ${CURRENCY} ${Model.fmt(m.prix)}</div>
        <div class="small">Type: ${m.type}</div>
        <div class="controls"><button class="btn" data-buy-index="${i}">Acheter</button></div>
      </div>`;
    });
    html += `</div>`;
    this.setContent(html);
    Controller.bindBoutique();
  },

  renderMesProprietes(page=1, pageSize=6, filterType=null, sortBy=null){
    const biens = (Model.userData.biens || []).slice();
    // filter
    const filtered = filterType ? biens.filter(b => b.type === filterType) : biens;
    // sort
    if (sortBy === "prix-asc") filtered.sort((a,b)=>a.prix-b.prix);
    if (sortBy === "prix-desc") filtered.sort((a,b)=>b.prix-a.prix);
    if (sortBy === "nom") filtered.sort((a,b)=>a.nom.localeCompare(b.nom));

    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    page = Math.min(page, pages);

    let html = `<h2>Mes Propriétés (${total})</h2>
      <div class="controls">
        <select id="filterType" class="input-inline"><option value="">Tous types</option>
          ${[...new Set(Model.MARKET.map(m=>m.type))].map(t=>`<option value="${t}">${t}</option>`).join("")}
        </select>
        <select id="sortBy" class="input-inline">
          <option value="">Tri</option>
          <option value="prix-asc">Prix ↑</option>
          <option value="prix-desc">Prix ↓</option>
          <option value="nom">Nom</option>
        </select>
        <input id="pageSize" type="number" min="1" max="50" value="${pageSize}" class="input-inline" style="width:90px"/>
      </div>`;

    html += `<div class="grid">`;
    const start = (page-1)*pageSize;
    const chunk = filtered.slice(start, start+pageSize);
    if (chunk.length === 0) {
      html += `<div class="card">Aucun bien.</div>`;
    } else {
      chunk.forEach((b,i)=>{
        const nettoyeBadge = b.nettoye ? `<span class="badge">Nettoyé</span>` : "";
        const embBadge = b.embelli ? `<span class="embelli-badge">Embellie</span>` : "";
        html += `<div class="card small-card">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div><strong>${b.nom}</strong> ${embBadge}${nettoyeBadge}<div class="small">Type: ${b.type || "—"}</div></div>
            <div><span class="small">Valeur: ${CURRENCY} ${Model.fmt(b.prix)} </span></div>
          </div>
          <p>Status: ${b.enLocation ? "Loué" : "Libre"}</p>
          <p>Revenu potentiel/jour: ${CURRENCY} ${Model.fmt(Model.calcDailyRent(b))}</p>
          <div class="controls">
            ${b.enLocation ? `<button class="btn alt" data-stop="${start+i}">Arrêter location</button>` : `<button class="btn" data-louer="${start+i}">Louer</button>`}
            <button class="btn" data-vendre="${start+i}">Vendre (80%)</button>
            ${b.embelli ? "" : `<button class="btn alt" data-embellir="${start+i}">Embellir (+25%)</button>`}
            <button class="btn" data-nettoyer="${start+i}">Nettoyer (1% valeur)</button>
          </div>
        </div>`;
      });
    }
    html += `</div>`;

    // pager
    html += `<div class="pager"><button class="btn" id="prevPage">Préc</button><span> Page <input id="pageInput" value="${page}" style="width:50px"/> / ${pages} </span><button class="btn" id="nextPage">Suiv</button></div>`;
    this.setContent(html);
    Controller.bindProprietes({ page, pages });
  },

  renderEntreprises(page=1, pageSize=6, filterType=null, sortBy=null){
    const list = (Model.userData.entreprises || []).slice();
    // filter
    const filtered = filterType ? list.filter(e=>e.type===filterType) : list;
    if (sortBy === "capital-asc") filtered.sort((a,b)=>a.capital-b.capital);
    if (sortBy === "capital-desc") filtered.sort((a,b)=>b.capital-a.capital);

    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    page = Math.min(page, pages);

    let html = `<h2>Entreprises (${total})</h2>
      <div class="controls">
        <button class="btn" id="buyAgri">Acheter Ferme (min ${CURRENCY} ${Model.fmt(ENTERPRISE_TYPES.agricole.minPrice)})</button>
        <button class="btn" id="buyCom">Acheter Entreprise commerciale (min ${CURRENCY} ${Model.fmt(ENTERPRISE_TYPES.commerciale.minPrice)})</button>
        <button class="btn" id="buyPetro">Acheter Entreprise pétrolière (min ${CURRENCY} ${Model.fmt(ENTERPRISE_TYPES.petroliere.minPrice)})</button>
      </div>
      <div class="controls" style="margin-top:8px">
        <select id="filterEntType" class="input-inline"><option value="">Tous types</option>
          ${Object.keys(ENTERPRISE_TYPES).map(k=>`<option value="${k}">${k}</option>`).join("")}
        </select>
        <select id="sortEntBy" class="input-inline"><option value="">Tri</option><option value="capital-desc">Capital ↓</option><option value="capital-asc">Capital ↑</option></select>
        <input id="entPageSize" type="number" min="1" max="50" value="${pageSize}" class="input-inline" style="width:90px"/>
      </div>`;

    html += `<div class="grid">`;
    const start = (page-1)*pageSize;
    const chunk = filtered.slice(start, start+pageSize);
    if (chunk.length === 0) {
      html += `<div class="card">Aucune entreprise possédée.</div>`;
    } else {
      chunk.forEach((e, idx)=>{
        html += `<div class="card small-card">
          <strong>${e.type.toUpperCase()}</strong>
          <div class="small">Capital: ${CURRENCY} ${Model.fmt(e.capital)}</div>
          <div class="small">Revenu mensuel: ${Math.round(e.monthlyRate*100)}%</div>
          <div class="controls">
            <button class="btn" data-extract="${start+idx}">${e.type==='petroliere'?'Forer / Extraire':'Collecter'}</button>
            <button class="btn alt" data-reinvest="${start+idx}">Réinvestir (+10% capital)</button>
            <button class="btn" data-sell-ent="${start+idx}">Vendre (80%)</button>
          </div>
        </div>`;
      });
    }
    html += `</div>`;
    html += `<div class="pager"><button class="btn" id="prevEntPage">Préc</button><span> Page <input id="entPageInput" value="${page}" style="width:50px"/> / ${pages} </span><button class="btn" id="nextEntPage">Suiv</button></div>`;
    this.setContent(html);
    Controller.bindEntreprises({ page, pages });
  },

  renderFinances(){
    const tx = Model.userData.transactions || [];
    if (tx.length === 0) { this.setContent("<h2>Finances</h2><p>Aucune transaction.</p>"); return; }
    let html = `<h2>Finances</h2><div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Montant</th></tr></thead><tbody>`;
    tx.slice().reverse().forEach(t=>{
      html += `<tr><td>${t.date}</td><td>${t.type}</td><td>${t.desc}</td><td style="color:${t.type==='revenu'?'green':'red'};">${CURRENCY} ${Model.fmt(t.amount)}</td></tr>`;
    });
    html += "</tbody></table></div>";
    this.setContent(html);
  },

  renderBanque(){
    const debt = Model.userData.debt || 0;
    const patrimoine = Model.computePatrimoine();
    const html = `<h2>Banque</h2>
      <p>Dette actuelle: ${CURRENCY} ${Model.fmt(debt)} </p>
      <p>Patrimoine: ${CURRENCY} ${Model.fmt(patrimoine)} </p>
      <div class="controls">
        <input id="loanAmount" placeholder="Montant emprunt" class="input-inline" />
        <button class="btn" id="takeLoanBtn">Emprunter</button>
        <button class="btn alt" id="repayLoanBtn">Rembourser tout possible</button>
      </div>
      <p class="small">Max empruntable: ${CURRENCY} ${Model.fmt(patrimoine * LOAN_MAX_MULTIPLIER)} (350% du patrimoine)</p>`;
    this.setContent(html);
    Controller.bindBanque();
  },

  renderOptions(){
    const html = `<h2>Options</h2>
      <div class="controls">
        <button class="btn" id="advanceDayOpt">Avancer 1 jour</button>
        <button class="btn" id="advanceMonthOpt">Avancer 1 mois</button>
        <button class="btn alt" id="resetGameBtn">Réinitialiser</button>
      </div>
      <p class="small">Nettoyage auto tous les ${Model.userData.cleanIntervalDays || DEFAULT_CLEAN_INTERVAL_DAYS} jours (configurable).</p>
      <div style="margin-top:12px">
        <label>Devise: <input id="deviseInput" value="${CURRENCY}" style="width:60px" class="input-inline"/></label>
      </div>`;
    this.setContent(html);
    Controller.bindOptions();
  }
};

// ========== CONTROLLER ==========
const Controller = {
  init(){
    // bind login buttons & auth persistence
    View.el.loginBtn.addEventListener("click", ()=> this.handleEmailLogin());
    View.el.googleBtn.addEventListener("click", ()=> this.handleGoogleLogin());
    View.el.logoutBtn.addEventListener("click", ()=> this.handleLogout());

    // menu
    View.el.accueilBtn.addEventListener("click", ()=> this.showAccueil());
    View.el.boutiqueBtn.addEventListener("click", ()=> this.showBoutique());
    View.el.proprietesBtn.addEventListener("click", ()=> this.showMesProprietes());
    View.el.entreprisesBtn.addEventListener("click", ()=> this.showEntreprises());
    View.el.banqueBtn.addEventListener("click", ()=> this.showBanque());
    View.el.financesBtn.addEventListener("click", ()=> this.showFinances());
    View.el.optionsBtn.addEventListener("click", ()=> this.showOptions());

    // auth persistence (keep session)
    setPersistence(auth, browserLocalPersistence).catch(()=>{});
    // watch auth state
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        // logged
        const uid = user.uid;
        const name = user.displayName || user.email?.split("@")[0] || "Joueur";
        const email = user.email || "";
        await Model.loadUser(uid, name, email);
        this.onLogin();
      } else {
        this.onLogout();
      }
    });
  },

  async handleEmailLogin(){
    const email = View.el.emailInput.value.trim().toLowerCase();
    const name = View.el.usernameInput.value.trim();
    if (!email) return alert("Entre ton email valide");
    // try sign-in existing; if fail, create account with random password (simple approach)
    try {
      // try to sign in with email as password-less: we will fallback to anonymous create in Firestore only
      // For simplicity we will use Firebase Auth anonymous-like via createUserWithEmailAndPassword with a random password if not existing.
      // But if user wants password login properly, extend later.
      let user;
      try {
        // attempt to sign in (if account created previously with this email using this random password approach it'll work)
        // But in our current simplified approach, we'll attempt sign in using a deterministic password derived from email (not secure for production)
        const pwd = this._deterministicPassword(email);
        const cred = await signInWithEmailAndPassword(auth, email, pwd).catch(()=>null);
        if (cred && cred.user) user = cred.user;
        else {
          // create user with that password
          const created = await createUserWithEmailAndPassword(auth, email, pwd);
          user = created.user;
          await updateProfileIfNeeded(user, { displayName: name || email.split("@")[0] });
        }
      } catch(e){
        // fallback: sign in with popup (Google) maybe
        console.warn(e);
      }
      // if no user via email flow, fallback to guest create (anonymous in Firestore without Auth)
      if (!auth.currentUser) {
        alert("Connexion par email échouée — essaye la connexion Google.");
        return;
      }
    } catch(e){
      console.error(e);
      alert("Erreur connexion: " + e.message);
    }
  },

  async handleGoogleLogin(){
    const provider = new GoogleAuthProvider();
    try {
      const res = await signInWithPopup(auth, provider);
      // onAuthStateChanged will handle loading user
    } catch(e){
      console.error(e);
      alert("Erreur Google sign-in: " + e.message);
    }
  },

  async handleLogout(){
    // save now before logout
    await Model.saveNow();
    await signOut(auth).catch(()=>{});
    location.reload();
  },

  onLogin(){
    // show UI
    View.show(View.el.playerCard);
    View.show(View.el.menuCard);
    View.show(View.el.content);
    View.hide(View.el.loginCard);
    View.renderHeader();
    this.showAccueil();
  },

  onLogout(){
    View.hide(View.el.playerCard);
    View.hide(View.el.menuCard);
    View.hide(View.el.content);
    View.show(View.el.loginCard);
  },

  // UI actions
  showAccueil(){ View.renderAccueil(); },
  showBoutique(){ View.renderBoutique(); },
  showMesProprietes(args = { page:1 }){ View.renderMesProprietes(args.page || 1); },
  showEntreprises(args = { page:1 }){ View.renderEntreprises(args.page || 1); },
  showBanque(){ View.renderBanque(); },
  showFinances(){ View.renderFinances(); },
  showOptions(){ View.renderOptions(); },

  // bindings for rendered pages
  bindAccueil(){
    const advDay = document.getElementById("advanceDayBtn");
    const advMonth = document.getElementById("advanceMonthBtn");
    advDay.addEventListener("click", async ()=> {
      Model.userData.lastTick = (Model.userData.lastTick || Date.now()) + MS_PER_DAY;
      await Model.applyElapsedTicks();
      alert("Simulé 1 jour.");
      View.renderHeader();
      this.showAccueil(); // re-render chart
    });
    advMonth.addEventListener("click", async ()=> {
      Model.userData.lastTick = (Model.userData.lastTick || Date.now()) + (MS_PER_DAY * DAYS_PER_MONTH);
      await Model.applyElapsedTicks();
      alert("Simulé 1 mois.");
      View.renderHeader();
      this.showAccueil();
    });

    // draw chart
    const ctx = document.getElementById("historyChart").getContext("2d");
    const labels = Model.userData.history.map(h => (new Date(h.date)).toLocaleDateString());
    const data = Model.userData.history.map(h => h.patrimoine);
    if (Model.chart) {
      Model.chart.destroy();
      Model.chart = null;
    }
    Model.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Patrimoine',
          data,
          tension: 0.2,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  },

  bindBoutique(){
    document.querySelectorAll("[data-buy-index]").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const idx = Number(btn.getAttribute("data-buy-index"));
        await this.acheterBien(idx);
      });
    });
  },

  bindProprietes({ page, pages }){
    document.querySelectorAll("[data-louer]").forEach(b=> b.addEventListener("click", async e=>{
      const idx = Number(b.getAttribute("data-louer"));
      await Controller.louerBien(idx);
    }));
    document.querySelectorAll("[data-stop]").forEach(b=> b.addEventListener("click", async e=>{
      const idx = Number(b.getAttribute("data-stop"));
      await Controller.stopLocation(idx);
    }));
    document.querySelectorAll("[data-vendre]").forEach(b=> b.addEventListener("click", async e=>{
      const idx = Number(b.getAttribute("data-vendre"));
      await Controller.vendreBien(idx);
    }));
    document.querySelectorAll("[data-embellir]").forEach(b=> b.addEventListener("click", async e=>{
      const idx = Number(b.getAttribute("data-embellir"));
      await Controller.embellirBien(idx);
    }));
    document.querySelectorAll("[data-nettoyer]").forEach(b=> b.addEventListener("click", async e=>{
      const idx = Number(b.getAttribute("data-nettoyer"));
      await Controller.nettoyerBien(idx);
    }));

    // pager
    const prev = document.getElementById("prevPage");
    const next = document.getElementById("nextPage");
    const pageInput = document.getElementById("pageInput");
    const pageSizeInput = document.getElementById("pageSize");
    const filterType = document.getElementById("filterType");
    const sortBy = document.getElementById("sortBy");

    prev.addEventListener("click", ()=> {
      const p = Math.max(1, Number(pageInput.value) - 1);
      this.showMesProprietes({ page: p, pageSize: Number(pageSizeInput.value), filterType: filterType.value, sortBy: sortBy.value });
    });
    next.addEventListener("click", ()=> {
      const p = Math.min(pages, Number(pageInput.value) + 1);
      this.showMesProprietes({ page: p, pageSize: Number(pageSizeInput.value), filterType: filterType.value, sortBy: sortBy.value });
    });
    pageInput.addEventListener("change", ()=> {
      const p = Math.max(1, Math.min(pages, Number(pageInput.value)));
      this.showMesProprietes({ page: p, pageSize: Number(pageSizeInput.value), filterType: filterType.value, sortBy: sortBy.value });
    });
    pageSizeInput.addEventListener("change", ()=> {
      const psize = Math.max(1, Math.min(50, Number(pageSizeInput.value)));
      this.showMesProprietes({ page: 1, pageSize: psize, filterType: filterType.value, sortBy: sortBy.value });
    });
    filterType.addEventListener("change", ()=> {
      this.showMesProprietes({ page: 1, pageSize: Number(pageSizeInput.value), filterType: filterType.value, sortBy: sortBy.value });
    });
    sortBy.addEventListener("change", ()=> {
      this.showMesProprietes({ page: 1, pageSize: Number(pageSizeInput.value), filterType: filterType.value, sortBy: sortBy.value });
    });
  },

  bindEntreprises({ page, pages }){
    document.getElementById("buyAgri").addEventListener("click", ()=> this.buyEnterprise('agricole'));
    document.getElementById("buyCom").addEventListener("click", ()=> this.buyEnterprise('commerciale'));
    document.getElementById("buyPetro").addEventListener("click", ()=> this.buyEnterprise('petroliere'));

    document.querySelectorAll("[data-extract]").forEach(b=> b.addEventListener("click", async e=>{
      const idx = Number(b.getAttribute("data-extract"));
      await Controller.extractOil(idx);
    }));
    document.querySelectorAll("[data-reinvest]").forEach(b=> b.addEventListener("click", async e=>{
      const idx = Number(b.getAttribute("data-reinvest"));
      await Controller.reinvestEnterprise(idx);
    }));
    document.querySelectorAll("[data-sell-ent]").forEach(b=> b.addEventListener("click", async e=>{
      const idx = Number(b.getAttribute("data-sell-ent"));
      await Controller.sellEnterprise(idx);
    }));

    const prev = document.getElementById("prevEntPage");
    const next = document.getElementById("nextEntPage");
    const pageInput = document.getElementById("entPageInput");
    const pageSizeInput = document.getElementById("entPageSize");
    const filter = document.getElementById("filterEntType");
    const sort = document.getElementById("sortEntBy");

    prev.addEventListener("click", ()=> {
      const p = Math.max(1, Number(pageInput.value) - 1);
      this.showEntreprises({ page: p, pageSize: Number(pageSizeInput.value), filterType: filter.value, sortBy: sort.value });
    });
    next.addEventListener("click", ()=> {
      const p = Math.min(pages, Number(pageInput.value) + 1);
      this.showEntreprises({ page: p, pageSize: Number(pageSizeInput.value), filterType: filter.value, sortBy: sort.value });
    });
    pageInput.addEventListener("change", ()=> {
      const p = Math.max(1, Math.min(pages, Number(pageInput.value)));
      this.showEntreprises({ page: p, pageSize: Number(pageSizeInput.value), filterType: filter.value, sortBy: sort.value });
    });
    pageSizeInput.addEventListener("change", ()=> {
      const psize = Math.max(1, Math.min(50, Number(pageSizeInput.value)));
      this.showEntreprises({ page: 1, pageSize: psize, filterType: filter.value, sortBy: sort.value });
    });
    filter.addEventListener("change", ()=> {
      this.showEntreprises({ page: 1, pageSize: Number(pageSizeInput.value), filterType: filter.value, sortBy: sort.value });
    });
    sort.addEventListener("change", ()=> {
      this.showEntreprises({ page: 1, pageSize: Number(pageSizeInput.value), filterType: filter.value, sortBy: sort.value });
    });
  },

  bindBanque(){
    document.getElementById("takeLoanBtn").addEventListener("click", ()=> this.takeLoan());
    document.getElementById("repayLoanBtn").addEventListener("click", ()=> this.repayLoan());
  },

  bindOptions(){
    document.getElementById("advanceDayOpt").addEventListener("click", async ()=> {
      Model.userData.lastTick = (Model.userData.lastTick || Date.now()) + MS_PER_DAY;
      await Model.applyElapsedTicks();
      View.renderHeader();
      this.showOptions();
    });
    document.getElementById("advanceMonthOpt").addEventListener("click", async ()=> {
      Model.userData.lastTick = (Model.userData.lastTick || Date.now()) + (MS_PER_DAY * DAYS_PER_MONTH);
      await Model.applyElapsedTicks();
      View.renderHeader();
      this.showOptions();
    });
    document.getElementById("resetGameBtn").addEventListener("click", ()=> this.resetGame());
    document.getElementById("deviseInput").addEventListener("change", (e)=>{
      CURRENCY = e.target.value || "§";
      View.renderHeader();
      this.showOptions();
    });
  },

  // ========== ACTIONS JEU ==========
  async acheterBien(index){
    const item = Model.MARKET[index];
    if (Model.userData.liquidite < item.prix) return alert("Pas assez de liquidités !");
    Model.userData.liquidite -= item.prix;
    const newProp = {
      id: item.id + "_" + Date.now(),
      nom: item.nom,
      prix: item.prix,
      type: item.type,
      enLocation: false,
      embelli: false,
      nettoye: false,
      lastClean: Date.now()
    };
    Model.userData.biens.push(newProp);
    Model.addTransaction('depense', item.prix, `Achat bien ${item.nom}`);
    await Model.saveNow();
    View.renderHeader();
    this.showMesProprietes();
  },

  async louerBien(index){
    const bien = Model.userData.biens[index];
    if (!bien) return alert("Bien introuvable");
    if (bien.enLocation) return alert("Déjà loué");
    const rent = Model.calcDailyRent(bien);
    Model.userData.liquidite += rent;
    bien.enLocation = true;
    Model.addTransaction('revenu', rent, `Loyer jour pour ${bien.nom}`);
    await Model.saveNow();
    View.renderHeader();
    this.showMesProprietes();
  },

  async stopLocation(index){
    const bien = Model.userData.biens[index];
    if (!bien) return;
    bien.enLocation = false;
    await Model.saveNow();
    this.showMesProprietes();
  },

  async vendreBien(index){
    const bien = Model.userData.biens[index];
    if (!bien) return;
    if (!confirm(`Vendre ${bien.nom} pour 80% ?`)) return;
    const sale = Math.floor(bien.prix * 0.8);
    Model.userData.liquidite += sale;
    Model.addTransaction('revenu', sale, `Vente ${bien.nom}`);
    Model.userData.biens.splice(index,1);
    await Model.saveNow();
    View.renderHeader();
    this.showMesProprietes();
  },

  async embellirBien(index){
    const bien = Model.userData.biens[index];
    if (!bien) return;
    if (bien.embelli) return alert("Déjà embelli");
    const cost = Math.floor(bien.prix * EMBELLISH_INCREASE);
    if (Model.userData.liquidite < cost) return alert("Pas assez de liquidités pour embellir");
    if (!confirm(`Payer ${CURRENCY} ${Model.fmt(cost)} pour embellir ${bien.nom} (valeur +25%) ?`)) return;
    Model.userData.liquidite -= cost;
    bien.prix = Math.round(bien.prix * (1 + EMBELLISH_INCREASE));
    bien.embelli = true;
    Model.addTransaction('depense', cost, `Embellissement ${bien.nom}`);
    await Model.saveNow();
    View.renderHeader();
    this.showMesProprietes();
  },

  async nettoyerBien(index){
    const bien = Model.userData.biens[index];
    if (!bien) return;
    const cost = Math.floor(bien.prix * CLEAN_COST_PERCENT);
    if (Model.userData.liquidite < cost) return alert("Pas assez pour nettoyage");
    Model.userData.liquidite -= cost;
    bien.nettoye = true;
    bien.lastClean = Date.now();
    Model.addTransaction('depense', cost, `Nettoyage ${bien.nom}`);
    await Model.saveNow();
    View.renderHeader();
    this.showMesProprietes();
  },

  // ========== ENTREPRISES (complètes) ==========
  async buyEnterprise(type){
    const def = ENTERPRISE_TYPES[type];
    if (!def) return alert("Type non valide");
    if (Model.userData.liquidite < def.minPrice) return alert("Pas assez pour acheter ce type d'entreprise");
    Model.userData.liquidite -= def.minPrice;
    const ent = {
      id: `${type}_${Date.now()}`,
      type,
      capital: def.minPrice,
      monthlyRate: def.monthlyRate,
      lastPayout: Date.now()
    };
    Model.userData.entreprises.push(ent);
    Model.addTransaction('depense', def.minPrice, `Achat entreprise ${type}`);
    await Model.saveNow();
    View.renderHeader();
    this.showEntreprises();
  },

  async extractOil(index){
    const ent = Model.userData.entreprises[index];
    if (!ent) return alert("Entreprise non trouvée");
    if (ent.type !== 'petroliere') {
      // for non-petro companies, a collect action returns monthlyRate * capital / 30 as small immediate
      const yieldAmount = Math.floor(ent.capital * ent.monthlyRate / 30);
      Model.userData.liquidite += yieldAmount;
      Model.addTransaction('revenu', yieldAmount, `Collecte entreprise ${ent.type}`);
      await Model.saveNow();
      View.renderHeader();
      this.showEntreprises();
      return;
    }
    // For petro: extraction action yields a random chunk (0.2% - 1.5% of capital)
    const yieldAmount = Math.floor(ent.capital * (0.002 + Math.random()*0.013));
    Model.userData.liquidite += yieldAmount;
    Model.addTransaction('revenu', yieldAmount, `Extraction pétrole (${ent.id})`);
    await Model.saveNow();
    View.renderHeader();
    this.showEntreprises();
  },

  async reinvestEnterprise(index){
    const ent = Model.userData.entreprises[index];
    if (!ent) return;
    // reinvest: invest 10% of capital from liquidite to capital -> increases monthly payments later
    const reinvestCost = Math.floor(ent.capital * 0.10);
    if (Model.userData.liquidite < reinvestCost) return alert("Pas assez pour réinvestir");
    Model.userData.liquidite -= reinvestCost;
    ent.capital += reinvestCost;
    Model.addTransaction('depense', reinvestCost, `Réinvestissement ${ent.type}`);
    await Model.saveNow();
    View.renderHeader();
    this.showEntreprises();
  },

  async sellEnterprise(index){
    const ent = Model.userData.entreprises[index];
    if (!ent) return;
    if (!confirm(`Vendre entreprise ${ent.type} pour 80% du capital ?`)) return;
    const sale = Math.floor(ent.capital * 0.8);
    Model.userData.liquidite += sale;
    Model.addTransaction('revenu', sale, `Vente entreprise ${ent.type}`);
    Model.userData.entreprises.splice(index,1);
    await Model.saveNow();
    View.renderHeader();
    this.showEntreprises();
  },

  // ========== BANQUE ==========
  async takeLoan(){
    const input = document.getElementById("loanAmount");
    const val = Math.max(0, Number(input?.value || 0));
    if (!val) return alert("Montant invalide");
    const max = Math.floor(Model.computePatrimoine() * LOAN_MAX_MULTIPLIER);
    if (val > max) return alert("Montant dépasse le maximum empruntable (" + Model.fmt(max) + " )");
    Model.userData.debt = (Model.userData.debt || 0) + val;
    Model.userData.liquidite += val;
    Model.addTransaction('revenu', val, `Emprunt ${Model.fmt(val)} `);
    await Model.saveNow();
    View.renderHeader();
    this.showBanque();
  },

  async repayLoan(){
    const repay = Math.min(Model.userData.debt || 0, Model.userData.liquidite || 0);
    if (repay <= 0) return alert("Rien à rembourser ou pas de liquidité");
    Model.userData.debt -= repay;
    Model.userData.liquidite -= repay;
    Model.addTransaction('depense', repay, "Remboursement dette");
    await Model.saveNow();
    View.renderHeader();
    this.showBanque();
  },

  // ========== UTIL / DEBUG ==========
  async resetGame(){
    if (!confirm("Réinitialiser le jeu pour cet utilisateur ?")) return;
    Model.userData = {
      uid: Model.userData.uid,
      email: Model.userData.email,
      name: Model.userData.name,
      liquidite: STARTING_CAPITAL,
      biens: [],
      entreprises: [],
      debt: 0,
      transactions: [],
      lastTick: Date.now(),
      lastCleanTick: Date.now(),
      cleanIntervalDays: DEFAULT_CLEAN_INTERVAL_DAYS,
      history: []
    };
    Model.pushHistorySnapshot();
    await Model.saveNow();
    View.renderHeader();
    this.showAccueil();
  },

  // helper deterministic password (NOT secure) - for simplified email flow (replace with proper UX later)
  _deterministicPassword(email){
    return 'pwd_' + btoa(email).slice(0,12);
  }
};

// small helper updateProfile (if available)
async function updateProfileIfNeeded(user, data){
  // try to update displayName if possible - we don't import updateProfile due to modular imports earlier, keep simple
  try {
    if (user && data.displayName && user.providerData && user.providerData.length === 0) {
      // no-op - minimal
    }
  } catch(e){ console.warn(e); }
}

// ========== START ==========
Controller.init();

// expose some debug functions for console
window.Model = Model;
window.Controller = Controller;
window.View = View;
window.CURRENCY = CURRENCY;
