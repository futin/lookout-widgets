import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Imported by package name: Node resolves the self-reference through package.json `exports`, the way a consumer does.
const FUNCTIONS = ['validateCatalog', 'validateData', 'isRelativePath', 'createHubHandler', 'buildCatalog', 'catalogPath', 'dataPath', 'optionsPath', 'actionPath', 'rowActionPath'];

describe('ESM entry points', () => {
  it('export every runtime name', async () => {
    const pkg = await import('lookout-widgets');
    for (const name of FUNCTIONS) assert.equal(typeof (pkg as Record<string, unknown>)[name], 'function', name);
    assert.equal(typeof pkg.examples, 'object');
    const kit = await import('lookout-widgets/testkit');
    assert.equal(typeof kit.checkWidgets, 'function');
  });

  it('serve an empty catalog', async () => {
    const { createHubHandler } = await import('lookout-widgets');
    const r = await createHubHandler({ app: { name: 'S' }, widgets: [] }).handle({ method: 'GET', path: '/api/hub/widgets', query: new URLSearchParams() });
    assert.equal(r?.status, 200);
  });
});
