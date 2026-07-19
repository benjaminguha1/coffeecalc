import { ensureCoffeeStateSchema, getDatabase } from '../../../db';
import { getUserForRequest, isSameOrigin } from '../../auth';

const STATE_ID = 'cafe';
const MAX_STATE_BYTES = 256_000;

type CoffeeState = {
  recipes: unknown[];
  programs: Record<string, unknown>;
};

function isCoffeeState(value: unknown): value is CoffeeState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<CoffeeState>;
  return (
    Array.isArray(state.recipes) &&
    Boolean(state.programs) &&
    typeof state.programs === 'object'
  );
}

export async function GET(request: Request) {
  try {
    if (!(await getUserForRequest(request))) {
      return Response.json({ error: 'Unauthorised' }, { status: 401 });
    }
    await ensureCoffeeStateSchema();
    const row = await getDatabase()
      .prepare('SELECT payload, updated_at FROM coffee_states WHERE id = ?')
      .bind(STATE_ID)
      .first<{ payload: string; updated_at: string }>();

    if (!row) return Response.json({ state: null, updatedAt: null });

    return Response.json({
      state: JSON.parse(row.payload),
      updatedAt: row.updated_at,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Online storage failed.';
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!(await getUserForRequest(request))) {
      return Response.json({ error: 'Unauthorised' }, { status: 401 });
    }
    await ensureCoffeeStateSchema();
    const body = (await request.json()) as { state?: unknown };
    if (!isCoffeeState(body.state)) {
      return Response.json(
        { error: 'A valid CoffeeCalc state is required.' },
        { status: 400 },
      );
    }

    const payload = JSON.stringify(body.state);
    if (new TextEncoder().encode(payload).byteLength > MAX_STATE_BYTES) {
      return Response.json(
        { error: 'CoffeeCalc data is too large to save.' },
        { status: 413 },
      );
    }

    await getDatabase()
      .prepare(
        `INSERT INTO coffee_states (id, payload, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET
           payload = excluded.payload,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(STATE_ID, payload)
      .run();

    return Response.json({ saved: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Online storage failed.';
    return Response.json({ error: message }, { status: 500 });
  }
}
