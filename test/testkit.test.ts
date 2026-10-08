import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { WidgetDecl } from '../src/producer/declare.js';
import { createHubHandler } from '../src/producer/handler.js';
import { checkWidgets } from '../src/testkit/index.js';

const gauge = (over: Partial<WidgetDecl> = {}) =>
  ({ id: 'usage', title: 'Usage', render: 'gauge', refreshSeconds: 60, load: () => ({ bars: [{ label: '5-hour', percent: 40 }] }), ...over }) as WidgetDecl;
const list: WidgetDecl = { id: 'sessions', title: 'Sessions', render: 'list', refreshSeconds: 10, load: () => ({ rows: [{ id: 's1', title: 'One' }] }) };
const stat: WidgetDecl = {
  id: 'q',
  title: 'Q',
  render: 'stat',
  refreshSeconds: 10,
  params: [{ id: 'window', label: 'Window', type: 'choice', options: [{ value: '1h', label: 'Hour' }] }],
  load: () => ({ value: 1 })
};
const handler = (widgets: WidgetDecl[]) => createHubHandler({ app: { name: 'A' }, widgets, onDrop: () => {} });

describe('checkWidgets', () => {
  it('passes a good gauge and a good list', async () => {
    assert.deepEqual(await checkWidgets(handler([gauge(), list])), []);
  });

  it('reports a load that throws', async () => {
    assert.deepEqual(await checkWidgets(handler([gauge({ load: () => { throw new Error('down'); } })])), ['usage: 500 down']);
  });

  it('asks for a case for a required param', async () => {
    assert.deepEqual(await checkWidgets(handler([stat])), ['q: param window needs a case']);
  });

  it('fetches once per case', async () => {
    assert.deepEqual(await checkWidgets(handler([stat]), [{ widget: 'q', params: { window: '1h' } }]), []);
    const failures = await checkWidgets(handler([stat]), [
      { widget: 'q', params: { window: '1h' } },
      { widget: 'q', params: { window: 'bad' } }
    ]);
    assert.equal(failures.length, 1);
    assert.ok(failures[0].startsWith('q: 400'), failures[0]);
  });

  it('reports a case naming a widget the catalog does not serve', async () => {
    assert.deepEqual(await checkWidgets(handler([gauge()]), [{ widget: 'nope', params: {} }]), ['nope: case names a widget the catalog does not serve']);
  });

  it('reports a creation-time drop, and nothing else for it', async () => {
    assert.deepEqual(await checkWidgets(handler([gauge(), gauge({ id: 'bad', open: 'https://x' })])), ['bad: dropped: open must be a relative path']);
  });

  it('reports an app-level drop as app', async () => {
    const h = createHubHandler({ app: { name: 'A', icon: 'https://x/i.png' }, widgets: [gauge()], onDrop: () => {} });
    assert.deepEqual(await checkWidgets(h), ['app: dropped: app.icon must be a relative path']);
  });

  it('never throws, even when the handler does', async () => {
    const h = { dropped: [], handle: () => Promise.reject(new Error('boom')) };
    assert.deepEqual(await checkWidgets(h), ['catalog: boom']);
  });
});
