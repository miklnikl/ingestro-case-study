import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Query, Request, Response } from './protocol';
import { fields } from './types';

afterEach(() => {
  vi.unstubAllGlobals();
});
async function workerHarness() {
  vi.resetModules();
  let receive: (message: Response) => void = () => {};
  const scope: {
    onmessage: ((event: MessageEvent<Request>) => void) | null;
    postMessage: (message: Response) => void;
  } = {
    onmessage: null,
    postMessage: (message) => receive(message),
  };
  vi.stubGlobal('self', scope);
  await import('./data.worker');
  let id = 0;
  return (
    action: Omit<Request, 'id' | 'query'> & Record<string, unknown>,
    query: Partial<Query> = {},
  ) =>
    new Promise<Response>((resolve) => {
      receive = resolve;
      if (!scope.onmessage) {
        throw new Error('Worker handler was not registered');
      }
      scope.onmessage({
        data: {
          ...action,
          id: ++id,
          query: { search: '', onlyErrors: false, limit: 500, ...query },
        },
      } as MessageEvent<Request>);
    });
}
const header = fields.join(',') + '\n';
const first = 'C-1,Anna,Smith,anna@example.com,2024-02-29,Germany,PRO,19\n';
const second = 'C-2,Leon,Smith,leon@example.com,2024-02-29,Germany,pro,19\n';
function file(text: string) {
  return new File([text], 'test.csv', { type: 'text/csv' });
}

describe('worker change history', () => {
  it('logs imports, edits and removals and resets on a successful replacement', async () => {
    const send = await workerHarness();
    const imported = await send({ type: 'import', file: file(header + first + second) });
    expect(imported).toMatchObject({ type: 'result', total: 2 });
    const initial = await send({ type: 'history', page: 1 });
    expect(initial).toMatchObject({ type: 'history', history: { changes: 3, groups: 1 } });
    await send({ type: 'edit', key: 0, field: 'country', value: 'FR' });
    await send({ type: 'delete', key: 1 });
    const changed = await send({ type: 'history', page: 1 });
    expect(changed).toMatchObject({ type: 'history', history: { changes: 5 } });
    if (changed.type !== 'history') {
      throw new Error('Expected history');
    }
    expect(changed.history.items.at(-1)).toMatchObject({
      customerId: 'C-2',
      description: 'Row removed',
    });
    await send({ type: 'import', file: file(header + first.replace('Germany,PRO', 'DE,pro')) });
    expect(await send({ type: 'history', page: 1 })).toMatchObject({
      type: 'history',
      history: { changes: 0, total: 0 },
    });
  });
  it('does not replace prior history with a partially parsed invalid import', async () => {
    const send = await workerHarness();
    await send({ type: 'import', file: file(header + first) });
    const error = await send({ type: 'import', file: file(header + first + 'broken,row\n') });
    expect(error).toMatchObject({ type: 'error' });
    expect(await send({ type: 'history', page: 1 })).toMatchObject({
      type: 'history',
      history: { changes: 2 },
    });
  });
  it('keeps history and affected-ID responses bounded for 200,000 rows', async () => {
    const send = await workerHarness();
    const data = Array.from(
      { length: 200000 },
      (_, i) =>
        `C-${i}, Anna ,Smith,anna${i}@example.com,${i % 10 === 0 ? '2024-02-30' : '2024-02-29'},Germany,PRO,19`,
    ).join('\n');
    const result = await send({ type: 'import', file: file(header + data) });
    expect(result).toMatchObject({ type: 'result', total: 200000 });
    if (result.type !== 'result') {
      throw new Error('Expected dataset result');
    }
    expect(result.rows).toHaveLength(500);
    const response = await send({ type: 'history', page: 1 });
    expect(response).toMatchObject({
      type: 'history',
      history: { changes: 600000, groups: 3, total: 3 },
    });
    if (response.type !== 'history') {
      throw new Error('Expected history');
    }
    expect(response.history.items).toHaveLength(3);
    const group = response.history.items[0];
    if (group.kind !== 'group') {
      throw new Error('Expected grouped import changes');
    }
    expect(group.ids).toHaveLength(20);
    const lastIds = await send({ type: 'historyIds', groupKey: group.key, page: 2000 });
    expect(lastIds).toMatchObject({
      type: 'historyIds',
      historyIds: { total: 200000, page: 2000 },
    });
    if (lastIds.type !== 'historyIds') {
      throw new Error('Expected ID page');
    }
    expect(lastIds.historyIds.ids).toHaveLength(100);
    expect(lastIds.historyIds.ids.at(-1)).toBe('C-199999');
    const fixed = await send({
      type: 'correctInvalidDates',
      direction: 'later',
      expectedCount: 20000,
    });
    expect(fixed).toMatchObject({ type: 'result', total: 200000, invalid: 0, issueGroups: [] });
    expect(await send({ type: 'history', page: 1 })).toMatchObject({
      type: 'history',
      history: { changes: 620000, groups: 4 },
    });
  }, 30000);
});

