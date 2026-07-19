import './styles.css';
import { calculateDialIn, formatMeasurement } from './calculator.js';
import {
  PROGRAM_NAMES,
  addRecipeIteration,
  exportState,
  findIteration,
  importState,
  isStateSyncPending,
  loadState,
  markStateSynced,
  recipeNameKey,
  replaceAssignedIteration,
  saveState,
} from './storage.js';

let state = loadState();
let lastCalculation = null;
let editingIterationId = null;
let onlineSaveQueue = Promise.resolve();

const app = document.querySelector('#app');

app.innerHTML = `
  <header class="site-header">
    <div class="staff-menu">
      <span id="staff-name"></span>
      <a id="staff-admin" href="/admin">Manage staff</a>
      <form action="/api/auth/logout" method="post">
        <button type="submit">Sign out</button>
      </form>
    </div>
    <h1 id="page-title">Machine Programs</h1>
    <span class="save-status" id="save-status" data-state="connecting"><span class="status-dot" aria-hidden="true"></span><span id="save-status-text">Connecting online…</span></span>
  </header>

  <main class="app-shell">
    <nav class="tabs" aria-label="Main navigation">
      <button class="tab is-active" type="button" data-view="dashboard" aria-selected="true">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12l2-2m0 0 7-7 7 7M5 10v10a1 1 0 0 0 1 1h3m10-11 2 2m-2-2v10a1 1 0 0 1-1 1h-3m-6 0a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1m-6 0h6"/></svg>
        <span>Home</span>
      </button>
      <button class="tab" type="button" data-view="dial-in" aria-selected="false">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.428 15.428a2 2 0 0 0-1.022-.547l-2.387-.477a6 6 0 0 0-3.86.517l-.318.158a6 6 0 0 1-3.86.517l-1.931-.386a2 2 0 0 0-1.806.547M8 4h8l-1 1v5.172a2 2 0 0 0 .586 1.414l5 5C21.846 17.846 20.953 20 19.171 20H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 0 0 9 10.172V5L8 4z"/></svg>
        <span>Dial-in</span>
      </button>
      <button class="tab" type="button" data-view="recipes" aria-selected="false">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
        <span>Log</span>
      </button>
      <button class="tab" type="button" data-view="quick" aria-selected="false">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z"/></svg>
        <span>Calc</span>
      </button>
    </nav>

    <section class="view" id="view-dashboard" data-view-panel="dashboard">
      <div class="section-heading">
        <p class="view-intro">Currently assigned coffees</p>
        <div class="toolbar">
          <button class="button button-secondary" id="print-label" type="button">Print label</button>
        </div>
      </div>
      <div class="program-grid" id="program-grid"></div>
      <div class="empty-state" id="dashboard-empty" hidden>
        <span class="empty-icon" aria-hidden="true">◎</span>
        <h3>No recipes saved yet</h3>
        <p>Dial in your first coffee, then assign it to a machine program.</p>
        <button class="button button-primary" type="button" data-go="dial-in">Start a dial-in</button>
      </div>
    </section>

    <section class="view" id="view-dial-in" data-view-panel="dial-in" hidden>
      <div class="section-heading">
        <p class="view-intro">Record the measured shot, then calculate the next recipe.</p>
      </div>
      <div class="workflow-grid">
        <form class="panel form-panel" id="dial-form">
          <div class="field field-wide">
            <label for="coffee-name">Coffee name</label>
            <input id="coffee-name" name="coffee" type="text" maxlength="80" autocomplete="off" placeholder="e.g. Showcase Blend" required />
            <small class="edit-context" id="edit-context" hidden>Editing a saved recipe. Saving will create a new iteration.</small>
          </div>
          <div class="field field-wide">
            <label for="recipe-type">Recipe type</label>
            <select id="recipe-type" name="recipeType">
              <option value="blend" selected>Blend</option>
              <option value="single">Single</option>
            </select>
          </div>
          <div class="field">
            <label for="dose">Dose <span>g</span></label>
            <input id="dose" name="dose" type="number" min="0.1" max="100" step="0.1" inputmode="decimal" placeholder="18.0" required />
          </div>
          <div class="field">
            <label for="yield">Yield <span>g</span></label>
            <input id="yield" name="yieldGrams" type="number" min="0.1" max="300" step="0.1" inputmode="decimal" placeholder="40.0" required />
          </div>
          <div class="field">
            <label for="grind-size">Grind size <span>optional</span></label>
            <input id="grind-size" name="grindSize" type="text" maxlength="40" autocomplete="off" placeholder="e.g. 4.2 or 18 clicks" />
          </div>
          <div class="field">
            <label for="shot-time">Shot time <span>optional · seconds</span></label>
            <input id="shot-time" name="shotTime" type="number" min="1" max="300" step="0.1" inputmode="decimal" placeholder="28.0" />
          </div>
          <div class="field field-wide">
            <label for="strength">Measured strength <span>% TDS</span></label>
            <input id="strength" name="strength" type="number" min="0.01" max="30" step="0.01" inputmode="decimal" placeholder="9.30" required />
            <small>Enter the reading from your refractometer.</small>
          </div>
          <section class="targets field-wide" aria-labelledby="dial-targets-heading">
            <div class="target-heading">
              <div>
                <p class="target-title" id="dial-targets-heading">Target settings</p>
                <small>Strength follows the recipe type, but can still be adjusted.</small>
              </div>
            </div>
            <div class="target-grid">
              <div class="field">
                <label for="target-strength">Target strength <span>%</span></label>
                <input id="target-strength" name="targetStrength" type="number" min="0.01" max="30" step="0.01" value="9.30" required />
              </div>
              <div class="field">
                <label for="target-solids">Target dissolved solids <span>g</span></label>
                <input id="target-solids" name="targetSolids" type="number" min="0.01" max="30" step="0.01" value="4.41" required />
              </div>
            </div>
          </section>
          <p class="form-error field-wide" id="dial-error" role="alert" hidden></p>
          <button class="button button-primary button-large field-wide" type="submit">Calculate next shot</button>
          <button class="button button-secondary button-large field-wide" id="save-recipe" type="button">Save this shot</button>
        </form>

        <aside class="panel result-panel" id="dial-result" aria-live="polite">
          <div class="result-placeholder" id="result-placeholder">
            <span aria-hidden="true">↗</span>
            <h3>Your recommendation appears here</h3>
            <p>Add the shot measurements to see extraction and the suggested next recipe.</p>
          </div>
          <div id="result-content" hidden>
            <p class="eyebrow">Recommended next shot</p>
            <div class="recommendation">
              <div><strong id="result-dose">—</strong><span>Dose · g</span></div>
              <i aria-hidden="true">→</i>
              <div><strong id="result-yield">—</strong><span>Yield · g</span></div>
            </div>
            <div class="result-metrics">
              <div><span>Extraction yield</span><strong id="result-extraction">—</strong></div>
              <div><span>Dissolved solids</span><strong id="result-solids">—</strong></div>
            </div>
            <div class="result-actions">
              <button class="button button-primary" id="dial-further" type="button">Use recommendation</button>
            </div>
          </div>
        </aside>
      </div>
    </section>

    <section class="view" id="view-recipes" data-view-panel="recipes" hidden>
      <div class="section-heading">
        <p class="view-intro">Saved recipes</p>
        <div class="toolbar">
          <button class="button button-secondary" id="import-button" type="button">Import</button>
          <input id="import-file" type="file" accept="application/json,.json" hidden />
          <button class="button button-secondary" id="export-button" type="button">Export</button>
        </div>
      </div>
      <div class="recipe-search" id="recipe-search-wrap">
        <label class="sr-only" for="recipe-search">Search saved coffees</label>
        <input id="recipe-search" type="search" placeholder="Search saved coffees…" autocomplete="off" />
        <small id="recipe-search-status" aria-live="polite"></small>
      </div>
      <div class="recipe-list" id="recipe-list"></div>
      <div class="empty-state" id="recipes-no-results" hidden>
        <h3>No matching coffees</h3>
        <p>Try a different coffee name.</p>
      </div>
      <div class="empty-state" id="recipes-empty" hidden>
        <span class="empty-icon" aria-hidden="true">□</span>
        <h3>Your recipe log is empty</h3>
        <p>Saved dial-ins will appear here, grouped by coffee.</p>
        <button class="button button-primary" type="button" data-go="dial-in">Dial in a coffee</button>
      </div>
    </section>

    <section class="view" id="view-quick" data-view-panel="quick" hidden>
      <div class="section-heading">
        <p class="view-intro">Calculate without saving a recipe.</p>
      </div>
      <div class="quick-layout">
        <form class="panel quick-form" id="quick-form">
          <div class="field"><label for="quick-dose">Dose <span>g</span></label><input id="quick-dose" name="dose" type="number" min="0.1" step="0.1" placeholder="18.0" /></div>
          <div class="field"><label for="quick-yield">Yield <span>g</span></label><input id="quick-yield" name="yieldGrams" type="number" min="0.1" step="0.1" placeholder="40.0" /></div>
          <div class="field"><label for="quick-strength">Strength <span>%</span></label><input id="quick-strength" name="strength" type="number" min="0.01" step="0.01" placeholder="9.30" /></div>
          <div class="quick-targets">
            <p class="target-title">Targets</p>
            <div class="field"><label for="quick-target-strength">Target strength <span>%</span></label><input id="quick-target-strength" name="targetStrength" type="number" min="0.01" max="30" step="0.01" value="9.30" /></div>
            <div class="field"><label for="quick-target-solids">Target dissolved solids <span>g</span></label><input id="quick-target-solids" name="targetSolids" type="number" min="0.01" max="30" step="0.01" value="4.41" /></div>
          </div>
        </form>
        <div class="quick-results" aria-live="polite">
          <div><span>Recommended dose</span><strong id="quick-rec-dose">—</strong><small>grams</small></div>
          <div><span>Recommended yield</span><strong id="quick-rec-yield">—</strong><small>grams</small></div>
          <div><span>Extraction</span><strong id="quick-extraction">—</strong><small>percent</small></div>
          <div><span>Dissolved solids</span><strong id="quick-solids">—</strong><small>grams</small></div>
        </div>
      </div>
    </section>
  </main>

  <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
  <section class="print-label" id="print-label-sheet" aria-label="Long Up and Long Down recipes"></section>
`;

