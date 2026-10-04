/* Lưu trữ cục bộ (localStorage): nhân viên, lịch sử chấm công, cài đặt. */
const Store = (() => {
  const K = { emp: 'ct.employees', log: 'ct.logs', set: 'ct.settings', traffic: 'ct.traffic' };
  const DEFAULTS = {
    threshold: 0.5,       // khoảng cách Euclid tối đa để coi là cùng người
    mode: 'auto',         // 'auto' | 'manual'
    cooldownSec: 60,      // chống ghi trùng cho cùng một người
    minGapMin: 10,        // khoảng cách tối thiểu giữa Vào và Ra
    detector: 'tiny',     // 'tiny' | 'ssd'
    inputSize: 320,
    mirror: true,
    saveSnap: true,
    deviceId: '',
    confirmFrames: 5,
    showLandmarks: false,
    voice: true,          // robot chào bằng giọng nói
    voiceRate: 1.0,
    workStart: '08:30',   // giờ bắt đầu ca, để nhận biết đi muộn
    greetGuests: true,    // chào cả người lạ
  };

  function read(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { console.warn('store read', key, e); return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { console.error('store write', key, e); return false; }
  }

  let employees = read(K.emp, []);
  let logs = read(K.log, []);
  let settings = Object.assign({}, DEFAULTS, read(K.set, {}));
  let traffic = read(K.traffic, {}); // { 'YYYY-MM-DD': { total, staff, guests } }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  return {
    DEFAULTS,
    get employees() { return employees; },
    get logs() { return logs; },
    get settings() { return settings; },
    uid,

    addEmployee(e) { employees.push(e); return write(K.emp, employees); },
    updateEmployee(id, patch) {
      const e = employees.find(x => x.id === id); if (!e) return false;
      Object.assign(e, patch); return write(K.emp, employees);
    },
    removeEmployee(id) { employees = employees.filter(x => x.id !== id); return write(K.emp, employees); },
    findEmployee(id) { return employees.find(x => x.id === id) || null; },

    addLog(l) { logs.push(l); return write(K.log, logs); },
    removeLog(id) { logs = logs.filter(x => x.id !== id); return write(K.log, logs); },
    clearLogs() { logs = []; return write(K.log, logs); },

    traffic(dateKey) { return traffic[dateKey] || { total: 0, staff: 0, guests: 0 }; },
    addPass(dateKey, isStaff) {
      const t = traffic[dateKey] || (traffic[dateKey] = { total: 0, staff: 0, guests: 0 });
      t.total++; if (isStaff) t.staff++; else t.guests++;
      // chỉ giữ 60 ngày gần nhất
      const keys = Object.keys(traffic).sort();
      while (keys.length > 60) delete traffic[keys.shift()];
      return write(K.traffic, traffic);
    },

    saveSettings(patch) { Object.assign(settings, patch); return write(K.set, settings); },

    usageBytes() {
      let n = 0;
      for (const k of Object.values(K)) n += (localStorage.getItem(k) || '').length;
      return n * 2; // UTF-16
    },

    exportJSON() {
      return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), employees, logs, settings, traffic }, null, 0);
    },
    importJSON(text) {
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.employees) || !Array.isArray(data.logs)) throw new Error('Tệp không đúng định dạng');
      employees = data.employees; logs = data.logs;
      settings = Object.assign({}, DEFAULTS, data.settings || {});
      traffic = data.traffic || {};
      write(K.emp, employees); write(K.log, logs); write(K.set, settings); write(K.traffic, traffic);
    },
  };
})();
