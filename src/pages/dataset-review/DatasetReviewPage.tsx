import { useEffect, useState } from 'react';
import { Alert } from 'antd';
import {
  type DatasetReviewController,
  DatasetHeader,
  DatasetSummary,
  DatasetIssues,
  DatasetToolbar,
  DatasetTable,
  DatasetEmptyState,
  ImportNotice,
  IssueAssistant,
} from '../../features/dataset-review';
export function DatasetReviewPage({ review }: { review: DatasetReviewController }) {
  const { result, busy } = review;
  const [assistantOpen, setAssistantOpen] = useState(false);
  useEffect(() => {
    const close = () => setAssistantOpen(false);
    window.addEventListener('popstate', close);
    return () => window.removeEventListener('popstate', close);
  }, []);
  const upload = (file: File) => {
    setAssistantOpen(false);
    return review.upload(file);
  };
  const clear = () => {
    setAssistantOpen(false);
    review.clear();
  };
  return (
    <div className="app">
      <DatasetHeader
        busy={busy}
        hasDataset={!!result}
        canClear={!!review.fileName}
        canExport={!busy && !!result?.total && result.invalid === 0}
        canUndo={!!result?.canUndo}
        undo={review.undo}
        upload={upload}
        clear={clear}
        exportFile={review.exportFile}
      />
      <main>
        {review.error && (
          <Alert
            type="error"
            showIcon
            message={review.error}
            closable
            onClose={() => review.setError('')}
          />
        )}
        {review.notice && <ImportNotice onClose={() => review.setNotice(false)} />}
        {result ? (
          <>
            <DatasetSummary
              total={result.total}
              invalid={result.invalid}
              corrected={result.corrected}
            />
            {result.invalid > 0 && (
              <DatasetIssues
                counts={result.counts}
                busy={busy}
                onFix={() => setAssistantOpen(true)}
              />
            )}
            <DatasetToolbar
              search={review.search}
              setSearch={review.setSearch}
              onlyErrors={review.query.onlyErrors}
              busy={busy}
              filterIssues={review.filterIssues}
              fileName={review.fileName}
              query={review.query}
              filterOptions={result.filterOptions}
              onFilterChange={review.updateFilters}
            />
            <DatasetTable
              tableRef={review.tableRef}
              result={result}
              busy={busy}
              edit={review.edit}
              remove={review.remove}
              loadMore={review.loadMore}
              editSuggestion={review.editSuggestion}
              applyEditSuggestion={review.applyEditSuggestion}
              dismissEditSuggestion={review.dismissEditSuggestion}
            />
          </>
        ) : (
          <DatasetEmptyState busy={busy} upload={upload} />
        )}
      </main>
      {result && (
        <IssueAssistant
          key={review.fileName}
          open={assistantOpen}
          onClose={() => setAssistantOpen(false)}
          result={result}
          busy={busy}
          error={review.error}
          bulkDelete={review.bulkDelete}
          correctInvalidDates={review.correctInvalidDates}
          correctNegativeSpend={review.correctNegativeSpend}
          deduplicateEmails={review.deduplicateEmails}
          generateTemporaryEmails={review.generateTemporaryEmails}
          issueValues={review.issueValues}
          issueValuesBusy={review.issueValuesBusy}
          issueValuesError={review.issueValuesError}
          loadIssueValues={review.loadIssueValues}
          replaceIssueValue={review.replaceIssueValue}
        />
      )}
    </div>
  );
}
