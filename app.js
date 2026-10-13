"use strict";

const COLORS = {
  axis: "#94a3b8",
  trajectory: "#b7c2ce",
  arc: "#334155",
  position: "#0f766e",
  position2: "#5f8f88",
  delta: "#1d4ed8",
  instant: "#157a3a",
  instant2: "#3d9a62",
  average: "#e06a12",
  force: "#6d28d9",
  label: "#1c2834",
  zero: "#64748b",
};

const T_MAX = 30;

const state = {
  R: 2,
  omega: 1,
  mass: 1,
  t: 0.8,
  dt: Math.PI / 3,
  playing: false,
  speed: 1,
  limitView: false,
  savedDt: null,
  limitAnimStart: 0,
  show: {
    positionVectors: true,
    displacement: true,
    instVelocity: true,
    avgVelocity: true,
    velocityDiff: true,
    instAccel: true,
    accelFuture: false,
    avgAccel: true,
    netForce: true,
    circles: true,
    components: false,
    formulas: true,
  },
};

const $ = (id) => document.getElementById(id);

function position(t, R, omega) {
  const th = omega * t;
  return { x: R * Math.cos(th), y: R * Math.sin(th) };
}

function velocity(t, R, omega) {
  const th = omega * t;
  const speed = R * omega;
  return { x: -speed * Math.sin(th), y: speed * Math.cos(th) };
}

function acceleration(t, R, omega) {
  const th = omega * t;
  const mag = R * omega * omega;
  return { x: -mag * Math.cos(th), y: -mag * Math.sin(th) };
}

function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

function mul(a, s) {
  return { x: a.x * s, y: a.y * s };
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

function mag(v) {
  return Math.hypot(v.x, v.y);
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y;
}

function isZero(v) {
  return mag(v) < 1e-8;
}

function period() {
  return (2 * Math.PI) / state.omega;
}

function dtMin() {
  return Math.max(1e-4, Math.min(0.02, period() / 400));
}

function dtMax() {
  return 2 * period();
}

function effectiveDt() {
  if (!state.limitView) return state.dt;
  const min = dtMin();
  const from = state.savedDt == null ? state.dt : state.savedDt;
  const u = Math.max(0, Math.min(1, (performance.now() - state.limitAnimStart) / 800));
  const eased = 1 - (1 - u) * (1 - u);
  return from + (min - from) * eased;
}

function compute() {
  const R = state.R;
  const omega = state.omega;
  const mass = state.mass;
  const t = state.t;
  const dt = effectiveDt();
  const r1 = position(t, R, omega);
  const r2 = position(t + dt, R, omega);
  const dr = sub(r2, r1);
  const vAvg = mul(dr, 1 / dt);
  const v1 = velocity(t, R, omega);
  const v2 = velocity(t + dt, R, omega);
  const dv = sub(v2, v1);
  const aAvg = mul(dv, 1 / dt);
  const a1 = acceleration(t, R, omega);
  const a2 = acceleration(t + dt, R, omega);
  const F = mul(a1, mass);
  const speed = R * omega;
  const aMag = R * omega * omega;
  const arc = R * Math.abs(omega * dt);
  const dTheta = omega * dt;
  return {
    R, omega, mass, t, dt, r1, r2, dr, vAvg, v1, v2, dv, aAvg, a1, a2, F,
    speed, aMag, arc, dTheta, theta: omega * t,
    forceMag: mag(F),
    centrip: mass * speed * speed / R,
  };
}

function fmt(n) {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a < 5e-4) return "0";
  if (a >= 100) return n.toFixed(1);
  if (a >= 10) return n.toFixed(2);
  return n.toFixed(3);
}

function fmtDeg(rad) {
  if (!Number.isFinite(rad)) return "—";
  return fmt(rad * 180 / Math.PI) + "°";
}

function directionDeg(v) {
  if (isZero(v)) return "—";
  let deg = Math.atan2(v.y, v.x) * 180 / Math.PI;
  if (deg < 0) deg += 360;
  return fmt(deg) + "°";
}

function fitCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w < 8 || h < 8) return null;
  const bw = Math.round(w * dpr);
  const bh = Math.round(h * dpr);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

