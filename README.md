# Ingestro case study

A browser app for reviewing and fixing a CSV with 200,000 customer records.
Built with React, TypeScript and Vite. Data stays in the browser.

## Run

Use Node.js 20.19+.

```sh
npm ci
npm run dev
```

Open the local URL shown in the terminal.

## Test data

Use the generator from the [case study](https://getnuvo.notion.site/Senior-Frontend-Engineer-Take-Home-Case-Study-3fe3b22be9038184acfff2b9e35c0335).
Save its code as `generate-data.mjs` in a separate folder and run:

```sh
node generate-data.mjs 200000 42
```

Upload the resulting `import-data.csv`. The app reads this file; it does not run
the generator. The generated CSV and optional answer report are not included in
this repository. No answer report is needed to use the app.

## Use

1. Click **Upload CSV**. Basic formatting is applied on import.
2. Review issue counts. Use **Fix issues** to see problems by field.
3. Edit cells, or preview and confirm a bulk fix in the assistant.
4. Use **Undo last change** to reverse the last edit or removal.
5. Click **Save CSV** when all rows are valid.

Search, country/plan filters and date/spend sorting work across the whole file.
Filters are stored in the URL. Use `?id=C-0000001#/` to find a record.
Record IDs in history and examples link back to the table.

Change history lists formatting, edits, removals and undo actions. Clearing the
dataset or reloading the page loses all changes. To load another file, click
**Clear**, then **Upload CSV**.

## Checks

```sh
npm test
npm run build
npm run lint
npm run format:check
```

Tests cover CSV parsing, validation, bulk fixes, undo, filters and sorting.
They include synthetic datasets with 200,000 rows. These are automated checks,
not a browser performance benchmark.

## Design and submission

See [DESIGN.md](DESIGN.md) for architecture, assumptions, trade-offs and AI use.
[AGENTS.md](AGENTS.md) contains coding instructions for the project.

The case study also asks for a screen recording of up to five minutes.
A video link still needs to be added to the submission.
