import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isRelativePath } from '../../src/contract/paths.js';
import { actionPath, buildCatalog, catalogPath, dataPath, optionsPath, rowActionPath } from '../../src/producer/build.js';
import type { ActionDecl, ParamDecl, WidgetDecl } from '../../src/producer/declare.js';

const gauge = (over: Partial<WidgetDecl> = {}): WidgetDecl =>
  ({ id: 'usage', title: 'U', render: 'gauge', refreshSeconds: 60, load: () => ({ bars: [{ label: 'a', percent: 1 }] }), ...over }) as WidgetDecl;
const action = (id: string): ActionDecl => ({ id, label: id, run: () => ({ ok: true }) });
const param = (over: Partial<ParamDecl> = {}): ParamDecl => ({ id: 'p', label: 'P', type: 'text', ...over });

describe('buildCatalog', () => {
  it('builds an empty catalog', () => {
    assert.deepEqual(buildCatalog({ name: 'A' }, []), { contract: 1, app: { name: 'A' }, widgets: [] });
  });

  it('derives the data path and leaves no functions in the output', () => {
    const c = buildCatalog({ name: 'A' }, [gauge()]);
    assert.deepEqual(c.widgets, [{ id: 'usage', title: 'U', render: 'gauge', refreshSeconds: 60, data: '/api/hub/widgets/usage' }]);
    assert.ok(!('load' in c.widgets[0]));
    assert.deepEqual(JSON.parse(JSON.stringify(c)), c);
  });

  it('passes open and the app icon through', () => {
    const c = buildCatalog({ name: 'A', icon: '/icon.svg' }, [gauge({ open: '/' })]);
    assert.deepEqual(c.app, { name: 'A', icon: '/icon.svg' });
    assert.equal(c.widgets[0].open, '/');
  });

  it('gives a loadOptions param an optionsFrom path and strips the loader', () => {
    const c = buildCatalog({ name: 'A' }, [gauge({ params: [param({ id: 'project', type: 'choice', loadOptions: () => [] })] })]);
    assert.deepEqual(c.widgets[0].params, [{ id: 'project', label: 'P', type: 'choice', optionsFrom: '/api/hub/widgets/usage/params/project/options' }]);
    assert.deepEqual(JSON.parse(JSON.stringify(c)), c);
  });

  it('keeps static options and optional on a param', () => {
    const options = [{ value: '1h', label: 'Hour' }];
    const c = buildCatalog({ name: 'A' }, [gauge({ params: [param({ id: 'window', type: 'choice', options, optional: true })] })]);
    assert.deepEqual(c.widgets[0].params, [{ id: 'window', label: 'P', type: 'choice', options, optional: true }]);
  });

  for (const id of ['Usage', '-x', 'a_b', '']) {
    it(`throws on widget id ${JSON.stringify(id)}`, () => {
      assert.throws(() => buildCatalog({ name: 'A' }, [gauge({ id })]));
    });
  }

  it('throws on param id "P"', () => {
    assert.throws(() => buildCatalog({ name: 'A' }, [gauge({ params: [param({ id: 'P' })] })]), /P/);
  });

  it('throws on action id "a b"', () => {
    assert.throws(() => buildCatalog({ name: 'A' }, [gauge({ actions: [action('a b')] })]), /a b/);
  });

  it('throws on a duplicate widget id, naming it', () => {
    assert.throws(() => buildCatalog({ name: 'A' }, [gauge(), gauge()]), /usage/);
  });

  it('throws on a duplicate param id within one widget, and allows it across widgets', () => {
    assert.throws(() => buildCatalog({ name: 'A' }, [gauge({ params: [param({ id: 'w' }), param({ id: 'w' })] })]), /w/);
    assert.doesNotThrow(() => buildCatalog({ name: 'A' }, [gauge({ params: [param({ id: 'w' })] }), gauge({ id: 'other', params: [param({ id: 'w' })] })]));
  });

  it('throws on a duplicate action id within one widget', () => {
    assert.throws(() => buildCatalog({ name: 'A' }, [gauge({ actions: [action('retry'), action('retry')] })]), /retry/);
  });

  it('throws on a param with both options and loadOptions', () => {
    const p = param({ id: 'both', type: 'choice', options: [{ value: 'a', label: 'A' }], loadOptions: () => [] });
    assert.throws(() => buildCatalog({ name: 'A' }, [gauge({ params: [p] })]), /both/);
  });
});

describe('path helpers', () => {
  it('derive the spec §3.2 paths', () => {
    assert.equal(catalogPath(), '/api/hub/widgets');
    assert.equal(dataPath('runs'), '/api/hub/widgets/runs');
    assert.equal(optionsPath('usage', 'project'), '/api/hub/widgets/usage/params/project/options');
    assert.equal(actionPath('runs', 'retry'), '/api/hub/widgets/runs/actions/retry');
    assert.equal(rowActionPath('runs', 'a/b c%', 'retry'), '/api/hub/widgets/runs/rows/a%2Fb%20c%25/actions/retry');
  });

  it('are all relative, even for a row id that tries to climb', () => {
    assert.equal(rowActionPath('x', '../evil', 'a'), '/api/hub/widgets/x/rows/..%2Fevil/actions/a');
    for (const p of [catalogPath(), dataPath('x'), optionsPath('x', 'x'), actionPath('x', 'x'), rowActionPath('x', '../evil', 'x')]) {
      assert.ok(isRelativePath(p), p);
    }
  });
});
