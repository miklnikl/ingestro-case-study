import { readDatasetQuery, datasetQuerySearch } from './datasetQuery';
import type { EditPropagationSuggestion } from './editPropagation';
import type { NegativeSpendMode } from './negativeSpend';
import type { DateDirection } from './dateCorrection';
import type { TemporaryEmailScope } from './temporaryEmails';
import type { IssueValuePage } from './issueValues';
import type { EmailKeepOrder } from './emailDeduplication';
import type { IssueScope } from './issueResolution';
import type { HistoryPage, HistoryIds } from './changeLog';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Table } from 'antd';
import type { Field } from './types';
import type { Query, Request, Response, Result } from './protocol';
import { downloadBlob } from '../../../shared/lib/downloadBlob';

export function useDatasetReview() {
  const worker = useRef<Worker | null>(null);
  const sequence = useRef(0);
  const [editSuggestion, setEditSuggestion] = useState<EditPropagationSuggestion | null>(null);
  const dismissedSuggestion = useRef<number | null>(null);
  const valuesSequence = useRef(0);
  const [issueValues, setIssueValues] = useState<IssueValuePage | null>(null);
  const [issueValuesBusy, setIssueValuesBusy] = useState(false);
  const [issueValuesError, setIssueValuesError] = useState('');
  const resetIssueValues = useCallback(() => {
    valuesSequence.current++;
    setIssueValues(null);
    setIssueValuesBusy(false);
    setIssueValuesError('');
  }, []);
  const historySequence = useRef(0);
  const idsSequence = useRef(0);
  const [history, setHistory] = useState<HistoryPage | null>(null);
  const [historyIds, setHistoryIds] = useState<HistoryIds | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [idsBusy, setIdsBusy] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [query, setQuery] = useState(() => readDatasetQuery(window.location.search));
  const hasDataset = useRef(false);
  const queryRef = useRef(query);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [search, setSearch] = useState(query.search);
  const [notice, setNotice] = useState(false);
  const tableRef = useRef<React.ComponentRef<typeof Table>>(null);
  const startWorker = useCallback(() => {
    const instance = new Worker(new URL('./data.worker.ts', import.meta.url), { type: 'module' });
    instance.onmessage = (event: MessageEvent<Response>) => {
      const message = event.data;
      if (message.type === 'issueValues' || message.type === 'issueValuesError') {
        if (message.id === valuesSequence.current) {
          setIssueValuesBusy(false);
          if (message.type === 'issueValues') {
            setIssueValues(message.values);
            setIssueValuesError('');
          } else {
            setIssueValuesError(message.message);
          }
        }
        return;
      }
      if (message.type === 'history') {
        if (message.id === historySequence.current) {
          setHistory(message.history);
          setHistoryBusy(false);
          setHistoryError('');
        }
        return;
      }
      if (message.type === 'historyIds') {
        if (message.id === idsSequence.current) {
          setHistoryIds(message.historyIds);
          setIdsBusy(false);
          setHistoryError('');
        }
        return;
      }
      if (message.type === 'historyError') {
        if (
          (message.channel === 'history' && message.id === historySequence.current) ||
          (message.channel === 'historyIds' && message.id === idsSequence.current)
        ) {
          setHistoryError(message.message);
          if (message.channel === 'history') {
            setHistoryBusy(false);
          } else {
            setIdsBusy(false);
          }
        }
        return;
      }
      if (message.id !== sequence.current) {
        return;
      }
      busyRef.current = false;
      setBusy(false);
      if (message.type === 'error') {
        setError(message.message);
        return;
      }
      setError('');
      if (message.type === 'result') {
        setEditSuggestion(
          message.editSuggestion?.id === dismissedSuggestion.current
            ? null
            : message.editSuggestion,
        );
        resetIssueValues();
        hasDataset.current = true;
        setResult(message);
      }
      if (message.type === 'export') {
        downloadBlob(message.blob, 'import-data-reviewed.csv');
      }
    };
    instance.onerror = () => {
      busyRef.current = false;
      setBusy(false);
      setHistoryBusy(false);
      setIdsBusy(false);
      setIssueValuesBusy(false);
      setIssueValuesError('The data worker stopped. Clear the dataset and upload the file again.');
      setHistoryError('The data worker stopped. Clear the dataset and upload the file again.');
      setError('The data worker stopped. Clear the dataset and upload the file again.');
    };
    worker.current = instance;
  }, [resetIssueValues]);
  useEffect(() => {
    startWorker();
    return () => worker.current?.terminate();
  }, [startWorker]);
  const send = useCallback(
    (
      action:
        | Omit<Extract<Request, { type: 'edit' }>, 'id' | 'query'>
        | Omit<Extract<Request, { type: 'delete' }>, 'id' | 'query'>
        | Omit<Extract<Request, { type: 'bulkReplace' }>, 'id' | 'query'>
        | Omit<Extract<Request, { type: 'bulkDelete' }>, 'id' | 'query'>
        | Omit<Extract<Request, { type: 'correctInvalidDates' }>, 'id' | 'query'>
        | Omit<Extract<Request, { type: 'correctNegativeSpend' }>, 'id' | 'query'>
        | Omit<Extract<Request, { type: 'replaceIssueValue' }>, 'id' | 'query'>
        | Omit<Extract<Request, { type: 'deduplicateEmails' }>, 'id' | 'query'>
        | Omit<Extract<Request, { type: 'generateTemporaryEmails' }>, 'id' | 'query'>
        | { type: 'query' | 'export' | 'undo' }
        | { type: 'import'; file: File },
      next = queryRef.current,
    ) => {
      busyRef.current = true;
      setBusy(true);
      if (action.type !== 'query' && action.type !== 'export') {
        setEditSuggestion(null);
      }
      worker.current?.postMessage({ ...action, id: ++sequence.current, query: next });
    },
    [],
  );
  const changeQuery = useCallback(
    (next: Query) => {
      queryRef.current = next;
      setQuery(next);
      const urlSearch = datasetQuerySearch(next, window.location.search);
      if (urlSearch !== window.location.search) {
        window.history.pushState(
          null,
          '',
          `${window.location.pathname}${urlSearch}${window.location.hash}`,
        );
      }
      send({ type: 'query' }, next);
    },
    [send],
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== queryRef.current.search && result) {
        tableRef.current?.scrollTo({ top: 0 });
        changeQuery({ ...queryRef.current, search, limit: 500 });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, result, changeQuery]);
  useEffect(() => {
    const onLocationChange = () => {
      const next = readDatasetQuery(window.location.search);
      if (datasetQuerySearch(next) !== datasetQuerySearch(queryRef.current)) {
        queryRef.current = next;
        setQuery(next);
        setSearch(next.search);
        tableRef.current?.scrollTo({ top: 0 });
        if (hasDataset.current) {
          send({ type: 'query' }, next);
        }
      }
    };
    window.addEventListener('popstate', onLocationChange);
    window.addEventListener('hashchange', onLocationChange);
    return () => {
      window.removeEventListener('popstate', onLocationChange);
      window.removeEventListener('hashchange', onLocationChange);
    };
  }, [send]);
  const loadHistory = useCallback((page = 1) => {
    setHistoryBusy(true);
    worker.current?.postMessage({
      type: 'history',
      id: ++historySequence.current,
      query: queryRef.current,
      page,
    });
  }, []);
  const loadHistoryIds = useCallback((groupKey: string, page = 1) => {
    setIdsBusy(true);
    setHistoryIds(null);
    worker.current?.postMessage({
      type: 'historyIds',
      id: ++idsSequence.current,
      query: queryRef.current,
      groupKey,
      page,
    });
  }, []);
  const loadIssueValues = useCallback((field: Field, search = '', limit = 50) => {
    setIssueValuesBusy(true);
    setIssueValuesError('');
    worker.current?.postMessage({
      type: 'issueValues',
      id: ++valuesSequence.current,
      query: queryRef.current,
      field,
      search,
      limit,
    });
  }, []);
  const resetHistory = () => {
    setEditSuggestion(null);
    dismissedSuggestion.current = null;
    resetIssueValues();
    historySequence.current++;
    idsSequence.current++;
    setHistory(null);
    setHistoryIds(null);
    setHistoryBusy(false);
    setIdsBusy(false);
    setHistoryError('');
  };
  const clear = () => {
    resetHistory();
    worker.current?.terminate();
    sequence.current++;
    startWorker();
    busyRef.current = false;
    setBusy(false);
    setResult(null);
    setFileName('');
    setError('');
    hasDataset.current = false;
    const next = readDatasetQuery(window.location.search);
    setSearch(next.search);
    setNotice(false);
    queryRef.current = next;
    setQuery(next);
  };
  const upload = (file: File): false => {
    resetHistory();
    setFileName(file.name);
    setNotice(true);
    setResult(null);
    hasDataset.current = false;
    const next = readDatasetQuery(window.location.search);
    setSearch(next.search);
    queryRef.current = next;
    setQuery(next);
    send({ type: 'import', file }, next);
    return false;
  };
  const edit = (key: number, field: Field, value: string) =>
    send({ type: 'edit', key, field, value });
  const remove = (key: number) => send({ type: 'delete', key });
  const bulkReplace = (field: Field, scope: IssueScope, value: string, expectedCount: number) =>
    send({ type: 'bulkReplace', field, scope, value, expectedCount });
  const bulkDelete = (field: Field, expectedCount: number) =>
    send({ type: 'bulkDelete', field, expectedCount });
  const deduplicateEmails = (keep: EmailKeepOrder, expectedCount: number) =>
    send({ type: 'deduplicateEmails', keep, expectedCount });
  const replaceIssueValue = (field: Field, source: string, value: string, expectedCount: number) =>
    send({ type: 'replaceIssueValue', field, source, value, expectedCount });
  const generateTemporaryEmails = (expectedCount: number, scope: TemporaryEmailScope = 'empty') =>
    send({ type: 'generateTemporaryEmails', expectedCount, scope });
  const correctInvalidDates = (direction: DateDirection, expectedCount: number) =>
    send({ type: 'correctInvalidDates', direction, expectedCount });
  const correctNegativeSpend = (mode: NegativeSpendMode, expectedCount: number) =>
    send({ type: 'correctNegativeSpend', mode, expectedCount });
  const dismissEditSuggestion = () => {
    dismissedSuggestion.current = editSuggestion?.id ?? null;
    setEditSuggestion(null);
  };
  const applyEditSuggestion = () => {
    if (editSuggestion) {
      replaceIssueValue(
        editSuggestion.field,
        editSuggestion.source,
        editSuggestion.value,
        editSuggestion.count,
      );
    }
  };
  const undo = () => send({ type: 'undo' });
  const updateFilters = (
    patch: Partial<Pick<Query, 'country' | 'plan' | 'id' | 'sort' | 'order'>>,
  ) => {
    tableRef.current?.scrollTo({ top: 0 });
    changeQuery({ ...queryRef.current, ...patch, limit: 500 });
  };
  const exportFile = () => send({ type: 'export' });
  const filterIssues = (onlyErrors: boolean) => {
    tableRef.current?.scrollTo({ top: 0 });
    changeQuery({ ...queryRef.current, onlyErrors, limit: 500 });
  };
  const loadMore = () => {
    if (!busyRef.current && result && result.rows.length < result.matching) {
      changeQuery({ ...queryRef.current, limit: queryRef.current.limit + 500 });
    }
  };
  return {
    undo,
    updateFilters,
    editSuggestion,
    dismissEditSuggestion,
    applyEditSuggestion,
    issueValues,
    issueValuesBusy,
    issueValuesError,
    loadIssueValues,
    replaceIssueValue,
    history,
    historyIds,
    historyBusy,
    idsBusy,
    historyError,
    loadHistory,
    loadHistoryIds,
    query,
    result,
    busy,
    error,
    fileName,
    search,
    notice,
    tableRef,
    setError,
    setSearch,
    setNotice,
    clear,
    upload,
    edit,
    remove,
    exportFile,
    filterIssues,
    loadMore,
    bulkReplace,
    bulkDelete,
    correctInvalidDates,
    correctNegativeSpend,
    deduplicateEmails,
    generateTemporaryEmails,
  };
}
export type DatasetReviewController = ReturnType<typeof useDatasetReview>;
