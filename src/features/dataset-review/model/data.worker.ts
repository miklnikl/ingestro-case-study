import { UndoTransaction } from './undo';
import { queryDataset, datasetFilterOptions } from './datasetQuery';
import { suggestEditPropagation, type EditPropagationSuggestion } from './editPropagation';
import { correctNegativeSpend } from './negativeSpend';
import { correctInvalidDates } from './dateCorrection';
import { generateTemporaryEmails } from './temporaryEmails';
import { listIssueValues, replaceIssueValue } from './issueValues';
import { deduplicateEmails, emailDuplicateSummary } from './emailDeduplication';
import { collectIssueGroups, replaceIssueValues, removeIssueRows } from './issueResolution';
/// <reference lib="webworker" />
import { exportCsv, parseCsv } from '../lib/csv';
import { type Row } from './types';
import { normalize } from './normalize';
import { validateRows } from './validateRows';
import type { Request, Response } from './protocol';
import { ChangeLog } from './changeLog';
let rows: Row[] = [];
let changes = new ChangeLog();
let lastUndo: UndoTransaction | null = null;
let editSuggestion: EditPropagationSuggestion | null = null;
// Serial processing prevents a query overtaking an asynchronous file read.
let queue = Promise.resolve();
self.onmessage = (event: MessageEvent<Request>) => {
  const request = event.data;
  queue = queue.then(async () => {
    try {
      const transaction = new UndoTransaction();
      if (!['query', 'export', 'issueValues', 'history', 'historyIds'].includes(request.type)) {
        editSuggestion = null;
      }
      if (request.type === 'issueValues') {
        self.postMessage({
          id: request.id,
          type: 'issueValues',
          values: listIssueValues(rows, request.field, request.search, request.limit),
        } satisfies Response);
        return;
      }
      if (request.type === 'replaceIssueValue') {
        replaceIssueValue(
          rows,
          request.field,
          request.source,
          request.value,
          request.expectedCount,
          (row, next) => (transaction.captureEdit(row, next), changes.recordBulkEdit(row, next)),
        );
        validateRows(rows);
      }
      if (request.type === 'history') {
        self.postMessage({
          id: request.id,
          type: 'history',
          history: changes.page(request.page),
        } satisfies Response);
        return;
      }
      if (request.type === 'historyIds') {
        self.postMessage({
          id: request.id,
          type: 'historyIds',
          historyIds: changes.ids(request.groupKey, request.page),
        } satisfies Response);
        return;
      }
      if (request.type === 'import') {
        const nextLog = new ChangeLog();
        const nextRows = parseCsv(await request.file.text(), (original, row) =>
          nextLog.recordImport(original, row),
        );
        rows = nextRows;
        changes = nextLog;
        lastUndo = null;
      }
      if (request.type === 'edit') {
        const row = rows.find((r) => r.key === request.key);
        const source = row?.values[request.field];
        const wasInvalid = !!row?.errors[request.field];
        if (row) {
          const next = normalize({ ...row.values, [request.field]: request.value });
          transaction.captureEdit(row, next);
          changes.recordEdit(row, next);
          row.values = next;
        }
        validateRows(rows);
        if (row && source !== undefined) {
          const suggestion = suggestEditPropagation(
            rows,
            request.field,
            source,
            row.values[request.field],
            wasInvalid,
          );
          editSuggestion = suggestion ? { ...suggestion, id: request.id, rowKey: row.key } : null;
        }
      }
      if (request.type === 'delete') {
        const row = rows.find((row) => row.key === request.key);
        if (row) {
          transaction.captureDelete(row);
          changes.recordDelete(row);
        }
        rows = rows.filter((r) => r.key !== request.key);
        validateRows(rows);
      }
      if (request.type === 'bulkReplace') {
        replaceIssueValues(
          rows,
          request.field,
          request.scope,
          request.value,
          request.expectedCount,
          (row, next) => (transaction.captureEdit(row, next), changes.recordBulkEdit(row, next)),
        );
        validateRows(rows);
      }
      if (request.type === 'bulkDelete') {
        rows = removeIssueRows(
          rows,
          request.field,
          request.expectedCount,
          (row) => (transaction.captureDelete(row), changes.recordDelete(row)),
        );
        validateRows(rows);
      }
      if (request.type === 'deduplicateEmails') {
        rows = deduplicateEmails(
          rows,
          request.keep,
          request.expectedCount,
          (row) => (transaction.captureDelete(row), changes.recordDelete(row)),
        );
        validateRows(rows);
      }
      if (request.type === 'generateTemporaryEmails') {
        generateTemporaryEmails(
          rows,
          request.expectedCount,
          (row, next) => (transaction.captureEdit(row, next), changes.recordBulkEdit(row, next)),
          request.scope,
        );
        validateRows(rows);
      }
      if (request.type === 'correctInvalidDates') {
        correctInvalidDates(
          rows,
          request.direction,
          request.expectedCount,
          (row, next) => (transaction.captureEdit(row, next), changes.recordBulkEdit(row, next)),
        );
        validateRows(rows);
      }
      if (request.type === 'correctNegativeSpend') {
        correctNegativeSpend(
          rows,
          request.mode,
          request.expectedCount,
          (row, next) => (transaction.captureEdit(row, next), changes.recordBulkEdit(row, next)),
        );
        validateRows(rows);
      }
      if (request.type === 'undo') {
        if (!lastUndo) {
          throw new Error('There is no change to undo.');
        }
        rows = lastUndo.restore(
          rows,
          (row, next) => changes.recordUndoEdit(row, next),
          (row) => changes.recordRestore(row),
        );
        lastUndo = null;
        validateRows(rows);
      }
      if (request.type === 'export') {
        self.postMessage({
          id: request.id,
          type: 'export',
          blob: new Blob([exportCsv(rows)], { type: 'text/csv;charset=utf-8' }),
        } satisfies Response);
        return;
      }
      if (transaction.changed) {
        lastUndo = transaction;
      }
      const counts: Record<string, number> = {};
      let invalid = 0,
        corrected = 0;
      const matching = queryDataset(rows, request.query, (key, id) =>
        changes.matchesOriginalId(key, id),
      );
      for (const row of rows) {
        const errors = Object.keys(row.errors);
        if (errors.length) {
          invalid++;
        }
        if (row.corrected) {
          corrected++;
        }
        for (const field of errors) {
          counts[field] = (counts[field] ?? 0) + 1;
        }
      }
      self.postMessage({
        id: request.id,
        type: 'result',
        rows: matching.slice(0, request.query.limit),
        total: rows.length,
        invalid,
        corrected,
        matching: matching.length,
        counts,
        issueGroups: collectIssueGroups(rows),
        emailDuplicates: emailDuplicateSummary(rows),
        editSuggestion,
        canUndo: !!lastUndo,
        filterOptions: datasetFilterOptions(rows),
      } satisfies Response);
    } catch (error) {
      if (request.type === 'issueValues') {
        self.postMessage({
          id: request.id,
          type: 'issueValuesError',
          message: error instanceof Error ? error.message : 'Unable to load invalid values.',
        } satisfies Response);
        return;
      }
      if (request.type === 'history' || request.type === 'historyIds') {
        self.postMessage({
          id: request.id,
          type: 'historyError',
          channel: request.type,
          message: error instanceof Error ? error.message : 'Unable to load change history.',
        } satisfies Response);
        return;
      }
      self.postMessage({
        id: request.id,
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to process this file.',
      } satisfies Response);
    }
  });
};
