/* =========================================================
   咚咚键盘 — 主逻辑
   五种玩法：随便按 / 找一找 / 小钢琴 / 数字 / 拼词
   ========================================================= */

(function () {
  "use strict";

  var KK = window.KK;

  var COLORS = ["#ff4d85", "#ff7a1a", "#f5a400", "#2fae5b", "#0fa9a0", "#2e86ff", "#8a5cff", "#f04a4a"];
  var STAR_KEY = "dongdong.stars";
  var LITE_KEY = "dongdong.lite";
  var LANG_KEY = "dongdong.lang";
  var CASE_KEY = "dongdong.case";
  var MAX_TRAIL = 8;

  var SPEECH_LANGS = [
    { id: "zh-CN", name: "中文", short: "中" },
    { id: "en-US", name: "English", short: "EN" },
    { id: "fr-FR", name: "Français", short: "FR" },
    { id: "es-ES", name: "Español", short: "ES" },
    { id: "de-DE", name: "Deutsch", short: "DE" },
    { id: "ja-JP", name: "日本語", short: "日" }
  ];

  var state = {
    mode: "free",
    lastColor: "",
    stars: 0,
    trail: [],
    lang: "off",
    langChosen: false,
    letterCase: "lower"
  };

  var audioReady = false;

  var spellState = {
    word: "",
    type: "",
    emoji: "",
    lang: "en-US",
    typed: "",
    locked: false,
    nextTimer: 0,
    hintTimer: 0,
    wrongTimer: 0
  };

  var numberState = {
    target: null,
    raw: "",
    locked: false,
    wrong: false,
    nextTimer: 0,
    hintTimer: 0,
    clearTimer: 0
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

  function splitChars(text) {
    var s = String(text == null ? "" : text);
    if (typeof Array.from === "function") {
      try {
        return Array.from(s);
      } catch (e) {}
    }
    return s.split("");
  }

  function caseText(text) {
    var s = String(text == null ? "" : text);
    return state.letterCase === "upper" ? s.toUpperCase() : s.toLowerCase();
  }

  // 把提示拆成一个个字符，方便给「当前该按的那一位」加下划线
  function renderTipChars(el, text, nextIndex) {
    if (!el) return;

    var chars = splitChars(text);
    el.textContent = "";

    for (var i = 0; i < chars.length; i++) {
      var span = document.createElement("span");
      span.className = "tip-char";
      span.textContent = chars[i];
      if (i === nextIndex) {
        span.className += " is-next";
        // 只有小写 g / j / p / q / y 的尾巴会伸到基线下面，下划线要再低一点
        var ch = chars[i];
        if (ch === ch.toLowerCase() && /[gjpqy]/.test(stripAccents(ch).toLowerCase())) {
          span.className += " has-descender";
        }
      }
      el.appendChild(span);
    }

    if (nextIndex > -1 && nextIndex < chars.length) el.classList.add("has-next");
    else el.classList.remove("has-next");
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

    el.style.fontSize = clamp(size, 22, 3000).toFixed(1) + "px";
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
    if (isLite() || !els.flash.animate) return;
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

    KK.audio.pop(KK.keymap.noteFor(k.code).freq, speechOn());
    speakKey(k, 20);

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

  function renderFindTarget() {
    if (!els.findTarget) return;
    els.findTarget.textContent = find.target == null ? "?" : caseText(find.target);
  }

  function renderFindWord() {
    if (!els.findWord) return;

    // 关掉自动朗读时，仍用默认可读语言把单词显示出来，方便点气泡听一遍
    var lang = state.lang === "off" ? speechLangForTip() : state.lang;
    var info = find.target ? KK.keymap.wordFor(find.target, lang) : null;
    if (!info) {
      els.findWord.hidden = true;
      els.findWord.textContent = "";
      if (els.bubble && find.target) {
        els.bubble.setAttribute("aria-label", "点一下朗读 " + caseText(find.target));
      }
      return;
    }

    els.findWord.hidden = false;
    els.findWord.textContent = caseText(info.word) + " " + info.emoji;
    if (els.bubble) {
      els.bubble.setAttribute("aria-label", "点一下朗读 " + caseText(info.word));
    }
  }

  function speakFindPhrase(letter, lang, delay) {
    if (!lang || lang === "off") return false;

    var info = KK.keymap.wordFor(letter, lang);
    return KK.speech.speak(info ? info.phrase : letter, lang, {
      delay: delay == null ? 30 : delay,
      rate: info ? 0.86 : 0.88
    });
  }

  function speakFindTarget(letter) {
    if (!speechOn()) return;
    speakFindPhrase(letter, state.lang, 450);
  }

  function speakFindKey(k, delay) {
    if (!speechOn()) return;
    if (!k || !k.key || !/^[A-Z0-9]$/.test(k.key)) return;

    speakFindPhrase(k.key, state.lang, delay == null ? 30 : delay);
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

    renderFindTarget();
    els.findTarget.style.setProperty("--tc", nextColor());
    els.findTarget.classList.remove("bump");
    void els.findTarget.offsetWidth;
    els.findTarget.classList.add("bump");

    renderFindWord();
    els.gFindCap.textContent = "按一下这个键吧～";
    findIdle();

    // 新题目来了：先念一次「字母 + 单词」
    KK.audio.chime();
    speakFindTarget(t);
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

    speakFindKey(k, 30);

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
    speakKey(k, 160);

    var r = els.gPiano.getBoundingClientRect();
    var cx = r.left + r.width / 2;
    var cy = r.top + r.height / 2;
    var offset = ((note.step % 5) - 2) * 18;

    KK.fx.ring(cx + offset, cy, color);
    KK.fx.burst(cx, cy, { colors: [color, "#ffd166", "#ffffff"], count: 9, speed: 210 });

    addStars(1);
    pushTrail(k, color);
  }

  /* ---------------- 玩法四：数字 ---------------- */

  function numberValue() {
    if (numberState.raw === "") return null;
    var n = parseInt(numberState.raw, 10);
    return isFinite(n) ? clamp(n, 0, 100) : null;
  }

  function updateNumberCaption() {
    if (!els.gNumberCap || numberState.locked || numberState.wrong) return;

    if (!KK.speech.supported || els.speechWrap.classList.contains("is-hidden")) {
      els.gNumberCap.textContent = "这个设备没有可用的朗读语音";
      return;
    }
    if (KK.audio.isMuted()) {
      els.gNumberCap.textContent = "🔇 声音关着呢 · 打开就能听发音";
      return;
    }
    if (!speechOn()) {
      els.gNumberCap.textContent = "点右上角 🌍 选择语言，就能听发音";
      return;
    }
    els.gNumberCap.textContent = "按数字键，把上面的数填出来 · ↑↓ 微调";
  }

  function numberHint(msg) {
    if (!els.gNumberCap) return;
    els.gNumberCap.textContent = msg;
    clearTimeout(numberState.hintTimer);
    numberState.hintTimer = setTimeout(updateNumberCaption, 1800);
  }

  function nextNumberIndex() {
    if (numberState.target == null) return -1;

    var target = String(numberState.target);
    var raw = numberState.raw || "";
    var i = 0;

    while (i < raw.length && i < target.length && raw.charAt(i) === target.charAt(i)) i++;
    return i < target.length ? i : -1;
  }

  function renderNumberTarget() {
    if (!els.numberTarget) return;

    if (numberState.target == null) {
      els.numberTarget.textContent = "?";
      return;
    }

    if (els.numberBubble) {
      els.numberBubble.setAttribute("aria-label", "点一下朗读数字 " + String(numberState.target));
    }

    renderTipChars(
      els.numberTarget,
      String(numberState.target),
      numberState.locked ? -1 : nextNumberIndex()
    );
  }

  function renderNumberInput() {
    if (numberState.raw === "") {
      setGlyph(els.gNumber, "?", "#2b2440", { muted: true });
    } else {
      setGlyph(els.gNumber, numberState.raw, nextColor());
    }
    renderNumberTarget();
  }

  function speakNumber(value, lang, delay) {
    if (!lang || lang === "off") return false;
    return KK.speech.speak(String(value), lang, { delay: delay == null ? 340 : delay, rate: 0.82 });
  }

  function startNumberRound() {
    clearTimeout(numberState.nextTimer);
    clearTimeout(numberState.hintTimer);
    clearTimeout(numberState.clearTimer);
    clearTimeout(spellState.nextTimer);
    clearTimeout(spellState.hintTimer);
    clearTimeout(spellState.wrongTimer);

    numberState.locked = false;
    numberState.raw = "";
    numberState.wrong = false;

    var next = Math.floor(Math.random() * 101);
    var guard = 0;
    while (next === numberState.target && guard++ < 40) next = Math.floor(Math.random() * 101);
    numberState.target = next;

    renderNumberTarget();
    els.numberTarget.style.setProperty("--tc", nextColor());
    els.numberTarget.classList.remove("bump");
    void els.numberTarget.offsetWidth;
    els.numberTarget.classList.add("bump");

    renderNumberInput();
    updateNumberCaption();

    if (speechOn()) {
      speakNumber(next, state.lang, 340);
    }
  }

  function numberSuccess(value) {
    numberState.locked = true;
    numberState.wrong = false;
    clearTimeout(numberState.hintTimer);
    clearTimeout(numberState.clearTimer);

    setGlyph(els.gNumber, String(value), "#2fae5b");
    renderNumberTarget();
    els.gNumberCap.textContent = "找到啦！就是 " + value + " 🎉";

    addStars(5);
    pushTrail({ big: String(value) }, "#2fae5b");

    KK.audio.success();
    KK.fx.confetti(48);

    var r = els.gNumber.getBoundingClientRect();
    KK.fx.burst(r.left + r.width / 2, r.top + r.height / 2, {
      colors: ["#2fae5b", "#ffd166", "#ff5d8f", "#3d9bff"],
      count: 26,
      emoji: "⭐"
    });

    if (speechOn()) {
      speakNumber(value, state.lang, 180);
    }

    numberState.nextTimer = setTimeout(startNumberRound, 1900);
  }

  function clearNumberInput() {
    clearTimeout(numberState.clearTimer);
    numberState.raw = "";
    numberState.wrong = false;
    renderNumberInput();
    updateNumberCaption();
  }

  function validateNumber() {
    if (numberState.locked) return;

    var raw = numberState.raw;
    if (raw === "") {
      numberState.wrong = false;
      updateNumberCaption();
      return;
    }

    var targetStr = String(numberState.target);

    if (raw === targetStr) {
      numberSuccess(numberState.target);
      return;
    }

    // 还是目标的前缀，继续等孩子输入
    if (targetStr.indexOf(raw) === 0) {
      numberState.wrong = false;
      clearTimeout(numberState.clearTimer);
      renderNumberInput();
      updateNumberCaption();
      return;
    }

    // 不可能拼成目标了：错误音 + 变红，稍后自动清空
    if (!numberState.wrong) {
      numberState.wrong = true;
      KK.audio.oops();
    }
    setGlyph(els.gNumber, raw, "#f04a4a");
    els.gNumberCap.textContent = "不对哦，再试一次：按出 " + targetStr;
    clearTimeout(numberState.clearTimer);
    numberState.clearTimer = setTimeout(clearNumberInput, 800);
  }

  function numberAppend(d) {
    if (numberState.locked) return;
    if (numberState.raw.length >= 3) return;

    clearTimeout(numberState.clearTimer);
    numberState.raw = numberState.raw === "" || numberState.raw === "0" ? d : numberState.raw + d;
    renderNumberInput();
    validateNumber();
  }

  function numberBackspace() {
    if (numberState.locked) return;
    clearTimeout(numberState.clearTimer);
    numberState.raw = numberState.raw.length > 1 ? numberState.raw.slice(0, -1) : "";
    renderNumberInput();
    validateNumber();
  }

  function numberClear() {
    if (numberState.locked) return;
    clearNumberInput();
  }

  function numberStep(delta) {
    if (numberState.locked) return;
    clearTimeout(numberState.clearTimer);

    var current = numberValue();
    var value;
    if (current === null) value = delta > 0 ? 1 : 0;
    else value = clamp(current + delta, 0, 100);

    numberState.raw = String(value);
    renderNumberInput();
    validateNumber();
  }

  function pressNumber(k) {
    if (!k || numberState.locked) return;

    if (k.key && /^[0-9]$/.test(k.key)) {
      numberAppend(k.key);
      return;
    }

    switch (k.code) {
      case "Backspace":
        numberBackspace();
        break;
      case "Delete":
        numberClear();
        break;
      case "ArrowUp":
        numberStep(1);
        break;
      case "ArrowDown":
        numberStep(-1);
        break;
      default:
        if (/^Key[A-Z]$/.test(k.code)) numberHint("按数字键 0–9 哦～");
        break;
    }
  }

  /* ---------------- 玩法五：拼词 ---------------- */

  function stripAccents(value) {
    try {
      return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    } catch (e) {
      return String(value);
    }
  }

  function spellBaseLetter(value) {
    if (!value) return null;
    var base = stripAccents(value).toUpperCase();
    return /^[A-Z]$/.test(base) ? base : null;
  }

  function spellCaption() {
    return spellState.word && spellState.word !== spellState.type
      ? "按顺序打出这个单词 · 重音会自动补上"
      : "按顺序打出这个单词 · Backspace 退一格";
  }

  function spellSpeechReady() {
    return state.lang !== "off" && !KK.audio.isMuted() && !!KK.speech.voiceFor(spellState.lang);
  }

  function spellHint(msg) {
    if (!els.spellCap) return;
    els.spellCap.textContent = msg;
    clearTimeout(spellState.hintTimer);
    spellState.hintTimer = setTimeout(function () {
      if (!spellState.locked) els.spellCap.textContent = spellCaption();
    }, 1400);
  }

  function buildSpellSlots(length) {
    els.spellSlots.innerHTML = "";
    for (var i = 0; i < length; i++) {
      var slot = document.createElement("span");
      slot.className = "spell-slot";
      if (i === 0) slot.classList.add("is-next");
      els.spellSlots.appendChild(slot);
    }
  }

  function spellDisplayChars() {
    var word = String(spellState.word || "");
    try {
      word = word.normalize("NFC");
    } catch (e) {}
    return splitChars(word);
  }

  function renderSpellWord() {
    if (!els.spellWord) return;

    if (!spellState.word) {
      els.spellWord.textContent = "";
      return;
    }

    if (els.spellBubble) {
      els.spellBubble.setAttribute("aria-label", "点一下朗读单词 " + caseText(spellState.word));
    }

    renderTipChars(
      els.spellWord,
      caseText(spellState.word),
      spellState.locked ? -1 : spellState.typed.length
    );
  }

  function renderSpellSlots() {
    var slots = els.spellSlots.children;
    var typed = spellState.typed;
    var chars = spellDisplayChars();

    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      var ch = i < typed.length && i < chars.length ? chars[i].toUpperCase() : "";
      slot.textContent = ch;
      slot.classList.toggle("is-filled", !!ch);
      slot.classList.toggle("is-next", !spellState.locked && i === typed.length);
      if (ch) slot.style.setProperty("--sc", COLORS[i % COLORS.length]);
      else slot.style.removeProperty("--sc");
    }

    renderSpellWord();
  }

  function startSpellRound() {
    clearTimeout(spellState.nextTimer);
    clearTimeout(spellState.hintTimer);
    clearTimeout(spellState.wrongTimer);

    var bank = KK.keymap.spellBank(state.lang);
    var word = "";
    var emoji = "";
    var guard = 0;

    do {
      var item = bank.words[Math.floor(Math.random() * bank.words.length)];
      word = item[0];
      emoji = item[1];
    } while (word === spellState.word && guard++ < 30);

    spellState.word = word;
    spellState.type = stripAccents(word);
    spellState.emoji = emoji;
    spellState.lang = bank.lang;
    spellState.typed = "";
    spellState.locked = false;

    els.spellEmoji.textContent = emoji;
    renderSpellWord();
    els.spellLang.textContent = bank.lang === "fr-FR" ? "Français" : "English";
    els.spellBig.hidden = true;
    els.spellBig.classList.remove("pop");
    els.spellBig.textContent = "";
    els.spellSlots.hidden = false;
    els.spellSlots.classList.remove("is-wrong");
    els.spellCap.textContent = spellCaption();

    buildSpellSlots(spellState.type.length);

    if (spellSpeechReady()) {
      KK.speech.speak(spellState.word, spellState.lang, { delay: 360, rate: 0.85 });
    }
  }

  function spellSuccess() {
    spellState.locked = true;
    clearTimeout(spellState.nextTimer);
    clearTimeout(spellState.hintTimer);
    clearTimeout(spellState.wrongTimer);

    els.spellSlots.classList.remove("is-wrong");
    renderSpellWord();
    els.spellCap.textContent = "拼对啦！" + spellState.word + " " + spellState.emoji + " 🎉";
    els.spellSlots.hidden = true;
    els.spellBig.textContent = spellState.emoji;
    els.spellBig.hidden = false;
    els.spellBig.classList.remove("pop");
    void els.spellBig.offsetWidth;
    els.spellBig.classList.add("pop");

    addStars(5);
    pushTrail({ big: spellState.word.toUpperCase() }, "#2fae5b");
    KK.audio.success();
    KK.fx.confetti(52);

    var r = els.spellBig.getBoundingClientRect();
    KK.fx.burst(r.left + r.width / 2, r.top + r.height / 2, {
      colors: ["#2fae5b", "#ffd166", "#ff5d8f", "#3d9bff"],
      count: 24,
      emoji: "⭐"
    });

    if (spellSpeechReady()) {
      KK.speech.speak(spellState.word, spellState.lang, { delay: 180, rate: 0.85 });
    }

    spellState.nextTimer = setTimeout(startSpellRound, 1900);
  }

  function pressSpell(k) {
    if (!k || spellState.locked) return;

    if (k.code === "Backspace") {
      if (spellState.typed.length > 0) {
        spellState.typed = spellState.typed.slice(0, -1);
        renderSpellSlots();
        els.spellCap.textContent = spellCaption();
        clearTimeout(spellState.hintTimer);
      }
      return;
    }

    if (k.code === "Delete") {
      spellState.typed = "";
      renderSpellSlots();
      els.spellCap.textContent = spellCaption();
      clearTimeout(spellState.hintTimer);
      return;
    }

    if (k.code === "Enter" || k.code === "NumpadEnter" || k.code === "Space") {
      if (spellSpeechReady()) {
        KK.speech.speak(spellState.word, spellState.lang, { delay: 40, rate: 0.85 });
      }
      return;
    }

    var base = spellBaseLetter(k.key);
    if (!base) {
      if (k.key && /^[0-9]$/.test(k.key)) spellHint("按字母键拼单词哦～");
      return;
    }

    var expected = spellState.type.charAt(spellState.typed.length).toUpperCase();

    if (base === expected) {
      spellState.typed += base;
      renderSpellSlots();

      var slot = els.spellSlots.children[spellState.typed.length - 1];
      if (slot) {
        slot.classList.remove("pop");
        void slot.offsetWidth;
        slot.classList.add("pop");
      }

      KK.audio.pop(KK.keymap.noteFor(k.code).freq, true);
      els.spellCap.textContent = spellCaption();
      clearTimeout(spellState.hintTimer);

      if (spellState.typed.length === spellState.type.length) spellSuccess();
      return;
    }

    KK.audio.oops();
    els.spellSlots.classList.remove("is-wrong");
    void els.spellSlots.offsetWidth;
    els.spellSlots.classList.add("is-wrong");
    spellHint("按顺序来，再看看上面的单词");

    clearTimeout(spellState.wrongTimer);
    spellState.wrongTimer = setTimeout(function () {
      els.spellSlots.classList.remove("is-wrong");
    }, 500);
  }

  /* ---------------- 模式切换 ---------------- */

  function setMode(mode) {
    state.mode = mode;
    clearFindTimers();
    find.locked = false;
    clearTimeout(numberState.nextTimer);
    clearTimeout(numberState.hintTimer);
    clearTimeout(numberState.clearTimer);

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
    } else if (mode === "number") {
      startNumberRound();
    } else if (mode === "spell") {
      startSpellRound();
    } else {
      els.gFreeCap.textContent = "随便按一下键盘吧！";
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
    if (KK.audio.isMuted()) KK.speech.stop();
    renderSound();
    renderSpeech();
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

  /* ---------------- 声音解锁 / 流畅模式 ---------------- */

  // 浏览器要求先有用户操作才能出声，首键或首次点击时再初始化
  function ensureAudio() {
    if (audioReady) return;
    audioReady = true;
    KK.audio.init();
    KK.audio.resume();

    // iOS 等浏览器要等第一次交互后才给出语音列表
    if (KK.speech.refresh) {
      KK.speech.refresh();
      setTimeout(function () {
        KK.speech.refresh();
      }, 300);
    }
  }

  function isLite() {
    return document.documentElement.classList.contains("lite");
  }

  function defaultLite() {
    try {
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
    } catch (e) {}

    var ua = navigator.userAgent || "";
    if (/SmartTV|SMART-TV|Tizen|WebOS|Web0S|NetCast|BRAVIA|Android TV|Google TV|HbbTV|Roku|AppleTV|CrKey/i.test(ua)) {
      return true;
    }
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) return true;
    return false;
  }

  function loadLite() {
    var stored = null;
    try {
      stored = localStorage.getItem(LITE_KEY);
    } catch (e) {}
    if (stored === "1") return true;
    if (stored === "0") return false;
    return defaultLite();
  }

  function renderLite() {
    var on = isLite();
    els.btnLite.setAttribute("aria-pressed", on ? "true" : "false");
    els.btnLite.setAttribute(
      "aria-label",
      on ? "流畅模式已开启，点击恢复完整动画" : "开启流畅模式（减少动画）"
    );
  }

  function applyLite(on, announce) {
    document.documentElement.classList.toggle("lite", !!on);
    try {
      localStorage.setItem(LITE_KEY, on ? "1" : "0");
    } catch (e) {}
    renderLite();
    if (announce) toast(on ? "🐢 流畅模式：动画更少，更顺滑" : "✨ 完整动画：效果全开");
  }

  function toggleLite() {
    applyLite(!isLite(), true);
    if (KK.fx.refresh) KK.fx.refresh();
    refitAll();
  }

  /* ---------------- 提示大小写 ---------------- */

  function loadCase() {
    var stored = null;
    try {
      stored = localStorage.getItem(CASE_KEY);
    } catch (e) {}
    return stored === "upper" ? "upper" : "lower";
  }

  function saveCase() {
    try {
      localStorage.setItem(CASE_KEY, state.letterCase);
    } catch (e) {}
  }

  function renderCase() {
    var upper = state.letterCase === "upper";

    if (els.caseLabel) els.caseLabel.textContent = upper ? "ABC" : "abc";
    if (!els.btnCase) return;

    els.btnCase.setAttribute("aria-pressed", upper ? "true" : "false");
    els.btnCase.setAttribute(
      "aria-label",
      upper ? "提示文字为大写，点击切换为小写" : "提示文字为小写，点击切换为大写"
    );
    els.btnCase.setAttribute(
      "title",
      upper ? "提示文字：大写（点击切换小写）" : "提示文字：小写（点击切换大写）"
    );
    els.btnCase.classList.toggle("is-upper", upper);
  }

  function applyCase(mode, announce) {
    state.letterCase = mode === "upper" ? "upper" : "lower";
    saveCase();
    renderCase();

    // 只改气泡里的提示，不动键盘字母格和按键匹配
    renderFindTarget();
    renderFindWord();
    renderSpellWord();
    renderNumberTarget();

    if (announce) {
      toast(state.letterCase === "upper" ? "🔠 提示文字：ABC 大写" : "🔡 提示文字：abc 小写");
    }
  }

  function toggleCase() {
    applyCase(state.letterCase === "upper" ? "lower" : "upper", true);
  }

  /* ---------------- 朗读 ---------------- */

  function langMeta(id) {
    for (var i = 0; i < SPEECH_LANGS.length; i++) {
      if (SPEECH_LANGS[i].id === id) return SPEECH_LANGS[i];
    }
    return null;
  }

  function getStoredLang() {
    try {
      return localStorage.getItem(LANG_KEY);
    } catch (e) {
      return null;
    }
  }

  function saveLang(id) {
    try {
      localStorage.setItem(LANG_KEY, id);
    } catch (e) {}
  }

  function availableLangs() {
    var list = [];
    for (var i = 0; i < SPEECH_LANGS.length; i++) {
      if (KK.speech.voiceFor(SPEECH_LANGS[i].id)) list.push(SPEECH_LANGS[i]);
    }
    return list;
  }

  function defaultLang(avail) {
    for (var i = 0; i < avail.length; i++) {
      if (avail[i].id === "en-US") return "en-US";
    }
    return avail.length ? avail[0].id : "off";
  }

  function speechOn() {
    return state.lang !== "off" && !KK.audio.isMuted() && !!KK.speech.voiceFor(state.lang);
  }

  function speakKey(k, delay) {
    if (!speechOn()) return;
    if (!k || !k.key || !/^[A-Z0-9]$/.test(k.key)) return;
    KK.speech.speak(k.key, state.lang, { delay: delay == null ? 20 : delay });
  }

  // 点击气泡时：即使家长在 🌍 里选了「不朗读」，也按提示自己的语言读一次
  function speechLangForTip() {
    if (state.lang !== "off" && KK.speech.voiceFor(state.lang)) return state.lang;
    var avail = availableLangs();
    return avail.length ? defaultLang(avail) : "off";
  }

  function speakSpellTip() {
    var lang = KK.speech.voiceFor(spellState.lang) ? spellState.lang : speechLangForTip();
    if (!lang || lang === "off") return false;
    return KK.speech.speak(spellState.word, lang, { delay: 0, rate: 0.85 });
  }

  function speakTip(mode) {
    if (!KK.speech.supported) {
      toast("这个设备没有可用的朗读语音");
      return;
    }
    if (KK.audio.isMuted()) {
      toast("🔇 声音关着呢 · 点 🔊 打开");
      return;
    }

    ensureAudio();

    var lang = speechLangForTip();
    var ok = false;

    if (mode === "find" && find.target) {
      if (lang && lang !== "off") ok = speakFindPhrase(find.target, lang, 0);
    } else if (mode === "number" && numberState.target != null) {
      if (lang && lang !== "off") ok = speakNumber(numberState.target, lang, 0);
    } else if (mode === "spell" && spellState.word) {
      ok = speakSpellTip();
    }

    if (!ok) toast("没有可用的语音 · 点右上角 🌍 换一个");
  }

  function bindTipSpeaker(el, mode) {
    if (!el) return;

    el.addEventListener("click", function () {
      ensureAudio();
      speakTip(mode);
    });

    el.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " " && e.code !== "Space" && e.code !== "NumpadEnter") {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      ensureAudio();
      speakTip(mode);
    });
  }

  function buildSpeechMenu(avail) {
    var menu = els.speechMenu;
    menu.innerHTML = "";

    var title = document.createElement("p");
    title.className = "speech-menu-title";
    title.textContent = "朗读语言";
    menu.appendChild(title);

    var options = [{ id: "off", name: "不朗读", short: "关" }].concat(avail);

    options.forEach(function (lang) {
      var item = document.createElement("button");
      item.type = "button";
      item.className = "speech-item";
      item.setAttribute("role", "option");
      item.setAttribute("data-lang", lang.id);
      item.setAttribute("aria-selected", state.lang === lang.id ? "true" : "false");

      var name = document.createElement("span");
      name.textContent = lang.name;

      var code = document.createElement("span");
      code.className = "speech-code";
      code.textContent = lang.id === "off" ? "🔇" : lang.short;

      item.appendChild(name);
      item.appendChild(code);
      menu.appendChild(item);
    });

    var hint = document.createElement("p");
    hint.className = "speech-hint";
    hint.textContent = KK.audio.isMuted() ? "🔇 声音已关闭，朗读也会静音" : "按字母、数字时朗读";
    menu.appendChild(hint);
  }

  function renderSpeech() {
    if (!KK.speech.supported) {
      document.documentElement.classList.remove("has-speech");
      els.speechWrap.classList.add("is-hidden");
      updateNumberCaption();
      return;
    }

    var avail = availableLangs();
    if (!avail.length) {
      document.documentElement.classList.remove("has-speech");
      els.speechWrap.classList.add("is-hidden");
      updateNumberCaption();
      return;
    }
    document.documentElement.classList.add("has-speech");
    els.speechWrap.classList.remove("is-hidden");

    var ids = avail.map(function (l) {
      return l.id;
    });
    var stored = getStoredLang();

    if (state.langChosen && state.lang === "off") {
      state.lang = "off";
    } else if (state.lang !== "off" && ids.indexOf(state.lang) > -1) {
      // 本次会话已选，保持
    } else if (stored === "off") {
      state.lang = "off";
    } else if (stored && ids.indexOf(stored) > -1) {
      state.lang = stored;
    } else {
      // 没选过，或选过的语言现在没有语音：先默认英语
      state.lang = defaultLang(avail);
    }

    var meta = langMeta(state.lang);
    els.speechLabel.textContent = meta ? meta.short : "关";
    els.btnSpeech.classList.toggle("is-off", state.lang === "off");
    els.btnSpeech.setAttribute("aria-label", "朗读语言：" + (meta ? meta.name : "关闭"));

    buildSpeechMenu(avail);
    updateNumberCaption();
    renderFindWord();
  }

  function toggleSpeechMenu(force) {
    var open = typeof force === "boolean" ? force : els.speechMenu.hidden;
    els.speechMenu.hidden = !open;
    els.btnSpeech.setAttribute("aria-expanded", open ? "true" : "false");

    if (open) {
      var selected =
        els.speechMenu.querySelector('.speech-item[aria-selected="true"]') ||
        els.speechMenu.querySelector(".speech-item");
      if (selected) selected.focus();
    } else if (document.activeElement && els.speechMenu.contains(document.activeElement)) {
      els.btnSpeech.focus();
    }
  }

  function moveSpeechFocus(delta) {
    var items = Array.prototype.slice.call(els.speechMenu.querySelectorAll(".speech-item"));
    if (!items.length) return;
    var i = items.indexOf(document.activeElement);
    if (i < 0) i = delta > 0 ? -1 : 0;
    i = (i + delta + items.length) % items.length;
    items[i].focus();
  }

  function selectLang(id) {
    state.lang = id;
    state.langChosen = true;
    saveLang(id);
    toggleSpeechMenu(false);
    renderSpeech();

    if (id === "off") {
      KK.speech.stop();
      toast("已关闭朗读");
      return;
    }

    var meta = langMeta(id);
    toast("朗读：" + (meta ? meta.name : id));

    // 数字模式要等孩子填对之后再念，这里不试听
    if (state.mode === "number" || KK.audio.isMuted()) return;

    if (state.mode === "spell") {
      startSpellRound();
      return;
    }

    ensureAudio();
    setTimeout(function () {
      KK.speech.speak("A", id, { delay: 100 });
    }, 150);
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
    else if (state.mode === "number") pressNumber(k);
    else if (state.mode === "spell") pressSpell(k);
  }

  function onKeydown(e) {
    if (!els.speechMenu.hidden) {
      if (e.code === "Escape") {
        e.preventDefault();
        toggleSpeechMenu(false);
        return;
      }
      if (e.code === "ArrowDown" || e.code === "ArrowUp") {
        e.preventDefault();
        moveSpeechFocus(e.code === "ArrowDown" ? 1 : -1);
        return;
      }
      if (e.code === "Tab") {
        e.preventDefault();
        moveSpeechFocus(e.shiftKey ? -1 : 1);
        return;
      }
      if (e.code === "Enter" || e.code === "NumpadEnter" || e.code === "Space") {
        var activeItem = document.activeElement;
        if (activeItem && activeItem.classList && activeItem.classList.contains("speech-item")) {
          e.preventDefault();
          activeItem.click();
          return;
        }
      }
      toggleSpeechMenu(false);
    }

    // 焦点在按钮上时，把 Enter / 空格留给按钮自己（原生点击）
    var focused = document.activeElement;
    if (
      focused &&
      focused.tagName === "BUTTON" &&
      (e.code === "Space" || e.code === "Enter" || e.code === "NumpadEnter")
    ) {
      if (e.code === "Enter" || e.code === "NumpadEnter") {
        e.preventDefault();
        focused.click();
      }
      return;
    }

    if (e.repeat) {
      if (!e.metaKey && !e.ctrlKey) e.preventDefault();
      return;
    }

    ensureAudio();
    if (shouldPrevent(e)) e.preventDefault();

    // Ctrl / Cmd / Alt 组合留给浏览器，别抢
    if ((e.ctrlKey || e.metaKey || e.altKey) && !MODIFIER_CODE.test(e.code || "")) return;

    dispatch(KK.keymap.resolve(e));
  }

  /* ---------------- 启动 ---------------- */

  function bind() {
    document.addEventListener("keydown", onKeydown, { passive: false });

    document.addEventListener("pointerdown", ensureAudio, { passive: true });

    $$(".mode").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setMode(btn.dataset.mode);
      });
    });

    els.btnSound.addEventListener("click", toggleSound);
    els.btnCase.addEventListener("click", toggleCase);
    els.btnClearNumber.addEventListener("click", function () {
      ensureAudio();
      numberClear();
    });
    els.btnLite.addEventListener("click", toggleLite);
    els.btnFull.addEventListener("click", toggleFullscreen);

    bindTipSpeaker(els.bubble, "find");
    bindTipSpeaker(els.numberBubble, "number");
    bindTipSpeaker(els.spellBubble, "spell");

    els.btnSpeech.addEventListener("click", function (e) {
      e.stopPropagation();
      toggleSpeechMenu();
    });

    els.speechMenu.addEventListener("click", function (e) {
      var item = e.target && e.target.closest ? e.target.closest(".speech-item") : null;
      if (!item) return;
      selectLang(item.getAttribute("data-lang"));
    });

    document.addEventListener(
      "pointerdown",
      function (e) {
        if (!els.speechMenu.hidden && !els.speechWrap.contains(e.target)) toggleSpeechMenu(false);
      },
      { passive: true }
    );

    document.addEventListener("fullscreenchange", syncFull);
    document.addEventListener("webkitfullscreenchange", syncFull);

    window.addEventListener("resize", function () {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(refitAll);
    });
  }

  function boot() {
    els = {
      btnSound: $("btnSound"),
      btnLite: $("btnLite"),
      btnCase: $("btnCase"),
      caseLabel: $("caseLabel"),
      speechWrap: $("speechWrap"),
      btnSpeech: $("btnSpeech"),
      speechMenu: $("speechMenu"),
      speechLabel: $("speechLabel"),
      btnFull: $("btnFull"),
      starsPill: $("starsPill"),
      starCount: $("starCount"),
      gFree: $("gFree"),
      gFreeCap: $("gFreeCap"),
      gFind: $("gFind"),
      gFindCap: $("gFindCap"),
      gPiano: $("gPiano"),
      gPianoCap: $("gPianoCap"),
      gNumber: $("gNumber"),
      gNumberCap: $("gNumberCap"),
      numberTarget: $("numberTarget"),
      spellEmoji: $("spellEmoji"),
      spellWord: $("spellWord"),
      spellLang: $("spellLang"),
      spellSlots: $("spellSlots"),
      spellBig: $("spellBig"),
      spellCap: $("spellCap"),
      btnClearNumber: $("btnClearNumber"),
      findTarget: $("findTarget"),
      findWord: $("findWord"),
      bubble: $("bubble"),
      numberBubble: $("numberBubble"),
      spellBubble: $("spellBubble"),
      trail: $("trail"),
      toast: $("toast"),
      flash: $("flash")
    };

    loadStars();
    renderStars(false);
    state.letterCase = loadCase();
    renderCase();
    renderSound();
    renderTrail();
    bind();
    renderSpeech();
    KK.speech.onVoices(renderSpeech);
    applyLite(loadLite(), false);
    KK.fx.init();
    setMode("free");
    syncFull();

    // 调试用：index.html?demo=1&mode=find&key=B
    // 也可用 ?lite=1 / ?lite=0 强制切换流畅模式
    var query = new URLSearchParams(window.location.search);
    if (query.get("lite") === "1") {
      applyLite(true, false);
      if (KK.fx.refresh) KK.fx.refresh();
    } else if (query.get("lite") === "0") {
      applyLite(false, false);
      if (KK.fx.refresh) KK.fx.refresh();
    }

    if (query.get("demo") === "1") {
      var demoMode = query.get("mode");
      if (demoMode === "find" || demoMode === "piano" || demoMode === "number" || demoMode === "spell") {
        setMode(demoMode);
      }

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