document.querySelector('#staff-name').textContent =
  app.dataset.username || 'Staff';
document.querySelector('#staff-admin').hidden = app.dataset.role !== 'admin';

const byId = (id) => document.getElementById(id);
const numberFrom = (formData, name) => Number(formData.get(name));

function setSaveStatus(stateName, message) {
  byId('save-status').dataset.state = stateName;
  byId('save-status-text').textContent = message;
}

function queueOnlineSave() {
  const snapshot = JSON.parse(exportState(state));
  setSaveStatus('saving', 'Saving online…');

  onlineSaveQueue = onlineSaveQueue
    .catch(() => undefined)
    .then(async () => {
      const response = await fetch('/api/state', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state: snapshot }),
      });
      if (!response.ok) throw new Error('Online save failed.');
      if (exportState(state) === exportState(snapshot)) {
        markStateSynced();
      }
      setSaveStatus('online', 'Saved online');
      return true;
    })
    .catch(() => {
      setSaveStatus('offline', 'Saved on this device · offline');
      return false;
    });

  return onlineSaveQueue;
}

async function initialiseOnlineState() {
  try {
    if (isStateSyncPending()) {
      await queueOnlineSave();
      return;
    }

    const response = await fetch('/api/state', { cache: 'no-store' });
    if (!response.ok) throw new Error('Online storage is unavailable.');
    const remote = await response.json();

    if (remote.state) {
      state = importState(JSON.stringify(remote.state));
      saveState(state, window.localStorage, { synced: true });
      renderDashboard();
      renderRecipes();
      setSaveStatus('online', 'Saved online');
      return;
    }

    saveState(state);
    await queueOnlineSave();
  } catch {
    setSaveStatus('offline', 'Saved on this device · offline');
  }
}

