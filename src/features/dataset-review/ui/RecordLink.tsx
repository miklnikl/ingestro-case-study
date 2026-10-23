import { Fragment } from 'react';
import { Typography } from 'antd';
import { recordHref } from '../model/datasetQuery';
export function RecordLink({ id }: { id: string }) {
  const href = recordHref(id, window.location.search);
  return (
    <Typography.Link
      href={href}
      onClick={(event) => {
        if (
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey
        ) {
          event.preventDefault();
          window.history.pushState(null, '', href);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      }}
    >
      {id}
    </Typography.Link>
  );
}
export function RecordLinks({ ids }: { ids: string[] }) {
  return (
    <>
      {ids.map((id, index) => (
        <Fragment key={index}>
          {index > 0 ? ', ' : ''}
          <RecordLink id={id} />
        </Fragment>
      ))}
    </>
  );
}
