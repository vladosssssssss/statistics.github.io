// ============================================================
//  CONSTANTS & STORAGE
// ============================================================
const API = "https://script.google.com/macros/s/AKfycbwWuwWjCZajyArKcfhAYnulEZiRGL3nSoF_Oj4QYSHgO1alXdWmioDOFEGDTNylLoti/exec";
const DB_KEY   = 'nx8_db';
const PROJ_KEY = 'nx8_proj';   // { managerId: [proj,...] }
const SESS_KEY = 'nx8_sess';
const ACC_KEY  = 'nx8_acc';
const COLORS   = ['#3b82f6','#10b981','#f59e0b','#ef4444','#a855f7','#06b6d4','#f97316','#84cc16','#ec4899','#14b8a6'];

// ============================================================
//  ACCOUNTS
// ============================================================
function getAcc() {
  const def = { admin:{ password:'1111', name:'Админ' }, managers:[{ id:'vlad', name:'Влад', password:'2222' }] };
  const s = localStorage.getItem(ACC_KEY);
  if (!s) { localStorage.setItem(ACC_KEY, JSON.stringify(def)); return def; }
  return JSON.parse(s);
}
function saveAcc(a) { localStorage.setItem(ACC_KEY, JSON.stringify(a)); }

// ============================================================
//  SESSION
// ============================================================
const getSess = ()=>JSON.parse(localStorage.getItem(SESS_KEY));
const setSess = s=>localStorage.setItem(SESS_KEY, JSON.stringify(s));
const clearSess = ()=>localStorage.removeItem(SESS_KEY);

// ============================================================
//  PROJECTS (per manager)
// ============================================================
function getAllProjects() { return JSON.parse(localStorage.getItem(PROJ_KEY)) || {}; }
function saveAllProjects(p) { localStorage.setItem(PROJ_KEY, JSON.stringify(p)); }
function getMgrProjects(mgrId) {
  const all = getAllProjects();
  if (!all[mgrId]) all[mgrId] = ['Другое'];
  const fromStorage = Array.isArray(all[mgrId]) ? all[mgrId] : ['Другое'];
  // Also include projects that are already present in transactions for this manager.
  const fromDb = db
    .filter(i => getRecMgr(i) === mgrId)
    .map(i => String(i["Проект"] || '').trim())
    .filter(p => p && !p.startsWith("Выплата") && !p.startsWith("Ожидание"));
  const merged = Array.from(new Set([...fromStorage, ...fromDb]));
  if (!merged.includes('Другое')) merged.push('Другое');
  return merged;
}
function setMgrProjects(mgrId, arr) {
  const all = getAllProjects();
  all[mgrId] = arr;
  saveAllProjects(all);
}
function addMgrProject(mgrId, name) {
  const arr = getMgrProjects(mgrId);
  if (!arr.includes(name)) { arr.push(name); setMgrProjects(mgrId, arr); }
}
function delMgrProject(mgrId, name) {
  let arr = getMgrProjects(mgrId).filter(p=>p!==name);
  if (!arr.includes('Другое')) arr.push('Другое');
  setMgrProjects(mgrId, arr);
}
// Union of all managers' projects (for admin filter)
function getAllManagersProjects() {
  const acc = getAcc();
  const set = new Set();
  acc.managers.forEach(m => getMgrProjects(m.id).forEach(p=>set.add(p)));
  return Array.from(set);
}

// ============================================================
//  LOGIN
// ============================================================
let selRole = 'admin';
function populateGuestSel(){
  const acc=getAcc();
  const sel=document.getElementById('guestMgrSel');
  if(sel) sel.innerHTML=acc.managers.map(m=>`<option value="${escAttr(m.id)}">${esc(m.name)}</option>`).join('');
}
function selRoleUI(role){
  selRole=role;
  document.querySelectorAll('.role-btn').forEach(b=>b.classList.remove('active'));
  const btn=document.getElementById('rb-'+role);
  if(btn)btn.classList.add('active');
  document.getElementById('passWrap').style.display = role==='guest'?'none':'block';
  document.getElementById('mgrSelWrap').style.display = role==='manager'?'block':'none';
  if(role==='manager') populateMgrSel();
  document.getElementById('loginErr').innerText='';
}
function populateMgrSel(){
  const acc=getAcc();
  document.getElementById('loginMgrSel').innerHTML=acc.managers.map(m=>`<option value="${escAttr(m.id)}">${esc(m.name)}</option>`).join('');
}
function guestLogin(){
  const sel=document.getElementById('guestMgrSel');
  const acc=getAcc();
  if(sel&&sel.value){
    const mgr=acc.managers.find(m=>m.id===sel.value);
    const name=mgr?mgr.name:'Гость';
    setSess({role:'guest',name:'👁 '+name,id:'guest',viewMgrId:sel.value});
  } else {
    setSess({role:'guest',name:'Гость',id:'guest',viewMgrId:null});
  }
  enterApp();
}
function doLogin(){
  const pass=document.getElementById('loginPass').value;
  const acc=getAcc();
  document.getElementById('loginErr').innerText='';
  if(selRole==='guest'){guestLogin();return;}
  if(selRole==='admin'){
    if(pass===acc.admin.password){setSess({role:'admin',name:acc.admin.name||'Админ',id:'admin'});enterApp();}
    else document.getElementById('loginErr').innerText='Неверный пароль';
    return;
  }
  const mgrId=document.getElementById('loginMgrSel').value;
  const mgr=acc.managers.find(m=>m.id===mgrId);
  if(mgr&&pass===mgr.password){setSess({role:'manager',name:mgr.name,id:mgr.id});enterApp();}
  else document.getElementById('loginErr').innerText='Неверный пароль';
}
function logout(){
  clearSess();
  document.getElementById('mainApp').style.display='none';
  document.getElementById('loginScreen').style.display='flex';
  document.getElementById('loginPass').value='';
  selRoleUI('admin');
}
function enterApp(){
  document.getElementById('loginScreen').style.display='none';
  document.getElementById('mainApp').style.display='flex';
  applyRoleUI();
  loadCfg();
  render();
  sync();
}
function applyRoleUI(){
  const s=getSess();if(!s)return;
  const badge=document.getElementById('sBadge');
  document.getElementById('sName').innerText=s.name;
  if(s.role==='admin'){badge.className='role-badge b-admin';badge.innerText='АДМИН';}
  else if(s.role==='manager'){badge.className='role-badge b-manager';badge.innerText='МЕНЕДЖЕР';}
  else{badge.className='role-badge b-guest';badge.innerText='ГОСТЬ';}
  document.getElementById('adminBar').className = s.role==='admin' ? 'on' : '';
  if(s.role==='admin') rebuildAdminFilters();
  if(s.role==='guest'){
    document.getElementById('addForm').style.display='none';
    document.getElementById('payoutsSection').style.display='none';
    document.getElementById('btnProfile').style.display='none';
  } else {
    document.getElementById('addForm').style.display='grid';
    document.getElementById('payoutsSection').style.display='block';
    document.getElementById('btnProfile').style.display='';
  }
}