describe('worker bulk issue resolution', () => {
  it('applies batches to the whole dataset, logs changes, revalidates and unlocks export', async () => {
    const send = await workerHarness();
    const input =
      header +
      'C-1,Anna,Smith,anna@example.com,2024-02-30,DE,pro,19\nC-2,Leon,Smith,leon@example.com,,DE,pro,0\n';
    expect(await send({ type: 'import', file: file(input) })).toMatchObject({
      type: 'result',
      invalid: 2,
    });
    const first = await send({
      type: 'bulkReplace',
      field: 'signup_date',
      scope: 'invalid',
      value: '2024-03-01',
      expectedCount: 1,
    });
    expect(first).toMatchObject({
      type: 'result',
      invalid: 1,
      issueGroups: [{ field: 'signup_date', empty: 1, invalid: 0 }],
    });
    expect(await send({ type: 'export' })).toMatchObject({ type: 'error' });
    const complete = await send({
      type: 'bulkReplace',
      field: 'signup_date',
      scope: 'empty',
      value: '2024-03-02',
      expectedCount: 1,
    });
    expect(complete).toMatchObject({ type: 'result', invalid: 0, issueGroups: [] });
    expect(await send({ type: 'export' })).toMatchObject({ type: 'export' });
    expect(await send({ type: 'history', page: 1 })).toMatchObject({
      type: 'history',
      history: { changes: 2 },
    });
  });
  it('deletes both sides of duplicate email groups and logs removals', async () => {
    const send = await workerHarness();
    await send({
      type: 'import',
      file: file(
        header +
          first.replace('Germany,PRO', 'DE,pro') +
          second.replace('leon@example.com', 'anna@example.com').replace('Germany', 'DE'),
      ),
    });
    expect(
      await send({
        type: 'bulkReplace',
        field: 'email',
        scope: 'invalid',
        value: 'new@example.com',
        expectedCount: 2,
      }),
    ).toMatchObject({ type: 'error' });
    expect(await send({ type: 'bulkDelete', field: 'email', expectedCount: 2 })).toMatchObject({
      type: 'result',
      total: 0,
      invalid: 0,
      issueGroups: [],
    });
    expect(await send({ type: 'history', page: 1 })).toMatchObject({
      type: 'history',
      history: { changes: 2, groups: 1 },
    });
  });
});

