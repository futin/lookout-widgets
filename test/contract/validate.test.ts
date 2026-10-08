// Ported from lookout/shared/contract/validate.test.ts (jest). One `it` per jest case; each `it.each` row is its own `it`. jest's asymmetric matchers
// (`expect.stringContaining`, `expect.any`, `toMatchObject`) become explicit asserts or the `assertMatches` subset check below.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { examples } from '../../src/examples/index.js';
import { validateCatalog, validateData } from '../../src/contract/validate.js';
import type { RenderType } from '../../src/contract/types.js';

const UPDATED = '2026-10-07T12:00:00.000Z';

const widget = (over: Record<string, unknown> = {}) => ({
  id: 'w1',
  title: 'Widget',
  render: 'stat',
  data: '/api/hub/widgets/w1',
  refreshSeconds: 10,
  ...over
});

const catalog = (widgets: unknown[], over: Record<string, unknown> = {}) => ({
  contract: 1,
  app: { name: 'App' },
  widgets,
  ...over
});

function okCatalog(raw: unknown) {
  const r = validateCatalog(raw);
  if (!r.ok) throw new Error(`expected ok, got: ${r.reason}`);
  return r;
}

// jest's toMatchObject: every key of `expected` is present in `actual` and matches recursively; arrays must match element for element.
function assertMatches(actual: unknown, expected: unknown, at = '$'): void {
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), `${at}: expected an array`);
    assert.equal(actual.length, expected.length, `${at}: length`);
    expected.forEach((e, i) => assertMatches(actual[i], e, `${at}[${i}]`));
  } else if (expected !== null && typeof expected === 'object') {
    assert.ok(actual !== null && typeof actual === 'object', `${at}: expected an object`);
    for (const [k, v] of Object.entries(expected)) assertMatches((actual as Record<string, unknown>)[k], v, `${at}.${k}`);
  } else {
    assert.equal(actual, expected, at);
  }
}