// ============================================================
//  PROFILE MODAL
// ============================================================
function openProfile(){
  const s=getSess();
  document.getElementById('pfName').value=s.name;
  ['cpOld','cpNew','cpNew2'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('cpErr').innerText='';
  openModal('profileModal');
}
function saveName(){
  const s=getSess();
  const name=document.getElementById('pfName').value.trim();
  if(!name){alert('Введите имя');return;}
  const acc=getAcc();
  if(s.role==='admin'){acc.admin.name=name;}
  else if(s.role==='manager'){const m=acc.managers.find(m=>m.id===s.id);if(m)m.name=name;}
  saveAcc(acc);
  setSess({...s,name});
  document.getElementById('sName').innerText=name;
  // sync to sheets
  if(s.role==='manager') fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'SAVE_MANAGER',id:s.id,name,password:acc.managers.find(m=>m.id===s.id)?.password||''})});
  alert('Имя сохранено!');
}
function doChangePass(){
  const s=getSess();
  const oldP=document.getElementById('cpOld').value;
  const newP=document.getElementById('cpNew').value;
  const newP2=document.getElementById('cpNew2').value;
  const err=document.getElementById('cpErr');
  if(!oldP||!newP||!newP2){err.innerText='Заполните все поля';return;}
  if(newP!==newP2){err.innerText='Пароли не совпадают';return;}
  if(newP.length<4){err.innerText='Минимум 4 символа';return;}
  const acc=getAcc();
  if(s.role==='admin'){
    if(oldP!==acc.admin.password){err.innerText='Старый пароль неверный';return;}
    acc.admin.password=newP;
  } else {
    const m=acc.managers.find(m=>m.id===s.id);
    if(!m||oldP!==m.password){err.innerText='Старый пароль неверный';return;}
    m.password=newP;
    fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'SAVE_MANAGER',id:s.id,name:m.name,password:newP})});
  }
  saveAcc(acc);
  closeModal('profileModal');
  alert('Пароль изменён!');
}

// ============================================================
//  MANAGER MANAGEMENT
// ============================================================
function renderMgrList(){
  const acc=getAcc();
  const el=document.getElementById('mgrList');
  if(!acc.managers.length){el.innerHTML='<div style="opacity:.4;font-size:12px">Нет менеджеров</div>';return;}
  el.innerHTML=acc.managers.map(m=>`
    <div class="mgr-item">
      <span class="mn">👤 ${esc(m.name)}</span>
      <button class="mgr-eye" title="Пароль" data-pass="${escAttr(m.password)}" onclick="togglePass('pp_${escAttr(m.id)}',this)">👁</button>
      <span class="mgr-pass" id="pp_${escAttr(m.id)}"></span>
      <button class="mgr-del" onclick="delManager(decodeURIComponent('${encodeURIComponent(m.id)}'))">−</button>
    </div>`).join('');
}
function togglePass(spanId,btn){
  const pass=btn.dataset.pass||'';
  const el=document.getElementById(spanId);
  if(el.style.display==='inline'){el.style.display='none';btn.style.color='rgba(255,255,255,.35)';}
  else{el.innerText=pass;el.style.display='inline';btn.style.color='#fff';}
}
function addManager(){
  const name=document.getElementById('newMgrName').value.trim();
  const pass=document.getElementById('newMgrPass').value.trim();
  const err=document.getElementById('mgrErr');
  if(!name){err.innerText='Введите имя';return;}
  if(pass.length<4){err.innerText='Пароль минимум 4 символа';return;}
  const acc=getAcc();
  if(acc.managers.find(m=>m.name.toLowerCase()===name.toLowerCase())){err.innerText='Уже есть';return;}
  const id='mgr_'+name.toLowerCase().replace(/\s+/g,'_')+'_'+Date.now();
  acc.managers.push({id,name,password:pass});
  saveAcc(acc);
  setMgrProjects(id,['Другое']); // new manager starts with empty projects
  document.getElementById('newMgrName').value='';
  document.getElementById('newMgrPass').value='';
  err.innerText='';
  renderMgrList();
  rebuildAdminFilters();
  render();
  fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'SAVE_MANAGER',id,name,password:pass})});
}
function delManager(id){
  if(!confirm('Удалить менеджера?')) return;
  const acc=getAcc();
  acc.managers=acc.managers.filter(m=>m.id!==id);
  saveAcc(acc);
  renderMgrList();
  rebuildAdminFilters();
  render();
  fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'DELETE_MANAGER',id})});
}

// ============================================================
//  MODAL HELPERS
// ============================================================
const openModal=id=>document.getElementById(id).classList.add('open');
const closeModal=id=>document.getElementById(id).classList.remove('open');

// ============================================================
//  ADMIN FILTERS STATE
// ============================================================
let selMgrs=[];   // [] = all
let selProjs=[];  // [] = all
let adAllTime=false;
const getSingleSelectedAdminMgrId = () => (selMgrs.length===1 ? selMgrs[0] : null);

function rebuildAdminFilters(){
  const acc=getAcc();
  // Manager chips
  const mc=document.getElementById('mgrChips');
  mc.innerHTML=`<button class="chip ${selMgrs.length===0?'on':''}" onclick="toggleMgr(null)">Все</button>`+
    acc.managers.map(m=>`<button class="chip ${selMgrs.includes(m.id)?'on':''}" onclick="toggleMgr(decodeURIComponent('${encodeURIComponent(m.id)}'))">${esc(m.name)}</button>`).join('');
  // Project chips — union of selected (or all) managers' projects
  rebuildProjChips();
}
function rebuildProjChips(){
  const acc=getAcc();
  const effectiveMgrs=selMgrs.length?selMgrs:acc.managers.map(m=>m.id);
  const projSet=new Set();
  effectiveMgrs.forEach(mid=>getMgrProjects(mid).forEach(p=>projSet.add(p)));
  const projs=Array.from(projSet);
  const pc=document.getElementById('projChips');
  pc.innerHTML=`<button class="chip ${selProjs.length===0?'on-g':''}" style="${selProjs.length===0?'border-color:var(--success);color:#fff;background:rgba(16,185,129,.15)':''}" onclick="toggleProj(null)">Все</button>`+
    projs.map(p=>`<button class="chip ${selProjs.includes(p)?'on-g':''}" style="${selProjs.includes(p)?'border-color:var(--success);color:#fff;background:rgba(16,185,129,.15)':''}" onclick="toggleProj(decodeURIComponent('${encodeURIComponent(p)}'))">${esc(p)}</button>`).join('');
}
function toggleMgr(id){
  if(id===null){selMgrs=[];}
  else{
    if(selMgrs.includes(id))selMgrs=selMgrs.filter(x=>x!==id);
    else selMgrs.push(id);
  }
  selProjs=[]; // reset project filter when managers change
  rebuildAdminFilters();render();
}
function toggleProj(p){
  if(p===null){selProjs=[];}
  else{
    if(selProjs.includes(p))selProjs=selProjs.filter(x=>x!==p);
    else selProjs.push(p);
  }
  rebuildProjChips();render();
}
function toggleAdAll(){
  adAllTime=!adAllTime;
  document.getElementById('btnAdAll').classList.toggle('on-p',adAllTime);
  render();
}
async function smartLogin() {
  // Ищем поля ввода (убедись, что ID совпадают с твоим HTML)
  const userEl = document.getElementById('logUser'); 
  const passEl = document.getElementById('logPass');
  const err = document.getElementById('logErr');

  if(!userEl || !passEl) return;

  const user = userEl.value.trim();
  const pass = passEl.value.trim();

  // 1. Сначала проверяем по локальной памяти (чтобы зайти мгновенно)
  let acc = getAcc();
  let m = acc.managers.find(x => x.name.toLowerCase() === user.toLowerCase() && String(x.password) === String(pass));

  // 2. Если не подошло — НЕ ПИШЕМ "ОШИБКА", а сначала стучимся в таблицу
  if (!m) {
    if(err) err.innerText = 'Проверка обновлений...';
    await sync(); // Обновляем localStorage данными из Excel
    acc = getAcc(); // Берем уже обновленную память
    m = acc.managers.find(x => x.name.toLowerCase() === user.toLowerCase() && String(x.password) === String(pass));
  }

  // 3. Финальная проверка
  if (m) {
    setSess({ id: m.id, role: 'manager', name: m.name });
    enterApp(); // Входим в приложение
    if(err) err.innerText = '';
  } else {
    if(err) err.innerText = 'Неверный логин или пароль';
  }
}


// ============================================================
//  DATA
// ============================================================
let db=JSON.parse(localStorage.getItem(DB_KEY))||[];
let deletedIds=new Set();
let myChart=null;
let anlChart=null;
let viewAllTime=false;

