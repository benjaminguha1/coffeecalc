# CoffeeCalc

CoffeeCalc is a browser-based espresso dial-in notebook. Enter the dose, beverage yield, and measured strength from a refractometer; the app calculates extraction and suggests the next dose and yield for your target recipe.

Recipes and machine-program assignments are stored in the deployed site's D1 database and cached in local storage for offline fallback. Existing browser-only data is uploaded automatically the first time the online database is empty. Users can still export or import a JSON backup.

## Features

- Guided espresso dial-in workflow
- Extraction yield and dissolved-solids calculations
- Recommended dose and yield based on configurable targets
- Single and blend target presets, with editable targets in both calculators
- Machine-program assignment board
- 6 × 4 inch landscape labels for the Long Up and Long Down recipes
- Grind-size, shot-time, and last-assigned tracking
- Durable online recipe log with a local offline cache
- JSON backup and restore
- Quick calculator for unsaved shots
- Responsive and keyboard-accessible interface
- Installable web-app manifest
- Automated formatting, linting, tests, and production builds

## Start developing

Requirements: Node.js 22 or later and npm.

```sh
npm install
npm run dev
```

Vite prints the local development URL. Changes in `src/` update immediately.

## Quality checks

```sh
npm run check         # lint, tests, and production build
npm run format:check  # verify formatting
npm run format        # apply formatting
```

## Calculation model

CoffeeCalc uses these relationships:

```text
dissolved solids (g) = beverage yield × (strength / 100)
extraction yield (%) = dissolved solids / dose × 100
recommended dose (g) = target dissolved solids / extraction yield
recommended yield (g) = target dissolved solids / target strength
```

Recommended dose is rounded to 0.1 g and recommended yield to the nearest 0.5 g. The default targets are 9.30% strength and 4.41 g dissolved solids. These are operational targets, not universal definitions of a good espresso; adjust them for the coffee and service recipe.

## Project structure

```text
src/calculator.js       Pure espresso calculations
src/storage.js          Local persistence, migration, and backups
src/main.js             Interface and app state
src/styles.css          Responsive visual system
public/                 Web-app manifest and icon
.github/workflows/      Continuous integration checks
.openai/hosting.json    Sites project and D1 binding
```

## Deploying

CoffeeCalc requires a server-capable runtime for its authentication, state API, and D1 database. Deploy it through Sites using `.openai/hosting.json`; a static host such as GitHub Pages cannot execute the required routes. Pull requests run the CI workflow without deploying.

## Data and privacy

CoffeeCalc requires an authenticated staff account. Recipe data is stored in the deployed site's D1 database and cached in the current browser profile for offline use. Clearing site data removes only that browser's cache; JSON backups remain useful for portability and recovery.

The original prototype used `coffeeRecipes` and `coffeePrograms` local-storage keys. This version reads those keys automatically so existing browser data continues to work. Older recipes remain valid; grind size and shot time appear as not recorded until a new dial-in supplies them.

“Last assigned” records when a recipe was most recently assigned to a machine program. It is intentionally not described as a brew timestamp because CoffeeCalc does not receive usage data from the espresso machine.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). This repository does not currently declare an open-source license; obtain the owner’s permission before redistributing the code.