function drawArrow(ctx, x0, y0, x1, y1, color, width, dashed) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len < 2) return false;
  const ux = dx / len;
  const uy = dy / len;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (len < 8) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    if (dashed) ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.restore();
    return true;
  }
  const headLen = Math.min(13, len * 0.32);
  const headWidth = headLen * 0.48;
  const sx = x1 - ux * headLen;
  const sy = y1 - uy * headLen;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(sx, sy);
  if (dashed) ctx.setLineDash([7, 5]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(sx - uy * headWidth, sy + ux * headWidth);
  ctx.lineTo(sx + uy * headWidth, sy - ux * headWidth);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  return true;
}

function drawAxes(ctx, cx, cy, extent) {
  ctx.save();
  ctx.strokeStyle = COLORS.axis;
  ctx.fillStyle = COLORS.axis;
  ctx.lineWidth = 1.25;
  drawArrow(ctx, cx - extent, cy, cx + extent, cy, COLORS.axis, 1.25, false);
  drawArrow(ctx, cx, cy + extent, cx, cy - extent, COLORS.axis, 1.25, false);
  ctx.font = "600 13px Segoe UI, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("+x", cx + extent + 4, cy);
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("+y", cx, cy - extent - 4);
  ctx.restore();
}

function drawScaleBar(ctx, w, h, pxPerUnit, unit) {
  if (!(pxPerUnit > 0)) return;
  const target = Math.min(92, w * 0.28);
  const raw = target / pxPerUnit;
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9))));
  const n = raw / pow;
  const frac = n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10;
  let world = frac * pow;
  let px = world * pxPerUnit;
  if (px > w * 0.42) {
    world /= 2;
    px /= 2;
  }
  const x = 12;
  const y = h - 16;
  ctx.save();
  ctx.strokeStyle = "#334155";
  ctx.fillStyle = "#334155";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + px, y);
  ctx.moveTo(x, y - 4);
  ctx.lineTo(x, y + 4);
  ctx.moveTo(x + px, y - 4);
  ctx.lineTo(x + px, y + 4);
  ctx.stroke();
  ctx.font = "600 12px Segoe UI, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(fmt(world) + " " + unit, x + px + 6, y);
  ctx.restore();
}

function addLabel(labels, text, x, y, color, w, h) {
  const candidates = [[x, y]];
  for (let ring = 1; ring <= 7; ring++) {
    const radius = ring * 15;
    for (let k = 0; k < 10; k++) {
      const ang = (k / 10) * Math.PI * 2 + ring * 0.4;
      candidates.push([x + Math.cos(ang) * radius, y + Math.sin(ang) * radius]);
    }
  }
  for (const [cx, cy] of candidates) {
    if (cx < 34 || cy < 14 || cx > w - 34 || cy > h - 30) continue;
    const clash = labels.some((item) => Math.hypot(item.x - cx, item.y - cy) < 22);
    if (!clash) {
      labels.push({ text, x: cx, y: cy, color, ax: x, ay: y });
      return;
    }
  }
  labels.push({ text, x, y, color, ax: x, ay: y });
}

function flushLabels(ctx, labels) {
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(100, 116, 139, 0.75)";
  for (const item of labels) {
    if (Math.hypot(item.x - item.ax, item.y - item.ay) > 16) {
      ctx.beginPath();
      ctx.moveTo(item.ax, item.ay);
      ctx.lineTo(item.x, item.y);
      ctx.stroke();
    }
  }
  ctx.font = "700 15px Segoe UI, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  for (const item of labels) {
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(251, 252, 253, 0.94)";
    ctx.strokeText(item.text, item.x, item.y);
    ctx.fillStyle = item.color;
    ctx.fillText(item.text, item.x, item.y);
  }
  ctx.restore();
}

function drawDot(ctx, x, y, radius, fill, stroke) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function screenDir(vx, vy) {
  const len = Math.hypot(vx, vy) || 1;
  return [vx / len, -vy / len];
}

function perp(dx, dy) {
  const len = Math.hypot(dx, dy) || 1;
  return [-dy / len, dx / len];
}

