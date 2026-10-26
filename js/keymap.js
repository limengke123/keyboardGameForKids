/* =========================================================
   咚咚键盘 — 键位词典
   把 keydown 的 e.code 翻译成：巨字、说明、emoji、音高
   ========================================================= */

window.KK = window.KK || {};

KK.keymap = (function () {
  "use strict";

  var IS_MAC = /Mac|iPhone|iPad|iPod/.test(navigator.platform || "");

  // 字母 + 一个小朋友熟悉的词
  var LETTER_WORDS = {
    A: ["苹果", "🍎"],
    B: ["气球", "🎈"],
    C: ["小猫", "🐱"],
    D: ["小狗", "🐶"],
    E: ["大象", "🐘"],
    F: ["小鱼", "🐟"],
    G: ["葡萄", "🍇"],
    H: ["帽子", "🎩"],
    I: ["冰淇淋", "🍦"],
    J: ["果汁", "🧃"],
    K: ["风筝", "🪁"],
    L: ["狮子", "🦁"],
    M: ["月亮", "🌙"],
    N: ["鼻子", "👃"],
    O: ["橙子", "🍊"],
    P: ["熊猫", "🐼"],
    Q: ["女王", "👑"],
    R: ["兔子", "🐰"],
    S: ["太阳", "☀️"],
    T: ["老虎", "🐯"],
    U: ["雨伞", "☂️"],
    V: ["小提琴", "🎻"],
    W: ["鲸鱼", "🐳"],
    X: ["木琴", "🎹"],
    Y: ["悠悠球", "🪀"],
    Z: ["斑马", "🦓"]
  };

  // 找一找里的「字母 + 单词」按语言各一套
  var EN_WORDS = {
    A: ["apple", "🍎"],
    B: ["balloon", "🎈"],
    C: ["cat", "🐱"],
    D: ["dog", "🐶"],
    E: ["elephant", "🐘"],
    F: ["fish", "🐟"],
    G: ["grapes", "🍇"],
    H: ["hat", "🎩"],
    I: ["ice cream", "🍦"],
    J: ["juice", "🧃"],
    K: ["kite", "🪁"],
    L: ["lion", "🦁"],
    M: ["moon", "🌙"],
    N: ["nose", "👃"],
    O: ["orange", "🍊"],
    P: ["panda", "🐼"],
    Q: ["queen", "👑"],
    R: ["rabbit", "🐰"],
    S: ["sun", "☀️"],
    T: ["tiger", "🐯"],
    U: ["umbrella", "☂️"],
    V: ["violin", "🎻"],
    W: ["whale", "🐳"],
    X: ["xylophone", "🎹"],
    Y: ["yo-yo", "🪀"],
    Z: ["zebra", "🦓"]
  };

  var FR_WORDS = {
    A: ["avion", "✈️"],
    B: ["ballon", "🎈"],
    C: ["chat", "🐱"],
    D: ["dauphin", "🐬"],
    E: ["éléphant", "🐘"],
    F: ["fleur", "🌸"],
    G: ["girafe", "🦒"],
    H: ["hibou", "🦉"],
    I: ["igloo", "🛖"],
    J: ["jardin", "🌳"],
    K: ["koala", "🐨"],
    L: ["lune", "🌙"],
    M: ["maison", "🏠"],
    N: ["nuage", "☁️"],
    O: ["orange", "🍊"],
    P: ["pomme", "🍎"],
    Q: ["quatre", "4️⃣"],
    R: ["renard", "🦊"],
    S: ["soleil", "☀️"],
    T: ["tortue", "🐢"],
    U: ["uniforme", "👕"],
    V: ["vélo", "🚲"],
    W: ["wagon", "🚃"],
    X: ["xylophone", "🎹"],
    Y: ["yaourt", "🥣"],
    Z: ["zèbre", "🦓"]
  };

  var WORDS = {
    "zh-CN": LETTER_WORDS,
    "en-US": EN_WORDS,
    "fr-FR": FR_WORDS
  };

  var PHRASE = {
    "zh-CN": function (letter, word) {
      return letter + "，" + word;
    },
    "en-US": function (letter, word) {
      return letter + " for " + word;
    },
    "fr-FR": function (letter, word) {
      return letter + " comme " + word;
    }
  };

  function wordFor(letter, lang) {
    var table = WORDS[lang];
    var item = table && table[letter];
    if (!item) return null;

    var make = PHRASE[lang];
    return {
      word: item[0],
      emoji: item[1],
      phrase: make ? make(letter, item[0]) : letter
    };
  }

  var DIGIT_WORDS = {
    "0": ["鸡蛋", "🥚"],
    "1": ["蜡烛", "🕯️"],
    "2": ["小鸭", "🦆"],
    "3": ["三叶草", "🍀"],
    "4": ["帆船", "⛵"],
    "5": ["手掌", "🖐️"],
    "6": ["樱桃", "🍒"],
    "7": ["彩虹", "🌈"],
    "8": ["雪人", "⛄"],
    "9": ["气球", "🎈"]
  };

  var SPECIAL = {
    Space: { big: "空格", caption: "跳一下 🚀", emoji: "🚀" },
    Enter: { big: "回车", caption: "确认！✅", emoji: "✅" },
    NumpadEnter: { big: "回车", caption: "小键盘的回车 ⏎", emoji: "⏎" },
    Backspace: { big: "退格", caption: "擦掉一个字 🧽", emoji: "🧽" },
    Tab: { big: "Tab", caption: "跳一格 ➡️", emoji: "➡️" },
    Escape: { big: "Esc", caption: "逃跑啦 🏃", emoji: "🏃" },
    CapsLock: { big: "大写", caption: "全部变大写 🔠", emoji: "🔠" },
    ShiftLeft: { big: "Shift", caption: "大写的魔法 ✨", emoji: "✨" },
    ShiftRight: { big: "Shift", caption: "大写的魔法 ✨", emoji: "✨" },
    ControlLeft: { big: "Ctrl", caption: "控制键 🎮", emoji: "🎮" },
    ControlRight: { big: "Ctrl", caption: "控制键 🎮", emoji: "🎮" },
    AltLeft: { big: "Alt", caption: "备用键 🌀", emoji: "🌀" },
    AltRight: { big: "Alt", caption: "备用键 🌀", emoji: "🌀" },
    MetaLeft: { big: IS_MAC ? "Cmd" : "Win", caption: IS_MAC ? "苹果键 🍎" : "窗口键 🪟", emoji: "🍎" },
    MetaRight: { big: IS_MAC ? "Cmd" : "Win", caption: IS_MAC ? "苹果键 🍎" : "窗口键 🪟", emoji: "🍎" },
    ContextMenu: { big: "菜单", caption: "菜单键 📋", emoji: "📋" },
    ArrowUp: { big: "↑", caption: "往上飞 ⬆️", emoji: "⬆️" },
    ArrowDown: { big: "↓", caption: "往下掉 ⬇️", emoji: "⬇️" },
    ArrowLeft: { big: "←", caption: "往左走 ⬅️", emoji: "⬅️" },
    ArrowRight: { big: "→", caption: "往右走 ➡️", emoji: "➡️" },
    Insert: { big: "插入", caption: "插入键 📥", emoji: "📥" },
    Delete: { big: "删除", caption: "删除键 🗑️", emoji: "🗑️" },
    Home: { big: "Home", caption: "回到开头 🏠", emoji: "🏠" },
    End: { big: "End", caption: "跳到结尾 🔚", emoji: "🔚" },
    PageUp: { big: "PgUp", caption: "往上翻 📄", emoji: "📄" },
    PageDown: { big: "PgDn", caption: "往下翻 📃", emoji: "📃" },
    NumLock: { big: "Num", caption: "小键盘开关 🔢", emoji: "🔢" },
    ScrollLock: { big: "ScrLk", caption: "滚动锁定 🔒", emoji: "🔒" },
    PrintScreen: { big: "截图", caption: "咔嚓！📸", emoji: "📸" },
    Pause: { big: "暂停", caption: "休息一下 ⏸️", emoji: "⏸️" },
    AudioVolumeUp: { big: "🔊", caption: "声音大一点", emoji: "🔊" },
    AudioVolumeDown: { big: "🔉", caption: "声音小一点", emoji: "🔉" },
    AudioVolumeMute: { big: "🔇", caption: "嘘——安静", emoji: "🔇" },
    MediaPlayPause: { big: "⏯️", caption: "播放 / 暂停", emoji: "⏯️" },
    MediaTrackNext: { big: "⏭️", caption: "下一首", emoji: "⏭️" },
    MediaTrackPrevious: { big: "⏮️", caption: "上一首", emoji: "⏮️" }
  };

  for (var fi = 1; fi <= 12; fi++) {
    SPECIAL["F" + fi] = { big: "F" + fi, caption: "功能键 " + fi + " 🎛️", emoji: "🎛️" };
  }

  var PUNCT = {
    Backquote: { big: "`", caption: "小勾勾 〜", emoji: "✨" },
    Minus: { big: "-", caption: "减号 ➖", emoji: "➖" },
    Equal: { big: "=", caption: "等号 🟰", emoji: "🟰" },
    BracketLeft: { big: "[", caption: "左方括号 📐", emoji: "📐" },
    BracketRight: { big: "]", caption: "右方括号 📐", emoji: "📐" },
    Backslash: { big: "\\", caption: "反斜杠 ✏️", emoji: "✏️" },
    IntlBackslash: { big: "\\", caption: "反斜杠 ✏️", emoji: "✏️" },
    Semicolon: { big: ";", caption: "分号 ✏️", emoji: "✏️" },
    Quote: { big: "'", caption: "单引号 ✏️", emoji: "✏️" },
    Comma: { big: ",", caption: "逗号 · 喘口气 😮‍💨", emoji: "😮‍💨" },
    Period: { big: ".", caption: "句号 · 说完啦 🔵", emoji: "🔵" },
    Slash: { big: "/", caption: "斜杠 ✏️", emoji: "✏️" },
    IntlRo: { big: "\\", caption: "反斜杠 ✏️", emoji: "✏️" },
    IntlYen: { big: "¥", caption: "日元符号 💴", emoji: "💴" },
    NumpadAdd: { big: "+", caption: "小键盘加号 ➕", emoji: "➕" },
    NumpadSubtract: { big: "−", caption: "小键盘减号 ➖", emoji: "➖" },
    NumpadMultiply: { big: "×", caption: "小键盘乘号 ✖️", emoji: "✖️" },
    NumpadDivide: { big: "÷", caption: "小键盘除号 ➗", emoji: "➗" },
    NumpadDecimal: { big: ".", caption: "小键盘小数点 🔵", emoji: "🔵" }
  };

  function resolve(e) {
    var code = (e && e.code) || "";
    var keyChar = (e && e.key) || "";
    var ch = "";

    // 优先用真正敲出来的字符（兼容 AZERTY 等非 US 布局）；
    // 中文输入法下 e.key 会变成 "Process"，这时退回物理键位 e.code
    if (/^[a-zA-Z]$/.test(keyChar)) {
      ch = keyChar.toUpperCase();
    } else {
      var mLetter = /^Key([A-Z])$/.exec(code);
      if (mLetter) ch = mLetter[1];
    }

    if (ch) {
      var w = LETTER_WORDS[ch] || ["字母", "🔤"];
      return {
        code: code || "Key" + ch,
        key: ch,
        big: ch,
        caption: w[0] + " " + w[1],
        emoji: w[1]
      };
    }

    if (/^[0-9]$/.test(keyChar) || /^Digit[0-9]$/.test(code) || /^Numpad[0-9]$/.test(code)) {
      var d = /^[0-9]$/.test(keyChar) ? keyChar : code.replace(/^(Digit|Numpad)/, "");
      return {
        code: code || "Digit" + d,
        key: d,
        big: d,
        caption: DIGIT_WORDS[d][0] + " " + DIGIT_WORDS[d][1],
        emoji: DIGIT_WORDS[d][1]
      };
    }

    if (SPECIAL[code]) {
      var sp = SPECIAL[code];
      return { code: code, key: null, big: sp.big, caption: sp.caption, emoji: sp.emoji };
    }

    if (PUNCT[code]) {
      var pu = PUNCT[code];
      return { code: code, key: null, big: pu.big, caption: pu.caption, emoji: pu.emoji };
    }

    // 兜底：有些设备 / 输入法只给 e.key
    if (keyChar.length === 1 && keyChar !== " ") {
      return { code: code, key: keyChar.toUpperCase(), big: keyChar.toUpperCase(), caption: "这个键 ✨", emoji: "✨" };
    }

    // 修饰键组合等，给一个“不认识”的可爱回应
    if (/^(Shift|Control|Alt|Meta|OS)$/.test(keyChar)) {
      return { code: code, key: null, big: "按住", caption: "按住它，再按别的键 ✨", emoji: "✨" };
    }

    return { code: code, key: null, big: "?", caption: "这个键我不认识 🤔", emoji: "🤔" };
  }

  /* ---- 小钢琴：物理相邻的键 → 音高相邻 ---- */

  var ROWS = [
    ["Backquote", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0", "Minus", "Equal"],
    ["Tab", "KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft", "BracketRight", "Backslash"],
    ["CapsLock", "KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote", "Enter"],
    ["ShiftLeft", "KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period", "Slash", "ShiftRight"]
  ];
  var SCALE = [0, 2, 4, 7, 9]; // 五声音阶：怎么按都不会难听
  var SOLFEGE = ["Do", "Re", "Mi", "Sol", "La"];

  function noteFor(code) {
    var row = -1;
    var col = 0;
    var i;
    var r;

    for (r = 0; r < ROWS.length; r++) {
      i = ROWS[r].indexOf(code);
      if (i > -1) {
        row = r;
        col = i;
        break;
      }
    }

    if (row === -1) {
      var h = 0;
      for (i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) | 0;
      row = 1;
      col = Math.abs(h) % 12;
    }

    var step = col + row * 4;
    var idx = step % 15;
    var oct = Math.floor(idx / 5);
    var semi = oct * 12 + SCALE[idx % 5];
    var freq = 220 * Math.pow(2, semi / 12);

    return { freq: freq, solfege: SOLFEGE[idx % 5], step: step };
  }

  /* ---- 找一找的题库：去掉容易看混的 I / O / 0 / 1 ---- */

  var FIND_POOL = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("").concat("23456789".split(""));

  return {
    resolve: resolve,
    noteFor: noteFor,
    FIND_POOL: FIND_POOL,
    LETTER_WORDS: LETTER_WORDS,
    wordFor: wordFor
  };
})();
