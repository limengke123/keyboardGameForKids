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

  function voiceFor(lang) {
    var want = normalize(lang);
    if (!supported || !want || want === "off") return null;

    var prefix = want.split("-")[0];
    var exact = [];
    var loose = [];

    for (var i = 0; i < voices.length; i++) {
      var v = voices[i];
      var vl = normalize(v.lang);
      if (vl === want) exact.push(v);
      else if (vl.indexOf(prefix + "-") === 0) loose.push(v);
    }

    var pool = exact.length ? exact : loose;
    if (!pool.length) return null;

    // 本地语音优先（更快、离线可用），其次是系统默认
    pool.sort(function (a, b) {
      var la = a.localService ? 1 : 0;
      var lb = b.localService ? 1 : 0;
      if (la !== lb) return lb - la;
      var da = a.default ? 1 : 0;
      var db = b.default ? 1 : 0;
      return db - da;
    });

    return pool[0];
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