function drawPosition(ctx, w, h, model) {
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  const half = Math.min(w, h) / 2;
  const Rpx = half * 0.5;
  const posScale = Rpx / model.R;
  const W = (x, y) => [cx + x * posScale, cy - y * posScale];
  const labels = [];
  addLabel(labels, "O", cx - 18, cy + 16, COLORS.zero, w, h);

  drawAxes(ctx, cx, cy, Math.min(half - 28, Rpx * 1.35));

  ctx.beginPath();
  ctx.arc(cx, cy, Rpx, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.trajectory;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  const p1 = W(model.r1.x, model.r1.y);
  const p2 = W(model.r2.x, model.r2.y);
  const dTheta = model.dTheta;

  const fullTurns = Math.floor(dTheta / (2 * Math.PI) + 1e-9);
  const rem = dTheta - fullTurns * 2 * Math.PI;
  const sweep = rem < 1e-3 && fullTurns >= 1 ? 2 * Math.PI : rem;

  if (state.show.displacement && sweep > 1e-4 && sweep <= Math.PI * 2 + 1e-3 && fullTurns === 0) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, Rpx, -model.theta, -(model.theta + sweep), true);
    ctx.closePath();
    ctx.fillStyle = "rgba(29, 78, 216, 0.08)";
    ctx.fill();
  }

  if (state.show.displacement && sweep > 1e-4) {
    ctx.beginPath();
    ctx.arc(cx, cy, Rpx, -model.theta, -(model.theta + sweep), true);
    ctx.strokeStyle = COLORS.arc;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    const mid = model.theta + sweep / 2;
    const [sdx, sdy] = screenDir(-Math.sin(mid), Math.cos(mid));
    const [mx, my] = W(model.R * Math.cos(mid), model.R * Math.sin(mid));
    drawArrow(ctx, mx - sdx * 7, my - sdy * 7, mx + sdx * 8, my + sdy * 8, COLORS.arc, 2.2, false);
  }

  const samePoint = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) < 8;
  if (state.show.positionVectors) {
    drawArrow(ctx, cx, cy, p1[0], p1[1], COLORS.position, 2.4, false);
    const mid1x = cx + (p1[0] - cx) * 0.55;
    const mid1y = cy + (p1[1] - cy) * 0.55;
    const [n1x, n1y] = perp(p1[0] - cx, p1[1] - cy);
    if (samePoint) {
      addLabel(labels, "r(t) = r(t+Δt)", mid1x + n1x * 16, mid1y + n1y * 16, COLORS.position, w, h);
    } else {
      drawArrow(ctx, cx, cy, p2[0], p2[1], COLORS.position2, 2.2, true);
      const mid2x = cx + (p2[0] - cx) * 0.55;
      const mid2y = cy + (p2[1] - cy) * 0.55;
      const [n2x, n2y] = perp(cx - p2[0], cy - p2[1]);
      addLabel(labels, "r(t)", mid1x + n1x * 16, mid1y + n1y * 16, COLORS.position, w, h);
      addLabel(labels, "r(t+Δt)", mid2x + n2x * 16, mid2y + n2y * 16, COLORS.position2, w, h);
    }
  }

  if (state.show.displacement) {
    if (isZero(model.dr)) {
      addLabel(labels, "Δr = 0", p1[0] + 28, p1[1] - 20, COLORS.delta, w, h);
    } else {
      drawArrow(ctx, p1[0], p1[1], p2[0], p2[1], COLORS.delta, 2.8, false);
      const mx = (p1[0] + p2[0]) / 2;
      const my = (p1[1] + p2[1]) / 2;
      const ox = mx - cx;
      const oy = my - cy;
      const od = Math.hypot(ox, oy);
      if (od < 24) {
        const [px, py] = perp(p2[0] - p1[0], p2[1] - p1[1]);
        addLabel(labels, "Δr", mx + px * 20, my + py * 20, COLORS.delta, w, h);
      } else {
        addLabel(labels, "Δr", mx + (ox / od) * 22, my + (oy / od) * 22, COLORS.delta, w, h);
      }
    }
  }

  const maxOverlay = half * 0.32;
  if (state.show.instVelocity && !isZero(model.v1)) {
    const vScale = overlayScale(model.speed, 32, maxOverlay);
    const [sdx, sdy] = screenDir(model.v1.x, model.v1.y);
    const len = model.speed * vScale;
    const x1 = p1[0] + sdx * len;
    const y1 = p1[1] + sdy * len;
    drawArrow(ctx, p1[0], p1[1], x1, y1, COLORS.instant, 2.8, false);
    addLabel(labels, "v(t)", x1 + sdx * 18, y1 + sdy * 18, COLORS.instant, w, h);
    const rlen = Math.hypot(p1[0] - cx, p1[1] - cy) || 1;
    const inX = (cx - p1[0]) / rlen;
    const inY = (cy - p1[1]) / rlen;
    const s = 12;
    ctx.beginPath();
    ctx.moveTo(p1[0] + sdx * s, p1[1] + sdy * s);
    ctx.lineTo(p1[0] + sdx * s + inX * s, p1[1] + sdy * s + inY * s);
    ctx.lineTo(p1[0] + inX * s, p1[1] + inY * s);
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    model._velScale = vScale;
  } else {
    model._velScale = overlayScale(model.speed, 32, maxOverlay);
  }

  if (state.show.netForce && !isZero(model.F)) {
    const fScale = overlayScale(model.forceMag, 24, maxOverlay * 0.9);
    const [sdx, sdy] = screenDir(model.F.x, model.F.y);
    const len = model.forceMag * fScale;
    const x1 = p1[0] + sdx * len;
    const y1 = p1[1] + sdy * len;
    drawArrow(ctx, p1[0], p1[1], x1, y1, COLORS.force, 3, false);
    const [nx, ny] = [-sdy, sdx];
    addLabel(labels, "F", (p1[0] + x1) / 2 + nx * 20, (p1[1] + y1) / 2 + ny * 20, COLORS.force, w, h);
    model._forceScale = fScale;
  } else {
    model._forceScale = overlayScale(model.forceMag, 24, maxOverlay * 0.9);
  }

  drawDot(ctx, p2[0], p2[1], 5.5, "#fff7ed", COLORS.average);
  drawDot(ctx, p1[0], p1[1], 6.5, COLORS.instant, "#ffffff");
  drawDot(ctx, cx, cy, 3.5, COLORS.axis, null);

  if (state.show.components) {
    addLabel(labels, "(" + fmt(model.r1.x) + ", " + fmt(model.r1.y) + ")", p1[0], p1[1] + 26, COLORS.zero, w, h);
  }

  flushLabels(ctx, labels);
  drawScaleBar(ctx, w, h, posScale, "m");
  model._posScale = posScale;
}

