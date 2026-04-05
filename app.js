/* ================================================================
   PocketSense — app.js  (IIFE)
   Username: always clean human name (never raw email)
   Admin: dual sidebar, users table with actions, analytics
   Firebase + full offline fallback
   ================================================================ */
(function () {

  var ADMIN_EMAIL = "admin@pocketsense.app";
  var DEMO_EMAIL  = "demo@pocketsense.app";
  var DEMO_PASS   = "demo1234";

  var D = window.FF_DATA;
  var CATS = D.CATEGORIES; var SEED = D.SEED_TRANSACTIONS;
  var fmt = D.fmtCurrency; var fmtD = D.fmtDate; var fmtM = D.fmtMonth; var getCat = D.getCat;

  var S = {
    user:null, isAdmin:false, offline:false,
    txs:[], allTxs:[], allUsers:[],
    filters:{search:"",type:"all",cat:"all",sort:"date-desc"},
    aFilters:{search:"",uid:"all",type:"all"},
    period:"6m", charts:{}, theme:"dark", unsub:null,
    adminSection:"admin-overview",
  };

  var FF = null;

  /* ── DOM ─────────────────────────────────────────────────── */
  var $  = function(id){ return document.getElementById(id); };
  var $$ = function(s){  return document.querySelectorAll(s); };
  var show = function(id){ var e=$(id); if(e) e.classList.remove("hidden"); };
  var hide = function(id){ var e=$(id); if(e) e.classList.add("hidden"); };
  var esc  = function(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); };

  /* ── GET CLEAN NAME ──────────────────────────────────────── */
  function cleanName(user) {
    if (!user) return "User";
    /* 1. Try displayName (set during signup) */
    if (user.displayName && user.displayName.trim()) return user.displayName.trim();
    /* 2. Derive from email: inamdar.faiz.786@gmail.com → "Inamdar Faiz" */
    var local = (user.email || "").split("@")[0];
    local = local.replace(/[._\-]?\d+$/, "");   /* strip trailing numbers */
    local = local.replace(/[._\-]+/g, " ");       /* separators → spaces */
    local = local.trim();
    if (!local) return "User";
    return local.replace(/\b\w/g, function(c){ return c.toUpperCase(); });
  }

  /* ── BOOT ────────────────────────────────────────────────── */
  function boot() {
    S.theme = localStorage.getItem("ps_theme") || "dark";
    applyTheme(S.theme, false);
    startBgCanvas();
    startCursorGlow();
    startAdminCanvas();
    bindAuthTabs();
    bindAuthForms();
    bindAdminGate();
    buildCatGrid();
    populateCatFilter();
    bindAppEvents();
    setHeroDate();
    startAdminClock();
    showScreen("auth");

    if (window.__FF) { FF = window.__FF; checkFirebase(); }
    else {
      window.addEventListener("firebaseReady", function(){ FF = window.__FF; checkFirebase(); });
      setTimeout(function(){ if (!FF) goOffline(); }, 3000);
    }
  }

  function checkFirebase() {
    try {
      var pid = FF.auth.app.options.projectId || "";
      if (!pid || pid === "YOUR_PROJECT_ID") { goOffline(); return; }
      FF.onAuthStateChanged(FF.auth, function(u){ u ? doLogin(u) : doLogout(); });
    } catch(e) { goOffline(); }
  }
  function goOffline() { S.offline = true; console.info("PocketSense: demo/offline mode"); }

  /* ── SCREENS ─────────────────────────────────────────────── */
  function showScreen(s) {
    ["auth","admin","app"].forEach(function(n){ hide(n+"Screen"); });
    show(s+"Screen");
  }

  /* ── THEME ───────────────────────────────────────────────── */
  function applyTheme(t, redraw) {
    S.theme = t;
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("ps_theme", t);
    var lbl=$("themeLbl"), icon=$("themeIcon"), aLbl=$("aThemeLbl"), aIcon=$("aThemeIcon");
    if(lbl)  lbl.textContent   = t==="light" ? "Light" : "Dark";
    if(icon) icon.textContent  = t==="light" ? "☀" : "🌙";
    if(aLbl) aLbl.textContent  = t==="light" ? "Light" : "Dark";
    if(aIcon)aIcon.textContent = t==="light" ? "☀" : "🌙";
    if (redraw !== false && S.user) { destroyCharts(); renderDashCharts(); renderMonthlyChart(); renderAdminCharts(); }
  }
  function toggleTheme() { applyTheme(S.theme === "dark" ? "light" : "dark", true); }

  /* ── AUTH TABS ───────────────────────────────────────────── */
  function bindAuthTabs() {
    $$(".auth-tab").forEach(function(tab){
      tab.addEventListener("click", function(){
        $$(".auth-tab").forEach(function(t){ t.classList.remove("active"); });
        $$(".auth-form").forEach(function(f){ f.classList.remove("active"); });
        tab.classList.add("active");
        var f=$(tab.dataset.tab+"Form"); if(f) f.classList.add("active");
      });
    });
  }

  /* ── AUTH FORMS ──────────────────────────────────────────── */
  function bindAuthForms() {
    $("loginForm").addEventListener("submit", function(e){
      e.preventDefault();
      var nm = ($("loginName") ? $("loginName").value.trim() : "");
      var em = $("loginEmail").value.trim();
      var pw = $("loginPassword").value.trim();
      if (!em || !pw) { showErr("loginError","Enter email and password."); return; }
      if (S.offline || !FF) { offlineLogin(em, pw, nm); return; }
      setBtn("loginBtnText", "Signing in...");
      FF.signInWithEmailAndPassword(FF.auth, em, pw)
        .then(function(cred){
          /* If user typed a name, update their profile */
          if (nm && !cred.user.displayName) {
            return FF.updateProfile(cred.user, { displayName: nm });
          }
        })
        .catch(function(err){ showErr("loginError", niceErr(err.code)); setBtn("loginBtnText","Sign In"); });
    });

    $("signupForm").addEventListener("submit", function(e){
      e.preventDefault();
      var nm = $("signupName").value.trim();
      var em = $("signupEmail").value.trim();
      var pw = $("signupPassword").value.trim();
      if (!nm)  { showErr("signupError","Enter your name."); return; }
      if (!em)  { showErr("signupError","Enter your email."); return; }
      if (pw.length < 6) { showErr("signupError","Password needs 6+ characters."); return; }
      if (S.offline || !FF) { offlineSignup(nm, em, pw); return; }
      setBtn("signupBtnText","Creating...");
      FF.createUserWithEmailAndPassword(FF.auth, em, pw)
        .then(function(cred){
          return FF.updateProfile(cred.user, { displayName: nm })
            .then(function(){ return saveUserDoc(cred.user.uid, nm, em); })
            .then(function(){ return seedUserTx(cred.user.uid); });
        })
        .catch(function(err){ showErr("signupError", niceErr(err.code)); setBtn("signupBtnText","Create Account"); });
    });
  }

  function setBtn(id, txt){ var e=$(id); if(e) e.textContent=txt; }

  /* ── OFFLINE AUTH ────────────────────────────────────────── */
  function offlineLogin(em, pw, nm) {
    if (em===DEMO_EMAIL && pw===DEMO_PASS) { doLoginOffline({uid:"demo",email:DEMO_EMAIL,displayName:"Demo User"}); return; }
    if (em===ADMIN_EMAIL && pw==="admin1234") { doLoginOffline({uid:"admin",email:ADMIN_EMAIL,displayName:"Admin"}); return; }
    var saved = getAccts();
    var match = saved.find(function(a){ return a.email===em && a.pw===pw; });
    if (match) {
      /* Update display name if user provided one now */
      if (nm && !match.displayName) { match.displayName=nm; saveAcct(match); }
      doLoginOffline(match); return;
    }
    /* Auto-create offline account */
    var dn = nm || cleanName({email:em});
    var u = {uid:"u"+Date.now(), email:em, displayName:dn, pw:pw};
    saveAcct(u); doLoginOffline(u);
  }

  function offlineSignup(nm, em, pw) {
    if (getAccts().find(function(a){ return a.email===em; })) { showErr("signupError","Email already used. Sign in."); return; }
    var u = {uid:"u"+Date.now(), email:em, displayName:nm, pw:pw};
    saveAcct(u); doLoginOffline(u);
  }

  function doLoginOffline(u) {
    S.offline = true;
    var key = "ps_tx_"+u.uid;
    var raw = localStorage.getItem(key);
    S.txs = raw ? JSON.parse(raw) : SEED.map(function(t,i){ return Object.assign({},t,{id:"s"+i,uid:u.uid}); });
    if (!raw) localStorage.setItem(key, JSON.stringify(S.txs));
    doLogin({uid:u.uid, email:u.email, displayName:u.displayName});
  }

  function getAccts(){ try{ return JSON.parse(localStorage.getItem("ps_accounts")||"[]"); }catch(e){ return []; } }
  function saveAcct(u){ var a=getAccts().filter(function(x){ return x.uid!==u.uid; }); a.push(u); localStorage.setItem("ps_accounts",JSON.stringify(a)); }

  /* ── FIREBASE USER DOC ───────────────────────────────────── */
  function saveUserDoc(uid, name, email) {
    if (!FF) return Promise.resolve();
    return FF.setDoc(FF.doc(FF.db,"users",uid),{
      uid:uid, name:name, email:email,
      role: email===ADMIN_EMAIL ? "admin" : "user",
      createdAt: FF.serverTimestamp(), lastLogin: FF.serverTimestamp()
    }).catch(function(){});
  }
  function touchLogin(uid) {
    if (!FF || S.offline) return;
    FF.updateDoc(FF.doc(FF.db,"users",uid),{lastLogin:FF.serverTimestamp()}).catch(function(){});
  }
  function seedUserTx(uid) {
    if (!FF) return Promise.resolve();
    return Promise.all(SEED.map(function(t){ return FF.addDoc(FF.collection(FF.db,"transactions"),Object.assign({},t,{uid:uid})); })).catch(function(){});
  }

  /* ── ADMIN GATE (triple-click gem) ───────────────────────── */
  function bindAdminGate() {
    function makeGemHandler(gemId, dotsId) {
      var gem=$(gemId); if(!gem) return;
      var n=0, timer=null;
      gem.addEventListener("click", function(){
        n++; gem.classList.remove("gem-burst"); void gem.offsetWidth; gem.classList.add("gem-burst");
        updateDots(dotsId, n);
        if(timer) clearTimeout(timer);
        if(n>=3){ n=0; clearDots(dotsId); setTimeout(function(){ window.location.href="admin.html"; },220); return; }
        timer=setTimeout(function(){ n=0; clearDots(dotsId); },1600);
      });
    }
    makeGemHandler("authGem","clickDots");
    makeGemHandler("mobileGem","mClickDots");

    function updateDots(id,n){ var el=$(id); if(!el) return; el.innerHTML=""; el.classList.remove("hidden"); for(var i=0;i<3;i++){ var d=document.createElement("span"); d.className="click-dot"+(i<n?" on":""); el.appendChild(d); } }
    function clearDots(id){ var el=$(id); if(el){ el.innerHTML=""; el.classList.add("hidden"); } }

    $("adminBackBtn").addEventListener("click", function(){ showScreen("auth"); });
    $("adminLoginForm").addEventListener("submit", function(e){
      e.preventDefault();
      var em=$("adminEmail").value.trim(), pw=$("adminPassword").value.trim();
      if (S.offline||!FF) {
        if(em===ADMIN_EMAIL && pw==="admin1234") doLoginOffline({uid:"admin",email:ADMIN_EMAIL,displayName:"Admin"});
        else showErr("adminError","Use: "+ADMIN_EMAIL+" / admin1234");
        return;
      }
      FF.signInWithEmailAndPassword(FF.auth,em,pw).catch(function(err){ showErr("adminError",niceErr(err.code)); });
    });
  }

  /* ── LOGIN / LOGOUT ──────────────────────────────────────── */
  function doLogin(user) {
    S.user    = user;
    S.isAdmin = user.email === ADMIN_EMAIL;
    touchLogin(user.uid);
    showScreen("app");

    if (S.isAdmin) {
      /* Show admin sidebar, hide user sidebar */
      $("sidebar").classList.add("hidden");
      $("adminSidebar").classList.remove("hidden");
      bindAdminSidebar();
      updateAdminSidebarUI();
      navigateAdmin("admin-overview");
    } else {
      $("sidebar").classList.remove("hidden");
      $("adminSidebar").classList.add("hidden");
      bindUserSidebar();
      updateUserSidebarUI();
      navigateUser("dashboard");
    }

    /* Topbar brand */
    var tbBrand=$("tbBrand");
    if (tbBrand) tbBrand.textContent = S.isAdmin ? "⚡ Admin" : "PocketSense";

    if (!S.offline && FF) subscribeFirestore();
    else { hide("txLoader"); refreshAll(); }
    toast("👋 Welcome, "+cleanName(user)+"!", "ok");
    if (S.isAdmin) setTimeout(loadAdminData, 500);
  }

  function doLogout() {
    S.user=null; S.isAdmin=false; S.txs=[]; S.allTxs=[]; S.allUsers=[];
    if(S.unsub){ S.unsub(); S.unsub=null; }
    destroyCharts();
    showScreen("auth");
  }

  /* ── SIDEBAR BINDINGS ────────────────────────────────────── */
  function bindUserSidebar() {
    $$(".sb-link").forEach(function(lnk){
      lnk.addEventListener("click",function(e){
        e.preventDefault(); navigateUser(lnk.dataset.section);
        $("sidebar").classList.remove("open");
      });
    });
    if($("themeToggle")) $("themeToggle").addEventListener("click", toggleTheme);
    if($("signoutBtn")) $("signoutBtn").addEventListener("click", function(){
      if(!S.offline&&FF) FF.signOut(FF.auth); else doLogout();
    });
  }

  function bindAdminSidebar() {
    $$(".asb-link").forEach(function(lnk){
      lnk.addEventListener("click",function(e){
        e.preventDefault(); navigateAdmin(lnk.dataset.asection);
        $("adminSidebar").classList.remove("open");
      });
    });
    if($("aThemeToggle")) $("aThemeToggle").addEventListener("click", toggleTheme);
    if($("adminSignoutBtn")) $("adminSignoutBtn").addEventListener("click",function(){
      if(!S.offline&&FF) FF.signOut(FF.auth); else doLogout();
    });
  }

  /* ── NAVIGATION ──────────────────────────────────────────── */
  function navigateUser(section) {
    $$(".sb-link").forEach(function(l){ l.classList.toggle("active", l.dataset.section===section); });
    $$(".page").forEach(function(p){ p.classList.remove("active"); });
    var pg=$("section-"+section); if(pg) pg.classList.add("active");
    setTimeout(revealEls, 60);
  }

  function navigateAdmin(section) {
    S.adminSection = section;
    $$(".asb-link").forEach(function(l){ l.classList.toggle("active", l.dataset.asection===section); });
    $$(".page").forEach(function(p){ p.classList.remove("active"); });
    var pg=$("section-"+section); if(pg) pg.classList.add("active");
    setTimeout(revealEls, 60);
    if(section==="admin-users") { loadAdminData(); }
    if(section==="admin-analytics") { renderAdminAnalytics(); }
  }

  function revealEls() {
    document.querySelectorAll(".page.active [data-reveal]").forEach(function(el,i){
      setTimeout(function(){ el.classList.add("in"); }, i*70);
    });
  }

  /* ── APP EVENTS ──────────────────────────────────────────── */
  function bindAppEvents() {
    document.addEventListener("click", function(e){
      var el=e.target.closest("[data-goto]"); if(el) navigateUser(el.dataset.goto);
    });
    if($("hamburger")) $("hamburger").addEventListener("click", function(){
      /* toggle whichever sidebar is visible */
      var sb = S.isAdmin ? $("adminSidebar") : $("sidebar");
      if(sb) sb.classList.toggle("open");
    });
    if($("topbarTheme")) $("topbarTheme").addEventListener("click", toggleTheme);

    /* User filters */
    if($("searchInput")) $("searchInput").addEventListener("input",  function(e){ S.filters.search=e.target.value; renderTxFeed(); });
    if($("filterType"))  $("filterType").addEventListener("change",   function(e){ S.filters.type=e.target.value;   renderTxFeed(); });
    if($("filterCat"))   $("filterCat").addEventListener("change",    function(e){ S.filters.cat=e.target.value;    renderTxFeed(); });
    if($("sortBy"))      $("sortBy").addEventListener("change",       function(e){ S.filters.sort=e.target.value;   renderTxFeed(); });
    if($("addTxBtn"))    $("addTxBtn").addEventListener("click",      function(){ openModal(); });

    /* Period tabs */
    document.addEventListener("click", function(e){
      if(e.target.classList.contains("pp")){
        $$(".pp").forEach(function(t){ t.classList.remove("active"); });
        e.target.classList.add("active"); S.period=e.target.dataset.p;
        if(S.charts.trend){ S.charts.trend.destroy(); delete S.charts.trend; }
        renderTrendChart();
      }
    });

    /* Modal */
    if($("modalClose"))     $("modalClose").addEventListener("click",     closeModal);
    if($("modalCancelBtn")) $("modalCancelBtn").addEventListener("click", closeModal);
    if($("txModal"))        $("txModal").addEventListener("click",        function(e){ if(e.target===$("txModal")) closeModal(); });
    if($("modalSaveBtn"))   $("modalSaveBtn").addEventListener("click",   saveTx);
    $$(".tsw").forEach(function(b){ b.addEventListener("click",function(){ $$(".tsw").forEach(function(x){ x.classList.remove("active"); }); b.classList.add("active"); }); });
    if($("exportBtn")) $("exportBtn").addEventListener("click", exportCSV);

    /* Admin events */
    if($("adminAddBtn"))      $("adminAddBtn").addEventListener("click",   function(){ openModal(); });
    if($("refreshUsersBtn"))  $("refreshUsersBtn").addEventListener("click", function(){ loadAdminData(); toast("Refreshed","inf"); });
    if($("adminSearch"))      $("adminSearch").addEventListener("input",    function(e){ S.aFilters.search=e.target.value; renderAdminTxFeed(); });
    if($("adminUserFilter"))  $("adminUserFilter").addEventListener("change",function(e){ S.aFilters.uid=e.target.value;  renderAdminTxFeed(); });
    if($("adminTypeFilter"))  $("adminTypeFilter").addEventListener("change",function(e){ S.aFilters.type=e.target.value; renderAdminTxFeed(); });
    if($("userSearch"))       $("userSearch").addEventListener("input",     function(e){ renderAdminUsersTable(e.target.value); });
  }

  /* ── USER UI UPDATE ──────────────────────────────────────── */
  function updateUserSidebarUI() {
    var name  = cleanName(S.user);
    var email = S.user.email || "";
    var ini   = name.charAt(0).toUpperCase();
    if($("sbAvatar"))   $("sbAvatar").textContent   = ini;
    if($("sbUsername")) $("sbUsername").textContent = name;
    if($("sbEmail"))    $("sbEmail").textContent    = email;
    if($("tbAv"))       $("tbAv").textContent       = ini;
    /* Hero banner */
    if($("heroName"))   $("heroName").textContent   = name + "!";
    if($("heroAvatar")) $("heroAvatar").textContent = ini;
    if($("heroEmail"))  $("heroEmail").textContent  = email;
    if($("greeting"))   $("greeting").textContent   = greet();
  }

  function updateAdminSidebarUI() {
    var name = cleanName(S.user);
    var ini  = name.charAt(0).toUpperCase();
    if($("asbAvatar")) $("asbAvatar").textContent = ini;
    if($("asbName"))   $("asbName").textContent   = name;
    if($("tbAv"))      $("tbAv").textContent       = ini;
  }

  function greet(){ var h=new Date().getHours(); return h<12?"Good morning ☀️":h<17?"Good afternoon 🌤️":"Good evening 🌙"; }
  function setHeroDate(){ var e=$("heroDate"); if(e) e.textContent=new Date().toLocaleDateString("en-IN",{weekday:"long",year:"numeric",month:"long",day:"numeric"}); }

  function startAdminClock() {
    function tick(){ var el=$("adminTime"); if(el) el.textContent=new Date().toLocaleString("en-IN",{weekday:"short",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"}); }
    tick(); setInterval(tick,1000);
  }

  /* ── FIRESTORE ───────────────────────────────────────────── */
  function subscribeFirestore() {
    if(S.unsub) S.unsub();
    var uid=S.user.uid, col=FF.collection(FF.db,"transactions"), q;
    try {
      q = S.isAdmin
        ? FF.query(col, FF.orderBy("date","desc"))
        : FF.query(col, FF.where("uid","==",uid), FF.orderBy("date","desc"));
      show("txLoader");
      S.unsub = FF.onSnapshot(q, function(snap){
        var txs=snap.docs.map(function(d){ return Object.assign({id:d.id},d.data()); });
        if(S.isAdmin){ S.allTxs=txs; S.txs=txs.filter(function(t){ return t.uid===uid; }); }
        else S.txs=txs;
        hide("txLoader"); refreshAll();
        if(S.isAdmin){ renderAdminTxFeed(); loadAdminData(); }
      }, function(err){
        hide("txLoader");
        if(!S.txs.length) S.txs=SEED.map(function(t,i){ return Object.assign({},t,{id:"s"+i,uid:uid}); });
        refreshAll();
      });
    } catch(e){ hide("txLoader"); refreshAll(); }
  }

  /* ── ADMIN DATA ──────────────────────────────────────────── */
  function loadAdminData() {
    if(!S.isAdmin) return;
    if(S.offline||!FF){ buildUsersFromLocal(); return; }
    FF.getDocs(FF.collection(FF.db,"users")).then(function(snap){
      var users=snap.docs.map(function(d){ return Object.assign({id:d.id},d.data()); });
      var tc={};
      S.allTxs.forEach(function(t){ if(t.uid) tc[t.uid]=(tc[t.uid]||0)+1; });
      S.allUsers=users.map(function(u){ return Object.assign({},u,{txCount:tc[u.uid]||0}); });
      if(!S.allUsers.length) buildUsersFromTx();
      renderAdminUsersTable("");
      renderAdminKpis();
      populateAdminUserFilter();
      var cl=$("userCountLine"); if(cl) cl.textContent=S.allUsers.length+" registered users";
    }).catch(function(){ buildUsersFromTx(); });
  }

  function buildUsersFromTx() {
    var map={};
    S.allTxs.forEach(function(t){ if(!t.uid) return; if(!map[t.uid]) map[t.uid]={uid:t.uid,name:"User "+t.uid.slice(0,8),email:"—",role:"user",txCount:0}; map[t.uid].txCount++; });
    S.allUsers=Object.values(map);
    renderAdminUsersTable(""); renderAdminKpis(); populateAdminUserFilter();
  }

  function buildUsersFromLocal() {
    var accts=getAccts(), tc={};
    S.txs.forEach(function(t){ if(t.uid) tc[t.uid]=(tc[t.uid]||0)+1; });
    var uids=new Set(S.txs.map(function(t){ return t.uid; }));
    S.allUsers=Array.from(uids).map(function(uid){
      var a=accts.find(function(x){ return x.uid===uid; })||{};
      return {uid:uid,name:a.displayName||cleanName({email:a.email||""})||"User",email:a.email||"—",role:uid==="admin"?"admin":"user",txCount:tc[uid]||0};
    });
    renderAdminUsersTable(""); renderAdminKpis(); populateAdminUserFilter();
    var cl=$("userCountLine"); if(cl) cl.textContent=S.allUsers.length+" registered users";
  }

  /* ── REFRESH ALL ─────────────────────────────────────────── */
  function refreshAll() {
    updateUserSidebarUI();
    renderStatCards();
    destroyCharts();
    renderDashCharts();
    renderRecentFeed();
    renderTxFeed();
    renderInsights();
    renderSavingsRing();
    renderSparklines();
    if(S.isAdmin){ renderAdminKpis(); renderAdminCharts(); renderAdminTxFeed(); }
    setTimeout(revealEls, 80);
  }

  /* ── SUMMARY ─────────────────────────────────────────────── */
  function summary(txs) {
    var inc=0,exp=0;
    txs.forEach(function(t){ if(t.type==="income") inc+=Number(t.amount); else exp+=Number(t.amount); });
    return {inc:inc,exp:exp,bal:inc-exp,sav:inc>0?((inc-exp)/inc*100).toFixed(1):"0.0"};
  }

  /* ── STAT CARDS ──────────────────────────────────────────── */
  function renderStatCards() {
    var s=summary(S.txs);
    countUp("cardBalance",s.bal,true);
    countUp("cardIncome",s.inc,true);
    countUp("cardExpense",s.exp,true);
    var sv=$("cardSavings"); if(sv) sv.textContent=s.sav+"%";
    var bn=$("balNote");
    if(bn){ bn.textContent=s.bal>=0?"↑ Positive balance":"↓ Negative balance"; bn.className="sc-note "+(s.bal>=0?"positive":"negative"); }
    var sn=$("savNote");
    if(sn){ sn.textContent=parseFloat(s.sav)>=20?"✓ Healthy savings":"⚠ Save more"; sn.className="sc-note "+(parseFloat(s.sav)>=20?"positive":""); }
  }

  function countUp(id, target, currency) {
    var el=$(id); if(!el) return;
    var dur=900, start=Date.now();
    (function step(){
      var p=Math.min((Date.now()-start)/dur,1), ease=1-Math.pow(1-p,3), v=Math.round(target*ease);
      el.textContent=currency?fmt(v):v;
      if(p<1) requestAnimationFrame(step);
    })();
  }

  function renderSavingsRing(){
    var c=$("savRing"); if(!c) return;
    var ctx=c.getContext("2d"); ctx.clearRect(0,0,52,52);
    var pct=Math.min(parseFloat(summary(S.txs).sav)/100,1);
    ctx.beginPath();ctx.arc(26,26,18,0,Math.PI*2);ctx.strokeStyle="rgba(255,255,255,.08)";ctx.lineWidth=4;ctx.stroke();
    if(pct>0){
      ctx.beginPath();ctx.arc(26,26,18,-Math.PI/2,-Math.PI/2+pct*Math.PI*2);
      var g=ctx.createLinearGradient(0,0,52,52);g.addColorStop(0,"#6366f1");g.addColorStop(1,"#ec4899");
      ctx.strokeStyle=g;ctx.lineWidth=4;ctx.lineCap="round";ctx.stroke();
    }
  }

  function renderSparklines(){
    var mons=getMonthKeys("6m");
    var iD=mons.map(function(m){ return S.txs.filter(function(t){ return t.date&&t.date.startsWith(m.key)&&t.type==="income"; }).reduce(function(s,t){ return s+Number(t.amount);},0); });
    var eD=mons.map(function(m){ return S.txs.filter(function(t){ return t.date&&t.date.startsWith(m.key)&&t.type==="expense"; }).reduce(function(s,t){ return s+Number(t.amount);},0); });
    var bD=iD.map(function(v,i){ return v-eD[i]; });
    spark("spkBal",bD,"#6366f1"); spark("spkInc",iD,"#10b981"); spark("spkExp",eD,"#ec4899");
  }
  function spark(id,data,color){
    var c=$(id); if(!c) return;
    var ctx=c.getContext("2d"); ctx.clearRect(0,0,c.width,c.height);
    if(data.length<2) return;
    var mn=Math.min.apply(null,data),mx=Math.max.apply(null,data),range=mx-mn||1;
    var w=c.width,h=c.height,step=w/(data.length-1);
    ctx.beginPath();
    data.forEach(function(v,i){ var x=i*step,y=h-(((v-mn)/range)*h*.75+h*.12); i?ctx.lineTo(x,y):ctx.moveTo(x,y); });
    ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.lineJoin="round";ctx.stroke();
  }

  /* ── CHARTS ──────────────────────────────────────────────── */
  var isDark=function(){ return S.theme==="dark"; };
  var gc=function(){ return isDark()?"rgba(255,255,255,.04)":"rgba(0,0,0,.05)"; };
  var tc=function(){ return isDark()?"#4a4d6a":"#9093b0"; };
  var tt=function(){ return {backgroundColor:isDark()?"rgba(9,9,15,.96)":"rgba(255,255,255,.96)",borderColor:isDark()?"rgba(255,255,255,.1)":"rgba(0,0,0,.1)",borderWidth:1,titleColor:isDark()?"#8b8fae":"#454869",bodyColor:isDark()?"#eef0ff":"#080a18"}; };

  function getMonthKeys(p){
    var r=[],base=new Date(2025,5,1),n=p==="6m"?6:p==="3m"?3:1;
    for(var i=n-1;i>=0;i--){
      var d=new Date(base.getFullYear(),base.getMonth()-i,1);
      r.push({key:d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"),label:d.toLocaleString("en-IN",{month:"short",year:"2-digit"})});
    }
    return r;
  }

  function renderDashCharts(){ renderTrendChart(); renderMixChart(); }

  function renderTrendChart(){
    var mons=getMonthKeys(S.period),labels=mons.map(function(m){ return m.label; });
    var data=mons.map(function(m){ var tx=S.txs.filter(function(t){ return t.date&&t.date.startsWith(m.key); }); var i=0,e=0; tx.forEach(function(t){ if(t.type==="income") i+=Number(t.amount); else e+=Number(t.amount); }); return i-e; });
    if(S.charts.trend) S.charts.trend.destroy();
    var c=$("trendChart"); if(!c) return;
    var ctx=c.getContext("2d"),g=ctx.createLinearGradient(0,0,0,280);
    g.addColorStop(0,"rgba(99,102,241,.3)");g.addColorStop(1,"rgba(99,102,241,.02)");
    S.charts.trend=new Chart(ctx,{type:"line",data:{labels:labels,datasets:[{data:data,borderColor:"#6366f1",backgroundColor:g,borderWidth:2.5,pointRadius:5,pointBackgroundColor:"#6366f1",pointBorderColor:isDark()?"#09090f":"#fff",pointBorderWidth:2,fill:true,tension:.42}]},options:{responsive:true,plugins:{legend:{display:false},tooltip:Object.assign(tt(),{callbacks:{label:function(c){ return " "+fmt(c.parsed.y); }}})},scales:{x:{grid:{color:gc()},ticks:{color:tc(),font:{size:11}}},y:{grid:{color:gc()},ticks:{color:tc(),font:{size:11},callback:function(v){ return "₹"+(Math.abs(v)>=1000?(v/1000).toFixed(0)+"k":v); }}}}}});
  }

  function renderMixChart(){
    var exp=S.txs.filter(function(t){ return t.type==="expense"; }), cm={};
    exp.forEach(function(t){ cm[t.category]=(cm[t.category]||0)+Number(t.amount); });
    var sorted=Object.entries(cm).sort(function(a,b){ return b[1]-a[1]; }).slice(0,7);
    var total=sorted.reduce(function(s,c){ return s+c[1]; },0);
    var dv=$("donutVal"); if(dv) dv.textContent=fmt(total);
    if(S.charts.mix) S.charts.mix.destroy();
    var c=$("mixChart"); if(!c) return;
    S.charts.mix=new Chart(c.getContext("2d"),{type:"doughnut",data:{labels:sorted.map(function(s){ return s[0]; }),datasets:[{data:sorted.map(function(s){ return s[1]; }),backgroundColor:sorted.map(function(s){ return getCat(s[0]).color; }),borderWidth:2,borderColor:isDark()?"#09090f":"#fff",hoverOffset:8}]},options:{responsive:true,cutout:"68%",plugins:{legend:{display:false},tooltip:Object.assign(tt(),{callbacks:{label:function(c){ return " "+fmt(c.parsed); }}})}}});
    var leg=$("mixLegend"); if(!leg) return;
    leg.innerHTML=sorted.map(function(c){ return '<div class="ml-row"><div class="ml-left"><div class="ml-dot" style="background:'+getCat(c[0]).color+'"></div><span class="ml-name">'+esc(c[0])+'</span></div><span class="ml-pct">'+(total>0?((c[1]/total)*100).toFixed(0):0)+'%</span></div>'; }).join("");
  }

  function renderMonthlyChart(){
    var mons=getMonthKeys("6m"),labels=mons.map(function(m){ return m.label; });
    var iD=mons.map(function(m){ return S.txs.filter(function(t){ return t.date&&t.date.startsWith(m.key)&&t.type==="income"; }).reduce(function(s,t){ return s+Number(t.amount);},0); });
    var eD=mons.map(function(m){ return S.txs.filter(function(t){ return t.date&&t.date.startsWith(m.key)&&t.type==="expense"; }).reduce(function(s,t){ return s+Number(t.amount);},0); });
    if(S.charts.monthly) S.charts.monthly.destroy();
    var c=$("monthlyChart"); if(!c) return;
    S.charts.monthly=new Chart(c.getContext("2d"),{type:"bar",data:{labels:labels,datasets:[{label:"Income",data:iD,backgroundColor:"rgba(16,185,129,.75)",borderRadius:8,borderSkipped:false},{label:"Expenses",data:eD,backgroundColor:"rgba(236,72,153,.75)",borderRadius:8,borderSkipped:false}]},options:{responsive:true,plugins:{legend:{labels:{color:tc(),font:{size:12},padding:16,boxWidth:10}},tooltip:Object.assign(tt(),{callbacks:{label:function(c){ return " "+c.dataset.label+": "+fmt(c.parsed.y); }}})},scales:{x:{grid:{color:gc()},ticks:{color:tc()}},y:{grid:{color:gc()},ticks:{color:tc(),callback:function(v){ return "₹"+(v>=1000?(v/1000).toFixed(0)+"k":v); }}}}}});
  }

  /* Admin charts */
  function renderAdminCharts(){
    var src=S.isAdmin?S.allTxs:S.txs;
    var mons=getMonthKeys("6m"),labels=mons.map(function(m){ return m.label; });
    var iD=mons.map(function(m){ return src.filter(function(t){ return t.date&&t.date.startsWith(m.key)&&t.type==="income"; }).reduce(function(s,t){ return s+Number(t.amount);},0); });
    var eD=mons.map(function(m){ return src.filter(function(t){ return t.date&&t.date.startsWith(m.key)&&t.type==="expense"; }).reduce(function(s,t){ return s+Number(t.amount);},0); });
    if(S.charts.adminMonthly) S.charts.adminMonthly.destroy();
    var c=$("adminMonthlyChart"); if(c){
      S.charts.adminMonthly=new Chart(c.getContext("2d"),{type:"bar",data:{labels:labels,datasets:[{label:"Income",data:iD,backgroundColor:"rgba(245,158,11,.7)",borderRadius:6,borderSkipped:false},{label:"Expenses",data:eD,backgroundColor:"rgba(239,68,68,.5)",borderRadius:6,borderSkipped:false}]},options:{responsive:true,plugins:{legend:{labels:{color:tc()}},tooltip:Object.assign(tt(),{callbacks:{label:function(c){ return " "+c.dataset.label+": "+fmt(c.parsed.y); }}})},scales:{x:{grid:{color:gc()},ticks:{color:tc()}},y:{grid:{color:gc()},ticks:{color:tc(),callback:function(v){ return "₹"+(v>=1000?(v/1000).toFixed(0)+"k":v); }}}}}}); }
    /* Category donut */
    var cm={};
    src.filter(function(t){ return t.type==="expense"; }).forEach(function(t){ cm[t.category]=(cm[t.category]||0)+Number(t.amount); });
    var sorted=Object.entries(cm).sort(function(a,b){ return b[1]-a[1]; }).slice(0,7);
    if(S.charts.adminCat) S.charts.adminCat.destroy();
    var c2=$("adminCatChart"); if(c2){
      S.charts.adminCat=new Chart(c2.getContext("2d"),{type:"doughnut",data:{labels:sorted.map(function(s){ return s[0]; }),datasets:[{data:sorted.map(function(s){ return s[1]; }),backgroundColor:sorted.map(function(s){ return getCat(s[0]).color; }),borderWidth:2,borderColor:isDark()?"#0c0d12":"#fff",hoverOffset:8}]},options:{responsive:true,cutout:"65%",plugins:{legend:{labels:{color:tc(),font:{size:11},padding:12,boxWidth:10}},tooltip:Object.assign(tt(),{callbacks:{label:function(c){ return " "+fmt(c.parsed); }}})}}}); }
  }

  function destroyCharts(){
    ["trend","mix","monthly","adminMonthly","adminCat"].forEach(function(k){ if(S.charts[k]){ S.charts[k].destroy(); delete S.charts[k]; } });
  }

  /* ── RECENT FEED ─────────────────────────────────────────── */
  function renderRecentFeed(){
    var recent=S.txs.slice().sort(function(a,b){ return new Date(b.date)-new Date(a.date); }).slice(0,5);
    var el=$("recentFeed"); if(!el) return;
    if(!recent.length){ el.innerHTML='<p style="color:var(--t3);padding:20px;text-align:center;font-size:13px">No transactions yet.</p>'; return; }
    el.innerHTML=recent.map(function(t,i){
      var cat=getCat(t.category),isInc=t.type==="income";
      return '<div class="feed-item" style="animation-delay:'+(i*50)+'ms">'+
        '<div class="fi-ico" style="background:'+cat.color+'18">'+cat.icon+'</div>'+
        '<div class="fi-info"><div class="fi-name">'+esc(t.desc)+'</div><div class="fi-cat">'+esc(t.category)+'</div></div>'+
        '<div class="fi-right"><div class="fi-amt '+(isInc?"inc":"exp")+'">'+(isInc?"+":"−")+fmt(t.amount)+'</div><div class="fi-date">'+fmtD(t.date)+'</div></div>'+
      '</div>';
    }).join("");
  }

  /* ── TX FEED ─────────────────────────────────────────────── */
  function populateCatFilter(){
    var sel=$("filterCat"); if(!sel) return;
    CATS.forEach(function(c){ var o=document.createElement("option"); o.value=c.label; o.textContent=c.icon+" "+c.label; sel.appendChild(o); });
  }

  function getFiltered(){
    var f=S.filters,txs=S.txs.slice();
    if(f.search){ var q=f.search.toLowerCase(); txs=txs.filter(function(t){ return (t.desc||"").toLowerCase().includes(q)||(t.category||"").toLowerCase().includes(q); }); }
    if(f.type!=="all") txs=txs.filter(function(t){ return t.type===f.type; });
    if(f.cat!=="all")  txs=txs.filter(function(t){ return t.category===f.cat; });
    txs.sort(function(a,b){
      if(f.sort==="date-desc") return new Date(b.date)-new Date(a.date);
      if(f.sort==="date-asc")  return new Date(a.date)-new Date(b.date);
      if(f.sort==="amt-desc")  return Number(b.amount)-Number(a.amount);
      if(f.sort==="amt-asc")   return Number(a.amount)-Number(b.amount);
      return 0;
    });
    return txs;
  }

  function renderTxFeed(){
    var txs=getFiltered(),feed=$("txFeed"),empty=$("emptyTx");
    hide("txLoader"); if(!feed) return;
    if(!txs.length){ feed.innerHTML=""; if(empty) empty.classList.remove("hidden"); if($("txCount")) $("txCount").textContent=""; return; }
    if(empty) empty.classList.add("hidden");
    if($("txCount")) $("txCount").textContent=txs.length+" transaction"+(txs.length!==1?"s":"");
    if($("txSummary")){ var s=summary(txs); $("txSummary").textContent=txs.length+" items · In: "+fmt(s.inc)+" · Out: "+fmt(s.exp); }
    feed.innerHTML=txs.map(function(t,idx){
      var cat=getCat(t.category),isInc=t.type==="income";
      return '<div class="tx-item" style="animation-delay:'+(idx*22)+'ms">'+
        '<div class="ti-ico" style="background:'+cat.color+'18">'+cat.icon+'</div>'+
        '<div><div class="ti-name">'+esc(t.desc)+'</div><div class="ti-meta"><span class="ti-cat">'+esc(t.category)+'</span></div></div>'+
        '<div class="ti-date">'+fmtD(t.date)+'</div>'+
        '<div><span class="type-chip '+(isInc?"chip-inc":"chip-exp")+'">'+t.type+'</span></div>'+
        '<div class="ti-amt '+(isInc?"inc":"exp")+'">'+(isInc?"+":"−")+fmt(t.amount)+'</div>'+
        '<div class="ti-actions">'+
          '<button class="icon-btn" onclick="PS.edit(\''+t.id+'\')">✏</button>'+
          '<button class="icon-btn danger" onclick="PS.del(\''+t.id+'\')">✕</button>'+
        '</div></div>';
    }).join("");
  }

  /* ── ADMIN KPIs ──────────────────────────────────────────── */
  function renderAdminKpis(){
    var src=S.isAdmin?S.allTxs:S.txs;
    var s=summary(src);
    var uids=new Set(src.map(function(t){ return t.uid; }));
    var uc=Math.max(S.allUsers.length,uids.size);
    countUp("kpiUsers",uc,false);
    countUp("kpiTx",src.length,false);
    if($("kpiVol")) $("kpiVol").textContent=fmt(s.inc+s.exp);
    countUp("kpiAvg",uc?Math.round(src.length/uc):0,false);
    if($("kpiIncome"))  $("kpiIncome").textContent=fmt(s.inc);
    if($("kpiExpense")) $("kpiExpense").textContent=fmt(s.exp);
    if($("kpiUsersTrend")) $("kpiUsersTrend").textContent=uc+" total";
    if($("kpiTxTrend"))    $("kpiTxTrend").textContent=src.length+" records";
    renderAdminCharts();
  }

  /* ── ADMIN USERS TABLE ───────────────────────────────────── */
  function renderAdminUsersTable(searchVal) {
    var wrap=$("usersTableWrap"); if(!wrap) return;
    var users=S.allUsers.slice();
    if(searchVal){ var q=searchVal.toLowerCase(); users=users.filter(function(u){ return (u.name||"").toLowerCase().includes(q)||(u.email||"").toLowerCase().includes(q); }); }
    if(!users.length){ wrap.innerHTML='<p style="padding:22px;color:var(--t3);font-size:13px">No users found.</p>'; return; }
    var cl=$("userCountLine"); if(cl) cl.textContent=S.allUsers.length+" registered users · showing "+users.length;
    var rows=users.map(function(u,i){
      var ll=u.lastLogin;
      if(ll&&ll.toDate) ll=ll.toDate().toLocaleDateString("en-IN");
      else if(ll&&ll.seconds) ll=new Date(ll.seconds*1000).toLocaleDateString("en-IN");
      else ll="—";
      var ini=(u.name||u.email||"U").charAt(0).toUpperCase();
      return '<tr>'+
        '<td class="u-num">'+(i+1)+'</td>'+
        '<td><div style="display:flex;align-items:center;gap:10px">'+
          '<div class="u-av">'+ini+'</div>'+
          '<div><div class="u-name">'+esc(u.name||"—")+'</div><div class="u-email">'+esc(u.email||"—")+'</div></div>'+
        '</div></td>'+
        '<td><span class="u-role '+(u.role==="admin"?"ur-admin":"ur-user")+'">'+(u.role||"user")+'</span></td>'+
        '<td class="u-tx">'+((u.txCount||0))+'</td>'+
        '<td class="u-login">'+esc(String(ll))+'</td>'+
        '<td class="u-acts">'+
          '<button class="u-btn amber" onclick="PS.viewUser(\''+u.uid+'\',\''+esc(u.name||u.email||u.uid)+'\')">View Tx</button>'+
          '<button class="u-btn" onclick="PS.messageUser(\''+u.uid+'\',\''+esc(u.name||"User")+'\')">&#9993;</button>'+
          (u.uid!=="admin"&&u.uid!==S.user.uid?'<button class="u-btn red" onclick="PS.clearUserTx(\''+u.uid+'\',\''+esc(u.name||"User")+'\')">Clear Tx</button>':'')+(u.uid!=="admin"&&u.uid!==S.user.uid?'<button class="u-btn red" onclick="PS.deleteUser(\''+u.uid+'\',\''+esc(u.name||"User")+'\')">Delete</button>':'')+
        '</td>'+
      '</tr>';
    }).join("");
    wrap.innerHTML='<table class="users-table">'+
      '<thead><tr><th>#</th><th>User</th><th>Role</th><th>Transactions</th><th>Last Login</th><th>Actions</th></tr></thead>'+
      '<tbody>'+rows+'</tbody></table>';
  }

  function populateAdminUserFilter(){
    var sel=$("adminUserFilter"); if(!sel) return;
    var cur=sel.value;
    sel.innerHTML='<option value="all">All Users</option>'+S.allUsers.map(function(u){ return '<option value="'+u.uid+'">'+esc(u.name||u.email||u.uid)+'</option>'; }).join("");
    sel.value=cur;
  }

  /* ── ADMIN TX FEED ───────────────────────────────────────── */
  function renderAdminTxFeed(){
    var src=S.isAdmin?S.allTxs:S.txs;
    var af=S.aFilters,txs=src.slice();
    if(af.uid!=="all")  txs=txs.filter(function(t){ return t.uid===af.uid; });
    if(af.type!=="all") txs=txs.filter(function(t){ return t.type===af.type; });
    if(af.search){ var q=af.search.toLowerCase(); txs=txs.filter(function(t){ return (t.desc||"").toLowerCase().includes(q)||(t.category||"").toLowerCase().includes(q); }); }
    txs.sort(function(a,b){ return new Date(b.date)-new Date(a.date); });
    var feed=$("adminTxFeed"); if(!feed) return;
    if(!txs.length){ feed.innerHTML='<p style="padding:20px;color:var(--t3);font-size:13px">No transactions found.</p>'; return; }
    feed.innerHTML=txs.slice(0,200).map(function(t,idx){
      var cat=getCat(t.category),isInc=t.type==="income";
      var uName=S.allUsers.find(function(u){ return u.uid===t.uid; });
      return '<div class="tx-item" style="animation-delay:'+(idx*15)+'ms">'+
        '<div class="ti-ico" style="background:'+cat.color+'18">'+cat.icon+'</div>'+
        '<div><div class="ti-name">'+esc(t.desc)+'</div><div class="ti-meta"><span class="ti-cat">'+esc(t.category)+'</span>'+
          (uName?'<span class="ti-uid">'+esc(uName.name||uName.email||t.uid.slice(0,8))+'</span>':'')+
        '</div></div>'+
        '<div class="ti-date">'+fmtD(t.date)+'</div>'+
        '<div><span class="type-chip '+(isInc?"chip-inc":"chip-exp")+'">'+t.type+'</span></div>'+
        '<div class="ti-amt '+(isInc?"inc":"exp")+'">'+(isInc?"+":"−")+fmt(t.amount)+'</div>'+
        '<div class="ti-actions">'+
          '<button class="icon-btn" onclick="PS.edit(\''+t.id+'\')">✏</button>'+
          '<button class="icon-btn danger" onclick="PS.del(\''+t.id+'\')">✕</button>'+
        '</div></div>';
    }).join("");
  }

  /* ── ADMIN ANALYTICS ─────────────────────────────────────── */
  function renderAdminAnalytics(){
    var src=S.isAdmin?S.allTxs:S.txs;
    /* Top spenders by uid */
    var spendMap={},earnMap={};
    src.forEach(function(t){
      if(t.type==="expense") spendMap[t.uid]=(spendMap[t.uid]||0)+Number(t.amount);
      else earnMap[t.uid]=(earnMap[t.uid]||0)+Number(t.amount);
    });
    renderLeaderboard("topSpenders", spendMap);
    renderLeaderboard("topEarners",  earnMap);
    /* Global cat breakdown */
    var cm={};
    src.filter(function(t){ return t.type==="expense"; }).forEach(function(t){ cm[t.category]=(cm[t.category]||0)+Number(t.amount); });
    var total=Object.values(cm).reduce(function(s,v){ return s+v; },0);
    var sorted=Object.entries(cm).sort(function(a,b){ return b[1]-a[1]; });
    var el=$("adminCatBreak"); if(!el) return;
    if(!sorted.length){ el.innerHTML='<p style="padding:16px;color:var(--t3);font-size:13px">No data.</p>'; return; }
    el.innerHTML=sorted.map(function(c){
      var cat=getCat(c[0]),pct=total>0?((c[1]/total)*100).toFixed(1):0;
      return '<div class="cat-row"><div class="cat-name">'+cat.icon+' '+esc(c[0])+'</div>'+
        '<div class="cat-bar-wrap"><div class="cat-bar" style="width:'+pct+'%;background:'+cat.color+'"></div></div>'+
        '<div class="cat-amt">'+fmt(c[1])+'</div><div class="cat-pct">'+Math.round(pct)+'%</div></div>';
    }).join("");
  }

  function renderLeaderboard(elId, map){
    var el=$(elId); if(!el) return;
    var sorted=Object.entries(map).sort(function(a,b){ return b[1]-a[1]; }).slice(0,5);
    if(!sorted.length){ el.innerHTML='<p style="padding:16px;color:var(--t3);font-size:13px">No data yet.</p>'; return; }
    el.innerHTML=sorted.map(function(entry,i){
      var uid=entry[0], amt=entry[1];
      var u=S.allUsers.find(function(x){ return x.uid===uid; })||{name:"User "+uid.slice(0,8),email:"—"};
      var ini=(u.name||"U").charAt(0).toUpperCase();
      var medals=["🥇","🥈","🥉","4️⃣","5️⃣"];
      return '<div class="leader-row"><div class="lr-rank">'+medals[i]+'</div>'+
        '<div class="lr-av">'+ini+'</div>'+
        '<div class="lr-info"><div class="lr-name">'+esc(u.name||"—")+'</div><div class="lr-email">'+esc(u.email||"—")+'</div></div>'+
        '<div style="text-align:right"><div class="lr-amt">'+fmt(amt)+'</div></div>'+
      '</div>';
    }).join("");
  }

  /* ── INSIGHTS ────────────────────────────────────────────── */
  function renderInsights(){
    var txs=S.txs,exps=txs.filter(function(t){ return t.type==="expense"; }),incs=txs.filter(function(t){ return t.type==="income"; });
    var cm={}; exps.forEach(function(t){ cm[t.category]=(cm[t.category]||0)+Number(t.amount); });
    var top=Object.entries(cm).sort(function(a,b){ return b[1]-a[1]; })[0];
    if(top){ var c=getCat(top[0]); if($("iTopCat")) $("iTopCat").textContent=c.icon+" "+top[0]; if($("iTopAmt")) $("iTopAmt").textContent=fmt(top[1])+" spent"; }
    var mc={}; txs.forEach(function(t){ var m=t.date?t.date.slice(0,7):null; if(m) mc[m]=(mc[m]||0)+1; });
    var topM=Object.entries(mc).sort(function(a,b){ return b[1]-a[1]; })[0];
    if(topM){ if($("iBusyMonth")) $("iBusyMonth").textContent=fmtM(topM[0]+"-01"); if($("iBusyCnt")) $("iBusyCnt").textContent=topM[1]+" transactions"; }
    var te=exps.reduce(function(s,t){ return s+Number(t.amount); },0);
    if(txs.length>1){ var dates=txs.map(function(t){ return new Date(t.date); }).filter(function(d){ return !isNaN(d); }); if(dates.length>1){ var days=Math.max(1,Math.ceil((Math.max.apply(null,dates)-Math.min.apply(null,dates))/86400000)); if($("iAvgDay")) $("iAvgDay").textContent=fmt(Math.round(te/days)); } }
    var bi=incs.slice().sort(function(a,b){ return Number(b.amount)-Number(a.amount); })[0];
    if(bi){ if($("iBigInc")) $("iBigInc").textContent=fmt(bi.amount); if($("iBigDesc")) $("iBigDesc").textContent=bi.desc+" · "+fmtD(bi.date); }
    renderMonthlyChart();
    renderCatBreak();
  }

  function renderCatBreak(){
    var exp=S.txs.filter(function(t){ return t.type==="expense"; }),cm={};
    exp.forEach(function(t){ cm[t.category]=(cm[t.category]||0)+Number(t.amount); });
    var total=Object.values(cm).reduce(function(s,v){ return s+v; },0);
    var sorted=Object.entries(cm).sort(function(a,b){ return b[1]-a[1]; });
    var el=$("catBreak"); if(!el) return;
    if(!sorted.length){ el.innerHTML='<p style="padding:16px;color:var(--t3);font-size:13px">No expense data.</p>'; return; }
    el.innerHTML=sorted.map(function(c){ var cat=getCat(c[0]),pct=total>0?((c[1]/total)*100).toFixed(1):0; return '<div class="cat-row"><div class="cat-name">'+cat.icon+' '+esc(c[0])+'</div><div class="cat-bar-wrap"><div class="cat-bar" style="width:'+pct+'%;background:'+cat.color+'"></div></div><div class="cat-amt">'+fmt(c[1])+'</div><div class="cat-pct">'+Math.round(pct)+'%</div></div>'; }).join("");
  }

  /* ── MODAL ───────────────────────────────────────────────── */
  var _eid=null;
  function buildCatGrid(){
    var g=$("catGrid"); if(!g) return;
    g.innerHTML=CATS.map(function(c){ return '<div class="cat-chip" data-cat="'+c.label+'">'+c.icon+' '+c.label+'</div>'; }).join("");
    g.addEventListener("click",function(e){ var chip=e.target.closest(".cat-chip"); if(!chip) return; $$(".cat-chip").forEach(function(c){ c.classList.remove("on"); }); chip.classList.add("on"); });
  }

  function openModal(tx){
    _eid=tx?tx.id:null;
    $("modalTitle").textContent=tx?"Edit Transaction":"Add Transaction";
    $("mDesc").value=tx?tx.desc:""; $("mAmt").value=tx?tx.amount:"";
    $("mDate").value=tx?tx.date:new Date().toISOString().slice(0,10);
    $$(".tsw").forEach(function(b){ b.classList.toggle("active",b.dataset.t===(tx?tx.type:"expense")); });
    $$(".cat-chip").forEach(function(c){ c.classList.toggle("on",c.dataset.cat===(tx?tx.category:"")); });
    if(!tx){ var f=document.querySelector(".cat-chip"); if(f) f.classList.add("on"); }
    show("txModal");
  }

  function closeModal(){ hide("txModal"); _eid=null; }

  function saveTx(){
    var desc=($("mDesc").value||"").trim(), amt=parseFloat($("mAmt").value), date=$("mDate").value;
    var type=(document.querySelector(".tsw.active")||{dataset:{t:"expense"}}).dataset.t;
    var cat=(document.querySelector(".cat-chip.on")||{dataset:{cat:"Other"}}).dataset.cat;
    if(!desc||isNaN(amt)||amt<=0||!date){ toast("Fill in all fields.","err"); return; }
    var data={desc:desc,amount:amt,date:date,type:type,category:cat,uid:S.user.uid};
    setBtn("saveBtnText","Saving...");
    if(S.offline||!FF){
      if(_eid){ var i=S.txs.findIndex(function(t){ return t.id===_eid; }); if(i!==-1) S.txs[i]=Object.assign({},S.txs[i],data); }
      else{ data.id="l"+Date.now(); S.txs.unshift(data); }
      localStorage.setItem("ps_tx_"+S.user.uid,JSON.stringify(S.txs));
      closeModal(); destroyCharts(); refreshAll();
      toast(_eid?"✅ Updated!":"✅ Added!","ok"); setBtn("saveBtnText","Save Transaction"); return;
    }
    var p=_eid&&!_eid.startsWith("s")?FF.updateDoc(FF.doc(FF.db,"transactions",_eid),data):FF.addDoc(FF.collection(FF.db,"transactions"),Object.assign({},data,{createdAt:FF.serverTimestamp()}));
    p.then(function(){ closeModal(); toast("✅ Saved!","ok"); }).catch(function(e){ toast("Error: "+e.message,"err"); }).finally(function(){ setBtn("saveBtnText","Save Transaction"); });
  }

  function deleteTx(id){
    if(!confirm("Delete this transaction?")) return;
    if(S.offline||!FF||id.startsWith("s")||id.startsWith("l")){
      S.txs=S.txs.filter(function(t){ return t.id!==id; });
      if(S.isAdmin) S.allTxs=S.allTxs.filter(function(t){ return t.id!==id; });
      localStorage.setItem("ps_tx_"+S.user.uid,JSON.stringify(S.txs));
      destroyCharts(); refreshAll(); toast("Deleted.","inf"); return;
    }
    FF.deleteDoc(FF.doc(FF.db,"transactions",id)).then(function(){ toast("Deleted.","inf"); }).catch(function(e){ toast("Error: "+e.message,"err"); });
  }

  /* ── ADMIN ACTIONS ───────────────────────────────────────── */
  function viewUser(uid, name){
    navigateAdmin("admin-transactions");
    var sel=$("adminUserFilter"); if(sel){ sel.value=uid; S.aFilters.uid=uid; }
    renderAdminTxFeed();
    toast("Showing transactions for: "+name,"inf");
  }

  function clearUserTx(uid, name){
    if(!confirm("Clear ALL transactions for \""+name+"\"? Cannot be undone.")) return;
    if(S.offline||!FF){
      S.allTxs=S.allTxs.filter(function(t){ return t.uid!==uid; });
      if(uid===S.user.uid) S.txs=[];
      destroyCharts(); refreshAll(); renderAdminTxFeed(); loadAdminData();
      toast("Cleared transactions for "+name,"ok"); return;
    }
    var q=FF.query(FF.collection(FF.db,"transactions"),FF.where("uid","==",uid));
    FF.getDocs(q).then(function(snap){ return Promise.all(snap.docs.map(function(d){ return FF.deleteDoc(d.ref); })); })
      .then(function(){ toast("Cleared transactions for "+name,"ok"); loadAdminData(); })
      .catch(function(e){ toast("Error: "+e.message,"err"); });
  }

  function deleteUser(uid, name){
    if(!confirm("Delete user \""+name+"\" and ALL their data? This cannot be undone.")) return;
    toast("Deleting user "+name+"...","inf");
    /* Remove from our local state */
    S.allUsers=S.allUsers.filter(function(u){ return u.uid!==uid; });
    S.allTxs=S.allTxs.filter(function(t){ return t.uid!==uid; });
    if(!S.offline&&FF){
      var q=FF.query(FF.collection(FF.db,"transactions"),FF.where("uid","==",uid));
      FF.getDocs(q).then(function(snap){ return Promise.all(snap.docs.map(function(d){ return FF.deleteDoc(d.ref); })); })
        .then(function(){ return FF.deleteDoc(FF.doc(FF.db,"users",uid)); })
        .then(function(){ toast("User "+name+" deleted.","ok"); loadAdminData(); })
        .catch(function(e){ toast("Error: "+e.message,"err"); });
    } else {
      var accts=getAccts().filter(function(a){ return a.uid!==uid; }); localStorage.setItem("ps_accounts",JSON.stringify(accts));
      renderAdminUsersTable(""); renderAdminKpis(); renderAdminTxFeed();
      toast("User "+name+" deleted (offline).","ok");
    }
  }

  function messageUser(uid, name){ toast("Message feature — coming soon! (uid: "+uid+")","inf"); }

  /* ── EXPORT ──────────────────────────────────────────────── */
  function exportCSV(){
    var txs=getFiltered();
    var rows=[["Date","Description","Category","Type","Amount"]].concat(txs.map(function(t){ return [t.date,'"'+t.desc+'"',t.category,t.type,t.amount]; })).map(function(r){ return r.join(","); }).join("\n");
    var a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([rows],{type:"text/csv"})); a.download="pocketsense-export.csv"; a.click();
    toast("📥 Exported","inf");
  }

  /* ── TOAST ───────────────────────────────────────────────── */
  function toast(msg,type){
    var wrap=$("toastStack"); if(!wrap) return;
    var el=document.createElement("div"); el.className="toast-item "+(type||"inf"); el.textContent=msg;
    wrap.appendChild(el);
    setTimeout(function(){ el.classList.add("bye"); setTimeout(function(){ el.remove(); },280); },3200);
  }

  /* ── HELPERS ─────────────────────────────────────────────── */
  function showErr(id,msg){ var e=$(id); if(!e) return; e.textContent=msg; e.classList.remove("hidden"); setTimeout(function(){ e.classList.add("hidden"); },5000); }
  function niceErr(code){ var m={"auth/user-not-found":"No account found.","auth/wrong-password":"Incorrect password.","auth/email-already-in-use":"Email already registered.","auth/weak-password":"Password needs 6+ chars.","auth/invalid-email":"Invalid email.","auth/too-many-requests":"Too many attempts.","auth/invalid-credential":"Invalid email or password.","auth/network-request-failed":"Network error."}; return m[code]||"Something went wrong."; }

  /* ── BG CANVAS ───────────────────────────────────────────── */
  function startBgCanvas(){
    var c=$("bgCanvas"); if(!c) return;
    var ctx=c.getContext("2d"),pts=[],W,H;
    function resize(){ W=c.width=window.innerWidth; H=c.height=window.innerHeight; }
    window.addEventListener("resize",resize); resize();
    for(var i=0;i<60;i++) pts.push({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.3,vy:(Math.random()-.5)*.3,r:Math.random()*1.6+.4,a:Math.random()*.35+.08,col:["#6366f1","#a855f7","#ec4899","#10b981","#3b82f6"][Math.floor(Math.random()*5)]});
    (function draw(){
      ctx.clearRect(0,0,W,H);
      pts.forEach(function(p){ p.x=(p.x+p.vx+W)%W; p.y=(p.y+p.vy+H)%H; ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=p.col;ctx.globalAlpha=p.a;ctx.fill(); });
      for(var i=0;i<pts.length;i++) for(var j=i+1;j<pts.length;j++){ var dx=pts[i].x-pts[j].x,dy=pts[i].y-pts[j].y,d=Math.sqrt(dx*dx+dy*dy); if(d<110){ctx.beginPath();ctx.moveTo(pts[i].x,pts[i].y);ctx.lineTo(pts[j].x,pts[j].y);ctx.strokeStyle=pts[i].col;ctx.globalAlpha=(1-d/110)*.06;ctx.lineWidth=.6;ctx.stroke();} }
      ctx.globalAlpha=1; requestAnimationFrame(draw);
    })();
  }

  function startCursorGlow(){
    var el=$("cursorGlow"); if(!el) return;
    document.addEventListener("mousemove",function(e){ el.style.left=e.clientX+"px";el.style.top=e.clientY+"px"; });
  }

  function startAdminCanvas(){
    var c=$("adminCanvas"); if(!c) return;
    var ctx=c.getContext("2d"),chars="01アイウエオABCXYZ";
    function resize(){ c.width=window.innerWidth;c.height=window.innerHeight; }
    window.addEventListener("resize",resize); resize();
    var cols=Math.floor(c.width/18),drops=[];
    for(var i=0;i<cols;i++) drops[i]=Math.random()*50;
    setInterval(function(){ ctx.fillStyle="rgba(6,7,13,.06)";ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle="#f59e0b";ctx.font="13px 'JetBrains Mono',monospace"; for(var i=0;i<drops.length;i++){ ctx.fillText(chars[Math.floor(Math.random()*chars.length)],i*18,drops[i]*18); if(drops[i]*18>c.height&&Math.random()>.975) drops[i]=0; drops[i]+=.5; } },60);
  }

  /* ── EXPOSE ──────────────────────────────────────────────── */
  window.PS={
    edit:function(id){ var src=S.isAdmin?S.allTxs:S.txs; var t=src.find(function(x){ return x.id===id; }); if(t) openModal(t); },
    del:deleteTx, viewUser:viewUser, clearUserTx:clearUserTx, deleteUser:deleteUser, messageUser:messageUser,
  };

  /* ── START ───────────────────────────────────────────────── */
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot); else boot();

})();