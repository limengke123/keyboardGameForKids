/* =========================================================
   咚咚键盘 — 星星 / 彩纸 / 光圈
   一块全屏 canvas，粒子用秒为单位做物理，落完自动停
   ========================================================= */

window.KK = window.KK || {};

KK.fx = (function () {
  "use strict";

  var canvas = null;
  var ctx = null;
  var dpr = 1;
  var W = 0;
  var H = 0;
  var parts = [];
  var rings = [];
  var raf = 0;
  var running = false;
  var lastT = 0;
  var MAX_PARTS = 360;
  var reduced = false;

  try {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {}

  var EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

  function init() {
    canvas = document.getElementById("fx");
    if (!canvas) return;
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
  }

  function resize() {
    if (!ctx) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function wake() {
    if (running) return;
    running = true;
    lastT = 0;
    raf = requestAnimationFrame(tick);
  }

  function trim() {
    if (parts.length > MAX_PARTS) parts.splice(0, parts.length - MAX_PARTS);
  }

  function hexA(hex, alpha) {
    if (hex.charAt(0) !== "#") return hex;
    var h = hex.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    var r = (n >> 16) & 255;
    var g = (n >> 8) & 255;
    var b = n & 255;
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  function starPath(x, y, r, rot) {
    var points = 5;
    ctx.beginPath();
    for (var i = 0; i < points * 2; i++) {
      var radius = i % 2 === 0 ? r : r * 0.46;
      var a = rot + (i * Math.PI) / points - Math.PI / 2;
      var px = x + Math.cos(a) * radius;
      var py = y + Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function draw(p, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;

    if (p.type === "emoji") {
      ctx.font = p.size + "px " + EMOJI_FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillText(p.emoji, 0, 0);
    } else if (p.type === "star") {
      starPath(p.x, p.y, p.size, p.rot);
      ctx.fillStyle = p.color;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 0.72, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }

    ctx.restore();
  }

  function tick(ts) {
    if (!lastT) lastT = ts;
    var dt = Math.min(0.05, (ts - lastT) / 1000);
    lastT = ts;

    ctx.clearRect(0, 0, W, H);

    var i;
    var p;

    for (i = parts.length - 1; i >= 0; i--) {
      p = parts[i];
      p.life += dt;
      if (p.life >= p.max) {
        parts.splice(i, 1);
        continue;
      }

      var drag = Math.pow(p.drag, dt * 60);
      p.vx *= drag;
      p.vy = p.vy * drag + p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;

      var t = p.life / p.max;
      var alpha = t < 0.72 ? 1 : 1 - (t - 0.72) / 0.28;
      draw(p, Math.max(0, alpha));
    }

    for (i = rings.length - 1; i >= 0; i--) {
      var ring = rings[i];
      ring.life += dt;
      var rt = ring.life / ring.maxLife;
      if (rt >= 1) {
        rings.splice(i, 1);
        continue;
      }
      var ease = 1 - Math.pow(1 - rt, 2.3);
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r + (ring.max - ring.r) * ease, 0, Math.PI * 2);
      ctx.strokeStyle = hexA(ring.color, (1 - rt) * 0.55);
      ctx.lineWidth = Math.max(0.6, ring.width * (1 - rt * 0.65));
      ctx.stroke();
    }

    if (parts.length || rings.length) {
      raf = requestAnimationFrame(tick);
    } else {
      running = false;
      raf = 0;
      ctx.clearRect(0, 0, W, H);
    }
  }

  function burst(x, y, opts) {
    if (!ctx) return;
    opts = opts || {};
    var colors = opts.colors || ["#ff4d85"];
    var count = Math.round((opts.count || 24) * (reduced ? 0.4 : 1));
    var i;

    for (i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var speed = (opts.speed || 460) * (0.4 + Math.random() * 1.0);
      parts.push({
        type: Math.random() < 0.34 ? "star" : "circle",
        x: x,
        y: y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 70,
        g: 820,
        drag: 0.965,
        size: 6 + Math.random() * 13,
        color: colors[(Math.random() * colors.length) | 0],
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 10,
        life: 0,
        max: 0.7 + Math.random() * 0.7
      });
    }

    if (opts.emoji) {
      var n = reduced ? 2 : 5;
      for (var j = 0; j < n; j++) {
        var b = Math.random() * Math.PI * 2;
        var sp = 220 + Math.random() * 260;
        parts.push({
          type: "emoji",
          emoji: opts.emoji,
          x: x,
          y: y,
          vx: Math.cos(b) * sp,
          vy: Math.sin(b) * sp - 130,
          g: 640,
          drag: 0.945,
          size: 24 + Math.random() * 22,
          rot: (Math.random() - 0.5) * 0.5,
          vr: (Math.random() - 0.5) * 3,
          life: 0,
          max: 1 + Math.random() * 0.5
        });
      }
    }

    trim();
    wake();
  }

  function confetti(count) {
    if (!ctx) return;
    var n = Math.round((count || 70) * (reduced ? 0.4 : 1));
    var colors = ["#ff4d85", "#ff7a1a", "#f5a400", "#2fae5b", "#0fa9a0", "#2e86ff", "#8a5cff", "#f04a4a"];

    for (var i = 0; i < n; i++) {
      parts.push({
        type: Math.random() < 0.45 ? "star" : "circle",
        x: Math.random() * W,
        y: -20 - Math.random() * H * 0.25,
        vx: (Math.random() - 0.5) * 160,
        vy: 80 + Math.random() * 240,
        g: 400,
        drag: 0.997,
        size: 7 + Math.random() * 11,
        color: colors[(Math.random() * colors.length) | 0],
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 8,
        life: 0,
        max: 2.2 + Math.random() * 1.2
      });
    }

    trim();
    wake();
  }

  function ring(x, y, color) {
    if (!ctx) return;
    rings.push({
      x: x,
      y: y,
      r: 12,
      max: Math.min(W, H) * (reduced ? 0.3 : 0.42),
      life: 0,
      maxLife: 1.1,
      width: 5 + Math.random() * 7,
      color: color || "#ff4d85"
    });
    wake();
  }

  function clear() {
    parts.length = 0;
    rings.length = 0;
  }

  return {
    init: init,
    burst: burst,
    confetti: confetti,
    ring: ring,
    clear: clear
  };
})();