function flashLoader(){
  const l=document.getElementById('global-loader');
  l.style.display='flex';setTimeout(()=>l.style.display='none',1100);
}
function getCfgKey(id){ return 'nx8_cfg_'+id; }
function loadCfg(){
  const s=getSess();
  const id=s?s.id:'_default';
  const stored=localStorage.getItem(getCfgKey(id));
  const cfg=stored?JSON.parse(stored):{goalMoney:60000,goalDaily:2};
  document.getElementById('goalMoney').value=cfg.goalMoney||60000;
  document.getElementById('goalDaily').value=cfg.goalDaily||2;
}
function saveCfg(){
  const s=getSess();
  const id=s?s.id:'_default';
  const cfg={goalMoney:parseInt(document.getElementById('goalMoney').value)||60000,goalDaily:parseInt(document.getElementById('goalDaily').value)||2};
  localStorage.setItem(getCfgKey(id),JSON.stringify(cfg));
  // sync to sheets for managers
  if(s&&s.role==='manager'){
    const acc=getAcc();
    const m=acc.managers.find(m=>m.id===s.id);
    if(m) fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'SAVE_MANAGER',id:s.id,name:m.name,password:m.password,goalMoney:cfg.goalMoney,goalDaily:cfg.goalDaily})});
  }
  render();
}
function setPeriodMonth(){viewAllTime=false;document.getElementById('btnAllTime').classList.remove('on');render();}
function toggleAllTime(){viewAllTime=!viewAllTime;document.getElementById('btnAllTime').classList.toggle('on',viewAllTime);render();}