function measurementsFrom(form) {
  const data = new FormData(form);
  return {
    dose: numberFrom(data, 'dose'),
    yieldGrams: numberFrom(data, 'yieldGrams'),
    strength: numberFrom(data, 'strength'),
    targetStrength: numberFrom(data, 'targetStrength'),
    targetSolids: numberFrom(data, 'targetSolids'),
  };
}

function brewDetailsFrom(form) {
  const data = new FormData(form);
  const shotTime = data.get('shotTime');
  return {
    grindSize: data.get('grindSize').trim(),
    shotTime: shotTime === '' ? null : Number(shotTime),
  };
}

function targetStrengthForRecipeType(recipeType) {
  return recipeType === 'single' ? 8.5 : 9.3;
}

function dialInFrom(form) {
  const measurements = measurementsFrom(form);
  const data = new FormData(form);
  return {
    coffee: data.get('coffee').trim(),
    recipeType: data.get('recipeType'),
    measurements,
    brewDetails: brewDetailsFrom(form),
    result: calculateDialIn(measurements),
  };
}

function showToast(message) {
  const toast = byId('toast');
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    toast.hidden = true;
  }, 2600);
}

function showView(viewName) {
  const viewTitles = {
    dashboard: 'Machine Programs',
    'dial-in': 'Dial-in Workflow',
    recipes: 'Recipe Log',
    quick: 'Quick Calc',
  };
  byId('page-title').textContent = viewTitles[viewName];
  document.querySelectorAll('[data-view-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.viewPanel !== viewName;
  });
  document.querySelectorAll('[data-view]').forEach((tab) => {
    const active = tab.dataset.view === viewName;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  window.history.replaceState(null, '', `#${viewName}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function createProgramCard(programName, recipe) {
  const card = document.createElement('article');
  card.className = `program-card${recipe ? ' is-filled' : ''}`;

  const heading = document.createElement('div');
  const label = document.createElement('span');
  label.className = 'program-label';
  label.textContent = programName;
  heading.append(label);

  const title = document.createElement('h3');
  title.textContent = recipe?.coffee || 'Ready for a coffee';
  heading.append(title);

  const detail = document.createElement('p');
  detail.textContent = recipe
    ? `${recipe.recipeType === 'single' ? 'Single' : 'Blend'} · ${formatMeasurement(recipe.dose)}g → ${formatMeasurement(recipe.yieldGrams ?? recipe.yield)}g · ${formatMeasurement(recipe.strength, 2)}% · ${recipe.grindSize || 'Grind not set'} · ${recipe.shotTime ? `${formatMeasurement(recipe.shotTime)}s` : 'Time not set'}`
    : 'Empty slot';
  heading.append(detail);

  if (recipe) {
    const recency = document.createElement('p');
    recency.className = 'program-recency';
    recency.textContent = `Last assigned ${formatRecency(recipe.lastAssignedAt)}`;
    heading.append(recency);

    const edit = document.createElement('button');
    edit.className = 'button button-secondary program-edit';
    edit.type = 'button';
    edit.textContent = 'Edit recipe';
    edit.addEventListener('click', () => editIteration(recipe.id));
    heading.append(edit);
  }
  card.append(heading);

  const marker = document.createElement('span');
  marker.className = 'program-marker';
  marker.textContent = recipe ? '●' : '+';
  marker.setAttribute('aria-hidden', 'true');
  card.append(marker);
  return card;
}

function renderDashboard() {
  const grid = byId('program-grid');
  grid.replaceChildren();
  PROGRAM_NAMES.forEach((programName) => {
    const match = findIteration(state, state.programs[programName]);
    grid.append(
      createProgramCard(
        programName,
        match
          ? {
              ...match.iteration,
              coffee: match.recipe.coffee,
              recipeType: match.recipe.recipeType,
            }
          : null,
      ),
    );
  });
  byId('dashboard-empty').hidden = state.recipes.length !== 0;
}

function assignedRecipe(programName) {
  const match = findIteration(state, state.programs[programName]);
  return match ? { ...match.iteration, coffee: match.recipe.coffee } : null;
}

function createPrintRecipe(programName, recipe) {
  const column = document.createElement('article');
  column.className = 'print-recipe';

  const program = document.createElement('p');
  program.className = 'print-program';
  program.textContent = programName;

  const coffee = document.createElement('h1');
  coffee.textContent = recipe.coffee;

  const ratio = document.createElement('p');
  ratio.className = 'print-ratio';
  ratio.textContent = `${formatMeasurement(recipe.dose)}g → ${formatMeasurement(recipe.yieldGrams ?? recipe.yield)}g`;

  const details = document.createElement('dl');
  const entries = [
    ['Dose', `${formatMeasurement(recipe.dose)} g`],
    ['Yield', `${formatMeasurement(recipe.yieldGrams ?? recipe.yield)} g`],
    ['Grind', recipe.grindSize || 'Not recorded'],
    [
      'Time',
      recipe.shotTime
        ? `${formatMeasurement(recipe.shotTime)} sec`
        : 'Not recorded',
    ],
  ];

  entries.forEach(([term, value]) => {
    const row = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = term;
    dd.textContent = value;
    row.append(dt, dd);
    details.append(row);
  });

  column.append(program, coffee, ratio, details);
  return column;
}

function renderPrintLabel() {
  const sheet = byId('print-label-sheet');
  const longUp = assignedRecipe('Long Up');
  const longDown = assignedRecipe('Long Down');

  sheet.replaceChildren();
  if (!longUp || !longDown) return false;

  sheet.append(
    createPrintRecipe('Long Up', longUp),
    createPrintRecipe('Long Down', longDown),
  );
  return true;
}

function formatDate(recipe) {
  const date = recipe.createdAt ? new Date(recipe.createdAt) : null;
  if (date && !Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }
  return recipe.date || 'Saved recipe';
}

function formatRecency(value) {
  if (!value) return 'not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'not recorded';

  const elapsedDays = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)),
  );
  if (elapsedDays === 0) return 'today';
  if (elapsedDays === 1) return 'yesterday';
  if (elapsedDays < 14) return `${elapsedDays} days ago`;
  return `on ${new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)}`;
}

function assignRecipe(recipeId, programName) {
  const match = findIteration(state, recipeId);
  if (!match) return;

  Object.entries(state.programs).forEach(([name, assignedId]) => {
    const assigned = findIteration(state, assignedId);
    if (assigned?.recipe.id === match.recipe.id && name !== programName) {
      state.programs[name] = null;
    }
  });
  state.programs[programName] = match.iteration.id;
  match.iteration.lastAssignedAt = new Date().toISOString();
  persistAndRender();
  showToast(`${match.recipe.coffee} assigned to ${programName}.`);
}

function deleteRecipe(recipeId) {
  const match = findIteration(state, recipeId);
  if (
    !match ||
    !window.confirm(`Delete this ${match.recipe.coffee} iteration?`)
  )
    return;

  match.recipe.iterations = match.recipe.iterations.filter(
    (item) => String(item.id) !== String(recipeId),
  );
  state.recipes = state.recipes.filter(
    (recipe) => recipe.iterations.length > 0,
  );
  Object.keys(state.programs).forEach((name) => {
    if (String(state.programs[name]) === String(recipeId))
      state.programs[name] = null;
  });
  persistAndRender();
  showToast('Recipe deleted.');
}

function editIteration(iterationId) {
  const match = findIteration(state, iterationId);
  if (!match) return;

  const { recipe, iteration } = match;
  const form = byId('dial-form');
  form.elements.coffee.value = recipe.coffee;
  form.elements.recipeType.value = recipe.recipeType ?? 'blend';
  form.elements.grindSize.value = iteration.grindSize ?? '';
  form.elements.shotTime.value = iteration.shotTime ?? '';
  form.elements.dose.value = iteration.dose;
  form.elements.yieldGrams.value = iteration.yieldGrams;
  form.elements.strength.value = iteration.strength ?? '';
  form.elements.targetStrength.value = iteration.targetStrength ?? 9.3;
  form.elements.targetSolids.value = iteration.targetSolids ?? 4.41;
  editingIterationId = iteration.id;
  lastCalculation = null;
  byId('edit-context').hidden = false;
  byId('result-placeholder').hidden = false;
  byId('result-content').hidden = true;
  showView('dial-in');
  form.elements.grindSize.focus();
}

function createRecipeIteration(recipe, iteration, iterationNumber) {
  const section = document.createElement('section');
  section.className = 'recipe-iteration';

  const top = document.createElement('div');
  top.className = 'recipe-top';
  const titleWrap = document.createElement('div');
  const title = document.createElement('h4');
  title.textContent = `Iteration ${iterationNumber}`;
  const date = document.createElement('p');
  date.textContent = formatDate(iteration);
  titleWrap.append(title, date);
  top.append(titleWrap);

  const actions = document.createElement('div');
  actions.className = 'iteration-actions';
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.className = 'button button-secondary button-compact';
  edit.textContent = 'Edit';
  edit.addEventListener('click', () => editIteration(iteration.id));
  actions.append(edit);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'icon-button';
  remove.setAttribute(
    'aria-label',
    `Delete ${recipe.coffee} iteration ${iterationNumber}`,
  );
  remove.textContent = 'Delete';
  remove.addEventListener('click', () => deleteRecipe(iteration.id));
  actions.append(remove);
  top.append(actions);
  section.append(top);

  const metrics = document.createElement('dl');
  metrics.className = 'recipe-metrics';
  const entries = [
    ['Dose', `${formatMeasurement(iteration.dose)}g`],
    ['Yield', `${formatMeasurement(iteration.yieldGrams)}g`],
    ['Strength', `${formatMeasurement(iteration.strength, 2)}%`],
    [
      'Extraction',
      iteration.extractionYield
        ? `${formatMeasurement(iteration.extractionYield, 2)}%`
        : '—',
    ],
  ];
  entries.forEach(([term, value]) => {
    const group = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = term;
    dd.textContent = value;
    group.append(dt, dd);
    metrics.append(group);
  });
  section.append(metrics);

  const brewContext = document.createElement('dl');
  brewContext.className = 'brew-context';
  const brewEntries = [
    ['Grind size', iteration.grindSize || 'Not recorded'],
    [
      'Shot time',
      iteration.shotTime
        ? `${formatMeasurement(iteration.shotTime)} seconds`
        : 'Not recorded',
    ],
    ['Last assigned', formatRecency(iteration.lastAssignedAt)],
  ];
  brewEntries.forEach(([term, value]) => {
    const group = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = term;
    dd.textContent = value;
    group.append(dt, dd);
    brewContext.append(group);
  });
  section.append(brewContext);

  const assignment = document.createElement('div');
  assignment.className = 'assignment';
  const select = document.createElement('select');
  select.setAttribute(
    'aria-label',
    `Assign ${recipe.coffee} iteration ${iterationNumber} to a machine program`,
  );
  const prompt = document.createElement('option');
  prompt.value = '';
  prompt.textContent = 'Assign to a program…';
  select.append(prompt);
  PROGRAM_NAMES.forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    option.selected = String(state.programs[name]) === String(iteration.id);
    select.append(option);
  });
  select.addEventListener('change', () => {
    if (select.value) assignRecipe(iteration.id, select.value);
  });
  assignment.append(select);
  section.append(assignment);
  return section;
}

function createRecipeCard(recipe) {
  const card = document.createElement('details');
  card.className = 'recipe-card panel';

  const heading = document.createElement('summary');
  heading.className = 'recipe-group-heading';
  const title = document.createElement('h3');
  title.textContent = recipe.coffee;
  const count = document.createElement('p');
  const typeLabel = recipe.recipeType === 'single' ? 'Single' : 'Blend';
  count.textContent = `${typeLabel} · ${recipe.iterations.length} ${recipe.iterations.length === 1 ? 'iteration' : 'iterations'}`;
  heading.append(title, count);
  card.append(heading);

  [...recipe.iterations]
    .sort((a, b) =>
      String(b.createdAt ?? b.id).localeCompare(String(a.createdAt ?? a.id)),
    )
    .forEach((iteration, index) =>
      card.append(
        createRecipeIteration(
          recipe,
          iteration,
          recipe.iterations.length - index,
        ),
      ),
    );
  return card;
}

function renderRecipes() {
  const list = byId('recipe-list');
  const query = recipeNameKey(byId('recipe-search').value);
  const recipes = [...state.recipes]
    .filter((recipe) => recipeNameKey(recipe.coffee).includes(query))
    .sort((a, b) =>
      String(b.iterations.at(-1)?.createdAt ?? b.id).localeCompare(
        String(a.iterations.at(-1)?.createdAt ?? a.id),
      ),
    );
  list.replaceChildren();
  recipes.forEach((recipe) => list.append(createRecipeCard(recipe)));
  byId('recipe-search-status').textContent = query
    ? `${recipes.length} ${recipes.length === 1 ? 'coffee' : 'coffees'} found`
    : '';
  byId('recipes-empty').hidden = state.recipes.length !== 0;
  byId('recipe-search-wrap').hidden = state.recipes.length === 0;
  byId('recipes-no-results').hidden =
    state.recipes.length === 0 || recipes.length !== 0;
}

function persistAndRender() {
  saveState(state);
  renderDashboard();
  renderRecipes();
  void queueOnlineSave();
}

function showCalculation(calculation) {
  byId('result-placeholder').hidden = true;
  byId('result-content').hidden = false;
  byId('result-dose').textContent = formatMeasurement(
    calculation.recommendedDose,
  );
  byId('result-yield').textContent = formatMeasurement(
    calculation.recommendedYield,
  );
  byId('result-extraction').textContent =
    `${formatMeasurement(calculation.extractionYield, 2)}%`;
  byId('result-solids').textContent =
    `${formatMeasurement(calculation.dissolvedSolids, 2)}g`;
}

byId('dial-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const error = byId('dial-error');
  error.hidden = true;
  try {
    lastCalculation = dialInFrom(event.currentTarget);
    showCalculation(lastCalculation.result);
  } catch (caught) {
    error.textContent = caught.message;
    error.hidden = false;
  }
});

byId('dial-form').addEventListener('input', (event) => {
  if (event.target.name === 'coffee') {
    const savedRecipe = state.recipes.find(
      (recipe) =>
        recipeNameKey(recipe.coffee) === recipeNameKey(event.target.value),
    );
    if (savedRecipe) {
      event.currentTarget.elements.recipeType.value = savedRecipe.recipeType;
      event.currentTarget.elements.targetStrength.value =
        targetStrengthForRecipeType(savedRecipe.recipeType).toFixed(2);
    }
  }
  if (event.target.name === 'recipeType') {
    event.currentTarget.elements.targetStrength.value =
      targetStrengthForRecipeType(event.target.value).toFixed(2);
  }
  lastCalculation = null;
  byId('result-placeholder').hidden = false;
  byId('result-content').hidden = true;
});

byId('dial-further').addEventListener('click', () => {
  if (!lastCalculation) return;
  byId('dose').value = formatMeasurement(
    lastCalculation.result.recommendedDose,
  );
  byId('yield').value = formatMeasurement(
    lastCalculation.result.recommendedYield,
  );
  byId('strength').value = '';
  lastCalculation = null;
  byId('strength').focus();
  showToast('Recommendation loaded. Measure the next shot’s strength.');
});

byId('save-recipe').addEventListener('click', () => {
  const form = byId('dial-form');
  if (!form.reportValidity()) return;
  const error = byId('dial-error');
  error.hidden = true;
  let currentShot;
  try {
    currentShot = dialInFrom(form);
  } catch (caught) {
    error.textContent = caught.message;
    error.hidden = false;
    return;
  }
  const { coffee, recipeType, measurements, brewDetails, result } = currentShot;
  const savedAt = new Date().toISOString();
  const iteration = {
    id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
    dose: measurements.dose,
    yieldGrams: measurements.yieldGrams,
    strength: measurements.strength,
    targetStrength: measurements.targetStrength,
    targetSolids: measurements.targetSolids,
    grindSize: brewDetails.grindSize,
    shotTime: brewDetails.shotTime,
    extractionYield: result.extractionYield,
    dissolvedSolids: result.dissolvedSolids,
    createdAt: savedAt,
    lastAssignedAt: null,
  };
  const recipe = addRecipeIteration(state, coffee, iteration, recipeType);
  const wasEditing = editingIterationId !== null;
  const updatedAssignments = wasEditing
    ? replaceAssignedIteration(state, editingIterationId, iteration.id)
    : 0;
  if (updatedAssignments > 0) iteration.lastAssignedAt = savedAt;
  persistAndRender();
  byId('dial-form').reset();
  byId('target-strength').value = '9.30';
  byId('target-solids').value = '4.41';
  byId('result-placeholder').hidden = false;
  byId('result-content').hidden = true;
  lastCalculation = null;
  editingIterationId = null;
  byId('edit-context').hidden = true;
  showView('recipes');
  showToast(
    updatedAssignments > 0
      ? `${recipe.coffee} saved as iteration ${recipe.iterations.length} and updated on the assigned program.`
      : wasEditing || recipe.iterations.length > 1
        ? `${recipe.coffee} saved as iteration ${recipe.iterations.length}.`
        : `${recipe.coffee} saved to your recipe log.`,
  );
});

byId('quick-form').addEventListener('input', (event) => {
  const values = measurementsFrom(event.currentTarget);
  const outputs = [
    'quick-rec-dose',
    'quick-rec-yield',
    'quick-extraction',
    'quick-solids',
  ];
  try {
    const result = calculateDialIn(values);
    byId('quick-rec-dose').textContent = formatMeasurement(
      result.recommendedDose,
    );
    byId('quick-rec-yield').textContent = formatMeasurement(
      result.recommendedYield,
    );
    byId('quick-extraction').textContent = formatMeasurement(
      result.extractionYield,
      2,
    );
    byId('quick-solids').textContent = formatMeasurement(
      result.dissolvedSolids,
      2,
    );
  } catch {
    outputs.forEach((id) => {
      byId(id).textContent = '—';
    });
  }
});

byId('print-label').addEventListener('click', () => {
  if (!renderPrintLabel()) {
    showToast('Assign recipes to Long Up and Long Down before printing.');
    return;
  }
  window.print();
});

window.addEventListener('beforeprint', renderPrintLabel);

byId('export-button').addEventListener('click', () => {
  const blob = new Blob([exportState(state)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `coffeecalc-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('Backup exported.');
});

byId('import-button').addEventListener('click', () =>
  byId('import-file').click(),
);
byId('import-file').addEventListener('change', async (event) => {
  const [file] = event.currentTarget.files;
  if (!file) return;
  try {
    state = importState(await file.text());
    persistAndRender();
    showToast('Backup imported.');
  } catch {
    showToast('That file is not a valid CoffeeCalc backup.');
  } finally {
    event.currentTarget.value = '';
  }
});

byId('recipe-search').addEventListener('input', renderRecipes);

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-view], [data-go]');
  if (!target) return;
  showView(target.dataset.view || target.dataset.go);
});

renderDashboard();
renderRecipes();
void initialiseOnlineState();
const initialView = window.location.hash.slice(1);
if (['dashboard', 'dial-in', 'recipes', 'quick'].includes(initialView))
  showView(initialView);
