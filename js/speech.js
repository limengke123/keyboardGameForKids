/* =========================================================
   咚咚键盘 — 语音朗读
   浏览器内置的 Web Speech API：不联网、不引第三方、无音频文件
   可用语言取决于系统里装了哪些语音
   ========================================================= */

window.KK = window.KK || {};

KK.speech = (function () {
  "use strict";

  var synth = window.speechSynthesis;
  var Utterance = window.SpeechSynthesisUtterance;
  var supported = !!(synth && Utterance);

  var voices = [];
  var signature = "";
  var seq = 0;
  var timer = 0;
  var listeners = [];

  // macOS / iOS 自带的搞怪语音，教学场景直接跳过
  var NOVELTY = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Basso|Blow|Bottle|Frog|Funk|Pipe Organ|Grandma|Grandpa|Rocko|Sandy|Shelley|Flo|Eddy|Reed|Radio|Hysterical)\b/i;

  // 每种语言优先挑这些“正常”的声音；不同平台命名不同，命中就加分
  var PREFERRED = {
    en: ["Samantha", "Ava", "Alli", "Allison", "Tom", "Alex", "Google US English", "Microsoft Aria", "Microsoft Jenny", "Microsoft Zira", "Daniel", "Karen", "Moira", "Tessa", "Serena", "Kate", "Oliver", "Aaron"],
    fr: ["Amélie", "Amelie", "Thomas", "Audrey", "Jacques", "Google français", "Microsoft Denise", "Microsoft Henri"],
    zh: ["Tingting", "婷婷", "Meijia", "美佳", "Sinji", "Microsoft Huihui", "Microsoft Xiaoxiao", "Microsoft Yunxi", "Google 普通话（中国大陆）"],
    es: ["Mónica", "Monica", "Paulina", "Jorge", "Diego", "Google español", "Microsoft Elvira", "Microsoft Pablo"],
    de: ["Anna", "Markus", "Yuna", "Google Deutsch", "Microsoft Katja", "Microsoft Conrad"],
    ja: ["Kyoko", "Otoya", "O-ren", "Hattori", "Google 日本語", "Microsoft Nanami", "Microsoft Keita"]
  };

  function usable(v) {
    return !!(v && v.lang && !NOVELTY.test(v.name || ""));
  }

  function scoreVoice(v, preferred) {
    var score = 0;

    // 优先用 Google 的语音
    if (/^Google\b/i.test(v.name || "")) score += 2000;

    var i = preferred.indexOf(v.name);
    if (i > -1) score += 500 - i * 10;
    if (v.localService) score += 30;
    if (v.default) score += 20;
    return score;
  }

  function normalize(lang) {
    return String(lang || "").toLowerCase().replace("_", "-");
  }

  function notify() {
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i]();
      } catch (e) {}
    }
  }

  function refresh() {
    if (!supported) return voices;

    var list = [];
    try {
      list = synth.getVoices() || [];
    } catch (e) {
      list = [];
    }

    var sig = list
      .map(function (v) {
        return (v.voiceURI || v.name) + "|" + v.lang;
      })
      .join(",");

    voices = list;

    if (sig !== signature) {
      signature = sig;
      notify();
    }
    return voices;
  }

  function voiceCandidates(lang) {
    var want = normalize(lang);
    if (!supported || !want || want === "off") return [];

    var prefix = want.split("-")[0];
    var exact = [];
    var loose = [];

    for (var i = 0; i < voices.length; i++) {
      var v = voices[i];
      if (!usable(v)) continue;
      var vl = normalize(v.lang);
      if (vl === want) exact.push(v);
      else if (vl.indexOf(prefix + "-") === 0) loose.push(v);
    }

    var pool = exact.length ? exact : loose;
    var preferred = PREFERRED[prefix] || [];

    pool.sort(function (a, b) {
      return scoreVoice(b, preferred) - scoreVoice(a, preferred);
    });

    return pool;
  }

  function voiceFor(lang) {
    var list = voiceCandidates(lang);
    return list.length ? list[0] : null;
  }

  function speak(text, lang, opts) {
    if (!supported || !text) return false;

    var voice = voiceFor(lang);
    if (!voice) return false;

    opts = opts || {};

    // 打断上一句，避免连续按键时越排越长
    try {
      synth.cancel();
    } catch (e) {}
    if (synth.paused) {
      try {
        synth.resume();
      } catch (e) {}
    }

    var u = new Utterance(String(text));
    try {
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = opts.rate == null ? 0.88 : opts.rate;
      u.pitch = opts.pitch == null ? 1.05 : opts.pitch;
      u.volume = opts.volume == null ? 1 : opts.volume;
    } catch (e) {}

    var id = ++seq;
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (id !== seq) return;
      try {
        synth.speak(u);
      } catch (e) {}
    }, opts.delay == null ? 20 : opts.delay);

    return true;
  }

  function stop() {
    seq++;
    clearTimeout(timer);
    if (!supported) return;
    try {
      synth.cancel();
    } catch (e) {}
  }

  function onVoices(fn) {
    if (typeof fn === "function") listeners.push(fn);
  }

  if (supported) {
    refresh();

    try {
      if (typeof synth.addEventListener === "function") {
        synth.addEventListener("voiceschanged", refresh);
      } else {
        synth.onvoiceschanged = refresh;
      }
    } catch (e) {}

    // 部分浏览器首次 getVoices() 是空的，稍后再取几次
    setTimeout(refresh, 350);
    setTimeout(refresh, 1200);
  }

  return {
    supported: supported,
    refresh: refresh,
    voiceFor: voiceFor,
    speak: speak,
    stop: stop,
    onVoices: onVoices,
    voices: function () {
      return voices;
    }
  };
})();