function getRecMgr(item){return item["Manager"]||'vlad';}
function ym(d){try{const dt=new Date(d);if(isNaN(dt))return"";return`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;}catch{return"";}}

async function addNewProject(){
  const s=getSess();if(!s||s.role==='guest')return;
  const name=prompt("Название нового проекта:");
  if(!name||!name.trim())return;
  const mgrId=s.role==='admin'?getSingleSelectedAdminMgrId():s.id;
  if(s.role==='admin' && !mgrId){ alert('Для добавления проекта выбери одного менеджера'); return; }
  if(getMgrProjects(mgrId).includes(name)){alert('Уже есть');return;}
  flashLoader();
  addMgrProject(mgrId,name);
  render();
  fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'ADD_PROJECT',name,manager:mgrId})});
}
function deleteProject(mgrId,name){
  if(!confirm(`Удалить проект "${name}"?`))return;
  flashLoader();
  delMgrProject(mgrId,name);
  render();
  fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'DELETE_PROJECT',name,manager:mgrId})});
}

async function sync(){
  const bar=document.getElementById('sync-bar');
  bar.style.width='30%';
  try{
    const res=await fetch(API+"?t="+Date.now());
    const data=await res.json();
    if(data.db){db=data.db.filter(i=>!deletedIds.has(String(i.ID).replace(/'/g,"").trim()));localStorage.setItem(DB_KEY,JSON.stringify(db));}
    if(data.projects){
      // per-manager projects from sheets
      if(Array.isArray(data.projects)){
        // legacy flat list → assign to vlad if no manager
        const all=getAllProjects();
        const filtered=data.projects.filter(p=>String(p).toLowerCase()!=='projects');
        if(filtered.length){
          all['vlad'] = Array.from(new Set([...(all['vlad']||[]), ...filtered]));
          if(!all['vlad'].includes('Другое')) all['vlad'].push('Другое');
          saveAllProjects(all);
        }
      } else if(typeof data.projects==='object'){
        // keyed by manager
        const all=getAllProjects();
        Object.entries(data.projects).forEach(([mid,arr])=>{
          const incoming = Array.isArray(arr) ? arr : [];
          const merged = Array.from(new Set([...(all[mid]||[]), ...incoming]));
          if(!merged.includes('Другое')) merged.push('Другое');
          all[mid]=merged;
        });
        saveAllProjects(all);
      }
    }
if(data.managers&&data.managers.length){
      const acc=getAcc();
      data.managers.forEach(gm=>{
        const local=acc.managers.find(m=>m.id===gm.id);
        if(!local) {
          // Если менеджера вообще нет в памяти телефона — добавляем
          acc.managers.push({id:gm.id,name:gm.name,password:gm.password});
        } else {
          // ВОТ ТУТ КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ:
          // Принудительно обновляем пароль и имя из таблицы
          local.password = String(gm.password); 
          local.name = gm.name;
        }
        // Обновляем цели (план на месяц и день)
        if(gm.goalMoney||gm.goalDaily){
          const cfg={goalMoney:gm.goalMoney||60000,goalDaily:gm.goalDaily||2};
          localStorage.setItem(getCfgKey(gm.id),JSON.stringify(cfg));
        }
      });
      saveAcc(acc);
      populateGuestSel();
    }
  }catch(e){console.error(e);}
  bar.style.width='100%';
  render();
  setTimeout(()=>bar.style.width='0%',300);
}

function inAdPeriod(date){
  if(adAllTime)return true;
  const m=ym(date);
  const from=document.getElementById('adFrom').value;
  const to=document.getElementById('adTo').value;
  if(from&&m<from)return false;
  if(to&&m>to)return false;
  return true;
}

// ============================================================
//  RENDER
// ============================================================
function render(){
  const s=getSess();if(!s)return;
  const acc=getAcc();

  // Current manager's projects
  const curMgrId=s.role==='manager'?s.id:(selMgrs.length===1?selMgrs[0]:null);
  const myProjs=curMgrId?getMgrProjects(curMgrId):getAllManagersProjects();

  // Update project select in form
  const fsel=document.getElementById('fProject');
  const curProjVal=fsel.value;
  fsel.innerHTML=myProjs.map(p=>`<option>${esc(p)}</option>`).join('');
  if(myProjs.includes(curProjVal))fsel.value=curProjVal;

  // Determine filters
  let mgrFilter=null;
  if(s.role==='manager')mgrFilter=[s.id];
  else if(s.role==='guest'&&s.viewMgrId)mgrFilter=[s.viewMgrId];
  else if(s.role==='admin'&&selMgrs.length>0)mgrFilter=selMgrs;

  let projFilter=null;
  if(s.role==='admin'&&selProjs.length>0)projFilter=selProjs;

  // Payout grid
  if(s.role!=='guest'){
    const payMgrId=s.role==='manager'?s.id:getSingleSelectedAdminMgrId();
    if(s.role==='admin' && !payMgrId){
      document.getElementById('payoutGrid').innerHTML = `<div class="pc" style="grid-column:1/-1;opacity:.7">Выберите одного менеджера, чтобы управлять выплатами и проектами</div>`;
    }else{
      const payProjs=getMgrProjects(payMgrId);
      document.getElementById('payoutGrid').innerHTML=
        `<div class="pc">
          <div class="inc-lbl" style="color:var(--success)">+ Приход</div>
          <input type="number" id="payPlus" placeholder="0">
          <button class="btn-p" style="width:100%;font-size:10px;background:var(--success);margin-top:5px" onclick="addTxn('Ожидание (приход)','payPlus',true,'${payMgrId}')">В ПЛЮС</button>
        </div>`+
        payProjs.map((p,idx)=>`
          <div class="pc">
            <button class="btn-dp" onclick="deleteProject('${payMgrId}','${p.replace(/'/g,"\\'")}')">−</button>
            <div class="inc-lbl" style="color:var(--accent);padding-right:18px">${p}</div>
            <input type="number" id="pay_${idx}" placeholder="0">
            <button class="btn-p" style="width:100%;font-size:10px;margin-top:5px" onclick="addTxn('Выплата: ${p.replace(/'/g,"\\'")}','pay_${idx}',false,'${payMgrId}')">ВЫПЛАТИТЬ</button>
          </div>`).join('');
    }
  }

  const monthFilter=document.getElementById('filterMonth').value;
  const gM=parseInt(document.getElementById('goalMoney').value)||60000;
  const gD=parseInt(document.getElementById('goalDaily').value)||2;

  let earned=0,dirtySales=0,totalBalance=0,mgrBalance=0,filteredCount=0;
  let dayStats={},projSums={},monthSums={};

  // payMgrId for payout section balance
  const payMgrIdForBal = s.role==='manager' ? s.id : (selMgrs.length===1 ? selMgrs[0] : null);

  db.forEach(i=>{
    const val=parseFloat(i["Заработок"])||0;
    const sale=parseFloat(i["Сумма"])||0;
    const proj=String(i["Проект"]||"Другое");
    const isPay=proj.startsWith("Выплата")||proj.startsWith("Ожидание");
    const iym=ym(i["Дата"]);if(!iym)return;
    const recMgr=getRecMgr(i);

    totalBalance+=val;
    if(payMgrIdForBal){ if(recMgr===payMgrIdForBal) mgrBalance+=val; } else mgrBalance+=val;
    if(isPay)return;

    // month history (filtered)
    {
      const mgrOk=!mgrFilter||mgrFilter.includes(recMgr);
      const prOk=!projFilter||projFilter.includes(proj);
      if(mgrOk&&prOk){
        const inHistoryPeriod = s.role==='admin' ? inAdPeriod(i["Дата"]) : iym.startsWith(monthFilter.split('-')[0]);
        if(inHistoryPeriod) monthSums[iym]=(monthSums[iym]||0)+val;
      }
    }

    const mgrOk=!mgrFilter||mgrFilter.includes(recMgr);
    const prOk=!projFilter||projFilter.includes(proj);
    if(!mgrOk||!prOk)return;

    let inPer;
    if(s.role==='admin')inPer=inAdPeriod(i["Дата"]);
    else inPer=viewAllTime||iym===monthFilter;

    if(inPer){
      earned+=val;dirtySales+=sale;filteredCount++;
      const day=new Date(i["Дата"]).getDate();
      dayStats[day]=(dayStats[day]||0)+1;
      projSums[proj]=(projSums[proj]||0)+val;
    }
  });

  // rebuild monthSums for all-time mode
  const isAllTime=viewAllTime||(s.role==='admin'&&adAllTime);
  if(isAllTime){
    monthSums={};
    db.forEach(i=>{
      const val=parseFloat(i["Заработок"])||0;
      const proj=String(i["Проект"]||"");
      if(proj.startsWith("Выплата")||proj.startsWith("Ожидание"))return;
      const iym2=ym(i["Дата"]);if(!iym2)return;
      const recMgr=getRecMgr(i);
      const mgrOk=!mgrFilter||mgrFilter.includes(recMgr);
      const prOk=!projFilter||projFilter.includes(proj);
      if(mgrOk&&prOk)monthSums[iym2]=(monthSums[iym2]||0)+val;
    });
  }

  document.getElementById('hb-val').innerText=fmt(totalBalance)+' ₴';
  document.getElementById('salaryRemainder').innerText=fmt(mgrBalance)+' ₴';
  document.getElementById('totalSales').innerText=fmt(dirtySales)+' ₴';
  document.getElementById('valEarned').innerText=fmt(earned)+' ₴';

  const pct=gM>0?Math.min(Math.round(earned/gM*100),100):0;
  document.getElementById('progressBar').style.width=pct+'%';
  document.getElementById('percentText').innerText=pct+'%';
  document.getElementById('remainText').innerText=`осталось ${fmt(Math.max(0,gM-earned))} ₴`;

  // Project stats
  const pList=document.getElementById('projectStats');pList.innerHTML='';
  Object.entries(projSums).sort((a,b)=>b[1]-a[1]).forEach(([n,v])=>{
    pList.innerHTML+=`<div class="stat-item"><span>${esc(n)}</span><span>${fmt(v)} ₴</span></div>`;
  });

  // Calendar
  const [yr,mo]=monthFilter.split('-');
  const dim=new Date(yr,mo,0).getDate();
  const cal=document.getElementById('calendar');cal.innerHTML='';
  if(!isAllTime){
    for(let i=1;i<=dim;i++){
      const c=dayStats[i]||0;
      const cls=c>=gD?'tm':(c>0?'hp':'');
      cal.innerHTML+=`<div class="day ${cls}"><span>${i}</span>${c>0?`<span style="font-size:8px;font-weight:900;opacity:.8">${c}</span>`:''}</div>`;
    }
  } else {
    cal.innerHTML='<div style="opacity:.35;font-size:12px;text-align:center;padding:20px;grid-column:1/-1">Календарь — выберите месяц</div>';
  }

  const now=new Date();
  const curMo=ym(now);
  const isCurMo=monthFilter===curMo;
  const daysGone=isCurMo?now.getDate():dim;

  document.getElementById('avgCheck').innerText=(filteredCount>0?fmt(dirtySales/filteredCount):0)+' ₴';
  document.getElementById('avgCount').innerText=isAllTime?'—':(filteredCount/daysGone).toFixed(1);
  document.getElementById('forecast').innerText=(!isAllTime&&isCurMo)?fmt(earned/daysGone*dim)+' ₴':'—';

  // Year history
  const yList=document.getElementById('yearStats');yList.innerHTML='';
  Object.keys(monthSums).sort().reverse().forEach(m=>{
    const n=new Date(m+'-01').toLocaleString('ru',{month:'long',year:'numeric'});
    yList.innerHTML+=`<div class="stat-item"><span>${esc(n)}</span><span>${fmt(monthSums[m])} ₴</span></div>`;
  });

  // Main table
  const tbody=document.getElementById('tableBody');tbody.innerHTML='';
  db.filter(i=>{
    const proj=String(i["Проект"]);
    const recMgr=getRecMgr(i);
    const mgrOk=!mgrFilter||mgrFilter.includes(recMgr);
    const prOk=!projFilter||projFilter.includes(proj);
    const isPay=proj.startsWith("Выплата")||proj.startsWith("Ожидание");
    let perOk;
    if(s.role==='admin')perOk=inAdPeriod(i["Дата"]);
    else perOk=isAllTime||ym(i["Дата"])===monthFilter;
    return perOk&&mgrOk&&prOk&&!isPay;
  }).sort((a,b)=>new Date(b["Дата"])-new Date(a["Дата"])).forEach(i=>{
    const d=new Date(i["Дата"]);
    const ds=pad(d.getDate())+'.'+pad(d.getMonth()+1);
    const recMgr=getRecMgr(i);
    const mgrName=recMgr==='vlad'?'Влад':(acc.managers.find(m=>m.id===recMgr)?.name||recMgr);
    const canEdit=s.role==='admin'||(s.role==='manager'&&recMgr===s.id);
    tbody.innerHTML+=`<tr>
      <td style="font-weight:900">${ds}</td>
      <td style="font-size:11px;opacity:.65">${esc(mgrName)}</td>
      <td>${esc(i["Проект"])}</td>
      <td>${fmt(i["Сумма"])} ₴</td>
      <td style="color:var(--success);font-weight:900">${fmt(i["Заработок"])} ₴</td>
      <td style="opacity:.45;font-size:11px">${esc(i["Комментарий"]||'')}</td>
      <td style="text-align:right">${canEdit?`<button class="bt" onclick="editE(decodeURIComponent('${encodeURIComponent(i.ID)}'))">✏️</button><button class="bt" style="color:var(--danger)" onclick="delE(decodeURIComponent('${encodeURIComponent(i.ID)}'))">🗑️</button>`:''}</td>
    </tr>`;
  });

  // Payouts table
  const tbp=document.getElementById('tableBodyPayouts');tbp.innerHTML='';
  db.filter(i=>{
    const proj=String(i["Проект"]);
    const recMgr=getRecMgr(i);
    const isPay=proj.startsWith("Выплата")||proj.startsWith("Ожидание");
    if(!isPay)return false;
    const mgrOk=!mgrFilter||mgrFilter.includes(recMgr);
    let perOk;
    if(s.role==='admin')perOk=inAdPeriod(i["Дата"]);
    else perOk=isAllTime||ym(i["Дата"])===monthFilter;
    // manager sees only their own payouts
    if(s.role==='manager'&&recMgr!==s.id)return false;
    return perOk&&mgrOk;
  }).sort((a,b)=>new Date(b["Дата"])-new Date(a["Дата"])).forEach(i=>{
    const val=parseFloat(i["Заработок"])||0;
    const col=val>0?'var(--success)':'var(--danger)';
    const d=new Date(i["Дата"]);
    const ds=pad(d.getDate())+'.'+pad(d.getMonth()+1);
    const recMgr=getRecMgr(i);
    const mgrName=recMgr==='vlad'?'Влад':(acc.managers.find(m=>m.id===recMgr)?.name||recMgr);
    // manager can delete own payouts; admin can delete all
    const canDel=s.role==='admin'||(s.role==='manager'&&recMgr===s.id);
    tbp.innerHTML+=`<tr>
      <td>${ds}</td>
      <td style="font-weight:800;color:${col}">${esc(i["Проект"])}</td>
      <td style="font-size:11px;opacity:.65">${esc(mgrName)}</td>
      <td style="font-weight:900;color:${col}">${val>0?'+':''}${fmt(val)} ₴</td>
      <td style="opacity:.45;font-size:11px">${esc(i["Комментарий"]||'')}</td>
      <td style="text-align:right">${canDel?`<button class="bt" style="color:var(--danger)" onclick="delE(decodeURIComponent('${encodeURIComponent(i.ID)}'))">🗑️</button>`:''}</td>
    </tr>`;
  });

  updateMainChart(dim, dayStats, isAllTime, {
    role:s.role,
    monthFilter,
    mgrFilter,
    projFilter
  });

  // Analytics
  if(s.role==='admin'){
    renderAnalytics(mgrFilter,projFilter,acc);
  } else {
    document.getElementById('analyticsSection').classList.remove('on');
  }
}

// ============================================================
//  CHARTS
// ============================================================

// Main activity chart — monthly mode: days; all-time mode: projects by month
function updateMainChart(dim, dayStats, isAllTime, opts){
  const ctx = document.getElementById('paymentChart').getContext('2d');
  const { role, monthFilter, mgrFilter, projFilter } = opts;

  if (!isAllTime) {
    // ── Daily line chart for single month ──
    const labels = Array.from({length:dim}, (_,i) => i+1);
    const now = new Date();
    const curMo = ym(now);
    const maxDay = monthFilter===curMo ? now.getDate() : dim;
    const data   = labels.map(d => (d<=maxDay ? (dayStats[d]||0) : null));
    if (myChart) { myChart.destroy(); myChart=null; }
    myChart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets:[{ label:'Оплат', data, borderColor:'#3b82f6', backgroundColor:'rgba(59,130,246,0.15)', borderWidth:2, fill:true, tension:.4, pointRadius:2 }] },
      options: { responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false} },
        scales:{ x:{ grid:{display:false}, ticks:{color:'rgba(226,232,240,.4)',font:{size:8}} }, y:{ beginAtZero:true, ticks:{stepSize:1, color:'rgba(226,232,240,.4)',font:{size:8}} } }
      }
    });
  } else {
    // ── Multi-line chart: one line per project, x = months ──
    if (myChart) { myChart.destroy(); myChart=null; }
    const projectSet = new Set();
    const allMonthsSet = new Set();
    const monthData = {};

    // Collect all months available for current manager/project filters in all-time mode.
    db.forEach(i=>{
      const proj = String(i["Проект"]||"");
      if(proj.startsWith("Выплата") || proj.startsWith("Ожидание")) return;
      const recMgr = getRecMgr(i);
      const m = ym(i["Дата"]);
      if(!m) return;
      if(mgrFilter && !mgrFilter.includes(recMgr)) return;
      if(projFilter && !projFilter.includes(proj)) return;
      if(role==='admin' && !inAdPeriod(i["Дата"])) return;
      allMonthsSet.add(m);
    });

    // Even with no records for some projects, include selected projects in legend/chart.
    if(projFilter && projFilter.length){
      projFilter.forEach(p=>projectSet.add(p));
    } else if(mgrFilter && mgrFilter.length){
      mgrFilter.forEach(mid=>getMgrProjects(mid).forEach(p=>projectSet.add(p)));
    } else {
      getAllManagersProjects().forEach(p=>projectSet.add(p));
    }

    db.forEach(i=>{
      const proj = String(i["Проект"]||"");
      if(proj.startsWith("Выплата") || proj.startsWith("Ожидание")) return;
      const recMgr = getRecMgr(i);
      const m = ym(i["Дата"]);
      if(!m) return;
      if(mgrFilter && !mgrFilter.includes(recMgr)) return;
      if(projFilter && !projFilter.includes(proj)) return;
      const inPeriod = role==='admin' ? inAdPeriod(i["Дата"]) : true;
      if(!inPeriod) return;
      projectSet.add(proj);
      const key = `${m}__${proj}`;
      monthData[key] = (monthData[key]||0) + (parseFloat(i["Заработок"])||0);
    });

    const projs = Array.from(projectSet);
    let months = Array.from(allMonthsSet).sort();
    if (!months.length || !projs.length) return;
    if (months.length===1){
      // Chart.js draws only a single point for one month; add previous month as zero baseline.
      const only = months[0];
      const dt = new Date(only + '-01');
      dt.setMonth(dt.getMonth()-1);
      const prev = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
      months = [prev, only];
    }

    const lbls = months.map(m=>new Date(m+'-01').toLocaleString('ru',{month:'short',year:'2-digit'}));
    const datasets = [];
    let ci = 0;
    projs.forEach(proj=>{
      const data = months.map(mo=>Math.round(monthData[`${mo}__${proj}`]||0));
      const col = COLORS[ci%COLORS.length]; ci++;
      datasets.push({ label:proj, data, borderColor:col, backgroundColor:col+'22', borderWidth:2, fill:false, tension:.3, pointRadius:3 });
    });

    if(!datasets.length) return;
    myChart = new Chart(ctx, {
      type:'line', data:{ labels:lbls, datasets },
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:true, position:'top', labels:{color:'rgba(226,232,240,.75)',font:{size:9},boxWidth:10,padding:8} } },
        scales:{
          x:{ grid:{display:false}, ticks:{color:'rgba(226,232,240,.4)',font:{size:8}} },
          y:{ beginAtZero:true, grid:{color:'rgba(255,255,255,.04)'}, ticks:{color:'rgba(226,232,240,.4)',font:{size:8},callback:v=>fmt(v)} }
        }
      }
    });
  }
}

function renderAnalytics(mgrFilter, projFilter, acc){
  const el = document.getElementById('analyticsSection');

  const effectiveMgrs = mgrFilter&&mgrFilter.length ? mgrFilter : acc.managers.map(m=>m.id);

  // Collect months in current admin period + active filters
  const moSet = new Set();
  db.forEach(i=>{
    const m=ym(i["Дата"]);
    const proj=String(i["Проект"]);
    const mid=getRecMgr(i);
    if(!m || proj.startsWith("Выплата") || proj.startsWith("Ожидание")) return;
    if(!effectiveMgrs.includes(mid)) return;
    if(projFilter&&projFilter.length&&!projFilter.includes(proj)) return;
    if(!inAdPeriod(i["Дата"])) return;
    moSet.add(m);
  });
  const months = Array.from(moSet).sort();

  if(!months.length){ el.classList.remove('on'); return; }
  el.classList.add('on');
  const mgrLabel = mgrFilter&&mgrFilter.length
    ? mgrFilter.map(mid=>acc.managers.find(m=>m.id===mid)?.name||mid).join(', ')
    : 'все';
  const projLabel = projFilter&&projFilter.length ? projFilter.join(', ') : 'все';
  document.getElementById('analyticsMeta').innerText=`Менеджеры: ${mgrLabel} | Проекты: ${projLabel} | Период: ${months[0]} - ${months[months.length-1]}`;

  // KPI for current analytics filters/period
  let kpiCount=0,kpiSales=0,kpiEarn=0;
  const usedProjects = new Set();
  const usedManagers = new Set();
  db.forEach(i=>{
    const proj=String(i["Проект"]||"");
    if(proj.startsWith("Выплата")||proj.startsWith("Ожидание")) return;
    const mid=getRecMgr(i);
    if(!effectiveMgrs.includes(mid)) return;
    if(projFilter&&projFilter.length&&!projFilter.includes(proj)) return;
    if(!inAdPeriod(i["Дата"])) return;
    kpiCount++;
    kpiSales += parseFloat(i["Сумма"])||0;
    kpiEarn += parseFloat(i["Заработок"])||0;
    usedProjects.add(proj);
    usedManagers.add(mid);
  });
  document.getElementById('anlKpiCount').innerText = fmt(kpiCount);
  document.getElementById('anlKpiSales').innerText = `${fmt(kpiSales)} ₴`;
  document.getElementById('anlKpiEarn').innerText = `${fmt(kpiEarn)} ₴`;
  document.getElementById('anlKpiAvg').innerText = `${kpiCount?fmt(kpiSales/kpiCount):0} ₴`;
  document.getElementById('anlKpiProj').innerText = fmt(usedProjects.size);
  document.getElementById('anlKpiMgr').innerText = fmt(usedManagers.size);

  // HEATMAP: project × manager (earnings or count)
  const metricSel = document.getElementById('anlMetric')?.value || 'earn';
  const projLimitRaw = document.getElementById('anlProjLimit')?.value || '8';
  const projLimit = projLimitRaw === 'all' ? Infinity : (parseInt(projLimitRaw,10) || 8);
  const projectsSelected = projFilter && projFilter.length > 0;

  const candidateProjs = projectsSelected
    ? projFilter
    : Array.from(new Set(effectiveMgrs.flatMap(mid=>getMgrProjects(mid))));

  // Aggregate values for current admin period + filters.
  const cellAgg = {}; // { [proj]: { [mid]: {earn,cnt} } }
  const projAgg = {}; // { [proj]: {earn,cnt} }
  candidateProjs.forEach(p=>{ cellAgg[p] = {}; projAgg[p] = {earn:0,cnt:0}; });

  db.forEach(i=>{
    const proj = String(i["Проект"]||"").trim();
    if(!proj) return;
    if(proj.startsWith("Выплата") || proj.startsWith("Ожидание")) return;
    const mid = getRecMgr(i);
    if(!effectiveMgrs.includes(mid)) return;
    if(projFilter&&projFilter.length && !projFilter.includes(proj)) return;
    if(!inAdPeriod(i["Дата"])) return;

    const earn = parseFloat(i["Заработок"])||0;
    const cnt = 1; // count of payment rows

    if(!cellAgg[proj]) cellAgg[proj] = {};
    if(!cellAgg[proj][mid]) cellAgg[proj][mid] = {earn:0,cnt:0};

    cellAgg[proj][mid].earn += earn;
    cellAgg[proj][mid].cnt += cnt;

    if(!projAgg[proj]) projAgg[proj] = {earn:0,cnt:0};
    projAgg[proj].earn += earn;
    projAgg[proj].cnt += cnt;
  });

  const metricValue = (x)=> metricSel==='earn' ? (x.earn||0) : (x.cnt||0);

  const projTotalsArr = candidateProjs
    .map(p=>({proj:p, earn:projAgg[p]?.earn||0, cnt:projAgg[p]?.cnt||0}))
    .sort((a,b)=>metricValue(b)-metricValue(a));

  let projForHeat = projTotalsArr;
  if(!projectsSelected && projLimit !== Infinity){
    const active = projTotalsArr.filter(x=>metricValue(x)>0);
    projForHeat = (active.length ? active : projTotalsArr).slice(0, projLimit);
  } else if(!projectsSelected && projLimit===Infinity){
    const active = projTotalsArr.filter(x=>metricValue(x)>0);
    projForHeat = active.length ? active : projTotalsArr;
  }

  const hmGrid = document.getElementById('hmGrid');
  const hmHint = document.getElementById('hmHint');
  if(hmGrid && hmHint){
    hmGrid.innerHTML='';
    const cols = effectiveMgrs.length;
    hmGrid.style.gridTemplateColumns = `220px repeat(${cols}, minmax(105px,1fr))`;

    const maxCellVal = Math.max(1, ...projForHeat.flatMap(p=>{
      return effectiveMgrs.map(mid=>{
        const cell = (cellAgg[p.proj]&&cellAgg[p.proj][mid]) ? cellAgg[p.proj][mid] : {earn:0,cnt:0};
        return metricValue(cell);
      });
    }));

    let html = `<div class="hm-head hm-proj-head">Проект</div>`;
    effectiveMgrs.forEach((mid,idx)=>{
      const mName = mid==='vlad' ? 'Влад' : (acc.managers.find(m=>m.id===mid)?.name || mid);
      html += `<div class="hm-head" style="border-color:${COLORS[idx%COLORS.length]}">${esc(mName)}</div>`;
    });

    projForHeat.forEach((p)=>{
      html += `<div class="hm-proj">${esc(p.proj)}</div>`;
      effectiveMgrs.forEach((mid,idx)=>{
        const cell = cellAgg[p.proj] && cellAgg[p.proj][mid] ? cellAgg[p.proj][mid] : {earn:0,cnt:0};
        const val = metricSel==='earn' ? cell.earn : cell.cnt;
        const tot = metricSel==='earn' ? p.earn : p.cnt;
        const share = tot>0 ? Math.round(val/tot*100) : 0;
        const norm = val / maxCellVal;
        const alpha = 0.05 + 0.35*norm;
        const col = COLORS[idx%COLORS.length];
        const bg = hexToRgba(col, alpha);
        const valText = metricSel==='earn' ? `${fmt(val)} ₴` : `${val}`;
        const subText = `${share}%`;

        html += `<div class="hm-cell" style="background:${bg};border-color:${col}">
          <div class="hm-cell-val">${valText}</div>
          <div class="hm-cell-sub">${subText}</div>
        </div>`;
      });
    });

    hmGrid.innerHTML = html;
    const metricLabel = metricSel==='earn' ? 'Заработок (₴)' : 'Кол-во оплат';
    hmHint.innerText = `Метрика: ${metricLabel} | Период: ${months[0]} - ${months[months.length-1]} | Проектов: ${projForHeat.length}${projectsSelected ? ' (выбрано)' : ' (топ)'}; Цвет интенсивности относительно максимальной ячейки.`;
  }

  // Draw old line chart only if canvas still exists (it may be removed in UI).
  const canDrawAnlChart = !!document.getElementById('anlChart');
  if(canDrawAnlChart){
  const datasets = [];
  let ci = 0;

  let labels = [];
  const totalCountsByMonth = Object.fromEntries(months.map(m=>[m,0]));

  if(months.length===1){
    // Для "апрель-апрель" показываем дневной график до текущего дня
    const month = months[0];
    const dt = new Date(month+'-01');
    const dim = new Date(dt.getFullYear(), dt.getMonth()+1, 0).getDate();
    const now = new Date();
    const maxDay = ym(now)===month ? now.getDate() : dim;
    labels = Array.from({length:maxDay},(_,i)=>i+1);
    const multiMgr = effectiveMgrs.length > 1;
    effectiveMgrs.forEach(mid=>{
      const mName = mid==='vlad'?'Влад':(acc.managers.find(m=>m.id===mid)?.name||mid);
      const effectiveProjs = projFilter&&projFilter.length ? projFilter : getMgrProjects(mid);
      effectiveProjs.forEach(proj=>{
        const data = labels.map(day=>{
          let sum=0;
          db.forEach(i=>{
            const d = new Date(i["Дата"]);
            if(ym(i["Дата"])===month && d.getDate()===day && String(i["Проект"])===proj && getRecMgr(i)===mid && inAdPeriod(i["Дата"])){
              sum+=parseFloat(i["Заработок"])||0;
            }
          });
          return Math.round(sum);
        });
        const col = COLORS[ci%COLORS.length]; ci++;
        const lbl = multiMgr ? `${mName} — ${proj}` : proj;
        datasets.push({ label:lbl, data, borderColor:col, backgroundColor:col+'18', borderWidth:2, fill:false, tension:.3, pointRadius:2 });
      });
    });
  } else {
    // ── MULTI-LINE CHART: manager×project per month ──
    labels = months.map(m=>new Date(m+'-01').toLocaleString('ru',{month:'short',year:'2-digit'}));
    const multiMgr = effectiveMgrs.length > 1;
    effectiveMgrs.forEach(mid=>{
      const mName = mid==='vlad'?'Влад':(acc.managers.find(m=>m.id===mid)?.name||mid);
      const effectiveProjs = projFilter&&projFilter.length ? projFilter : getMgrProjects(mid);
      effectiveProjs.forEach(proj=>{
        const data = months.map(mo=>{
          let sum=0;
          let cnt=0;
          db.forEach(i=>{
            if(ym(i["Дата"])===mo && String(i["Проект"])===proj && getRecMgr(i)===mid && inAdPeriod(i["Дата"])){
              sum+=parseFloat(i["Заработок"])||0;
              cnt++;
            }
          });
          totalCountsByMonth[mo]=(totalCountsByMonth[mo]||0)+cnt;
          return Math.round(sum);
        });
        const col = COLORS[ci%COLORS.length]; ci++;
        const lbl = multiMgr ? `${mName} — ${proj}` : proj;
        datasets.push({ label:lbl, data, borderColor:col, backgroundColor:col+'18', borderWidth:2, fill:false, tension:.3, pointRadius:3 });
      });
    });
  }

  const chartCtx = document.getElementById('anlChart').getContext('2d');
  if(anlChart){ anlChart.destroy(); anlChart=null; }

  if(!datasets.length && months.length>1){
    // fallback: если сумма заработка в выбранном периоде = 0,
    // все равно показываем график по количеству оплат, чтобы график не "пропадал"
    const countsSeries = months.map(m=>totalCountsByMonth[m]||0);
    if(countsSeries.some(v=>v>0)){
      datasets.push({
        label:'Оплаты (шт)',
        data:countsSeries,
        borderColor:'#60a5fa',
        backgroundColor:'rgba(96,165,250,0.18)',
        borderWidth:2,
        fill:false,
        tension:.3,
        pointRadius:3
      });
    }
  }

  if(datasets.length){
    const isSinglePoint = months.length===1;
    anlChart = new Chart(chartCtx, {
      type:'line', data:{ labels, datasets },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:true, position:'top', labels:{color:'rgba(226,232,240,.8)',font:{size:11},boxWidth:12,padding:12} } },
        scales:{
          x:{ grid:{color:'rgba(255,255,255,.03)'}, ticks:{color:'rgba(226,232,240,.5)',font:{size:10}} },
          y:{ beginAtZero:true, grid:{color:'rgba(255,255,255,.03)'}, ticks:{color:'rgba(226,232,240,.5)',font:{size:10},callback:v=>fmt(v)+' ₴'} }
        }
      }
    });
    if(isSinglePoint){
      // Для периода "апрель-апрель" (1 точка) точку делаем заметнее
      anlChart.data.datasets.forEach(ds=>{ ds.pointRadius = 5; ds.pointHoverRadius = 6; });
      anlChart.update();
    }
  }
  }

  // ── COMPARISON CARDS (per project — only when 2+ managers) ──
  const cg = document.getElementById('compareCards'); cg.innerHTML='';
  const effectiveProjs2 = projectsSelected
    ? projFilter
    : (() => {
        const all = Array.from(new Set(effectiveMgrs.flatMap(mid=>getMgrProjects(mid))));
        const metricValue2 = (p)=> metricSel==='earn' ? (projAgg[p]?.earn||0) : (projAgg[p]?.cnt||0);
        const sorted = all.slice().sort((a,b)=>metricValue2(b)-metricValue2(a));
        const active = sorted.filter(p=>metricValue2(p)>0);
        const base = active.length ? active : sorted;
        return projLimit===Infinity ? base : base.slice(0, projLimit);
      })();

  if(effectiveMgrs.length >= 2){
    effectiveProjs2.forEach(proj=>{
      const totals={};
      effectiveMgrs.forEach(mid=>{
        let sum=0,cnt=0;
        db.forEach(i=>{
          if(String(i["Проект"])===proj && getRecMgr(i)===mid && inAdPeriod(i["Дата"]) && !proj.startsWith("Выплата") && !proj.startsWith("Ожидание")){
            sum+=parseFloat(i["Заработок"])||0; cnt++;
          }
        });
        totals[mid]={sum:Math.round(sum),cnt};
      });
      const vals=Object.values(totals).map(t=>metricSel==='earn'?t.sum:t.cnt);
      if(vals.every(v=>v===0)) return;
      const maxVal=Math.max(...vals,1);
      const totalAll=vals.reduce((a,b)=>a+b,0)||1;

      let html=`<div class="cmp-card"><div class="cmp-title">${esc(proj)}</div>`;
      effectiveMgrs.forEach((mid,idx)=>{
        const mName=mid==='vlad'?'Влад':(acc.managers.find(m=>m.id===mid)?.name||mid);
        const earnVal=totals[mid].sum, cntVal=totals[mid].cnt;
        const primaryVal=metricSel==='earn'?earnVal:cntVal;
        const barW=Math.round(primaryVal/maxVal*100);
        const pct=Math.round(primaryVal/totalAll*100);
        const col=COLORS[idx%COLORS.length];
        const primaryText = metricSel==='earn' ? `${fmt(earnVal)} ₴` : `${cntVal} шт`;
        const secondaryText = metricSel==='earn' ? `${cntVal}` : `${fmt(earnVal)} ₴`;
        html+=`<div class="cmp-row">
          <span style="min-width:68px;font-weight:700;font-size:12px">${esc(mName)}</span>
          <div class="cmp-bar-bg"><div class="cmp-bar-fill" style="width:${barW}%;background:${col}"></div></div>
          <span class="cmp-pct" style="color:${col}">${pct}%</span>
          <span style="font-size:11px;opacity:.5;min-width:60px;text-align:right">${primaryText}</span>
          <span style="font-size:10px;opacity:.45;min-width:34px;text-align:right">${secondaryText}</span>
        </div>`;
      });
      html+=`</div>`;
      cg.innerHTML+=html;
    });
  }

  // ── RANKING (always show when 2+ managers, simple clean version) ──
  const sw = document.getElementById('scoreWrap'); sw.innerHTML='';
  if(effectiveMgrs.length < 2){ return; }

  const scores={};
  effectiveMgrs.forEach(mid=>{ scores[mid]={earn:0,count:0}; });
  db.forEach(i=>{
    const proj=String(i["Проект"]);
    if(proj.startsWith("Выплата")||proj.startsWith("Ожидание")) return;
    const mid=getRecMgr(i);
    if(!scores[mid]) return;
    if(!inAdPeriod(i["Дата"])) return;
    if(projFilter&&projFilter.length&&!projFilter.includes(proj)) return;
    scores[mid].earn+=parseFloat(i["Заработок"])||0;
    scores[mid].count++;
  });

  const totalEarn=Object.values(scores).reduce((a,b)=>a+b.earn,0)||1;
  const totalCount=Object.values(scores).reduce((a,b)=>a+b.count,0)||1;
  const maxEarn=Math.max(...Object.values(scores).map(s=>s.earn),1);
  const maxCnt=Math.max(...Object.values(scores).map(s=>s.count),1);

  const ranked = effectiveMgrs.map(mid=>{
    const mName=mid==='vlad'?'Влад':(acc.managers.find(m=>m.id===mid)?.name||mid);
    const es=scores[mid].earn/totalEarn;
    const cs=scores[mid].count/totalCount;
    const score=Math.round((es*0.6+cs*0.4)*100);
    return{mid,mName,score,earn:Math.round(scores[mid].earn),count:scores[mid].count,earnPct:Math.round(es*100),cntPct:Math.round(cs*100)};
  }).sort((a,b)=>b.score-a.score);

  const best=ranked[0];
  const medals=['🥇','🥈','🥉'];

  let html=`<div class="score-card">
    <div class="cmp-title" style="color:#fbbf24;margin-bottom:10px">Рейтинг менеджеров</div>`;

  ranked.forEach((r,idx)=>{
    const medal=medals[idx]||`<span style="font-size:13px;opacity:.4">#${idx+1}</span>`;
    const isTop=idx===0;
    const diffEarn=r.earn-best.earn;
    const diffCnt=r.count-best.count;
    const barW=Math.round(r.earn/maxEarn*100);
    const col=COLORS[idx%COLORS.length];

    html+=`<div style="padding:12px;background:${isTop?'rgba(251,191,36,0.06)':'rgba(0,0,0,0.15)'};border-radius:12px;border:1px solid ${isTop?'rgba(251,191,36,0.2)':'rgba(255,255,255,0.05)'};margin-bottom:8px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:22px">${medal}</span>
          <div>
            <div style="font-weight:800;font-size:14px">${esc(r.mName)}</div>
            <div style="font-size:11px;opacity:.5;margin-top:1px">${r.count} | ${fmt(r.earn)} ₴</div>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:22px;font-weight:900;color:${isTop?'#fbbf24':col}">${r.score}<span style="font-size:13px">%</span></div>
          <div style="font-size:10px;opacity:.4">скор</div>
        </div>
      </div>
      <div style="height:4px;border-radius:2px;background:rgba(255,255,255,.06);overflow:hidden;margin-bottom:8px">
        <div style="height:100%;width:${barW}%;background:${col};border-radius:2px;transition:.6s"></div>
      </div>
      ${!isTop?`<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:11px">
        <span>Доход: <b style="color:${diffEarn>=0?'var(--success)':'var(--danger)'}">${diffEarn>=0?'+':''}${fmt(diffEarn)} ₴</b></span>
        <span>Оплаты: <b style="color:${diffCnt>=0?'var(--success)':'var(--danger)'}">${diffCnt>=0?'+':''}${diffCnt}</b></span>
        <span style="opacity:.5">Доли: ${r.earnPct}% | ${r.cntPct}%</span>
      </div>`:`<div style="font-size:11px;opacity:.5">Доли: ${r.earnPct}% | ${r.cntPct}%</div>`}
    </div>`;
  });

  html+=`</div>`;
  sw.innerHTML=html;
}

