// ============================================================
//  CONSTANTS & STORAGE
// ============================================================
const API = "https://script.google.com/macros/s/AKfycbwWuwWjCZajyArKcfhAYnulEZiRGL3nSoF_Oj4QYSHgO1alXdWmioDOFEGDTNylLoti/exec";
const DB_KEY   = 'nx8_db';
const PROJ_KEY = 'nx8_proj';   // { managerId: [proj,...] }
const SESS_KEY = 'nx8_sess';
const ACC_KEY  = 'nx8_acc';
const CACHE_KEY = 'nx8_cache';
const COLORS   = ['#3b82f6','#10b981','#f59e0b','#ef4444','#a855f7','#06b6d4','#f97316','#84cc16','#ec4899','#14b8a6'];
const QUEUE_KEY = 'nx8_queue';

// ============================================================
//  QUEUE SYSTEM FOR GOOGLE SHEETS
// ============================================================
const Queue = {
  queue: [],
  isProcessing: false,
  maxRetries: 5,
  
  init: function() {
    try {
      const saved = localStorage.getItem(QUEUE_KEY);
      if (saved) {
        this.queue = JSON.parse(saved);
        if (this.queue.length > 0) {
          this.process();
        }
      }
    } catch (e) {
      console.error('Queue init error:', e);
      this.queue = [];
    }
  },
  
  add: function(data) {
    const item = {
      id: Date.now() + Math.random(),
      data: data,
      attempts: 0,
      timestamp: Date.now()
    };
    this.queue.push(item);
    this.save();
    this.process();
  },
  
  save: function() {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch (e) {
      console.error('Queue save error:', e);
    }
  },
  
  process: async function() {
    if (this.isProcessing || this.queue.length === 0) return;
    
    this.isProcessing = true;
    this.showBackgroundLoader();
    
    while (this.queue.length > 0) {
      const item = this.queue[0];
      
      try {
        const res = await fetch(API, {
          method: 'POST',
          headers: {'Content-Type': 'text/plain;charset=utf-8'},
          body: JSON.stringify(item.data)
        });
        
        if (res.ok) {
          this.queue.shift();
          this.save();
          item.attempts = 0;
        } else {
          throw new Error(`HTTP ${res.status}`);
        }
      } catch (e) {
        item.attempts++;
        console.error(`Queue item ${item.id} failed (attempt ${item.attempts}):`, e);
        
        if (item.attempts >= this.maxRetries) {
          console.error(`Queue item ${item.id} failed after ${this.maxRetries} attempts, removing`);
          this.queue.shift();
          this.save();
        } else {
          // Move to end of queue and retry later
          this.queue.shift();
          this.queue.push(item);
          this.save();
          await new Promise(resolve => setTimeout(resolve, 2000 * item.attempts));
        }
      }
    }
    
    this.isProcessing = false;
    this.hideBackgroundLoader();
  },
  
  showBackgroundLoader: function() {
    const loader = document.getElementById('background-loader');
    if (loader) loader.style.display = 'flex';
  },
  
  hideBackgroundLoader: function() {
    const loader = document.getElementById('background-loader');
    if (loader) loader.style.display = 'none';
  },
  
  clear: function() {
    this.queue = [];
    this.save();
  },
  
  getStats: function() {
    return {
      length: this.queue.length,
      isProcessing: this.isProcessing
    };
  }
};

// Initialize queue on load
Queue.init();

// ============================================================
//  CACHE SYSTEM
// ============================================================
const Cache = {
  get: function(key) {
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      const item = cache[key];
      if (!item) return null;
      
      // Check if cache is expired (1 hour)
      if (Date.now() - item.timestamp > 3600000) {
        delete cache[key];
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        return null;
      }
      
      return item.data;
    } catch (e) {
      return null;
    }
  },
  
  set: function(key, data) {
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      cache[key] = {
        data: data,
        timestamp: Date.now()
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
      console.error('Cache set error:', e);
    }
  },
  
  clear: function() {
    localStorage.removeItem(CACHE_KEY);
  },
  
  getStats: function() {
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      const size = JSON.stringify(cache).length;
      const keys = Object.keys(cache);
      return {
        size: size,
        keys: keys.length,
        entries: keys.map(key => ({
          key: key,
          size: JSON.stringify(cache[key]).length,
          age: Date.now() - cache[key].timestamp
        }))
      };
    } catch (e) {
      return { size: 0, keys: 0, entries: [] };
    }
  }
};

// Performance monitoring
const Performance = {
  start: function(name) {
    performance.mark(`${name}-start`);
  },
  
  end: function(name) {
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
    const measure = performance.getEntriesByName(name)[0];
    console.log(`${name}: ${measure.duration.toFixed(2)}ms`);
    return measure.duration;
  },
  
  debounce: function(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },
  
  throttle: function(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
};

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
  // sync to sheets via queue
  if(s.role==='manager') Queue.add({action:'SAVE_MANAGER',id:s.id,name,password:acc.managers.find(m=>m.id===s.id)?.password||''});
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
    Queue.add({action:'SAVE_MANAGER',id:s.id,name:m.name,password:newP});
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
  setMgrProjects(id,['Другое']); // new manager starts with empty projects only
  // Clear cache to ensure fresh data for new manager
  Cache.clear();
  document.getElementById('newMgrName').value='';
  document.getElementById('newMgrPass').value='';
  err.innerText='';
  renderMgrList();
  rebuildAdminFilters();
  render();
  Queue.add({action:'SAVE_MANAGER',id,name,password:pass});
}
function delManager(id){
  if(!confirm('Удалить менеджера?')) return;
  const acc=getAcc();
  acc.managers=acc.managers.filter(m=>m.id!==id);
  saveAcc(acc);
  renderMgrList();
  rebuildAdminFilters();
  render();
  Queue.add({action:'DELETE_MANAGER',id});
}

// ============================================================
//  MODAL HELPERS
// ============================================================
const openModal=id=>document.getElementById(id).classList.add('open');
const closeModal=id=>document.getElementById(id).classList.remove('open');

