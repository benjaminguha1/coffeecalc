# CoffeeCalc

CoffeeCalc is a browser-based espresso and filter brewing notebook. Enter the dose, beverage yield, and measured strength from a refractometer; the app calculates extraction and suggests the next dose and yield for your target recipe. Incomplete notes can also be saved without calculating a recommendation.

Recipes and machine-program assignments are stored in the deployed site's D1 database and cached in local storage for offline fallback. Existing browser-only data is uploaded automatically the first time the online database is empty. Users can still export or import a JSON backup.

## Features

- Distinct espresso and filter recipes for each coffee
- Extraction yield and dissolved-solids calculations
- Recommended dose and yield based on configurable espresso targets and a fixed 355 g filter beverage target
- Bypass-water calculator for diluting a brew to a lower target TDS
- Structured single-origin and blend components with origin, name, process, and varietal
- Optional SKU and cellar tracking
- Optional roast month shown as a readable month and year in the recipe log
- Log search across labels, origin, component name, varietal, and SKU, plus cellar filtering and sorting
- Single-origin and blend espresso target presets, with editable targets in both calculators
- Machine-program assignment board
- 6 × 4 inch landscape labels for the Long Up and Long Down recipes
- Grind-size, brew-time, and last-assigned tracking
- Durable online recipe log with a local offline cache
- JSON backup and restore
- Quick calculator for unsaved brews
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
bypass water (g) = beverage mass × (current TDS / target TDS − 1)
```

Recommended dose is rounded to 0.1 g and recommended espresso yield to the nearest 0.5 g. Blend espresso starts at 9.30% strength and 4.41 g dissolved solids, while single-origin espresso starts at 8.50% strength. Filter recipes target a fixed 355 g of brewed beverage output, approximately 12 US fluid ounces; this is a mass/volume approximation and does not describe poured brewing water. Filter target dissolved solids are calculated from 355 g and the selected target TDS, so changing target TDS does not change the 355 g recommendation. Historical measured yields remain unchanged. These are operational starting points, not universal definitions of a good brew. The bypass calculator only supports dilution, so its target TDS cannot exceed the current TDS.

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

The original prototype used `coffeeRecipes` and `coffeePrograms` local-storage keys. This version reads those keys automatically so existing browser data continues to work. Older recipes remain valid and are treated as espresso recipes; grind size, brew time, and roast month appear as not recorded until a new dial-in supplies them. Within each brew method, the last saved iteration is the current preferred recipe and earlier iterations remain available under Previous recipes.

“Last assigned” records when a recipe was most recently assigned to a machine program. It is intentionally not described as a brew timestamp because CoffeeCalc does not receive usage data from the espresso machine.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). This repository does not currently declare an open-source license; obtain the owner’s permission before redistributing the code.
