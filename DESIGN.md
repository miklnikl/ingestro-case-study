# Design notes

## Structure and tools

This is a frontend-only React and TypeScript app. There is no API or backend.

- `src/app`: entry point, routes and styles.
- `src/pages`: dataset review and change history pages.
- `src/features/dataset-review`: worker, data rules and review UI.
- `src/shared`: small components and download helper.

Ant Design provides the table, forms and drawer. Its virtual table keeps the
number of rendered rows small. Papa Parse handles CSV quoting and line breaks.
Zod checks field values. Separate checks find duplicate IDs and emails across
all records. Vite provides the development server and build.

## Decision: keep the data in a Web Worker

The worker loads the CSV, formats values, validates records, applies edits,
filters, sorts and creates the saved CSV. React handles user interaction and
receives matching rows in batches of 500.

Keeping everything in React would be simpler, but parsing and validation could
block typing and scrolling. A backend could handle larger files and saved work,
but adds setup and is outside this prototype's scope. The worker keeps these
operations off the main thread while keeping the app local.

## User flow

Issue counts help users choose what to fix first. **Fix issues** opens a drawer
with groups by field, explanations, examples and correction options. Users can
also search, filter the table and edit a cell directly. Each edit revalidates the
whole dataset, including duplicate checks.

Bulk actions show counts and examples before confirmation. For example, users
can replace every invalid plan `frees` with `free`. Actions apply across the
whole file, including filtered-out rows. Deleting an issue group removes whole
records and requires confirmation.

The latest data action can be undone, including a bulk fix or deletion. History
records before/after values and undo actions. Saving stays disabled until the
entire remaining dataset is valid. The worker checks again before saving.

## Performance

The worker holds the full dataset in memory. The table uses infinite loading
and virtualization. History, examples and dropdown results are also limited or
paginated. Search waits briefly while the user types. Filters and sorting run
before rows are sent to the table.

Undo stores changed values and removed rows instead of copying the full dataset.
Edits still revalidate all rows, and visited table rows stay in React memory.
Virtualization limits rendered elements, not total memory use.

## Assumptions

- All eight specified columns are required. Broken CSV structure rejects the file;
  invalid cell values stay visible and block saving.
- Import formatting trims whitespace, maps known country names to ISO codes,
  lowercases plans and converts supported dates and amounts.
- Slash dates mean DD/MM/YYYY: `03/04/2024` becomes `2024-04-03`.
- Impossible dates and unknown formats remain errors. Nearest-date fixes are
  explicit user actions, not automatic import guesses.
- Email duplicates use exact, case-sensitive comparison. When keeping one by
  signup date, valid dates win; ties keep the first original row.
- Generated `example.invalid` emails are unique placeholders, not real inboxes.
- Filters live in the URL. Data, history and undo do not survive a reload.
- Import formatting is the starting state; undo applies to later user changes.

## Trade-offs and next steps

Loading has a busy state but no progress percentage. The app has no fixed file
size limit or recovery from running out of memory. Only one action can be undone;
there is no redo. No separate import summary screen is included. A future summary
could list automatic changes and remaining issues before review begins.

With more time, measure real browser responsiveness and memory use with the
supplied CSV, test keyboard navigation, and reduce repeated full-list validation.
A backend would be useful for files beyond browser memory, persistent work and
shared access.

## AI use and verification

AI helped write the code, tests and documentation. The developer directed changes
to validation behavior, bulk actions, undo, filtering and the upload/save flow.

Verification includes 91 passing automated tests, a production build, lint and
format checks. Tests include 200,000-row synthetic datasets. Browser performance
and a full manual browser review have not been verified by these checks.
