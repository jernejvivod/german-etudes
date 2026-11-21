// App shell: topic picker, topic options, and the generic drill / summary / table steps.
//
// A topic is { id, title, subtitle, intro, defaults, options, validate?, prepare?, sessions: [{ label, build(settings) → steps }] }
//   intro: text, or settings → text; prepare: async, loads the topic's data when it is opened and resolves to an error or null
//   options: [{ key, label, type: 'radio' | 'checkboxes' | 'toggle', choices?, text?, min?, inline? }]
// A step is { type: 'drill', label, items, hint?, hideTags? } or { type: 'table', label, table }.
// A drill item may name the Anki notes it uses (notes): once it is checked they count as shown (vocab.markShown), so the
// next rounds bring other cards.
// A table cell's answer is a string or a list of accepted strings (the first is shown as the correction); a block with
// exact: true checks upper / lower case too (Ihr is not ihr).
(function () {
  'use strict';

  const { cloze, nav, topics, vocab, store } = window.Etudes;
  const $ = (id) => document.getElementById(id);

  let screen = 'home';
  let topic = null;
  let settings = null;
  let session = null; // { steps, index }
  let preparing = null; // the topic whose data is still loading, if any
  let prepareError = null;
  let drill = null; // { items, index, results: [{ item, grades }] }
  let cells = []; // table inputs, block by block, each block column-major
  let cellInfo = new Map(); // input → { idx, b, c, r, gap }
  let blocks = []; // per block { start, rows, cols }
  let wrapped = false; // Enter at the last cell went back to a blank cell once; next time it checks

  // ---------- Helpers ----------

  function settingsKey(t) {
    return `etudes-settings-${t.id}`;
  }

  // Saved settings over the defaults, dropping values the topic's options no longer offer.
  function loadSettings(t) {
    const saved = store.read(settingsKey(t), {});
    const result = { ...t.defaults };
    for (const opt of t.options) {
      const value = saved[opt.key];
      const valid = choiceValues(opt);
      if (opt.type === 'radio' && valid.includes(value)) result[opt.key] = value;
      if (opt.type === 'checkboxes' && Array.isArray(value)) result[opt.key] = valid.filter((v) => value.includes(v));
      if (opt.type === 'toggle' && typeof value === 'boolean') result[opt.key] = value;
    }
    return result;
  }

  function saveSettings() {
    store.write(settingsKey(topic), settings);
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function textInput(label) {
    const input = el('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('aria-label', label);
    return input;
  }

  function choiceValues(opt) {
    return opt.choices ? opt.choices.map((c) => c.value) : [];
  }

  function show(id) {
    stopSpeaking(); // another screen (Esc, summary, table) ends the sentence being read
    disarmEscape(); // a round left by a click no longer waits for a second Esc
    screen = id;
    for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
  }

  function tagsFragment(item) {
    const frag = document.createDocumentFragment();
    for (const tag of item.tags) frag.append(el('span', `tag ${tag.cls}`, tag.text));
    return frag;
  }

  function answerFragment(item) {
    const frag = document.createDocumentFragment();
    for (const token of cloze.solved(item)) {
      if (typeof token === 'string') frag.append(token);
      else frag.append(token.prefix, el('b', null, token.answer));
    }
    return frag;
  }

  // ---------- Reading aloud ----------

  // The solved sentence, read by a German voice after checking. On macOS the desktop app reads it with `say` (Anna):
  // Chromium's speechSynthesis there ignores the chosen voice and uses the system default, often an English one.
  // Elsewhere speechSynthesis with a German voice. No German voice: no button and no switch.
  const SPEAK_KEY = 'etudes-speak';
  const host = window.etudesHost;
  const hostSpeech = !!host?.speak; // the desktop app on macOS: `say` (see speech.js)
  // The German voice: true with hostSpeech once main has found one, a SpeechSynthesisVoice otherwise, or null.
  let voice = null;
  let replay = null; // a speechSynthesis replay waiting to start
  let speakingOn = store.read(SPEAK_KEY, true) !== false;

  function showVoice(found) {
    voice = found || null;
    $('speak-setting').hidden = !voice;
  }

  function pickVoice() {
    if (hostSpeech) return;
    const german = (window.speechSynthesis?.getVoices() || []).filter((v) => /^de(-|_|$)/i.test(v.lang));
    showVoice(german.find((v) => v.name === 'Anna') || german.find((v) => /^de-DE/i.test(v.lang)) || german[0]);
  }

  function speak(text) {
    if (!voice) return;
    if (hostSpeech) return void host.speak(text);
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 0.95;
    // Chromium can drop an utterance queued right after cancel(), so a replay waits a moment.
    if (synth.speaking || synth.pending) {
      synth.cancel();
      replay = setTimeout(() => synth.speak(utterance), 50);
    } else synth.speak(utterance);
  }

  function stopSpeaking() {
    clearTimeout(replay);
    if (hostSpeech) host.stopSpeaking();
    else window.speechSynthesis?.cancel();
  }

  // ---------- Home ----------

  function renderHome() {
    const list = $('topics');
    list.replaceChildren();
    for (const t of topics) {
      const card = el('button', 'topic');
      card.dataset.topic = t.id;
      card.append(el('span', 'topic-title', t.title), el('span', 'topic-sub', t.subtitle));
      card.addEventListener('click', () => openTopic(t, true));
      list.append(card);
    }
  }

  // Back on the list, the focus is on the topic just left (Enter reopens it), or on the first.
  function goHome() {
    preparing = null; // a load finishing later must not focus the hidden options screen
    show('home');
    const cards = [...$('topics').children];
    (cards.find((card) => card.dataset.topic === topic?.id) || cards[0])?.focus();
  }

  // ---------- Options ----------

  // fresh: coming from the topic list, so the topic (re)loads its data; going back from a round keeps what is loaded.
  async function openTopic(t, fresh = false) {
    topic = t;
    settings = loadSettings(t);
    $('options-title').textContent = t.title;
    renderOptions();
    renderSessionButtons();
    show('options');
    if (fresh) {
      prepareError = null;
      preparing = null; // a load still running for another topic no longer matters
    }
    if (fresh && t.prepare) {
      const load = t;
      preparing = load;
      $('options-intro').textContent = 'Loading…';
      validateOptions();
      let error;
      try {
        error = await t.prepare();
      } catch (err) {
        error = String(err.message || err);
      }
      if (preparing !== load) return; // another topic (or this one, afresh) was opened meanwhile
      preparing = null;
      prepareError = error;
    }
    renderIntro();
    validateOptions();
    $('options-actions').querySelector('button').focus();
  }

  function renderIntro() {
    $('options-intro').textContent = typeof topic.intro === 'function' ? topic.intro(settings) : topic.intro;
  }

  function choiceLabel(type, name, choice, checked, onChange) {
    const label = el('label', 'radio');
    const input = el('input');
    input.type = type;
    input.name = name;
    input.checked = checked;
    input.addEventListener('change', onChange);
    const text = el('span');
    text.append(el('b', null, choice.label));
    if (choice.detail) text.append(` · ${choice.detail}`);
    label.append(input, ' ', text);
    return label;
  }

  function renderOptions() {
    const form = $('options-form');
    form.replaceChildren();
    for (const opt of topic.options) {
      const fs = el('fieldset', opt.inline ? 'inline' : null);
      fs.append(el('legend', null, opt.label));
      if (opt.type === 'radio') {
        for (const choice of opt.choices) {
          fs.append(choiceLabel('radio', opt.key, choice, settings[opt.key] === choice.value, () => setOption(opt.key, choice.value)));
        }
      } else if (opt.type === 'checkboxes') {
        for (const choice of opt.choices) {
          fs.append(choiceLabel('checkbox', opt.key, choice, settings[opt.key].includes(choice.value), (e) => {
            const values = settings[opt.key].filter((v) => v !== choice.value);
            // Keep the topic's choice order so sessions stay predictable.
            if (e.target.checked) values.push(choice.value);
            setOption(opt.key, choiceValues(opt).filter((v) => values.includes(v)));
          }));
        }
      } else if (opt.type === 'toggle') {
        fs.append(choiceLabel('checkbox', opt.key, { value: 'on', label: opt.text }, !!settings[opt.key], (e) => setOption(opt.key, e.target.checked)));
      }
      form.append(fs);
    }
  }

  // One button per session mode the topic offers; the first is the default (Enter).
  function renderSessionButtons() {
    const actions = $('options-actions');
    actions.replaceChildren();
    topic.sessions.forEach((mode, i) => {
      const button = el('button', i === 0 ? 'primary' : null, mode.label);
      if (i === 0) button.append(' ', el('kbd', null, '↵'));
      button.addEventListener('click', () => startSession(mode));
      actions.append(button);
    });
  }

  function setOption(key, value) {
    settings[key] = value;
    saveSettings();
    if (!preparing) renderIntro();
    validateOptions();
  }

  // Shows the first problem with the settings (or the topic's data) and disables the start buttons while there is one.
  function validateOptions() {
    const tooFew = topic.options.find((opt) => opt.min && settings[opt.key].length < opt.min);
    let error = null;
    if (!preparing) {
      error = prepareError || (tooFew && `Pick at least one: ${tooFew.label.toLowerCase()}.`) || topic.validate?.(settings) || null;
    }
    $('options-error').textContent = error || '';
    $('options-error').hidden = !error;
    for (const button of $('options-actions').querySelectorAll('button')) button.disabled = !!error || preparing;
    return !error && !preparing;
  }

  // ---------- Session ----------

  function startSession(mode) {
    if (!validateOptions()) return;
    session = { mode, steps: mode.build(settings), index: -1 };
    nextStep();
  }

  function nextStep() {
    session.index++;
    const step = session.steps[session.index];
    if (!step) startSession(session.mode);
    else if (step.type === 'drill') startDrill(step);
    else startTable(step);
  }

  function nextStepLabel() {
    const next = session.steps[session.index + 1];
    return next ? `Continue: ${next.label} →` : 'New round';
  }

  // ---------- Drill ----------

  function startDrill(step) {
    drill = { items: step.items, hideTags: !!step.hideTags, index: 0, results: [] };
    $('drill-hint').textContent = step.hint || '';
    show('drill');
    renderItem();
  }

  function isChecked() {
    return drill.results.length > drill.index;
  }

  function updateProgress() {
    $('progress-fill').style.width = `${(drill.results.length / drill.items.length) * 100}%`;
  }

  function renderItem() {
    stopSpeaking();
    const item = drill.items[drill.index];

    $('progress-text').textContent = `${drill.index + 1} / ${drill.items.length}`;
    updateProgress();
    $('tags').replaceChildren(drill.hideTags ? '' : tagsFragment(item));

    const prompt = $('prompt');
    prompt.hidden = !item.prompt;
    if (item.prompt) prompt.replaceChildren(el('span', 'prompt-label', item.prompt.label), item.prompt.text);

    const sentence = $('sentence');
    sentence.replaceChildren();
    for (const token of item.tokens) {
      if (typeof token === 'string') {
        sentence.append(token);
        continue;
      }
      const gap = el('span', 'gap');
      const input = textInput(token.label || token.slot);
      if (!token.prefix) input.classList.add('word');
      if (token.placeholder) input.placeholder = token.placeholder;
      gap.append(token.prefix, input);
      sentence.append(gap);
    }

    $('feedback').hidden = true;
    $('btn-check').hidden = false;
    $('btn-next').hidden = true;
    sentence.querySelector('input').focus();
  }

  function checkItem() {
    const item = drill.items[drill.index];
    const inputs = [...$('sentence').querySelectorAll('input')];
    const grades = cloze.grade(item, inputs.map((i) => i.value));

    grades.forEach(({ gap, ok }, i) => {
      inputs[i].disabled = true;
      inputs[i].classList.add(ok ? 'ok' : 'bad');
      if (!ok) inputs[i].after(el('span', 'fix', cloze.correction(gap)));
    });

    const allOk = grades.every((g) => g.ok);
    drill.results.push({ item, grades });
    vocab.markShown(item.notes);
    updateProgress();

    if (drill.hideTags) $('tags').replaceChildren(tagsFragment(item));

    const answer = el('p', 'answer');
    answer.append(answerFragment(item));
    const verdict = el('p', `verdict ${allOk ? 'ok' : 'bad'}`, allOk ? '✓ Richtig' : '✗ Not quite');
    const spoken = cloze.text(item);
    if (!voice) pickVoice(); // a browser's voices may load only after the page
    if (voice) {
      const listen = el('button', 'ghost listen', '🔊 Listen');
      listen.title = 'Read the sentence aloud (L)';
      // Keep the focus on Next, so Enter still moves on after a click.
      listen.addEventListener('mousedown', (e) => e.preventDefault());
      listen.addEventListener('click', () => speak(spoken));
      verdict.append(listen);
    }
    $('feedback').replaceChildren(verdict, answer, el('p', 'why', item.explain));
    $('feedback').hidden = false;
    if (speakingOn) speak(spoken);

    $('btn-check').hidden = true;
    $('btn-next').hidden = false;
    $('btn-next').focus();
  }

  function nextItem() {
    drill.index++;
    if (drill.index < drill.items.length) renderItem();
    else showSummary();
  }

  // ---------- Summary ----------

  function showSummary() {
    const mistakes = drill.results.filter((r) => r.grades.some((g) => !g.ok));
    $('summary-score').textContent = `${drill.results.length - mistakes.length} / ${drill.results.length} sentences correct`;

    const list = $('mistakes');
    list.replaceChildren();
    for (const { item, grades } of mistakes) {
      const sent = el('div', 'sent');
      sent.append(answerFragment(item));
      const wrong = grades.filter((g) => !g.ok).map((g) => cloze.typed(g.gap, g.value));
      const meta = el('div', 'meta');
      meta.append(`${item.tags.map((t) => t.text).join(' · ')} — you wrote `, el('span', 'given', wrong.join(', ')));
      const li = el('li');
      li.append(sent, meta);
      list.append(li);
    }
    list.hidden = mistakes.length === 0;

    $('btn-summary-next').textContent = nextStepLabel();
    show('summary');
    $('btn-summary-next').focus();
  }

  // ---------- Table ----------

  function startTable(step) {
    wrapped = false;
    const spec = step.table;
    $('table-title').textContent = spec.title;
    $('table-lead').textContent = spec.lead;
    const container = $('tables');
    container.classList.toggle('wide', !!spec.wide);
    container.replaceChildren();
    cells = [];
    cellInfo = new Map();
    blocks = [];

    spec.blocks.forEach((block, b) => {
      const rows = block.rows.length;
      const cols = block.cols.length;
      blocks.push({ start: cells.length, rows, cols });

      const blockEl = el('div', 'block');
      if (block.title) blockEl.append(el('h3', block.cls, block.title));
      if (block.sub) blockEl.append(el('p', 'sub', block.sub));

      // Column-major DOM order, so Tab walks down each column.
      const grid = el('div', 'grid');
      grid.style.gridTemplateRows = `repeat(${rows + 1}, auto)`;
      grid.style.gridTemplateColumns = `auto repeat(${cols}, 1fr)`;
      grid.append(el('span'));
      for (const label of block.rows) grid.append(el('span', 'rowlabel', label));
      block.cols.forEach((col, c) => {
        const head = el('span', `head ${col.cls || ''}`, col.head);
        if (col.sub) head.append(el('span', 'head-sub', col.sub));
        grid.append(head);
        block.rows.forEach((rowLabel, r) => {
          const input = textInput([block.title, col.label || col.head, rowLabel].filter(Boolean).join(' '));
          const [answer, ...alts] = [].concat(block.answers[c][r]);
          const cell = el('div', 'cell');
          cell.append(input);
          grid.append(cell);
          cellInfo.set(input, { idx: cells.length, b, c, r, gap: cloze.gap('cell', null, '', answer, { alts, exact: !!block.exact }) });
          cells.push(input);
        });
      });
      blockEl.append(grid);
      container.append(blockEl);
    });

    $('table-score').hidden = true;
    $('btn-table-retry').hidden = true;
    $('btn-table-next').textContent = nextStepLabel();
    show('table');
    cells[0].focus();
  }

  function cellAt(b, c, r) {
    const block = blocks[b];
    if (!block || c < 0 || c >= block.cols || r < 0 || r >= block.rows) return -1;
    return block.start + c * block.rows + r;
  }

  function onTableKey(e) {
    const info = cellInfo.get(e.target);
    if (!info) return;
    const input = e.target;
    const { idx, b, c, r } = info;
    let target = -1;

    if (e.key === 'Enter') {
      e.preventDefault();
      // Next editable cell; at the end, go back once to a cell still blank (some answers are blank, e.g. "ein-∅"), then check.
      target = cells.findIndex((cell, i) => i > idx && !cell.readOnly);
      if (target < 0 && !wrapped) {
        target = cells.findIndex((cell) => !cell.readOnly && !cell.value.trim());
        wrapped = target >= 0;
      }
      if (target < 0) checkTable();
    } else if (e.key === 'ArrowDown') {
      target = cellAt(b, c, r + 1);
    } else if (e.key === 'ArrowUp') {
      target = cellAt(b, c, r - 1);
    } else if (e.key === 'ArrowRight' && input.selectionStart === input.value.length) {
      target = c + 1 < blocks[b].cols ? cellAt(b, c + 1, r) : cellAt(b + 1, 0, r);
    } else if (e.key === 'ArrowLeft' && input.selectionEnd === 0) {
      target = c > 0 ? cellAt(b, c - 1, r) : b > 0 ? cellAt(b - 1, blocks[b - 1].cols - 1, r) : -1;
    }

    if (target >= 0) {
      e.preventDefault();
      cells[target].focus();
      cells[target].select();
    }
  }

  // The correction badge, if any, sits right after its input.
  function removeFix(input) {
    if (input.nextElementSibling?.classList.contains('fix')) input.nextElementSibling.remove();
  }

  function checkTable() {
    const tableEndings = session.steps[session.index].table.endings;
    let correct = 0;
    for (const input of cells) {
      removeFix(input);
      const { gap } = cellInfo.get(input);
      const ok = cloze.isCorrectGap(gap, input.value);
      input.classList.toggle('ok', ok);
      input.classList.toggle('bad', !ok);
      input.readOnly = ok;
      if (ok) correct++;
      else input.after(el('span', 'fix', tableEndings ? cloze.display(gap.answer) : gap.answer));
    }

    const perfect = correct === cells.length;
    const score = $('table-score');
    score.textContent = `${correct} / ${cells.length} ${perfect ? '— perfekt!' : 'correct'}`;
    score.hidden = false;
    $('btn-table-retry').hidden = perfect;
    (perfect ? $('btn-table-next') : $('btn-table-retry')).focus();
  }

  function retryTable() {
    wrapped = false;
    const wrong = cells.filter((i) => i.classList.contains('bad'));
    for (const input of wrong) {
      input.value = '';
      input.classList.remove('bad');
      removeFix(input);
    }
    $('table-score').hidden = true;
    $('btn-table-retry').hidden = true;
    wrong[0]?.focus();
  }

  // ---------- Wiring ----------

  // Esc goes up one level, Shift+Esc to the topic list (nav.js). On a drill or table either quits the round, so it needs a
  // second press of the same key within 2 s.
  let armed = null; // { target: 'options' | 'home', timer }
  const ARMED_TEXT = { options: 'Press Esc again to quit this round', home: 'Press ⇧Esc again to go to the topic list' };

  function disarmEscape() {
    if (armed) clearTimeout(armed.timer);
    armed = null;
    $('toast').hidden = true;
  }

  function onEscape(toTopics) {
    const action = nav.escapeAction(screen, toTopics, armed?.target);
    if (!action) return;
    if (action.go === 'home') return goHome();
    if (action.go === 'options') return openTopic(topic);
    disarmEscape();
    armed = { target: action.arm, timer: setTimeout(disarmEscape, 2000) };
    $('toast').hidden = false; // shown before the text changes, so screen readers announce it
    $('toast').textContent = ARMED_TEXT[action.arm];
  }

  function onKey(e) {
    if (e.isComposing) return;
    // A held Esc would arm and leave in one press; Ctrl / Alt / Cmd+Esc belong to the system.
    if (e.key === 'Escape') {
      if (!e.repeat && !e.ctrlKey && !e.altKey && !e.metaKey) onEscape(e.shiftKey);
      return;
    }
    // L replays the solved sentence (the inputs are read-only once checked, so it types nothing).
    if (screen === 'drill' && isChecked() && e.key?.toLowerCase() === 'l' && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      return $('feedback').querySelector('.listen')?.click();
    }
    // A held Enter would alternate check / next and submit empty answers.
    if (e.key === 'Enter' && e.repeat) return e.preventDefault();
    if (e.key !== 'Enter' || e.target.tagName === 'BUTTON') return;
    if (screen === 'options') {
      e.preventDefault();
      startSession(topic.sessions[0]);
    } else if (screen === 'drill') {
      // preventDefault also stops the keypress from clicking the button that receives focus.
      e.preventDefault();
      if (isChecked()) nextItem();
      else checkItem();
    }
  }

  renderHome();
  // macOS: main looks the voice up at start-up (it takes a moment); button and switch appear once it has one.
  if (hostSpeech) host.hasVoice().then((found) => showVoice(found), () => showVoice(null));
  else {
    pickVoice();
    window.speechSynthesis?.addEventListener('voiceschanged', pickVoice);
  }
  $('speak-toggle').checked = speakingOn;
  $('speak-toggle').addEventListener('change', (e) => {
    speakingOn = e.target.checked;
    store.write(SPEAK_KEY, speakingOn);
    if (!speakingOn) stopSpeaking();
  });
  for (const button of document.querySelectorAll('.to-topics')) button.addEventListener('click', goHome);
  $('btn-check').addEventListener('click', checkItem);
  $('btn-next').addEventListener('click', nextItem);
  $('btn-quit').addEventListener('click', () => openTopic(topic));
  $('btn-summary-next').addEventListener('click', nextStep);
  $('tables').addEventListener('keydown', onTableKey);
  $('btn-table-check').addEventListener('click', checkTable);
  $('btn-table-retry').addEventListener('click', retryTable);
  $('btn-table-next').addEventListener('click', nextStep);
  document.addEventListener('keydown', onKey);
  goHome();
})();