// ============================================================
//  PAYMENT HISTORY
// ============================================================
function showPaymentHistory(recordId) {
  const record = db.find(item => item.ID === recordId);
  if (!record) return;
  
  const recMgr = getRecMgr(record);
  const acc = getAcc();
  const mgrName = recMgr === 'vlad' ? 'Влад' : (acc.managers.find(m => m.id === recMgr)?.name || recMgr);
  
  // Get all payments for this person (including doplata columns)
  const payments = [];
  
  // Main payment
  if (record["Сумма"]) {
    payments.push({
      date: record["Дата"],
      amount: parseFloat(record["Сумма"]) || 0,
      type: "Основная оплата",
      project: record["Проект"] || "",
      comment: record["Комментарий"] || ""
    });
  }
  
  // Additional payments from doplata columns
  for (let i = 1; i <= 10; i++) {
    const doplataKey = `Доплата${i}`;
    const doplataDateKey = `Доплата_Дата${i}`;
    const doplataAmount = record[doplataKey];
    const doplataDate = record[doplataDateKey];
    if (doplataAmount && parseFloat(doplataAmount) > 0) {
      payments.push({
        date: doplataDate || record["Дата"],
        amount: parseFloat(doplataAmount) || 0,
        type: `Доплата ${i}`,
        project: record["Проект"] || "",
        comment: record["Комментарий"] || ""
      });
    }
  }
  
  // Calculate potential and actual amounts
  const potentialAmount = parseFloat(record["Сумма"]) || 0;
  const actualAmount = record["ФактСумма"] !== undefined && record["ФактСумма"] !== null && record["ФактСумма"] !== "" ? parseFloat(record["ФактСумма"]) : 0;
  const potentialEarn = parseFloat(record["Заработок"]) || 0;
  const actualEarn = record["ФактЗаработок"] !== undefined && record["ФактЗаработок"] !== null && record["ФактЗаработок"] !== "" ? parseFloat(record["ФактЗаработок"]) : 0;
  
  // Calculate total additional payments from doplata columns
  const totalAdditionalPayments = payments.reduce((sum, p) => sum + (p.type.includes("Доплата") ? p.amount : 0), 0);
  const totalActualPaid = actualAmount; // actualAmount already includes all doplatas
  
  // Generate HTML for payment history
  const today = new Date().toISOString().split('T')[0];
  let html = `
    <div style="margin-bottom:15px">
      <strong>Клиент:</strong> ${esc(record["Комментарий"] || 'Без имени')}<br>
      <strong>Менеджер:</strong> ${esc(mgrName)}<br>
      <strong>Проект:</strong> ${esc(record["Проект"] || '')}
    </div>
    
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px;padding:15px;background:rgba(255,255,255,0.05);border-radius:8px">
      <div>
        <div style="font-size:11px;opacity:.7;margin-bottom:4px">Потенциальная оплата</div>
        <div style="font-size:18px;font-weight:900;color:#fbbf24">${fmt(potentialAmount)} ₴</div>
      </div>
      <div>
        <div style="font-size:11px;opacity:.7;margin-bottom:4px">Фактически оплачено</div>
        <div style="font-size:18px;font-weight:900;color:#10b981">${fmt(totalActualPaid)} ₴</div>
      </div>
      <div>
        <div style="font-size:11px;opacity:.7;margin-bottom:4px">Потенциальный заработок</div>
        <div style="font-size:18px;font-weight:900;color:var(--success)">${fmt(potentialEarn)} ₴</div>
      </div>
      <div>
        <div style="font-size:11px;opacity:.7;margin-bottom:4px">Фактический заработок</div>
        <div style="font-size:18px;font-weight:900;color:var(--accent)">${fmt(actualEarn)} ₴</div>
      </div>
    </div>
    
    <div style="margin-bottom:15px">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <div style="display:flex;gap:5px;align-items:center">
          <label style="color:#fff;font-size:12px">Дата:</label>
          <input type="date" id="paymentDate_${recordId}" value="${today}" style="padding:4px 8px;border:1px solid var(--border);border-radius:4px;background:rgba(255,255,255,0.05);color:#fff;font-size:12px">
        </div>
        <div style="display:flex;gap:5px;align-items:center">
          <label style="color:#fff;font-size:12px">Сумма:</label>
          <input type="number" id="paymentAmount_${recordId}" placeholder="0" style="width:80px;padding:4px 8px;border:1px solid var(--border);border-radius:4px;background:rgba(255,255,255,0.05);color:#fff;font-size:12px">
        </div>
        <button onclick="submitPaymentInline('${recordId}')" style="background:var(--success);color:white;padding:6px 12px;border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:12px">
          + Добавить доплату
        </button>
      </div>
    </div>
    
    <div style="margin-bottom:10px;font-weight:700">История оплат:</div>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="border-bottom:1px solid var(--border)">
          <th style="text-align:left;padding:8px">Дата</th>
          <th style="text-align:left;padding:8px">Тип</th>
          <th style="text-align:right;padding:8px">Сумма</th>
          <th style="text-align:right;padding:8px">Управление</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  payments.forEach(payment => {
    // Format date without timezone conversion
    const dateStrValue = String(payment.date);
    let dateStr = dateStrValue;
    if (dateStrValue.includes('T')) {
      // ISO format - extract date part
      const datePart = dateStrValue.split('T')[0];
      const [year, month, day] = datePart.split('-');
      dateStr = pad(parseInt(day)) + '.' + pad(parseInt(month)) + '.' + year;
    } else if (dateStrValue.includes('-')) {
      // YYYY-MM-DD format
      const [year, month, day] = dateStrValue.split('-');
      dateStr = pad(parseInt(day)) + '.' + pad(parseInt(month)) + '.' + year;
    }
    // Check if this is an additional payment to show edit/delete buttons
    const isAdditionalPayment = payment.type.includes("Доплата");
    const doplataIndex = isAdditionalPayment ? payment.type.split(' ')[1] : null;
    
    if (isAdditionalPayment) {
      html += `
        <tr id="doplata_${recordId}_${doplataIndex}" style="border-bottom:1px solid rgba(255,255,255,0.1)">
          <td style="padding:8px">
            <span id="doplata_date_${recordId}_${doplataIndex}">${dateStr}</span>
            <input type="date" id="doplata_date_input_${recordId}_${doplataIndex}" value="${payment.date}" style="display:none;width:100px;padding:2px;border:1px solid var(--border);border-radius:3px;background:rgba(255,255,255,0.1);color:#fff;font-size:11px">
          </td>
          <td style="padding:8px">${esc(payment.type)}</td>
          <td style="text-align:right;padding:8px;font-weight:900;color:#fff">
            <span id="doplata_amount_${recordId}_${doplataIndex}">${fmt(payment.amount)} ₴</span>
            <input type="number" id="doplata_amount_input_${recordId}_${doplataIndex}" value="${payment.amount}" style="display:none;width:80px;padding:2px;border:1px solid var(--border);border-radius:3px;background:rgba(255,255,255,0.1);color:#fff;font-size:11px;text-align:right">
          </td>
          <td style="text-align:right;padding:8px">
            <button id="doplata_edit_${recordId}_${doplataIndex}" onclick="startEditDoplata('${recordId}', '${doplataIndex}')" style="margin-right:5px;background:transparent;border:none;color:rgba(255,255,255,0.7);cursor:pointer;font-size:14px;padding:2px" title="Редактировать доплату">✏️</button>
            <button id="doplata_save_${recordId}_${doplataIndex}" onclick="saveEditDoplata('${recordId}', '${doplataIndex}')" style="display:none;margin-right:5px;background:var(--success);border:none;color:white;cursor:pointer;font-size:12px;padding:2px 4px" title="Сохранить">✓</button>
            <button id="doplata_cancel_${recordId}_${doplataIndex}" onclick="cancelEditDoplata('${recordId}', '${doplataIndex}')" style="display:none;margin-right:5px;background:var(--danger);border:none;color:white;cursor:pointer;font-size:12px;padding:2px 4px" title="Отменить">✗</button>
            <button onclick="deleteDoplataPayment('${recordId}', '${doplataIndex}')" style="background:transparent;border:none;color:rgba(255,255,255,0.7);cursor:pointer;font-size:14px;padding:2px" title="Удалить доплату">🗑️</button>
          </td>
        </tr>
      `;
    } else {
      html += `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.1)">
          <td style="padding:8px">${dateStr}</td>
          <td style="padding:8px">${esc(payment.type)}</td>
          <td style="text-align:right;padding:8px;font-weight:900;color:#fff">${fmt(payment.amount)} ₴</td>
          <td style="text-align:right;padding:8px"><span style="opacity:0.3">—</span></td>
        </tr>
      `;
    }
  });
  
  html += `
      </tbody>
    </table>
  `;
  
  document.getElementById('paymentHistoryContent').innerHTML = html;
  openModal('paymentHistoryModal');
}

function startEditDoplata(recordId, doplataIndex) {
  // Show input fields, hide text
  document.getElementById(`doplata_date_${recordId}_${doplataIndex}`).style.display = 'none';
  document.getElementById(`doplata_date_input_${recordId}_${doplataIndex}`).style.display = 'block';
  document.getElementById(`doplata_amount_${recordId}_${doplataIndex}`).style.display = 'none';
  document.getElementById(`doplata_amount_input_${recordId}_${doplataIndex}`).style.display = 'block';
  
  // Show save/cancel buttons, hide edit button
  document.getElementById(`doplata_edit_${recordId}_${doplataIndex}`).style.display = 'none';
  document.getElementById(`doplata_save_${recordId}_${doplataIndex}`).style.display = 'inline-block !important';
  document.getElementById(`doplata_cancel_${recordId}_${doplataIndex}`).style.display = 'inline-block !important';
}

function cancelEditDoplata(recordId, doplataIndex) {
  // Hide input fields, show text
  document.getElementById(`doplata_date_${recordId}_${doplataIndex}`).style.display = 'block';
  document.getElementById(`doplata_date_input_${recordId}_${doplataIndex}`).style.display = 'none';
  document.getElementById(`doplata_amount_${recordId}_${doplataIndex}`).style.display = 'block';
  document.getElementById(`doplata_amount_input_${recordId}_${doplataIndex}`).style.display = 'none';
  
  // Hide save/cancel buttons, show edit button
  document.getElementById(`doplata_edit_${recordId}_${doplataIndex}`).style.display = 'inline-block';
  document.getElementById(`doplata_save_${recordId}_${doplataIndex}`).style.display = 'none !important';
  document.getElementById(`doplata_cancel_${recordId}_${doplataIndex}`).style.display = 'none !important';
}

function saveEditDoplata(recordId, doplataIndex) {
  const record = db.find(item => item.ID === recordId);
  if (!record) return;
  
  const doplataKey = `Доплата${doplataIndex}`;
  const doplataDateKey = `Доплата_Дата${doplataIndex}`;
  
  const oldAmount = parseFloat(record[doplataKey]) || 0;
  const newAmount = parseFloat(document.getElementById(`doplata_amount_input_${recordId}_${doplataIndex}`).value);
  const newDate = document.getElementById(`doplata_date_input_${recordId}_${doplataIndex}`).value;
  
  if (isNaN(newAmount) || newAmount < 0) {
    alert('Введите корректную сумму!');
    return;
  }
  
  // Calculate the difference
  const amountDifference = newAmount - oldAmount;
  
  // Update record
  const updatedItem = {
    ...record,
    [doplataKey]: newAmount,
    [doplataDateKey]: newDate
  };
  
  // Update actual amount by adding the difference
  const currentActualAmount = parseFloat(record["ФактСумма"]) || parseFloat(record["Сумма"]) || 0;
  const totalActualAmount = currentActualAmount + amountDifference;
  
  const newActualEarnings = Math.round(totalActualAmount * 0.06);
  updatedItem["ФактСумма"] = totalActualAmount;
  updatedItem["ФактЗаработок"] = newActualEarnings.toFixed(0);
  
  // Recalculate potential earnings if actual amount is greater than original
  const originalAmount = parseFloat(record["Сумма"]) || 0;
  const maxAmount = Math.max(originalAmount, totalActualAmount);
  const newPotentialEarnings = Math.round(maxAmount * 0.06);
  updatedItem["Заработок"] = newPotentialEarnings.toFixed(0);
  
  // Update in database
  const index = db.findIndex(i => String(i.ID) === String(recordId));
  if(index !== -1){
    db[index] = updatedItem;
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    
    // Invalidate cache to prevent overwriting with old cached data
    Cache.clear();
    
    // Update modal immediately with new data
    showPaymentHistory(recordId);
    
    // Send to Google Sheet
    const entry = {
      action: 'EDIT',
      id: record.ID,
      date: record["Дата"],
      amount: record["Сумма"],
      actualAmount: totalActualAmount,
      project: record["Проект"],
      earnings: record["Заработок"],
      actualEarnings: newActualEarnings.toFixed(0),
      comment: record["Комментарий"] || '',
      manager: record["Manager"]
    };
    
    // Add payment columns to entry
    for(let j = 1; j <= 10; j++) {
      entry[`Доплата${j}`] = updatedItem[`Доплата${j}`] || '';
      entry[`Доплата_Дата${j}`] = updatedItem[`Доплата_Дата${j}`] || '';
    }
    
    Queue.add(entry);
    // Update main view immediately
    render();
  }
}

function submitPaymentInline(recordId) {
  const paymentDate = document.getElementById(`paymentDate_${recordId}`).value;
  const paymentAmount = document.getElementById(`paymentAmount_${recordId}`).value;
  
  if (!paymentDate || !paymentAmount || parseFloat(paymentAmount) <= 0) {
    alert('Заполните все поля корректно!');
    return;
  }
  
  const record = db.find(item => item.ID === recordId);
  if (!record) return;
  
  const amount = parseFloat(paymentAmount);
  
  // Find next available doplata column
  let nextDoplataColumn = null;
  let nextDoplataDateColumn = null;
  for (let i = 1; i <= 10; i++) {
    const doplataKey = `Доплата${i}`;
    if (!record[doplataKey] || record[doplataKey] === '' || record[doplataKey] === null || parseFloat(record[doplataKey]) === 0) {
      nextDoplataColumn = doplataKey;
      nextDoplataDateColumn = `Доплата_Дата${i}`;
      break;
    }
  }
  
  if (!nextDoplataColumn) {
    alert('Достигнут лимит доплат (10). Невозможно добавить новую доплату.');
    return;
  }
  
  // Update record with new payment
  const formattedPaymentDate = paymentDate;
  
  // Calculate new actual amount (existing fact amount + new doplata)
  let existingFactAmount = parseFloat(record["ФактСумма"]) || parseFloat(record["Сумма"]) || 0;
  let totalActualAmount = existingFactAmount + amount; // Add new doplata to existing fact amount
  
  const newActualEarnings = Math.round(totalActualAmount * 0.06);
  
  // Recalculate potential earnings if actual amount is greater than original
  const originalAmount = parseFloat(record["Сумма"]) || 0;
  const maxAmount = Math.max(originalAmount, totalActualAmount);
  const newPotentialEarnings = Math.round(maxAmount * 0.06);
  
  const updatedItem = {
    ...record,
    [nextDoplataColumn]: amount,
    [nextDoplataDateColumn]: formattedPaymentDate,
    "ФактСумма": totalActualAmount,
    "ФактЗаработок": newActualEarnings.toFixed(0),
    "Заработок": newPotentialEarnings.toFixed(0)
  };
  
  // Update comment with payment info
  const [year, month, day] = paymentDate.split('-');
  const dateStr = pad(parseInt(day)) + '.' + pad(parseInt(month));
  const currentComment = record["Комментарий"] || '';
  updatedItem["Комментарий"] = currentComment;
  
  // Update in database
  const index = db.findIndex(i => String(i.ID) === String(recordId));
  if(index !== -1){
    db[index] = updatedItem;
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    render(); // Update UI immediately
    
    // Invalidate cache to prevent overwriting with old cached data
    Cache.clear();
    
    // Send to Google Sheet
    const entry = {
      action: 'EDIT',
      id: record.ID,
      date: record["Дата"].split('T')[0] || record["Дата"],
      amount: record["Сумма"],
      actualAmount: updatedItem["ФактСумма"],
      project: record["Проект"],
      earnings: record["Заработок"],
      actualEarnings: updatedItem["ФактЗаработок"],
      comment: updatedItem["Комментарий"],
      manager: record["Manager"]
    };
    
    // Add payment columns to entry
    for(let j = 1; j <= 10; j++) {
      entry[`Доплата${j}`] = updatedItem[`Доплата${j}`] || '';
      entry[`Доплата_Дата${j}`] = updatedItem[`Доплата_Дата${j}`] || '';
    }
    
    Queue.add(entry);
    // Don't call sync() immediately - let Queue handle it in background
  }
  
  // Clear input fields
  document.getElementById(`paymentDate_${recordId}`).value = '';
  document.getElementById(`paymentAmount_${recordId}`).value = '';
  
  // Refresh payment history modal
  showPaymentHistory(recordId);
}

function editDoplataPayment(recordId, doplataIndex) {
  console.log('editDoplataPayment called with:', recordId, doplataIndex);
  
  const record = db.find(item => item.ID === recordId);
  if (!record) {
    console.log('Record not found:', recordId);
    return;
  }
  
  const doplataKey = `Доплата${doplataIndex}`;
  const doplataDateKey = `Доплата_Дата${doplataIndex}`;
  const currentAmount = record[doplataKey] || 0;
  const currentDate = record[doplataDateKey] || record["Дата"];
  
  console.log('Current doplata:', doplataKey, currentAmount, currentDate);
  
  const newAmount = prompt(`Редактировать доплату ${doplataIndex}:`, currentAmount);
  if (newAmount === null) return; // User cancelled
  
  const parsedAmount = parseFloat(newAmount);
  if (isNaN(parsedAmount) || parsedAmount < 0) {
    alert('Введите корректную сумму!');
    return;
  }
  
  const newDate = prompt(`Изменить дату доплаты ${doplataIndex} (YYYY-MM-DD):`, currentDate);
  if (newDate === null) return; // User cancelled
  
  console.log('New values:', newAmount, newDate);
  
  // Update record
  const updatedItem = {
    ...record,
    [doplataKey]: parsedAmount,
    [doplataDateKey]: newDate
  };
  
  // Recalculate actual amounts
  let totalActualAmount = parseFloat(record["Сумма"]) || 0;
  for(let j = 1; j <= 10; j++) {
    if(updatedItem[`Доплата${j}`] && updatedItem[`Доплата${j}`] !== '') {
      totalActualAmount += parseFloat(updatedItem[`Доплата${j}`]);
    }
  }
  
  const newActualEarnings = Math.round(totalActualAmount * 0.06);
  updatedItem["ФактСумма"] = totalActualAmount;
  updatedItem["ФактЗаработок"] = newActualEarnings.toFixed(0);
  
  console.log('Updated item:', updatedItem);
  
  // Update in database
  const index = db.findIndex(i => String(i.ID) === String(recordId));
  if(index !== -1){
    db[index] = updatedItem;
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    
    // Update modal immediately with new data
    showPaymentHistory(recordId);
    
    // Send to Google Sheet
    const entry = {
      action: 'EDIT',
      id: record.ID,
      date: record["Дата"],
      amount: record["Сумма"],
      actualAmount: totalActualAmount,
      project: record["Проект"],
      earnings: record["Заработок"],
      actualEarnings: newActualEarnings.toFixed(0),
      comment: record["Комментарий"] || '',
      manager: record["Manager"]
    };
    
    // Add payment columns to entry
    for(let j = 1; j <= 10; j++) {
      entry[`Доплата${j}`] = updatedItem[`Доплата${j}`] || '';
      entry[`Доплата_Дата${j}`] = updatedItem[`Доплата_Дата${j}`] || '';
    }
    
    Queue.add(entry);
    // Sync in background without blocking
    sync();
  }
}

function deleteDoplataPayment(recordId, doplataIndex) {
  console.log('deleteDoplataPayment called with:', recordId, doplataIndex);
  
  if (!confirm(`Удалить доплату ${doplataIndex}?`)) return;
  
  const record = db.find(item => item.ID === recordId);
  if (!record) {
    console.log('Record not found for deletion:', recordId);
    return;
  }
  
  const doplataKey = `Доплата${doplataIndex}`;
  const doplataDateKey = `Доплата_Дата${doplataIndex}`;
  
  console.log('Deleting doplata:', doplataKey, doplataDateKey);
  
  // Update record - remove doplata
  const updatedItem = {
    ...record,
    [doplataKey]: '',
    [doplataDateKey]: ''
  };
  
  // Get the deleted doplata amount
  const deletedDoplataAmount = parseFloat(record[doplataKey]) || 0;
  
  // Start with current actual amount and subtract deleted doplata
  let totalActualAmount = parseFloat(record["ФактСумма"]) || parseFloat(record["Сумма"]) || 0;
  totalActualAmount -= deletedDoplataAmount;
  
  // Recalculate earnings based on new actual amount
  const newActualEarnings = Math.round(totalActualAmount * 0.06);
  updatedItem["ФактСумма"] = totalActualAmount;
  updatedItem["ФактЗаработок"] = newActualEarnings.toFixed(0);
  
  // Recalculate potential earnings if actual amount is greater than original
  const originalAmount = parseFloat(record["Сумма"]) || 0;
  const maxAmount = Math.max(originalAmount, totalActualAmount);
  const newPotentialEarnings = Math.round(maxAmount * 0.06);
  updatedItem["Заработок"] = newPotentialEarnings.toFixed(0);
  
  console.log('Updated item after deletion:', updatedItem);
  
  // Update in database
  const index = db.findIndex(i => String(i.ID) === String(recordId));
  if(index !== -1){
    db[index] = updatedItem;
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    
    // Invalidate cache to prevent overwriting with old cached data
    Cache.clear();
    
    // Update modal immediately with new data
    showPaymentHistory(recordId);
    
    // Send to Google Sheet
    const entry = {
      action: 'EDIT',
      id: record.ID,
      date: record["Дата"],
      amount: record["Сумма"],
      actualAmount: totalActualAmount,
      project: record["Проект"],
      earnings: record["Заработок"],
      actualEarnings: newActualEarnings.toFixed(0),
      comment: record["Комментарий"] || '',
      manager: record["Manager"]
    };
    
    // Add payment columns to entry
    for(let j = 1; j <= 10; j++) {
      entry[`Доплата${j}`] = updatedItem[`Доплата${j}`] || '';
      entry[`Доплата_Дата${j}`] = updatedItem[`Доплата_Дата${j}`] || '';
    }
    
    Queue.add(entry);
    render(); // Update main view immediately
    // Don't call sync() immediately - let Queue handle it in background
  }
}

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
    if(m) Queue.add({action:'SAVE_MANAGER',id:s.id,name:m.name,password:m.password,goalMoney:cfg.goalMoney,goalDaily:cfg.goalDaily});
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
  addMgrProject(mgrId,name);
  render();
  Queue.add({action:'ADD_PROJECT',name,manager:mgrId});
}
function deleteProject(mgrId,name){
  if(!confirm(`Удалить проект "${name}"?`))return;
  delMgrProject(mgrId,name);
  render();
  Queue.add({action:'DELETE_PROJECT',name,manager:mgrId});
}

async function sync(){
  // Non-blocking sync - runs in background with caching
  try{
    // Check cache first
    const cachedData = Cache.get('sheets_data');
    if (cachedData) {
      // Use cached data immediately
      processSyncData(cachedData);
    }

    // Fetch fresh data in background
    const res=await fetch(API+"?t="+Date.now());
    const data=await res.json();
    
    // Update cache
    Cache.set('sheets_data', data);
    
    // Process fresh data
    processSyncData(data);
  }catch(e){console.error(e);}
}

function processSyncData(data){
  if(data.db){
    db=data.db.filter(i=>!deletedIds.has(String(i.ID).replace(/'/g,"").trim()));
    localStorage.setItem(DB_KEY,JSON.stringify(db));
  }
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
  render();
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
//  MAIN RENDER
// ============================================================
const debouncedRender = Performance.debounce(function() {
  renderInternal();
}, 100);

function render(){
  debouncedRender();
}

function renderInternal(){
  Performance.start('render');
  
  const s=getSess();if(!s)return;
  const acc=getAcc();

  // Populate year selector for activity chart
  const yearSel = document.getElementById('activityYear');
  if (yearSel) {
    const years = new Set();
    db.forEach(i => {
      const dateStr = String(i["Дата"]);
      if (dateStr.includes('-')) {
        const year = dateStr.split('-')[0];
        if (year) years.add(year);
      }
    });
    const sortedYears = Array.from(years).sort().reverse();
    const currentVal = yearSel.value;
    yearSel.innerHTML = '<option value="all" selected>Все</option>' + 
      sortedYears.map(y => `<option value="${y}">${y}</option>`).join('');
    if (sortedYears.includes(currentVal)) yearSel.value = currentVal;
  }

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

  let earned=0,dirtySales=0,totalBalance=0,mgrBalance=0,actualMgrBalance=0,filteredCount=0;
  let dayStats={},projSums={},monthSums={},earnMonthStats={};

  // payMgrId for payout section balance
  const payMgrIdForBal = s.role==='manager' ? s.id : (selMgrs.length===1 ? selMgrs[0] : null);

  // Determine if in all-time mode
  const isAllTime=viewAllTime||(s.role==='admin'&&adAllTime);

  db.forEach(i=>{
    const val=parseFloat(i["Заработок"])||0;
    const actualVal = i["ФактЗаработок"] !== undefined && i["ФактЗаработок"] !== null ? parseFloat(i["ФактЗаработок"]) : val; // Если нет фактического, используем потенциальный
    const sale=parseFloat(i["Сумма"])||0;
    const proj=String(i["Проект"]||"Другое");
    const isPay=proj.startsWith("Выплата")||proj.startsWith("Ожидание");
    const iym=ym(i["Дата"]);if(!iym)return;
    const recMgr=getRecMgr(i);

    totalBalance+=actualVal;
    if(payMgrIdForBal){ 
      if(recMgr===payMgrIdForBal) {
        mgrBalance+=val; // Потенциальный заработок
        actualMgrBalance+=actualVal; // Фактический заработок
      } 
    } else {
      mgrBalance+=val; // Потенциальный заработок
      actualMgrBalance+=actualVal; // Фактический заработок
    }
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
      // Extract day of month (1-31)
      const dateStr = String(i["Дата"]);
      let day;
      if (dateStr.includes('T')) {
        const datePart = dateStr.split('T')[0];
        day = parseInt(datePart.split('-')[2]);
      } else if (dateStr.includes('-')) {
        day = parseInt(dateStr.split('-')[2]);
      } else {
        day = 1; // fallback
      }
      
      // Collect day stats (respect year filter in all-time mode)
      const yearFilter = document.getElementById('activityYear')?.value || 'all';
      const recordYear = iym.split('-')[0];
      if (!isAllTime || yearFilter === 'all' || recordYear === yearFilter) {
        dayStats[day]=(dayStats[day]||0)+1;
      }
      
      // Collect earnings by month (respect year filter)
      if (yearFilter === 'all' || recordYear === yearFilter) {
        earnMonthStats[iym]=(earnMonthStats[iym]||0)+val;
      }
      
      projSums[proj]=(projSums[proj]||0)+val;
    }
  });

  // rebuild monthSums for all-time mode
  if(isAllTime){
    monthSums={};
    earnMonthStats={};
    const yearFilter = document.getElementById('activityYear')?.value || 'all';
    
    db.forEach(i=>{
      const val=parseFloat(i["Заработок"])||0;
      const actualVal = i["ФактЗаработок"] !== undefined && i["ФактЗаработок"] !== null ? parseFloat(i["ФактЗаработок"]) : val;
      const proj=String(i["Проект"]||"");
      if(proj.startsWith("Выплата")||proj.startsWith("Ожидание"))return;
      const iym2=ym(i["Дата"]);if(!iym2)return;
      const recMgr=getRecMgr(i);
      
      // Apply year filter
      const recordYear = iym2.split('-')[0];
      if (yearFilter !== 'all' && recordYear !== yearFilter) return;
      
      const mgrOk=!mgrFilter||mgrFilter.includes(recMgr);
      const prOk=!projFilter||projFilter.includes(proj);
      if(mgrOk&&prOk){
        monthSums[iym2]=(monthSums[iym2]||0)+val;
        earnMonthStats[iym2]=(earnMonthStats[iym2]||0)+val;
      }
    });
  }

  document.getElementById('hb-val').innerHTML=`<span style="color:#fbbf24">П - ${fmt(mgrBalance)}</span> &nbsp;&nbsp; <span style="color:#10b981">Ф - ${fmt(actualMgrBalance)}</span>`;
  document.getElementById('salaryRemainder').innerText=fmt(mgrBalance)+' ₴';
  document.getElementById('actualSalaryRemainder').innerText=fmt(actualMgrBalance)+' ₴';
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
  
  // Determine max day to show - include future days that have payments
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
  const currentDay = today.getDate();
  const isCurrentMonth = yr == currentYear && mo == currentMonth;
  
  // Find the maximum day with any payment (including future payments)
  let maxDayWithPayment = 0;
  for (let day = 1; day <= dim; day++) {
    if (dayStats[day] > 0) {
      maxDayWithPayment = day;
    }
  }
  
  // Show up to current day OR max day with payment, whichever is greater
  const maxDayToShow = isCurrentMonth ? Math.max(currentDay, maxDayWithPayment) : dim;
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
  }).sort((a,b)=>{
    // Sort by date string directly to avoid timezone issues
    const dateA = a["Дата"];
    const dateB = b["Дата"];
    return dateB.localeCompare(dateA);
  }).forEach(i=>{
    // Format date without timezone conversion
    const dateStr = String(i["Дата"]);
    let ds = dateStr;
    if (dateStr.includes('T')) {
      // ISO format - extract date part
      const datePart = dateStr.split('T')[0];
      const [year, month, day] = datePart.split('-');
      ds = pad(parseInt(day)) + '.' + pad(parseInt(month));
    } else if (dateStr.includes('-')) {
      // YYYY-MM-DD format
      const [year, month, day] = dateStr.split('-');
      ds = pad(parseInt(day)) + '.' + pad(parseInt(month));
    }
    const recMgr=getRecMgr(i);
    const mgrName=recMgr==='vlad'?'Влад':(acc.managers.find(m=>m.id===recMgr)?.name||recMgr);
    const canEdit=s.role==='admin'||(s.role==='manager'&&recMgr===s.id);
    const actualAmount = i["ФактСумма"] !== undefined && i["ФактСумма"] !== null && i["ФактСумма"] !== "" ? parseFloat(i["ФактСумма"]) : null;
    const actualEarn = i["ФактЗаработок"] !== undefined && i["ФактЗаработок"] !== null && i["ФактЗаработок"] !== "" ? parseFloat(i["ФактЗаработок"]) : null;
    const showActual = actualEarn !== null;
    const showActualAmount = actualAmount !== null;

    
    tbody.innerHTML+=`<tr>
      <td style="font-weight:900">${ds}</td>
      <td style="font-size:11px;opacity:.65">${esc(mgrName)}</td>
      <td>${esc(i["Проект"])}</td>
      <td style="color:#fff;font-weight:900">${fmt(i["Сумма"])} &#8372;</td>
      <td style="color:var(--success);font-weight:900">${fmt(i["Заработок"])} &#8372;</td>
      <td style="color:${showActualAmount?'#fff':'rgba(255,255,255,.3)'};font-weight:900">${showActualAmount ? fmt(actualAmount) + ' &#8372;' : ''}</td>
      <td style="color:${showActual?'var(--success)':'rgba(255,255,255,.3)'};font-weight:900">${showActual ? fmt(actualEarn) + ' &#8372;' : ''}</td>
      <td style="opacity:.45;font-size:11px">${esc(i["Комментарий"]||'')}</td>
      <td style="text-align:right">${canEdit?`<div class="action-buttons"><button class="bt add" onclick="showPaymentHistory(decodeURIComponent('${encodeURIComponent(i.ID)}'))" title="">+</button><button class="bt edit" onclick="editE(decodeURIComponent('${encodeURIComponent(i.ID)}'))">&#9998;</button><button class="bt delete" onclick="delE(decodeURIComponent('${encodeURIComponent(i.ID)}'))">&#128465;</button></div>`:''}</td>
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
  }).sort((a,b)=>{
    // Sort by date string directly to avoid timezone issues
    const dateA = a["Дата"];
    const dateB = b["Дата"];
    return dateB.localeCompare(dateA);
  }).forEach(i=>{
    const val=parseFloat(i["Заработок"])||0;
    const col=val>0?'var(--success)':'var(--danger)';
    // Format date without timezone conversion
    const dateStr = String(i["Дата"]);
    let ds = dateStr;
    if (dateStr.includes('T')) {
      // ISO format - extract date part
      const datePart = dateStr.split('T')[0];
      const [year, month, day] = datePart.split('-');
      ds = pad(parseInt(day)) + '.' + pad(parseInt(month));
    } else if (dateStr.includes('-')) {
      // YYYY-MM-DD format
      const [year, month, day] = dateStr.split('-');
      ds = pad(parseInt(day)) + '.' + pad(parseInt(month));
    }
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

  updateMainChart(dim, dayStats, isAllTime, earnMonthStats, maxDayToShow, {
    role:s.role,
    monthFilter,
    mgrFilter,
    projFilter
  });

  // Show/hide manager comparison button based on role
  const managerBtn = document.getElementById('managerComparisonBtn');
  if (managerBtn) {
    managerBtn.style.display = s.role === 'admin' ? 'inline-block' : 'none';
  }

  // Auto-update project chart if it's visible
  const chartsContainer = document.getElementById('additionalChartsContainer');
  if (chartsContainer && chartsContainer.style.display !== 'none') {
    showProjectChart();
  }

  // Analytics
  if(s.role==='admin'){
    renderAnalytics(mgrFilter,projFilter,acc);
  } else {
    document.getElementById('analyticsSection').classList.remove('on');
  }
  
  Performance.end('render');
}

// ============================================================
//  CHARTS
// ============================================================

// Main activity chart — monthly mode: days; all-time mode: projects by month
function updateMainChart(dim, dayStats, isAllTime, earnMonthStats, maxDayToShow, opts){
  const ctx = document.getElementById('paymentChart').getContext('2d');
  const { role, monthFilter, mgrFilter, projFilter } = opts;
  
  // Show/hide metric selector based on all-time mode
  const metricWrap = document.getElementById('activityMetricWrap');
  if (metricWrap) {
    metricWrap.style.display = isAllTime ? 'flex' : 'none';
  }
  
  // Get selected metric (only relevant in all-time mode)
  const metricSel = document.getElementById('activityMetric')?.value || 'count';
  
  // Determine if we should show months chart
  const showMonthsChart = isAllTime && metricSel === 'earn';
  
  let labels, data, label, borderColor, backgroundColor, stepSize, pointColors;
  
  if (showMonthsChart) {
    // Show earnings by month
    const sortedMonths = Object.keys(earnMonthStats).sort();
    
    labels = sortedMonths.map(m => {
      const [year, month] = m.split('-');
      return `${month}.${year.slice(2)}`;
    });
    data = sortedMonths.map(m => earnMonthStats[m]);
    
    label = 'Заработок';
    borderColor = '#10b981';
    backgroundColor = 'rgba(16,185,129,0.15)';
    
    // Adjust step size for earnings
    const maxVal = Math.max(...data);
    if (maxVal > 1000) stepSize = 500;
    else if (maxVal > 100) stepSize = 100;
    else if (maxVal > 10) stepSize = 10;
    else stepSize = 1;
  } else {
    // Show payments by day - only days with payments or up to current day
    const dayLimit = isAllTime ? 31 : dim;
    
    // Get current day for status
    const today = new Date();
    const currentDay = today.getDate();
    
    // Filter data for selected month if not all-time
    let filteredDayStats = {...dayStats};
    if (!isAllTime) {
      const monthFilter = document.getElementById('filterMonth')?.value;
      if (monthFilter) {
        filteredDayStats = {};
        db.forEach(item => {
          const proj = String(item["Проект"] || "");
          const recMgr = getRecMgr(item);
          const mgrOk = !mgrFilter || mgrFilter.includes(recMgr);
          const prOk = !projFilter || projFilter.includes(proj);
          if (proj.startsWith("Выплата") || proj.startsWith("Ожидание")) return;
          if (!mgrOk || !prOk) return;
          if (ym(item["Дата"]) === monthFilter) {
            const dateStr = String(item["Дата"]);
            let day;
            if (dateStr.includes('T')) {
              const datePart = dateStr.split('T')[0];
              day = parseInt(datePart.split('-')[2]);
            } else if (dateStr.includes('-')) {
              day = parseInt(dateStr.split('-')[2]);
            } else {
              day = 1;
            }
            filteredDayStats[day] = (filteredDayStats[day] || 0) + 1;
          }
        });
      }
    }
    
    // Create arrays for all days
    labels = Array.from({length:dayLimit}, (_,i) => i+1);
    data = labels.map(d => filteredDayStats[d] || 0);
    
    // Create point colors based on day status
    pointColors = labels.map(d => {
      const hasPayment = filteredDayStats[d] > 0;
      const isPastOrToday = d <= currentDay;
      
      if (hasPayment) {
        return '#3b82f6'; // Blue for days with payments
      } else if (isPastOrToday) {
        return 'rgba(59,130,246,0.3)'; // Light blue for past days without payments
      } else {
        return 'rgba(59,130,246,0.1)'; // Very light for future days without payments
      }
    });
    
    label = 'Оплат';
    borderColor = '#3b82f6';
    backgroundColor = 'rgba(59,130,246,0.15)';
    stepSize = 1;
  }
  
  if (myChart) { myChart.destroy(); myChart=null; }
  
  // Prepare detailed data for tooltips
  const tooltipData = labels.map((label, i) => {
    if (showMonthsChart) {
      // Month data - reconstruct month key from label
      const [month, yearShort] = label.split('.');
      const monthKey = `20${yearShort}-${month.padStart(2, '0')}`;
      const monthData = db.filter(item => {
        const itemMonth = ym(item["Дата"]);
        const yearFilter = document.getElementById('activityYear')?.value || 'all';
        const recordYear = itemMonth.split('-')[0];
        const recMgr = getRecMgr(item);
        
        // Apply same filters as in main data processing
        const proj = String(item["Проект"]||"");
        const isPay = proj.startsWith("Выплата")||proj.startsWith("Ожидание");
        if (isPay) return false;
        
        const mgrOk = !mgrFilter || mgrFilter.includes(recMgr);
        const prOk = !projFilter || projFilter.includes(proj);
        
        return itemMonth === monthKey && 
               (yearFilter === 'all' || recordYear === yearFilter) &&
               mgrOk && prOk;
      });
      
      return {
        label: label,
        value: data[i],
        count: monthData.length,
        totalEarn: monthData.reduce((sum, item) => sum + (parseFloat(item["Заработок"]) || 0), 0),
        details: monthData.slice(0, 3).map(item => ({
          project: item["Проект"],
          amount: parseFloat(item["Сумма"]) || 0,
          earn: parseFloat(item["Заработок"]) || 0
        }))
      };
    } else {
      // Day data - use the same data as the chart
      const dayNum = parseInt(label);
      
      const dayData = db.filter(item => {
        const dateStr = String(item["Дата"]);
        let day;
        if (dateStr.includes('T')) {
          const datePart = dateStr.split('T')[0];
          day = parseInt(datePart.split('-')[2]);
        } else if (dateStr.includes('-')) {
          day = parseInt(dateStr.split('-')[2]);
        } else {
          day = 1;
        }
        
        if (day !== dayNum) return false;
        
        // Apply same filters as in main data processing
        const itemMonth = ym(item["Дата"]);
        const monthMatches = !isAllTime && monthFilter ? itemMonth === monthFilter : true;
        
        const proj = String(item["Проект"]||"");
        const isPay = proj.startsWith("Выплата")||proj.startsWith("Ожидание");
        if (isPay) return false;
        
        const recMgr = getRecMgr(item);
        const mgrOk = !mgrFilter || mgrFilter.includes(recMgr);
        const prOk = !projFilter || projFilter.includes(proj);
        
        return monthMatches && mgrOk && prOk;
      });
      
      return {
        label: label,
        value: data[i],
        count: dayData.length,
        totalEarn: dayData.reduce((sum, item) => sum + (parseFloat(item["Заработок"]) || 0), 0),
        details: dayData.slice(0, 3).map(item => ({
          project: item["Проект"],
          amount: parseFloat(item["Сумма"]) || 0,
          earn: parseFloat(item["Заработок"]) || 0
        }))
      };
    }
  });
  
  myChart = new Chart(ctx, {
    type: 'line',
    data: { 
      labels: labels,
      datasets:[{ 
        label, 
        data, 
        borderColor, 
        backgroundColor, 
        borderWidth:2, 
        fill:true, 
        tension:.4, 
        pointRadius:4,
        pointHoverRadius:6,
        pointBackgroundColor: pointColors || borderColor,
        pointBorderColor: pointColors || borderColor,
        pointBorderWidth:2
      }] 
    },
    options: { 
      responsive:true, 
      maintainAspectRatio:false,
      interaction: {
        intersect: false,
        mode: 'nearest'
      },
      plugins:{ 
        legend:{display:false},
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'rgba(255, 255, 255, 0.3)',
          borderWidth: 1,
          padding: 6,
          displayColors: false,
          mode: 'nearest',
          titleFont: { size: 11, weight: 'bold' },
          bodyFont: { size: 10 },
          callbacks: {
            title: function(context) {
              const data = tooltipData[context[0].dataIndex];
              return showMonthsChart ? data.label : `${data.label} число`;
            },
            label: function(context) {
              const data = tooltipData[context.dataIndex];
              if (showMonthsChart) {
                return [
                  `Заработок: ${fmt(data.totalEarn)} ₴`,
                  `Оплат: ${data.count} шт.`
                ];
              } else {
                return [
                  `Оплат: ${data.count} шт.`,
                  `Заработок: ${fmt(data.totalEarn)} ₴`
                ];
              }
            },
            afterLabel: function(context) {
              const data = tooltipData[context.dataIndex];
              if (data.details.length > 0) {
                let result = [];
                data.details.forEach(detail => {
                  result.push(`${detail.project}: ${fmt(detail.earn)} ₴`);
                });
                return result;
              }
              return [];
            }
          }
        }
      },
      onClick: function(event, elements) {
        if (elements.length > 0) {
          const index = elements[0].index;
          const data = tooltipData[index];
          showDayDetails(data);
        }
      },
      scales:{ 
        x:{ 
          grid:{display:false}, 
          ticks:{color:'rgba(226,232,240,.4)',font:{size:8}},
          type: 'category'
        }, 
        y:{ beginAtZero:true, ticks:{stepSize, color:'rgba(226,232,240,.4)',font:{size:8}} } 
      }
    }
  });
}

