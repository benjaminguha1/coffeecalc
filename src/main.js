import './styles.css';
import {
  FILTER_TARGET_YIELD_GRAMS,
  calculateBypassWater,
  calculateDialIn,
  filterTargetSolids,
  formatMeasurement,
} from './calculator.js';
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
let editingRecipeId = null;
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
        <p class="view-intro">Record a brew, calculate a recommendation, or save notes for later.</p>
      </div>
      <div class="workflow-grid">
        <form class="panel form-panel" id="dial-form">
          <div class="field field-wide">
            <label for="coffee-name">Coffee label <span>optional</span></label>
            <input id="coffee-name" name="coffee" type="text" maxlength="80" autocomplete="off" placeholder="e.g. Showcase Blend" />
            <small class="edit-context" id="edit-context" hidden>Editing a saved recipe. Saving will create a new iteration.</small>
          </div>
          <div class="field field-wide">
            <label for="recipe-type">Coffee type</label>
            <select id="recipe-type" name="recipeType">
              <option value="blend" selected>Blend</option>
              <option value="single">Single origin</option>
            </select>
          </div>
          <div class="field field-wide">
            <label for="brew-method">Recipe</label>
            <select id="brew-method" name="brewMethod">
              <option value="espresso" selected>Espresso</option>
              <option value="filter">Filter</option>
            </select>
          </div>
          <div class="field">
            <label for="sku">SKU <span>optional</span></label>
            <input id="sku" name="sku" type="text" maxlength="80" autocomplete="off" />
          </div>
          <div class="field">
            <label for="roast-month">Roast month <span>optional</span></label>
            <input id="roast-month" name="roastMonth" type="month" />
          </div>
          <label class="check-field">
            <input id="in-cellar" name="inCellar" type="checkbox" />
            <span>In cellar</span>
          </label>
          <section class="coffee-components field-wide" aria-labelledby="components-heading">
            <div class="component-heading">
              <div><p class="target-title" id="components-heading">Coffee details</p><small>Every field is optional.</small></div>
              <button class="button button-secondary button-compact" id="add-component" type="button">Add component</button>
            </div>
            <div id="component-list"></div>
          </section>
          <div class="field">
            <label for="dose">Dose <span>optional · g</span></label>
            <input id="dose" name="dose" type="number" min="0.1" max="500" step="0.1" inputmode="decimal" placeholder="18.0" />
          </div>
          <div class="field">
            <label for="yield">Beverage yield <span>optional · g</span></label>
            <input id="yield" name="yieldGrams" type="number" min="0.1" max="2000" step="0.1" inputmode="decimal" placeholder="40.0" />
          </div>
          <div class="field">
            <label for="grind-size">Grind size <span>optional</span></label>
            <input id="grind-size" name="grindSize" type="text" maxlength="40" autocomplete="off" placeholder="e.g. 4.2 or 18 clicks" />
          </div>
          <div class="field">
            <label for="shot-time">Brew time <span>optional · seconds</span></label>
            <input id="shot-time" name="shotTime" type="number" min="1" max="3600" step="0.1" inputmode="decimal" placeholder="28.0" />
          </div>
          <div class="field field-wide">
            <label for="strength">Measured strength <span>optional · % TDS</span></label>
            <input id="strength" name="strength" type="number" min="0.01" max="30" step="0.01" inputmode="decimal" placeholder="9.30" />
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
                <input id="target-strength" name="targetStrength" type="number" min="0.01" max="30" step="0.01" value="9.30" />
              </div>
              <div class="field">
                <label for="target-solids">Target dissolved solids <span>g</span></label>
                <input id="target-solids" name="targetSolids" type="number" min="0.01" max="100" step="0.001" value="4.41" />
                <small id="target-solids-help"></small>
              </div>
            </div>
          </section>
          <p class="form-error field-wide" id="dial-error" role="alert" hidden></p>
          <button class="button button-primary button-large field-wide" type="submit">Calculate recommendation</button>
          <button class="button button-secondary button-large field-wide" id="save-recipe" type="button">Save notebook entry</button>
        </form>

        <aside class="panel result-panel" id="dial-result" aria-live="polite">
          <div class="result-placeholder" id="result-placeholder">
            <span aria-hidden="true">↗</span>
            <h3>Your recommendation appears here</h3>
            <p>Add the brew measurements to see extraction and the suggested next recipe.</p>
          </div>
          <div id="result-content" hidden>
            <p class="eyebrow">Recommended next recipe</p>
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
        <input id="recipe-search" type="search" placeholder="Search origin, name, varietal or SKU…" autocomplete="off" />
        <div class="log-controls">
          <label><input id="cellar-only" type="checkbox" /> Cellar only</label>
          <button class="button button-secondary button-compact" id="sort-recipes" type="button" data-sort="newest">Sort: newest</button>
        </div>
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
      <form class="panel bypass-form" id="bypass-form">
        <div class="section-heading"><p class="target-title">Bypass brew</p><small>Dilute a brewed beverage with water to reach a lower TDS.</small></div>
        <div class="field"><label for="bypass-mass">Beverage mass <span>g</span></label><input id="bypass-mass" name="beverageMass" type="number" min="0.1" step="0.1" inputmode="decimal" /></div>
        <div class="field"><label for="bypass-current">Current TDS <span>%</span></label><input id="bypass-current" name="currentTds" type="number" min="0.01" step="0.01" inputmode="decimal" /></div>
        <div class="field"><label for="bypass-target">Target TDS <span>%</span></label><input id="bypass-target" name="targetTds" type="number" min="0.01" step="0.01" inputmode="decimal" /></div>
        <div class="bypass-result" aria-live="polite"><span>Water to add</span><strong id="bypass-water">—</strong><small id="bypass-message">grams</small></div>
      </form>
    </section>
  </main>

  <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
  <section class="print-label" id="print-label-sheet" aria-label="Long Up and Long Down recipes"></section>