describe('validateCatalog', () => {
  it('accepts the full example catalog without dropping anything', () => {
    const r = okCatalog(examples.catalogs.full);
    assert.equal(r.catalog.widgets.length, examples.catalogs.full.widgets.length);
    assert.deepEqual(r.dropped, []);
  });

  it('accepts the empty example catalog', () => {
    const r = okCatalog(examples.catalogs.empty);
    assert.deepEqual(r.catalog.widgets, []);
    assert.deepEqual(r.dropped, []);
  });

  it('pins the example ids and param shapes later tasks depend on', () => {
    const { widgets } = examples.catalogs.full;
    const byId = Object.fromEntries(widgets.map((w) => [w.id, w]));
    assert.deepEqual(widgets.map((w) => w.render).sort(), ['gauge', 'list', 'stat', 'status']);
    assert.equal(byId.queue.render, 'stat');
    assert.equal(byId.queue.params?.length, 1);
    const window = byId.queue.params![0];
    assert.equal(window.id, 'window');
    assert.equal(window.type, 'choice');
    assert.deepEqual(window.options?.map((o) => o.value), ['1h', '24h', '7d']);
    for (const o of window.options!) assert.equal(typeof o.label, 'string');
    assert.ok(!byId.queue.params![0].optional);
    assert.equal(byId.usage.render, 'gauge');
    assert.equal(byId.usage.params?.length, 1);
    const project = byId.usage.params![0];
    assert.equal(project.id, 'project');
    assert.equal(project.optional, true);
    assert.equal(typeof project.optionsFrom, 'string');
    assert.equal(byId.runs.render, 'list');
    assert.equal(byId.runs.open, '/');
    assert.deepEqual(byId.runs.params ?? [], []);
    assert.equal(byId.health.render, 'status');
    assert.deepEqual(byId.health.params ?? [], []);
    const required = widgets.flatMap((w) => (w.params ?? []).filter((p) => !p.optional));
    assert.deepEqual(
      required.map((p) => p.id),
      ['window']
    );
  });

  it('drops a widget with an unknown render and keeps the others', () => {
    const r = okCatalog(catalog([widget({ id: 'a', render: 'chart' }), widget({ id: 'b' })]));
    assert.deepEqual(
      r.catalog.widgets.map((w) => w.id),
      ['b']
    );
    assert.equal(r.dropped.length, 1);
    assert.equal(r.dropped[0].widgetId, 'a');
    assert.ok(r.dropped[0].reason.includes('unknown render "chart"'));
  });

  for (const [field, over] of [
    ['data', { data: '//evil.test/x' }],
    ['open', { open: '//evil.test/x' }],
    ['open', { open: 'http://x/y' }]
  ] as const) {
    it(`drops a widget whose ${field} is not a relative path`, () => {
      const r = okCatalog(catalog([widget(over)]));
      assert.deepEqual(r.catalog.widgets, []);
      assert.equal(r.dropped.length, 1);
      assert.ok(r.dropped[0].reason.includes(field));
    });
  }

  it('drops a widget whose param optionsFrom is not a relative path', () => {
    const params = [{ id: 'p', label: 'P', type: 'choice', optionsFrom: '/\\evil.test/x' }];
    const r = okCatalog(catalog([widget({ params })]));
    assert.deepEqual(r.catalog.widgets, []);
    assert.ok(r.dropped[0].reason.includes('optionsFrom'));
  });

  it('drops a widget with a malformed param', () => {
    const r = okCatalog(catalog([widget({ params: [{ id: 'p', label: 'P', type: 'slider' }] })]));
    assert.deepEqual(r.catalog.widgets, []);
    assert.ok(r.dropped[0].reason.includes('param'));
  });

  it('drops a widget missing a title', () => {
    const { title: _title, ...noTitle } = widget();
    const r = okCatalog(catalog([noTitle]));
    assert.deepEqual(r.catalog.widgets, []);
    assert.equal(r.dropped.length, 1);
    assert.equal(r.dropped[0].widgetId, 'w1');
    assert.ok(r.dropped[0].reason.includes('title'));
  });

  it('drops a widget with no usable id and reports a null id', () => {
    const r = okCatalog(catalog([widget({ id: 7 })]));
    assert.equal(r.dropped.length, 1);
    assert.equal(r.dropped[0].widgetId, null);
    assert.ok(r.dropped[0].reason.includes('id'));
  });

  it('drops a non-object widget entry', () => {
    const r = okCatalog(catalog(['nope', null, widget()]));
    assert.equal(r.catalog.widgets.length, 1);
    assert.equal(r.dropped.length, 2);
  });

  it('drops the second widget that reuses an id', () => {
    const r = okCatalog(catalog([widget({ title: 'First' }), widget({ title: 'Second' })]));
    assert.deepEqual(
      r.catalog.widgets.map((w) => w.title),
      ['First']
    );
    assert.deepEqual(r.dropped, [{ widgetId: 'w1', reason: 'duplicate id' }]);
  });

  it('clamps refreshSeconds to 2-3600', () => {
    const r = okCatalog(
      catalog([
        widget({ id: 'a', refreshSeconds: 0 }),
        widget({ id: 'b', refreshSeconds: 99999 }),
        widget({ id: 'c', refreshSeconds: 30 })
      ])
    );
    assert.deepEqual(
      r.catalog.widgets.map((w) => w.refreshSeconds),
      [2, 3600, 30]
    );
    assert.deepEqual(r.dropped, []);
  });

  it('drops a widget whose refreshSeconds is not a number', () => {
    const r = okCatalog(catalog([widget({ refreshSeconds: '5' })]));
    assert.deepEqual(r.catalog.widgets, []);
    assert.ok(r.dropped[0].reason.includes('refreshSeconds'));
  });

  it('rejects a contract from the future with the pinned reason', () => {
    assert.deepEqual(validateCatalog(catalog([], { contract: 2 })), { ok: false, reason: 'needs a newer Lookout' });
  });

  for (const [name, contract] of [
    ['missing', undefined],
    ['zero', 0],
    ['fractional', 1.5],
    ['string', '1'],
    ['negative', -1]
  ] as const) {
    it(`rejects a ${name} contract`, () => {
      const raw: Record<string, unknown> = catalog([]);
      if (contract === undefined) delete raw.contract;
      else raw.contract = contract;
      const r = validateCatalog(raw);
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(typeof r.reason, 'string');
      if (!r.ok) assert.notEqual(r.reason, 'needs a newer Lookout');
    });
  }

  it('rejects widgets that is not an array', () => {
    assert.equal(validateCatalog(catalog([], { widgets: {} })).ok, false);
    assert.equal(validateCatalog({ contract: 1, app: { name: 'A' } }).ok, false);
  });

  it('rejects a missing app name', () => {
    assert.equal(validateCatalog(catalog([], { app: {} })).ok, false);
    assert.equal(validateCatalog(catalog([], { app: undefined })).ok, false);
    assert.equal(validateCatalog(catalog([], { app: { name: '' } })).ok, false);
  });

  for (const raw of [null, 'x', 5, []]) {
    it(`rejects a non-object catalog (${JSON.stringify(raw)})`, () => {
      assert.equal(validateCatalog(raw).ok, false);
    });
  }

  it('ignores unknown fields at every level and strips them from the result', () => {
    const raw = catalog(
      [
        widget({
          extra: 1,
          params: [{ id: 'p', label: 'P', type: 'text', extra: true }]
        })
      ],
      { extra: 'x', app: { name: 'App', extra: '/i.png' } }
    );
    const r = okCatalog(raw);
    assert.deepEqual(r.dropped, []);
    assert.equal(r.catalog.widgets.length, 1);
    assert.ok(!('extra' in r.catalog.widgets[0]));
    assert.ok(!('extra' in r.catalog.widgets[0].params![0]));
    assert.deepEqual(r.catalog.app, { name: 'App' });
  });
});