function renderExtendedStats(mgrFilter, projFilter, acc) {
  // Filter data based on current filters
  let filteredData = db;
  
  // Apply month filter only if not "all time"
  const monthFilter = document.getElementById('filterMonth')?.value;
  const isAllTime = viewAllTime;
  
  if (!isAllTime && monthFilter) {
    filteredData = filteredData.filter(item => ym(item["Дата"]) === monthFilter);
  }
  
  if (mgrFilter && mgrFilter.length > 0) {
    filteredData = filteredData.filter(item => mgrFilter.includes(getRecMgr(item)));
  }
  
  if (projFilter && projFilter.length > 0) {
    filteredData = filteredData.filter(item => projFilter.includes(String(item["Проект"])));
  }
  
  // Calculate best day
  const dayStats = {};
  filteredData.forEach(item => {
    const dateStr = String(item["Дата"]);
    let day;
    if (dateStr.includes('T')) {
      const datePart = dateStr.split('T')[0];
      day = datePart.split('-')[2];
    } else if (dateStr.includes('-')) {
      day = dateStr.split('-')[2];
    } else {
      day = '01';
    }
    const earn = parseFloat(item["Заработок"]) || 0;
    dayStats[day] = (dayStats[day] || 0) + earn;
  });
  
  const bestDayEntry = Object.entries(dayStats).sort((a, b) => b[1] - a[1])[0];
  const bestDay = bestDayEntry ? bestDayEntry[0] : '-';
  const bestDayValue = bestDayEntry ? bestDayEntry[1] : 0;
  
  // Calculate best project
  const projectStats = {};
  filteredData.forEach(item => {
    const proj = String(item["Проект"]);
    const earn = parseFloat(item["Заработок"]) || 0;
    if (!proj.startsWith("Выплата") && !proj.startsWith("Ожидание")) {
      projectStats[proj] = (projectStats[proj] || 0) + earn;
    }
  });
  
  const bestProjectEntry = Object.entries(projectStats).sort((a, b) => b[1] - a[1])[0];
  const bestProject = bestProjectEntry ? bestProjectEntry[0] : '-';
  const bestProjectValue = bestProjectEntry ? bestProjectEntry[1] : 0;
  
  // Calculate average daily earnings by day of week
  const dayOfWeekStats = {};
  filteredData.forEach(item => {
    const date = new Date(item["Дата"]);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const earn = parseFloat(item["Заработок"]) || 0;
    dayOfWeekStats[dayOfWeek] = (dayOfWeekStats[dayOfWeek] || { total: 0, count: 0 });
    dayOfWeekStats[dayOfWeek].total += earn;
    dayOfWeekStats[dayOfWeek].count += 1;
  });
  
  const avgDailyEarn = Object.values(dayOfWeekStats).length > 0 
    ? Object.values(dayOfWeekStats).reduce((sum, day) => sum + day.total, 0) / Object.values(dayOfWeekStats).length 
    : 0;
  
  // Calculate activity rate (days with payments)
  const uniqueDays = new Set();
  filteredData.forEach(item => {
    const dateStr = String(item["Дата"]);
    if (dateStr.includes('-')) {
      uniqueDays.add(dateStr.split('-')[2]);
    }
  });
  const totalDaysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const activityRate = totalDaysInMonth > 0 ? Math.round((uniqueDays.size / totalDaysInMonth) * 100) : 0;
  
  // Update DOM
  document.getElementById('bestDay').textContent = bestDay !== '-' ? `${bestDay} число` : '-';
  document.getElementById('bestDayValue').textContent = fmt(bestDayValue) + ' ₴';
  document.getElementById('bestProject').textContent = bestProject;
  document.getElementById('bestProjectValue').textContent = fmt(bestProjectValue) + ' ₴';
  document.getElementById('avgDailyEarn').textContent = fmt(avgDailyEarn) + ' ₴';
  document.getElementById('activityRate').textContent = activityRate + '%';
  
  // Render top projects
  renderTopProjects(projectStats);
}

