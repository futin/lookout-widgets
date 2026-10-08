const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const FUNCTIONS = ['validateCatalog', 'validateData', 'isRelativePath', 'createHubHandler', 'buildCatalog', 'catalogPath', 'dataPath', 'optionsPath', 'actionPath', 'rowActionPath'];

describe('CJS entry points', () => {
  it('export every runtime name', () => {
    const pkg = require('lookout-widgets');
    for (const name of FUNCTIONS) assert.equal(typeof pkg[name], 'function', name);
    assert.equal(typeof pkg.examples, 'object');
    assert.equal(typeof require('lookout-widgets/testkit').checkWidgets, 'function');
  });

  it('serve an empty catalog', async () => {
    const { createHubHandler } = require('lookout-widgets');
    const r = await createHubHandler({ app: { name: 'S' }, widgets: [] }).handle({ method: 'GET', path: '/api/hub/widgets', query: new URLSearchParams() });
    assert.equal(r.status, 200);
  });
});
