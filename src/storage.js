export const STORAGE_KEY = 'coffeecalc:v1';
export const SYNC_PENDING_KEY = 'coffeecalc:sync-pending';

export const PROGRAM_NAMES = ['Long Up', 'Down', 'Long Down'];
export const RECIPE_TYPES = ['single', 'blend'];

export function createInitialState() {
  return {
    recipes: [],
    programs: Object.fromEntries(PROGRAM_NAMES.map((name) => [name, null])),
  };
}

export function recipeNameKey(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase();
}

function normaliseRecipeType(value, targetStrength) {
  if (RECIPE_TYPES.includes(value)) return value;
  return Number(targetStrength) === 8.5 ? 'single' : 'blend';
}

function normaliseIteration(value, fallbackId) {
  if (
    !value ||
    !Number.isFinite(Number(value.dose)) ||
    !Number.isFinite(Number(value.yieldGrams ?? value.yield))
  ) {
    return null;
  }

  const shotTime = Number(value.shotTime);
  const iteration = {
    ...value,
    id: value.id ?? fallbackId,
    dose: Number(value.dose),
    yieldGrams: Number(value.yieldGrams ?? value.yield),
    grindSize: String(value.grindSize ?? ''),
    shotTime: Number.isFinite(shotTime) && shotTime > 0 ? shotTime : null,
    lastAssignedAt: value.lastAssignedAt ?? null,
  };
  delete iteration.coffee;
  delete iteration.iterations;
  delete iteration.lastBrewed;
  delete iteration.yield;
  return iteration;
}

function normaliseState(value) {
  const initial = createInitialState();
  if (!value || !Array.isArray(value.recipes)) return initial;

  const recipesByName = new Map();
  value.recipes.forEach((storedRecipe, recipeIndex) => {
    if (!storedRecipe || typeof storedRecipe.coffee !== 'string') return;
    const coffee = storedRecipe.coffee.trim();
    const key = recipeNameKey(coffee);
    if (!key) return;

    let recipe = recipesByName.get(key);
    if (!recipe) {
      recipe = {
        id: storedRecipe.iterations
          ? (storedRecipe.id ?? `recipe-${recipeIndex + 1}`)
          : `recipe-${storedRecipe.id ?? recipeIndex + 1}`,
        coffee,
        recipeType: normaliseRecipeType(
          storedRecipe.recipeType,
          storedRecipe.targetStrength ??
            storedRecipe.iterations?.[0]?.targetStrength,
        ),
        createdAt: storedRecipe.createdAt ?? null,
        iterations: [],
      };
      recipesByName.set(key, recipe);
    }

    const storedIterations = Array.isArray(storedRecipe.iterations)
      ? storedRecipe.iterations
      : [storedRecipe];
    storedIterations.forEach((storedIteration) => {
      const iteration = normaliseIteration(
        storedIteration,
        `${recipe.id}-iteration-${recipe.iterations.length + 1}`,
      );
      if (iteration) recipe.iterations.push(iteration);
    });
  });

  return {
    recipes: [...recipesByName.values()].filter(
      (recipe) => recipe.iterations.length > 0,
    ),
    programs: Object.fromEntries(
      PROGRAM_NAMES.map((name) => [name, value.programs?.[name] ?? null]),
    ),
  };
}

export function findIteration(state, iterationId) {
  for (const recipe of state.recipes) {
    const iteration = recipe.iterations.find(
      (item) => String(item.id) === String(iterationId),
    );
    if (iteration) return { recipe, iteration };
  }
  return null;
}

export function addRecipeIteration(
  state,
  coffeeName,
  iteration,
  recipeType = 'blend',
) {
  const coffee = String(coffeeName).trim();
  const key = recipeNameKey(coffee);
  let recipe = state.recipes.find((item) => recipeNameKey(item.coffee) === key);

  if (!recipe) {
    recipe = {
      id: globalThis.crypto?.randomUUID?.() ?? `recipe-${Date.now()}`,
      coffee,
      recipeType: normaliseRecipeType(recipeType),
      createdAt: iteration.createdAt ?? new Date().toISOString(),
      iterations: [],
    };
    state.recipes.push(recipe);
  }
  recipe.recipeType = normaliseRecipeType(recipeType);
  recipe.iterations.push(iteration);
  return recipe;
}

export function replaceAssignedIteration(
  state,
  previousIterationId,
  nextIterationId,
) {
  let updatedPrograms = 0;
  Object.keys(state.programs).forEach((programName) => {
    if (String(state.programs[programName]) === String(previousIterationId)) {
      state.programs[programName] = nextIterationId;
      updatedPrograms += 1;
    }
  });
  return updatedPrograms;
}

export function loadState(storage = window.localStorage) {
  try {
    const current = storage.getItem(STORAGE_KEY);
    if (current) return normaliseState(JSON.parse(current));

    const legacyRecipes = JSON.parse(
      storage.getItem('coffeeRecipes') || 'null',
    );
    const legacyPrograms = JSON.parse(
      storage.getItem('coffeePrograms') || 'null',
    );
    if (legacyRecipes || legacyPrograms) {
      return normaliseState({
        recipes: legacyRecipes || [],
        programs: legacyPrograms || {},
      });
    }
  } catch {
    return createInitialState();
  }

  return createInitialState();
}

export function saveState(
  state,
  storage = window.localStorage,
  { synced = false } = {},
) {
  storage.setItem(STORAGE_KEY, JSON.stringify(normaliseState(state)));
  if (synced) {
    storage.removeItem(SYNC_PENDING_KEY);
  } else {
    storage.setItem(SYNC_PENDING_KEY, new Date().toISOString());
  }
}

export function isStateSyncPending(storage = window.localStorage) {
  return storage.getItem(SYNC_PENDING_KEY) !== null;
}

export function markStateSynced(storage = window.localStorage) {
  storage.removeItem(SYNC_PENDING_KEY);
}

export function exportState(state) {
  return JSON.stringify(normaliseState(state), null, 2);
}

export function importState(json) {
  return normaliseState(JSON.parse(json));
}