function renderTopProjects(projectStats) {
  const container = document.getElementById('topProjectsList');
  const topProjects = Object.entries(projectStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  if (topProjects.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.4);padding:20px">Нет данных о проектах</div>';
    return;
  }
  
  container.innerHTML = topProjects.map((project, index) => {
    const [name, value] = project;
    const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : 'other';
    const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;
    
    return `
      <div class="top-project-item">
        <div class="top-project-rank ${rankClass}">${rankEmoji}</div>
        <div class="top-project-info">
          <div class="top-project-name">${esc(name)}</div>
          <div class="top-project-count">Высокая доходность</div>
        </div>
        <div class="top-project-value">${fmt(value)} ₴</div>
      </div>
    `;
  }).join('');
}

let additionalChart = null;

function showManagerComparison() {
  const container = document.getElementById('additionalChartsContainer');
  const s = getSess();
  const acc = getAcc();
  
  if (s.role !== 'admin') {
    container.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.4)">Доступно только для администратора</div>';
    return;
  }
  
  // Apply month filter
  const monthFilter = document.getElementById('filterMonth')?.value;
  let filteredData = db;
  if (monthFilter) {
    filteredData = db.filter(item => ym(item["Дата"]) === monthFilter);
  }
  
  // Calculate manager stats
  const managerStats = {};
  filteredData.forEach(item => {
    const mgr = getRecMgr(item);
    const earn = parseFloat(item["Заработок"]) || 0;
    const count = 1;
    
    if (!managerStats[mgr]) {
      managerStats[mgr] = { total: 0, count: 0 };
    }
    managerStats[mgr].total += earn;
    managerStats[mgr].count += count;
  });
  
  // Get manager names
  const labels = [];
  const data = [];
  const colors = [];
  
  Object.entries(managerStats).forEach(([mgrId, stats], index) => {
    const mgr = acc.managers.find(m => m.id === mgrId);
    const name = mgr ? mgr.name : mgrId;
    labels.push(name);
    data.push(stats.total);
    colors.push(COLORS[index % COLORS.length]);
  });
  
  container.innerHTML = '<canvas id="additionalChart" style="max-height:300px"></canvas>';
  
  if (additionalChart) additionalChart.destroy();
  
  const ctx = document.getElementById('additionalChart').getContext('2d');
  additionalChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Заработок',
        data: data,
        backgroundColor: colors.map(c => c + '80'),
        borderColor: colors,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              const mgrId = acc.managers.find(m => m.name === context.label)?.id;
              const stats = managerStats[mgrId];
              return [
                `Заработок: ${fmt(context.parsed.y)} ₴`,
                `Оплат: ${stats.count} шт.`
              ];
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: 'rgba(226,232,240,.4)' },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        x: {
          ticks: { color: 'rgba(226,232,240,.4)' },
          grid: { display: false }
        }
      }
    }
  });
}


