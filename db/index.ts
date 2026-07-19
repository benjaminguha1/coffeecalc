import { env } from 'cloudflare:workers';

let coffeeSchemaReady: Promise<void> | null = null;

export function getDatabase() {
  if (!env.DB) {
    throw new Error('CoffeeCalc online storage is unavailable.');
  }

  return env.DB;
}

export async function ensureCoffeeStateSchema() {
  if (!coffeeSchemaReady) {
    coffeeSchemaReady = getDatabase()
      .prepare(
        `CREATE TABLE IF NOT EXISTS coffee_states (
        id TEXT PRIMARY KEY NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`,
      )
      .run()
      .then(() => undefined)
      .catch((error) => {
        coffeeSchemaReady = null;
        throw error;
      });
  }
  await coffeeSchemaReady;
}
