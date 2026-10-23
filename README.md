# Ingestro case study — iteration 1

A single-page, browser-local CSV review tool. Vite + React + TypeScript,
Ant Design, Zod and Papa Parse. Node 20.19+ is required.

```sh
npm ci
npm run dev
```

Open the localhost URL printed in the terminal. Upload the `import-data.csv`
produced by the original take-home generator. The generator is not run by this
application. No customer data leaves the browser.

```sh
npm test
npm run build
npm run preview
```

## Code style

```sh
npm run lint
npm run lint:fix
npm run format
npm run format:check
```

ESLint checks TypeScript, React Hook usage and dependencies, strict equality,
and explicit control-flow braces. Prettier handles formatting with two-space
indentation, single quotes and a 100-character print width.

In VS Code or Cursor, install the workspace-recommended ESLint and Prettier
extensions. Workspace settings format files and apply available ESLint fixes
on explicit save. Rules without an automatic fix appear as editor diagnostics.

## Workflow

Upload CSV, review issue counts, search all columns or show only rows with issues.
Click any cell to edit; Enter or blur saves, Escape cancels. Hover an error for
an explanation. Remove a row with confirmation. After loading, **Upload CSV**
becomes **Save CSV**, enabled only when all remaining rows are valid; the worker
revalidates before producing the file. Clear cancels processing, removes the
dataset from memory and restores **Upload CSV**. Changes are not persisted.

## Issue assistant

After an import with errors, use **Fix issues** in the export warning. The drawer starts closed. Groups show current counts
by field and distinguish empty values from other invalid values.

After selecting a specific invalid value, dates support a chosen date or today
(browser-local date); spend supports a
non-negative replacement or zero. Countries, plans and names accept a valid
replacement. Each action shows the affected count and sample original values,
requires confirmation and applies across the entire dataset regardless of filters.
Email groups also support keeping the earliest or latest record per exact,
nonempty email by signup date. Valid dates take priority; equal dates or groups
without valid dates keep the first original CSV record. The removal count is
confirmed before applying. Empty emails remain unchanged, and malformed nonempty
emails remain invalid even after duplicates are removed. Deletions are logged
and all remaining rows are revalidated. Whole-category replacement remains unavailable for customer IDs; their cells remain individually editable in the table and specific invalid values can be corrected as described below. Removal deletes entire records with that field's errors,
with explicit confirmation. All bulk fixes and removals enter change history.

Replacement values are normalized and Zod-validated again in the worker before
any mutation. Stale affected counts reject the action. All rows are revalidated
after each batch, including global duplicate checks. Valid values in that field
and other columns are not overwritten. Group deletion can also remove records
with issues in other fields; counts update accordingly. Removal can be reversed with Undo last change until the next data change.

Each field offers **Replace a specific invalid value** instead of category-wide
empty/invalid replacement blocks: search/select an
exact invalid value (including empty), enter its replacement and confirm the
matching record count. Only records currently reporting an error in that field
and having exactly the selected value are affected. For example, `frees → free`
does not modify `pros` or valid plans. Options and their counts are computed in
the worker and loaded in increments of 50, with at most three sample IDs each.
For email and customer ID, a one-record value group can be corrected if the new
value is unique; replacing multiple records with the same unique field is blocked.
Whole-category email/ID replacement remains unavailable. The email dropdown
contains only nonempty malformed addresses: synthetic All, empty values and
correctly formatted duplicates are excluded. Separate confirmed actions generate
unique temporary addresses (`temporary-<record number>@example.invalid`) for
empty emails only or for all invalid emails (including empty cells). Valid emails,
including duplicate addresses, are preserved. Collisions, including case variants,
receive a numeric suffix. These are placeholders, not inboxes. Each generated
value is logged, and all rows are revalidated afterwards.

The signup-date group also offers nearest **earlier** and **later** valid-date
conversion across the whole dataset, with counts and sample changes shown before
confirmation. For `2025-02-30`, earlier is `2025-02-28` and later is `2025-03-01`.
Leap years are respected. Only impossible days in otherwise recognizable
`YYYY-MM-DD` values with a valid month are corrected: overflowing days go to the
last day of that month or the first day of the next month; day 00 goes to the
last day of the preceding month or day 01 of that month. Empty values, other
formats, invalid months and results outside years 0000–9999 are skipped.
Existing valid dates are preserved. Every correction is logged and all rows
are revalidated after the batch.

The monthly-spend group offers **Convert negative to positive** and **Convert
negative to 0** across the dataset. Only finite negative numeric values with an
optional dot-decimal part are corrected. Positive conversion removes the minus
sign without rounding the decimal text. Empty, non-numeric, ambiguous and
non-negative amounts remain unchanged. Counts and bounded examples are shown
before confirmation; corrections are logged and followed by full revalidation.

All invalid-value dropdowns order their options by frequency, highest count first.
Sorting happens in the worker before pagination and applies to search results too.
Equal counts retain the order of first occurrence in the original dataset.

After a user successfully corrects an invalid cell in the table, an optional
popover beside the edited cell offers to apply the same normalized value to other invalid cells with
exactly the same previous value in that column. The worker counts matches across
the full dataset and returns at most three example IDs. Email and customer ID
are excluded. No prompt appears for edits of previously valid cells, unchanged
normalized values, still-invalid replacements or groups with no remaining matches.
The user can apply or dismiss the offer; nothing propagates automatically. The
popover uses the cell position captured at save time, so it can still appear if
issue-only filtering immediately removes the corrected row. Scrolling or resizing
dismisses the popover to avoid leaving it anchored to an outdated position.
Search/pagination preserve the pending offer without reviving a dismissed one;
new mutations or a replacement/clear reset it. Accepted batches use the same
validation, stale-count protection and change logging as exact-value replacements.