function showProjectChart() {
  const container = document.getElementById('additionalChartsContainer');
  
  // Apply month filter only if not "all time"
  const monthFilter = document.getElementById('filterMonth')?.value;
  const isAllTime = viewAllTime;
  let filteredData = db;
  
  if (!isAllTime && monthFilter) {
    filteredData = db.filter(item => ym(item["Дата"]) === monthFilter);
  }
  
  // Calculate project stats
  const projectStats = {};
  filteredData.forEach(item => {
    const proj = String(item["Проект"]);
    const earn = parseFloat(item["Заработок"]) || 0;
    
    if (!proj.startsWith("Выплата") && !proj.startsWith("Ожидание")) {
      projectStats[proj] = (projectStats[proj] || 0) + earn;
    }
  });
  
  // Get top 10 projects
  const topProjects = Object.entries(projectStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  const labels = topProjects.map(p => p[0]);
  const data = topProjects.map(p => p[1]);
  const colors = labels.map((_, i) => COLORS[i % COLORS.length]);
  
  // Create HTML with chart on left and info on right
  container.innerHTML = `
    <div style="display:flex;gap:20px;align-items:center">
      <div style="flex:1;max-width:300px">
        <canvas id="additionalChart" style="max-height:300px"></canvas>
      </div>
      <div style="flex:1;min-width:200px">
        <div style="font-size:14px;font-weight:700;color:var(--accent);margin-bottom:15px">Топ-10 проектов</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${topProjects.map((project, index) => {
            const [name, value] = project;
            const total = data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            const color = colors[index];
            return `
              <div style="display:flex;align-items:center;gap:8px">
                <div style="width:12px;height:12px;background:${color};border-radius:50%"></div>
                <div style="flex:1">
                  <div style="font-size:12px;color:#fff;font-weight:600">${esc(name)}</div>
                  <div style="font-size:11px;color:rgba(255,255,255,0.6)">${fmt(value)} ₴ (${percentage}%)</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div style="margin-top:15px;padding-top:15px;border-top:1px solid rgba(255,255,255,0.1)">
          <div style="font-size:12px;color:rgba(255,255,255,0.6)">
            <div>Всего проектов: ${labels.length}</div>
            <div>Общий заработок: ${fmt(data.reduce((a, b) => a + b, 0))} ₴</div>
            <div>Период: ${!isAllTime && monthFilter ? monthFilter : 'Всё время'}</div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  if (additionalChart) additionalChart.destroy();
  
  const ctx = document.getElementById('additionalChart').getContext('2d');
  additionalChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors.map(c => c + '80'),
        borderColor: colors,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((context.parsed / total) * 100).toFixed(1);
              return `${context.label}: ${fmt(context.parsed)} ₴ (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

function applyPreset() {
  const preset = document.getElementById('filterPreset').value;
  const monthInput = document.getElementById('filterMonth');
  const allTimeBtn = document.getElementById('btnAllTime');
  
  if (!preset) return;
  
  const today = new Date();
  let targetMonth = '';
  let isAllTime = false;
  
  switch (preset) {
    case 'today':
      // Today - use current month
      targetMonth = ym(today);
      break;
    case 'week':
      // This week - use current month
      targetMonth = ym(today);
      break;
    case 'last30':
      // Last 30 days - use current month
      targetMonth = ym(today);
      break;
    case 'thisMonth':
      // This month
      targetMonth = ym(today);
      break;
    case 'lastMonth':
      // Last month
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      targetMonth = ym(lastMonth);
      break;
  }
  
  // Set month filter
  monthInput.value = targetMonth;
  
  // Turn off all-time mode
  if (viewAllTime) {
    toggleAllTime();
  }
  
  // Update UI
  render();
}

function saveCustomFilter() {
  const name = prompt('Название фильтра:');
  if (!name) return;
  
  const s = getSess();
  if (!s) return;
  
  const customFilters = JSON.parse(localStorage.getItem('customFilters') || '{}');
  
  // Save current filter state
  customFilters[name] = {
    month: document.getElementById('filterMonth').value,
    allTime: viewAllTime,
    managers: selMgrs,
    projects: selProjs,
    timestamp: Date.now()
  };
  
  localStorage.setItem('customFilters', JSON.stringify(customFilters));
  alert('Фильтр сохранен: ' + name);
}

function loadCustomFilter(name) {
  const customFilters = JSON.parse(localStorage.getItem('customFilters') || '{}');
  const filter = customFilters[name];
  
  if (!filter) return;
  
  // Apply filter
  document.getElementById('filterMonth').value = filter.month;
  
  if (filter.allTime && !viewAllTime) {
    toggleAllTime();
  } else if (!filter.allTime && viewAllTime) {
    toggleAllTime();
  }
  
  // Apply manager and project filters
  selMgrs = filter.managers || [];
  selProjs = filter.projects || [];
  
  // Update UI
  render();
}

function exportData() {
  const format = prompt('Формат экспорта (введите "csv" или "json"):', 'csv');
  if (!format || (format !== 'csv' && format !== 'json')) {
    return;
  }
  
  // Get filtered data
  let filteredData = db;
  
  if (selMgrs && selMgrs.length > 0) {
    filteredData = filteredData.filter(item => selMgrs.includes(getRecMgr(item)));
  }
  
  if (selProjs && selProjs.length > 0) {
    filteredData = filteredData.filter(item => selProjs.includes(String(item["Проект"])));
  }
  
  if (format === 'csv') {
    exportToCSV(filteredData);
  } else {
    exportToJSON(filteredData);
  }
}

function exportToCSV(data) {
  const headers = ['Дата', 'Менеджер', 'Проект', 'Сумма', 'Заработок', 'Комментарий'];
  const csvContent = [
    headers.join(','),
    ...data.map(item => [
      item["Дата"] || '',
      getRecMgr(item) || '',
      `"${String(item["Проект"] || '').replace(/"/g, '""')}"`,
      item["Сумма"] || 0,
      item["Заработок"] || 0,
      `"${String(item["Комментарий"] || '').replace(/"/g, '""')}"`
    ].join(','))
  ].join('\n');
  
  // Add BOM for proper UTF-8 encoding
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  
  const today = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `export_${today}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportToJSON(data) {
  const exportData = {
    exportDate: new Date().toISOString(),
    filters: {
      managers: selMgrs,
      projects: selProjs,
      month: document.getElementById('filterMonth')?.value,
      allTime: viewAllTime
    },
    data: data.map(item => ({
      date: item["Дата"],
      manager: getRecMgr(item),
      project: item["Проект"],
      amount: parseFloat(item["Сумма"]) || 0,
      earnings: parseFloat(item["Заработок"]) || 0,
      comment: item["Комментарий"]
    })),
    summary: {
      totalRecords: data.length,
      totalAmount: data.reduce((sum, item) => sum + (parseFloat(item["Сумма"]) || 0), 0),
      totalEarnings: data.reduce((sum, item) => sum + (parseFloat(item["Заработок"]) || 0), 0),
      averageAmount: data.length > 0 ? data.reduce((sum, item) => sum + (parseFloat(item["Сумма"]) || 0), 0) / data.length : 0
    }
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  
  const today = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `export_${today}.json`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function printReport() {
  const s = getSess();
  if (!s) return;
  
  // Create print-friendly HTML
  const printHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Отчет по доходам</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .summary { margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-radius: 5px; }
        .summary-item { display: inline-block; margin-right: 30px; }
      </style>
    </head>
    <body>
      <h1>Отчет по доходам</h1>
      <p>Дата: ${new Date().toLocaleDateString('ru-RU')}</p>
      
      <div class="summary">
        <div class="summary-item"><strong>Всего записей:</strong> ${db.length}</div>
        <div class="summary-item"><strong>Общая сумма:</strong> ${fmt(db.reduce((sum, item) => sum + (parseFloat(item["Сумма"]) || 0), 0))} ₴</div>
        <div class="summary-item"><strong>Общий заработок:</strong> ${fmt(db.reduce((sum, item) => sum + (parseFloat(item["Заработок"]) || 0), 0))} ₴</div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Дата</th>
            <th>Менеджер</th>
            <th>Проект</th>
            <th>Сумма</th>
            <th>Заработок</th>
          </tr>
        </thead>
        <tbody>
          ${db.map(item => `
            <tr>
              <td>${item["Дата"] || ''}</td>
              <td>${getRecMgr(item) || ''}</td>
              <td>${item["Проект"] || ''}</td>
              <td>${fmt(parseFloat(item["Сумма"]) || 0)} ₴</td>
              <td>${fmt(parseFloat(item["Заработок"]) || 0)} ₴</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(printHTML);
  printWindow.document.close();
  printWindow.print();
  printWindow.close();
}

