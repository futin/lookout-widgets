import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rowActionPath } from '../../dist/esm/producer/build.js';
import type { ActionDecl, ActionReply, WidgetDecl } from '../../dist/esm/producer/declare.js';
import { createHubHandler } from '../../dist/esm/producer/handler.js';

const req = (method: string, path: string, body?: unknown) => ({ method, path, query: new URLSearchParams(), body });

describe('param options', () => {
  const w = (loadOptions: () => unknown): WidgetDecl => ({
    id: 'w',
    title: 'W',
    render: 'stat',
    refreshSeconds: 10,
    params: [
      { id: 'project', label: 'Project', type: 'choice', optional: true, loadOptions: loadOptions as () => [] },
      { id: 'window', label: 'Window', type: 'choice', options: [{ value: '1h', label: 'Hour' }] }
    ],
    load: () => ({ value: 1 })
  });
  const h = (loadOptions: () => unknown) => createHubHandler({ app: { name: 'A' }, widgets: [w(loadOptions)], onDrop: () => {} });
  const path = '/api/hub/widgets/w/params/project/options';

  it('serves what loadOptions returns', async () => {
    assert.deepEqual(await h(() => [{ value: 'a', label: 'A' }]).handle(req('GET', path)), { status: 200, json: { options: [{ value: 'a', label: 'A' }] } });
  });

  it('awaits an async loadOptions', async () => {
    assert.deepEqual(await h(async () => [{ value: 'a', label: 'A' }]).handle(req('GET', path)), { status: 200, json: { options: [{ value: 'a', label: 'A' }] } });
  });

  for (const bad of [[{ value: '', label: 'A' }], [{ value: 'a' }], [{ value: 'a', label: '' }], 'nope', [null]]) {
    it(`answers 500 invalid option for ${JSON.stringify(bad)}`, async () => {
      assert.deepEqual(await h(() => bad).handle(req('GET', path)), { status: 500, json: { error: 'invalid option' } });
    });
  }

  it('answers 500 with the message when loadOptions throws', async () => {
    assert.deepEqual(await h(() => { throw new Error('db down'); }).handle(req('GET', path)), { status: 500, json: { error: 'db down' } });
  });

  for (const [name, method, p] of [
    ['a param with static options', 'GET', '/api/hub/widgets/w/params/window/options'],
    ['an unknown param', 'GET', '/api/hub/widgets/w/params/nope/options'],
    ['an unknown widget', 'GET', '/api/hub/widgets/nope/params/project/options'],
    ['POST to an options path', 'POST', path]
  ]) {
    it(`answers 404 for ${name}`, async () => {
      assert.equal((await h(() => []).handle(req(method, p)))?.status, 404);
    });
  }
});

describe('actions', () => {
  const calls: [string | undefined, string | undefined][] = [];
  let next: () => unknown = () => ({ ok: true });
  const go: ActionDecl = {
    id: 'go',
    label: 'Go',
    run: (input, rowId) => {
      calls.push([input, rowId]);
      return next() as ActionReply;
    }
  };
  const w: WidgetDecl = { id: 'w', title: 'W', render: 'list', refreshSeconds: 10, actions: [go], load: () => ({ rows: [] }) };
  const h = createHubHandler({ app: { name: 'A' }, widgets: [w], onDrop: () => {} });
  const reset = (reply: () => unknown = () => ({ ok: true })) => {
    calls.length = 0;
    next = reply;
  };

  it('runs a widget action with a string input and serves the reply', async () => {
    reset();
    assert.deepEqual(await h.handle(req('POST', '/api/hub/widgets/w/actions/go', { input: 'hi' })), { status: 200, json: { ok: true } });
    assert.deepEqual(calls, [['hi', undefined]]);
  });

  for (const body of [{ input: 5 }, null, undefined, 'hi']) {
    it(`passes input undefined for body ${JSON.stringify(body)}`, async () => {
      reset();
      assert.equal((await h.handle(req('POST', '/api/hub/widgets/w/actions/go', body)))?.status, 200);
      assert.deepEqual(calls, [[undefined, undefined]]);
    });
  }

  // Through URL parsing, as every real mount does: a path that only round-trips unparsed proves nothing about a live request.
  for (const rowId of ['a/b', '50%', 'x y', 'q?x=1', 'ünï', '...', '.x', 'x..']) {
    it(`round-trips row id ${JSON.stringify(rowId)} through URL parsing`, async () => {
      reset();
      const path = new URL(rowActionPath('w', rowId, 'go'), 'http://x').pathname;
      assert.equal((await h.handle(req('POST', path)))?.status, 200);
      assert.deepEqual(calls, [[undefined, rowId]]);
    });
  }

  for (const seg of ['.', '..', '%2E', '%2e%2E']) {
    it(`answers 404 for the dot row segment ${seg}, without running the action`, async () => {
      reset();
      assert.equal((await h.handle(req('POST', `/api/hub/widgets/w/rows/${seg}/actions/go`)))?.status, 404);
      assert.deepEqual(calls, []);
    });
  }

  it('answers 404 for a row segment that does not decode, without throwing', async () => {
    reset();
    assert.equal((await h.handle(req('POST', '/api/hub/widgets/w/rows/%E0%A4%A/actions/go')))?.status, 404);
    assert.deepEqual(calls, []);
  });

  it('passes the message through', async () => {
    reset(() => ({ ok: true, message: 'done' }));
    assert.deepEqual(await h.handle(req('POST', '/api/hub/widgets/w/actions/go')), { status: 200, json: { ok: true, message: 'done' } });
  });

  it('awaits an async run', async () => {
    reset(async () => ({ ok: false }));
    assert.deepEqual(await h.handle(req('POST', '/api/hub/widgets/w/actions/go')), { status: 200, json: { ok: false } });
  });

  for (const bad of [{ ok: 'yes' }, { ok: true, message: 3 }, undefined, null]) {
    it(`answers 500 invalid action reply for ${JSON.stringify(bad)}`, async () => {
      reset(() => bad);
      assert.deepEqual(await h.handle(req('POST', '/api/hub/widgets/w/actions/go')), { status: 500, json: { error: 'invalid action reply' } });
    });
  }

  it('answers 500 with the message when run throws', async () => {
    reset(() => { throw new Error('nope'); });
    assert.deepEqual(await h.handle(req('POST', '/api/hub/widgets/w/actions/go')), { status: 500, json: { error: 'nope' } });
    reset(() => { throw 'x'; });
    assert.deepEqual(await h.handle(req('POST', '/api/hub/widgets/w/rows/r/actions/go')), { status: 500, json: { error: 'x' } });
  });

  for (const [name, method, p] of [
    ['GET on a widget action path', 'GET', '/api/hub/widgets/w/actions/go'],
    ['GET on a row action path', 'GET', '/api/hub/widgets/w/rows/r/actions/go'],
    ['an unknown action', 'POST', '/api/hub/widgets/w/actions/nope'],
    ['an unknown action on a row', 'POST', '/api/hub/widgets/w/rows/r/actions/nope'],
    ['an unknown widget', 'POST', '/api/hub/widgets/nope/actions/go'],
    ['an empty row segment', 'POST', '/api/hub/widgets/w/rows//actions/go']
  ]) {
    it(`answers 404 for ${name}`, async () => {
      reset();
      assert.equal((await h.handle(req(method, p)))?.status, 404);
      assert.deepEqual(calls, []);
    });
  }
});
