// Skullnaut character rig, traced from the original artwork.
// Sprite units ~= pixels of the original image (about 450 tall). Feet at (0,0), facing right.
// Head and torso are traced in the original image's coordinates and mirrored (the original faces left).
// Usage: SN.draw(ctx, pose). Pose: t, mode ('idle'|'walk'|'air'|'crouch'), walk (phase), vy,
// aim (0/1), recoil (0..1), punch (0..1 progress, 0 = none), breath (bool), hurt (bool).
const SN = (() => {
  const C = {
    ol: '#1c0a04', black: '#0a0302', cream: '#eed099', shade: '#dcb37a', teeth: '#f6e4c0',
    olive: '#8f8053', brown: '#8b6745', chest: '#93684a', brownD: '#6b4a30', sole: '#8a6a4c',
    emblem: '#b48c5e', emblemOl: '#5f3c1f', metal: '#4c5047', metalL: '#6c7165',
    creamB: '#dfc08b', oliveB: '#807249', brownB: '#7b5a3c'
  };
  const OL = 6, PI2 = Math.PI * 2;
  const THIGH = 50, SHIN = 70, FOOT = 24, UPPER = 52, FORE = 46;
  const HIP = { x: 128, y: 308 }, NECK = { x: 0, y: -148 };   // original-image hip centre; neck in torso space
  const F_SH = { x: 84, y: -116 }, B_SH = { x: -84, y: -116 }; // shoulders in torso space
  let c;

  // ---- drawing helpers ----
  function rrP(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  // outlined shape: outline sits outside the fill, like the original inking
  function shape(fn, fill, lw = OL) { c.beginPath(); fn(); c.lineWidth = lw * 2; c.strokeStyle = C.ol; c.stroke(); c.fillStyle = fill; c.fill(); }
  function inner(fn, fill, lw = 4.5) { c.beginPath(); fn(); c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = C.ol; c.stroke(); }
  function flat(fn, fill) { c.beginPath(); fn(); c.fillStyle = fill; c.fill(); }
  function line(fn, lw = 4.5, col = C.ol) { c.beginPath(); fn(); c.lineWidth = lw; c.strokeStyle = col; c.stroke(); }
  function poly(p) { c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.closePath(); }
  function capP(a, b, w) { // rounded bar path from a to b
    const ang = Math.atan2(b.y - a.y, b.x - a.x), h = w / 2, s = Math.sin(ang), k = Math.cos(ang);
    c.moveTo(a.x + s * h, a.y - k * h); c.lineTo(b.x + s * h, b.y - k * h);
    c.arc(b.x, b.y, h, ang - Math.PI / 2, ang + Math.PI / 2); c.lineTo(a.x - s * h, a.y + k * h);
    c.arc(a.x, a.y, h, ang + Math.PI / 2, ang + Math.PI * 1.5); c.closePath();
  }
  const rot = (p, a) => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) });
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const down = (a, len) => ({ x: -Math.sin(a) * len, y: Math.cos(a) * len });
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;

  function ik(S, T, a, b, bendDown = true) {
    const dx = T.x - S.x, dy = T.y - S.y;
    let d = Math.hypot(dx, dy); d = Math.max(Math.abs(a - b) + 1, Math.min(d, a + b - 0.5));
    const th = Math.atan2(dy, dx), al = Math.acos((a * a + d * d - b * b) / (2 * a * d));
    const e1 = { x: S.x + a * Math.cos(th + al), y: S.y + a * Math.sin(th + al) }, e2 = { x: S.x + a * Math.cos(th - al), y: S.y + a * Math.sin(th - al) };
    const E_ = (e1.y > e2.y) === bendDown ? e1 : e2;
    const ang = Math.atan2(S.y + Math.sin(th) * d - E_.y, S.x + Math.cos(th) * d - E_.x);
    return { E: E_, W: { x: E_.x + Math.cos(ang) * b, y: E_.y + Math.sin(ang) * b }, ang };
  }

  // ---- pose solver ----
  function rig(st) {
    const r = { lean: 0, tilt: 0, jaw: 0 };
    const t = st.t || 0, mode = st.mode || 'idle';
    let fA, fK, bA, bK, grounded = true;
    if (mode === 'walk') {
      const p = st.walk || 0;
      fA = -0.6 * Math.sin(p); fK = 0.1 + 1.0 * Math.max(0, Math.cos(p));
      bA = -0.6 * Math.sin(p + Math.PI); bK = 0.1 + 1.0 * Math.max(0, Math.cos(p + Math.PI));
      r.lean = 0.06; r.swing = Math.sin(p) * 0.55;
    } else if (mode === 'air') {
      if ((st.vy || 0) < 0) { fA = -0.95; fK = 1.35; bA = -0.1; bK = 1.1; } else { fA = -0.4; fK = 0.5; bA = 0.3; bK = 0.6; }
      grounded = false; r.lean = 0.03;
    } else if (mode === 'crouch') { fA = -1.3; fK = 2.05; bA = -0.85; bK = 2.15; r.lean = 0.16; }
    else { const b = Math.sin(t * 2.6) * 0.02; fA = -0.05 - b; fK = 0.07 + b * 2; bA = 0.05 - b; bK = 0.07 + b * 2; }
    if (st.breath) { r.lean = -0.1; r.tilt = -0.2 + Math.sin(t * 30) * 0.015; r.jaw = 0.5 + Math.sin(t * 45) * 0.04; if (mode === 'idle') { fA = -0.4; fK = 0.2; bA = 0.34; bK = 0.12; } }
    if (st.hurt) { r.lean = -0.18; r.tilt = -0.14; r.jaw = 0.22; }
    const pk = st.punch ? Math.sin(st.punch * Math.PI) : 0;
    r.pk = pk; r.lean += 0.1 * pk;
    const legs = [{ hx: -33, a: bA, k: bK, back: true }, { hx: 33, a: fA, k: fK, back: false }];
    let depth = 0;
    for (const L of legs) {
      L.knee = down(L.a, THIGH); L.ankleRel = add(L.knee, down(L.a + L.k, SHIN));
      L.boot = mode === 'crouch' ? 0 : clamp((L.a + L.k) * 0.35 + (grounded ? 0 : 0.3), -0.2, 0.7);
      depth = Math.max(depth, L.ankleRel.y + FOOT);
    }
    r.hipY = grounded ? -depth : -(THIGH + SHIN + FOOT) + 8;
    for (const L of legs) { L.hip = { x: L.hx, y: r.hipY }; L.kneeP = add(L.hip, L.knee); L.ankle = add(L.hip, L.ankleRel); }
    r.legs = legs;
    r.breathe = mode === 'idle' ? Math.sin(t * 2.6) * 1.5 : 0;
    // front (gun) arm
    const rc = (st.recoil || 0) * 10;
    if (st.aim) { r.hand = { x: F_SH.x + 82 - rc, y: F_SH.y + 24 - rc * 0.3 }; r.gunA = -r.lean - rc * 0.012; }
    else { r.hand = { x: F_SH.x + 56, y: F_SH.y + 62 }; r.gunA = 0.12 - r.lean; }
    if (mode === 'crouch') { r.hand = st.aim ? { x: F_SH.x + 78 - rc, y: F_SH.y + 56 } : { x: F_SH.x + 56, y: F_SH.y + 58 }; r.gunA = (st.aim ? 0 : 0.08) - r.lean; }
    if (mode === 'walk' && !st.aim) r.hand.y += Math.cos((st.walk || 0) * 2) * 3;
    if (st.breath) { r.hand = { x: F_SH.x + 26, y: F_SH.y + 84 }; r.gunA = 1.0; }
    if (pk) { r.hand = { x: lerp(r.hand.x, F_SH.x + 10, pk), y: lerp(r.hand.y, F_SH.y + 70, pk) }; r.gunA = lerp(r.gunA, 0.8, pk); }
    // back arm
    r.bSh = { x: B_SH.x, y: B_SH.y }; r.bFist = false;
    if (mode === 'walk') r.bHand = add(B_SH, rot({ x: 0, y: 92 }, -r.swing * 0.9 - 0.05));
    else if (mode === 'air') { r.bHand = add(B_SH, { x: -34, y: 78 }); r.bFist = true; }
    else if (mode === 'crouch') r.bHand = add(B_SH, { x: 14, y: 84 });
    else r.bHand = add(B_SH, { x: -10, y: 94 + r.breathe * 0.5 });
    if (st.breath) { r.bHand = add(B_SH, { x: -30, y: 80 }); r.bFist = true; }
    if (pk) { r.bSh = { x: lerp(B_SH.x, 44, pk), y: B_SH.y }; r.bHand = { x: lerp(r.bHand.x, 150, pk), y: lerp(r.bHand.y, -104, pk) }; r.bFist = true; }
    return r;
  }
  function toSprite(r, p) { return add({ x: 0, y: r.hipY + r.breathe }, rot(p, r.lean)); }
  function gunPt(r, p) { return add(r.hand, rot({ x: p.x * 0.8, y: p.y * 0.8 }, r.gunA)); }
  function headPt(r, ox, oy) { return add(NECK, rot({ x: 128 - ox, y: oy - 160 }, r.tilt)); } // original head coords -> torso space

  // ---- torso (original-image coordinates, drawn mirrored) ----
  function backpack() {
    shape(() => rrP(152, 126, 80, 168, 26), C.olive);
    line(() => { c.moveTo(208, 146); c.quadraticCurveTo(214, 215, 206, 284); });
    line(() => { c.moveTo(214, 250); c.lineTo(228, 248); }, 3.5);
  }
  function torso() {
    const body = () => { c.moveTo(68, 170); c.bezierCurveTo(62, 200, 63, 250, 66, 296); c.lineTo(126, 331); c.lineTo(130, 326); c.lineTo(134, 331); c.lineTo(190, 296); c.bezierCurveTo(195, 250, 194, 200, 186, 168); c.closePath(); };
    shape(body, C.cream);
    c.save(); c.beginPath(); body(); c.clip();
    // leg-harness V straps
    inner(() => poly([60, 284, 72, 282, 130, 316, 126, 334, 60, 300]), C.olive);
    inner(() => poly([196, 284, 184, 282, 130, 316, 134, 334, 196, 300]), C.olive);
    // wide shoulder straps
    inner(() => { c.moveTo(50, 172); c.bezierCurveTo(54, 158, 64, 152, 72, 154); c.lineTo(69, 238); c.lineTo(62, 234); c.bezierCurveTo(61, 208, 58, 188, 50, 172); c.closePath(); }, C.olive);
    c.restore();
    // right shoulder pad (pack strap) overlapping the body edge
    shape(() => { c.moveTo(183, 158); c.bezierCurveTo(202, 154, 214, 166, 209, 182); c.bezierCurveTo(197, 194, 190, 216, 192, 244); c.lineTo(181, 234); c.bezierCurveTo(172, 206, 172, 180, 183, 158); c.closePath(); }, C.olive, 5);
    line(() => { c.moveTo(196, 166); c.bezierCurveTo(186, 186, 184, 206, 186, 226); }, 3.5);
    // thin chest straps into the box
    inner(() => poly([70, 166, 79, 166, 93, 191, 84, 193]), C.olive);
    inner(() => poly([171, 164, 181, 169, 153, 199, 146, 192]), C.olive);
    // side straps + drop strap
    inner(() => poly([66, 240, 81, 231, 81, 244, 69, 253]), C.olive);
    inner(() => poly([151, 233, 191, 246, 191, 257, 151, 246]), C.olive);
    inner(() => c.rect(108, 243, 15, 30), C.olive);
    // chest box
    shape(() => rrP(80, 190, 72, 54, 9), C.chest, 5);
    line(() => { c.moveTo(143, 193); c.lineTo(143, 241); }, 3.5);
    inner(() => c.arc(124, 206, 9.5, 0, PI2), C.olive); inner(() => c.arc(93, 227, 8, 0, PI2), C.olive); inner(() => c.arc(128, 232, 5.5, 0, PI2), C.olive);
    // belt
    const belt = () => { c.moveTo(68, 264); c.quadraticCurveTo(128, 276, 190, 262); c.lineTo(191, 281); c.quadraticCurveTo(128, 296, 67, 283); c.closePath(); };
    shape(belt, C.brown, 5);
    c.save(); c.beginPath(); belt(); c.clip();
    line(() => { for (const x of [83, 98, 137, 155, 172]) { c.moveTo(x, 260); c.lineTo(x, 296); } }, 4);
    c.restore();
    inner(() => rrP(102, 271, 31, 18, 3), C.olive);
  }
  function collar() {
    shape(() => c.ellipse(129, 162, 61, 30, -0.1, 0, PI2), C.brown);
    line(() => c.ellipse(129, 164, 55, 25, -0.1, 0.2, Math.PI - 0.2), 2.5, C.brownD);
    flat(() => c.ellipse(141, 150, 43, 18, -0.1, 0, PI2), C.black);
  }

  // ---- head (original-image coordinates) ----
  const UP_TEETH = [[80, 121, 8, 10], [90, 120, 9.5, 12], [101, 120, 10, 12.5], [112, 120, 9.5, 12.5], [123, 120, 8.5, 12], [132.5, 120, 4.5, 9]];
  const LO_TEETH = [[84, 135, 8, 11], [93, 136, 9, 11], [103, 136, 9.5, 11], [114, 136, 9, 11], [124, 135, 8, 10.5], [133, 134.5, 4, 8.5]];
  const skullP = () => {
    c.moveTo(135, 6); c.bezierCurveTo(170, 6, 203, 35, 203, 72); c.bezierCurveTo(203, 95, 195, 110, 180, 117);
    c.lineTo(163, 118); c.lineTo(152, 111); c.quadraticCurveTo(146, 116, 136, 117); c.lineTo(80, 119);
    c.bezierCurveTo(77, 114, 72, 112, 66, 110); c.bezierCurveTo(58, 107, 57, 96, 64, 92);
    c.bezierCurveTo(70, 86, 69, 70, 68, 60); c.bezierCurveTo(68, 40, 90, 6, 135, 6); c.closePath();
  };
  const mouthP = () => { c.moveTo(80, 116); c.lineTo(151, 112); c.bezierCurveTo(150, 130, 144, 144, 134, 150); c.lineTo(86, 149); c.bezierCurveTo(81, 142, 80, 130, 80, 116); c.closePath(); };
  function head(r) {
    const j = r.jaw || 0, hx = 162, hy = 116;
    // mouth cavity backing (visible when the jaw swings open)
    if (j > 0.01) for (let k = 0; k <= 5; k++) { c.save(); c.translate(hx, hy); c.rotate(-j * k / 5); c.translate(-hx, -hy); flat(mouthP, C.black); c.restore(); }
    // mandible
    c.save(); c.translate(hx, hy); c.rotate(-j); c.translate(-hx, -hy);
    shape(() => { c.moveTo(78, 122); c.bezierCurveTo(78, 140, 79, 150, 84, 156); c.bezierCurveTo(92, 163, 118, 165, 135, 160); c.bezierCurveTo(149, 155, 158, 138, 163, 116); c.lineTo(150, 108); c.lineTo(80, 114); c.closePath(); }, C.cream);
    flat(() => { c.moveTo(163, 117); c.bezierCurveTo(158, 138, 150, 154, 136, 160); c.bezierCurveTo(146, 150, 151, 135, 151, 117); c.closePath(); }, C.shade);
    flat(mouthP, C.black);
    for (const t of LO_TEETH) inner(() => rrP(t[0], t[1], t[2], t[3], 3.5), C.teeth, 2.2);
    c.restore();
    if (j > 0.3) { // fire in the throat
      c.save(); c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(100, 140, 2, 100, 140, 46); g.addColorStop(0, 'rgba(255,240,170,1)'); g.addColorStop(0.5, 'rgba(255,150,40,0.85)'); g.addColorStop(1, 'rgba(255,80,20,0)');
      c.fillStyle = g; c.fillRect(50, 95, 110, 95); c.restore();
    }
    // cranium + upper jaw
    shape(skullP, C.cream);
    c.save(); c.beginPath(); skullP(); c.clip();
    flat(() => { c.moveTo(164, 88); c.quadraticCurveTo(187, 93, 205, 64); c.lineTo(212, 125); c.lineTo(160, 125); c.closePath(); }, C.shade);
    c.restore();
    line(() => { c.moveTo(168, 59); c.bezierCurveTo(158, 68, 157, 82, 163, 92); c.bezierCurveTo(168, 100, 176, 100, 175, 108); }, 5);
    line(() => { c.moveTo(175, 108); c.lineTo(169, 116); }, 4);
    line(() => { c.moveTo(134, 116.5); c.quadraticCurveTo(146, 115, 151, 108); }, 5);
    // tiny surface ticks
    line(() => { c.moveTo(165, 24); c.lineTo(168, 27); c.moveTo(172, 74); c.lineTo(174, 78); c.moveTo(169, 81); c.lineTo(171, 84); }, 1.6, '#c9a36c');
    // eyes + nose
    flat(() => c.ellipse(83, 79, 12.5, 17, 0.04, 0, PI2), C.black); flat(() => c.ellipse(133, 84, 15, 18.5, -0.03, 0, PI2), C.black);
    if (j > 0.3) { c.save(); c.globalCompositeOperation = 'lighter';
      for (const [x, y] of [[83, 80], [133, 85]]) { const g = c.createRadialGradient(x, y, 1, x, y, 15); g.addColorStop(0, 'rgba(255,210,90,1)'); g.addColorStop(1, 'rgba(255,90,20,0)'); c.fillStyle = g; c.fillRect(x - 16, y - 18, 32, 36); }
      c.restore(); }
    flat(() => { c.moveTo(103, 88); c.bezierCurveTo(107, 92, 110, 100, 110, 104); c.bezierCurveTo(110, 109, 105, 108, 103, 104); c.bezierCurveTo(100, 108, 92, 109, 92, 103); c.bezierCurveTo(93, 98, 99, 92, 103, 88); c.closePath(); }, C.black);
    // upper teeth
    for (const t of UP_TEETH) inner(() => rrP(t[0], t[1], t[2], t[3], 3.5), C.teeth, 2.2);
    // controller emblem
    const pad = () => { c.moveTo(84, 40); c.bezierCurveTo(84, 28, 94, 20, 108, 17); c.bezierCurveTo(120, 15, 140, 17, 150, 22); c.bezierCurveTo(160, 27, 162, 40, 158, 48); c.bezierCurveTo(154, 57, 142, 59, 135, 56); c.bezierCurveTo(129, 53, 127, 48, 120, 47); c.bezierCurveTo(113, 46, 108, 47, 104, 50); c.bezierCurveTo(98, 54, 88, 54, 85, 48); c.closePath(); };
    c.beginPath(); pad(); c.fillStyle = C.emblem; c.fill(); c.lineWidth = 2.6; c.strokeStyle = C.emblemOl; c.stroke();
    c.save(); c.translate(100, 34); c.rotate(-0.16);
    c.beginPath(); poly([-3, -9, 3, -9, 3, -3, 9, -3, 9, 3, 3, 3, 3, 9, -3, 9, -3, 3, -9, 3, -9, -3, -3, -3]); c.fillStyle = '#c29a6a'; c.fill(); c.lineWidth = 2.2; c.stroke();
    c.restore();
    for (const [x, y] of [[142, 29], [131, 37], [148, 40], [137, 47]]) { c.beginPath(); c.arc(x, y, 4.4, 0, PI2); c.fillStyle = '#c29a6a'; c.fill(); c.lineWidth = 2.2; c.strokeStyle = C.emblemOl; c.stroke(); }
    line(() => { c.moveTo(118, 24); c.lineTo(121, 27); c.moveTo(114, 38); c.lineTo(116, 41); }, 1.5, C.emblemOl);
  }

  // ---- limbs (rig space, facing right) ----
  function leg(L) {
    const sh = L.back, cream = sh ? C.creamB : C.cream, olive = sh ? C.oliveB : C.olive, brown = sh ? C.brownB : C.brown;
    const sA = L.a + L.k;
    shape(() => capP(L.hip, L.kneeP, 54), cream);
    c.save(); c.translate(L.kneeP.x, L.kneeP.y); c.rotate(sA);
    // foot
    c.save(); c.translate(0, SHIN); c.rotate(L.boot - sA);
    shape(() => { c.moveTo(-24, -12); c.lineTo(24, -12); c.bezierCurveTo(38, -12, 54, -4, 58, 10); c.bezierCurveTo(61, 18, 60, 24, 55, 24); c.lineTo(-26, 24); c.bezierCurveTo(-29, 12, -28, 0, -24, -12); c.closePath(); }, olive);
    inner(() => { c.moveTo(-27, 15); c.lineTo(58, 15); c.bezierCurveTo(60, 20, 59, 24, 55, 24); c.lineTo(-26, 24); c.closePath(); }, sh ? '#75583f' : C.sole, 3.5);
    line(() => { c.moveTo(34, -9); c.bezierCurveTo(23, -2, 19, 8, 22, 15); }, 4);
    c.restore();
    // boot shaft
    shape(() => rrP(-24, 30, 48, SHIN - 26, 7), olive);
    flat(() => c.rect(-18.5, SHIN - 16, 37, 16), olive);
    line(() => { c.moveTo(-2, SHIN - 20); c.lineTo(12, SHIN - 17); }, 3.5);
    // cream roll under the knee
    shape(() => rrP(-28, 15, 57, 17, 8), cream);
    c.restore();
    // knee strap + pad
    c.save(); c.translate(L.kneeP.x, L.kneeP.y); c.rotate((L.a + sA) / 2);
    shape(() => rrP(-27, -13, 55, 27, 6), brown);
    line(() => { c.moveTo(-20, -3); c.lineTo(-8, -2); c.moveTo(-18, 5); c.lineTo(-10, 5); }, 3);
    shape(() => rrP(-4, -21, 37, 43, 12), sh ? '#84603f' : C.chest);
    c.restore();
  }
  function arm(S, T, o) {
    const k = ik(S, T, UPPER, FORE, o.bendDown !== false);
    const cream = o.back ? C.creamB : C.cream, brown = o.back ? C.brownB : C.brown, olive = o.back ? C.oliveB : C.olive;
    const wrist = { x: k.W.x - Math.cos(k.ang) * 8, y: k.W.y - Math.sin(k.ang) * 8 };
    const ua = Math.atan2(k.E.y - S.y, k.E.x - S.x);
    shape(() => capP(k.E, wrist, 43), cream);
    shape(() => capP(S, k.E, 45), cream);
    if (o.patch) { c.save(); c.translate(lerp(S.x, k.E.x, 0.42), lerp(S.y, k.E.y, 0.42)); c.rotate(ua + 0.25); inner(() => rrP(-15, -4, 28, 17, 3), C.olive, 4); c.restore(); }
    // elbow: cap bump on the outside + band with wrinkles
    const mid = { x: (S.x + k.W.x) / 2, y: (S.y + k.W.y) / 2 };
    let ox = k.E.x - mid.x, oy = k.E.y - mid.y; const ol = Math.hypot(ox, oy) || 1; ox /= ol; oy /= ol;
    if (ol < 4) { ox = -Math.sin(ua); oy = Math.cos(ua); }
    const ba = (ua + k.ang) / 2 + (Math.abs(ua - k.ang) > Math.PI ? Math.PI : 0);
    shape(() => c.ellipse(k.E.x + ox * 16, k.E.y + oy * 16, 9, 13, ba, 0, PI2), o.back ? '#84603f' : C.chest, 5);
    c.save(); c.translate(k.E.x, k.E.y); c.rotate(ba + Math.PI / 2);
    shape(() => rrP(-26, -12, 52, 24, 7), brown);
    line(() => { c.moveTo(-12, 0); c.lineTo(4, 1); }, 3);
    c.restore();
    // cuff
    c.save(); c.translate(wrist.x, wrist.y); c.rotate(k.ang + Math.PI / 2);
    shape(() => rrP(-25, -7, 50, 13, 5), brown);
    c.restore();
    return { k, glove: (fist, big = 1) => glove(k.W, k.ang, olive, fist, big) };
  }
  function glove(p, a, olive, fist, big) {
    c.save(); c.translate(p.x, p.y); c.rotate(a); c.scale(big, big); // +x points out of the sleeve
    if (fist) {
      shape(() => rrP(-4, -19, 36, 38, 14), olive);
      shape(() => c.ellipse(12, -17, 11, 7, 0.2, 0, PI2), olive, 4);
      line(() => { c.moveTo(23, -6); c.lineTo(31, -6); c.moveTo(24, 3); c.lineTo(32, 3); }, 3.5);
    } else {
      c.beginPath(); for (let i = 0; i < 4; i++) rrP(20, -18 + i * 9.2, 22 - Math.abs(i - 1.2) * 3, 8.4, 4); c.lineWidth = OL * 2; c.strokeStyle = C.ol; c.stroke();
      shape(() => c.ellipse(10, 21, 11, 6.5, 0.5, 0, PI2), olive, 5);
      shape(() => rrP(-4, -19, 32, 38, 11), olive);
      c.beginPath(); for (let i = 0; i < 4; i++) rrP(20, -18 + i * 9.2, 22 - Math.abs(i - 1.2) * 3, 8.4, 4); c.fillStyle = olive; c.fill();
      line(() => { for (let i = 1; i < 4; i++) { c.moveTo(24, -18 + i * 9.2 - 0.4); c.lineTo(38, -18 + i * 9.2 - 0.4); } }, 3);
      inner(() => rrP(0, -12, 13, 15, 3), olive, 3.5);
    }
    c.restore();
  }
  function gun(r, flash) {
    c.save(); c.translate(r.hand.x, r.hand.y); c.rotate(r.gunA); c.scale(0.8, 0.8);
    c.save(); c.rotate(0.25); shape(() => rrP(-12, -6, 23, 40, 7), C.brownD, 5); c.restore();
    shape(() => rrP(-54, -32, 26, 24, 7), C.brown, 5);
    shape(() => rrP(66, -31, 48, 22, 7), C.metal, 5); shape(() => rrP(106, -37, 18, 34, 6), C.metalL, 5);
    shape(() => rrP(-36, -37, 108, 35, 12), C.olive, 5);
    shape(() => rrP(-22, -48, 62, 13, 5), C.metal, 4);
    shape(() => rrP(42, -5, 17, 20, 5), C.metal, 4);
    inner(() => c.arc(8, -19, 9, 0, PI2), '#ff9a2e', 4);
    c.save(); c.globalCompositeOperation = 'lighter'; flat(() => c.arc(8, -19, 16, 0, PI2), 'rgba(255,150,40,0.35)'); c.restore();
    line(() => { c.moveTo(26, -31); c.lineTo(26, -8); c.moveTo(36, -31); c.lineTo(36, -8); }, 4);
    if (flash > 0.4) { c.save(); c.globalCompositeOperation = 'lighter'; flat(() => c.ellipse(140, -20, 30, 16, 0, 0, PI2), 'rgba(255,230,140,0.9)'); c.restore(); }
    c.restore();
  }

  function mirrored(fn, ox, oy) { c.save(); c.scale(-1, 1); c.translate(-ox, -oy); fn(); c.restore(); }
  function draw(ctx, st) {
    c = ctx; const r = rig(st);
    c.lineJoin = 'round'; c.lineCap = 'round';
    const tor = () => { c.translate(0, r.hipY + r.breathe); c.rotate(r.lean); };
    c.save(); tor(); mirrored(backpack, HIP.x, HIP.y); c.restore();
    leg(r.legs[0]); leg(r.legs[1]);
    c.save(); tor();
    mirrored(() => { torso(); collar(); }, HIP.x, HIP.y);
    c.save(); c.translate(NECK.x, NECK.y); c.rotate(r.tilt); mirrored(() => head(r), 128, 160); c.restore();
    // back arm (swings / punches)
    const bArm = arm(r.bSh, r.bHand, { back: !r.pk, patch: true, bendDown: !r.pk });
    bArm.glove(r.bFist, 1 + 0.3 * r.pk);
    if (r.pk > 0.5) line(() => { for (const dy of [-18, 0, 18]) { c.moveTo(r.bHand.x - 78, r.bHand.y + dy); c.lineTo(r.bHand.x - 38, r.bHand.y + dy); } }, 6, 'rgba(255,246,200,0.85)');
    // gun + front arm
    gun(r, st.recoil || 0);
    const fArm = arm(F_SH, r.hand, {});
    fArm.glove(true);
    c.restore();
    return r;
  }
  function muzzle(st) { const r = rig(st); return toSprite(r, gunPt(r, { x: 126, y: -20 })); }
  function mouth(st) { const r = rig(st); return toSprite(r, headPt(r, 70, 136)); }
  function height(st) { const r = rig(st); return -toSprite(r, headPt(r, 135, 0)).y; }
  function icon(ctx) { c = ctx; c.lineJoin = 'round'; c.lineCap = 'round'; mirrored(() => head({ jaw: 0 }), 130, 84); }
  return { draw, muzzle, mouth, height, rig, icon, C };
})();
if (typeof module !== 'undefined') module.exports = SN;