// ============================================================
//  TRANSACTIONS
// ============================================================
async function addTxn(proj,inputId,isPlus,mgrId){
  const val=document.getElementById(inputId).value;
  if(!val||val<=0)return;
  flashLoader();
  const amount=isPlus?Math.abs(val):-Math.abs(val);
  const entry={id:"PAY_"+Date.now(),date:new Date().toISOString().split('T')[0],amount:0,project:proj,earnings:amount,comment:isPlus?"Пополнение":"Выплата",manager:mgrId,action:'ADD'};
  db.push({"ID":entry.id,"Дата":entry.date,"Сумма":0,"Проект":proj,"Заработок":amount,"Комментарий":entry.comment,"Manager":mgrId});
  localStorage.setItem(DB_KEY,JSON.stringify(db));render();
  fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(entry)}).then(()=>setTimeout(sync,1500));
  document.getElementById(inputId).value='';
}

async function delE(id){
  if(!confirm("Удалить запись?"))return;
  flashLoader();
  const sId=String(id).replace(/'/g,"").trim();
  deletedIds.add(sId);
  db=db.filter(i=>String(i.ID).replace(/'/g,"").trim()!==sId);
  localStorage.setItem(DB_KEY,JSON.stringify(db));render();
  fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'DELETE',id:sId})}).then(()=>setTimeout(sync,1000));
}

