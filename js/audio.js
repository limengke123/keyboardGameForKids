/* =========================================================
   咚咚键盘 — 现场合成的音效
   一个音频文件都不需要：Web Audio API + 五声音阶
   浏览器要求先有一次点击/按键，才能出声
   ========================================================= */

window.KK = window.KK || {};

KK.audio = (function () {
  "use strict";

  var ctx = null;
  var master = null;
  var echoSend = null;
  var ready = false;
  var muted = false;
  var MUTE_KEY = "dongdong.muted";
  var VOLUME = 0.52;

  try {
    muted = localStorage.getItem(MUTE_KEY) === "1";
  } catch (e) {}

  function init() {
    if (ready) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;

    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : VOLUME;
    master.connect(ctx.destination);

    // 一点点回声，让声音更“木头”、更暖
    var delay = ctx.createDelay(0.6);
    delay.delayTime.value = 0.17;
    var feedback = ctx.createGain();
    feedback.gain.value = 0.2;
    var wet = ctx.createGain();
    wet.gain.value = 0.14;
    echoSend = ctx.createGain();
    echoSend.gain.value = 1;

    echoSend.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(master);

    ready = true;
  }

  function resume() {
    if (ctx && ctx.state === "suspended") {
      var p = ctx.resume();
      if (p && p.catch) p.catch(function () {});
    }
  }

  function isMuted() {
    return muted;
  }

  function setMuted(m) {
    muted = !!m;
    try {
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch (e) {}
    if (master && ctx) {
      var t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setTargetAtTime(muted ? 0 : VOLUME, t, 0.05);
    }
  }

  // 一个音符：正弦 / 三角波 + 指数衰减包络
  function tone(o) {
    if (!ready || !ctx || muted) return;
    if (ctx.state === "suspended") resume();

    var t = ctx.currentTime;
    var dur = o.dur || 0.4;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();

    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.glide) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freq * o.glide), t + dur);
    }
    if (o.detune) osc.detune.value = o.detune;

    var peak = o.gain == null ? 0.2 : o.gain;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + (o.attack || 0.006));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(gain);
    gain.connect(master);

    if (o.echo) {
      var send = ctx.createGain();
      send.gain.value = o.echo;
      gain.connect(send);
      send.connect(echoSend);
    }

    osc.start(t);
    osc.stop(t + dur + 0.06);
    osc.onended = function () {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch (e) {}
    };
  }

  // 随便按：像木琴“咚”一下
  function pop(freq) {
    if (muted) return;
    tone({ freq: freq, type: "triangle", dur: 0.5, gain: 0.2, echo: 0.28 });
    tone({ freq: freq * 2, type: "sine", dur: 0.2, gain: 0.05, echo: 0.12 });
    tone({ freq: freq * 0.5, type: "sine", dur: 0.38, gain: 0.07 });
  }

  // 小钢琴：更长、更柔的音
  function piano(freq) {
    if (muted) return;
    tone({ freq: freq, type: "triangle", dur: 1.25, gain: 0.16, attack: 0.012, echo: 0.42 });
    tone({ freq: freq * 2, type: "sine", dur: 0.6, gain: 0.045, echo: 0.3 });
  }

  function sequence(freqs, gap, opts) {
    if (muted) return;
    var base = opts || {};
    freqs.forEach(function (f, i) {
      setTimeout(function () {
        tone({
          freq: f,
          type: base.type || "triangle",
          dur: base.dur || 0.38,
          gain: base.gain || 0.16,
          echo: 0.3
        });
      }, i * gap);
    });
  }

  // 答对：往上跑的四个音
  function success() {
    sequence([523.25, 659.25, 783.99, 1046.5], 90, { dur: 0.5, gain: 0.18 });
  }

  // 答错：轻轻“啵”一声，不吓人
  function oops() {
    if (muted) return;
    tone({ freq: 233.08, type: "sine", dur: 0.24, gain: 0.07, glide: 0.82 });
    setTimeout(function () {
      tone({ freq: 196, type: "sine", dur: 0.26, gain: 0.055 });
    }, 130);
  }

  function chime() {
    if (muted) return;
    tone({ freq: 880, type: "sine", dur: 0.32, gain: 0.07, echo: 0.35 });
    setTimeout(function () {
      tone({ freq: 1174.66, type: "sine", dur: 0.4, gain: 0.06, echo: 0.4 });
    }, 110);
  }

  // 攒满 10 颗星星
  function sweep() {
    sequence([523.25, 587.33, 659.25, 783.99, 880, 1046.5], 65, { dur: 0.42, gain: 0.15 });
  }

  return {
    init: init,
    resume: resume,
    isMuted: isMuted,
    setMuted: setMuted,
    pop: pop,
    piano: piano,
    success: success,
    oops: oops,
    chime: chime,
    sweep: sweep
  };
})();