function overlayScale(magnitude, preferred, maxPx) {
  if (magnitude < 1e-8) return preferred;
  let s = preferred;
  if (magnitude * s > maxPx) s = maxPx / magnitude;
  if (magnitude * s < 22) s = 22 / magnitude;
  return s;
}

function drawVectorSpace(ctx, w, h, spec) {
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  const half = Math.min(w, h) / 2;
  const fit = Math.max(spec.fit, 0.4);
  const scale = (half * (spec.fill || 0.78)) / fit;
  const W = (x, y) => [cx + x * scale, cy - y * scale];
  const labels = [];
  addLabel(labels, spec.origin, cx - 20, cy + 18, COLORS.zero, w, h);

  drawAxes(ctx, cx, cy, Math.min(half - 26, fit * scale));

  if (spec.circleR > 0 && state.show.circles) {
    ctx.beginPath();
    ctx.arc(cx, cy, spec.circleR * scale, 0, Math.PI * 2);
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = COLORS.trajectory;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (spec.auxiliary) {
    const a = W(spec.auxiliary.from.x, spec.auxiliary.from.y);
    const b = W(spec.auxiliary.to.x, spec.auxiliary.to.y);
    const drew = drawArrow(ctx, a[0], a[1], b[0], b[1], spec.auxiliary.color, 2, true);
    if (drew) {
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      const [nx, ny] = perp(b[0] - a[0], b[1] - a[1]);
      addLabel(labels, spec.auxiliary.label, mx + nx * 18, my + ny * 18, spec.auxiliary.color, w, h);
    }
  }

  const arrows = spec.arrows.filter((item) => item.visible);
  for (const item of arrows) {
    const tip = W(item.v.x, item.v.y);
    if (isZero(item.v)) {
      addLabel(labels, item.zeroLabel || item.label + " = 0", cx + (item.zeroOffset || 24), cy - 18, item.color, w, h);
      drawDot(ctx, cx, cy, 4, item.color, "#ffffff");
      continue;
    }
    drawArrow(ctx, cx, cy, tip[0], tip[1], item.color, item.width || 2.7, false);
    const dx = tip[0] - cx;
    const dy = tip[1] - cy;
    const len = Math.hypot(dx, dy) || 1;
    const side = item.side || 1;
    const [px, py] = perp(dx, dy);
    addLabel(
      labels,
      item.label,
      tip[0] + (dx / len) * 16 + px * 10 * side,
      tip[1] + (dy / len) * 16 + py * 10 * side,
      item.color,
      w,
      h
    );
    drawDot(ctx, tip[0], tip[1], 3.5, item.color, "#ffffff");
    if (state.show.components) {
      addLabel(labels, "(" + fmt(item.v.x) + ", " + fmt(item.v.y) + ")", tip[0] + px * 18, tip[1] + py * 18, COLORS.zero, w, h);
    }
  }

  drawDot(ctx, cx, cy, 3.5, "#334155", null);
  flushLabels(ctx, labels);
  drawScaleBar(ctx, w, h, scale, spec.unit);
  return scale;
}

function drawAll(model) {
  const pos = fitCanvas($("pos-canvas"));
  const vel = fitCanvas($("vel-canvas"));
  const acc = fitCanvas($("acc-canvas"));
  if (pos) drawPosition(pos.ctx, pos.w, pos.h, model);
  const sameVelocity = mag(sub(model.v1, model.v2)) < 1e-5;
  if (vel) {
    drawVectorSpace(vel.ctx, vel.w, vel.h, {
      fit: model.speed * 1.75,
      fill: 0.76,
      circleR: model.speed,
      unit: "m/s",
      origin: "Ov",
      auxiliary: state.show.velocityDiff ? {
        from: model.v1,
        to: model.v2,
        color: COLORS.delta,
        label: "Δv",
      } : null,
      arrows: [
        { v: model.v2, color: COLORS.instant2, label: "v(t+Δt)", visible: state.show.instVelocity && !sameVelocity, width: 2.5, side: -1 },
        { v: model.dv, color: COLORS.delta, label: "Δv", visible: state.show.velocityDiff, width: 2.6, zeroOffset: 36, side: 1 },
        { v: model.v1, color: COLORS.instant, label: sameVelocity ? "v(t) = v(t+Δt)" : "v(t)", visible: state.show.instVelocity, width: 4.2, side: 1 },
        { v: model.vAvg, color: COLORS.average, label: "v_avg", visible: state.show.avgVelocity, width: 2.3, zeroOffset: -34, side: -1 },
      ],
    });
  }
  if (acc) {
    drawVectorSpace(acc.ctx, acc.w, acc.h, {
      fit: Math.max(model.aMag, mag(model.aAvg), mag(model.a2)) * 1.45,
      circleR: model.aMag,
      unit: "m/s²",
      origin: "Oa",
      auxiliary: null,
      arrows: [
        { v: model.a2, color: COLORS.instant2, label: "a(t+Δt)", visible: state.show.accelFuture, width: 2.5 },
        { v: model.a1, color: COLORS.instant, label: "a(t)", visible: state.show.instAccel, width: 4.2 },
        { v: model.aAvg, color: COLORS.average, label: "a_avg", visible: state.show.avgAccel, width: 2.3, zeroOffset: 26 },
      ],
    });
  }
}

function updateCopy(model) {
  const posPx = model._posScale || 0;
  const velPx = model._velScale || 0;
  const forcePx = model._forceScale || 0;
  const turns = model.arc / (2 * Math.PI * model.R);
  const turnNote = turns > 0.98 ? " Path length is " + fmt(turns) + " revolutions." : "";
  $("pos-foot").textContent =
    "Distance along the arc: " + fmt(model.arc) + " m. Displacement |Δr|: " + fmt(mag(model.dr)) +
    " m." + turnNote + " Scales differ: " + fmt(posPx) + " px = 1 m; velocity arrows " +
    fmt(velPx) + " px = 1 m/s; force arrows " + fmt(forcePx) + " px = 1 N.";
  $("vel-foot").textContent =
    "Speed |v| = " + fmt(model.speed) + " m/s and does not change. |v_avg| = " + fmt(mag(model.vAvg)) +
    " m/s. The dashed Δv and the solid Δv from Ov are the same vector. This scale stays fixed while Δt changes.";
  $("acc-foot").textContent =
    "|a| = " + fmt(model.aMag) + " m/s², pointing toward the center. |a_avg| = " + fmt(mag(model.aAvg)) +
    " m/s². a(t) points opposite r(t). Do not compare these lengths with the other panels.";

  const box = $("insight");
  const nearestTurn = Math.round(turns);
  const nearPeriod = nearestTurn >= 1 && Math.abs(turns - nearestTurn) < 0.015;
  const nearHalf = Math.abs(model.dTheta - Math.PI) < 0.06;
  const nearLimit = model.dTheta < 0.12;
  box.className = "insight";
  if (nearPeriod) {
    box.className = "insight period";
    box.textContent = "This interval is a whole number of periods. The object is back at the same position, so displacement is zero and average velocity is zero. The velocity vector is also back to the same value, so average acceleration is zero. Instantaneous velocity and acceleration are not zero, and the distance along the arc is not zero.";
  } else if (nearHalf) {
    box.className = "insight half";
    box.textContent = "This interval is about half a period. Displacement is a diameter of the circle. Average velocity points along that diameter. Instantaneous velocity stays tangent, so the two are not the same vector.";
  } else if (nearLimit) {
    box.className = "insight limit";
    box.textContent = "The time interval is very small. The displacement chord is nearly tangent, so average velocity is nearly the instantaneous velocity. Average acceleration is nearly the instantaneous acceleration. A finite difference has become a derivative.";
  } else {
    box.textContent = "The blue chord is displacement, not the distance along the arc. Divide it by Δt to get the orange average velocity, which points along the chord. The green velocity is tangent. Divide the blue change in velocity by Δt to get the orange average acceleration.";
  }

  const avgSpeed = model.arc / model.dt;
  const dvInst = mag(sub(model.vAvg, model.v1));
  const daInst = mag(sub(model.aAvg, model.a1));
  $("metrics").innerHTML = [
    "<p><strong>Distance and displacement.</strong> Arc length s = " + fmt(model.arc) +
      " m. |Δr| = " + fmt(mag(model.dr)) + " m.</p>",
    "<p><strong>Speed and velocity.</strong> Average speed s/Δt = " + fmt(avgSpeed) +
      " m/s. Instantaneous speed |v| = " + fmt(mag(model.v1)) +
      " m/s. Magnitude of average velocity |v_avg| = " + fmt(mag(model.vAvg)) + " m/s.</p>",
    "<p><strong>Closing in.</strong> |v_avg − v(t)| = " + fmt(dvInst) +
      " m/s. |a_avg − a(t)| = " + fmt(daInst) + " m/s².</p>",
    "<p><strong>Perpendicular.</strong> v · a = " + fmt(dot(model.v1, model.a1)) +
      " (m/s)(m/s²). Velocity is perpendicular to acceleration, and the speed does not change.</p>",
    "<p><strong>Angular velocity.</strong> Δθ = " + fmt(model.dTheta) +
      " rad (" + fmtDeg(model.dTheta) + "). ω = Δθ/Δt = " + fmt(model.dTheta / model.dt) + " rad/s.</p>",
    "<p><strong>Net force.</strong> |F| = |m a| = " + fmt(model.forceMag) +
      " N, and m v²/R = " + fmt(model.centrip) +
      " N. Both describe the same inward force.</p>",
  ].join("");

  $("chips").innerHTML = [
    chip("v = " + fmt(model.speed) + " m/s"),
    chip("a = " + fmt(model.aMag) + " m/s²"),
    chip("F = " + fmt(model.forceMag) + " N"),
    chip("T = " + fmt(period()) + " s"),
    chip("f = " + fmt(1 / period()) + " Hz"),
  ].join("");

  $("formula-panel").hidden = !state.show.formulas;
  $("component-panel").hidden = !state.show.components;
  if (state.show.components) {
    $("component-panel").innerHTML = componentTable(model);
  }

  $("limit-banner").hidden = !state.limitView;
}

function chip(text) {
  return "<span class=\"chip\">" + text + "</span>";
}

function row(name, v, unit) {
  return "<tr><td>" + name + "</td><td>" + fmt(v.x) + "</td><td>" + fmt(v.y) +
    "</td><td>" + fmt(mag(v)) + " " + unit + "</td><td>" + directionDeg(v) + "</td></tr>";
}

function componentTable(model) {
  return [
    "<table class=\"components\">",
    "<tr><th>Vector</th><th>x</th><th>y</th><th>Magnitude</th><th>Direction</th></tr>",
    "<tr><th class=\"group\" colspan=\"5\">Position (m)</th></tr>",
    row("r(t)", model.r1, "m"),
    row("r(t+Δt)", model.r2, "m"),
    row("Δr", model.dr, "m"),
    "<tr><th class=\"group\" colspan=\"5\">Velocity (m/s)</th></tr>",
    row("v(t)", model.v1, "m/s"),
    row("v(t+Δt)", model.v2, "m/s"),
    row("v_avg", model.vAvg, "m/s"),
    row("Δv", model.dv, "m/s"),
    "<tr><th class=\"group\" colspan=\"5\">Acceleration (m/s²) and force (N)</th></tr>",
    row("a(t)", model.a1, "m/s²"),
    row("a(t+Δt)", model.a2, "m/s²"),
    row("a_avg", model.aAvg, "m/s²"),
    row("F(t)", model.F, "N"),
    "</table>",
  ].join("");
}

function syncTransport(model) {
  const tSlider = $("t-slider");
  const dtSlider = $("dt-slider");
  if (document.activeElement !== tSlider) tSlider.value = String(state.t);
  const min = dtMin();
  const max = dtMax();
  dtSlider.min = String(min);
  dtSlider.max = String(max);
  const shown = model.dt;
  if (document.activeElement !== dtSlider) dtSlider.value = String(shown);
  const pct = ((period() - min) / (max - min)) * 100;
  $("period-tick").style.left = Math.max(0, Math.min(100, pct)) + "%";
  $("t-read").textContent = fmt(state.t) + " s, θ = " + fmtDeg(model.theta);
  const portion = model.dt / period();
  $("dt-read").textContent = fmt(model.dt) + " s (" + fmt(portion) + " T, Δθ = " + fmtDeg(model.dTheta) + ")";
  $("play").classList.toggle("primary", !state.playing);
  $("pause").classList.toggle("primary", state.playing);
  $("limit-btn").classList.toggle("is-on", state.limitView);
}

function exitLimit(nextDt) {
  if (!state.limitView && nextDt == null) return;
  state.limitView = false;
  if (nextDt != null) state.dt = nextDt;
  else if (state.savedDt != null) state.dt = state.savedDt;
  state.savedDt = null;
}

function toggleLimit() {
  if (state.limitView) {
    exitLimit();
    return;
  }
  state.savedDt = state.dt;
  state.limitAnimStart = performance.now();
  state.limitView = true;
}

function stepTime(direction) {
  state.playing = false;
  const step = period() / 24;
  state.t += direction * step;
  if (state.t < 0) state.t = 0;
  if (state.t > T_MAX) state.t = T_MAX;
}

function clampParam(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function bindParam(key, sliderId, numId, min, max) {
  const slider = $(sliderId);
  const num = $(numId);
  const apply = (raw) => {
    const v = clampParam(raw, min, max);
    if (v == null) return;
    state[key] = v;
    slider.value = String(v);
    if (document.activeElement !== num) num.value = String(Math.round(v * 1000) / 1000);
    if (key === "omega" && state.dt > dtMax()) state.dt = dtMax();
  };
  slider.addEventListener("input", () => apply(slider.value));
  num.addEventListener("input", () => apply(num.value));
  num.addEventListener("change", () => apply(num.value));
}

function setShow(partial) {
  Object.assign(state.show, partial);
  document.querySelectorAll("[data-show]").forEach((box) => {
    box.checked = !!state.show[box.dataset.show];
  });
}

function bind() {
  $("play").addEventListener("click", () => { state.playing = true; });
  $("pause").addEventListener("click", () => { state.playing = false; });
  $("reset").addEventListener("click", () => {
    state.playing = false;
    state.t = 0;
  });
  $("step-back").addEventListener("click", () => stepTime(-1));
  $("step-fwd").addEventListener("click", () => stepTime(1));
  $("speed").addEventListener("change", (event) => {
    state.speed = parseFloat(event.target.value);
  });
  $("t-slider").addEventListener("input", (event) => {
    state.playing = false;
    state.t = parseFloat(event.target.value);
  });
  $("dt-slider").addEventListener("input", (event) => {
    exitLimit(parseFloat(event.target.value));
  });
  $("limit-btn").addEventListener("click", toggleLimit);

  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const parts = Number(button.dataset.preset);
      exitLimit(period() / parts);
    });
  });

  const views = {
    displacement: {
      positionVectors: true, displacement: true, instVelocity: false, avgVelocity: false,
      velocityDiff: false, instAccel: false, accelFuture: false, avgAccel: false,
      netForce: false, circles: true,
    },
    velocity: {
      positionVectors: true, displacement: true, instVelocity: true, avgVelocity: true,
      velocityDiff: true, instAccel: false, accelFuture: false, avgAccel: false,
      netForce: false, circles: true,
    },
    acceleration: {
      positionVectors: false, displacement: false, instVelocity: true, avgVelocity: false,
      velocityDiff: true, instAccel: true, accelFuture: false, avgAccel: true,
      netForce: false, circles: true,
    },
    force: {
      positionVectors: true, displacement: false, instVelocity: true, avgVelocity: false,
      velocityDiff: false, instAccel: true, accelFuture: false, avgAccel: false,
      netForce: true, circles: true,
    },
    full: {
      positionVectors: true, displacement: true, instVelocity: true, avgVelocity: true,
      velocityDiff: true, instAccel: true, accelFuture: false, avgAccel: true,
      netForce: true, circles: true, components: false, formulas: true,
    },
  };

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      setShow(views[button.dataset.view]);
      document.querySelectorAll("[data-view]").forEach((other) => {
        other.classList.toggle("is-on", other === button);
      });
    });
  });

  document.querySelectorAll("[data-show]").forEach((box) => {
    box.addEventListener("change", () => {
      state.show[box.dataset.show] = box.checked;
      document.querySelectorAll("[data-view]").forEach((other) => other.classList.remove("is-on"));
    });
  });

  bindParam("R", "r-slider", "r-num", 0.5, 5);
  bindParam("omega", "w-slider", "w-num", 0.2, 4);
  bindParam("mass", "m-slider", "m-num", 0.2, 5);

  window.addEventListener("keydown", (event) => {
    if (event.target.matches("input, select, textarea")) return;
    if (event.code === "Space") {
      event.preventDefault();
      state.playing = !state.playing;
    } else if (event.code === "ArrowRight") {
      event.preventDefault();
      stepTime(1);
    } else if (event.code === "ArrowLeft") {
      event.preventDefault();
      stepTime(-1);
    } else if (event.key === "Home") {
      state.playing = false;
      state.t = 0;
    }
  });
}

