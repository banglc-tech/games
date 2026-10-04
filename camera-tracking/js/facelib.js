/* Bọc thư viện face-api (TensorFlow.js) + bộ theo dõi (tracker) đơn giản theo IoU. */
const FaceLib = (() => {
  const VERSION = '1.7.15';
  const CDNS = [
    `https://cdn.jsdelivr.net/npm/@vladmandic/face-api@${VERSION}`,
    `https://unpkg.com/@vladmandic/face-api@${VERSION}`,
  ];
  let base = null;
  let loaded = false;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Không tải được ' + src));
      document.head.appendChild(s);
    });
  }

  async function load(onStatus) {
    if (loaded) return;
    let lastErr = null;
    for (const cdn of CDNS) {
      try {
        onStatus && onStatus('Đang tải thư viện nhận diện…');
        if (!window.faceapi) await loadScript(cdn + '/dist/face-api.js');
        onStatus && onStatus('Đang tải mô hình khuôn mặt…');
        const m = cdn + '/model';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(m),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(m),
          faceapi.nets.faceRecognitionNet.loadFromUri(m),
        ]);
        base = cdn; loaded = true;
        return;
      } catch (e) {
        lastErr = e; console.warn('CDN lỗi', cdn, e);
      }
    }
    throw lastErr || new Error('Không tải được mô hình nhận diện');
  }

  async function ensureSsd() {
    if (!loaded) throw new Error('Chưa tải mô hình');
    if (!faceapi.nets.ssdMobilenetv1.isLoaded) await faceapi.nets.ssdMobilenetv1.loadFromUri(base + '/model');
  }

  function options(s) {
    if (s.detector === 'ssd' && faceapi.nets.ssdMobilenetv1.isLoaded) {
      return new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
    }
    return new faceapi.TinyFaceDetectorOptions({ inputSize: Number(s.inputSize) || 320, scoreThreshold: 0.5 });
  }

  /** Phát hiện mọi khuôn mặt + landmarks (+ descriptor nếu cần). */
  async function detectAll(input, s, withDescriptor = true) {
    let q = faceapi.detectAllFaces(input, options(s)).withFaceLandmarks(true);
    if (withDescriptor) q = q.withFaceDescriptors();
    return await q;
  }

  /** Phát hiện một khuôn mặt rõ nhất, kèm descriptor. */
  async function detectOne(input, s) {
    return await faceapi.detectSingleFace(input, options(s)).withFaceLandmarks(true).withFaceDescriptor();
  }

  function distance(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; sum += d * d; }
    return Math.sqrt(sum);
  }

  /** Tìm nhân viên khớp nhất. Trả về {emp, dist}; emp = null nếu vượt ngưỡng. */
  function match(desc, employees, threshold) {
    let best = null, bestD = Infinity;
    for (const e of employees) {
      for (const d of e.descriptors || []) {
        const dist = distance(desc, d);
        if (dist < bestD) { bestD = dist; best = e; }
      }
    }
    return { emp: bestD <= threshold ? best : null, dist: bestD };
  }

  /** Tracker: gán ID ổn định cho từng khuôn mặt giữa các khung hình, gom phiếu nhận diện. */
  class Tracker {
    constructor({ ttlMs = 900, iouMin = 0.3, window = 12 } = {}) {
      this.tracks = []; this.next = 1; this.ttlMs = ttlMs; this.iouMin = iouMin; this.window = window;
    }
    static iou(a, b) {
      const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
      const x2 = Math.min(a.x + a.width, b.x + b.width), y2 = Math.min(a.y + a.height, b.y + b.height);
      const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
      const union = a.width * a.height + b.width * b.height - inter;
      return union > 0 ? inter / union : 0;
    }
    /** dets: [{box, det}] ; trả về mảng tracks còn sống */
    update(dets, now) {
      const pairs = [];
      this.tracks.forEach((t, ti) => dets.forEach((d, di) => {
        const v = Tracker.iou(t.box, d.box); if (v >= this.iouMin) pairs.push([v, ti, di]);
      }));
      pairs.sort((p, q) => q[0] - p[0]);
      const usedT = new Set(), usedD = new Set();
      for (const [, ti, di] of pairs) {
        if (usedT.has(ti) || usedD.has(di)) continue;
        const t = this.tracks[ti], d = dets[di];
        t.box = d.box; t.det = d.det; t.last = now; t.frames++; t.visible = true;
        usedT.add(ti); usedD.add(di);
      }
      this.tracks.forEach((t, ti) => { if (!usedT.has(ti)) t.visible = false; });
      dets.forEach((d, di) => {
        if (usedD.has(di)) return;
        this.tracks.push({
          id: this.next++, box: d.box, det: d.det, first: now, last: now, frames: 1, visible: true,
          votes: [], label: null, bestDist: Infinity, confirmed: false, loggedAt: 0,
        });
      });
      this.tracks = this.tracks.filter(t => now - t.last < this.ttlMs);
      return this.tracks;
    }
    /** Ghi phiếu nhận diện cho track; xác nhận khi đủ confirmFrames phiếu giống nhau trong cửa sổ gần nhất. */
    vote(t, empId, dist, confirmFrames) {
      t.votes.push(empId || '?');
      if (t.votes.length > this.window) t.votes.shift();
      if (empId && dist < t.bestDist) t.bestDist = dist;
      const counts = {};
      for (const v of t.votes) counts[v] = (counts[v] || 0) + 1;
      let top = null, topN = 0;
      for (const k in counts) if (counts[k] > topN) { top = k; topN = counts[k]; }
      if (topN >= confirmFrames) {
        t.label = top === '?' ? null : top;
        t.confirmed = true;
      }
      t.lastDist = dist;
      return t;
    }
  }

  return { load, ensureSsd, detectAll, detectOne, match, distance, Tracker, get loaded() { return loaded; } };
})();