describe('worker email deduplication', () => {
  it.each([
    ['earliest', 'C-1'],
    ['latest', 'C-2'],
  ] as const)(
    'keeps the %s record, logs deletion and revalidates all rows',
    async (keep, expectedId) => {
      const send = await workerHarness();
      const text =
        header +
        'C-1,Anna,Smith,anna@example.com,2024-01-01,DE,pro,19\nC-2,Leon,Smith,anna@example.com,2025-01-01,DE,pro,20\n';
      expect(await send({ type: 'import', file: file(text) })).toMatchObject({
        type: 'result',
        invalid: 2,
        emailDuplicates: { groups: 1, removable: 1 },
      });
      const result = await send({ type: 'deduplicateEmails', keep, expectedCount: 1 });
      expect(result).toMatchObject({
        type: 'result',
        total: 1,
        invalid: 0,
        emailDuplicates: { groups: 0, removable: 0 },
      });
      if (result.type !== 'result') {
        throw new Error('Expected a result');
      }
      expect(result.rows[0].values.customer_id).toBe(expectedId);
      expect(await send({ type: 'export' })).toMatchObject({ type: 'export' });
      expect(await send({ type: 'history', page: 1 })).toMatchObject({
        type: 'history',
        history: { changes: 1, items: [{ description: 'Row removed' }] },
      });
    },
  );
});

describe('worker exact invalid-value replacement', () => {
  it('lists options, fixes only frees and records the batch in history', async () => {
    const send = await workerHarness();
    const input =
      header +
      'C-1,Anna,Smith,anna@example.com,2024-01-01,DE,frees,19\nC-2,Leon,Smith,leon@example.com,2024-01-01,DE,frees,20\nC-3,Mia,Smith,mia@example.com,2024-01-01,DE,pros,20\n';
    await send({ type: 'import', file: file(input) });
    expect(await send({ type: 'issueValues', field: 'plan', search: '', limit: 50 })).toMatchObject(
      {
        type: 'issueValues',
        values: {
          total: 2,
          options: [
            { value: 'frees', count: 2 },
            { value: 'pros', count: 1 },
          ],
        },
      },
    );
    expect(
      await send({
        type: 'replaceIssueValue',
        field: 'plan',
        source: 'frees',
        value: 'free',
        expectedCount: 2,
      }),
    ).toMatchObject({ type: 'result', invalid: 1, counts: { plan: 1 } });
    expect(await send({ type: 'issueValues', field: 'plan', search: '', limit: 50 })).toMatchObject(
      { type: 'issueValues', values: { total: 1, options: [{ value: 'pros', count: 1 }] } },
    );
    expect(await send({ type: 'history', page: 1 })).toMatchObject({
      type: 'history',
      history: {
        changes: 2,
        groups: 1,
        items: [{ description: 'Bulk fix: plan "frees" → "free"', ids: ['C-1', 'C-2'] }],
      },
    });
  });
});

describe('worker temporary emails', () => {
  it('generates email placeholders, updates options and logs the batch', async () => {
    const send = await workerHarness();
    await send({
      type: 'import',
      file: file(
        header + 'C-1,Anna,Smith,,2024-01-01,DE,pro,19\nC-2,Leon,Smith,,2024-01-01,DE,pro,20\n',
      ),
    });
    expect(
      await send({ type: 'issueValues', field: 'email', search: '', limit: 50 }),
    ).toMatchObject({ type: 'issueValues', values: { total: 0, options: [] } });
    expect(await send({ type: 'generateTemporaryEmails', expectedCount: 2 })).toMatchObject({
      type: 'result',
      invalid: 0,
      emailDuplicates: { groups: 0, removable: 0 },
    });
    expect(
      await send({ type: 'issueValues', field: 'email', search: '', limit: 50 }),
    ).toMatchObject({ type: 'issueValues', values: { total: 0, options: [] } });
    expect(await send({ type: 'history', page: 1 })).toMatchObject({
      type: 'history',
      history: { changes: 2 },
    });
    expect(await send({ type: 'export' })).toMatchObject({ type: 'export' });
  });
});