`;

document.querySelector('#staff-name').textContent =
  app.dataset.username || 'Staff';
document.querySelector('#staff-admin').hidden = app.dataset.role !== 'admin';

const byId = (id) => document.getElementById(id);
const optionalNumberFrom = (formData, name) => {
  const value = formData.get(name);
  if (value === '' || value === null) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

function componentRow(component = {}, index = 0) {
  const row = document.createElement('fieldset');
  row.className = 'component-row';
  row.dataset.component = '';
  const legend = document.createElement('legend');
  legend.textContent = `Coffee ${index + 1}`;
  const fields = [
    ['country', 'Country of origin'],
    ['name', 'Name'],
    ['process', 'Process'],
    ['varietal', 'Varietal'],
  ];
  row.append(legend);
  fields.forEach(([name, labelText]) => {
    const field = document.createElement('div');
    field.className = 'field';
    const label = document.createElement('label');
    label.textContent = labelText;
    const input = document.createElement('input');
    input.id = `component-${index}-${name}`;
    label.htmlFor = input.id;
    input.name = `component-${name}`;
    input.type = 'text';
    input.maxLength = 100;
    input.autocomplete = 'off';
    input.value = component[name] ?? '';
    field.append(label, input);
    row.append(field);
  });
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'icon-button component-remove';
  remove.textContent = 'Remove';
  remove.hidden = index === 0;
  remove.addEventListener('click', () => {
    row.remove();
    refreshComponentRows();
  });
  row.append(remove);
  return row;
}

function refreshComponentRows() {
  const form = byId('dial-form');
  const isBlend = form.elements.recipeType.value === 'blend';
  const rows = [...byId('component-list').querySelectorAll('[data-component]')];
  if (rows.length === 0) byId('component-list').append(componentRow({}, 0));
  [...byId('component-list').querySelectorAll('[data-component]')].forEach(
    (row, index) => {
      row.querySelector('legend').textContent = isBlend
        ? `Component ${index + 1}`
        : 'Single origin details';
      row.querySelector('.component-remove').hidden = !isBlend || index === 0;
      row.querySelectorAll('input').forEach((input) => {
        const name = input.name.replace('component-', '');
        input.id = `component-${index}-${name}`;
        row.querySelector(`label[for$="-${name}"]`).htmlFor = input.id;
      });
      if (!isBlend && index > 0) row.remove();
    },
  );
  byId('add-component').hidden = !isBlend;
}

function setComponents(components = []) {
  const list = byId('component-list');
  list.replaceChildren();
  (components.length ? components : [{}]).forEach((component, index) =>
    list.append(componentRow(component, index)),
  );
  refreshComponentRows();
}

function componentsFrom(form) {
  return [...form.querySelectorAll('[data-component]')]
    .map((row) =>
      Object.fromEntries(
        ['country', 'name', 'process', 'varietal'].map((name) => [
          name,
          row.querySelector(`[name="component-${name}"]`).value.trim(),
        ]),
      ),
    )
    .filter((component) => Object.values(component).some(Boolean));
}

function recipeDisplayName(recipe) {
  return (
    recipe.coffee ||
    recipe.components
      ?.map((component) => component.name)
      .filter(Boolean)
      .join(' + ') ||
    recipe.sku ||
    'Untitled coffee'
  );
}

function isCompleteIteration(iteration) {
  return [
    'dose',
    'yieldGrams',
    'strength',
    'targetStrength',
    'targetSolids',
  ].every((key) => Number.isFinite(iteration[key]) && iteration[key] > 0);
}

function formatOptional(value, decimals = 1, suffix = '') {
  return Number.isFinite(value) && value > 0
    ? `${formatMeasurement(value, decimals)}${suffix}`
    : '—';
}

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

function measurementsFrom(form, brewMethod = form.elements.brewMethod?.value) {
  const data = new FormData(form);
  const targetStrength = optionalNumberFrom(data, 'targetStrength');
  return {
    dose: optionalNumberFrom(data, 'dose'),
    yieldGrams: optionalNumberFrom(data, 'yieldGrams'),
    strength: optionalNumberFrom(data, 'strength'),
    targetStrength,
    targetSolids:
      brewMethod === 'filter' && targetStrength
        ? filterTargetSolids(targetStrength)
        : optionalNumberFrom(data, 'targetSolids'),
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

function targetStrengthForRecipeType(brewMethod, recipeType = 'blend') {
  if (brewMethod === 'filter') return 1.35;
  return recipeType === 'single' ? 8.5 : 9.3;
}

function targetSolidsForBrewMethod(brewMethod) {
  return brewMethod === 'filter' ? filterTargetSolids(1.35) : 4.41;
}

function updateTargetControls(form, brewMethod) {
  const targetSolids = form.elements.targetSolids;
  const help = byId('target-solids-help');
  const isFilter = brewMethod === 'filter';
  targetSolids.readOnly = isFilter;
  targetSolids.setAttribute('aria-readonly', String(isFilter));
  help.textContent = isFilter
    ? `Calculated from a fixed ${FILTER_TARGET_YIELD_GRAMS} g brewed-beverage output (about 12 US fl oz).`
    : '';
  if (isFilter) {
    const targetStrength = Number(form.elements.targetStrength.value);
    if (Number.isFinite(targetStrength) && targetStrength > 0) {
      targetSolids.value = filterTargetSolids(targetStrength).toFixed(3);
    }
  }
}

function applyBrewDefaults(form, brewMethod) {
  form.elements.targetStrength.value = targetStrengthForRecipeType(
    brewMethod,
    form.elements.recipeType.value,
  ).toFixed(2);
  form.elements.targetSolids.value =
    targetSolidsForBrewMethod(brewMethod).toFixed(3);
  form.elements.yieldGrams.placeholder =
    brewMethod === 'filter' ? '355.0' : '40.0';
  form.elements.strength.placeholder =
    brewMethod === 'filter' ? '1.35' : '9.30';
  updateTargetControls(form, brewMethod);
}

function dialInFrom(form) {
  const data = new FormData(form);
  const brewMethod = data.get('brewMethod');
  const measurements = measurementsFrom(form, brewMethod);
  return {
    coffee: data.get('coffee').trim(),
    recipeType: data.get('recipeType'),
    brewMethod,
    metadata: {
      sku: data.get('sku').trim(),
      roastMonth: data.get('roastMonth'),
      inCellar: data.get('inCellar') === 'on',
      components: componentsFrom(form),
    },
    measurements,
    brewDetails: brewDetailsFrom(form),
    result: isCompleteIteration(measurements)
      ? calculateDialIn({ ...measurements, brewMethod })
      : null,
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
  title.textContent = recipe ? recipeDisplayName(recipe) : 'Ready for a coffee';
  heading.append(title);

  const detail = document.createElement('p');
  detail.textContent = recipe
    ? `${recipe.recipeType === 'single' ? 'Single origin' : 'Blend'} · ${formatOptional(recipe.dose, 1, 'g')} → ${formatOptional(recipe.yieldGrams ?? recipe.yield, 1, 'g')} · ${formatOptional(recipe.strength, 2, '%')} · ${recipe.grindSize || 'Grind not set'} · ${recipe.shotTime ? `${formatMeasurement(recipe.shotTime)}s` : 'Time not set'}`
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
              sku: match.recipe.sku,
              components: match.recipe.components,
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
  return match
    ? {
        ...match.iteration,
        coffee: match.recipe.coffee,
        sku: match.recipe.sku,
        components: match.recipe.components,
      }
    : null;
}

function createPrintRecipe(programName, recipe) {
  const column = document.createElement('article');
  column.className = 'print-recipe';

  const program = document.createElement('p');
  program.className = 'print-program';
  program.textContent = programName;

  const coffee = document.createElement('h1');
  coffee.textContent = recipeDisplayName(recipe);

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

function formatRoastMonth(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? '');
  if (!match) return '';
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
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
  if (
    !match ||
    match.iteration.brewMethod === 'filter' ||
    !isCompleteIteration(match.iteration)
  ) {
    showToast(
      'Only complete espresso recipes can be assigned to a machine program.',
    );
    return;
  }

  Object.entries(state.programs).forEach(([name, assignedId]) => {
    const assigned = findIteration(state, assignedId);
    if (assigned?.recipe.id === match.recipe.id && name !== programName) {
      state.programs[name] = null;
    }
  });
  state.programs[programName] = match.iteration.id;
  match.iteration.lastAssignedAt = new Date().toISOString();
  persistAndRender();
  showToast(`${recipeDisplayName(match.recipe)} assigned to ${programName}.`);
}

function deleteRecipe(recipeId) {
  const match = findIteration(state, recipeId);
  if (
    !match ||
    !window.confirm(`Delete this ${recipeDisplayName(match.recipe)} iteration?`)
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
  form.elements.brewMethod.value = iteration.brewMethod ?? 'espresso';
  form.elements.sku.value = recipe.sku ?? '';
  form.elements.roastMonth.value = recipe.roastMonth ?? '';
  form.elements.inCellar.checked = Boolean(recipe.inCellar);
  setComponents(recipe.components);
  form.elements.grindSize.value = iteration.grindSize ?? '';
  form.elements.shotTime.value = iteration.shotTime ?? '';
  form.elements.dose.value = iteration.dose ?? '';
  form.elements.yieldGrams.value = iteration.yieldGrams ?? '';
  form.elements.strength.value = iteration.strength ?? '';
  const method = iteration.brewMethod ?? 'espresso';
  form.elements.targetStrength.value =
    iteration.targetStrength ??
    targetStrengthForRecipeType(method, recipe.recipeType);
  form.elements.targetSolids.value =
    method === 'filter'
      ? filterTargetSolids(Number(form.elements.targetStrength.value)).toFixed(
          3,
        )
      : (iteration.targetSolids ?? targetSolidsForBrewMethod(method));
  editingIterationId = iteration.id;
  editingRecipeId = recipe.id;
  form.elements.yieldGrams.placeholder = method === 'filter' ? '355.0' : '40.0';
  form.elements.strength.placeholder = method === 'filter' ? '1.35' : '9.30';
  updateTargetControls(form, method);
  lastCalculation = null;
  byId('edit-context').hidden = false;
  byId('edit-context').textContent =
    'Editing a saved recipe. Saving will create a new iteration.';
  byId('result-placeholder').hidden = false;
  byId('result-content').hidden = true;
  showView('dial-in');
  form.elements.grindSize.focus();
}

function createOtherMethod(recipe) {
  const form = byId('dial-form');
  const latest = recipe.iterations.at(-1);
  const latestMethod = latest?.brewMethod ?? 'espresso';
  const method = latestMethod === 'espresso' ? 'filter' : 'espresso';
  form.reset();
  form.elements.coffee.value = recipe.coffee;
  form.elements.recipeType.value = recipe.recipeType;
  form.elements.brewMethod.value = method;
  form.elements.sku.value = recipe.sku ?? '';
  form.elements.roastMonth.value = recipe.roastMonth ?? '';
  form.elements.inCellar.checked = Boolean(recipe.inCellar);
  setComponents(recipe.components);
  applyBrewDefaults(form, method);
  editingIterationId = null;
  editingRecipeId = recipe.id;
  lastCalculation = null;
  byId('edit-context').hidden = false;
  byId('edit-context').textContent =
    `Adding a ${method} recipe for this coffee.`;
  byId('result-placeholder').hidden = false;
  byId('result-content').hidden = true;
  showView('dial-in');
  form.elements.dose.focus();
}

function createRecipeIteration(
  recipe,
  iteration,
  iterationNumber,
  { current = false } = {},
) {
  const section = document.createElement('section');
  section.className = 'recipe-iteration';
  section.classList.toggle('is-current', current);

  const top = document.createElement('div');
  top.className = 'recipe-top';
  const titleWrap = document.createElement('div');
  const title = document.createElement('h4');
  title.textContent = current
    ? 'Current / preferred'
    : `Iteration ${iterationNumber}`;
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
    `Delete ${recipeDisplayName(recipe)} iteration ${iterationNumber}`,
  );
  remove.textContent = 'Delete';
  remove.addEventListener('click', () => deleteRecipe(iteration.id));
  actions.append(remove);
  top.append(actions);
  section.append(top);

  const metrics = document.createElement('dl');
  metrics.className = 'recipe-metrics';
  const entries = [
    ['Dose', formatOptional(iteration.dose, 1, 'g')],
    ['Yield', formatOptional(iteration.yieldGrams, 1, 'g')],
    ['Strength', formatOptional(iteration.strength, 2, '%')],
    [
      'Extraction',
      Number.isFinite(iteration.extractionYield)
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
      'Brew time',
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
  if (iteration.brewMethod === 'filter' || !isCompleteIteration(iteration)) {
    const note = document.createElement('small');
    note.textContent =
      iteration.brewMethod === 'filter'
        ? 'Filter recipes are kept in the log and cannot be assigned to espresso machine programs.'
        : 'Add all measurements before assigning this espresso recipe to a program.';
    assignment.append(note);
    section.append(assignment);
    return section;
  }
  const select = document.createElement('select');
  select.setAttribute(
    'aria-label',
    `Assign ${recipeDisplayName(recipe)} iteration ${iterationNumber} to a machine program`,
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
  title.textContent = recipeDisplayName(recipe);
  const count = document.createElement('p');
  const typeLabel = recipe.recipeType === 'single' ? 'Single' : 'Blend';
  count.textContent = `${typeLabel} · ${recipe.iterations.length} ${recipe.iterations.length === 1 ? 'iteration' : 'iterations'}`;
  heading.append(title, count);
  card.append(heading);

  const metadata = document.createElement('div');
  metadata.className = 'recipe-metadata';
  if (recipe.sku) {
    const sku = document.createElement('span');
    sku.textContent = `SKU ${recipe.sku}`;
    metadata.append(sku);
  }
  if (recipe.roastMonth) {
    const roastMonth = document.createElement('span');
    roastMonth.textContent = `Roasted ${formatRoastMonth(recipe.roastMonth)}`;
    metadata.append(roastMonth);
  }
  if (recipe.inCellar) {
    const cellar = document.createElement('span');
    cellar.textContent = 'Cellar';
    metadata.append(cellar);
  }
  recipe.components?.forEach((component) => {
    const text = [
      component.country,
      component.name,
      component.process,
      component.varietal,
    ]
      .filter(Boolean)
      .join(' · ');
    if (!text) return;
    const componentLine = document.createElement('p');
    componentLine.textContent = text;
    metadata.append(componentLine);
  });
  if (metadata.childNodes.length) card.append(metadata);

  const methodAction = document.createElement('button');
  methodAction.type = 'button';
  methodAction.className = 'button button-secondary button-compact add-method';
  const methods = new Set(
    recipe.iterations.map((iteration) => iteration.brewMethod ?? 'espresso'),
  );
  methodAction.textContent =
    methods.has('espresso') && !methods.has('filter')
      ? 'Add filter recipe'
      : methods.has('filter') && !methods.has('espresso')
        ? 'Add espresso recipe'
        : 'Add another brew recipe';
  methodAction.addEventListener('click', () => createOtherMethod(recipe));
  card.append(methodAction);

  ['espresso', 'filter'].forEach((method) => {
    const iterations = recipe.iterations.filter(
      (iteration) => (iteration.brewMethod ?? 'espresso') === method,
    );
    if (!iterations.length) return;
    const methodHeading = document.createElement('h4');
    methodHeading.className = 'method-heading';
    methodHeading.textContent =
      method === 'espresso' ? 'Espresso recipes' : 'Filter recipes';
    card.append(methodHeading);
    const current = iterations.at(-1);
    card.append(
      createRecipeIteration(recipe, current, iterations.length, {
        current: true,
      }),
    );
    const previousIterations = iterations.slice(0, -1);
    if (previousIterations.length) {
      const previous = document.createElement('details');
      previous.className = 'previous-recipes';
      const previousHeading = document.createElement('summary');
      previousHeading.textContent = `Previous recipes (${previousIterations.length})`;
      previous.append(previousHeading);
      previousIterations
        .map((iteration, index) => ({ iteration, number: index + 1 }))
        .reverse()
        .forEach(({ iteration, number }) =>
          previous.append(createRecipeIteration(recipe, iteration, number)),
        );
      card.append(previous);
    }
  });
  return card;
}

function renderRecipes() {
  const list = byId('recipe-list');
  const query = recipeNameKey(byId('recipe-search').value);
  const cellarOnly = byId('cellar-only').checked;
  const searchText = (recipe) =>
    [
      recipe.coffee,
      recipe.sku,
      ...(recipe.components ?? []).flatMap((component) => [
        component.country,
        component.name,
        component.varietal,
      ]),
    ]
      .join(' ')
      .toLocaleLowerCase();
  const recipes = [...state.recipes].filter(
    (recipe) =>
      (!cellarOnly || recipe.inCellar) && searchText(recipe).includes(query),
  );
  if (byId('sort-recipes').dataset.sort === 'name') {
    recipes.sort((a, b) =>
      recipeDisplayName(a).localeCompare(recipeDisplayName(b)),
    );
  } else {
    recipes.sort((a, b) =>
      String(b.iterations.at(-1)?.createdAt ?? b.id).localeCompare(
        String(a.iterations.at(-1)?.createdAt ?? a.id),
      ),
    );
  }
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
    if (!lastCalculation.result) {
      throw new RangeError(
        'Add dose, beverage yield, measured TDS, target TDS and target dissolved solids to calculate. You can still save an incomplete notebook entry.',
      );
    }
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
      if (event.currentTarget.elements.brewMethod.value === 'espresso') {
        event.currentTarget.elements.targetStrength.value =
          targetStrengthForRecipeType(
            'espresso',
            savedRecipe.recipeType,
          ).toFixed(2);
      }
      event.currentTarget.elements.sku.value = savedRecipe.sku ?? '';
      event.currentTarget.elements.roastMonth.value =
        savedRecipe.roastMonth ?? '';
      event.currentTarget.elements.inCellar.checked = Boolean(
        savedRecipe.inCellar,
      );
      setComponents(savedRecipe.components);
      editingRecipeId = savedRecipe.id;
    } else if (!editingIterationId) {
      editingRecipeId = null;
    }
  }
  if (event.target.name === 'recipeType') {
    refreshComponentRows();
    if (event.currentTarget.elements.brewMethod.value === 'espresso') {
      event.currentTarget.elements.targetStrength.value =
        targetStrengthForRecipeType('espresso', event.target.value).toFixed(2);
    }
  }
  if (event.target.name === 'brewMethod') {
    applyBrewDefaults(event.currentTarget, event.target.value);
  }
  if (
    event.target.name === 'targetStrength' &&
    event.currentTarget.elements.brewMethod.value === 'filter'
  ) {
    updateTargetControls(event.currentTarget, 'filter');
  }
  lastCalculation = null;
  byId('result-placeholder').hidden = false;
  byId('result-content').hidden = true;
});

byId('dial-further').addEventListener('click', () => {
  if (!lastCalculation) return;
  const brewMethod = lastCalculation.brewMethod;
  byId('dose').value = formatMeasurement(
    lastCalculation.result.recommendedDose,
  );
  if (brewMethod !== 'filter') {
    byId('yield').value = formatMeasurement(
      lastCalculation.result.recommendedYield,
    );
  }
  byId('strength').value = '';
  lastCalculation = null;
  byId('strength').focus();
  showToast(
    brewMethod === 'filter'
      ? `Recommended dose loaded. Keep the measured yield in the log; the next filter target is ${FILTER_TARGET_YIELD_GRAMS} g.`
      : 'Recommendation loaded. Measure the next brew’s strength.',
  );
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
  const {
    coffee,
    recipeType,
    brewMethod,
    metadata,
    measurements,
    brewDetails,
    result,
  } = currentShot;
  const savedAt = new Date().toISOString();
  const iteration = {
    id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
    brewMethod,
    dose: measurements.dose,
    yieldGrams: measurements.yieldGrams,
    strength: measurements.strength,
    targetStrength: measurements.targetStrength,
    targetSolids: measurements.targetSolids,
    grindSize: brewDetails.grindSize,
    shotTime: brewDetails.shotTime,
    extractionYield: result?.extractionYield ?? null,
    dissolvedSolids: result?.dissolvedSolids ?? null,
    createdAt: savedAt,
    lastAssignedAt: null,
  };
  const previous = editingIterationId
    ? findIteration(state, editingIterationId)
    : null;
  const recipe = addRecipeIteration(state, coffee, iteration, recipeType, {
    ...metadata,
    recipeId: editingRecipeId,
  });
  const wasEditing = editingIterationId !== null;
  const updatedAssignments =
    wasEditing &&
    previous?.iteration.brewMethod !== 'filter' &&
    brewMethod === 'espresso' &&
    isCompleteIteration(iteration)
      ? replaceAssignedIteration(state, editingIterationId, iteration.id)
      : 0;
  if (updatedAssignments > 0) iteration.lastAssignedAt = savedAt;
  persistAndRender();
  byId('dial-form').reset();
  byId('target-strength').value = '9.30';
  byId('target-solids').value = '4.41';
  updateTargetControls(byId('dial-form'), 'espresso');
  setComponents();
  byId('result-placeholder').hidden = false;
  byId('result-content').hidden = true;
  lastCalculation = null;
  editingIterationId = null;
  editingRecipeId = null;
  byId('edit-context').hidden = true;
  byId('edit-context').textContent =
    'Editing a saved recipe. Saving will create a new iteration.';
  showView('recipes');
  showToast(
    updatedAssignments > 0
      ? `${recipeDisplayName(recipe)} saved as iteration ${recipe.iterations.length} and updated on the assigned program.`
      : wasEditing || recipe.iterations.length > 1
        ? `${recipeDisplayName(recipe)} saved as iteration ${recipe.iterations.length}.`
        : `${recipeDisplayName(recipe)} saved to your recipe log.`,
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

byId('bypass-form').addEventListener('submit', (event) =>
  event.preventDefault(),
);
byId('bypass-form').addEventListener('input', (event) => {
  const data = new FormData(event.currentTarget);
  try {
    const result = calculateBypassWater({
      beverageMass: optionalNumberFrom(data, 'beverageMass'),
      currentTds: optionalNumberFrom(data, 'currentTds'),
      targetTds: optionalNumberFrom(data, 'targetTds'),
    });
    byId('bypass-water').textContent = formatMeasurement(result.addedWater);
    byId('bypass-message').textContent = 'grams';
  } catch (error) {
    byId('bypass-water').textContent = '—';
    const hasAllValues = ['beverageMass', 'currentTds', 'targetTds'].every(
      (name) => optionalNumberFrom(data, name),
    );
    byId('bypass-message').textContent = hasAllValues
      ? error.message
      : 'Enter all three values.';
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
byId('cellar-only').addEventListener('change', renderRecipes);
byId('sort-recipes').addEventListener('click', (event) => {
  const isNewest = event.currentTarget.dataset.sort === 'newest';
  event.currentTarget.dataset.sort = isNewest ? 'name' : 'newest';
  event.currentTarget.textContent = isNewest ? 'Sort: name' : 'Sort: newest';
  renderRecipes();
});
byId('add-component').addEventListener('click', () => {
  const list = byId('component-list');
  list.append(componentRow({}, list.children.length));
  refreshComponentRows();
});

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-view], [data-go]');
  if (!target) return;
  showView(target.dataset.view || target.dataset.go);
});

renderDashboard();
setComponents();
renderRecipes();
void initialiseOnlineState();
const initialView = window.location.hash.slice(1);
if (['dashboard', 'dial-in', 'recipes', 'quick'].includes(initialView))
  showView(initialView);