describe('app.icon', () => {
  const full = examples.catalogs.full;
  const withApp = (app: Record<string, unknown>) => ({ ...full, app });
  const ICON_REASON = 'app.icon must be a relative path';

  it('keeps a relative icon path', () => {
    const r = okCatalog(withApp({ name: full.app.name, icon: '/icon.svg' }));
    assert.deepEqual(r.catalog.app, { name: full.app.name, icon: '/icon.svg' });
    assert.deepEqual(r.dropped, []);
  });

  it('leaves icon out when absent', () => {
    const r = okCatalog(withApp({ name: full.app.name }));
    assert.deepEqual(r.catalog.app, { name: full.app.name });
    assert.equal('icon' in r.catalog.app, false);
    assert.deepEqual(r.dropped, []);
  });

  for (const icon of ['https://x/y', '//x/y', 'icon.svg', '/a\\b', 7, null]) {
    it(`drops icon ${JSON.stringify(icon)} and keeps the catalog`, () => {
      const r = okCatalog(withApp({ name: full.app.name, icon }));
      assert.equal('icon' in r.catalog.app, false);
      assert.equal(r.catalog.widgets.length, full.widgets.length);
      assert.deepEqual(r.dropped, [{ widgetId: null, reason: ICON_REASON }]);
    });
  }

  it('lists the icon entry first when a widget is dropped too', () => {
    const r = okCatalog(catalog([widget({ id: 'a', render: 'chart' })], { app: { name: 'App', icon: 7 } }));
    assert.equal(r.dropped.length, 2);
    assert.deepEqual(r.dropped[0], { widgetId: null, reason: ICON_REASON });
    assert.equal(r.dropped[1].widgetId, 'a');
    assert.ok(r.dropped[1].reason.includes('unknown render "chart"'));
  });
});

function okData(render: RenderType, raw: unknown) {
  const r = validateData(render, raw);
  if (!r.ok) throw new Error(`expected ok, got: ${r.reason}`);
  return r.data;
}

