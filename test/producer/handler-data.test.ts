import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateCatalog, type Dropped } from '../../dist/esm/contract/validate.js';
import { buildCatalog } from '../../dist/esm/producer/build.js';
import type { ParamValues, WidgetDecl } from '../../dist/esm/producer/declare.js';
import { createHubHandler, type HubReply } from '../../dist/esm/producer/handler.js';

const NOW = '2026-10-08T00:00:00.000Z';
const now = () => new Date(NOW);

const gauge = (load: WidgetDecl['load'], over: Partial<WidgetDecl> = {}) =>
  ({ id: 'g', title: 'G', render: 'gauge', refreshSeconds: 60, load, ...over }) as WidgetDecl;

function handler(widgets: WidgetDecl[], app = { name: 'App' } as { name: string; icon?: string }) {
  const drops: Dropped[] = [];
  const h = createHubHandler({ app, widgets, now, onDrop: (d) => drops.push(d) });
  return { h, drops };
}

const get = (h: ReturnType<typeof createHubHandler>, path: string, query = '') =>
  h.handle({ method: 'GET', path, query: new URLSearchParams(query) });

describe('catalog and ownership', () => {
  const decls = [gauge(() => ({ bars: [{ label: 'a', percent: 1 }] }))];

  it('serves the validated catalog', async () => {
    const { h } = handler(decls);
    const expected = validateCatalog(buildCatalog({ name: 'App' }, decls));
    assert.ok(expected.ok);
    assert.deepEqual(await get(h, '/api/hub/widgets'), { status: 200, json: expected.catalog });
  });

  for (const [method, path] of [
    ['GET', '/api/hub/widgetsx'],
    ['GET', '/api/hub'],
    ['GET', '/api/other'],
    ['PUT', '/api/hub/widgets'],
    ['DELETE', '/api/hub/widgets/g']
  ]) {
    it(`does not own ${method} ${path}`, async () => {
      const { h } = handler(decls);
      assert.equal(await h.handle({ method, path, query: new URLSearchParams() }), null);
    });
  }

  for (const [method, path] of [
    ['GET', '/api/hub/widgets/'],
    ['GET', '/api/hub/widgets/nope'],
    ['GET', '/api/hub/widgets/g/extra'],
    ['POST', '/api/hub/widgets/g'],
    ['POST', '/api/hub/widgets']
  ]) {
    it(`answers 404 to ${method} ${path}`, async () => {
      const { h } = handler(decls);
      const r = (await h.handle({ method, path, query: new URLSearchParams() })) as HubReply;
      assert.equal(r.status, 404);
      assert.equal(typeof (r.json as { error: unknown }).error, 'string');
    });
  }

  it('names the unknown widget', async () => {
    const { h } = handler(decls);
    assert.deepEqual(await get(h, '/api/hub/widgets/nope'), { status: 404, json: { error: 'unknown widget nope' } });
  });
});

describe('data', () => {
  it('stamps updatedAt and serves the clamped, normalised data', async () => {
    const { h } = handler([gauge(() => ({ bars: [{ label: '5-hour', percent: 140 }] }))]);
    assert.deepEqual(await get(h, '/api/hub/widgets/g'), { status: 200, json: { bars: [{ label: '5-hour', percent: 100 }], updatedAt: NOW } });
  });

  it('answers 500 with the validator reason when the data is invalid', async () => {
    const { h } = handler([gauge(() => ({ bars: [] }))]);
    assert.deepEqual(await get(h, '/api/hub/widgets/g'), { status: 500, json: { error: 'bars must hold at least one bar' } });
  });

  for (const [name, load] of [
    ['a sync throw', () => { throw new Error('usage rate_limited'); }],
    ['a rejection', () => Promise.reject(new Error('usage rate_limited'))]
  ] as const) {
    it(`answers 500 with the message on ${name}`, async () => {
      const { h } = handler([gauge(load as WidgetDecl['load'])]);
      assert.deepEqual(await get(h, '/api/hub/widgets/g'), { status: 500, json: { error: 'usage rate_limited' } });
    });
  }

  it('answers 500 with String(thrown) on a thrown non-Error', async () => {
    const { h } = handler([gauge(() => { throw 'boom'; })]);
    assert.deepEqual(await get(h, '/api/hub/widgets/g'), { status: 500, json: { error: 'boom' } });
  });
});

