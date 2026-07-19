import { beforeEach, describe, expect, it } from 'vitest';
import {
  STORAGE_KEY,
  SYNC_PENDING_KEY,
  addRecipeIteration,
  createInitialState,
  exportState,
  findIteration,
  importState,
  isStateSyncPending,
  loadState,
  markStateSynced,
  replaceAssignedIteration,
  saveState,
} from './storage.js';

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function iteration(id, overrides = {}) {
  return {
    id,
    dose: 18,
    yieldGrams: 40,
    grindSize: '4.2',
    shotTime: 28,
    lastAssignedAt: null,
    ...overrides,
  };
}

let storage;

beforeEach(() => {
  storage = createStorage();
});

describe('state persistence', () => {
  it('returns an empty, usable state when no data exists', () => {
    expect(loadState(storage)).toEqual(createInitialState());
  });

  it('saves and reloads grouped recipes and program assignments', () => {
    const state = createInitialState();
    state.recipes.push({
      id: 'recipe-1',
      coffee: 'Showcase Blend',
      recipeType: 'blend',
      createdAt: '2026-07-16T00:00:00.000Z',
      iterations: [
        iteration('shot-1', {
          lastAssignedAt: '2026-07-16T00:00:00.000Z',
        }),
      ],
    });
    state.programs.Down = 'shot-1';

    saveState(state, storage);

    expect(JSON.parse(storage.getItem(STORAGE_KEY))).toEqual(state);
    expect(isStateSyncPending(storage)).toBe(true);
    expect(loadState(storage)).toEqual(state);
  });

  it('clears the pending marker after the state is synced', () => {
    const state = createInitialState();
    saveState(state, storage);

    markStateSynced(storage);

    expect(storage.getItem(SYNC_PENDING_KEY)).toBeNull();
    expect(isStateSyncPending(storage)).toBe(false);
  });

  it('stores remote state without marking it as a local edit', () => {
    saveState(createInitialState(), storage, { synced: true });

    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(isStateSyncPending(storage)).toBe(false);
  });

  it('migrates flat recipes and groups duplicate coffee names as iterations', () => {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        recipes: [
          {
            id: 'shot-1',
            coffee: 'Showcase Blend',
            dose: 18,
            yield: 38,
          },
          {
            id: 'shot-2',
            coffee: ' showcase blend ',
            dose: 18,
            yieldGrams: 40,
          },
        ],
        programs: { Down: 'shot-2' },
      }),
    );

    const state = loadState(storage);

    expect(state.recipes).toHaveLength(1);
    expect(state.recipes[0].coffee).toBe('Showcase Blend');
    expect(state.recipes[0].recipeType).toBe('blend');
    expect(state.recipes[0].iterations.map(({ id }) => id)).toEqual([
      'shot-1',
      'shot-2',
    ]);
    expect(state.recipes[0].iterations[0].yieldGrams).toBe(38);
    expect(state.programs.Down).toBe('shot-2');
  });

  it('migrates the original prototype storage keys', () => {
    storage.setItem(
      'coffeeRecipes',
      JSON.stringify([{ id: 1, coffee: 'Legacy Coffee', dose: 20, yield: 42 }]),
    );
    storage.setItem(
      'coffeePrograms',
      JSON.stringify({ 'Long Up': 1, Down: null, 'Long Down': null }),
    );

    const state = loadState(storage);
    const migrated = state.recipes[0].iterations[0];

    expect(state.recipes[0].coffee).toBe('Legacy Coffee');
    expect(state.recipes[0].recipeType).toBe('blend');
    expect(migrated.yieldGrams).toBe(42);
    expect(migrated.grindSize).toBe('');
    expect(migrated.shotTime).toBeNull();
    expect(migrated.lastAssignedAt).toBeNull();
    expect(state.programs['Long Up']).toBe(1);
  });

  it('falls back safely when stored JSON is corrupt', () => {
    storage.setItem(STORAGE_KEY, '{broken');
    expect(loadState(storage)).toEqual(createInitialState());
  });
});

describe('recipe iterations', () => {
  it('adds same-name shots to one recipe regardless of case', () => {
    const state = createInitialState();
    addRecipeIteration(state, 'Showcase Blend', iteration('shot-1'), 'blend');
    addRecipeIteration(state, 'showcase blend', iteration('shot-2'), 'single');

    expect(state.recipes).toHaveLength(1);
    expect(state.recipes[0].coffee).toBe('Showcase Blend');
    expect(state.recipes[0].recipeType).toBe('single');
    expect(state.recipes[0].iterations).toHaveLength(2);
    expect(findIteration(state, 'shot-2')?.recipe.id).toBe(state.recipes[0].id);
  });

  it('creates a separate recipe when the name changes', () => {
    const state = createInitialState();
    addRecipeIteration(state, 'Showcase Blend', iteration('shot-1'));
    addRecipeIteration(state, 'Single Origin', iteration('shot-2'));

    expect(state.recipes).toHaveLength(2);
  });

  it('moves current program assignments to a newly saved iteration', () => {
    const state = createInitialState();
    state.programs.Down = 'shot-1';
    state.programs['Long Up'] = 'another-shot';

    const updated = replaceAssignedIteration(state, 'shot-1', 'shot-2');

    expect(updated).toBe(1);
    expect(state.programs.Down).toBe('shot-2');
    expect(state.programs['Long Up']).toBe('another-shot');
  });

  it('infers a single recipe when migrating an 8.5% target', () => {
    const state = importState(
      JSON.stringify({
        recipes: [
          {
            id: 'single-shot',
            coffee: 'Seasonal Single',
            dose: 18,
            yieldGrams: 42,
            targetStrength: 8.5,
          },
        ],
        programs: {},
      }),
    );

    expect(state.recipes[0].recipeType).toBe('single');
  });
});

describe('backup files', () => {
  it('round-trips exported data', () => {
    const state = createInitialState();
    addRecipeIteration(
      state,
      'Colombia',
      iteration('1', {
        grindSize: '18 clicks',
        shotTime: 31,
        lastAssignedAt: '2026-07-16T01:00:00.000Z',
      }),
    );

    expect(importState(exportState(state))).toEqual(state);
  });

  it('normalises invalid backup shapes', () => {
    expect(importState('{"recipes":"nope"}')).toEqual(createInitialState());
  });

  it('does not infer assignment history from an older brew timestamp', () => {
    const state = importState(
      JSON.stringify({
        recipes: [
          {
            id: 'old',
            coffee: 'Older recipe',
            dose: 18,
            yieldGrams: 38,
            createdAt: '2026-06-01T00:00:00.000Z',
            lastBrewed: '2026-06-02T00:00:00.000Z',
          },
        ],
        programs: {},
      }),
    );

    const migrated = state.recipes[0].iterations[0];
    expect(migrated.lastAssignedAt).toBeNull();
    expect(migrated).not.toHaveProperty('lastBrewed');
  });
});
