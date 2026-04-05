/* ================================================================
   PocketSense Admin — admin.js
   Loads ALL transactions from ALL users (not just admin's own)
   Fully offline-capable with localStorage fallback
   ================================================================ */
(function () {

  var ADMIN_EMAIL = "admin@pocketsense.app";
  var OFFLINE_PASS = "admin1234";

  var D = window.FF_DATA;
  var CATS = D.CATEGORIES;
  var fmt = D.fmtCurrency;
  var fmtD = D.fmtDate;
  var fmtM = D.fmtMonth;
  var getCat = D.getCat;

  /* ── STATE ────────────────────────────────────────────────── */
  var S = {
    user: null,
    allTxs: [],     /* EVERY transaction from every user */
    allUsers: [],   /* every registered user */
    filters: { search:"", uid:"all", type:"all", cat:"all", sort:"date-desc" },
    charts: {},
    theme: "dark",
    unsub: null,
    offline: false,
  };

  var FF = null;

  /* ── DOM ──────────────────────────────────────────────────── */
  var $  = function(id){ return document.getElementById(id); };
  var $$ = function(s){  return document.querySelectorAll(s); };
  var show = function(id){ var e=$(id); if(e) e.classList.remove("hidden"); };
  var hide = function(id){ var e=$(id); if(e) e.classList.add("hidden"); };
  var esc  = function(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); };

  function cleanName(u) {
    if (!u) return "User";
    if (u.name && u.name.trim()) return u.name.trim();
    if (u.displayName && u.displayName.trim()) return u.displayName.trim();
    var local = (u.email||"").split("@")[0];
    local = local.replace(/[._\-]?\d+$/, "").replace(/[._\-]+/g, " ").trim();
    return local.replace(/\b\w/g, function(c){ return c.toUpperCase(); }) || "User";
  }

  /* ── BOOT ─────────────────────────────────────────────────── */
  function boot() {
    S.theme = localStorage.getItem("ps_admin_theme") || "dark";
    applyTheme(S.theme, false);
    startParticles();
    startMatrix();
    buildCatPicker();
    bindLogin();
    bindNav();
    bindFilters();
    bindModal();
    startClock();
    showScreen("login");

    if (window.__FF) { FF = window.__FF; checkFirebase(); }
    else {
      window.addEventListener("firebaseReady", function(){ FF = window.__FF; checkFirebase(); });
      setTimeout(function(){ if(!FF) S.offline = true; }, 3000);
    }
  }

  function checkFirebase() {
    try {
      var pid = FF.auth.app.options.projectId || "";
      if (!pid || pid === "YOUR_PROJECT_ID") { S.offline = true; return; }
      FF.onAuthStateChanged(FF.auth, function(u){
        if (u && u.email === ADMIN_EMAIL) {
          S.user = u; enterDashboard();
        } else if (u && u.email !== ADMIN_EMAIL) {
          /* Non-admin user — redirect */
          FF.signOut(FF.auth);
          showErr("loginErr", "Access denied. Admin account required.");
        }
      });
    } catch(e) { S.offline = true; }
  }

  /* ── SCREENS ──────────────────────────────────────────────── */
  function showScreen(s) {
    hide("loginScreen"); hide("dashScreen");
    show(s+"Screen");
  }

  /* ── THEME ────────────────────────────────────────────────── */
  function applyTheme(t, redraw) {
    S.theme = t;
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("ps_admin_theme", t);
    var lbl=$("aThemeLbl"), icon=$("aThemeIcon");
    if(lbl)  lbl.textContent  = t==="light" ? "Light" : "Dark";
    if(icon) icon.textContent = t==="light" ? "☀" : "🌙";
    if (redraw !== false && S.user) { destroyCharts(); renderAllCharts(); }
  }
  function toggleTheme() { applyTheme(S.theme==="dark"?"light":"dark", true); }

  /* ── LOGIN ────────────────────────────────────────────────── */
  function bindLogin() {
    $("adminLoginForm").addEventListener("submit", function(e){
      e.preventDefault();
      var em = $("adminEmail").value.trim();
      var pw = $("adminPass").value.trim();
      if (!em || !pw) { showErr("loginErr","Enter email and password."); return; }

      /* Offline / demo mode */
      if (S.offline || !FF) {
        if (em === ADMIN_EMAIL && pw === OFFLINE_PASS) {
          S.user = { uid:"admin-offline", email:ADMIN_EMAIL, displayName:"Admin" };
          enterDashboardOffline();
        } else {
          showErr("loginErr","Invalid credentials. Use: "+ADMIN_EMAIL+" / "+OFFLINE_PASS);
        }
        return;
      }
      $("loginBtnText").textContent = "Verifying...";
      FF.signInWithEmailAndPassword(FF.auth, em, pw)
        .then(function(cred){
          if (cred.user.email !== ADMIN_EMAIL) {
            FF.signOut(FF.auth);
            showErr("loginErr","Access denied. Admin account only.");
            $("loginBtnText").textContent = "Access Dashboard";
          }
        })
        .catch(function(err){
          showErr("loginErr", niceErr(err.code));
          $("loginBtnText").textContent = "Access Dashboard";
        });
    });
  }

  /* ── ENTER DASHBOARD ──────────────────────────────────────── */
  function enterDashboard() {
    showScreen("dash");
    updateAdminUI();
    setTimeout(revealEls, 100);  /* animate overview elements on first load */
    if ($("aThemeToggle")) $("aThemeToggle").addEventListener("click", toggleTheme);
    if ($("aTbTheme"))     $("aTbTheme").addEventListener("click", toggleTheme);
    if ($("aSignoutBtn"))  $("aSignoutBtn").addEventListener("click", function(){ FF ? FF.signOut(FF.auth) : showScreen("login"); });
    if ($("aHam"))         $("aHam").addEventListener("click", function(){ $("asb").classList.toggle("open"); });
    bindExport();

    /* Subscribe to ALL transactions — charts render after data arrives */
    subscribeAllTransactions();
    /* Load all users */
    loadAllUsers();
  }

  function enterDashboardOffline() {
    S.offline = true;
    showScreen("dash");
    updateAdminUI();
    setTimeout(revealEls, 100);
    if ($("aThemeToggle")) $("aThemeToggle").addEventListener("click", toggleTheme);
    if ($("aTbTheme"))     $("aTbTheme").addEventListener("click", toggleTheme);
    if ($("aSignoutBtn"))  $("aSignoutBtn").addEventListener("click", function(){ S.user=null; location.reload(); });
    if ($("aHam"))         $("aHam").addEventListener("click", function(){ $("asb").classList.toggle("open"); });
    bindExport();

    /* Load ALL transactions from ALL localStorage users */
    loadAllOfflineTxs();
    loadAllOfflineUsers();
  }

  function updateAdminUI() {
    var name = cleanName(S.user)||"Admin";
    var ini  = name.charAt(0).toUpperCase();
    if($("asbAv"))   $("asbAv").textContent   = ini;
    if($("asbName")) $("asbName").textContent  = name;
    if($("aTbAv"))   $("aTbAv").textContent    = ini;
  }

  /* ── LOAD ALL OFFLINE TXS ─────────────────────────────────── */
  function loadAllOfflineTxs() {
    /* Collect all localStorage keys that match ps_tx_* */
    var allTxs = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.startsWith("ps_tx_")) {
        try {
          var txs = JSON.parse(localStorage.getItem(key) || "[]");
          allTxs = allTxs.concat(txs);
        } catch(e) {}
      }
    }
    /* Also include demo user's seed data if no entries found */
    if (!allTxs.length) {
      allTxs = D.SEED_TRANSACTIONS.map(function(t, i){
        return Object.assign({}, t, { id:"seed-"+i, uid:"demo" });
      });
    }
    S.allTxs = allTxs;
    onTxsLoaded();
  }

  function loadAllOfflineUsers() {
    var accts = [];
    try { accts = JSON.parse(localStorage.getItem("ps_accounts") || "[]"); } catch(e) {}
    /* Also add demo user if not in list */
    if (!accts.find(function(a){ return a.uid === "demo"; })) {
      accts.push({ uid:"demo", email:"demo@pocketsense.app", displayName:"Demo User", role:"user" });
    }
    /* Count txs per user */
    var tc = {};
    S.allTxs.forEach(function(t){ if(t.uid) tc[t.uid]=(tc[t.uid]||0)+1; });
    S.allUsers = accts.map(function(a){
      return {
        uid: a.uid||a.id||"",
        name: a.displayName || cleanName(a) || "User",
        email: a.email || "—",
        role: a.uid==="admin-offline" ? "admin" : (a.role||"user"),
        txCount: tc[a.uid||""]||0,
        lastLogin: null
      };
    });
    renderUsers("");
    renderKpis();
    populateTxUserFilter();
    populateModalUsers();
  }

  /* ── FIRESTORE LISTENER — ALL TRANSACTIONS ────────────────── */
  function subscribeAllTransactions() {
    if (S.unsub) S.unsub();
    try {
      var col = FF.collection(FF.db, "transactions");
      var q   = FF.query(col, FF.orderBy("date","desc"));
      show("txLoader");
      show("txLoader");
      S.unsub = FF.onSnapshot(q, function(snap){
        S.allTxs = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
        /* If Firestore returns no data, fall back to localStorage */
        if (!S.allTxs.length) loadAllOfflineTxs();
        hide("txLoader"); onTxsLoaded();
      }, function(err){
        console.warn("Firestore:", err.message);
        hide("txLoader");
        /* Fallback: try offline */
        loadAllOfflineTxs();
      });
    } catch(e) { hide("txLoader"); loadAllOfflineTxs(); }
  }

  function loadAllUsers() {
    if (!FF) { loadAllOfflineUsers(); return; }
    FF.getDocs(FF.collection(FF.db,"users")).then(function(snap){
      var users = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
      var tc = {};
      S.allTxs.forEach(function(t){ if(t.uid) tc[t.uid]=(tc[t.uid]||0)+1; });
      S.allUsers = users.map(function(u){ return Object.assign({},u,{txCount:tc[u.uid]||0}); });
      /* If no users in Firestore, derive from transactions */
      if (!S.allUsers.length) deriveUsersFromTxs();
      else finishUserLoad();
    }).catch(function(){ deriveUsersFromTxs(); });
  }

  function deriveUsersFromTxs() {
    var map = {};
    S.allTxs.forEach(function(t){
      if (!t.uid) return;
      if (!map[t.uid]) map[t.uid] = {uid:t.uid,name:"User "+t.uid.slice(0,8),email:"—",role:"user",txCount:0};
      map[t.uid].txCount++;
    });
    S.allUsers = Object.values(map);
    finishUserLoad();
  }

  function finishUserLoad() {
    renderUsers("");
    renderKpis();
    populateTxUserFilter();
    populateModalUsers();
    var cl=$("userCountLine"); if(cl) cl.textContent=S.allUsers.length+" registered users";
  }

  /* Called whenever S.allTxs is updated */
  function onTxsLoaded() {
    /* Update user tx counts first */
    var tc = {};
    S.allTxs.forEach(function(t){ if(t.uid) tc[t.uid]=(tc[t.uid]||0)+1; });
    S.allUsers = S.allUsers.map(function(u){ return Object.assign({},u,{txCount:tc[u.uid]||0}); });

    renderKpis();
    renderTxFeed();
    renderRecentActivity();
    renderTxCountLine();
    if (S.allUsers.length) renderUsers("");

    /* Defer chart rendering so DOM is fully painted and canvas has dimensions */
    setTimeout(function(){
      renderAllCharts();
      revealEls();
    }, 120);
  }

  /* ── NAVIGATION ───────────────────────────────────────────── */
  function bindNav() {
    $$(".asb-link").forEach(function(lnk){
      lnk.addEventListener("click", function(e){
        e.preventDefault();
        navigateTo(lnk.dataset.sec);
        $("asb").classList.remove("open");
      });
    });
    if($("refreshBtn")) $("refreshBtn").addEventListener("click", function(){
      loadAllUsers();
      if(!S.offline && FF) subscribeAllTransactions();
      else { loadAllOfflineTxs(); loadAllOfflineUsers(); }
      toast("Refreshed", "inf");
    });
  }

  function navigateTo(sec) {
    $$(".asb-link").forEach(function(l){ l.classList.toggle("active", l.dataset.sec===sec); });
    $$(".a-page").forEach(function(p){ p.classList.remove("active"); });
    var pg = $("sec-"+sec); if(pg) pg.classList.add("active");
    /* Reset reveal so elements re-animate on each visit */
    document.querySelectorAll(".a-page.active [data-rev]").forEach(function(el){ el.classList.remove("in"); });
    setTimeout(revealEls, 60);
    if (sec === "overview") {
      setTimeout(function(){ renderKpis(); renderAllCharts(); renderRecentActivity(); }, 80);
    }
    if (sec === "analytics") setTimeout(renderAnalytics, 80);
    if (sec === "users") { loadAllUsers(); if(!S.offline&&FF) subscribeAllTransactions(); }
    if (sec === "transactions") renderTxFeed();
  }

  function revealEls() {
    document.querySelectorAll(".a-page.active [data-rev]").forEach(function(el,i){
      setTimeout(function(){ el.classList.add("in"); }, i*70);
    });
  }

  /* ── KPIs ─────────────────────────────────────────────────── */
  function renderKpis() {
    var txs = S.allTxs;
    var inc = 0, exp = 0;
    txs.forEach(function(t){ if(t.type==="income") inc+=Number(t.amount); else exp+=Number(t.amount); });
    var uids = new Set(txs.map(function(t){ return t.uid; }));
    var uc = Math.max(S.allUsers.length, uids.size);

    countUp("kpiUsers",  uc, false);
    countUp("kpiTx",     txs.length, false);
    if($("kpiVol"))     $("kpiVol").textContent = fmt(inc+exp);
    countUp("kpiAvg",   uc ? Math.round(txs.length/uc) : 0, false);
    if($("kpiIncome"))  $("kpiIncome").textContent  = fmt(inc);
    if($("kpiExpense")) $("kpiExpense").textContent = fmt(exp);
    if($("kpiUsersNote"))$("kpiUsersNote").textContent = uc+" total";
    if($("kpiTxNote"))  $("kpiTxNote").textContent  = txs.length+" records";
    /* Nav badges */
    if($("navUserCount")) $("navUserCount").textContent = uc;
    if($("navTxCount"))   $("navTxCount").textContent   = txs.length;
  }

  function countUp(id, target, currency) {
    var el=$(id); if(!el) return;
    var dur=900, start=Date.now();
    (function step(){
      var p=Math.min((Date.now()-start)/dur,1), ease=1-Math.pow(1-p,3), v=Math.round(target*ease);
      el.textContent = currency ? fmt(v) : v;
      if(p<1) requestAnimationFrame(step);
    })();
  }

  /* ── CHARTS ───────────────────────────────────────────────── */
  var isDark = function(){ return S.theme==="dark"; };
  var gc = function(){ return isDark()?"rgba(255,255,255,.04)":"rgba(0,0,0,.04)"; };
  var tc = function(){ return isDark()?"#4a4d6a":"#9093b0"; };
  var tt = function(){ return {
    backgroundColor:isDark()?"rgba(7,8,13,.96)":"rgba(255,255,255,.96)",
    borderColor:isDark()?"rgba(255,255,255,.1)":"rgba(0,0,0,.1)",
    borderWidth:1, titleColor:isDark()?"#8b8fae":"#454869",
    bodyColor:isDark()?"#f0f2ff":"#080a18"
  };};

  function getMonthKeys() {
    var r=[], base=new Date(2025,5,1);
    for(var i=5;i>=0;i--){
      var d=new Date(base.getFullYear(),base.getMonth()-i,1);
      r.push({key:d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"),
               label:d.toLocaleString("en-IN",{month:"short",year:"2-digit"})});
    }
    return r;
  }

  function renderAllCharts() { renderMonthlyChart(); renderCatChart(); }

  function renderMonthlyChart() {
    var mons=getMonthKeys(), txs=S.allTxs;
    var iD=mons.map(function(m){ return txs.filter(function(t){ return t.date&&t.date.startsWith(m.key)&&t.type==="income"; }).reduce(function(s,t){ return s+Number(t.amount);},0); });
    var eD=mons.map(function(m){ return txs.filter(function(t){ return t.date&&t.date.startsWith(m.key)&&t.type==="expense"; }).reduce(function(s,t){ return s+Number(t.amount);},0); });
    if(S.charts.monthly) S.charts.monthly.destroy();
    var c=$("monthlyChart"); if(!c) return;
    S.charts.monthly=new Chart(c.getContext("2d"),{
      type:"bar",
      data:{labels:mons.map(function(m){ return m.label; }),datasets:[
        {label:"Income",data:iD,backgroundColor:"rgba(245,158,11,.75)",borderRadius:8,borderSkipped:false},
        {label:"Expenses",data:eD,backgroundColor:"rgba(239,68,68,.55)",borderRadius:8,borderSkipped:false}
      ]},
      options:{responsive:true,plugins:{legend:{labels:{color:tc(),font:{size:12},padding:16,boxWidth:10}},
        tooltip:Object.assign(tt(),{callbacks:{label:function(c){ return " "+c.dataset.label+": "+fmt(c.parsed.y); }}})},
        scales:{x:{grid:{color:gc()},ticks:{color:tc()}},
          y:{grid:{color:gc()},ticks:{color:tc(),callback:function(v){ return "₹"+(v>=1000?(v/1000).toFixed(0)+"k":v); }}}}}
    });
  }

  function renderCatChart() {
    var exp=S.allTxs.filter(function(t){ return t.type==="expense"; }), cm={};
    exp.forEach(function(t){ cm[t.category]=(cm[t.category]||0)+Number(t.amount); });
    var sorted=Object.entries(cm).sort(function(a,b){ return b[1]-a[1]; }).slice(0,8);
    var total=sorted.reduce(function(s,c){ return s+c[1]; },0);
    if(S.charts.cat) S.charts.cat.destroy();
    var c=$("catChart"); if(!c) return;
    S.charts.cat=new Chart(c.getContext("2d"),{
      type:"doughnut",
      data:{labels:sorted.map(function(s){ return s[0]; }),
        datasets:[{data:sorted.map(function(s){ return s[1]; }),
          backgroundColor:sorted.map(function(s){ return getCat(s[0]).color; }),
          borderWidth:2,borderColor:isDark()?"#07080d":"#fff",hoverOffset:8}]},
      options:{responsive:true,cutout:"62%",plugins:{legend:{display:false},
        tooltip:Object.assign(tt(),{callbacks:{label:function(c){ return " "+fmt(c.parsed); }}})}}
    });
    /* Legend */
    var leg=$("catLegend"); if(!leg) return;
    leg.innerHTML=sorted.map(function(c){
      return '<div class="cl-row"><div class="cl-left">'+
        '<div class="cl-dot" style="background:'+getCat(c[0]).color+'"></div>'+
        '<span class="cl-name">'+esc(c[0])+'</span></div>'+
        '<span class="cl-pct">'+(total>0?((c[1]/total)*100).toFixed(0):0)+'%</span></div>';
    }).join("");
  }

  function destroyCharts() {
    ["monthly","cat","userComp","volTrend"].forEach(function(k){
      if(S.charts[k]){ S.charts[k].destroy(); delete S.charts[k]; }
    });
  }

  /* ── RECENT ACTIVITY ──────────────────────────────────────── */
  function renderRecentActivity() {
    var recent = S.allTxs.slice().sort(function(a,b){ return new Date(b.date)-new Date(a.date); }).slice(0,8);
    var el=$("recentActivity"); if(!el) return;
    var cnt=$("recentCount"); if(cnt) cnt.textContent="last "+recent.length+" transactions";
    if(!recent.length){ el.innerHTML='<p style="padding:16px;color:var(--t3);font-size:13px">No transactions yet.</p>'; return; }
    el.innerHTML=recent.map(function(t,i){
      var cat=getCat(t.category), isInc=t.type==="income";
      var u=S.allUsers.find(function(x){ return x.uid===t.uid; });
      var uName=u?cleanName(u):"Unknown User";
      return '<div class="ra-row" style="animation-delay:'+(i*40)+'ms">'+
        '<div class="ra-ico" style="background:'+cat.color+'18">'+cat.icon+'</div>'+
        '<div class="ra-info">'+
          '<div class="ra-name">'+esc(t.desc)+'</div>'+
          '<div class="ra-by">'+esc(uName)+' · '+esc(t.category)+'</div>'+
        '</div>'+
        '<div class="ra-right">'+
          '<div class="ra-amt '+(isInc?"inc":"exp")+'">'+(isInc?"+":"−")+fmt(t.amount)+'</div>'+
          '<div class="ra-date">'+fmtD(t.date)+'</div>'+
        '</div></div>';
    }).join("");
  }

  /* ── USERS TABLE ──────────────────────────────────────────── */
  function renderUsers(searchVal) {
    var wrap=$("usersTableWrap"); if(!wrap) return;
    var roleF = $("roleFilter") ? $("roleFilter").value : "all";
    var users = S.allUsers.slice();
    if (searchVal){ var q=searchVal.toLowerCase(); users=users.filter(function(u){ return (u.name||"").toLowerCase().includes(q)||(u.email||"").toLowerCase().includes(q); }); }
    if (roleF!=="all") users=users.filter(function(u){ return u.role===roleF; });
    var cl=$("userCountLine"); if(cl) cl.textContent=S.allUsers.length+" registered users · showing "+users.length;
    if(!users.length){ wrap.innerHTML='<p style="padding:22px;color:var(--t3);font-size:13px">No users found.</p>'; return; }
    var rows=users.map(function(u,i){
      var ll=u.lastLogin;
      if(ll&&ll.toDate) ll=ll.toDate().toLocaleDateString("en-IN");
      else if(ll&&ll.seconds) ll=new Date(ll.seconds*1000).toLocaleDateString("en-IN");
      else ll="—";
      var ini=(cleanName(u)||"U").charAt(0).toUpperCase();
      return '<tr>'+
        '<td class="u-num">'+(i+1)+'</td>'+
        '<td><div style="display:flex;align-items:center;gap:10px">'+
          '<div class="u-av">'+ini+'</div>'+
          '<div><div class="u-name">'+esc(cleanName(u))+'</div><div class="u-email">'+esc(u.email||"—")+'</div></div>'+
        '</div></td>'+
        '<td><span class="u-role '+(u.role==="admin"?"ur-admin":"ur-user")+'">'+(u.role||"user")+'</span></td>'+
        '<td class="u-tx">'+((u.txCount||0))+'</td>'+
        '<td class="u-login">'+esc(String(ll))+'</td>'+
        '<td class="u-acts">'+
          '<button class="u-btn" data-uid="'+u.uid+'" data-name="'+esc(cleanName(u))+'" onclick="ADMIN.viewUserTx(this.dataset.uid,this.dataset.name)">View Tx</button>'+
          '<button class="u-btn" data-uid="'+u.uid+'" onclick="ADMIN.filterByUser(this.dataset.uid)">Filter</button>'+
          (u.email!==ADMIN_EMAIL?'<button class="u-btn danger" data-uid="'+u.uid+'" data-name="'+esc(cleanName(u))+'" onclick="ADMIN.clearUserTx(this.dataset.uid,this.dataset.name)">Clear Tx</button>':'')+
          (u.email!==ADMIN_EMAIL?'<button class="u-btn danger" data-uid="'+u.uid+'" data-name="'+esc(cleanName(u))+'" onclick="ADMIN.deleteUser(this.dataset.uid,this.dataset.name)">Delete</button>':'')+
        '</td></tr>';
    }).join("");
    wrap.innerHTML='<div class="users-overflow"><table class="users-table">'+
      '<thead><tr><th>#</th><th>User</th><th>Role</th><th>Transactions</th><th>Last Login</th><th>Actions</th></tr></thead>'+
      '<tbody>'+rows+'</tbody></table></div>';
  }

  /* ── TX FEED ──────────────────────────────────────────────── */
  function bindFilters() {
    if($("userSearch"))   $("userSearch").addEventListener("input",   function(e){ renderUsers(e.target.value); });
    if($("roleFilter"))   $("roleFilter").addEventListener("change",  function(){ renderUsers($("userSearch")?$("userSearch").value:""); });
    if($("txSearch"))     $("txSearch").addEventListener("input",     function(e){ S.filters.search=e.target.value; renderTxFeed(); });
    if($("txUserFilter")) $("txUserFilter").addEventListener("change",function(e){ S.filters.uid=e.target.value;    renderTxFeed(); });
    if($("txTypeFilter")) $("txTypeFilter").addEventListener("change",function(e){ S.filters.type=e.target.value;   renderTxFeed(); });
    if($("txCatFilter"))  $("txCatFilter").addEventListener("change", function(e){ S.filters.cat=e.target.value;    renderTxFeed(); });
    if($("txSort"))       $("txSort").addEventListener("change",      function(e){ S.filters.sort=e.target.value;   renderTxFeed(); });
    if($("addTxBtn"))     $("addTxBtn").addEventListener("click",     function(){ openModal(); });
  }

  function getFilteredTxs() {
    var f=S.filters, txs=S.allTxs.slice();
    if(f.uid!=="all")    txs=txs.filter(function(t){ return t.uid===f.uid; });
    if(f.type!=="all")   txs=txs.filter(function(t){ return t.type===f.type; });
    if(f.cat!=="all")    txs=txs.filter(function(t){ return t.category===f.cat; });
    if(f.search){ var q=f.search.toLowerCase(); txs=txs.filter(function(t){ return (t.desc||"").toLowerCase().includes(q)||(t.category||"").toLowerCase().includes(q)||(t.uid||"").toLowerCase().includes(q); }); }
    txs.sort(function(a,b){
      if(f.sort==="date-desc") return new Date(b.date)-new Date(a.date);
      if(f.sort==="date-asc")  return new Date(a.date)-new Date(b.date);
      if(f.sort==="amt-desc")  return Number(b.amount)-Number(a.amount);
      if(f.sort==="amt-asc")   return Number(a.amount)-Number(b.amount);
      return 0;
    });
    return txs;
  }

  function renderTxFeed() {
    var txs=getFilteredTxs(), feed=$("txFeed"), empty=$("txEmpty");
    hide("txLoader"); if(!feed) return;
    renderTxCountLine(txs.length);
    if(!txs.length){ feed.innerHTML=""; if(empty) empty.classList.remove("hidden"); return; }
    if(empty) empty.classList.add("hidden");
    feed.innerHTML=txs.slice(0,200).map(function(t,idx){
      var cat=getCat(t.category), isInc=t.type==="income";
      var u=S.allUsers.find(function(x){ return x.uid===t.uid; });
      var uName=u?cleanName(u):t.uid?t.uid.slice(0,10):"—";
      return '<div class="tx-row" style="animation-delay:'+(idx*18)+'ms">'+
        '<div class="tx-ico" style="background:'+cat.color+'18">'+cat.icon+'</div>'+
        '<div><div class="tx-desc">'+esc(t.desc)+'</div>'+
          '<div class="tx-meta"><span class="tx-cat">'+esc(t.category)+'</span>'+
          '<span class="tx-user-badge">'+esc(uName)+'</span></div></div>'+
        '<div class="tx-date">'+fmtD(t.date)+'</div>'+
        '<div><span class="type-chip '+(isInc?"chip-inc":"chip-exp")+'">'+t.type+'</span></div>'+
        '<div class="tx-amt '+(isInc?"inc":"exp")+'">'+(isInc?"+":"−")+fmt(t.amount)+'</div>'+
        '<div class="tx-act">'+
          '<button class="icon-btn" onclick="ADMIN.editTx(\''+t.id+'\')">✏</button>'+
          '<button class="icon-btn danger" onclick="ADMIN.deleteTx(\''+t.id+'\')">✕</button>'+
        '</div></div>';
    }).join("");
  }

  function renderTxCountLine(count) {
    var cl=$("txCountLine");
    if(!cl) return;
    var n=count!==undefined?count:S.allTxs.length;
    cl.textContent=n+" transaction"+(n!==1?"s":"")+" · Total: "+fmt(S.allTxs.reduce(function(s,t){ return s+Number(t.amount);},0));
  }

  function populateTxUserFilter() {
    var sel=$("txUserFilter"); if(!sel) return;
    var cur=sel.value;
    sel.innerHTML='<option value="all">All Users</option>'+S.allUsers.map(function(u){
      return '<option value="'+u.uid+'">'+esc(cleanName(u))+' ('+esc(u.email||"—")+')</option>';
    }).join("");
    sel.value=cur;
    /* Also populate cat filter */
    var cats=new Set(S.allTxs.map(function(t){ return t.category; }));
    var cf=$("txCatFilter"); if(!cf) return;
    cf.innerHTML='<option value="all">All Categories</option>'+Array.from(cats).sort().map(function(c){
      var cat=getCat(c); return '<option value="'+c+'">'+cat.icon+' '+c+'</option>';
    }).join("");
  }

  /* ── ANALYTICS ────────────────────────────────────────────── */
  function renderAnalytics() {
    var txs=S.allTxs;
    var spendMap={}, earnMap={};
    txs.forEach(function(t){
      if(t.type==="expense") spendMap[t.uid]=(spendMap[t.uid]||0)+Number(t.amount);
      else earnMap[t.uid]=(earnMap[t.uid]||0)+Number(t.amount);
    });
    renderLeaderboard("topSpenders",spendMap,"exp");
    renderLeaderboard("topEarners", earnMap, "inc");
    renderGlobalCatBreak();
    renderUserCompChart(spendMap, earnMap);
    renderVolTrendChart();
  }

  function renderLeaderboard(elId, map, cls) {
    var el=$(elId); if(!el) return;
    var sorted=Object.entries(map).sort(function(a,b){ return b[1]-a[1]; }).slice(0,5);
    if(!sorted.length){ el.innerHTML='<p style="padding:16px;color:var(--t3);font-size:13px">No data yet.</p>'; return; }
    var medals=["🥇","🥈","🥉","4️⃣","5️⃣"];
    el.innerHTML=sorted.map(function(entry,i){
      var uid=entry[0], amt=entry[1];
      var u=S.allUsers.find(function(x){ return x.uid===uid; })||{name:"User "+uid.slice(0,8),email:"—"};
      var ini=(cleanName(u)||"U").charAt(0).toUpperCase();
      var txCnt=S.allTxs.filter(function(t){ return t.uid===uid&&(cls==="exp"?t.type==="expense":t.type==="income"); }).length;
      return '<div class="leader-row">'+
        '<div class="lr-rank">'+medals[i]+'</div>'+
        '<div class="lr-av">'+ini+'</div>'+
        '<div class="lr-info"><div class="lr-name">'+esc(cleanName(u))+'</div><div class="lr-email">'+esc(u.email||"—")+'</div></div>'+
        '<div style="text-align:right"><div class="lr-amt">'+fmt(amt)+'</div><div class="lr-cnt">'+txCnt+' tx</div></div>'+
      '</div>';
    }).join("");
  }

  function renderGlobalCatBreak() {
    var exp=S.allTxs.filter(function(t){ return t.type==="expense"; }), cm={};
    exp.forEach(function(t){ cm[t.category]=(cm[t.category]||0)+Number(t.amount); });
    var total=Object.values(cm).reduce(function(s,v){ return s+v; },0);
    var sorted=Object.entries(cm).sort(function(a,b){ return b[1]-a[1]; });
    var el=$("globalCatBreak"); if(!el) return;
    if(!sorted.length){ el.innerHTML='<p style="padding:16px;color:var(--t3);font-size:13px">No expense data.</p>'; return; }
    el.innerHTML=sorted.map(function(c){
      var cat=getCat(c[0]),pct=total>0?((c[1]/total)*100).toFixed(1):0;
      return '<div class="cat-row"><div class="cat-name">'+cat.icon+' '+esc(c[0])+'</div>'+
        '<div class="cat-bar-wrap"><div class="cat-bar" style="width:'+pct+'%;background:'+cat.color+'"></div></div>'+
        '<div class="cat-amt">'+fmt(c[1])+'</div><div class="cat-pct">'+Math.round(pct)+'%</div></div>';
    }).join("");
  }

  function renderUserCompChart(spendMap, earnMap) {
    var users=Object.keys(Object.assign({},spendMap,earnMap)).slice(0,8);
    var uLabels=users.map(function(uid){ var u=S.allUsers.find(function(x){ return x.uid===uid; }); return u?cleanName(u).split(" ")[0]:uid.slice(0,6); });
    if(S.charts.userComp) S.charts.userComp.destroy();
    var c=$("userCompChart"); if(!c) return;
    S.charts.userComp=new Chart(c.getContext("2d"),{type:"bar",
      data:{labels:uLabels,datasets:[
        {label:"Income",data:users.map(function(u){ return earnMap[u]||0; }),backgroundColor:"rgba(245,158,11,.75)",borderRadius:6,borderSkipped:false},
        {label:"Expense",data:users.map(function(u){ return spendMap[u]||0; }),backgroundColor:"rgba(239,68,68,.55)",borderRadius:6,borderSkipped:false}
      ]},
      options:{responsive:true,plugins:{legend:{labels:{color:tc(),font:{size:11},padding:12,boxWidth:10}},tooltip:Object.assign(tt(),{callbacks:{label:function(c){ return " "+c.dataset.label+": "+fmt(c.parsed.y); }}})},
        scales:{x:{grid:{color:gc()},ticks:{color:tc(),font:{size:11}}},y:{grid:{color:gc()},ticks:{color:tc(),callback:function(v){ return "₹"+(v>=1000?(v/1000).toFixed(0)+"k":v); }}}}}});
  }

  function renderVolTrendChart() {
    var mons=getMonthKeys();
    var volData=mons.map(function(m){ return S.allTxs.filter(function(t){ return t.date&&t.date.startsWith(m.key); }).length; });
    if(S.charts.volTrend) S.charts.volTrend.destroy();
    var c=$("volTrendChart"); if(!c) return;
    var ctx=c.getContext("2d"),g=ctx.createLinearGradient(0,0,0,200);
    g.addColorStop(0,"rgba(245,158,11,.3)");g.addColorStop(1,"rgba(245,158,11,.02)");
    S.charts.volTrend=new Chart(ctx,{type:"line",
      data:{labels:mons.map(function(m){ return m.label; }),datasets:[{
        label:"Transactions",data:volData,borderColor:"#f59e0b",backgroundColor:g,
        borderWidth:2.5,pointRadius:5,pointBackgroundColor:"#f59e0b",
        pointBorderColor:isDark()?"#07080d":"#fff",pointBorderWidth:2,fill:true,tension:.42
      }]},
      options:{responsive:true,plugins:{legend:{display:false},tooltip:Object.assign(tt(),{callbacks:{label:function(c){ return " "+c.parsed.y+" transactions"; }}})},
        scales:{x:{grid:{color:gc()},ticks:{color:tc()}},y:{grid:{color:gc()},ticks:{color:tc(),stepSize:1}}}}});
  }

  /* ── MODAL (add/edit tx) ──────────────────────────────────── */
  var _eid = null;

  function buildCatPicker() {
    var p=$("catPicker"); if(!p) return;
    p.innerHTML=CATS.map(function(c){ return '<div class="cat-chip" data-cat="'+c.label+'">'+c.icon+' '+c.label+'</div>'; }).join("");
    p.addEventListener("click",function(e){ var ch=e.target.closest(".cat-chip"); if(!ch) return; $$(".cat-chip").forEach(function(x){ x.classList.remove("on"); }); ch.classList.add("on"); });
  }

  function populateModalUsers() {
    var sel=$("mUser"); if(!sel) return;
    sel.innerHTML=S.allUsers.map(function(u){
      return '<option value="'+u.uid+'">'+esc(cleanName(u))+' ('+esc(u.email||u.uid)+')</option>';
    }).join("");
  }

  function bindModal() {
    if($("modalClose"))  $("modalClose").addEventListener("click",  closeModal);
    if($("modalCancel")) $("modalCancel").addEventListener("click", closeModal);
    if($("txModal"))     $("txModal").addEventListener("click", function(e){ if(e.target===$("txModal")) closeModal(); });
    if($("modalSave"))   $("modalSave").addEventListener("click",   saveTx);
    $$(".tsw").forEach(function(b){ b.addEventListener("click",function(){ $$(".tsw").forEach(function(x){ x.classList.remove("active"); }); b.classList.add("active"); }); });
  }

  function openModal(tx) {
    _eid=tx?tx.id:null;
    $("modalTitle").textContent=tx?"Edit Transaction":"Add Transaction";
    $("mDesc").value=tx?tx.desc:"";
    $("mAmt").value=tx?tx.amount:"";
    $("mDate").value=tx?tx.date:new Date().toISOString().slice(0,10);
    $$(".tsw").forEach(function(b){ b.classList.toggle("active",b.dataset.t===(tx?tx.type:"expense")); });
    $$(".cat-chip").forEach(function(c){ c.classList.toggle("on",c.dataset.cat===(tx?tx.category:"")); });
    if(!tx){ var f=document.querySelector(".cat-chip"); if(f) f.classList.add("on"); }
    /* Set user */
    var muSel=$("mUser"); if(muSel&&tx) muSel.value=tx.uid;
    show("txModal");
  }
  function closeModal() { hide("txModal"); _eid=null; }

  function saveTx() {
    var desc=($("mDesc").value||"").trim(), amt=parseFloat($("mAmt").value), date=$("mDate").value;
    var type=(document.querySelector(".tsw.active")||{dataset:{t:"expense"}}).dataset.t;
    var cat=(document.querySelector(".cat-chip.on")||{dataset:{cat:"Other"}}).dataset.cat;
    var uid=$("mUser")?$("mUser").value:(S.user?S.user.uid:"admin");
    if(!desc||isNaN(amt)||amt<=0||!date){ toast("Fill in all fields.","err"); return; }
    var data={desc:desc,amount:amt,date:date,type:type,category:cat,uid:uid};
    $("saveTxt").textContent="Saving...";
    if(S.offline||!FF){
      if(_eid){ var i=S.allTxs.findIndex(function(t){ return t.id===_eid; }); if(i!==-1) S.allTxs[i]=Object.assign({},S.allTxs[i],data); }
      else{ data.id="al"+Date.now(); S.allTxs.unshift(data); }
      /* Persist back to user's localStorage */
      var userTxs=S.allTxs.filter(function(t){ return t.uid===uid; });
      localStorage.setItem("ps_tx_"+uid,JSON.stringify(userTxs));
      closeModal(); onTxsLoaded(); toast(_eid?"✅ Updated!":"✅ Added!","ok"); $("saveTxt").textContent="Save Transaction"; return;
    }
    var p=_eid?FF.updateDoc(FF.doc(FF.db,"transactions",_eid),data):FF.addDoc(FF.collection(FF.db,"transactions"),Object.assign({},data,{createdAt:FF.serverTimestamp()}));
    p.then(function(){ closeModal(); toast("✅ Saved!","ok"); }).catch(function(e){ toast("Error: "+e.message,"err"); }).finally(function(){ $("saveTxt").textContent="Save Transaction"; });
  }

  /* ── ADMIN ACTIONS ────────────────────────────────────────── */
  function viewUserTx(uid, name) {
    navigateTo("transactions");
    var sel=$("txUserFilter"); if(sel){ sel.value=uid; S.filters.uid=uid; }
    renderTxFeed(); toast("Showing Tx for: "+name,"inf");
  }

  function filterByUser(uid) {
    navigateTo("transactions");
    var sel=$("txUserFilter"); if(sel){ sel.value=uid; S.filters.uid=uid; }
    renderTxFeed();
  }

  function deleteTx(id) {
    if(!confirm("Delete this transaction?")) return;
    if(S.offline||!FF){
      var tx=S.allTxs.find(function(t){ return t.id===id; });
      S.allTxs=S.allTxs.filter(function(t){ return t.id!==id; });
      if(tx) { var userTxs=S.allTxs.filter(function(t){ return t.uid===tx.uid; }); localStorage.setItem("ps_tx_"+tx.uid,JSON.stringify(userTxs)); }
      onTxsLoaded(); toast("Deleted.","inf"); return;
    }
    FF.deleteDoc(FF.doc(FF.db,"transactions",id)).then(function(){ toast("Deleted.","inf"); }).catch(function(e){ toast("Error: "+e.message,"err"); });
  }

  function editTx(id) {
    var t=S.allTxs.find(function(x){ return x.id===id; }); if(t) openModal(t);
  }

  function clearUserTx(uid, name) {
    if(!confirm("Clear ALL transactions for \""+name+"\"?")) return;
    if(S.offline||!FF){
      S.allTxs=S.allTxs.filter(function(t){ return t.uid!==uid; });
      localStorage.setItem("ps_tx_"+uid,"[]");
      onTxsLoaded(); loadAllOfflineUsers(); toast("Cleared Tx for "+name,"ok"); return;
    }
    var q=FF.query(FF.collection(FF.db,"transactions"),FF.where("uid","==",uid));
    FF.getDocs(q).then(function(snap){ return Promise.all(snap.docs.map(function(d){ return FF.deleteDoc(d.ref); })); })
      .then(function(){ toast("Cleared Tx for "+name,"ok"); }).catch(function(e){ toast("Error: "+e.message,"err"); });
  }

  function deleteUser(uid, name) {
    if(!confirm("Delete user \""+name+"\" and ALL their data?")) return;
    S.allUsers=S.allUsers.filter(function(u){ return u.uid!==uid; });
    S.allTxs=S.allTxs.filter(function(t){ return t.uid!==uid; });
    if(!S.offline&&FF){
      var q=FF.query(FF.collection(FF.db,"transactions"),FF.where("uid","==",uid));
      FF.getDocs(q).then(function(snap){ return Promise.all(snap.docs.map(function(d){ return FF.deleteDoc(d.ref); })); })
        .then(function(){ return FF.deleteDoc(FF.doc(FF.db,"users",uid)); })
        .then(function(){ toast("User "+name+" deleted.","ok"); loadAllUsers(); })
        .catch(function(e){ toast("Error: "+e.message,"err"); });
    } else {
      var accts=[];
      try{ accts=JSON.parse(localStorage.getItem("ps_accounts")||"[]"); }catch(e){}
      accts=accts.filter(function(a){ return a.uid!==uid; });
      localStorage.setItem("ps_accounts",JSON.stringify(accts));
      localStorage.removeItem("ps_tx_"+uid);
      onTxsLoaded(); renderUsers(""); toast("User "+name+" deleted.","ok");
    }
  }

  /* ── EXPORT ───────────────────────────────────────────────── */
  function bindExport() {
    if($("exportBtn")) $("exportBtn").addEventListener("click", function(){
      var txs=getFilteredTxs();
      var rows=[["Date","User","Description","Category","Type","Amount"]].concat(txs.map(function(t){
        var u=S.allUsers.find(function(x){ return x.uid===t.uid; });
        return [t.date,'"'+(u?cleanName(u):t.uid)+'"','"'+t.desc+'"',t.category,t.type,t.amount];
      })).map(function(r){ return r.join(","); }).join("\n");
      var a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([rows],{type:"text/csv"})); a.download="pocketsense-admin-export.csv"; a.click();
      toast("📥 Exported "+txs.length+" rows","inf");
    });
  }

  /* ── CLOCK ────────────────────────────────────────────────── */
  function startClock() {
    function tick(){ var el=$("adminClock"); if(el) el.textContent=new Date().toLocaleString("en-IN",{weekday:"short",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"}); }
    tick(); setInterval(tick,1000);
  }

  /* ── PARTICLES ────────────────────────────────────────────── */
  function startParticles() {
    var c=$("bgParticles"); if(!c) return;
    var ctx=c.getContext("2d"),pts=[],W,H;
    function resize(){ W=c.width=window.innerWidth;H=c.height=window.innerHeight; }
    window.addEventListener("resize",resize); resize();
    for(var i=0;i<50;i++) pts.push({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.28,vy:(Math.random()-.5)*.28,r:Math.random()*1.4+.4,a:Math.random()*.3+.07,col:["#f59e0b","#ef4444","#8b5cf6","#3b82f6","#10b981"][Math.floor(Math.random()*5)]});
    (function draw(){ ctx.clearRect(0,0,W,H);
      pts.forEach(function(p){ p.x=(p.x+p.vx+W)%W;p.y=(p.y+p.vy+H)%H;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=p.col;ctx.globalAlpha=p.a;ctx.fill(); });
      for(var i=0;i<pts.length;i++) for(var j=i+1;j<pts.length;j++){ var dx=pts[i].x-pts[j].x,dy=pts[i].y-pts[j].y,d=Math.sqrt(dx*dx+dy*dy); if(d<100){ctx.beginPath();ctx.moveTo(pts[i].x,pts[i].y);ctx.lineTo(pts[j].x,pts[j].y);ctx.strokeStyle=pts[i].col;ctx.globalAlpha=(1-d/100)*.06;ctx.lineWidth=.6;ctx.stroke();} }
      ctx.globalAlpha=1;requestAnimationFrame(draw);
    })();
  }

  function startMatrix() {
    var c=$("matrixCanvas"); if(!c) return;
    var ctx=c.getContext("2d"),chars="01アイABC";
    function resize(){ c.width=window.innerWidth;c.height=window.innerHeight; }
    window.addEventListener("resize",resize); resize();
    var cols=Math.floor(c.width/18),drops=[];
    for(var i=0;i<cols;i++) drops[i]=Math.random()*50;
    setInterval(function(){ ctx.fillStyle="rgba(7,8,13,.06)";ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle="rgba(245,158,11,.5)";ctx.font="12px 'JetBrains Mono',monospace"; for(var i=0;i<drops.length;i++){ ctx.fillText(chars[Math.floor(Math.random()*chars.length)],i*18,drops[i]*18); if(drops[i]*18>c.height&&Math.random()>.975) drops[i]=0; drops[i]+=.45; } },70);
  }

  /* ── TOAST ────────────────────────────────────────────────── */
  function toast(msg,type){
    var wrap=$("toastStack"); if(!wrap) return;
    var el=document.createElement("div"); el.className="toast-item "+(type||"inf"); el.textContent=msg;
    wrap.appendChild(el);
    setTimeout(function(){ el.classList.add("bye"); setTimeout(function(){ el.remove(); },280); },3200);
  }

  function showErr(id,msg){ var e=$(id); if(!e) return; e.textContent=msg; e.classList.remove("hidden"); setTimeout(function(){ e.classList.add("hidden"); },6000); }

  function niceErr(code){ var m={"auth/user-not-found":"No admin account found.","auth/wrong-password":"Incorrect password.","auth/invalid-email":"Invalid email.","auth/too-many-requests":"Too many attempts.","auth/invalid-credential":"Invalid email or password.","auth/network-request-failed":"Network error."}; return m[code]||"Login failed."; }

  /* ── EXPOSE ───────────────────────────────────────────────── */
  window.ADMIN = { viewUserTx:viewUserTx, filterByUser:filterByUser, clearUserTx:clearUserTx, deleteUser:deleteUser, deleteTx:deleteTx, editTx:editTx };

  /* ── LINK from index.html ─────────────────────────────────── */
  /* Update index.html's admin gate to redirect to admin.html */

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot); else boot();

})();