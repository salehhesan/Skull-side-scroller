// Skullnaut character rig: drawn in "sprite units" (about 470 tall), feet at (0,0), facing right.
// Usage: SN.draw(ctx, pose). Pose fields: t, mode ('idle'|'walk'|'air'|'crouch'), walk (phase), vy,
// aim (0..1 shooting), recoil (0..1), punch (0..1 progress or 0), breath (bool), hurt (bool).
const SN = (() => {
  const C = {
    ol: '#1f0b05', suit: '#eed099', suitSh: '#cfb289', suitD: '#b89a6c', skull: '#eedab9', skullSh: '#d6bd90',
    teeth: '#f7ead0', olive: '#8f8053', oliveD: '#6f6340', brown: '#8b6745', brownD: '#674533', brownL: '#ae8e67',
    metal: '#4c5047', metalL: '#6c7165', eye: '#0b0302', mouth: '#1a0603'
  };
  const OL = 7, PI2 = Math.PI * 2;
  const THIGH = 58, SHIN = 54, ANKLE = 44, UPPER = 52, FORE = 52;
  let c;

  // ---- tiny drawing helpers ----
  function rrP(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function fs(fill, lw = OL) { c.fillStyle = fill; c.fill(); if (lw) { c.lineWidth = lw; c.strokeStyle = C.ol; c.stroke(); } }
  function R(x, y, w, h, r, fill, lw) { c.beginPath(); rrP(x, y, w, h, r); fs(fill, lw); }
  function E(x, y, rx, ry, fill, lw, rot = 0) { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, PI2); fs(fill, lw); }
  function cap(a, b, w, fill, lw = OL) { // rounded bar from a to b
    const len = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
    c.save(); c.translate(a.x, a.y); c.rotate(ang); R(-w / 2, -w / 2, len + w, w, w / 2, fill, lw); c.restore();
  }
  function band(p, ang, w, h, fill) { c.save(); c.translate(p.x, p.y); c.rotate(ang); R(-w / 2, -h / 2, w, h, h / 2.2, fill, 5); c.restore(); }
  const rot = (p, a) => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) });
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const down = (a, len) => ({ x: -Math.sin(a) * len, y: Math.cos(a) * len }); // 0 = straight down, + = backwards

  function ik(S, T, a, b) {
    const dx = T.x - S.x, dy = T.y - S.y;
    let d = Math.hypot(dx, dy); d = Math.max(Math.abs(a - b) + 1, Math.min(d, a + b - 1));
    const th = Math.atan2(dy, dx), al = Math.acos((a * a + d * d - b * b) / (2 * a * d));
    const e1 = { x: S.x + a * Math.cos(th + al), y: S.y + a * Math.sin(th + al) }, e2 = { x: S.x + a * Math.cos(th - al), y: S.y + a * Math.sin(th - al) };
    const E_ = e1.y > e2.y ? e1 : e2; // elbow points down
    const ang = Math.atan2(T.y - E_.y, T.x - E_.x);
    return { E: E_, W: { x: E_.x + Math.cos(ang) * b, y: E_.y + Math.sin(ang) * b }, ang };
  }

  // ---- pose solver ----
  function rig(st) {
    const r = { lean: 0, tilt: 0, jaw: 0, legs: [], hipX: 0 };
    const t = st.t || 0;
    let fA, fK, bA, bK, grounded = true, crouchK = 0;
    if (st.mode === 'walk') {
      const p = st.walk;
      fA = -0.55 * Math.sin(p); fK = 0.12 + 1.05 * Math.max(0, Math.cos(p));
      bA = -0.55 * Math.sin(p + Math.PI); bK = 0.12 + 1.05 * Math.max(0, Math.cos(p + Math.PI));
      r.lean = 0.08;
    } else if (st.mode === 'air') {
      if ((st.vy || 0) < 0) { fA = -1.0; fK = 1.5; bA = -0.15; bK = 1.25; } else { fA = -0.45; fK = 0.55; bA = 0.25; bK = 0.7; }
      grounded = false; r.lean = 0.04;
    } else if (st.mode === 'crouch') {
      fA = -1.25; fK = 2.15; bA = -0.55; bK = 2.1; r.lean = 0.22; crouchK = 1;
    } else { // idle
      const b = Math.sin(t * 2.6) * 0.04;
      fA = -0.12 - b; fK = 0.22 + b * 2; bA = 0.12 - b; bK = 0.22 + b * 2;
    }
    if (st.breath) { r.lean = -0.1; r.tilt = -0.16 + Math.sin(t * 30) * 0.02; r.jaw = 0.55 + Math.sin(t * 45) * 0.05; if (st.mode === 'idle') { fA = -0.35; fK = 0.25; bA = 0.3; bK = 0.15; } }
    if (st.hurt) { r.lean = -0.2; r.tilt = -0.12; r.jaw = 0.25; }
    if (st.punch) r.lean += 0.12 * Math.sin(st.punch * Math.PI);
    const legs = [{ hx: -18, a: bA, k: bK, back: true }, { hx: 20, a: fA, k: fK, back: false }];
    let depth = 0;
    for (const L of legs) {
      L.knee = down(L.a, THIGH); L.ankleRel = add(L.knee, down(L.a + L.k, SHIN));
      L.boot = st.mode === 'crouch' ? 0 : clamp((L.a + L.k) * -0.15 + (grounded ? 0 : 0.25), -0.5, 0.5);
      depth = Math.max(depth, L.ankleRel.y + ANKLE);
    }
    r.hipY = grounded ? -depth : -(THIGH + SHIN + ANKLE) + 6;
    for (const L of legs) { L.hip = { x: L.hx, y: r.hipY }; L.kneeP = add(L.hip, L.knee); L.ankle = add(L.hip, L.ankleRel); }
    r.legs = legs;
    if (st.mode === 'idle') r.breathe = Math.sin(t * 2.6) * 1.5; else r.breathe = 0;
    // gun (torso space): grip point + angle
    const aimUp = st.aim > 0;
    r.gunA = aimUp ? -r.lean * 0.9 : 0.16 - r.lean;
    r.grip = { x: 98 + (aimUp ? 4 : 0) - (st.recoil || 0) * 8, y: aimUp ? -84 : -76 };
    if (st.mode === 'crouch') { r.gunA = aimUp ? -r.lean : 0.05 - r.lean; r.grip = { x: 100 - (st.recoil || 0) * 8, y: -50 }; }
    if (st.breath) { r.gunA = 0.5; r.grip = { x: 84, y: -62 }; }
    if (st.punch) { r.gunA = 0.6; r.grip = { x: 70, y: -58 }; }
    r.crouch = crouchK;
    return r;
  }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const TORSO_NECK = { x: 6, y: -150 };
  function toSprite(r, p) { return add({ x: 0, y: r.hipY + r.breathe }, rot(p, r.lean)); }
  function gunPt(r, p) { return add(r.grip, rot(p, r.gunA)); }

  // ---- parts ----
  function leg(L) {
    const ta = L.a, sa = L.a + L.k, sh = L.back;
    const knee = L.kneeP, ank = L.ankle;
    cap(L.hip, knee, 62, sh ? C.suitSh : C.suit);
    cap(knee, ank, 52, sh ? C.suitSh : C.suit);
    boot(ank, L.boot, sh);
    // knee pad
    c.save(); c.translate(knee.x, knee.y); c.rotate((ta + sa) / 2);
    R(-28, -24, 58, 48, 18, sh ? C.brownD : C.brown); R(-17, -15, 20, 10, 5, sh ? '#5a3a2a' : '#9c7752', 0);
    c.restore();
    // shin cuff band above boot
    c.save(); c.translate(ank.x, ank.y); c.rotate(sa); R(-25, -46, 50, 12, 6, sh ? C.suitD : C.suitSh, 5); c.restore();
  }
  function boot(p, a, sh) {
    c.save(); c.translate(p.x, p.y); c.rotate(a);
    const f = sh ? C.oliveD : C.olive;
    c.beginPath(); c.moveTo(-25, -36); c.lineTo(23, -36); c.lineTo(25, -10);
    c.quadraticCurveTo(32, -4, 48, 0); c.quadraticCurveTo(70, 6, 68, 30); c.lineTo(66, 40); c.lineTo(-29, 40);
    c.quadraticCurveTo(-34, 6, -25, -36); c.closePath(); fs(f);
    R(-31, 30, 100, 14, 7, sh ? '#3b2a1c' : C.brownD);
    c.lineWidth = 4; c.strokeStyle = C.ol; c.beginPath(); c.moveTo(-26, -22); c.lineTo(24, -22); c.stroke();
    c.beginPath(); c.moveTo(26, -6); c.quadraticCurveTo(20, 12, 28, 30); c.stroke();
    E(46, 12, 10, 6, 'rgba(255,255,255,0.12)', 0);
    c.restore();
  }
  function backpack() {
    R(-94, -150, 56, 118, 20, C.olive);
    R(-94, -150, 20, 118, 12, C.oliveD, 0); c.beginPath(); rrP(-94, -150, 56, 118, 20); c.lineWidth = OL; c.strokeStyle = C.ol; c.stroke();
    R(-88, -104, 34, 36, 8, C.oliveD, 4); c.lineWidth = 4; c.beginPath(); c.moveTo(-88, -92); c.lineTo(-54, -92); c.stroke();
    R(-78, -162, 22, 18, 6, C.metal, 5);
  }
  function torso(r) {
    // pelvis
    R(-56, -16, 116, 34, 16, C.suit);
    cap({ x: -34, y: -12 }, { x: 0, y: 14 }, 12, C.olive, 4); cap({ x: 48, y: -12 }, { x: 16, y: 14 }, 12, C.olive, 4);
    // body
    c.beginPath(); rrP(-60, -154, 124, 140, 46); fs(C.suit);
    c.save(); c.beginPath(); rrP(-60, -154, 124, 140, 46); c.clip();
    c.fillStyle = C.suitSh; c.fillRect(-70, -160, 32, 160); E(40, -40, 40, 18, 'rgba(255,255,255,0.0)', 0);
    c.restore();
    c.beginPath(); rrP(-60, -154, 124, 140, 46); c.lineWidth = OL; c.strokeStyle = C.ol; c.stroke();
    // harness
    cap({ x: -36, y: -148 }, { x: -6, y: -112 }, 15, C.olive, 4);
    cap({ x: 50, y: -146 }, { x: 34, y: -112 }, 15, C.olive, 4);
    cap({ x: 14, y: -74 }, { x: 14, y: -34 }, 15, C.olive, 4);
    // chest box
    R(-12, -122, 54, 50, 10, C.brown);
    E(24, -105, 10, 10, C.brownL, 4); E(2, -85, 7, 7, C.brownL, 4); E(26, -85, 7.5, 7.5, C.brownL, 4);
    // belt
    R(-62, -36, 128, 22, 7, C.brown);
    c.lineWidth = 4; c.beginPath(); for (const x of [-40, -16, 46]) { c.moveTo(x, -35); c.lineTo(x, -15); } c.stroke();
    R(2, -39, 28, 28, 6, C.olive, 5);
  }
  function collarBack() { E(6, -150, 60, 19, C.brown); E(8, -152, 45, 11, C.mouth, 0); }
  function collarFront() {
    c.beginPath(); c.ellipse(6, -150, 60, 19, 0, 0, Math.PI); c.ellipse(8, -152, 45, 11, 0, Math.PI, 0, true); c.closePath(); fs(C.brown, 5);
    R(-20, -144, 14, 9, 4, C.brownD, 0);
  }
  function head(r) {
    c.save(); c.translate(TORSO_NECK.x, TORSO_NECK.y); c.rotate(r.tilt);
    const cran = () => { c.beginPath(); c.ellipse(10, -98, 82, 70, 0, 0, PI2); };
    const maxi = () => { c.beginPath(); rrP(-8, -62, 106, 40, 18); };
    // unified skull silhouette
    c.lineWidth = OL * 2; c.strokeStyle = C.ol; cran(); c.stroke(); maxi(); c.stroke();
    c.fillStyle = C.skull; cran(); c.fill(); maxi(); c.fill();
    // shading on back of skull
    c.save(); cran(); c.clip(); E(-62, -70, 50, 66, C.skullSh, 0); E(-30, -152, 30, 14, 'rgba(255,255,255,0.18)', 0); c.restore();
    // mouth cavity + teeth
    const jaw = r.jaw;
    R(-2, -46, 98, 30 + jaw * 60, 10, C.mouth, 0);
    if (jaw > 0.3) {
      c.save(); c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(56, -22, 2, 56, -22, 50); g.addColorStop(0, 'rgba(255,240,170,1)'); g.addColorStop(0.5, 'rgba(255,150,40,0.8)'); g.addColorStop(1, 'rgba(255,80,20,0)');
      c.fillStyle = g; c.fillRect(0, -70, 110, 100); c.restore();
    }
    for (let i = 0; i < 7; i++) R(-2 + i * 14, -48, 14, 20, 6, C.teeth, 4);
    // jaw (hinged at back)
    c.save(); c.translate(-6, -28); c.rotate(jaw);
    R(0, -2, 104, 32, 14, C.skullSh);
    for (let i = 0; i < 7; i++) R(8 + i * 13.2, -4, 13, 16, 5, C.teeth, 4);
    c.restore();
    // eyes
    E(18, -90, 21, 28, C.eye, 0, 0.08); E(66, -90, 24, 30, C.eye, 0, -0.06);
    if (r.jaw > 0.3) { c.save(); c.globalCompositeOperation = 'lighter';
      for (const [x, y] of [[18, -88], [66, -88]]) { const g = c.createRadialGradient(x, y, 1, x, y, 24); g.addColorStop(0, 'rgba(255,210,90,1)'); g.addColorStop(1, 'rgba(255,90,20,0)'); c.fillStyle = g; c.fillRect(x - 24, y - 24, 48, 48); }
      c.restore(); }
    // nose
    c.beginPath(); c.moveTo(43, -50); c.quadraticCurveTo(32, -58, 36, -64); c.quadraticCurveTo(40, -68, 43, -63); c.quadraticCurveTo(46, -68, 50, -64); c.quadraticCurveTo(54, -58, 43, -50); c.fillStyle = C.eye; c.fill();
    // cheek lines
    c.lineWidth = 4; c.strokeStyle = C.ol;
    c.beginPath(); c.moveTo(90, -80); c.quadraticCurveTo(98, -66, 94, -52); c.stroke();
    c.beginPath(); c.moveTo(-8, -72); c.quadraticCurveTo(-14, -60, -8, -48); c.stroke();
    // controller emblem
    c.save(); c.translate(40, -138); c.rotate(-0.04); c.scale(0.96, 1);
    const pad = () => { c.beginPath(); rrP(-42, -17, 84, 28, 14); c.moveTo(-14, 6); c.ellipse(-28, 8, 15, 13, 0.3, 0, PI2); c.moveTo(42, 8); c.ellipse(28, 8, 15, 13, -0.3, 0, PI2); };
    c.lineWidth = 9; c.strokeStyle = C.brownD; pad(); c.stroke(); c.fillStyle = C.brownL; pad(); c.fill();
    c.fillStyle = C.brown; c.strokeStyle = C.brownD; c.lineWidth = 3;
    c.beginPath(); c.rect(-31, -6, 22, 7); c.rect(-23.5, -13.5, 7, 22); c.fill();
    c.beginPath(); c.moveTo(-23.5, -13.5); c.lineTo(-16.5, -13.5); c.lineTo(-16.5, -6); c.lineTo(-9, -6); c.lineTo(-9, 1); c.lineTo(-16.5, 1); c.lineTo(-16.5, 8.5); c.lineTo(-23.5, 8.5); c.lineTo(-23.5, 1); c.lineTo(-31, 1); c.lineTo(-31, -6); c.lineTo(-23.5, -6); c.closePath(); c.stroke();
    for (const [x, y] of [[20, -9], [29, -2], [20, 5], [11, -2]]) { c.beginPath(); c.arc(x, y, 4.2, 0, PI2); c.fill(); c.stroke(); }
    c.restore();
    c.restore();
  }
  function gun(r) {
    c.save(); c.translate(r.grip.x, r.grip.y); c.rotate(r.gunA);
    c.save(); c.rotate(0.28); R(-12, -6, 22, 40, 7, C.brownD); c.restore();
    R(-54, -32, 26, 24, 7, C.brown);
    R(-36, -36, 106, 34, 12, C.olive);
    R(-22, -46, 62, 13, 5, C.metal, 5);
    R(66, -31, 48, 22, 7, C.metal); R(106, -36, 18, 32, 6, C.metalL);
    R(44, -6, 18, 22, 6, C.metal, 5);
    E(8, -19, 9, 9, '#ff9a2e', 5);
    c.save(); c.globalCompositeOperation = 'lighter'; E(8, -19, 15, 15, 'rgba(255,150,40,0.35)', 0); c.restore();
    c.lineWidth = 4; c.beginPath(); c.moveTo(24, -30); c.lineTo(24, -8); c.moveTo(34, -30); c.lineTo(34, -8); c.stroke();
    if ((r.flash || 0) > 0) { c.save(); c.globalCompositeOperation = 'lighter'; E(136, -20, 26, 16, 'rgba(255,230,140,0.9)', 0); c.restore(); }
    c.restore();
  }
  function arm(S, T, near, big = 1) {
    const k = ik(S, T, UPPER, FORE);
    const f = near ? C.suit : C.suitSh;
    cap(S, k.E, 38, f);
    if (near) { c.save(); c.translate((S.x + k.E.x) / 2, (S.y + k.E.y) / 2); c.rotate(Math.atan2(k.E.y - S.y, k.E.x - S.x)); R(-16, -14, 26, 18, 5, C.olive, 4); c.restore(); }
    const wrist = { x: k.W.x - Math.cos(k.ang) * 12, y: k.W.y - Math.sin(k.ang) * 12 };
    cap(k.E, wrist, 34, f);
    band(k.E, Math.atan2(k.E.y - S.y, k.E.x - S.x) + Math.PI / 2, 44, 20, near ? C.brown : C.brownD);
    band(wrist, k.ang + Math.PI / 2, 40, 14, near ? C.brown : C.brownD);
    return { k, glove: () => glove(k.W, k.ang, near, big) };
  }
  function glove(p, a, near, big) {
    c.save(); c.translate(p.x, p.y); c.rotate(a); c.scale(big, big);
    const f = near ? C.olive : C.oliveD;
    E(0, 0, 21, 19, f); E(6, -14, 11, 7, f, 5, -0.5);
    c.lineWidth = 4; c.beginPath(); c.moveTo(4, 6); c.lineTo(16, 6); c.moveTo(2, 12); c.lineTo(13, 13); c.stroke();
    c.restore();
  }

  function draw(ctx, st) {
    c = ctx; const r = rig(st); r.flash = st.recoil;
    c.lineJoin = 'round'; c.lineCap = 'round';
    const tor = () => { c.translate(0, r.hipY + r.breathe); c.rotate(r.lean); };
    const FAR_S = { x: 10, y: -126 }, NEAR_S = { x: 50, y: -120 };
    const foregrip = gunPt(r, { x: -4, y: 16 });
    // backpack + far arm (behind)
    c.save(); tor(); backpack();
    const farArm = arm(FAR_S, foregrip, false);
    c.restore();
    // legs
    leg(r.legs[0]); leg(r.legs[1]);
    // torso, head, gun, arms
    c.save(); tor();
    torso(r); collarBack(); head(r); collarFront();
    gun(r);
    farArm.glove();
    let nearT = r.grip;
    if (st.punch) { const e = Math.sin(st.punch * Math.PI); nearT = { x: NEAR_S.x + 40 + e * 62, y: NEAR_S.y + 30 - e * 20 }; }
    const nearArm = arm(NEAR_S, nearT, true, st.punch ? 1 + 0.35 * Math.sin(st.punch * Math.PI) : 1);
    nearArm.glove();
    if (st.punch && Math.sin(st.punch * Math.PI) > 0.5) {
      c.strokeStyle = 'rgba(255,246,200,0.85)'; c.lineWidth = 7;
      for (const dy of [-18, 0, 18]) { c.beginPath(); c.moveTo(nearT.x - 70, nearT.y + dy); c.lineTo(nearT.x - 30, nearT.y + dy); c.stroke(); }
    }
    c.restore();
    return r;
  }
  // world-space helpers (sprite units, facing right)
  function muzzle(st) { const r = rig(st); return toSprite(r, gunPt(r, { x: 126, y: -20 })); }
  function mouth(st) { const r = rig(st); return toSprite(r, add(TORSO_NECK, rot({ x: 90, y: -18 }, r.tilt))); }
  function height(st) { const r = rig(st); return -toSprite(r, add(TORSO_NECK, rot({ x: -4, y: -166 }, r.tilt))).y; }
  // head only, centred on the skull (for HUD icons)
  function icon(ctx) { c = ctx; c.lineJoin = 'round'; c.lineCap = 'round'; c.save(); c.translate(-TORSO_NECK.x - 10, -TORSO_NECK.y + 92); head({ tilt: 0, jaw: 0 }); c.restore(); }
  return { draw, muzzle, mouth, height, rig, icon, C };
})();
if (typeof module !== 'undefined') module.exports = SN;