describe('worker all-invalid temporary emails', () => {
  it('replaces malformed and empty emails, keeps valid duplicates and logs changes', async () => {
    const send = await workerHarness();
    const text =
      header +
      'C-1,Anna,Smith,,2024-01-01,DE,pro,19\nC-2,Leon,Smith,broken,2024-01-01,DE,pro,20\nC-3,Mia,Smith,duplicate@example.com,2024-01-01,DE,pro,20\nC-4,Noah,Smith,duplicate@example.com,2024-01-01,DE,pro,20\n';
    expect(await send({ type: 'import', file: file(text) })).toMatchObject({
      type: 'result',
      issueGroups: [{ field: 'email', count: 4, invalidEmailCount: 2 }],
    });
    expect(
      await send({ type: 'issueValues', field: 'email', search: '', limit: 50 }),
    ).toMatchObject({ type: 'issueValues', values: { total: 1, options: [{ value: 'broken' }] } });
    expect(
      await send({ type: 'generateTemporaryEmails', scope: 'invalid', expectedCount: 2 }),
    ).toMatchObject({ type: 'result', invalid: 2, emailDuplicates: { groups: 1, removable: 1 } });
    expect(
      await send({ type: 'issueValues', field: 'email', search: '', limit: 50 }),
    ).toMatchObject({ type: 'issueValues', values: { total: 0, options: [] } });
    expect(await send({ type: 'history', page: 1 })).toMatchObject({
      type: 'history',
      history: { changes: 2 },
    });
  });
});

describe('worker nearest valid dates', () => {
  it.each([
    ['earlier', '2025-02-28'],
    ['later', '2025-03-01'],
  ] as const)(
    'converts to the nearest %s date and records the changes',
    async (direction, expected) => {
      const send = await workerHarness();
      const text =
        header +
        'C-1,Anna,Smith,anna@example.com,2025-02-30,DE,pro,19\nC-2,Leon,Smith,leon@example.com,,DE,pro,20\nC-3,Mia,Smith,mia@example.com,2025-01-01,DE,pro,20\n';
      expect(await send({ type: 'import', file: file(text) })).toMatchObject({
        type: 'result',
        issueGroups: [
          { field: 'signup_date', dateCorrections: { earlier: { count: 1 }, later: { count: 1 } } },
        ],
      });
      const fixed = await send({ type: 'correctInvalidDates', direction, expectedCount: 1 });
      expect(fixed).toMatchObject({ type: 'result', invalid: 1 });
      if (fixed.type !== 'result') {
        throw new Error('Expected dataset result');
      }
      expect(fixed.rows.map((row) => row.values.signup_date)).toEqual([expected, '', '2025-01-01']);
      expect(await send({ type: 'history', page: 1 })).toMatchObject({
        type: 'history',
        history: {
          changes: 1,
          items: [{ description: `Bulk fix: signup date "2025-02-30" → "${expected}"` }],
        },
      });
    },
  );
});

describe('worker negative spend actions', () => {
  it.each(['positive', 'zero'] as const)(
    'converts negative amounts to %s, revalidates and logs changes',
    async (mode) => {
      const send = await workerHarness();
      await send({
        type: 'import',
        file: file(
          header +
            'C-1,Anna,Smith,anna@example.com,2024-01-01,DE,pro,-19.50\nC-2,Leon,Smith,leon@example.com,2024-01-01,DE,pro,-25\nC-3,Mia,Smith,mia@example.com,2024-01-01,DE,pro,10\n',
        ),
      });
      const result = await send({ type: 'correctNegativeSpend', mode, expectedCount: 2 });
      expect(result).toMatchObject({ type: 'result', invalid: 0 });
      if (result.type !== 'result') {
        throw new Error('Expected dataset result');
      }
      expect(result.rows.map((row) => row.values.monthly_spend)).toEqual(
        mode === 'positive' ? ['19.50', '25', '10'] : ['0', '0', '10'],
      );
      expect(await send({ type: 'history', page: 1 })).toMatchObject({
        type: 'history',
        history: { changes: 2 },
      });
      expect(await send({ type: 'export' })).toMatchObject({ type: 'export' });
    },
  );
});

