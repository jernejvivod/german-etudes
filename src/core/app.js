// App shell: topic picker, topic options, the Progress checklist, and the generic drill / summary / table steps.
//
// A topic is { id, title, subtitle, intro, defaults, options, validate?, prepare?, sentences?, table?, listing?,
//   sessions: [{ label, build(settings, rnd?) → steps }] }
//   intro: text, or settings → text; prepare: async, loads the topic's data when it is opened and resolves to an error or null
//   options: [{ key, label, type: 'radio' | 'checkboxes' | 'toggle', choices?, text?, min?, inline?, round?, daily?, table? }]
//     round: shapes only the topic's own round (its length …), so it is not part of what is marked learnt (scope.js);
//     daily: the value the Daily review always uses (My Anki words), so not part of it either;
//     table: true (or value → the part of it the table holds) when the topic's table depends on it, so it is part of
//     what is marked Table learnt
//   sentences(settings, n, rnd): a drill step of n sentences in the settings' scope; a topic that has it can be marked
//     Sentences learnt and comes up in the Daily review (daily.js)
//   table(settings, rnd): the table step of the topic's fixed table (the one its "… only" session gives), which can be
//     learnt by heart; a topic that has it can be marked Table learnt and comes up in Daily tables (daily.js)
//   listing(settings): [{ title, text }] rows shown under the intro (a daily exercise's learnt topics)
// A step is { type: 'drill', label, items, hint?, hideTags?, onChecked?, onDone? } or
//   { type: 'table', label, table, topicTitle?, onChecked? }.
//   A drill's onChecked(item, ok) runs after each item is checked, onDone() when the drill reaches its summary.
//   A table's onChecked({ correct, total }) runs after each check; topicTitle names the topic it comes from (Daily
//   tables), shown above it.
// A drill item may bring its own hint, hideTags and topicTitle (the topic it comes from, shown above it): the Daily
// review mixes topics in one drill.
// A drill item may name the Anki notes it uses (notes): once it is checked right they count as shown (vocab.markShown),
// so the next rounds bring other cards; checked wrong, they are not held back (vocab.markMissed).
// A table cell's answer is a string or a list of accepted strings (the first is shown as the correction); a block with
// exact: true checks upper / lower case too (Ihr is not ihr).
(function () {
  'use strict';

  const { cloze, nav, topics, vocab, store, scope, daily, progress } = window.Etudes;
  const $ = (id) => document.getElementById(id);

  // The daily exercises, shown above the topics.
  const dailies = [daily.reviewTopic(topics), daily.tablesTopic(topics)];

  // What a topic can be marked learnt for, in the daily exercises: a topic with sentences or a table (t[kind]). uses:
  // how the note on another scope starts; name: the mark on the Progress screen.
  const LEARNT = [
    { kind: 'sentences', name: 'Sentences', label: 'Sentences learnt', detail: 'comes up in the Daily review with these settings', uses: 'The Daily review uses' },
    { kind: 'table', name: 'Table', label: 'Table learnt', detail: 'comes up in Daily tables with these settings', uses: 'Daily tables use' },
  ];

  let screen = 'home';
  let topic = null;
  let settings = null;
  let session = null; // { steps, index }
  let preparing = null; // the topic whose data is still loading, if any
  let prepareError = null;
  let drill = null; // { step, items, index, results: [{ item, grades }] }
  let cells = []; // table inputs, block by block, each block column-major
  let cellInfo = new Map(); // input → { idx, b, c, r, gap }
  let blocks = []; // per block { start, rows, cols }
  let wrapped = false; // Enter at the last cell went back to a blank cell once; next time it checks

  // ---------- Helpers ----------

  function settingsKey(t) {
    return `etudes-settings-${t.id}`;
  }

  function loadSettings(t) {
    return scope.fitSettings(t, store.read(settingsKey(t), {}));
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

  // The daily exercises' cards: done today, or how many topics (tables) are marked learnt. Rebuilt on every return
  // home, as the marks and the day change.
  function renderDaily() {
    $('daily').replaceChildren(...dailies.map((t) => {
      const done = daily.doneToday(t.kind);
      const count = t.learnt().length;
      const card = el('button', done ? 'topic daily done' : 'topic daily');
      card.dataset.topic = t.id;
      const sub = done ? 'Done today ✓' : count ? `${count} learnt ${t.unit}${count === 1 ? '' : 's'} · not done yet today` : `No ${t.unit} marked learnt yet`;
      card.append(el('span', 'topic-title', t.title), el('span', 'topic-sub', sub));
      card.addEventListener('click', () => openTopic(t, true));
      return card;
    }));
  }

  // Back on the list, the focus is on the topic just left (Enter reopens it), or on the first; from Progress, on its link.
  function goHome() {
    const from = screen;
    preparing = null; // a load finishing later must not focus the hidden options screen
    renderDaily();
    show('home');
    if (from === 'progress') return $('btn-progress').focus();
    const cards = [...document.querySelectorAll('#home .topic')];
    (cards.find((card) => card.dataset.topic === topic?.id) || cards[0])?.focus();
  }

  // ---------- Progress ----------

  // Every topic with its marks and parts (progress.js), each ✓ where marked learnt. Read-only: a topic's line opens its
  // options, where the marks are set. Rebuilt on every visit; a topic starts open when it has a mark.
  function openProgress() {
    const { learnt, total, marked, topics: items } = progress.tree(topics);
    $('progress-count').textContent = `${learnt} of ${total} parts learnt · ${marked} of ${items.length} topics marked learnt`;
    $('progress-tree').replaceChildren(...items.map(progressTopic));
    show('progress');
    $('progress-tree').querySelector('.check-line').focus();
  }

  // A topic: a toggle showing or hiding its parts (a spacer without parts), its line, and its options' parts.
  function progressTopic(item) {
    const line = el('button', 'check-line');
    line.dataset.topic = item.id;
    line.append(el('span', 'check-title', item.title), ...LEARNT.filter((l) => l.kind in item.marks).map((l) => progressMark(l, item.marks[l.kind])));
    // Which mark no longer fits, where the topic has two.
    const unfit = LEARNT.filter((l) => item.marks[l.kind] && !item.marks[l.kind].fits).map((l) => l.name);
    const which = Object.keys(item.marks).length > 1 ? `${unfit.join(' and ')}: ` : '';
    if (unfit.length) line.append(el('span', 'check-warn', which + daily.UNFIT));
    line.addEventListener('click', () => openTopic(topics.find((t) => t.id === item.id), true));
    const row = el('div', 'check-row');
    const li = el('li');
    li.append(row);
    if (!item.options.length) {
      row.append(el('span', 'check-spacer'), line);
      return li;
    }
    const options = progressParts(item);
    const toggle = el('button', 'ghost check-toggle');
    toggle.setAttribute('aria-controls', options.id);
    toggle.setAttribute('aria-label', `Parts of ${item.title}`);
    const setOpen = (open) => {
      options.hidden = !open;
      toggle.textContent = open ? '▾' : '▸';
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', () => setOpen(options.hidden));
    setOpen(item.open);
    row.append(toggle, line);
    li.append(options);
    return li;
  }

  // A topic's options, each with its parts ✓ or ✗ (and, where the two marks disagree, which one holds it).
  function progressParts(item) {
    const options = el('ul', 'check-options');
    options.id = `progress-parts-${item.id}`;
    options.append(...item.options.map((opt) => {
      const parts = el('ul', 'check-parts');
      parts.append(...opt.parts.map((part) => {
        const li = el('li', part.learnt ? 'check-part ok' : 'check-part');
        li.append(tick(part.learnt, part.learnt ? 'Learnt' : 'Not yet'), ' ', part.label);
        if (part.only) li.append(el('span', 'check-only', ` · ${part.only} only`));
        return li;
      }));
      const li = el('li');
      li.append(el('span', 'check-option', opt.label), parts);
      return li;
    }));
    return options;
  }

  // ✓ or ✗, named for screen readers.
  function tick(on, label) {
    const span = el('span', 'tick', on ? '✓' : '✗');
    span.setAttribute('role', 'img');
    span.setAttribute('aria-label', label);
    return span;
  }

  // A topic's Sentences or Table mark; a table narrower than the whole names its scope. The tooltip gives the scope.
  function progressMark({ kind, name, uses }, mark) {
    const span = el('span', mark ? 'check-mark ok' : 'check-mark', `${name} `);
    span.append(tick(!!mark, mark ? 'learnt' : 'not yet'));
    if (mark && kind === 'table' && !mark.whole) span.append(` (${mark.text})`);
    if (mark) span.title = `${uses}: ${mark.text}`;
    return span;
  }

  // ---------- Options ----------

  // fresh: coming from the topic list, so the topic (re)loads its data; going back from a round keeps what is loaded.
  async function openTopic(t, fresh = false) {
    topic = t;
    settings = loadSettings(t);
    $('options-title').textContent = t.title;
    renderOptions();
    renderLearnt();
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
      $('options-listing').hidden = true;
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
    const rows = topic.listing?.(settings) || [];
    $('options-listing').replaceChildren(...rows.map(({ title, text }) => {
      const li = el('li');
      li.append(el('b', null, title), ' ', el('span', 'muted', text));
      return li;
    }));
    $('options-listing').hidden = !rows.length;
  }

  // The Sentences learnt and Table learnt switches (topics with sentences, a table): on, each saves its part of the
  // settings (scope.js) for its daily exercise. The scope changes only on purpose: while it differs from the settings,
  // a note says which one is used.
  function renderLearnt() {
    const box = $('options-learnt');
    const kinds = LEARNT.filter((l) => topic[l.kind]);
    box.hidden = !kinds.length;
    box.replaceChildren(el('legend', null, 'Daily exercises'));
    const own = daily.marks()[topic.id];
    for (const { kind, label, detail, uses } of kinds) {
      const mark = own?.[kind];
      const name = `learnt-${kind}`;
      const setMark = (on) => {
        daily.setMark(topic.id, kind, on ? scope.scopeOf(topic, settings, kind) : null);
        renderLearnt();
        validateOptions();
        box.querySelector(`input[name="${name}"]`).focus(); // the re-render dropped the focused control
      };
      box.append(choiceLabel('checkbox', name, { label, detail }, !!mark, (e) => setMark(e.target.checked)));
      if (mark && !scope.sameScope(topic, mark.settings, settings, kind)) {
        const note = el('p', 'learnt-note', `${uses}: ${scope.scopeText(topic, scope.fitSettings(topic, mark.settings), kind)}.`);
        const use = el('button', null, 'Use these settings');
        use.type = 'button';
        use.addEventListener('click', () => setMark(true));
        note.append(use);
        box.append(note);
      }
    }
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
            setOption(opt.key, scope.choiceValues(opt).filter((v) => values.includes(v)));
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
    renderLearnt();
    validateOptions();
  }

  // Shows the first problem with the settings (or the topic's data) and disables the start buttons, and marking them
  // learnt (a mark can still be removed), while there is one.
  function validateOptions() {
    const error = preparing ? null : prepareError || scope.settingsProblem(topic, settings);
    $('options-error').textContent = error || '';
    $('options-error').hidden = !error;
    for (const button of $('options-actions').querySelectorAll('button')) button.disabled = !!error || preparing;
    for (const control of $('options-learnt').querySelectorAll('input:not(:checked), button')) control.disabled = !!error || !!preparing;
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
    drill = { step, items: step.items, index: 0, results: [] };
    show('drill');
    renderItem();
  }

  // An item's own setting first: the Daily review mixes topics in one drill.
  const hidesTags = (item) => !!(item.hideTags ?? drill.step.hideTags);

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
    $('source').textContent = item.topicTitle || '';
    $('source').hidden = !item.topicTitle;
    $('tags').replaceChildren(hidesTags(item) ? '' : tagsFragment(item));
    $('drill-hint').textContent = item.hint ?? drill.step.hint ?? '';

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
    if (allOk) vocab.markShown(item.notes);
    else vocab.markMissed(item.notes);
    drill.step.onChecked?.(item, allOk);
    updateProgress();

    if (hidesTags(item)) $('tags').replaceChildren(tagsFragment(item));

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
    drill.step.onDone?.();
    const mistakes = drill.results.filter((r) => r.grades.some((g) => !g.ok));
    $('summary-score').textContent = `${drill.results.length - mistakes.length} / ${drill.results.length} sentences correct`;

    const list = $('mistakes');
    list.replaceChildren();
    for (const { item, grades } of mistakes) {
      const sent = el('div', 'sent');
      sent.append(answerFragment(item));
      const wrong = grades.filter((g) => !g.ok).map((g) => cloze.typed(g.gap, g.value));
      const meta = el('div', 'meta');
      meta.append(`${[item.topicTitle, ...item.tags.map((t) => t.text)].filter(Boolean).join(' · ')} — you wrote `, el('span', 'given', wrong.join(', ')));
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
    $('table-source').textContent = step.topicTitle || '';
    $('table-source').hidden = !step.topicTitle;
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
    const step = session.steps[session.index];
    const tableEndings = step.table.endings;
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
    step.onChecked?.({ correct, total: cells.length });
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
  $('btn-progress').addEventListener('click', openProgress);
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