function selfCheck() {
  const errors = [];
  const R = 2;
  const omega = 1.3;
  const mass = 1.7;
  const t = 0.37;
  const r = position(t, R, omega);
  const v = velocity(t, R, omega);
  const a = acceleration(t, R, omega);
  const expect = (cond, message) => { if (!cond) errors.push(message); };
  expect(Math.abs(dot(v, r)) < 1e-8, "velocity is not tangent");
  expect(Math.abs(dot(v, a)) < 1e-8, "velocity is not perpendicular to acceleration");
  expect(mag(sub(a, mul(r, -omega * omega))) < 1e-8, "a is not −ω² r");
  expect(Math.abs(mag(v) - R * omega) < 1e-8, "speed is not Rω");
  expect(Math.abs(mag(a) - R * omega * omega) < 1e-8, "acceleration magnitude is wrong");
  const F = mul(a, mass);
  expect(Math.abs(mag(F) - mass * R * omega * omega) < 1e-8, "force magnitude is wrong");
  expect(Math.abs(mag(F) - mass * mag(v) * mag(v) / R) < 1e-8, "mv²/R does not match |ma|");
  const h = 1e-6;
  const numV = mul(sub(position(t + h, R, omega), r), 1 / h);
  const numA = mul(sub(velocity(t + h, R, omega), v), 1 / h);
  expect(mag(sub(numV, v)) < 1e-4, "finite difference does not approach v");
  expect(mag(sub(numA, a)) < 1e-4, "finite difference does not approach a");
  const T = (2 * Math.PI) / omega;
  expect(mag(sub(position(t + T, R, omega), r)) < 1e-8, "period does not close position");
  expect(mag(sub(velocity(t + T, R, omega), v)) < 1e-8, "period does not close velocity");
  const dr = sub(position(t + T, R, omega), r);
  const vAvg = mul(dr, 1 / T);
  const dv = sub(velocity(t + T, R, omega), v);
  const aAvg = mul(dv, 1 / T);
  expect(mag(vAvg) < 1e-8, "average velocity over one period is not zero");
  expect(mag(aAvg) < 1e-8, "average acceleration over one period is not zero");
  expect(Math.abs(mag(velocity(t + 0.5, R, omega)) - mag(v)) < 1e-8, "speed changed");
  return errors;
}

let lastStamp = null;

function frame(now) {
  if (state.playing) {
    if (lastStamp != null) {
      let delta = ((now - lastStamp) / 1000) * state.speed;
      if (delta > 0.05) delta = 0.05;
      state.t += delta;
      if (state.t > T_MAX) state.t -= T_MAX;
    }
    lastStamp = now;
  } else {
    lastStamp = null;
  }
  const model = compute();
  drawAll(model);
  updateCopy(model);
  syncTransport(model);
  requestAnimationFrame(frame);
}

function boot() {
  const errors = selfCheck();
  const node = $("self-check");
  if (location.hash === "#check" || errors.length) {
    node.hidden = false;
    node.classList.toggle("ok", errors.length === 0);
    node.textContent = errors.length ? errors.join(" | ") : "PASS";
  }
  bind();
  requestAnimationFrame(frame);
}

boot();