describe('params', () => {
  let seen: ParamValues | undefined;
  const q: WidgetDecl = {
    id: 'q',
    title: 'Q',
    render: 'stat',
    refreshSeconds: 10,
    params: [
      { id: 'window', label: 'Window', type: 'choice', options: [{ value: '1h', label: 'Hour' }, { value: '24h', label: 'Day' }] },
      { id: 'tag', label: 'Tag', type: 'text', optional: true },
      { id: 'project', label: 'Project', type: 'choice', optional: true, loadOptions: () => [] }
    ],
    load: (p) => {
      seen = p;
      return { value: 1 };
    }
  };
  const { h } = handler([q]);

  it('reads only declared params, first value wins', async () => {
    seen = undefined;
    assert.equal((await get(h, '/api/hub/widgets/q', 'window=1h&window=24h&zzz=1'))?.status, 200);
    assert.deepEqual(seen, { window: '1h' });
  });

  it('passes an optional param when present', async () => {
    await get(h, '/api/hub/widgets/q', 'window=1h&tag=x');
    assert.deepEqual(seen, { window: '1h', tag: 'x' });
  });

  for (const query of ['', 'window=']) {
    it(`answers 400 for a missing required param (${JSON.stringify(query)})`, async () => {
      assert.deepEqual(await get(h, '/api/hub/widgets/q', query), { status: 400, json: { error: 'missing param window' } });
    });
  }

  it('answers 400 for a choice value outside the static options', async () => {
    assert.deepEqual(await get(h, '/api/hub/widgets/q', 'window=7d'), { status: 400, json: { error: 'invalid value for param window' } });
  });

  it('passes a loadOptions param value through unchecked', async () => {
    await get(h, '/api/hub/widgets/q', 'window=24h&project=anything');
    assert.deepEqual(seen, { window: '24h', project: 'anything' });
  });
});

describe('action ids in load results', () => {
  const runs = (ids: string[]): WidgetDecl => ({
    id: 'runs',
    title: 'Runs',
    render: 'list',
    refreshSeconds: 10,
    actions: [
      { id: 'retry', label: 'Retry', run: () => ({ ok: true }) },
      { id: 'note', label: 'Note', confirm: 'Sure?', input: { label: 'Why', text: true }, run: () => ({ ok: true }) }
    ],
    load: () => ({ rows: [{ id: 'r 1', title: 'T', actions: ids }] })
  });

  it('expands row action ids into contract actions with row paths', async () => {
    const { h } = handler([runs(['retry', 'note'])]);
    const r = (await get(h, '/api/hub/widgets/runs')) as HubReply;
    assert.equal(r.status, 200);
    assert.deepEqual((r.json as { rows: { actions: unknown }[] }).rows[0].actions, [
      { id: 'retry', label: 'Retry', path: '/api/hub/widgets/runs/rows/r%201/actions/retry' },
      { id: 'note', label: 'Note', path: '/api/hub/widgets/runs/rows/r%201/actions/note', confirm: 'Sure?', input: { label: 'Why', text: true } }
    ]);
  });

  it('expands widget-level action ids into widget action paths', async () => {
    const stat: WidgetDecl = {
      id: 's',
      title: 'S',
      render: 'stat',
      refreshSeconds: 10,
      actions: [{ id: 'reset', label: 'Reset', run: () => ({ ok: true }) }],
      load: () => ({ value: 1, actions: ['reset'] })
    };
    const { h } = handler([stat]);
    const r = (await get(h, '/api/hub/widgets/s')) as HubReply;
    assert.deepEqual(r, { status: 200, json: { updatedAt: NOW, value: 1, actions: [{ id: 'reset', label: 'Reset', path: '/api/hub/widgets/s/actions/reset' }] } });
  });

  it('answers 500 for an action id the widget does not declare', async () => {
    const { h } = handler([runs(['nope'])]);
    assert.deepEqual(await get(h, '/api/hub/widgets/runs'), { status: 500, json: { error: 'unknown action nope' } });
  });
});

describe('creation-time drops', () => {
  const ok = gauge(() => ({ bars: [{ label: 'a', percent: 1 }] }));

  it('reports an absolute app.icon and serves the catalog without it', async () => {
    const { h, drops } = handler([ok], { name: 'App', icon: 'https://x/icon.png' });
    assert.deepEqual(drops, [{ widgetId: null, reason: 'app.icon must be a relative path' }]);
    assert.deepEqual(h.dropped, drops);
    const r = (await get(h, '/api/hub/widgets')) as HubReply;
    assert.deepEqual((r.json as { app: unknown }).app, { name: 'App' });
  });

  it('drops a widget with an absolute open: reported, absent from the catalog, 404 for data', async () => {
    const { h, drops } = handler([ok, gauge(ok.load, { id: 'bad', open: 'https://x' })]);
    assert.equal(drops.length, 1);
    assert.equal(drops[0].widgetId, 'bad');
    const r = (await get(h, '/api/hub/widgets')) as HubReply;
    assert.deepEqual((r.json as { widgets: { id: string }[] }).widgets.map((w) => w.id), ['g']);
    assert.equal((await get(h, '/api/hub/widgets/bad'))?.status, 404);
  });

  it('throws at creation when the catalog as a whole is invalid', () => {
    assert.throws(() => createHubHandler({ app: { name: '' }, widgets: [], onDrop: () => {} }));
  });
});