// Goals & Achievements System
function updateGoalsProgress() {
  const s = getSess();
  if (!s) return;
  
  const today = new Date();
  const todayStr = ym(today);
  const monthFilter = document.getElementById('filterMonth')?.value;
  const isAllTime = viewAllTime;
  
  // Calculate today's payments (for daily goal)
  const todayPayments = db
    .filter(item => ym(item["Дата"]) === todayStr)
    .length;
  
  // Calculate today's earnings
  const todayEarnings = db
    .filter(item => ym(item["Дата"]) === todayStr)
    .reduce((sum, item) => sum + (parseFloat(item["Заработок"]) || 0), 0);
  
  // Calculate period earnings
  let periodEarnings = 0;
  if (!isAllTime && monthFilter) {
    periodEarnings = db
      .filter(item => ym(item["Дата"]) === monthFilter)
      .reduce((sum, item) => sum + (parseFloat(item["Заработок"]) || 0), 0);
  } else {
    // For all time, use current month
    periodEarnings = db
      .filter(item => ym(item["Дата"]) === todayStr)
      .reduce((sum, item) => sum + (parseFloat(item["Заработок"]) || 0), 0);
  }
  
  // Get goals from config
  const cfg = getCfg();
  const dailyGoal = cfg.goalDaily || 2;
  const monthlyGoal = cfg.goalMoney || 60000;
  
  // Update daily goal (payments count)
  const dailyProgress = Math.min((todayPayments / dailyGoal) * 100, 100);
  document.getElementById('dailyGoalFill').style.width = dailyProgress + '%';
  document.getElementById('dailyGoalText').textContent = `${todayPayments} / ${dailyGoal} оплат`;
  
  // Update monthly goal (earnings)
  const monthlyProgress = Math.min((periodEarnings / monthlyGoal) * 100, 100);
  document.getElementById('monthlyGoalFill').style.width = monthlyProgress + '%';
  document.getElementById('monthlyGoalText').textContent = `${fmt(periodEarnings)} / ${fmt(monthlyGoal)} ₴`;
  
  // Check for achievements
  checkAchievements();
}

function getCfg() {
  const s = getSess();
  const id = s ? s.id : '_default';
  const stored = localStorage.getItem(getCfgKey(id));
  return stored ? JSON.parse(stored) : { goalMoney: 60000, goalDaily: 2 };
}

function showGoalSettings() {
  const goals = JSON.parse(localStorage.getItem('goals') || '{}');
  
  const dailyGoal = prompt('Дневная цель (₴):', goals.daily || 1000);
  if (dailyGoal && !isNaN(dailyGoal)) {
    goals.daily = parseFloat(dailyGoal);
  }
  
  const monthlyGoal = prompt('Месячная цель (₴):', goals.monthly || 30000);
  if (monthlyGoal && !isNaN(monthlyGoal)) {
    goals.monthly = parseFloat(monthlyGoal);
  }
  
  localStorage.setItem('goals', JSON.stringify(goals));
  updateGoalsProgress();
}

function showAchievements() {
  const container = document.getElementById('achievementsContainer');
  const achievementsList = document.getElementById('achievementsList');
  
  container.style.display = container.style.display === 'none' ? 'block' : 'none';
  
  if (container.style.display === 'block') {
    renderAchievements();
  }
}

