import type { EditPropagationSuggestion } from './editPropagation';
import type { NegativeSpendMode } from './negativeSpend';
import type { DateDirection } from './dateCorrection';
import type { TemporaryEmailScope } from './temporaryEmails';
import type { IssueValuePage } from './issueValues';
import type { EmailKeepOrder, EmailDuplicateSummary } from './emailDeduplication';
import type { IssueGroup, IssueScope } from './issueResolution';
import type { HistoryPage, HistoryIds } from './changeLog';
import type { Field, Row } from './types';
export type Query = {
  search: string;
  onlyErrors: boolean;
  limit: number;
  country?: string;
  plan?: string;
  id?: string;
  sort?: 'signup_date' | 'monthly_spend';
  order?: 'asc' | 'desc';
};
export type Request = { id: number; query: Query } & (
  | { type: 'import'; file: File }
  | { type: 'query' }
  | { type: 'edit'; key: number; field: Field; value: string }
  | { type: 'delete'; key: number }
  | { type: 'export' }
  | { type: 'undo' }
  | { type: 'bulkReplace'; field: Field; scope: IssueScope; value: string; expectedCount: number }
  | { type: 'bulkDelete'; field: Field; expectedCount: number }
  | { type: 'correctInvalidDates'; direction: DateDirection; expectedCount: number }
  | { type: 'correctNegativeSpend'; mode: NegativeSpendMode; expectedCount: number }
  | { type: 'issueValues'; field: Field; search: string; limit: number }
  | {
      type: 'replaceIssueValue';
      field: Field;
      source: string;
      value: string;
      expectedCount: number;
    }
  | { type: 'deduplicateEmails'; keep: EmailKeepOrder; expectedCount: number }
  | { type: 'generateTemporaryEmails'; expectedCount: number; scope?: TemporaryEmailScope }
  | { type: 'history'; page: number }
  | { type: 'historyIds'; groupKey: string; page: number }
);
export type Response =
  | {
      id: number;
      type: 'result';
      rows: Row[];
      total: number;
      invalid: number;
      corrected: number;
      matching: number;
      counts: Record<string, number>;
      issueGroups: IssueGroup[];
      emailDuplicates: EmailDuplicateSummary;
      editSuggestion: EditPropagationSuggestion | null;
      canUndo: boolean;
      filterOptions: { countries: string[]; plans: string[] };
    }
  | { id: number; type: 'issueValues'; values: IssueValuePage }
  | { id: number; type: 'issueValuesError'; message: string }
  | { id: number; type: 'history'; history: HistoryPage }
  | { id: number; type: 'historyIds'; historyIds: HistoryIds }
  | { id: number; type: 'historyError'; channel: 'history' | 'historyIds'; message: string }
  | { id: number; type: 'error'; message: string }
  | { id: number; type: 'export'; blob: Blob };

export type Result = Extract<Response, { type: 'result' }>;