function editE(id){
  const item=db.find(i=>String(i.ID)===String(id));if(!item)return;
  document.getElementById('fId').value=item.ID;
  document.getElementById('fDate').value=new Date(item["Дата"]).toISOString().split('T')[0];
  document.getElementById('fAmount').value=item["Сумма"];
  document.getElementById('fProject').value=item["Проект"];
  document.getElementById('fComment').value=item["Комментарий"]||'';
  document.getElementById('btnLabel').innerText="ОБНОВИТЬ";
  window.scrollTo({top:0,behavior:'smooth'});
}

document.getElementById('addForm').onsubmit=e=>{
  e.preventDefault();
  const s=getSess();if(!s||s.role==='guest')return;
  const id=document.getElementById('fId').value||"ID_"+Date.now();
  const mgrId=s.role==='manager'?s.id:getSingleSelectedAdminMgrId();
  if(s.role==='admin' && !mgrId){ alert('Выбери одного менеджера для добавления записи'); return; }
  flashLoader();
  const entry={
    id,date:document.getElementById('fDate').value,
    amount:document.getElementById('fAmount').value,
    project:document.getElementById('fProject').value,
    earnings:(document.getElementById('fAmount').value*0.06).toFixed(0),
    comment:document.getElementById('fComment').value,
    manager:mgrId,
    action:document.getElementById('fId').value?'EDIT':'ADD'
  };
  if(entry.action==='EDIT')db=db.filter(i=>String(i.ID)!==String(id));
  db.push({"ID":id,"Дата":entry.date,"Сумма":entry.amount,"Проект":entry.project,"Заработок":entry.earnings,"Комментарий":entry.comment,"Manager":mgrId});
  localStorage.setItem(DB_KEY,JSON.stringify(db));render();
  fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(entry)}).then(()=>setTimeout(sync,1500));
  e.target.reset();document.getElementById('fId').value='';document.getElementById('btnLabel').innerText="ЗАФИКСИРОВАТЬ";
  document.getElementById('fDate').value=new Date().toISOString().split('T')[0];
};

