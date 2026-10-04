/* Ứng dụng: camera tracking + chấm công + robot chào hỏi. */
(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const S = () => Store.settings;

  // ---------- Tiện ích ----------
  const pad = (n) => String(n).padStart(2, '0');
  const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fmtTime = (ts) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fmtTimeS = (ts) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
  const fmtDate = (ts) => { const d = new Date(ts); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
  const fmtHours = (ms) => { const h = Math.floor(ms / 36e5), m = Math.round((ms % 36e5) / 6e4); return `${h}g${pad(m)}`; };
  const initials = (name) => name.trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const avatarHTML = (emp, cls = 'avatar') => emp && emp.avatar
    ? `<img class="${cls}" src="${emp.avatar}" alt="">`
    : `<span class="${cls}">${esc(initials(emp ? emp.name : '?'))}</span>`;

  let toastTimer = 0;
  function toast(msg, ms = 2600) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }

  // ---------- Tabs ----------
  let activeTab = 'camera';
  $$('.tab').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  function switchTab(name) {
    activeTab = name;
    $$('.tab').forEach(b => b.classList.toggle('is-active', b.dataset.tab === name));
    $$('.panel').forEach(p => p.classList.toggle('is-active', p.id === 'tab-' + name));
    if (name === 'history') renderHistory();
    if (name === 'staff') renderStaff();
  }

  // ---------- Đồng hồ ----------
  const DAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  function tickClock() {
    const d = new Date();
    $('#clock-time').textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    $('#clock-date').textContent = `${DAYS[d.getDay()]}, ${fmtDate(d)}`;
  }
  tickClock(); setInterval(tickClock, 1000);

  // ---------- Camera ----------
  const video = $('#video');
  const overlay = $('#overlay');
  const octx = overlay.getContext('2d');
  let stream = null;
  let facing = 'user';
  let devices = [];

  async function listDevices() {
    try {
      devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
    } catch (e) { devices = []; }
    const sel = $('#set-device');
    sel.innerHTML = '<option value="">Mặc định</option>' + devices.map((d, i) =>
      `<option value="${esc(d.deviceId)}">${esc(d.label || 'Camera ' + (i + 1))}</option>`).join('');
    sel.value = S().deviceId || '';
  }

  async function startCamera() {
    stopCamera();
    const base = { width: { ideal: 960 }, height: { ideal: 720 } };
    const constraints = S().deviceId ? { deviceId: { exact: S().deviceId }, ...base } : { facingMode: facing, ...base };
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
    } catch (e) {
      if (S().deviceId) { Store.saveSettings({ deviceId: '' }); return startCamera(); }
      throw e;
    }
    video.srcObject = stream;
    await new Promise(res => { video.onloadedmetadata = () => { video.play().then(res, res); }; });
    overlay.width = video.videoWidth; overlay.height = video.videoHeight;
    $('#stage').style.aspectRatio = `${video.videoWidth}/${video.videoHeight}`;
    await listDevices();
  }
  function stopCamera() {
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  }
  function applyMirror() {
    $('#stage').classList.toggle('mirror', !!S().mirror);
    $('#tab-staff').classList.toggle('mirror', !!S().mirror);
  }

  $('#btn-flip').addEventListener('click', async () => {
    facing = facing === 'user' ? 'environment' : 'user';
    Store.saveSettings({ deviceId: '' });
    try { await startCamera(); } catch (e) { toast('Không đổi được camera'); }
  });
  $('#btn-fullscreen').addEventListener('click', () => {
    const el = $('#stage');
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen && el.requestFullscreen();
  });

  // ---------- Khởi động ----------
  const stageMsg = $('#stage-msg'), stageMsgText = $('#stage-msg-text');
  function showStageMsg(text, withStart = false) {
    stageMsg.hidden = false;
    stageMsgText.textContent = text;
    const old = stageMsg.querySelector('button'); if (old) old.remove();
    stageMsg.querySelector('.spinner').hidden = withStart;
    if (withStart) {
      const b = document.createElement('button'); b.className = 'btn btn-primary'; b.textContent = 'Bật camera';
      b.onclick = boot; stageMsg.querySelector('.msg-card').appendChild(b);
    }
  }

  let booting = false;
  async function boot() {
    if (booting) return; booting = true;
    try {
      showStageMsg('Đang xin quyền camera…');
      await startCamera();
      applyMirror();
      await FaceLib.load((s) => { showStageMsg(s); $('#model-status').textContent = s; });
      if (S().detector === 'ssd') { try { await FaceLib.ensureSsd(); } catch (e) { console.warn(e); } }
      $('#model-status').textContent = 'Sẵn sàng'; $('#model-status').className = 'badge badge-ok';
      stageMsg.hidden = true;
      Robot.say(pickPhrase('boot'), true);
      loop();
    } catch (e) {
      console.error(e);
      $('#model-status').textContent = 'Lỗi'; $('#model-status').className = 'badge badge-danger';
      const msg = (e && e.name === 'NotAllowedError') ? 'Bạn chưa cho phép dùng camera. Cấp quyền rồi bấm Bật camera.'
        : (location.protocol === 'file:') ? 'Trình duyệt chặn camera khi mở file trực tiếp. Hãy chạy qua HTTPS hoặc localhost.'
        : 'Không khởi động được: ' + (e && e.message ? e.message : e);
      showStageMsg(msg, true);
    } finally { booting = false; }
  }

  // ---------- Vòng lặp nhận diện ----------
  const tracker = new FaceLib.Tracker();
  let fpsT = performance.now(), fpsN = 0, fps = 0;
  let detecting = false;
  let lastTracks = [];

  async function loop() {
    if (!stream) return;
    if (!detecting && video.readyState >= 2) {
      detecting = true;
      try {
        const results = await FaceLib.detectAll(video, S(), true);
        const now = performance.now();
        const before = new Set(tracker.tracks.map(t => t.id));
        const dets = results.map(r => ({ box: r.detection.box, det: r }));
        const tracks = tracker.update(dets, now);
        const after = new Set(tracks.map(t => t.id));
        // Track vừa biến mất => đếm 1 lượt qua cửa
        for (const t of lastTracks) {
          if (!after.has(t.id) && before.has(t.id) && t.frames >= S().confirmFrames) {
            Store.addPass(dateKey(), !!t.label); renderSide();
          }
        }
        for (const t of tracks) {
          if (!t.visible || !t.det || !t.det.descriptor) continue;
          const m = FaceLib.match(t.det.descriptor, Store.employees, S().threshold);
          tracker.vote(t, m.emp ? m.emp.id : null, m.dist, S().confirmFrames);
          if (t.confirmed) onConfirmed(t, now);
        }
        lastTracks = tracks;
        draw(tracks);
        Robot.track(tracks);
        fpsN++; if (now - fpsT > 1000) { fps = Math.round(fpsN * 1000 / (now - fpsT)); fpsN = 0; fpsT = now; $('#chip-fps').textContent = fps + ' fps'; }
        $('#chip-faces').textContent = `${tracks.filter(t => t.visible).length} khuôn mặt`;
      } catch (e) { console.warn('detect', e); }
      detecting = false;
    }
    requestAnimationFrame(loop);
  }

  function draw(tracks) {
    const W = overlay.width, H = overlay.height;
    octx.clearRect(0, 0, W, H);
    const mirror = !!S().mirror;
    for (const t of tracks) {
      if (!t.visible) continue;
      const b = t.box;
      const emp = t.label ? Store.findEmployee(t.label) : null;
      const color = emp ? '#12A150' : (t.confirmed ? '#E5484D' : '#0061FF');
      octx.lineWidth = Math.max(2, W / 320);
      octx.strokeStyle = color;
      roundRect(b.x, b.y, b.width, b.height, 10); octx.stroke();
      if (S().showLandmarks && t.det && t.det.landmarks) {
        octx.fillStyle = 'rgba(255,255,255,.85)';
        for (const p of t.det.landmarks.positions) { octx.beginPath(); octx.arc(p.x, p.y, Math.max(1.2, W / 640), 0, Math.PI * 2); octx.fill(); }
      }
      // nhãn (vẽ không bị lật gương)
      const label = emp ? emp.name : (t.confirmed ? 'Chưa đăng ký' : '…');
      const sub = emp && t.lastDist < 9 ? ` ${(1 - Math.min(1, t.lastDist)).toFixed(2)}` : '';
      const fs = Math.max(13, Math.round(W / 48));
      octx.font = `700 ${fs}px Manrope, system-ui, sans-serif`;
      const text = label + sub;
      const tw = octx.measureText(text).width + 16, th = fs + 12;
      const lx = b.x, ly = Math.max(0, b.y - th - 4);
      octx.save();
      if (mirror) { octx.translate(lx + tw, 0); octx.scale(-1, 1); octx.translate(-lx, 0); }
      octx.fillStyle = color;
      roundRect(lx, ly, tw, th, 8); octx.fill();
      octx.fillStyle = '#fff'; octx.textBaseline = 'middle';
      octx.fillText(text, lx + 8, ly + th / 2);
      octx.restore();
    }
  }
  function roundRect(x, y, w, h, r) {
    octx.beginPath();
    octx.moveTo(x + r, y); octx.arcTo(x + w, y, x + w, y + h, r); octx.arcTo(x + w, y + h, x, y + h, r);
    octx.arcTo(x, y + h, x, y, r); octx.arcTo(x, y, x + w, y, r); octx.closePath();
  }

  // ---------- Chấm công ----------
  let attendanceOn = true;
  $('#toggle-attendance').addEventListener('change', (e) => {
    attendanceOn = e.target.checked;
    toast(attendanceOn ? 'Đã bật chấm công' : 'Chỉ theo dõi, không ghi chấm công');
  });
  const lastGreetUnknown = new Map(); // trackId -> time

  function todayLogsOf(empId) {
    const k = dateKey();
    return Store.logs.filter(l => l.empId === empId && dateKey(new Date(l.ts)) === k).sort((a, b) => a.ts - b.ts);
  }

  function onConfirmed(t, now) {
    if (!t.label) {
      // người lạ: chào một lần mỗi track
      if (S().greetGuests && !lastGreetUnknown.has(t.id) && t.frames >= S().confirmFrames * 2) {
        lastGreetUnknown.set(t.id, now);
        showGreet(null, 'unknown', 'Mình chưa quen bạn. Bạn là khách phải không?');
        Robot.say(pickPhrase('unknown'));
      }
      return;
    }
    if (!attendanceOn || S().mode !== 'auto') return;
    if (now - t.loggedAt < 3000) return;
    const emp = Store.findEmployee(t.label); if (!emp) return;
    const res = recordAttendance(emp, null, t);
    t.loggedAt = now;
    if (res && res.skipped) { /* chỉ nhắc nhẹ, không spam */ }
  }

  /** Ghi 1 lượt chấm công. type = null => tự luân phiên. */
  function recordAttendance(emp, type, track) {
    const nowTs = Date.now();
    const todays = todayLogsOf(emp.id);
    const last = todays[todays.length - 1];
    if (last && nowTs - last.ts < S().cooldownSec * 1000) {
      if (!track || nowTs - (track.greetedAt || 0) > 8000) {
        if (track) track.greetedAt = nowTs;
        showGreet(emp, last.type, `Đã ghi nhận ${last.type === 'in' ? 'VÀO' : 'RA'} lúc ${fmtTime(last.ts)}`);
      }
      return { skipped: true };
    }
    if (!type) {
      if (!last) type = 'in';
      else if (nowTs - last.ts < S().minGapMin * 60000) {
        if (!track || nowTs - (track.greetedAt || 0) > 8000) {
          if (track) track.greetedAt = nowTs;
          showGreet(emp, last.type, `Đã ${last.type === 'in' ? 'vào' : 'ra'} lúc ${fmtTime(last.ts)}. Hẹn gặp lại sau ${S().minGapMin} phút.`);
        }
        return { skipped: true };
      }
      else type = last.type === 'in' ? 'out' : 'in';
    }
    const log = {
      id: Store.uid(), empId: emp.id, name: emp.name, code: emp.code || '', type, ts: nowTs,
      dist: track && isFinite(track.bestDist) ? Number(track.bestDist.toFixed(3)) : null,
      snap: S().saveSnap && track ? snapshot(track.box) : null,
    };
    if (!Store.addLog(log)) toast('Bộ nhớ trình duyệt đầy, không lưu được. Hãy xuất và xóa bớt lịch sử.');
    const late = type === 'in' && isLate(nowTs);
    showGreet(emp, type, `${type === 'in' ? 'Vào' : 'Ra'} lúc ${fmtTime(nowTs)}${late ? ' · hơi muộn rồi' : ''}`);
    Robot.say(pickPhrase(type === 'in' ? (late ? 'late' : 'in') : 'out', emp));
    beep(type);
    renderSide();
    if (activeTab === 'history') renderHistory();
    return { log };
  }

  function isLate(ts) {
    const [h, m] = (S().workStart || '08:30').split(':').map(Number);
    const d = new Date(ts);
    return d.getHours() * 60 + d.getMinutes() > h * 60 + m;
  }

  function snapshot(box) {
    try {
      const c = document.createElement('canvas'); c.width = 72; c.height = 72;
      const pad = box.width * 0.25;
      const sx = Math.max(0, box.x - pad), sy = Math.max(0, box.y - pad);
      const sw = Math.min(video.videoWidth - sx, box.width + pad * 2), sh = Math.min(video.videoHeight - sy, box.height + pad * 2);
      c.getContext('2d').drawImage(video, sx, sy, sw, sh, 0, 0, 72, 72);
      return c.toDataURL('image/jpeg', 0.6);
    } catch (e) { return null; }
  }

  // nút thủ công
  function largestConfirmed() {
    let best = null;
    for (const t of lastTracks) if (t.visible && t.confirmed && t.label) if (!best || t.box.area > best.box.area) best = t;
    return best;
  }
  $('#btn-manual-in').addEventListener('click', () => manual('in'));
  $('#btn-manual-out').addEventListener('click', () => manual('out'));
  function manual(type) {
    const t = largestConfirmed();
    if (!t) return toast('Chưa nhận ra ai trước camera');
    const emp = Store.findEmployee(t.label);
    recordAttendance(emp, type, t);
  }

  // ---------- Lời chào (hiển thị + giọng nói) ----------
  let greetTimer = 0;
  function showGreet(emp, kind, sub) {
    const g = $('#greet');
    g.className = 'greet ' + (kind || 'in');
    const av = $('#greet-avatar');
    if (emp && emp.avatar) { av.src = emp.avatar; av.hidden = false; } else { av.hidden = true; }
    $('#greet-name').textContent = emp ? `Xin chào, ${emp.name}` : 'Xin chào bạn mới!';
    $('#greet-sub').textContent = sub || '';
    g.hidden = false;
    clearTimeout(greetTimer); greetTimer = setTimeout(() => { g.hidden = true; }, 3500);
  }

  const PHRASES = {
    boot: ['Robot đã sẵn sàng, mời mọi người chấm công nhé!', 'Chào cả nhà, hôm nay mình trực cửa!'],
    morning: ['Chào buổi sáng {name}! Chúc một ngày thật nhiều năng lượng.', '{name} đến rồi! Cà phê chưa đó?', 'Sáng tươi như nắng, chào {name}!'],
    noon: ['Chào {name}, trưa rồi nhớ ăn uống đầy đủ nha.', '{name} ơi, buổi trưa vui vẻ!'],
    afternoon: ['Chào buổi chiều {name}! Cố lên, sắp hết ngày rồi.', '{name} xuất hiện là chiều bớt oi ngay.'],
    evening: ['Chào buổi tối {name}, hôm nay vất vả rồi.', '{name} ơi, tối rồi mà vẫn chăm chỉ ghê!'],
    late: ['{name} ơi, hôm nay hơi muộn chút xíu, nhưng có mặt là tốt rồi!', 'Chào {name}! Đến muộn tí thôi, bù lại làm thật năng suất nha.'],
    out: ['Tạm biệt {name}, về cẩn thận nhé!', '{name} về nha, mai gặp lại!', 'Hẹn gặp lại {name}, nghỉ ngơi cho khỏe nhé!'],
    unknown: ['Xin chào! Mình chưa quen bạn, bạn là khách phải không?', 'Chào bạn! Bạn cần gặp ai, để mình gọi giúp nhé?'],
  };
  function pickPhrase(kind, emp) {
    let key = kind;
    if (kind === 'in') {
      const h = new Date().getHours();
      key = h < 11 ? 'morning' : h < 13 ? 'noon' : h < 18 ? 'afternoon' : 'evening';
    }
    const list = PHRASES[key] || PHRASES.morning;
    const p = list[Math.floor(Math.random() * list.length)];
    return p.replace('{name}', emp ? shortName(emp.name) : 'bạn');
  }
  function shortName(name) { const parts = name.trim().split(/\s+/); return parts.length > 2 ? parts.slice(-2).join(' ') : name; }

  let audioCtx = null;
  function beep(type) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.frequency.value = type === 'in' ? 880 : 587; g.gain.value = 0.08;
      o.start(); o.frequency.exponentialRampToValueAtTime(type === 'in' ? 1320 : 440, audioCtx.currentTime + 0.12);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25); o.stop(audioCtx.currentTime + 0.26);
    } catch (e) { /* bỏ qua */ }
  }

  // ---------- Robot: mặt hoạt hình + giọng nói ----------
  const Robot = (() => {
    const el = document.createElement('div');
    el.className = 'robot';
    el.innerHTML = `
      <svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden="true">
        <rect x="8" y="14" width="104" height="92" rx="26" fill="#0061FF"/>
        <rect x="18" y="26" width="84" height="68" rx="18" fill="#0A1230"/>
        <g class="eye" id="rb-eye-l"><circle cx="43" cy="56" r="11" fill="#fff"/><circle class="pupil" cx="43" cy="56" r="5" fill="#0A1230"/></g>
        <g class="eye" id="rb-eye-r"><circle cx="77" cy="56" r="11" fill="#fff"/><circle class="pupil" cx="77" cy="56" r="5" fill="#0A1230"/></g>
        <path id="rb-mouth" d="M46 78 Q60 86 74 78" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/>
        <rect x="54" y="4" width="12" height="14" rx="4" fill="#0061FF"/><circle cx="60" cy="4" r="5" fill="#FFB020"/>
      </svg>`;
    $('#stage').appendChild(el);
    const pupils = el.querySelectorAll('.pupil');
    const eyes = el.querySelectorAll('.eye');
    const mouth = el.querySelector('#rb-mouth');
    let tx = 0, ty = 0, cx = 0, cy = 0, mood = 'idle', moodUntil = 0;

    function track(tracks) {
      let best = null;
      for (const t of tracks) if (t.visible && (!best || t.box.area > best.box.area)) best = t;
      if (best) {
        const nx = (best.box.x + best.box.width / 2) / overlay.width - 0.5;
        const ny = (best.box.y + best.box.height / 2) / overlay.height - 0.5;
        tx = (S().mirror ? -nx : nx) * 8; ty = ny * 6;
        if (performance.now() > moodUntil) setMood(best.label ? 'happy' : (best.confirmed ? 'curious' : 'idle'), 600);
      } else { tx = 0; ty = 0; if (performance.now() > moodUntil) setMood('idle', 0); }
    }
    function setMood(m, ms) {
      mood = m; moodUntil = performance.now() + ms;
      mouth.setAttribute('d', m === 'happy' ? 'M44 76 Q60 92 76 76' : m === 'curious' ? 'M50 80 Q60 80 70 80' : m === 'talk' ? 'M48 78 Q60 90 72 78 Q60 84 48 78' : 'M46 78 Q60 86 74 78');
    }
    function anim() {
      cx += (tx - cx) * 0.15; cy += (ty - cy) * 0.15;
      pupils.forEach(p => p.setAttribute('transform', `translate(${cx.toFixed(2)} ${cy.toFixed(2)})`));
      requestAnimationFrame(anim);
    }
    anim();
    (function blink() {
      eyes.forEach(e => e.setAttribute('transform', 'translate(0 56) scale(1 0.1) translate(0 -56)'));
      setTimeout(() => eyes.forEach(e => e.removeAttribute('transform')), 120);
      setTimeout(blink, 2500 + Math.random() * 3000);
    })();

    let voice = null;
    function pickVoice() {
      const vs = speechSynthesis.getVoices();
      voice = vs.find(v => /^vi/i.test(v.lang) && /google/i.test(v.name)) || vs.find(v => /^vi/i.test(v.lang)) || null;
    }
    if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
    let lastSpoke = 0;
    function say(text, force = false) {
      if (!S().voice || !('speechSynthesis' in window)) return;
      const now = Date.now();
      if (!force && now - lastSpoke < 1500) return;
      lastSpoke = now;
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'vi-VN'; if (voice) u.voice = voice; u.rate = Number(S().voiceRate) || 1;
        u.onstart = () => setMood('talk', 10000); u.onend = () => setMood('happy', 800);
        speechSynthesis.speak(u);
      } catch (e) { /* bỏ qua */ }
    }
    return { track, say, setMood };
  })();

  // ---------- Bảng bên: đang có mặt + hôm nay + lượt qua cửa ----------
  function renderSide() {
    const k = dateKey();
    const todays = Store.logs.filter(l => dateKey(new Date(l.ts)) === k).sort((a, b) => b.ts - a.ts);
    const lastByEmp = new Map();
    for (const l of todays) if (!lastByEmp.has(l.empId)) lastByEmp.set(l.empId, l);
    const present = [...lastByEmp.values()].filter(l => l.type === 'in');
    $('#present-count').textContent = present.length;
    $('#present-list').innerHTML = present.length ? present.map(l => {
      const emp = Store.findEmployee(l.empId) || { name: l.name };
      return `<li class="person">${avatarHTML(emp)}<div class="person-main"><div class="person-name">${esc(emp.name)}</div><div class="person-sub">${esc(emp.dept || emp.code || '')}</div></div><span class="time">${fmtTime(l.ts)}</span></li>`;
    }).join('') : '<li class="empty">Chưa có ai chấm công hôm nay.</li>';

    const tr = Store.traffic(k);
    $('#today-count').textContent = `${todays.length} lượt · ${tr.total} lượt qua cửa (${tr.guests} khách)`;
    $('#today-events').innerHTML = todays.length ? todays.slice(0, 30).map(l => {
      const emp = Store.findEmployee(l.empId) || { name: l.name };
      return `<li class="person">${avatarHTML(emp)}<div class="person-main"><div class="person-name">${esc(emp.name)}</div><div class="person-sub">${fmtTimeS(l.ts)}</div></div><span class="tag tag-${l.type}">${l.type === 'in' ? 'Vào' : 'Ra'}</span></li>`;
    }).join('') : '<li class="empty">Chưa có lượt chấm công.</li>';
    $('#staff-count').textContent = Store.employees.length;
  }

  // ---------- Nhân sự: đăng ký ----------
  const enrollCanvas = $('#enroll-canvas');
  const ectx = enrollCanvas.getContext('2d');
  let samples = []; // {descriptor:[], thumb}
  let enrollLoopOn = false;

  async function enrollPreviewLoop() {
    if (activeTab !== 'staff' || !stream) { enrollLoopOn = false; return; }
    enrollLoopOn = true;
    if (video.readyState >= 2) {
      enrollCanvas.width = video.videoWidth; enrollCanvas.height = video.videoHeight;
      ectx.drawImage(video, 0, 0);
      try {
        const r = await FaceLib.detectOne(video, S());
        const hint = $('#enroll-hint');
        if (r) {
          const b = r.detection.box;
          ectx.lineWidth = 3; ectx.strokeStyle = b.width > video.videoWidth * 0.15 ? '#12A150' : '#F59E0B';
          ectx.strokeRect(b.x, b.y, b.width, b.height);
          hint.textContent = b.width > video.videoWidth * 0.15 ? 'Tốt! Bấm "Chụp mẫu". Hãy đổi góc nhẹ giữa các lần chụp.' : 'Lại gần camera hơn một chút.';
          $('#btn-capture').disabled = false;
        } else { hint.textContent = 'Chưa thấy khuôn mặt. Nhìn thẳng vào camera.'; $('#btn-capture').disabled = true; }
      } catch (e) { /* bỏ qua */ }
    }
    setTimeout(enrollPreviewLoop, 120);
  }
  // bật preview khi vào tab Nhân sự
  const obs = new MutationObserver(() => { if ($('#tab-staff').classList.contains('is-active') && !enrollLoopOn) enrollPreviewLoop(); });
  obs.observe($('#tab-staff'), { attributes: true, attributeFilter: ['class'] });

  function thumbFrom(source, box, size = 96) {
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const pad = box.width * 0.3;
    const sx = Math.max(0, box.x - pad), sy = Math.max(0, box.y - pad * 1.2);
    const sw = Math.min(source.width || source.videoWidth, box.width + pad * 2), sh = Math.min(source.height || source.videoHeight, box.height + pad * 2.2);
    c.getContext('2d').drawImage(source, sx, sy, sw, sh, 0, 0, size, size);
    return c.toDataURL('image/jpeg', 0.75);
  }
  function addSample(descriptor, thumb) {
    // tránh mẫu trùng gần như y hệt
    if (samples.some(s => FaceLib.distance(s.descriptor, descriptor) < 0.12)) { toast('Mẫu này quá giống mẫu trước, hãy đổi góc mặt.'); return; }
    if (samples.length >= 8) { toast('Tối đa 8 mẫu'); return; }
    samples.push({ descriptor: Array.from(descriptor), thumb });
    renderSamples();
  }
  function renderSamples() {
    const wrap = $('#samples');
    wrap.innerHTML = samples.map((s, i) => `<div class="sample"><img src="${s.thumb}" alt=""><button type="button" data-i="${i}" aria-label="Xóa mẫu">✕</button></div>`).join('')
      + Array.from({ length: Math.max(0, 3 - samples.length) }).map((_, i) => `<div class="sample-slot">${samples.length + i + 1}</div>`).join('');
    wrap.querySelectorAll('button').forEach(b => b.onclick = () => { samples.splice(Number(b.dataset.i), 1); renderSamples(); });
    $('#btn-enroll-save').disabled = samples.length < 3 || !$('#enroll-name').value.trim();
  }
  $('#enroll-name').addEventListener('input', renderSamples);

  $('#btn-capture').addEventListener('click', async () => {
    if (!stream) return toast('Camera chưa bật');
    const r = await FaceLib.detectOne(video, S());
    if (!r) return toast('Chưa thấy khuôn mặt');
    addSample(r.descriptor, thumbFrom(video, r.detection.box));
  });
  $('#enroll-file').addEventListener('change', async (e) => {
    for (const f of e.target.files) {
      try {
        const img = await faceapi.bufferToImage(f);
        const r = await FaceLib.detectOne(img, S());
        if (!r) { toast(`Không thấy khuôn mặt trong ${f.name}`); continue; }
        addSample(r.descriptor, thumbFrom(img, r.detection.box));
      } catch (err) { toast('Không đọc được ảnh ' + f.name); }
    }
    e.target.value = '';
  });
  $('#btn-enroll-reset').addEventListener('click', resetEnroll);
  function resetEnroll() {
    samples = []; $('#enroll-form').reset(); editingId = null;
    $('#btn-enroll-save').textContent = 'Lưu nhân viên';
    renderSamples();
  }
  let editingId = null;
  $('#enroll-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#enroll-name').value.trim(); if (!name) return;
    if (samples.length < 3) return toast('Cần ít nhất 3 mẫu khuôn mặt');
    const data = {
      name, code: $('#enroll-code').value.trim(), dept: $('#enroll-dept').value.trim(),
      descriptors: samples.map(s => s.descriptor), avatar: samples[0].thumb,
    };
    if (editingId) { Store.updateEmployee(editingId, data); toast('Đã cập nhật ' + name); }
    else { Store.addEmployee({ id: Store.uid(), createdAt: Date.now(), ...data }); toast('Đã thêm ' + name); Robot.say(`Rất vui được làm quen, ${shortName(name)}!`, true); }
    resetEnroll(); renderStaff(); renderSide(); fillEmpSelect();
  });

  function renderStaff() {
    const q = ($('#staff-search').value || '').toLowerCase();
    const list = Store.employees.filter(e => !q || e.name.toLowerCase().includes(q) || (e.code || '').toLowerCase().includes(q) || (e.dept || '').toLowerCase().includes(q));
    $('#staff-list').innerHTML = list.length ? list.map(e => `
      <li class="person">${avatarHTML(e)}
        <div class="person-main"><div class="person-name">${esc(e.name)}</div>
        <div class="person-sub">${esc([e.code, e.dept].filter(Boolean).join(' · '))} · ${e.descriptors.length} mẫu</div></div>
        <div class="actions">
          <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${e.id}">Sửa</button>
          <button class="btn btn-ghost btn-sm" data-act="del" data-id="${e.id}">Xóa</button>
        </div></li>`).join('') : '<li class="empty">Chưa có nhân viên nào phù hợp.</li>';
    $('#staff-list').querySelectorAll('button').forEach(b => b.onclick = () => {
      const emp = Store.findEmployee(b.dataset.id); if (!emp) return;
      if (b.dataset.act === 'del') {
        if (confirm(`Xóa ${emp.name}? Lịch sử chấm công vẫn được giữ.`)) { Store.removeEmployee(emp.id); renderStaff(); renderSide(); fillEmpSelect(); }
      } else {
        editingId = emp.id;
        $('#enroll-name').value = emp.name; $('#enroll-code').value = emp.code || ''; $('#enroll-dept').value = emp.dept || '';
        samples = emp.descriptors.map((d, i) => ({ descriptor: d, thumb: i === 0 ? emp.avatar : emp.avatar }));
        $('#btn-enroll-save').textContent = 'Cập nhật';
        renderSamples(); window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
    $('#staff-count').textContent = Store.employees.length;
  }
  $('#staff-search').addEventListener('input', renderStaff);

  // ---------- Lịch sử ----------
  const histFrom = $('#hist-from'), histTo = $('#hist-to'), histEmp = $('#hist-emp');
  histFrom.value = dateKey(); histTo.value = dateKey();
  [histFrom, histTo, histEmp].forEach(el => el.addEventListener('change', renderHistory));
  function fillEmpSelect() {
    const cur = histEmp.value;
    histEmp.innerHTML = '<option value="">Tất cả nhân viên</option>' + Store.employees.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
    histEmp.value = cur;
  }
  function rangeLogs() {
    const from = histFrom.value || '0000-01-01', to = histTo.value || '9999-12-31';
    return Store.logs.filter(l => { const k = dateKey(new Date(l.ts)); return k >= from && k <= to && (!histEmp.value || l.empId === histEmp.value); })
      .sort((a, b) => b.ts - a.ts);
  }
  /** Tổng hợp theo (ngày, nhân viên): vào đầu, ra cuối, giờ công, đi muộn. */
  function summarize(logs) {
    const groups = new Map();
    for (const l of [...logs].sort((a, b) => a.ts - b.ts)) {
      const key = dateKey(new Date(l.ts)) + '|' + l.empId;
      if (!groups.has(key)) groups.set(key, { date: dateKey(new Date(l.ts)), empId: l.empId, name: l.name, code: l.code, firstIn: null, lastOut: null, ms: 0, openIn: null, late: false });
      const g = groups.get(key);
      if (l.type === 'in') { if (!g.firstIn) { g.firstIn = l.ts; g.late = isLate(l.ts); } g.openIn = l.ts; }
      else { g.lastOut = l.ts; if (g.openIn) { g.ms += l.ts - g.openIn; g.openIn = null; } }
    }
    return [...groups.values()];
  }
  function renderHistory() {
    const logs = rangeLogs();
    const sum = summarize(logs);
    $('#summary-grid').innerHTML = sum.slice(0, 60).map(g => {
      const emp = Store.findEmployee(g.empId) || { name: g.name };
      return `<div class="sum-card">${avatarHTML(emp)}<div class="sum-main">
        <div class="person-name">${esc(g.name)} <span class="muted">${esc(g.date.split('-').reverse().join('/'))}</span></div>
        <div class="sum-row"><span>Vào ${g.firstIn ? fmtTime(g.firstIn) : '—'}${g.late ? ' <span class="tag tag-out">muộn</span>' : ''}</span><span>Ra ${g.lastOut ? fmtTime(g.lastOut) : '—'}</span></div>
      </div><div class="sum-hours">${g.ms ? fmtHours(g.ms) : (g.openIn ? 'đang làm' : '—')}</div></div>`;
    }).join('');
    $('#hist-body').innerHTML = logs.length ? logs.slice(0, 500).map(l => `
      <tr><td>${fmtDate(l.ts)} ${fmtTimeS(l.ts)}</td><td>${esc(l.name)}</td><td>${esc(l.code || '')}</td>
      <td><span class="tag tag-${l.type}">${l.type === 'in' ? 'Vào' : 'Ra'}</span></td>
      <td>${l.snap ? `<img src="${l.snap}" alt="">` : '<span class="muted">—</span>'}</td>
      <td>${l.dist != null ? l.dist.toFixed(2) : '—'}</td>
      <td><button class="btn btn-ghost btn-sm" data-del="${l.id}">Xóa</button></td></tr>`).join('')
      : '<tr><td colspan="7" class="empty">Chưa có dữ liệu trong khoảng này.</td></tr>';
    $('#hist-body').querySelectorAll('button[data-del]').forEach(b => b.onclick = () => {
      if (confirm('Xóa dòng chấm công này?')) { Store.removeLog(b.dataset.del); renderHistory(); renderSide(); }
    });
  }
  function downloadCSV(name, rows) {
    const csv = '﻿' + rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  $('#btn-export-logs').addEventListener('click', () => {
    const logs = rangeLogs();
    if (!logs.length) return toast('Không có dữ liệu để xuất');
    downloadCSV(`cham-cong_${histFrom.value}_${histTo.value}.csv`, [
      ['Ngày', 'Giờ', 'Nhân viên', 'Mã NV', 'Loại', 'Độ lệch'],
      ...logs.map(l => [fmtDate(l.ts), fmtTimeS(l.ts), l.name, l.code, l.type === 'in' ? 'Vào' : 'Ra', l.dist ?? '']),
    ]);
  });
  $('#btn-export-summary').addEventListener('click', () => {
    const sum = summarize(rangeLogs());
    if (!sum.length) return toast('Không có dữ liệu để xuất');
    downloadCSV(`tong-hop_${histFrom.value}_${histTo.value}.csv`, [
      ['Ngày', 'Nhân viên', 'Mã NV', 'Vào đầu', 'Ra cuối', 'Giờ công (phút)', 'Đi muộn'],
      ...sum.map(g => [g.date.split('-').reverse().join('/'), g.name, g.code, g.firstIn ? fmtTime(g.firstIn) : '', g.lastOut ? fmtTime(g.lastOut) : '', Math.round(g.ms / 60000), g.late ? 'Có' : '']),
    ]);
  });

  // ---------- Cài đặt ----------
  const modal = $('#modal-settings');
  $('#btn-settings').addEventListener('click', () => { fillSettings(); modal.hidden = false; });
  $('#btn-settings-close').addEventListener('click', () => { modal.hidden = true; });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });

  function fillSettings() {
    const s = S();
    $('#set-mirror').checked = !!s.mirror; $('#set-landmarks').checked = !!s.showLandmarks;
    $('#set-detector').value = s.detector; $('#set-inputsize').value = String(s.inputSize);
    $('#set-threshold').value = s.threshold; $('#set-threshold-val').textContent = Number(s.threshold).toFixed(2);
    $('#set-confirm').value = s.confirmFrames; $('#set-mode').value = s.mode;
    $('#set-cooldown').value = s.cooldownSec; $('#set-mingap').value = s.minGapMin; $('#set-snap').checked = !!s.saveSnap;
    $('#set-voice').checked = !!s.voice; $('#set-voicerate').value = s.voiceRate; $('#set-workstart').value = s.workStart; $('#set-guests').checked = !!s.greetGuests;
    $('#set-usage').textContent = (Store.usageBytes() / 1024).toFixed(0) + ' KB';
    $('#set-device').value = s.deviceId || '';
  }
  $('#set-threshold').addEventListener('input', (e) => { $('#set-threshold-val').textContent = Number(e.target.value).toFixed(2); });
  const bind = (id, key, get) => $(id).addEventListener('change', (e) => { Store.saveSettings({ [key]: get(e.target) }); afterSetting(key); });
  bind('#set-mirror', 'mirror', t => t.checked);
  bind('#set-landmarks', 'showLandmarks', t => t.checked);
  bind('#set-detector', 'detector', t => t.value);
  bind('#set-inputsize', 'inputSize', t => Number(t.value));
  bind('#set-threshold', 'threshold', t => Number(t.value));
  bind('#set-confirm', 'confirmFrames', t => Math.max(2, Number(t.value) || 5));
  bind('#set-mode', 'mode', t => t.value);
  bind('#set-cooldown', 'cooldownSec', t => Math.max(5, Number(t.value) || 60));
  bind('#set-mingap', 'minGapMin', t => Math.max(0, Number(t.value) || 0));
  bind('#set-snap', 'saveSnap', t => t.checked);
  bind('#set-voice', 'voice', t => t.checked);
  bind('#set-voicerate', 'voiceRate', t => Number(t.value) || 1);
  bind('#set-workstart', 'workStart', t => t.value || '08:30');
  bind('#set-guests', 'greetGuests', t => t.checked);
  bind('#set-device', 'deviceId', t => t.value);
  async function afterSetting(key) {
    if (key === 'mirror') applyMirror();
    if (key === 'mode') applyMode();
    if (key === 'detector' && S().detector === 'ssd') { try { await FaceLib.ensureSsd(); toast('Đã tải bộ phát hiện SSD'); } catch (e) { toast('Không tải được SSD, dùng Tiny'); Store.saveSettings({ detector: 'tiny' }); } }
    if (key === 'device' || key === 'deviceId') { try { await startCamera(); } catch (e) { toast('Không mở được camera đã chọn'); } }
    if (key === 'voice' && S().voice) Robot.say('Mình đã bật giọng nói!', true);
  }
  function applyMode() {
    const manual = S().mode === 'manual';
    $('#manual-btns').hidden = !manual;
    $('#toggle-attendance').closest('.switch').querySelector('span:last-child').textContent = manual ? 'Chấm công (bấm nút)' : 'Chấm công tự động';
  }

  $('#btn-backup').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([Store.exportJSON()], { type: 'application/json' }));
    a.download = `camera-cham-cong_${dateKey()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $('#restore-file').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (!confirm('Khôi phục sẽ thay thế toàn bộ dữ liệu hiện tại. Tiếp tục?')) { e.target.value = ''; return; }
    try { Store.importJSON(await f.text()); toast('Đã khôi phục dữ liệu'); fillSettings(); renderStaff(); renderSide(); fillEmpSelect(); renderHistory(); applyMirror(); applyMode(); }
    catch (err) { toast('Lỗi: ' + err.message); }
    e.target.value = '';
  });
  $('#btn-clear-logs').addEventListener('click', () => {
    if (confirm('Xóa toàn bộ lịch sử chấm công? Hãy xuất CSV hoặc sao lưu trước.')) { Store.clearLogs(); renderSide(); renderHistory(); toast('Đã xóa lịch sử'); fillSettings(); }
  });

  // ---------- Khởi tạo ----------
  renderSide(); renderStaff(); fillEmpSelect(); renderSamples(); applyMode(); applyMirror();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showStageMsg('Trình duyệt này không hỗ trợ camera. Hãy dùng Chrome, Edge hoặc Safari mới.', false);
  } else {
    showStageMsg('Bấm để bật camera và tải mô hình nhận diện (lần đầu khoảng 10–15 MB).', true);
  }
})();
