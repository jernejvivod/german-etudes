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

  // What a topic can be marked learnt for, in the daily exercises: a topic with sentences or a table (t[kind]). name: the
  // mark on the Progress screen; label: it in a sentence ("learnt for the table").
  const LEARNT = [
    { kind: 'sentences', name: 'Sentences', label: 'sentences' },
    { kind: 'table', name: 'Table', label: 'the table' },
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

  function saveSettings() {
    store.write(daily.settingsKey(topic), settings);
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

  // Where parts are marked learnt: every topic with its parts (progress.js), each with a Sentences and a Table box where
  // that kind can hold it, and per kind a switch for the whole topic (the mark itself for a topic without parts). A
  // change saves at once and rebuilds its topic. A topic starts open when it has a tick; opened or closed, it stays so
  // for the visit. A topic's name opens its options.
  let expanded = new Set(); // the topics open on this visit

  // focusId: the topic to open, scroll to and focus (Edit in Progress); without it, the focus is on the first topic.
  function openProgress(focusId = null) {
    preparing = null; // from the options screen (Edit in Progress): a load finishing later must not focus it
    const tree = progress.tree(topics);
    expanded = new Set(tree.topics.filter((item) => item.open).map((item) => item.id));
    if (focusId) expanded.add(focusId);
    renderProgressCount(tree);
    $('progress-tree').replaceChildren(...tree.topics.map(progressTopic));
    show('progress');
    const title = focusId ? $(`progress-title-${focusId}`) : $('progress-tree').querySelector('.check-title');
    if (focusId) $(`progress-topic-${focusId}`).scrollIntoView({ block: 'start' });
    title.focus({ preventScroll: !!focusId });
  }

  function renderProgressCount({ learnt, total, marked, topics: items }) {
    $('progress-count').textContent = `${learnt} of ${total} parts learnt (ticked for either kind) · ${marked} of ${items.length} topics marked learnt`;
  }

  // A topic: a toggle showing or hiding its parts (a spacer without parts), its line (its name, a switch per kind, what
  // keeps a mark out of its daily exercise) and its options' parts.
  function progressTopic(item) {
    const title = el('button', 'link check-title', item.title);
    title.id = `progress-title-${item.id}`;
    title.dataset.topic = item.id;
    title.addEventListener('click', () => openTopic(topics.find((t) => t.id === item.id), true));
    const kinds = LEARNT.filter((l) => l.kind in item.marks);
    const line = el('div', 'check-line');
    line.append(title, ...kinds.map((l) => progressSwitch(item, l)));
    for (const { kind, name } of kinds) {
      const { state, problem } = item.marks[kind];
      const warn = state === 'partly' ? `Only partly marked — ${problem}.` : problem;
      if (warn) line.append(el('span', 'check-warn', kinds.length > 1 ? `${name}: ${warn}` : warn));
    }
    const row = el('div', 'check-row');
    const li = el('li');
    li.id = `progress-topic-${item.id}`;
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
      if (open) expanded.add(item.id);
      else expanded.delete(item.id);
    };
    toggle.addEventListener('click', () => setOpen(options.hidden));
    setOpen(expanded.has(item.id));
    row.append(toggle, line);
    li.append(options);
    return li;
  }

  function checkbox(id, label, checked) {
    const input = el('input');
    input.type = 'checkbox';
    input.id = id;
    input.checked = checked;
    input.setAttribute('aria-label', label);
    return input;
  }

  // A topic's switch for a kind: with parts, checked when all are ticked, mixed when some are (a click ticks all, or
  // clears all once all are ticked), with the count; without parts, the mark itself.
  function progressSwitch(item, { kind, name, label }) {
    const { state, ticked, total } = item.marks[kind];
    const id = `progress-${item.id}-${kind}`;
    const input = checkbox(id, total ? `${item.title}: all parts learnt for ${label}` : `${item.title} learnt for ${label}`,
      total ? ticked === total : state !== 'none');
    input.indeterminate = ticked > 0 && ticked < total;
    input.addEventListener('change', () => onProgressChange(item.id, kind, id, (t) => progress.withAll(t, kind, input.checked)));
    const count = el('span', 'check-count', total ? `${ticked}/${total}` : null); // empty, it keeps the switches in line
    if (total) {
      count.id = `${id}-count`;
      input.setAttribute('aria-describedby', count.id);
    }
    const box = el('label', 'check-mark');
    box.append(input, name, count);
    return box;
  }

  // A topic's options, each a group of its parts: a box per kind that can hold the part, an empty cell where it cannot,
  // so the columns line up under their heads.
  function progressParts(item) {
    const cols = LEARNT.filter((l) => item.marks[l.kind]?.total);
    const box = el('div', `check-options${cols.length > 1 ? '' : ' single'}`);
    box.id = `progress-parts-${item.id}`;
    const head = el('div', 'check-cols');
    head.setAttribute('aria-hidden', 'true');
    head.append(...cols.map((l) => el('span', null, l.name)));
    box.append(head);
    for (const opt of item.options) {
      const name = el('div', 'check-option', opt.label);
      name.id = `progress-${item.id}-option-${opt.key}`;
      const parts = el('ul', 'check-parts');
      parts.setAttribute('role', 'group');
      parts.setAttribute('aria-labelledby', `progress-title-${item.id} ${name.id}`);
      parts.append(...opt.parts.map((part) => {
        const li = el('li', part.learnt ? 'check-part ok' : 'check-part');
        for (const { kind, label } of cols) {
          const cell = el('span', 'check-cell');
          if (part[kind] !== null) {
            const id = `progress-${item.id}-${kind}-${opt.key}-${part.value}`;
            const input = checkbox(id, `${part.label} learnt for ${label}`, part[kind]);
            input.addEventListener('change', () => onProgressChange(item.id, kind, id,
              (t, mark) => progress.withPart(t, kind, mark, opt.key, part.value, input.checked)));
            cell.append(input);
          }
          li.append(cell);
        }
        li.append(el('span', 'check-label', part.label));
        return li;
      }));
      box.append(name, parts);
    }
    return box;
  }

  // Saves a topic's mark of a kind as change(topic, mark) gives it, rebuilds the topic and the count, and puts the focus
  // back on the control (controlId) that changed it.
  function onProgressChange(id, kind, controlId, change) {
    daily.setMark(id, kind, change(topics.find((t) => t.id === id), daily.markOf(id, kind)));
    const tree = progress.tree(topics);
    renderProgressCount(tree);
    $(`progress-topic-${id}`).replaceWith(progressTopic(tree.topics.find((item) => item.id === id)));
    $(controlId).focus();
  }

  // ---------- Options ----------

  // fresh: coming from the topic list, so the topic (re)loads its data; going back from a round keeps what is loaded.
  async function openTopic(t, fresh = false) {
    topic = t;
    settings = daily.topicSettings(t);
    $('options-title').textContent = t.title;
    renderOptions();
    renderMarks();
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

  // The quick buttons that tick the parts for the next round (progress.practise), and their tooltip when there is
  // nothing to tick.
  const PRACTISE = [
    { which: 'new', label: 'Practise what\'s new', none: 'Everything here is marked learnt' },
    { which: 'learnt', label: 'Practise what\'s learnt', none: 'Nothing here is marked learnt yet — mark parts in Progress' },
  ];

  // What a topic is marked learnt for, a line per kind it offers (topics with sentences, a table), with a link to
  // Progress, where the marks are set; for a topic with parts, the quick buttons. Hidden on the daily exercises.
  function renderMarks() {
    const box = $('options-marks');
    const kinds = LEARNT.filter((l) => topic[l.kind]);
    box.hidden = !kinds.length;
    if (!kinds.length) return void box.replaceChildren();
    const all = daily.marks();
    const [item] = progress.tree([topic], all, () => settings).topics;
    const lines = kinds.map((l) => {
      const { text, warn } = markText(l, item.marks[l.kind]);
      return el('p', warn ? 'marks-line warn' : 'marks-line', text);
    });
    const actions = el('div', 'marks-actions');
    if (item.options.length) {
      actions.append(...PRACTISE.map(({ which, label, none }) => {
        const button = el('button', null, label);
        button.id = `options-practise-${which}`;
        button.disabled = !progress.practise(topic, which, all);
        if (button.disabled) button.title = none;
        button.addEventListener('click', () => practise(which));
        return button;
      }));
    }
    const edit = el('button', 'link', 'Edit in Progress →');
    edit.addEventListener('click', () => openProgress(topic.id));
    actions.append(edit);
    box.replaceChildren(...lines, actions);
  }

  // A kind's mark (progress.tree's, with the settings shown) in words; warn: it keeps the topic out of its daily exercise.
  function markText({ label }, { state, total, text: parts, problem }) {
    const text = total ? `: ${parts}` : '';
    if (state === 'none') return { text: `Not learnt for ${label} yet` };
    if (state === 'partly') return { text: `Partly learnt for ${label}${text} — ${problem}`, warn: true };
    if (state === 'unfit') return { text: `Learnt for ${label}, but: ${problem}`, warn: true };
    return { text: `Learnt for ${label}${text}` };
  }

  // Ticks the parts not learnt yet (which: 'new') or those learnt ('learnt') for the next round. A combination the
  // topic cannot practise is ticked all the same; the error says why, and Start waits.
  function practise(which) {
    const preset = progress.practise(topic, which);
    if (!preset) return;
    settings = { ...settings, ...preset };
    saveSettings();
    renderOptions();
    if (!preparing) renderIntro();
    renderMarks();
    validateOptions();
    $(`options-practise-${which}`).focus(); // the re-render dropped the focused button
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
    renderMarks(); // a mark's status depends on the single choices and switches too
    validateOptions();
  }

  // Shows the first problem with the settings (or the topic's data) and disables the start buttons while there is one.
  function validateOptions() {
    const error = preparing ? null : prepareError || scope.settingsProblem(topic, settings);
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
  $('btn-progress').addEventListener('click', () => openProgress());
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