## Undo, filters and record links

**Undo last change** reverses one successful data action, including a cell edit,
accepted propagated correction, batch fix, temporary-email generation or deletion.
Only the latest action is retained as changed-value and removed-record deltas;
queries, exports, failed actions and no-op edits do not replace it. Undo restores
original row order, revalidates all rows and appends reversal/restoration entries
to the history. Undo itself has no redo. File replacement and clear reset undo.
Import normalization is the starting state and is not undoable.

Country/plan filters and date/spend sorting run in the worker before pagination.
Their values are stored in normal URL query parameters: `country`, `plan`, `sort`
(`signup_date` or `monthly_spend`), `order` (`asc` or `desc`), plus exact `id`.
Search uses `q`; issue-only filtering uses `issues=1`. An empty country/plan
parameter means filter for empty values. Missing filters mean all records.
Invalid date/non-numeric spend values sort last in both directions; equal values
retain original CSV order. Negative numeric spend sorts numerically.

Example: `?country=DE&plan=pro&sort=signup_date&order=desc#/`.
ID links use `?id=C-0000001#/`, clear other dataset filters and navigate without
reloading the current dataset. Browser Back/Forward restores URL filters. Links
from history use original IDs (including a CSV-record fallback); renamed records
can still be found by that original identity. Deleted records yield no matches
until restored with Undo. The active ID filter can be cleared in the toolbar.
A full reload/new tab still requires re-uploading a CSV; URL filters are restored,
but dataset contents are intentionally not persisted.

## Change history

The summary links to a separate `#/changes` page. Import normalization, manual
edits and row removals are logged in the worker. Identical changes affecting
multiple records appear first as `change — [IDs]`, followed by individual
`ID — change` entries in recording order. Exact before/after values are shown,
including whitespace via quoted strings. The source (import/manual edit) is part
of the grouping key. Unchanged edits do not create entries; repeated edits remain
in the history even when a value is reverted. Record identity uses the original
customer ID; missing IDs fall back to the CSV record number.

History and affected-ID lists are paginated in the worker; the UI does not mount
all changes or IDs at once. Switching pages keeps the dataset in memory.
History resets on clear or replacement, and is not persisted after a page reload.
CSV quoting and export-only formula escaping are serialization safeguards,
not dataset edits, and are not logged as edits.

## Input contract and assumptions

Exactly these eight columns are required, in any order:
`customer_id,first_name,last_name,email,signup_date,country,plan,monthly_spend`.
Quoted CSV, embedded newlines and a UTF-8 BOM are supported by Papa Parse.
Malformed CSV/headers/row lengths reject the import as a whole.
Value-level failures remain in the grid and block export.

Automatic import formatting:

- Trim surrounding whitespace in all fields.
- Map the country aliases present in the supplied generator to ISO codes.
  Other assigned uppercase ISO alpha-2 codes are accepted unchanged.
- Lowercase plans, but do not guess misspellings.
- Interpret slash dates as **DD/MM/YYYY** and convert `d Mon YYYY` to ISO.
  Invalid dates remain errors after formatting.
- Remove a leading euro symbol or trailing EUR; convert decimal comma with two
  decimal places, or comma thousands with dot decimals. Ambiguous formats remain errors.

Duplicate IDs and emails are checked across all rows; email comparison is exact
and case-sensitive, matching the case study's same-email rule. Missing values
are never fabricated. Export escapes formula-leading text for spreadsheet safety;
this may add a leading apostrophe to such values.

## Source structure

```text
src/
  app/                         App and global styles
  pages/dataset-review/        Screen composition
  features/dataset-review/
    model/                     Types, schema, normalization, validation, worker, hook
    lib/                       CSV import/export and boundary tests
    ui/                        Small workflow-specific components
    index.ts                   Public feature API
  shared/
    ui/                        EditableCell and SummaryStat
    lib/                       Browser download helper
  main.tsx                     React bootstrap and providers
```

The dataset review workflow is one feature. Pages compose its public API;
shared components have no dataset-specific imports or business rules.
Normalization and Zod validation remain separate steps with unchanged rules.

## Architecture decision: worker-owned dataset

The worker owns all records, runs parsing and Zod validation, computes duplicate
counts, filters queries and serializes exports. React receives up to 500 more
matching records per scroll request. Ant Design's virtual table mounts only a
small visible portion. Request IDs discard outdated replies; a serial worker
queue prevents queries overtaking imports. Clear terminates and replaces the worker.

Alternative: keep all rows in React and validate on the main thread. Simpler,
but parsing and whole-dataset checks would block interaction. A backend would
support files beyond available browser memory, persistent edits and shared access;
none is required for this iteration.

The CSV text and dataset are held in memory. Scrolling eventually transfers all
visited rows to the UI; virtualization limits DOM size, not total memory.
Edits and removals revalidate the full dataset in the worker. There is no fixed
file-size cap, server paging or out-of-memory recovery. Import shows an indeterminate
loading state. Debounced search and issue filtering run across all rows.

## Scope and remaining case-study work

This iteration includes upload, safe automatic normalization, issue counts,
search/filter, editing, removal, infinite scroll, virtualization and guarded export.
It does **not** yet implement the original case study's previewable bulk fix with
undo or navigation to a specific issue type. Automatic import formatting is
explained, but is not a substitute for that bulk-fix requirement. No video is included.

## AI note

AI assisted with the implementation, architecture, documentation and boundary tests.
See the completion message for checks actually run. No claim of manual human review
or browser performance verification is implied. The reference generator was not executed.

Agent guidance lives in [AGENTS.md](AGENTS.md), a repository-local Markdown
instruction file rather than a tool-specific configuration format.