// ============================================================
//  UTILS
// ============================================================
const fmt=v=>Math.round(parseFloat(v)||0).toLocaleString('ru');
const pad=n=>String(n).padStart(2,'0');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const escAttr=esc;
const hexToRgba=(hex,a)=>{
  const h=String(hex||'').replace('#','').trim();
  if(!h) return `rgba(255,255,255,${a})`;
  const hh=h.length===3 ? h.split('').map(c=>c+c).join('') : h;
  const n=parseInt(hh,16);
  if(Number.isNaN(n)) return `rgba(255,255,255,${a})`;
  const r=(n>>16)&255, g=(n>>8)&255, b=n&255;
  return `rgba(${r},${g},${b},${a})`;
};

// ============================================================
//  INIT
// ============================================================
const now0=new Date();
const ymNow=`${now0.getFullYear()}-${pad(now0.getMonth()+1)}`;
document.getElementById('filterMonth').value=ymNow;
document.getElementById('adFrom').value=ymNow;
document.getElementById('adTo').value=ymNow;
document.getElementById('fDate').value=now0.toISOString().split('T')[0];

populateGuestSel();
const es=getSess();
if(es){
  enterApp();
}else{
  selRoleUI('admin');
}

// Запускаем тихую синхронизацию при открытии сайта
// Это обновит пароли и данные в фоне, пока страница открыта
setTimeout(() => {
  sync();
}, 500); 
