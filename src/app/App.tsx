import { useEffect, useState } from 'react';
import { DatasetReviewPage } from '../pages/dataset-review/DatasetReviewPage';
import { ChangeHistoryPage } from '../pages/change-history/ChangeHistoryPage';
import { useDatasetReview } from '../features/dataset-review';
export default function App() {
  const review = useDatasetReview();
  const [path, setPath] = useState(window.location.hash);
  useEffect(() => {
    const onHashChange = () => setPath(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('popstate', onHashChange);
    };
  }, []);
  return path === '#/changes' ? (
    <ChangeHistoryPage review={review} />
  ) : (
    <DatasetReviewPage review={review} />
  );
}