describe('validateData', () => {
  describe('gauge', () => {
    it('clamps percent to 0-100', () => {
      const data = okData('gauge', {
        updatedAt: UPDATED,
        bars: [
          { label: 'a', percent: 140 },
          { label: 'b', percent: -5 },
          { label: 'c', percent: 42 }
        ]
      });
      assert.deepEqual(
        (data as { bars: { percent: number }[] }).bars.map((b) => b.percent),
        [100, 0, 42]
      );
    });

    it('requires at least one bar', () => {
      assert.equal(validateData('gauge', { updatedAt: UPDATED, bars: [] }).ok, false);
      assert.equal(validateData('gauge', { updatedAt: UPDATED }).ok, false);
    });

    it('rejects a bar with a non-numeric percent or a bad resetsAt', () => {
      assert.equal(validateData('gauge', { updatedAt: UPDATED, bars: [{ label: 'x', percent: '5' }] }).ok, false);
      assert.equal(validateData('gauge', { updatedAt: UPDATED, bars: [{ label: 'x', percent: 5, resetsAt: 'soon' }] }).ok, false);
    });

    it('keeps a valid resetsAt', () => {
      const data = okData('gauge', { updatedAt: UPDATED, bars: [{ label: 'x', percent: 5, resetsAt: UPDATED }] });
      assert.equal((data as { bars: { resetsAt?: string }[] }).bars[0].resetsAt, UPDATED);
    });
  });

  describe('list', () => {
    const row = (over: Record<string, unknown> = {}) => ({ id: 'r1', title: 'Row', ...over });

    it('accepts an empty list', () => {
      assert.deepEqual(okData('list', { updatedAt: UPDATED, rows: [] }), { updatedAt: UPDATED, rows: [] });
    });

    it('rejects rows that is not an array', () => {
      assert.equal(validateData('list', { updatedAt: UPDATED }).ok, false);
    });

    it('rejects a row action whose path is not relative', () => {
      const actions = [{ id: 'a', label: 'A', path: '//x' }];
      assert.equal(validateData('list', { updatedAt: UPDATED, rows: [row({ actions })] }).ok, false);
    });

    it('rejects a row open that is not relative', () => {
      assert.equal(validateData('list', { updatedAt: UPDATED, rows: [row({ open: 'https://x' })] }).ok, false);
    });

    it('rejects an action input with neither options nor text', () => {
      const actions = [{ id: 'a', label: 'A', path: '/x', input: { label: 'q' } }];
      assert.equal(validateData('list', { updatedAt: UPDATED, rows: [row({ actions })] }).ok, false);
    });

    it('accepts action inputs with options, text, or both', () => {
      const actions = [
        { id: 'a', label: 'A', path: '/x', input: { label: 'q', options: ['one', 'two'] } },
        { id: 'b', label: 'B', path: '/x', input: { label: 'q', text: true } },
        { id: 'c', label: 'C', path: '/x', input: { label: 'q', options: ['one'], text: true }, confirm: 'Sure?' }
      ];
      const data = okData('list', { updatedAt: UPDATED, rows: [row({ actions })] }) as { rows: { actions: unknown[] }[] };
      assert.deepEqual(data.rows[0].actions, actions);
    });

    it('rejects an unknown row status and keeps known ones', () => {
      assert.equal(validateData('list', { updatedAt: UPDATED, rows: [row({ status: 'paused' })] }).ok, false);
      assertMatches(okData('list', { updatedAt: UPDATED, rows: [row({ status: 'running' })], total: 9 }), { total: 9 });
    });
  });

  describe('stat', () => {
    it('rejects an updatedAt that is not a date, or missing', () => {
      assert.equal(validateData('stat', { updatedAt: 'not a date', value: 1 }).ok, false);
      assert.equal(validateData('stat', { value: 1 }).ok, false);
    });

    it('requires a number or string value', () => {
      assert.equal(validateData('stat', { updatedAt: UPDATED }).ok, false);
      assert.equal(validateData('stat', { updatedAt: UPDATED, value: true }).ok, false);
      assertMatches(okData('stat', { updatedAt: UPDATED, value: '12m' }), { value: '12m' });
    });

    it('rejects an unknown tone', () => {
      assert.equal(validateData('stat', { updatedAt: UPDATED, value: 1, tone: 'loud' }).ok, false);
    });

    it('keeps top-level actions', () => {
      const actions = [{ id: 'reset', label: 'Reset', path: '/api/hub/actions/reset' }];
      assertMatches(okData('stat', { updatedAt: UPDATED, value: 1, actions }), { actions });
    });

    it('rejects a top-level action whose path is not relative', () => {
      const actions = [{ id: 'reset', label: 'Reset', path: 'http://x' }];
      assert.equal(validateData('stat', { updatedAt: UPDATED, value: 1, actions }).ok, false);
    });

    it('strips unknown fields', () => {
      assert.deepEqual(okData('stat', { updatedAt: UPDATED, value: 1, extra: 1 }), { updatedAt: UPDATED, value: 1 });
    });
  });

  describe('status', () => {
    it('rejects an unknown state', () => {
      assert.equal(validateData('status', { updatedAt: UPDATED, state: 'busy', label: 'x' }).ok, false);
    });

    it('accepts each known state', () => {
      for (const state of ['ok', 'warn', 'error', 'idle']) {
        assertMatches(okData('status', { updatedAt: UPDATED, state, label: 'x', detail: 'd' }), { state, detail: 'd' });
      }
    });

    it('requires a label', () => {
      assert.equal(validateData('status', { updatedAt: UPDATED, state: 'ok' }).ok, false);
    });
  });

  for (const raw of [null, 'x', 3, []]) {
    it(`rejects a non-object body (${JSON.stringify(raw)})`, () => {
      assert.equal(validateData('stat', raw).ok, false);
    });
  }

  it('rejects an unknown render type', () => {
    assert.equal(validateData('chart' as RenderType, { updatedAt: UPDATED }).ok, false);
  });

  it('validates every example data response against its widget render', () => {
    for (const w of examples.catalogs.full.widgets) {
      const raw = examples.data[w.id as keyof typeof examples.data];
      assert.notEqual(raw, undefined);
      const r = validateData(w.render, raw);
      assert.equal(r.ok, true);
      if (r.ok) assert.ok(r.data !== null && r.data !== undefined);
    }
  });

  it('the runs example covers a plain, a confirm-only and an input row action', () => {
    const runs = examples.data.runs as { rows: { actions?: { confirm?: string; input?: unknown }[] }[] };
    const actions = runs.rows.flatMap((r) => r.actions ?? []);
    assert.equal(
      actions.some((a) => !a.confirm && !a.input),
      true
    );
    assert.equal(
      actions.some((a) => a.confirm && !a.input),
      true
    );
    assert.equal(
      actions.some((a) => a.input),
      true
    );
    assertMatches(examples.data.queue, { actions: [{ id: 'reset', label: 'Reset', path: '/api/hub/actions/reset' }] });
  });
});