function renderAchievements() {
  const achievementsList = document.getElementById('achievementsList');
  const achievements = getAchievements();
  
  achievementsList.innerHTML = achievements.map(achievement => `
    <div class="achievement ${achievement.unlocked ? 'unlocked' : ''}">
      <div class="achievement-icon">${achievement.icon}</div>
      <div class="achievement-info">
        <div class="achievement-name">${achievement.name}</div>
        <div class="achievement-desc">${achievement.description}</div>
        ${achievement.unlocked && achievement.date ? `<div class="achievement-date">${new Date(achievement.date).toLocaleDateString('ru-RU')}</div>` : ''}
      </div>
    </div>
  `).join('');
}

function getAchievements() {
  const savedAchievements = JSON.parse(localStorage.getItem('achievements') || '{}');
  const cfg = getCfg();
  const dailyGoal = cfg.goalDaily || 2;
  const monthlyGoal = cfg.goalMoney || 60000;
  
  const allAchievements = [
    {
      id: 'first_payment',
      name: 'Начало пути',
      description: 'Получите первую оплату',
      icon: '🎯',
      check: () => db.length > 0
    },
    {
      id: 'daily_goal',
      name: 'Дневная цель',
      description: `Выполните дневной план (${dailyGoal} оплат)`,
      icon: '📈',
      check: () => {
        const today = new Date();
        const todayStr = ym(today);
        const todayPayments = db.filter(item => ym(item["Дата"]) === todayStr).length;
        return todayPayments >= dailyGoal;
      }
    },
    {
      id: 'daily_earn',
      name: 'Хороший день',
      description: 'Заработайте 500+ ₴ за день',
      icon: '💰',
      check: () => {
        const dailyStats = {};
        db.forEach(item => {
          const day = item["Дата"];
          dailyStats[day] = (dailyStats[day] || 0) + (parseFloat(item["Заработок"]) || 0);
        });
        return Object.values(dailyStats).some(earn => earn >= 500);
      }
    },
    {
      id: 'monthly_goal',
      name: 'Месячный план',
      description: `Выполните месячный план (${monthlyGoal} ₴)`,
      icon: '🏆',
      check: () => {
        const monthlyStats = {};
        db.forEach(item => {
          const month = ym(item["Дата"]);
          monthlyStats[month] = (monthlyStats[month] || 0) + (parseFloat(item["Заработок"]) || 0);
        });
        return Object.values(monthlyStats).some(earn => earn >= monthlyGoal);
      }
    },
    {
      id: 'streak_3',
      name: 'Три дня подряд',
      description: 'Получайте оплаты 3 дня подряд',
      icon: '🔥',
      check: () => {
        const days = new Set();
        db.forEach(item => days.add(item["Дата"]));
        return days.size >= 3;
      }
    },
    {
      id: 'projects_3',
      name: 'Разнообразие',
      description: 'Работайте с 3+ проектами',
      icon: '📊',
      check: () => {
        const projects = new Set();
        db.forEach(item => {
          const proj = String(item["Проект"]);
          if (!proj.startsWith("Выплата") && !proj.startsWith("Ожидание")) {
            projects.add(proj);
          }
        });
        return projects.size >= 3;
      }
    },
    {
      id: 'total_10k',
      name: 'Стабильность',
      description: 'Общий заработок 10000+ ₴',
      icon: '💎',
      check: () => {
        const total = db.reduce((sum, item) => sum + (parseFloat(item["Заработок"]) || 0), 0);
        return total >= 10000;
      }
    }
  ];
  
  return allAchievements.map(achievement => {
    if (!savedAchievements[achievement.id] && achievement.check()) {
      savedAchievements[achievement.id] = { unlocked: true, date: Date.now() };
      localStorage.setItem('achievements', JSON.stringify(savedAchievements));
    }
    
    return {
      ...achievement,
      unlocked: savedAchievements[achievement.id]?.unlocked || false,
      date: savedAchievements[achievement.id]?.date
    };
  });
}

function checkAchievements() {
  const achievements = getAchievements();
  const newAchievements = achievements.filter(a => a.unlocked && !localStorage.getItem('achievement_' + a.id + '_shown'));
  
  newAchievements.forEach(achievement => {
    localStorage.setItem('achievement_' + a.id + '_shown', 'true');
    // Could show notification here
    console.log('New achievement unlocked:', achievement.name);
  });
}

function toggleAdditionalCharts() {
  const container = document.getElementById('additionalChartsContainer');
  const isVisible = container.style.display !== 'none';
  
  container.style.display = isVisible ? 'none' : 'block';
  
  // If showing, automatically show project chart
  if (!isVisible) {
    showProjectChart();
  }
}

function showDayDetails(data) {
  const modal = document.getElementById('dayDetailsModal');
  const title = document.getElementById('dayDetailsTitle');
  const content = document.getElementById('dayDetailsContent');
  
  // Set title based on data type
  const isMonth = data.label.includes(' ') && !data.label.includes(' число');
  title.textContent = isMonth ? `📊 Детали за ${data.label}` : `📊 Детали за ${data.label} число`;
  
  // Build content HTML
  let html = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px">
      <div class="stat-item" style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2)">
        <span>Оплат</span>
        <b>${data.count}</b>
      </div>
      <div class="stat-item" style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2)">
        <span>Заработок</span>
        <b>${fmt(data.totalEarn)} ₴</b>
      </div>
    </div>
  `;
  
  if (data.details.length > 0) {
    html += '<h3 style="margin:15px 0 10px;font-size:14px;color:var(--accent)">Последние оплаты:</h3>';
    html += '<div style="max-height:300px;overflow-y:auto">';
    data.details.forEach(detail => {
      html += `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px;margin-bottom:5px;background:rgba(255,255,255,0.02);border-radius:6px">
          <div>
            <div style="font-weight:600;color:var(--text)">${esc(detail.project)}</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.5)">Сумма: ${fmt(detail.amount)} ₴</div>
          </div>
          <div style="font-weight:700;color:var(--success)">${fmt(detail.earn)} ₴</div>
        </div>
      `;
    });
    html += '</div>';
  } else {
    html += '<div style="text-align:center;padding:20px;color:rgba(255,255,255,0.4)">Нет оплат за этот период</div>';
  }
  
  content.innerHTML = html;
  modal.style.display = 'flex';
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
  
  // Also include all months in the selected range, even if no data exists
  if(!adAllTime){
    const from=document.getElementById('adFrom').value;
    const to=document.getElementById('adTo').value;
    if(from && to){
      const fromDate = new Date(from + '-01');
      const toDate = new Date(to + '-01');
      const currentDate = new Date(fromDate);
      
      while(currentDate <= toDate){
        const monthStr = ym(currentDate);
        moSet.add(monthStr);
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }
  }
  
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
    const potentialVal = parseFloat(i["Заработок"])||0;
    kpiEarn += potentialVal;
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
              const potentialVal = parseFloat(i["Заработок"])||0;
              sum+=potentialVal;
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
    
    // If no specific projects are selected (all projects), show total earnings as single line
    if (!projFilter || !projFilter.length) {
      const totalData = months.map(mo => {
        let totalSum = 0;
        let totalCnt = 0;
        effectiveMgrs.forEach(mid => {
          const effectiveProjs = getMgrProjects(mid);
          effectiveProjs.forEach(proj => {
            db.forEach(i => {
              if (ym(i["Дата"]) === mo && String(i["Проект"]) === proj && getRecMgr(i) === mid && inAdPeriod(i["Дата"])) {
                const potentialVal = parseFloat(i["Заработок"]) || 0;
                totalSum += potentialVal;
                totalCnt++;
              }
            });
          });
        });
        totalCountsByMonth[mo] = (totalCountsByMonth[mo] || 0) + totalCnt;
        return Math.round(totalSum);
      });
      
      const col = COLORS[0];
      const lbl = multiMgr ? 'Всего заработано — Все проекты' : 'Всего заработано';
      datasets.push({ label: lbl, data: totalData, borderColor: col, backgroundColor: col + '18', borderWidth: 2, fill: true, tension: .3, pointRadius: 3 });
    } else {
      // Show individual project lines when specific projects are selected
      effectiveMgrs.forEach(mid => {
        const mName = mid === 'vlad' ? 'Влад' : (acc.managers.find(m => m.id === mid)?.name || mid);
        const effectiveProjs = projFilter;
        effectiveProjs.forEach(proj => {
          const data = months.map(mo => {
            let sum = 0;
            let cnt = 0;
            db.forEach(i => {
              if (ym(i["Дата"]) === mo && String(i["Проект"]) === proj && getRecMgr(i) === mid && inAdPeriod(i["Дата"])) {
                const potentialVal = parseFloat(i["Заработок"]) || 0;
                sum += potentialVal;
                cnt++;
              }
            });
            totalCountsByMonth[mo] = (totalCountsByMonth[mo] || 0) + cnt;
            return Math.round(sum);
          });
          const col = COLORS[ci % COLORS.length]; ci++;
          const lbl = multiMgr ? `${mName} — ${proj}` : proj;
          datasets.push({ label: lbl, data, borderColor: col, backgroundColor: col + '18', borderWidth: 2, fill: false, tension: .3, pointRadius: 3 });
        });
      });
    }
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
            const potentialVal = parseFloat(i["Заработок"])||0;
            sum+=potentialVal; cnt++;
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
    const potentialVal = parseFloat(i["Заработок"])||0;
    scores[mid].earn+=potentialVal;
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
  const amount=isPlus?Math.abs(val):-Math.abs(val);
  const entry={id:"PAY_"+Date.now(),date:new Date().toISOString().split('T')[0],amount:0,project:proj,earnings:amount,comment:isPlus?"Пополнение":"Выплата",manager:mgrId,action:'ADD'};
  db.push({"ID":entry.id,"Дата":entry.date,"Сумма":0,"Проект":proj,"Заработок":amount,"Комментарий":entry.comment,"Manager":mgrId});
  localStorage.setItem(DB_KEY,JSON.stringify(db));render();
  // Invalidate cache to prevent overwriting new data with old cached data
  Cache.clear();
  Queue.add(entry);
  // Don't call sync() immediately - let Queue handle it in background
  document.getElementById(inputId).value='';
}

async function delE(id){
  if(!confirm("Удалить запись?"))return;
  const sId=String(id).replace(/'/g,"").trim();
  deletedIds.add(sId);
  db=db.filter(i=>String(i.ID).replace(/'/g,"").trim()!==sId);
  localStorage.setItem(DB_KEY,JSON.stringify(db));render();
  // Invalidate cache to prevent overwriting with old cached data
  Cache.clear();
  Queue.add({action:'DELETE',id:sId});
  // Don't call sync() immediately - let Queue handle it in background
}

function cancelEdit(){
  // Clear form
  document.getElementById('fId').value='';
  document.getElementById('fDate').value=new Date().toISOString().split('T')[0];
  document.getElementById('fAmount').value='';
  document.getElementById('fActualAmount').value='';
  document.getElementById('fProject').selectedIndex=0; // Select first project option
  document.getElementById('fComment').value='';

  // Reset button label to original state
  document.getElementById('btnLabel').innerText='ЗАФИКСИРОВАТЬ';

  // Clear any error messages
  document.getElementById('err').innerText='';
}

function editE(id){
  const item=db.find(i=>String(i.ID)===String(id));if(!item)return;
  document.getElementById('fId').value=item.ID;
  const dateStr = item["Дата"];
  // Handle Google Sheets date format - convert to proper format without timezone shift
  if (dateStr) {
    if (typeof dateStr === 'object' && dateStr.getFullYear) {
      // It's a Date object from Google Sheets - get date components in local timezone
      const year = dateStr.getFullYear();
      const month = String(dateStr.getMonth() + 1).padStart(2, '0');
      const day = String(dateStr.getDate()).padStart(2, '0');
      document.getElementById('fDate').value = `${year}-${month}-${day}`;
    } else if (dateStr.includes('T')) {
      // It's an ISO string - extract date part directly to avoid timezone conversion
      if (dateStr.includes('Z')) {
        // UTC format like "2026-04-24T22:00:00.000Z"
        const datePart = dateStr.split('T')[0];
        document.getElementById('fDate').value = datePart;
      } else {
        // Local ISO format - extract date part directly to avoid timezone conversion
        const datePart = dateStr.split('T')[0];
        document.getElementById('fDate').value = datePart;
      }
    } else {
      // It's already a string in YYYY-MM-DD format
      document.getElementById('fDate').value = dateStr;
    }
  }
  document.getElementById('fAmount').value=item["Сумма"];
  document.getElementById('fActualAmount').value=item["ФактСумма"]||'';
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
  const amount=parseFloat(document.getElementById('fAmount').value)||0;
  const actualAmount=parseFloat(document.getElementById('fActualAmount').value)||0;
  // If actual amount is greater than potential, calculate earnings from actual amount
  const maxAmount = Math.max(amount, actualAmount);
  const potentialEarnings=(maxAmount*0.06).toFixed(0);
  const actualEarnings=actualAmount>0?(actualAmount*0.06).toFixed(0):potentialEarnings;
  const formDate = document.getElementById('fDate').value;
  const entry={
    id,
    date: formDate, // Always use current form date
    amount:amount,
    actualAmount:actualAmount,
    project:document.getElementById('fProject').value,
    earnings:potentialEarnings,
    actualEarnings:actualEarnings,
    comment:document.getElementById('fComment').value,
    manager:mgrId,
    action:document.getElementById('fId').value?'EDIT':'ADD'
  };
  if(entry.action==='EDIT'){
    const originalRecord = db.find(i=>String(i.ID)===String(id));
    if(originalRecord){
      for(let j = 1; j <= 10; j++){
        entry[`Доплата${j}`] = originalRecord[`Доплата${j}`] || '';
        entry[`Доплата_Дата${j}`] = originalRecord[`Доплата_Дата${j}`] || '';
      }
    }
    db=db.filter(i=>String(i.ID)!==String(id));
  }
  
  db.push({"ID":entry.id,"Дата":entry.date,"Сумма":entry.amount,"ФактСумма":entry.actualAmount,"Проект":entry.project,"Заработок":entry.earnings,"ФактЗаработок":entry.actualEarnings,"Комментарий":entry.comment,"Manager":mgrId});
  
  // Add all doplata columns from the original record if editing
  if(entry.action==='EDIT'){
    for(let j = 1; j <= 10; j++){
      db[db.length-1][`Доплата${j}`] = entry[`Доплата${j}`] || '';
      db[db.length-1][`Доплата_Дата${j}`] = entry[`Доплата_Дата${j}`] || '';
    }
  }
  
  localStorage.setItem(DB_KEY,JSON.stringify(db));render();
  // Invalidate cache to prevent overwriting new data with old cached data
  Cache.clear();
  Queue.add(entry);
  // Don't call sync() immediately - let Queue handle it in background
  // sync() will be called periodically or manually via refresh button
  e.target.reset();document.getElementById('fId').value='';document.getElementById('btnLabel').innerText="ЗАФИКСИРОВАТЬ";
  document.getElementById('fDate').value=new Date().toISOString().split('T')[0];
};

// ============================================================
//  SEARCH & PAYMENT FUNCTIONS
// ============================================================
// Debounced filterTable to prevent excessive calls
const debouncedFilterTable = Performance.debounce(function() {
  filterTable();
}, 300);

function handlePasteSearch(event) {
  // Use setTimeout to ensure the pasted content is in the input before filtering
  setTimeout(() => {
    filterTable();
  }, 10);
}

function filterTable(){
  const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
  
  if (!searchTerm) {
    // If search is empty, render normally with current filters
    render();
    return;
  }
  
  const s=getSess();
  if(!s) return;
  
  // Get current filters
  let mgrFilter=null;
  if(s.role==='manager')mgrFilter=[s.id];
  else if(s.role==='guest'&&s.viewMgrId)mgrFilter=[s.viewMgrId];
  else if(s.role==='admin'&&selMgrs.length>0)mgrFilter=selMgrs;
  
  let projFilter=null;
  if(s.role==='admin'&&selProjs.length>0)projFilter=selProjs;
  
  // Filter all records for search (ignore time period filter)
  const tbody=document.getElementById('tableBody');
  tbody.innerHTML='';
  db.filter(i=>{
const proj=String(i["Проект"]); // Было пусто
const recMgr=getRecMgr(i);
const mgrOk=!mgrFilter||mgrFilter.includes(recMgr);
const prOk=!projFilter||projFilter.includes(proj);
const isPay=proj.startsWith("Выплата")||proj.startsWith("Ожидание"); // Было на английском
const comment = String(i["Комментарий"]||'').toLowerCase(); // Было на английском
    
    // Search in comment field only
    const searchMatch = comment.includes(searchTerm);
    
    return mgrOk&&prOk&&!isPay&&searchMatch;
  }).sort((a,b)=>{
    // Sort by date string directly to avoid timezone issues
    const dateA = a["Дата"];
const dateB = b["Дата"];
return dateB.localeCompare(dateA);
}).forEach(i=>{
// Render matching rows (same rendering logic as in render function)
const dateStr = String(i["Дата"]);
let ds = dateStr;
if (dateStr.includes('T')) {
  const datePart = dateStr.split('T')[0];
  const [year, month, day] = datePart.split('-');
  ds = pad(parseInt(day)) + '.' + pad(parseInt(month));
} else if (dateStr.includes('-')) {
  const [year, month, day] = dateStr.split('-');
  ds = pad(parseInt(day)) + '.' + pad(parseInt(month));
}
const recMgr=getRecMgr(i);
const mgrName=recMgr==='vlad'?'Влад':(acc.managers.find(m=>m.id===recMgr)?.name||recMgr);
const canEdit=s.role==='admin'||(s.role==='manager'&&recMgr===s.id);
const actualAmount = i["ФактСумма"] !== undefined && i["ФактСумма"] !== null && i["ФактСумма"] !== "" ? parseFloat(i["ФактСумма"]) : null;
const actualEarn = i["ФактЗаработок"] !== undefined && i["ФактЗаработок"] !== null && i["ФактЗаработок"] !== "" ? parseFloat(i["ФактЗаработок"]) : null;
    const showActual = actualEarn !== null;
    const showActualAmount = actualAmount !== null;

    tbody.innerHTML+=`<tr>
      <td style="font-weight:900">${ds}</td>
      <td style="font-size:11px;opacity:.65">${esc(mgrName)}</td>
      <td>${esc(i["Проект"])}</td>
