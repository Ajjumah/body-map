/* Sea Point Lions Club — Bingo Caller
 * Plain JavaScript, no dependencies, no network calls at runtime.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'splc-bingo-v1';
  var LETTERS = ['B', 'I', 'N', 'G', 'O'];
  var MIN_MAX = 10;
  var MAX_MAX = 200;
  var ROLL_MS = 900;
  var ROLL_TICK_MS = 70;
  var DEFAULT_SETTINGS = { max: 75, letters: true, voice: true, voiceURI: '', animation: true };

  // Tiny silent looping videos used to keep the screen awake where the Wake Lock API is missing.
  var NOSLEEP_MP4 = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAMrbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAB9AAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAlV0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAB9AAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAABAAAAAQAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAfQAAAAAAABAAAAAAHNbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAABAAAAAgABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABeG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAThzdGJsAAAAuHN0c2QAAAAAAAAAAQAAAKhhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAABAAEABIAAAASAAAAAAAAAABFUxhdmM2MC4zMS4xMDIgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAALmF2Y0MBQsAK/+EAFmdCwArZHsBEAAADAAQAAAMACDxImSABAAVoy4PLIAAAABBwYXNwAAAAAQAAAAEAAAAUYnRydAAAAAAAAApAAAAKQAAAABhzdHRzAAAAAAAAAAEAAAACAABAAAAAABRzdHNzAAAAAAAAAAEAAAABAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAACAAAAAQAAABxzdHN6AAAAAAAAAAAAAAACAAAChgAAAAoAAAAUc3RjbwAAAAAAAAABAAADWwAAAGJ1ZHRhAAAAWm1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALWlsc3QAAAAlqXRvbwAAAB1kYXRhAAAAAQAAAABMYXZmNjAuMTYuMTAwAAAACGZyZWUAAAKYbWRhdAAAAnAGBf//bNxF6b3m2Ui3lizYINkj7u94MjY0IC0gY29yZSAxNjQgcjMxMDggMzFlMTlmOSAtIEguMjY0L01QRUctNCBBVkMgY29kZWMgLSBDb3B5bGVmdCAyMDAzLTIwMjMgLSBodHRwOi8vd3d3LnZpZGVvbGFuLm9yZy94MjY0Lmh0bWwgLSBvcHRpb25zOiBjYWJhYz0wIHJlZj0zIGRlYmxvY2s9MTowOjAgYW5hbHlzZT0weDE6MHgxMTEgbWU9aGV4IHN1Ym1lPTcgcHN5PTEgcHN5X3JkPTEuMDA6MC4wMCBtaXhlZF9yZWY9MSBtZV9yYW5nZT0xNiBjaHJvbWFfbWU9MSB0cmVsbGlzPTEgOHg4ZGN0PTAgY3FtPTAgZGVhZHpvbmU9MjEsMTEgZmFzdF9wc2tpcD0xIGNocm9tYV9xcF9vZmZzZXQ9LTIgdGhyZWFkcz0xIGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0wIGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9MCB3ZWlnaHRwPTAga2V5aW50PTI1MCBrZXlpbnRfbWluPTEgc2NlbmVjdXQ9NDAgaW50cmFfcmVmcmVzaD0wIHJjX2xvb2thaGVhZD00MCByYz1jcmYgbWJ0cmVlPTEgY3JmPTIzLjAgcWNvbXA9MC42MCBxcG1pbj0wIHFwbWF4PTY5IHFwc3RlcD00IGlwX3JhdGlvPTEuNDAgYXE9MToxLjAwAIAAAAAOZYiEBb///w9FAAFPf4AAAAAGQZo4CvqA';
  var NOSLEEP_WEBM = 'data:video/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAH9EU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHYTbuMU6uEElTDZ1OsggEeTbuMU6uEHFO7a1OsggHn7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsirXsYMPQkBNgI1MYXZmNjAuMTYuMTAwV0GNTGF2ZjYwLjE2LjEwMESJiECfQAAAAAAAFlSua8GuAQAAAAAAADjXgQFzxYia187dsxwhAZyBACK1nIN1bmSIgQCGhVZfVlA4g4EBI+ODhDuaygDgibCBELqBEJqBAhJUw2f8c3OgY8CAZ8iaRaOHRU5DT0RFUkSHjUxhdmY2MC4xNi4xMDBzc9ZjwItjxYia187dsxwhAWfIoUWjh0VOQ09ERVJEh5RMYXZjNjAuMzEuMTAyIGxpYnZweGfIoUWjiERVUkFUSU9ORIeTMDA6MDA6MDIuMDAwMDAwMDAwAB9DtnXD54EAo6OBAACAEAIAnQEqEAAQAABHCIWFiJmEiAICAAwNYAD+/6tQgKOZgQPoALEBAAEQEAAYADA/9AwAAAD+/6tQgBxTu2uRu4+zgQC3iveBAfGCAZ/wgQM=';

  function $(id) { return document.getElementById(id); }

  var el = {
    app: $('app'),
    counterValue: $('counter-value'),
    current: $('current'),
    currentLetter: $('current-letter'),
    currentNumber: $('current-number'),
    hint: $('current-hint'),
    recent: $('recent'),
    wake: $('wake'),
    call: $('btn-call'),
    repeat: $('btn-repeat'),
    undo: $('btn-undo'),
    check: $('btn-check'),
    history: $('btn-history'),
    newGame: $('btn-new'),
    fullscreen: $('btn-fullscreen'),
    settings: $('btn-settings'),
    boardWrap: $('board-wrap'),
    board: $('board'),
    boardExpand: $('board-expand'),
    dlgConfirm: $('dlg-confirm'),
    confirmTitle: $('confirm-title'),
    confirmText: $('confirm-text'),
    confirmOk: $('confirm-ok'),
    confirmCancel: $('confirm-cancel'),
    dlgHistory: $('dlg-history'),
    historyList: $('history-list'),
    historyEmpty: $('history-empty'),
    dlgCheck: $('dlg-check'),
    checkInput: $('check-input'),
    checkClear: $('check-clear'),
    checkSummary: $('check-summary'),
    checkResults: $('check-results'),
    checkGrid: $('check-grid'),
    dlgSettings: $('dlg-settings'),
    setMax: $('set-max'),
    rangeNote: $('range-note'),
    setLetters: $('set-letters'),
    lettersNote: $('letters-note'),
    setAnim: $('set-anim'),
    voiceGroup: $('voice-group'),
    setVoice: $('set-voice'),
    setVoicePick: $('set-voice-pick'),
    voiceTest: $('voice-test'),
    reset: $('btn-reset')
  };

  var reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  var compactLayout = matchMedia('(orientation: portrait), (orientation: landscape) and (max-height: 560px)');

  /* ---------------- Storage (never throws) ---------------- */

  var storage = {
    load: function () {
      try {
        var raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },
    save: function (data) {
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable */ }
    },
    clear: function () {
      try { window.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* storage unavailable */ }
    }
  };

  /* ---------------- Randomness ---------------- */

  // Unbiased integer in [0, n) from crypto.getRandomValues
  function randomInt(n) {
    var buf = new Uint32Array(1);
    var limit = Math.floor(0x100000000 / n) * n;
    var x;
    do {
      window.crypto.getRandomValues(buf);
      x = buf[0];
    } while (x >= limit);
    return x % n;
  }

  // Fisher–Yates shuffle of 1..max
  function shuffledDeck(max) {
    var deck = [];
    for (var i = 1; i <= max; i++) deck.push(i);
    for (var j = deck.length - 1; j > 0; j--) {
      var k = randomInt(j + 1);
      var tmp = deck[j]; deck[j] = deck[k]; deck[k] = tmp;
    }
    return deck;
  }

  /* ---------------- State ---------------- */

  function clampMax(v) {
    v = Math.round(Number(v));
    if (!isFinite(v)) return null;
    if (v < MIN_MAX || v > MAX_MAX) return null;
    return v;
  }

  function newGameState(settings) {
    return {
      max: settings.max,
      letters: settings.letters,
      voice: settings.voice,
      voiceURI: settings.voiceURI,
      animation: settings.animation,
      deck: shuffledDeck(settings.max),
      called: []
    };
  }

  // A saved game is only restored if deck + called is exactly 1..max
  function isValidGame(s) {
    if (!s || !Array.isArray(s.deck) || !Array.isArray(s.called)) return false;
    var max = clampMax(s.max);
    if (max === null || max !== s.max) return false;
    if (s.deck.length + s.called.length !== max) return false;
    var seen = new Uint8Array(max + 1);
    var all = s.deck.concat(s.called);
    for (var i = 0; i < all.length; i++) {
      var n = all[i];
      if (typeof n !== 'number' || n % 1 !== 0 || n < 1 || n > max || seen[n]) return false;
      seen[n] = 1;
    }
    return true;
  }

  function loadState() {
    var saved = storage.load();
    var settings = {
      max: DEFAULT_SETTINGS.max,
      letters: DEFAULT_SETTINGS.letters,
      voice: DEFAULT_SETTINGS.voice,
      voiceURI: DEFAULT_SETTINGS.voiceURI,
      animation: DEFAULT_SETTINGS.animation
    };
    if (saved && typeof saved === 'object') {
      if (clampMax(saved.max) !== null) settings.max = clampMax(saved.max);
      if (typeof saved.letters === 'boolean') settings.letters = saved.letters;
      if (typeof saved.voice === 'boolean') settings.voice = saved.voice;
      if (typeof saved.voiceURI === 'string') settings.voiceURI = saved.voiceURI;
      if (typeof saved.animation === 'boolean') settings.animation = saved.animation;
      if (isValidGame(saved)) {
        settings.deck = saved.deck.slice();
        settings.called = saved.called.slice();
        return settings;
      }
    }
    return newGameState(settings);
  }

  var state = loadState();

  function save() { storage.save(state); }

  function lettersPossible() { return state.max % 5 === 0; }
  function lettersOn() { return state.letters && lettersPossible(); }
  function letterFor(n) { return LETTERS[Math.floor((n - 1) / (state.max / 5))]; }
  function label(n) { return lettersOn() ? letterFor(n) + ' ' + n : String(n); }

  /* ---------------- Draw animation ---------------- */

  var rolling = null; // { n, timer, endTimer }

  function animationEnabled() { return state.animation && !reducedMotion.matches; }

  function startRoll(n) {
    var stopAt = Date.now() + ROLL_MS;
    el.current.classList.add('is-rolling');
    el.current.classList.remove('is-empty');
    el.hint.hidden = true;
    function tick() {
      var r = randomInt(state.max) + 1;
      el.currentLetter.textContent = lettersOn() ? letterFor(r) : '';
      el.currentNumber.textContent = String(r);
    }
    tick();
    rolling = {
      n: n,
      timer: setInterval(tick, ROLL_TICK_MS),
      endTimer: setTimeout(finishRoll, Math.max(0, stopAt - Date.now()))
    };
  }

  function finishRoll() {
    if (!rolling) return;
    clearInterval(rolling.timer);
    clearTimeout(rolling.endTimer);
    var n = rolling.n;
    rolling = null;
    el.current.classList.remove('is-rolling');
    render();
    flashCurrent();
    announce(n);
  }

  function flashCurrent() {
    el.current.classList.remove('is-landed');
    void el.current.offsetWidth; // restart CSS animation
    el.current.classList.add('is-landed');
  }

  /* ---------------- Game actions ---------------- */

  function callNext() {
    if (rolling) { finishRoll(); return; } // a second press just skips the animation
    if (!state.deck.length) return;
    var n = state.deck.pop();
    state.called.push(n);
    save();
    if (animationEnabled()) {
      startRoll(n);
      render();
    } else {
      render();
      flashCurrent();
      announce(n);
    }
  }

  function undoLast() {
    if (!state.called.length) return;
    var last = state.called[state.called.length - 1];
    confirmDialog({
      title: 'Undo last call?',
      text: 'Put ' + label(last) + ' back so it can be drawn again?',
      ok: 'Undo ' + label(last)
    }).then(function (ok) {
      if (!ok || !state.called.length) return;
      if (rolling) finishRoll();
      stopSpeaking();
      var n = state.called.pop();
      state.deck.splice(randomInt(state.deck.length + 1), 0, n);
      save();
      render();
    });
  }

  function startNewGame(max) {
    if (rolling) {
      clearInterval(rolling.timer);
      clearTimeout(rolling.endTimer);
      rolling = null;
      el.current.classList.remove('is-rolling');
    }
    stopSpeaking();
    state = newGameState({
      max: max || state.max,
      letters: state.letters,
      voice: state.voice,
      voiceURI: state.voiceURI,
      animation: state.animation
    });
    save();
    checkSelection = [];
    el.checkInput.value = '';
    buildBoard();
    render();
  }

  function confirmNewGame() {
    confirmDialog({
      title: 'New game',
      text: 'Start a new game? All called numbers will be cleared.',
      ok: 'Start new game'
    }).then(function (ok) { if (ok) startNewGame(); });
  }

  function repeatCall() {
    var n = state.called[state.called.length - 1];
    if (!n) return;
    if (rolling) { finishRoll(); return; }
    flashCurrent();
    speak(n, true);
  }

  /* ---------------- Rendering ---------------- */

  var cells = []; // index = number
  var boardLayoutKey = '';

  function buildBoard() {
    var max = state.max;
    var letters = lettersOn();
    var key = max + ':' + letters;
    if (key === boardLayoutKey) return;
    boardLayoutKey = key;
    el.board.textContent = '';
    cells = [null];
    var frag = document.createDocumentFragment();
    if (letters) {
      for (var g = 0; g < 5; g++) {
        var lab = document.createElement('div');
        lab.className = 'label';
        lab.textContent = LETTERS[g];
        lab.setAttribute('aria-hidden', 'true');
        lab.dataset.group = String(g);
        frag.appendChild(lab);
      }
    }
    for (var n = 1; n <= max; n++) {
      var c = document.createElement('div');
      c.className = 'cell';
      c.setAttribute('role', 'listitem');
      c.textContent = String(n);
      cells.push(c);
      frag.appendChild(c);
    }
    el.board.appendChild(frag);
    fitBoard();
  }

  // While the draw animation plays, the in-flight number stays hidden everywhere
  function render() {
    var called = state.called;
    var visible = rolling ? called.slice(0, -1) : called;
    var lastN = visible[visible.length - 1];

    buildBoard();

    // Current number
    if (!rolling) {
      if (lastN) {
        el.currentLetter.textContent = lettersOn() ? letterFor(lastN) : '';
        el.currentNumber.textContent = String(lastN);
        el.current.classList.remove('is-empty');
        el.current.setAttribute('aria-label', 'Current call ' + label(lastN));
      } else {
        el.currentLetter.textContent = '';
        el.currentNumber.textContent = '–';
        el.current.classList.add('is-empty');
        el.current.setAttribute('aria-label', 'No number called yet');
      }
      el.hint.hidden = !!lastN;
    }

    // Previous five calls (most recent first)
    var prev = visible.slice(-6, -1).reverse();
    el.recent.textContent = '';
    prev.forEach(function (n) {
      var li = document.createElement('li');
      if (lettersOn()) {
        var l = document.createElement('span');
        l.className = 'l';
        l.textContent = letterFor(n);
        li.appendChild(l);
      }
      li.appendChild(document.createTextNode(String(n)));
      el.recent.appendChild(li);
    });

    // Board
    var calledSet = new Uint8Array(state.max + 1);
    visible.forEach(function (n) { calledSet[n] = 1; });
    for (var n = 1; n <= state.max; n++) {
      var c = cells[n];
      var isCalled = calledSet[n] === 1;
      var isLast = n === lastN;
      if (c.classList.contains('called') !== isCalled) {
        c.classList.toggle('called', isCalled);
        c.setAttribute('aria-label', label(n) + (isCalled ? ', called' : ''));
      }
      if (c.classList.contains('last') !== isLast) c.classList.toggle('last', isLast);
    }

    // Counter & buttons
    el.counterValue.textContent = visible.length + ' / ' + state.max;
    el.app.classList.toggle('is-big', state.max > 100);
    var done = state.deck.length === 0;
    el.call.disabled = done && !rolling;
    el.call.textContent = done ? 'All numbers called' : 'Call Next Number';
    el.undo.disabled = called.length === 0;
    el.repeat.disabled = called.length === 0;

    if (el.dlgHistory.open) renderHistory();
    if (el.dlgCheck.open) renderCheck();
  }

  /* Fits the board to its box: one row per letter like a masterboard when letters are on,
     otherwise the column count that gives the biggest numerals. */
  function fitBoard() {
    var board = el.board;
    var wrap = el.boardWrap;
    var W = board.clientWidth;
    var H = board.clientHeight;
    if (!W || !H) return;

    var max = state.max;
    var letters = lettersOn();
    var digits = String(max).length;
    var gap = Math.min(W, H) > 500 ? 6 : 3;
    var compact = compactLayout.matches || wrap.classList.contains('is-expanded');
    var minFs = 14;

    function fontFor(cw, ch) { return Math.min(ch * 0.62, cw / (digits * 0.58 + 0.3)); }

    function evaluate(cols) {
      var rows, totalCols, k = 1;
      if (letters) {
        var per = max / 5;
        k = Math.ceil(per / cols);
        rows = 5 * k;
        totalCols = cols + 1;
      } else {
        rows = Math.ceil(max / cols);
        totalCols = cols;
      }
      var cw = (W - gap * (totalCols - 1)) / totalCols;
      var ch = (H - gap * (rows - 1)) / rows;
      return { cols: cols, rows: rows, k: k, cw: cw, ch: ch, fs: fontFor(cw, ch) };
    }

    var limit = letters ? max / 5 : max;
    var best = null;
    var bestScore = -1;
    var oneRow = null;
    for (var cols = 1; cols <= limit; cols++) {
      var r = evaluate(cols);
      if (letters && r.k === 1 && !oneRow) oneRow = r;
      // Avoid layouts that leave a mostly empty last row
      if (letters && cols * r.k - max / 5 >= r.k) continue;
      var score = r.fs * (cols % 10 === 0 ? 1.06 : cols % 5 === 0 ? 1.03 : 1);
      if (score > bestScore) { bestScore = score; best = r; }
    }
    // Keep the classic one-row-per-letter masterboard whenever it is comfortably readable
    if (letters && oneRow && oneRow.fs >= Math.max(24, best.fs * 0.8)) best = oneRow;

    var scroll = false;
    if (best.fs < minFs && compact) {
      // Small screen: keep numerals legible and let the board scroll
      scroll = true;
      var cellW = minFs * (digits * 0.58 + 0.3);
      var fitCols = Math.min(limit, Math.max(1, Math.floor((W + gap) / (cellW + gap)) - (letters ? 1 : 0)));
      if (letters) {
        // Spread each letter's numbers evenly over its rows (no lonely last row)
        fitCols = Math.ceil(limit / Math.ceil(limit / fitCols));
      } else if (fitCols >= 10) {
        fitCols -= fitCols % 5;
      }
      best = evaluate(fitCols);
      best.fs = minFs;
      best.ch = Math.max(best.ch, minFs / 0.6);
    }

    wrap.classList.toggle('is-scroll', scroll);
    board.style.setProperty('--board-gap', gap + 'px');
    board.style.setProperty('--fs', Math.max(10, Math.floor(best.fs)) + 'px');
    board.style.gridTemplateColumns = (letters ? 'minmax(0, 1.1fr) ' : '') + 'repeat(' + best.cols + ', minmax(0, 1fr))';
    board.style.gridTemplateRows = scroll
      ? 'repeat(' + best.rows + ', ' + Math.ceil(best.ch) + 'px)'
      : 'repeat(' + best.rows + ', minmax(0, 1fr))';

    // Explicit placement keeps each letter's numbers on its own row(s)
    var offset = letters ? 2 : 1;
    if (letters) {
      var per = max / 5;
      var labels = board.querySelectorAll('.label');
      for (var g = 0; g < 5; g++) {
        labels[g].style.gridRow = (g * best.k + 1) + ' / span ' + best.k;
        labels[g].style.gridColumn = '1';
      }
      for (var n = 1; n <= max; n++) {
        var grp = Math.floor((n - 1) / per);
        var i = (n - 1) % per;
        cells[n].style.gridRow = String(grp * best.k + Math.floor(i / best.cols) + 1);
        cells[n].style.gridColumn = String((i % best.cols) + offset);
      }
    } else {
      for (var m = 1; m <= max; m++) {
        cells[m].style.gridRow = String(Math.floor((m - 1) / best.cols) + 1);
        cells[m].style.gridColumn = String(((m - 1) % best.cols) + offset);
      }
    }
  }

  /* ---------------- Voice ---------------- */

  var synth = window.speechSynthesis || null;
  var voices = [];

  function englishFirst(a, b) {
    function rank(v) {
      var lang = (v.lang || '').toLowerCase().replace('_', '-');
      if (lang === 'en-za') return 0;
      if (lang === 'en-gb') return 1;
      if (lang.indexOf('en') === 0) return 2;
      return 3;
    }
    return rank(a) - rank(b) || (b.localService === true) - (a.localService === true) || a.name.localeCompare(b.name);
  }

  function loadVoices() {
    if (!synth) return;
    var list = synth.getVoices() || [];
    voices = list.slice().sort(englishFirst);
    var english = voices.filter(function (v) { return (v.lang || '').toLowerCase().indexOf('en') === 0; });
    var shown = english.length ? english : voices;
    el.voiceGroup.hidden = voices.length === 0;
    el.setVoicePick.textContent = '';
    var auto = document.createElement('option');
    auto.value = '';
    var pick = defaultVoice();
    auto.textContent = 'Automatic' + (pick ? ' (' + pick.name + ')' : '');
    el.setVoicePick.appendChild(auto);
    shown.forEach(function (v) {
      var o = document.createElement('option');
      o.value = v.voiceURI;
      o.textContent = v.name + ' — ' + v.lang;
      el.setVoicePick.appendChild(o);
    });
    el.setVoicePick.value = state.voiceURI && voices.some(function (v) { return v.voiceURI === state.voiceURI; }) ? state.voiceURI : '';
  }

  function defaultVoice() {
    if (!voices.length) return null;
    var en = voices.filter(function (v) { return (v.lang || '').toLowerCase().indexOf('en') === 0; });
    if (!en.length) return voices.filter(function (v) { return v.default; })[0] || voices[0];
    var local = en.filter(function (v) { return v.localService; });
    return (local.length ? local : en)[0];
  }

  function chosenVoice() {
    if (state.voiceURI) {
      for (var i = 0; i < voices.length; i++) if (voices[i].voiceURI === state.voiceURI) return voices[i];
    }
    return defaultVoice();
  }

  function stopSpeaking() { if (synth) try { synth.cancel(); } catch (e) { /* ignore */ } }

  var speakTimer = null;
  function speakText(text) {
    if (!synth || !voices.length) return;
    stopSpeaking();
    clearTimeout(speakTimer);
    // A short gap after cancel() avoids Chrome dropping the next utterance
    speakTimer = setTimeout(function () {
      var u = new SpeechSynthesisUtterance(text);
      var v = chosenVoice();
      if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = 'en-GB'; }
      u.rate = 0.85;
      u.pitch = 1;
      u.volume = 1;
      synth.speak(u);
    }, 60);
  }

  function spoken(n) {
    return lettersOn() ? letterFor(n) + '... ' + n : String(n);
  }

  function speak(n, force) {
    if (!force && !state.voice) return;
    speakText(spoken(n));
  }

  function announce(n) { speak(n, false); }

  // iOS only lets speech start from a user gesture; unlock it on the first tap/key
  function unlockSpeech() {
    if (!synth) return;
    try {
      var u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      synth.speak(u);
    } catch (e) { /* ignore */ }
  }

  if (synth) {
    loadVoices();
    if (typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', loadVoices);
    else synth.onvoiceschanged = loadVoices;
  }

  /* ---------------- Screen wake lock ---------------- */

  var wake = { sentinel: null, video: null, status: 'pending' };

  function setWakeStatus(status) {
    wake.status = status;
    var text = {
      on: 'Screen lock: On',
      pending: 'Screen lock: …',
      gesture: 'Screen lock: tap anywhere to turn on',
      unsupported: 'Not supported — set device auto-lock to Never'
    }[status];
    el.wake.textContent = text;
    el.wake.classList.toggle('is-off', status !== 'on' && status !== 'pending');
  }

  function requestWakeLock() {
    if (document.visibilityState !== 'visible') return Promise.resolve(false);
    if (wake.sentinel) return Promise.resolve(true);
    if (!('wakeLock' in navigator)) return Promise.resolve(false);
    return navigator.wakeLock.request('screen').then(function (sentinel) {
      wake.sentinel = sentinel;
      sentinel.addEventListener('release', function () {
        wake.sentinel = null;
        if (document.visibilityState === 'visible') acquireWake();
        else setWakeStatus('pending');
      });
      setWakeStatus('on');
      return true;
    }, function () { return false; });
  }

  function videoFallback() {
    if (!wake.video) {
      var v = document.createElement('video');
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
      v.setAttribute('muted', '');
      v.setAttribute('aria-hidden', 'true');
      v.setAttribute('title', 'Keeps the screen awake');
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.style.cssText = 'position:fixed;left:0;bottom:0;width:1px;height:1px;opacity:0.01;pointer-events:none;';
      var webm = document.createElement('source');
      webm.src = NOSLEEP_WEBM;
      webm.type = 'video/webm';
      var mp4 = document.createElement('source');
      mp4.src = NOSLEEP_MP4;
      mp4.type = 'video/mp4';
      v.appendChild(webm);
      v.appendChild(mp4);
      v.addEventListener('playing', function () { if (!wake.sentinel) setWakeStatus('on'); });
      document.body.appendChild(v);
      wake.video = v;
    }
    var p;
    try { p = wake.video.play(); } catch (e) { return Promise.resolve(false); }
    if (!p || typeof p.then !== 'function') return Promise.resolve(!wake.video.paused);
    return p.then(function () { return true; }, function () { return false; });
  }

  var waitingForGesture = false;
  function acquireWake(fromGesture) {
    return requestWakeLock().then(function (ok) {
      if (ok) return;
      if (!('wakeLock' in navigator) || fromGesture) {
        return videoFallback().then(function (playing) {
          if (playing) { setWakeStatus('on'); return; }
          if (fromGesture) setWakeStatus('unsupported');
          else waitForGesture();
        });
      }
      waitForGesture();
    });
  }

  function waitForGesture() {
    setWakeStatus('gesture');
    if (waitingForGesture) return;
    waitingForGesture = true;
    function onGesture() {
      document.removeEventListener('pointerdown', onGesture, true);
      document.removeEventListener('keydown', onGesture, true);
      waitingForGesture = false;
      acquireWake(true);
    }
    document.addEventListener('pointerdown', onGesture, true);
    document.addEventListener('keydown', onGesture, true);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    if (wake.video && !wake.sentinel) {
      videoFallback().then(function (playing) { if (!playing) waitForGesture(); });
    } else {
      acquireWake(false);
    }
  });

  /* ---------------- Fullscreen ---------------- */

  var docEl = document.documentElement;
  var fsSupported = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  function fsElement() { return document.fullscreenElement || document.webkitFullscreenElement || null; }

  function toggleFullscreen() {
    if (!fsSupported) return;
    try {
      if (fsElement()) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else {
        var req = docEl.requestFullscreen || docEl.webkitRequestFullscreen;
        var p = req.call(docEl);
        if (p && p.catch) p.catch(function () { /* user agent refused */ });
      }
    } catch (e) { /* ignore */ }
  }
  function onFsChange() { docEl.classList.toggle('is-fullscreen', !!fsElement()); }
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);
  if (!fsSupported) el.fullscreen.hidden = true;

  /* ---------------- Dialogs ---------------- */

  function openDialog(d) {
    if (d.open) return;
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', '');
  }

  function closeDialog(d) {
    if (!d.open) return;
    if (typeof d.close === 'function') d.close();
    else d.removeAttribute('open');
  }

  var confirmResolve = null;
  function confirmDialog(opts) {
    if (confirmResolve) confirmResolve(false);
    el.confirmTitle.textContent = opts.title;
    el.confirmText.textContent = opts.text;
    el.confirmOk.textContent = opts.ok || 'OK';
    el.dlgConfirm.returnValue = '';
    openDialog(el.dlgConfirm);
    el.confirmCancel.focus();
    return new Promise(function (resolve) { confirmResolve = resolve; });
  }
  el.dlgConfirm.addEventListener('close', function () {
    var r = confirmResolve;
    confirmResolve = null;
    if (r) r(el.dlgConfirm.returnValue === 'ok');
  });

  // Click on the dark backdrop closes a sheet
  Array.prototype.forEach.call(document.querySelectorAll('dialog'), function (d) {
    d.addEventListener('click', function (e) {
      if (e.target !== d) return;
      var r = d.getBoundingClientRect();
      var inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) closeDialog(d);
    });
  });

  /* ---------------- History ---------------- */

  function ordinal(i) {
    var s = ['th', 'st', 'nd', 'rd'];
    var v = i % 100;
    return i + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function renderHistory() {
    var list = el.historyList;
    list.textContent = '';
    el.historyEmpty.hidden = state.called.length > 0;
    var visible = rolling ? state.called.slice(0, -1) : state.called;
    visible.forEach(function (n, i) {
      var li = document.createElement('li');
      var ord = document.createElement('span');
      ord.className = 'ord';
      ord.textContent = ordinal(i + 1);
      var val = document.createElement('span');
      val.className = 'val';
      val.textContent = label(n);
      li.appendChild(ord);
      li.appendChild(val);
      list.appendChild(li);
    });
  }

  function openHistory() {
    if (el.dlgHistory.open) { closeDialog(el.dlgHistory); return; }
    renderHistory();
    openDialog(el.dlgHistory);
    var scroller = el.dlgHistory.querySelector('.sheet-scroll');
    scroller.scrollTop = scroller.scrollHeight;
  }

  /* ---------------- Check a card ---------------- */

  var checkSelection = [];
  var CHECK_LIMIT = 25;

  function parseCheckInput(text) {
    var nums = (text.match(/\d+/g) || []).map(Number);
    var out = [];
    nums.forEach(function (n) { if (out.indexOf(n) === -1) out.push(n); });
    return out;
  }

  function buildCheckGrid() {
    var grid = el.checkGrid;
    if (grid.dataset.max === String(state.max) + ':' + lettersOn()) return;
    grid.dataset.max = String(state.max) + ':' + lettersOn();
    grid.textContent = '';
    for (var n = 1; n <= state.max; n++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = String(n);
      b.dataset.n = String(n);
      b.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-label', label(n));
      grid.appendChild(b);
    }
  }

  function renderCheck() {
    buildCheckGrid();
    var visibleCalled = rolling ? state.called.slice(0, -1) : state.called;
    var calledSet = {};
    visibleCalled.forEach(function (n) { calledSet[n] = true; });

    var list = checkSelection.slice(0, CHECK_LIMIT);
    el.checkResults.textContent = '';
    var yes = 0, no = 0, bad = 0;
    list.forEach(function (n) {
      var li = document.createElement('li');
      var mark = document.createElement('span');
      mark.className = 'mark';
      var text;
      if (n < 1 || n > state.max) {
        li.className = 'bad';
        mark.textContent = '!';
        text = n + ' not in game';
        bad++;
      } else if (calledSet[n]) {
        li.className = 'yes';
        mark.textContent = '✓';
        text = label(n);
        yes++;
      } else {
        li.className = 'no';
        mark.textContent = '✗';
        text = label(n) + ' not called';
        no++;
      }
      li.appendChild(mark);
      li.appendChild(document.createTextNode(text));
      el.checkResults.appendChild(li);
    });

    var summary = '';
    el.checkSummary.classList.remove('ok');
    if (list.length) {
      if (no === 0 && bad === 0) {
        summary = '✓ All ' + yes + ' number' + (yes === 1 ? ' has' : 's have') + ' been called';
        el.checkSummary.classList.add('ok');
      } else {
        summary = yes + ' of ' + list.length + ' called — ' + (no + bad) + ' not called';
      }
      if (checkSelection.length > CHECK_LIMIT) summary += ' (only the first 25 are checked)';
    }
    el.checkSummary.textContent = summary;

    Array.prototype.forEach.call(el.checkGrid.children, function (b) {
      var n = Number(b.dataset.n);
      var on = list.indexOf(n) !== -1;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.classList.toggle('is-called', !!calledSet[n]);
    });
  }

  function openCheck() {
    if (el.dlgCheck.open) { closeDialog(el.dlgCheck); return; }
    renderCheck();
    openDialog(el.dlgCheck);
    // Don't pop up the on-screen keyboard on phones/tablets; tapping the grid is easier there
    if (!compactLayout.matches) el.checkInput.focus();
  }

  el.checkInput.addEventListener('input', function () {
    checkSelection = parseCheckInput(el.checkInput.value);
    renderCheck();
  });
  el.checkGrid.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-n]');
    if (!b) return;
    var n = Number(b.dataset.n);
    var i = checkSelection.indexOf(n);
    if (i === -1) {
      if (checkSelection.length >= CHECK_LIMIT) return;
      checkSelection.push(n);
    } else {
      checkSelection.splice(i, 1);
    }
    el.checkInput.value = checkSelection.join(' ');
    renderCheck();
  });
  el.checkClear.addEventListener('click', function () {
    checkSelection = [];
    el.checkInput.value = '';
    renderCheck();
  });

  /* ---------------- Settings ---------------- */

  function renderSettings() {
    el.setMax.value = String(state.max);
    Array.prototype.forEach.call(document.querySelectorAll('[data-preset]'), function (b) {
      b.setAttribute('aria-pressed', String(Number(b.dataset.preset) === state.max));
    });
    el.rangeNote.textContent = state.called.length
      ? 'A game is in progress. Changing the range will start a new game.'
      : 'Choose any highest number from 10 to 200.';

    var possible = lettersPossible();
    el.setLetters.disabled = !possible;
    el.setLetters.checked = state.letters && possible;
    el.lettersNote.textContent = possible
      ? ''
      : 'Letters are off: ' + state.max + ' can’t be split into 5 equal columns. Use a range divisible by 5 (e.g. 75 or 100).';

    el.setAnim.checked = state.animation;
    el.setVoice.checked = state.voice;
    el.setVoicePick.disabled = !state.voice;
    if (synth) loadVoices();
  }

  function openSettings() {
    renderSettings();
    openDialog(el.dlgSettings);
  }

  function changeMax(v) {
    var max = clampMax(v);
    if (max === null) {
      el.rangeNote.textContent = 'Please enter a whole number from 10 to 200.';
      el.setMax.value = String(state.max);
      return;
    }
    if (max === state.max) { renderSettings(); return; }
    if (!state.called.length) {
      startNewGame(max);
      renderSettings();
      return;
    }
    confirmDialog({
      title: 'Change range?',
      text: 'Start a new game with numbers 1–' + max + '? All called numbers will be cleared.',
      ok: 'Start new game'
    }).then(function (ok) {
      if (ok) startNewGame(max);
      renderSettings();
    });
  }

  el.setMax.addEventListener('change', function () { changeMax(el.setMax.value); });
  el.setMax.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); changeMax(el.setMax.value); }
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-preset]'), function (b) {
    b.addEventListener('click', function () { changeMax(Number(b.dataset.preset)); });
  });
  el.setLetters.addEventListener('change', function () {
    state.letters = el.setLetters.checked;
    save();
    render();
    renderSettings();
  });
  el.setAnim.addEventListener('change', function () {
    state.animation = el.setAnim.checked;
    save();
  });
  el.setVoice.addEventListener('change', function () {
    state.voice = el.setVoice.checked;
    if (!state.voice) stopSpeaking();
    save();
    renderSettings();
  });
  el.setVoicePick.addEventListener('change', function () {
    state.voiceURI = el.setVoicePick.value;
    save();
  });
  el.voiceTest.addEventListener('click', function () {
    var n = state.called[state.called.length - 1] || 42;
    speakText(spoken(Math.min(n, state.max)));
  });
  el.reset.addEventListener('click', function () {
    confirmDialog({
      title: 'Reset everything?',
      text: 'This clears the current game and all settings on this device.',
      ok: 'Reset everything'
    }).then(function (ok) {
      if (!ok) return;
      storage.clear();
      state.letters = DEFAULT_SETTINGS.letters;
      state.voice = DEFAULT_SETTINGS.voice;
      state.voiceURI = DEFAULT_SETTINGS.voiceURI;
      state.animation = DEFAULT_SETTINGS.animation;
      startNewGame(DEFAULT_SETTINGS.max);
      renderSettings();
      closeDialog(el.dlgSettings);
    });
  });

  /* ---------------- Board expand (phones) ---------------- */

  function setBoardExpanded(on) {
    el.boardWrap.classList.toggle('is-expanded', on);
    el.boardExpand.setAttribute('aria-label', on ? 'Close the full-screen board' : 'Show the board full screen');
    fitBoard();
  }

  el.boardWrap.addEventListener('click', function (e) {
    var expanded = el.boardWrap.classList.contains('is-expanded');
    if (!expanded && !compactLayout.matches) return;
    if (e.target.closest('.board-expand') || !expanded || e.target === el.boardWrap || e.target.closest('.board')) {
      setBoardExpanded(!expanded);
    }
  });

  /* ---------------- Wiring ---------------- */

  el.call.addEventListener('click', callNext);
  el.undo.addEventListener('click', undoLast);
  el.newGame.addEventListener('click', confirmNewGame);
  el.repeat.addEventListener('click', repeatCall);
  el.history.addEventListener('click', openHistory);
  el.check.addEventListener('click', openCheck);
  el.settings.addEventListener('click', openSettings);
  el.fullscreen.addEventListener('click', toggleFullscreen);

  // Unless the caller is moving around with Tab, keep focus off buttons so Space/Enter
  // always mean "Call Next Number" (even right after closing a panel)
  var tabbing = false;
  document.addEventListener('keydown', function (e) { if (e.key === 'Tab') tabbing = true; }, true);
  document.addEventListener('pointerdown', function () { tabbing = false; }, true);
  el.app.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (b && e.detail > 0) b.blur();
  });
  Array.prototype.forEach.call(document.querySelectorAll('dialog'), function (d) {
    d.addEventListener('close', function () {
      var a = document.activeElement;
      if (!tabbing && a && a !== document.body && el.app.contains(a) && !document.querySelector('dialog[open]')) a.blur();
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    var t = e.target;
    var tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    var key = e.key;
    if (key === ' ' || key === 'Spacebar' || key === 'Enter') {
      // Let a button the caller reached with Tab do its own job
      if (tag === 'BUTTON' && t !== el.call && tabbing) return;
      e.preventDefault();
      if (!e.repeat) callNext();
      return;
    }
    if (e.repeat) return;
    switch (key.toLowerCase()) {
      case 'u': e.preventDefault(); undoLast(); break;
      case 'f': e.preventDefault(); toggleFullscreen(); break;
      case 'h': e.preventDefault(); openHistory(); break;
      case 'r': e.preventDefault(); repeatCall(); break;
      case 'c': e.preventDefault(); openCheck(); break;
      case 'escape':
        if (el.boardWrap.classList.contains('is-expanded')) setBoardExpanded(false);
        break;
    }
  });

  var unlocked = false;
  function firstGesture() {
    if (unlocked) return;
    unlocked = true;
    unlockSpeech();
  }
  document.addEventListener('pointerdown', firstGesture, true);
  document.addEventListener('keydown', firstGesture, true);

  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(function () { fitBoard(); }).observe(el.board);
  } else {
    window.addEventListener('resize', fitBoard);
  }
  if (typeof compactLayout.addEventListener === 'function') {
    compactLayout.addEventListener('change', function () {
      if (!compactLayout.matches) setBoardExpanded(false);
      fitBoard();
    });
  }

  /* ---------------- Start ---------------- */

  buildBoard();
  render();
  save();
  acquireWake(false);

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline install not available */ });
    });
  }

  // Exposed for automated checks only
  window.__bingo = { state: function () { return JSON.parse(JSON.stringify(state)); } };
})();