describe('worker inline edit propagation', () => {
  const input =
    header +
    'C-1,Anna,Smith,anna@example.com,2024-01-01,DE,frees,19\nC-2,Leon,Smith,leon@example.com,2024-01-01,DE,frees,20\nC-3,Mia,Smith,mia@example.com,2024-01-01,DE,pros,20\n';
  it('offers a normalized correction, retains it across reads and logs only accepted matches', async () => {
    const send = await workerHarness();
    await send({ type: 'import', file: file(input) });
    const fixed = await send({ type: 'edit', key: 0, field: 'plan', value: ' FREE ' });
    expect(fixed).toMatchObject({
      type: 'result',
      invalid: 2,
      editSuggestion: {
        rowKey: 0,
        field: 'plan',
        source: 'frees',
        value: 'free',
        count: 1,
        customerIds: ['C-2'],
      },
    });
    expect(await send({ type: 'query' })).toMatchObject({
      type: 'result',
      editSuggestion: { source: 'frees', count: 1 },
    });
    const applied = await send({
      type: 'replaceIssueValue',
      field: 'plan',
      source: 'frees',
      value: 'free',
      expectedCount: 1,
    });
    expect(applied).toMatchObject({ type: 'result', invalid: 1, editSuggestion: null });
    if (applied.type !== 'result') {
      throw new Error('Expected result');
    }
    expect(applied.rows.map((row) => row.values.plan)).toEqual(['free', 'free', 'pros']);
    expect(await send({ type: 'history', page: 1 })).toMatchObject({
      type: 'history',
      history: {
        changes: 2,
        items: [
          { description: 'Manual edit: plan "frees" → "free"' },
          { description: 'Bulk fix: plan "frees" → "free"' },
        ],
      },
    });
  });
  it('does not offer still-invalid replacements or propagate automatically', async () => {
    const send = await workerHarness();
    await send({ type: 'import', file: file(input) });
    const result = await send({ type: 'edit', key: 0, field: 'plan', value: 'bad' });
    expect(result).toMatchObject({ type: 'result', invalid: 3, editSuggestion: null });
    if (result.type !== 'result') {
      throw new Error('Expected result');
    }
    expect(result.rows[1].values.plan).toBe('frees');
  });
  it('excludes email and customer IDs even when similar errors remain', async () => {
    const send = await workerHarness();
    await send({
      type: 'import',
      file: file(input.replace('anna@example.com', 'broken').replace('leon@example.com', 'broken')),
    });
    expect(
      await send({ type: 'edit', key: 0, field: 'email', value: 'new@example.com' }),
    ).toMatchObject({ type: 'result', editSuggestion: null });
    await send({ type: 'import', file: file(input.replace('C-2', 'C-1')) });
    expect(
      await send({ type: 'edit', key: 0, field: 'customer_id', value: 'new-id' }),
    ).toMatchObject({ type: 'result', editSuggestion: null });
  });
  it('clears pending suggestions on another mutation or replacement import', async () => {
    const send = await workerHarness();
    await send({ type: 'import', file: file(input) });
    expect(await send({ type: 'edit', key: 0, field: 'plan', value: 'free' })).toMatchObject({
      type: 'result',
      editSuggestion: { count: 1 },
    });
    expect(await send({ type: 'edit', key: 0, field: 'last_name', value: 'Jones' })).toMatchObject({
      type: 'result',
      editSuggestion: null,
    });
    await send({ type: 'import', file: file(input) });
    await send({ type: 'edit', key: 0, field: 'plan', value: 'free' });
    expect(await send({ type: 'import', file: file(input) })).toMatchObject({
      type: 'result',
      editSuggestion: null,
    });
  });
});