<td style="color:#fff;font-weight:900">${fmt(i["Сумма"])} &#8372;</td>
<td style="color:var(--success);font-weight:900">${fmt(i["Заработок"])} &#8372;</td>
      <td style="color:${showActualAmount?'#fff':'rgba(255,255,255,.3)'};font-weight:900">${showActualAmount ? fmt(actualAmount) + ' &#8372;' : ''}</td>
      <td style="color:${showActual?'var(--success)':'rgba(255,255,255,.3)'};font-weight:900">${showActual ? fmt(actualEarn) + ' &#8372;' : ''}</td>
      <td style="opacity:.45;font-size:11px">${esc(i["Комментарий"]||'')}</td>
      <td style="text-align:right">${canEdit?`<div class="action-buttons"><button class="bt add" onclick="showPaymentHistory(decodeURIComponent('${encodeURIComponent(i.ID)}'))" title="">+</button><button class="bt edit" onclick="editE(decodeURIComponent('${encodeURIComponent(i.ID)}'))">&#9998;</button><button class="bt delete" onclick="delE(decodeURIComponent('${encodeURIComponent(i.ID)}'))">&#128465;</button></div>`:''}</td>
    </tr>`;
  });
}

function clearSearch(){
  document.getElementById('searchInput').value = '';
  filterTable();
}

function addPayment(id){
  const item = db.find(i => String(i.ID) === String(id));
  if(!item) return;
  
  const additionalAmount = prompt(`Добавить доплату для записи:\nПроект: ${item["Проект"]}\nСумма: ${item["Сумма"]} ₴\n\nВведите сумму доплаты:`);
  if(!additionalAmount || parseFloat(additionalAmount) <= 0) return;
  
  // Find the next empty payment column
  let paymentColumn = null;
  let paymentDateColumn = null;
  for(let j = 1; j <= 10; j++) {
    if(!item[`Доплата${j}`] || item[`Доплата${j}`] === '' || item[`Доплата${j}`] === null || parseFloat(item[`Доплата${j}`]) === 0) {
      paymentColumn = `Доплата${j}`;
      paymentDateColumn = `Доплата_Дата${j}`;
      break;
    }
  }
  
  if(!paymentColumn) {
    alert('Все колонки доплат заполнены! Максимально 10 доплат.');
    return;
  }
  
  // Update record with new payment
  const currentDate = new Date().toISOString().split('T')[0];
  const updatedItem = {
    ...item,
    [paymentColumn]: parseFloat(additionalAmount),
    [paymentDateColumn]: currentDate
  };
  
  // Update actual amounts (sum of all payments)
  let totalActualAmount = parseFloat(item["Сумма"]) || 0;
  for(let j = 1; j <= 10; j++) {
    if(item[`Доплата${j}`] && item[`Доплата${j}`] !== '') {
      totalActualAmount += parseFloat(item[`Доплата${j}`]);
    }
  }
  totalActualAmount += parseFloat(additionalAmount);
  
  const newActualEarnings = totalActualAmount * 0.06;
  updatedItem["ФактСумма"] = totalActualAmount;
  updatedItem["ФактЗаработок"] = newActualEarnings.toFixed(0);
  
  // Recalculate potential earnings if actual amount is greater than original
  const originalAmount = parseFloat(item["Сумма"]) || 0;
  const maxAmount = Math.max(originalAmount, totalActualAmount);
  const newPotentialEarnings = Math.round(maxAmount * 0.06);
  updatedItem["Заработок"] = newPotentialEarnings.toFixed(0);
  
  // Update in database
  const index = db.findIndex(i => String(i.ID) === String(id));
  if(index !== -1){
    db[index] = updatedItem;
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    
    // Send to Google Sheet
    const entry = {
      action: 'EDIT',
      id: item.ID,
      date: item["Дата"],
      amount: item["Сумма"],
      actualAmount: totalActualAmount,
      project: item["Проект"],
      earnings: item["Заработок"],
      actualEarnings: newActualEarnings.toFixed(0),
      comment: item["Комментарий"] || '', // Keep original comment without payment info
      manager: item["Manager"]
    };
    
    // Add payment columns to entry
    for(let j = 1; j <= 10; j++) {
      entry[`Доплата${j}`] = updatedItem[`Доплата${j}`] || '';
      entry[`Доплата_Дата${j}`] = updatedItem[`Доплата_Дата${j}`] || '';
    }
    
    Queue.add(entry);
    // Update immediately, sync in background
    render();
    sync();
  }
}

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
