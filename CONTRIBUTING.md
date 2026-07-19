# Contributing

Thanks for helping improve CoffeeCalc.

## Local setup

1. Install Node.js 22 or later.
2. Run `npm install`.
3. Run `npm run dev` and open the local URL Vite prints.

Create a branch for each change and keep pull requests focused. Before opening a pull request, run:

```sh
npm run check
npm run format:check
```

## Project conventions

- Keep calculation logic in `src/calculator.js` and cover changes with tests.
- Keep persistence and data migration logic in `src/storage.js`.
- Never render user-entered values with `innerHTML`.
- Preserve keyboard operation, visible focus states, and reduced-motion support.
- Do not add analytics or transmit recipe data without an explicit product decision and privacy review.

## Reporting bugs

Include the browser and device, steps to reproduce the issue, what you expected, and what happened. Do not include private coffee or business data in a public issue.