describe('worker undo and URL queries', () => {
  it('undoes only the last change, retains it across queries and failures, and logs undo', async () => {
    const send = await workerHarness();
    await send({ type: 'import', file: file(header + first + second) });
    await send({ type: 'edit', key: 0, field: 'country', value: 'FR' });
    await send({ type: 'edit', key: 0, field: 'country', value: 'FR' });
    await send({ type: 'bulkDelete', field: 'email', expectedCount: 99 });
    expect(await send({ type: 'query' }, { country: 'FR' })).toMatchObject({
      matching: 1,
      canUndo: true,
    });
    const restored = await send({ type: 'undo' });
    expect(restored).toMatchObject({
      type: 'result',
      canUndo: false,
      rows: [{ values: { country: 'DE' } }, {}],
    });
    expect(await send({ type: 'undo' })).toMatchObject({ type: 'error' });
    const history = await send({ type: 'history', page: 1 });
    expect(history.type).toBe('history');
    if (history.type === 'history') {
      expect(history.history.items.some((item) => item.description.includes('Undo edit'))).toBe(
        true,
      );
    }
  });
  it('restores removed rows in file order and revalidates duplicate emails', async () => {
    const send = await workerHarness();
    await send({
      type: 'import',
      file: file(header + first + second.replace('leon@example.com', 'anna@example.com')),
    });
    expect(
      await send({ type: 'deduplicateEmails', keep: 'earliest', expectedCount: 1 }),
    ).toMatchObject({ total: 1, canUndo: true, invalid: 0 });
    const restored = await send({ type: 'undo' });
    expect(restored).toMatchObject({
      total: 2,
      invalid: 2,
      canUndo: false,
      rows: [{ key: 0 }, { key: 1 }],
    });
    expect(await send({ type: 'history', page: 1 })).toMatchObject({
      type: 'history',
      history: { changes: 5 },
    });
  });
  it('undoes a whole mass correction and filters both original and edited IDs', async () => {
    const send = await workerHarness();
    await send({
      type: 'import',
      file: file(header + first.replace(',19', ',-19') + second.replace(',19', ',-19')),
    });
    expect(
      await send({ type: 'correctNegativeSpend', mode: 'positive', expectedCount: 2 }),
    ).toMatchObject({ invalid: 0, canUndo: true });
    expect(await send({ type: 'undo' })).toMatchObject({
      invalid: 2,
      rows: [{ values: { monthly_spend: '-19' } }, { values: { monthly_spend: '-19' } }],
    });
    await send({ type: 'edit', key: 0, field: 'customer_id', value: 'C-NEW' });
    expect(await send({ type: 'query' }, { id: 'C-1' })).toMatchObject({
      matching: 1,
      rows: [{ values: { customer_id: 'C-NEW' } }],
    });
    expect(await send({ type: 'query' }, { id: 'C-NEW' })).toMatchObject({ matching: 1 });
    await send({ type: 'delete', key: 0 });
    expect(await send({ type: 'query' }, { id: 'C-1' })).toMatchObject({ matching: 0 });
    expect(await send({ type: 'undo' }, { id: 'C-1' })).toMatchObject({ matching: 1 });
    expect(await send({ type: 'import', file: file(header + first) })).toMatchObject({
      canUndo: false,
    });
  });
});

describe('undo covers every assistant mutation', () => {
  it.each([
    { type: 'replaceIssueValue', field: 'plan', source: 'frees', value: 'free', expectedCount: 1 },
    { type: 'bulkReplace', field: 'plan', scope: 'invalid', value: 'free', expectedCount: 1 },
    { type: 'bulkDelete', field: 'plan', expectedCount: 1 },
    { type: 'correctInvalidDates', direction: 'earlier', expectedCount: 1 },
    { type: 'generateTemporaryEmails', scope: 'invalid', expectedCount: 1 },
  ] as const)('restores the full pre-action state for $type', async (action) => {
    const send = await workerHarness();
    const imported = structuredClone(
      await send({
        type: 'import',
        file: file(header + 'C-1,Anna,Smith,broken,2024-02-30,DE,frees,19\n'),
      }),
    );
    const changed = await send(action);
    expect(changed).toMatchObject({ type: 'result', canUndo: true });
    const restored = await send({ type: 'undo' });
    if (imported.type !== 'result' || restored.type !== 'result') {
      throw new Error('Expected dataset');
    }
    expect(restored.rows).toEqual(imported.rows);
    expect(restored.counts).toEqual(imported.counts);
    expect(restored.invalid).toBe(imported.invalid);
  });
});
