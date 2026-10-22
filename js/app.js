/* =========================================================
   咚咚键盘 — 主逻辑
   三种玩法：随便按 / 找一找 / 小钢琴
   ========================================================= */

(function () {
  "use strict";

  var KK = window.KK;

  var COLORS = ["#ff4d85", "#ff7a1a", "#f5a400", "#2fae5b", "#0fa9a0", "#2e86ff", "#8a5cff", "#f04a4a"];
  var STAR_KEY = "dongdong.stars";
  var MAX_TRAIL = 8;

  var state = {
    started: false,
    mode: "free",
    lastColor: "",
    stars: 0,
    trail: []
  };

  var find = {
    target: null,
    locked: false,
    nextTimer: 0,
    wrongTimer: 0,
    idleTimer: 0,
    hintTimer: 0
  };

  var els = {};
  var toastTimer = 0;
  var resizeRaf = 0;

  /* ---------------- 小工具 ---------------- */

  function $(id) {
    return document.getElementById(id);
  }

  function $$(sel) {
    return Array.prototype.slice.call(document.querySelectorAll(sel));
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function hexA(hex, alpha) {
    var h = hex.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + alpha + ")";
  }

  function nextColor() {
    var c = pick(COLORS);
    var guard = 0;
    while (c === state.lastColor && guard++ < 10) c = pick(COLORS);
    state.lastColor = c;
    return c;
  }

  /* ---------------- 巨字 ---------------- */

  function fit(el) {
    var box = el.parentElement;
    if (!box) return;

    var maxW = box.clientWidth - 12;
    var maxH = box.clientHeight - 12;
    if (maxW < 20 || maxH < 20) return; // 隐藏着的面板先不算

    el.style.fontSize = "100px";
    var w = el.offsetWidth || 1;
    var h = el.offsetHeight || 1;
    var size = Math.min(maxW / w, maxH / h) * 100 * 0.99;

    el.style.fontSize = clamp(size, 22, 900).toFixed(1) + "px";
  }

  function setGlyph(el, text, color, opts) {
    opts = opts || {};
    el.textContent = text;
    el.dataset.text = text;
    el.style.setProperty("--gc", color);
    el.style.setProperty("--rot", rand(-4, 4).toFixed(2) + "deg");
    el.style.opacity = opts.muted ? "0.16" : "1";
    fit(el);
    el.classList.remove("pop");
    void el.offsetWidth;
    el.classList.add("pop");
  }

  function refitAll() {
    $$("[data-fit]").forEach(function (el) {
      if (el.offsetParent !== null) fit(el);
    });
  }

  /* ---------------- 星星 ---------------- */

  function loadStars() {
    try {
      var v = parseInt(localStorage.getItem(STAR_KEY), 10);
      if (isFinite(v) && v > 0) state.stars = v;
    } catch (e) {}
  }

  function saveStars() {
    try {
      localStorage.setItem(STAR_KEY, String(state.stars));
    } catch (e) {}
  }

  function renderStars(pop) {
    els.starCount.textContent = String(state.stars);
    if (pop) {
      els.starsPill.classList.remove("is-pop");
      void els.starsPill.offsetWidth;
      els.starsPill.classList.add("is-pop");
    }
  }

  function addStars(n) {
    var before = state.stars;
    state.stars += n;
    renderStars(true);
    saveStars();
    if (Math.floor(state.stars / 10) > Math.floor(before / 10)) celebrate();
  }

  function celebrate() {
    KK.fx.confetti(70);
    KK.audio.sweep();
    toast("⭐ 太棒啦！你已经攒了 " + state.stars + " 颗星星");
  }

  function toast(msg) {
    clearTimeout(toastTimer);
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    toastTimer = setTimeout(function () {
      els.toast.classList.remove("show");
    }, 2200);
  }

  function flash(color) {
    if (!els.flash.animate) return;
    els.flash.style.background =
      "radial-gradient(circle at 50% 45%, " +
      hexA(color, 0.38) +
      " 0%, " +
      hexA(color, 0.15) +
      " 38%, transparent 70%)";
    els.flash.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 620, easing: "ease-out" });
  }

  /* ---------------- 键盘轨迹 ---------------- */

  function pushTrail(k, color) {
    state.trail.push({ text: k.big, color: color });
    if (state.trail.length > MAX_TRAIL) state.trail.shift();
    renderTrail();
  }

  function renderTrail() {
    els.trail.innerHTML = "";

    if (!state.trail.length) {
      var hint = document.createElement("span");
      hint.className = "trail-hint";
      hint.textContent = "按过的键会排在这里";
      els.trail.appendChild(hint);
      return;
    }

    state.trail.forEach(function (item, i) {
      var pill = document.createElement("span");
      pill.className = "trail-pill";
      pill.textContent = item.text;
      pill.style.setProperty("--tc", item.color);
      var t = (i + 1) / state.trail.length;
      pill.style.opacity = (0.45 + t * 0.55).toFixed(2);
      pill.style.transform = "scale(" + (0.88 + t * 0.12).toFixed(2) + ")";
      els.trail.appendChild(pill);
    });
  }

  /* ---------------- 玩法一：随便按 ---------------- */

  function pressFree(k) {
    var color = nextColor();

    setGlyph(els.gFree, k.big, color);
    els.gFreeCap.textContent = k.caption;
    flash(color);

    var r = els.gFree.getBoundingClientRect();
    KK.fx.burst(r.left + r.width / 2, r.top + r.height / 2, {
      colors: [color, "#ffd166", "#ffffff", "#ffb3c9"],
      emoji: k.emoji,
      count: 24
    });

    KK.audio.pop(KK.keymap.noteFor(k.code).freq);
    addStars(1);
    pushTrail(k, color);
  }

  /* ---------------- 玩法二：找一找 ---------------- */

  function clearFindTimers() {
    clearTimeout(find.nextTimer);
    clearTimeout(find.wrongTimer);
    clearTimeout(find.idleTimer);
    clearTimeout(find.hintTimer);
    find.nextTimer = 0;
    find.wrongTimer = 0;
    find.idleTimer = 0;
    find.hintTimer = 0;
  }

  function findIdle() {
    setGlyph(els.gFind, "？", "#2b2440", { muted: true });
  }

  function armHint() {
    clearTimeout(find.idleTimer);
    find.idleTimer = setTimeout(function () {
      if (state.mode !== "find" || find.locked) return;
      els.bubble.classList.remove("is-hint");
      void els.bubble.offsetWidth;
      els.bubble.classList.add("is-hint");
      KK.audio.chime();
      find.hintTimer = setTimeout(function () {
        els.bubble.classList.remove("is-hint");
      }, 1200);
    }, 7000);
  }

  function startFind() {
    clearFindTimers();
    find.locked = false;

    var t = pick(KK.keymap.FIND_POOL);
    var guard = 0;
    while (t === find.target && guard++ < 30) t = pick(KK.keymap.FIND_POOL);
    find.target = t;

    els.findTarget.textContent = t;
    els.findTarget.style.setProperty("--tc", nextColor());
    els.findTarget.classList.remove("bump");
    void els.findTarget.offsetWidth;
    els.findTarget.classList.add("bump");

    els.gFindCap.textContent = "按一下这个键吧～";
    findIdle();

    // 新题目来了：小提示音
    KK.audio.chime();
    armHint();
  }

  function pressFind(k) {
    if (state.mode !== "find" || find.locked) return;
    clearTimeout(find.wrongTimer);

    // 特殊键不算错，只是没找到
    if (!k.key) {
      els.gFind.style.opacity = "1";
      setGlyph(els.gFind, k.big, "#8c8aa3");
      els.gFindCap.textContent = "按 " + find.target + " 试试看～";
      KK.audio.oops();
      find.wrongTimer = setTimeout(findIdle, 900);
      return;
    }

    if (k.key === find.target) {
      find.locked = true;
      clearTimeout(find.idleTimer);

      setGlyph(els.gFind, k.big, "#2fae5b");
      pushTrail(k, "#2fae5b");
      els.gFindCap.textContent = "找到啦！太厉害了 🎉";
      KK.audio.success();

      KK.fx.confetti(56);
      var r = els.gFind.getBoundingClientRect();
      KK.fx.burst(r.left + r.width / 2, r.top + r.height / 2, {
        colors: ["#2fae5b", "#ffd166", "#ff5d8f", "#3d9bff"],
        count: 30,
        emoji: "⭐"
      });

      addStars(5);
      find.nextTimer = setTimeout(startFind, 1600);
      return;
    }

    // 按错了：不惩罚，只温柔提示
    els.gFind.style.opacity = "1";
    setGlyph(els.gFind, k.big, "#9a97b0");
    pushTrail(k, "#9a97b0");
    els.gFindCap.textContent = "这是 " + k.big + "，再找找 " + find.target + " 在哪里？";
    KK.audio.oops();

    els.bubble.classList.remove("is-wrong");
    void els.bubble.offsetWidth;
    els.bubble.classList.add("is-wrong");

    find.wrongTimer = setTimeout(function () {
      els.bubble.classList.remove("is-wrong");
      els.gFindCap.textContent = "按一下这个键吧～";
      findIdle();
    }, 1200);

    armHint();
  }

  /* ---------------- 玩法三：小钢琴 ---------------- */

  function pressPiano(k) {
    var note = KK.keymap.noteFor(k.code);
    var color = nextColor();

    setGlyph(els.gPiano, k.big, color);
    els.gPianoCap.textContent = "♪ " + note.solfege;

    KK.audio.piano(note.freq);

    var r = els.gPiano.getBoundingClientRect();
    var cx = r.left + r.width / 2;
    var cy = r.top + r.height / 2;
    var offset = ((note.step % 5) - 2) * 18;

    KK.fx.ring(cx + offset, cy, color);
    KK.fx.burst(cx, cy, { colors: [color, "#ffd166", "#ffffff"], count: 9, speed: 210 });

    addStars(1);
    pushTrail(k, color);
  }

  /* ---------------- 模式切换 ---------------- */

  function setMode(mode) {
    state.mode = mode;
    clearFindTimers();
    find.locked = false;

    $$(".pane").forEach(function (p) {
      p.classList.toggle("is-active", p.dataset.pane === mode);
    });

    $$(".mode").forEach(function (b) {
      b.setAttribute("aria-selected", b.dataset.mode === mode ? "true" : "false");
    });

    if (mode === "find") {
      startFind();
    } else if (mode === "piano") {
      els.gPianoCap.textContent = "按一下，听听看";
    } else {
      els.gFreeCap.textContent = state.started ? "随便按一个键吧！" : "按一下键盘吧";
    }

    requestAnimationFrame(refitAll);
  }

  /* ---------------- 声音 / 全屏 ---------------- */

  function renderSound() {
    var muted = KK.audio.isMuted();
    els.btnSound.textContent = muted ? "🔇" : "🔊";
    els.btnSound.setAttribute("aria-label", muted ? "打开声音" : "关掉声音");
    els.btnSound.classList.toggle("is-off", muted);
  }

  function toggleSound() {
    KK.audio.init();
    KK.audio.resume();
    KK.audio.setMuted(!KK.audio.isMuted());
    renderSound();
    if (!KK.audio.isMuted()) KK.audio.chime();
  }

  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function goFullscreen() {
    var d = document.documentElement;
    try {
      var p;
      if (d.requestFullscreen) p = d.requestFullscreen({ navigationUI: "hide" });
      else if (d.webkitRequestFullscreen) p = d.webkitRequestFullscreen();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }

  function leaveFullscreen() {
    try {
      var p;
      if (document.exitFullscreen) p = document.exitFullscreen();
      else if (document.webkitExitFullscreen) p = document.webkitExitFullscreen();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }

  function syncFull() {
    var on = isFullscreen();
    els.btnFull.setAttribute("aria-label", on ? "退出全屏" : "全屏");
    els.btnFull.classList.toggle("is-on", on);
  }

  function toggleFullscreen() {
    if (isFullscreen()) leaveFullscreen();
    else goFullscreen();
    setTimeout(syncFull, 250);
  }

  /* ---------------- 开始 ---------------- */

  function start(opts) {
    if (state.started) return;
    state.started = true;

    els.overlay.classList.add("is-hidden");
    KK.audio.init();
    KK.audio.resume();

    if (!opts || opts.fullscreen !== false) goFullscreen();

    setMode("free");
    setGlyph(els.gFree, "你好", nextColor());
    els.gFreeCap.textContent = "随便按一个键吧！";
    KK.audio.chime();
  }

  /* ---------------- 键盘事件 ---------------- */

  var MODIFIER_CODE = /^(Control|Shift|Alt|Meta)(Left|Right)$/;

  function shouldPrevent(e) {
    if (e.metaKey || e.ctrlKey) return false;
    var code = e.code || "";
    if (/^F([1-9]|10)$/.test(code)) return true;
    return (
      [
        "Space",
        "Tab",
        "Enter",
        "NumpadEnter",
        "Backspace",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Home",
        "End",
        "PageUp",
        "PageDown",
        "Insert",
        "Delete",
        "Backquote",
        "Quote",
        "Slash",
        "Backslash",
        "IntlBackslash",
        "Minus",
        "Equal",
        "BracketLeft",
        "BracketRight",
        "Semicolon",
        "Comma",
        "Period",
        "NumpadAdd",
        "NumpadSubtract",
        "NumpadMultiply",
        "NumpadDivide",
        "NumpadDecimal"
      ].indexOf(code) > -1
    );
  }

  function dispatch(k) {
    if (!k) return;
    if (state.mode === "free") pressFree(k);
    else if (state.mode === "find") pressFind(k);
    else if (state.mode === "piano") pressPiano(k);
  }

  function onKeydown(e) {
    if (e.repeat) {
      if (state.started) e.preventDefault();
      return;
    }

    if (!state.started) {
      // F11 / F12 留给浏览器（全屏、开发者工具），其余键吃掉默认行为
      if (e.code !== "F11" && e.code !== "F12" && !e.metaKey && !e.ctrlKey) e.preventDefault();
      start();
      dispatch(KK.keymap.resolve(e));
      return;
    }

    if (shouldPrevent(e)) e.preventDefault();

    // Ctrl / Cmd / Alt 组合留给浏览器，别抢
    if ((e.ctrlKey || e.metaKey || e.altKey) && !MODIFIER_CODE.test(e.code || "")) return;

    dispatch(KK.keymap.resolve(e));
  }

  /* ---------------- 启动 ---------------- */

  function bind() {
    document.addEventListener("keydown", onKeydown, { passive: false });

    $$(".mode").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!state.started) return;
        setMode(btn.dataset.mode);
      });
    });

    els.btnStart.addEventListener("click", function (e) {
      e.stopPropagation();
      start();
    });

    els.overlay.addEventListener("click", function () {
      start();
    });

    els.btnSound.addEventListener("click", toggleSound);
    els.btnFull.addEventListener("click", toggleFullscreen);

    document.addEventListener("fullscreenchange", syncFull);
    document.addEventListener("webkitfullscreenchange", syncFull);

    window.addEventListener("resize", function () {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(refitAll);
    });
  }

  function boot() {
    els = {
      overlay: $("overlay"),
      btnStart: $("btnStart"),
      btnSound: $("btnSound"),
      btnFull: $("btnFull"),
      starsPill: $("starsPill"),
      starCount: $("starCount"),
      gFree: $("gFree"),
      gFreeCap: $("gFreeCap"),
      gFind: $("gFind"),
      gFindCap: $("gFindCap"),
      gPiano: $("gPiano"),
      gPianoCap: $("gPianoCap"),
      findTarget: $("findTarget"),
      bubble: $("bubble"),
      trail: $("trail"),
      toast: $("toast"),
      flash: $("flash")
    };

    loadStars();
    renderStars(false);
    renderSound();
    renderTrail();
    bind();
    KK.fx.init();
    setMode("free");
    syncFull();

    // 调试用：index.html?demo=1&mode=find&key=B 直接进入游戏画面（不请求全屏）
    var query = new URLSearchParams(window.location.search);
    if (query.get("demo") === "1") {
      document.documentElement.classList.add("demo");
      start({ fullscreen: false });

      var demoMode = query.get("mode");
      if (demoMode === "find" || demoMode === "piano") setMode(demoMode);

      var key = (query.get("key") || "").toUpperCase();
      var code = query.get("code") || "";
      if (!code && /^[A-Z0-9]$/.test(key)) {
        code = /^[0-9]$/.test(key) ? "Digit" + key : "Key" + key;
      }
      if (code) {
        setTimeout(function () {
          dispatch(KK.keymap.resolve({ code: code, key: key }));
        }, 320);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
