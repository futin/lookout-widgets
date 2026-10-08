// Ported from lookout/shared/contract/paths.test.ts (jest). One `it` per jest case; each `it.each` row is its own `it`.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isRelativePath } from '../../src/contract/paths.js';

describe('isRelativePath', () => {
  for (const p of ['/', '/api/x', '/a?b=c', '/a#frag', '/api/hub/widgets/usage']) {
    it(`accepts ${JSON.stringify(p)}`, () => {
      assert.equal(isRelativePath(p), true);
    });
  }

  for (const [name, p] of [
    ['empty', ''],
    ['no leading slash', 'api/x'],
    ['protocol-relative', '//evil.test/x'],
    ['slash-backslash', '/\\evil.test/x'],
    ['backslash later in the path', '/a\\b'],
    ['http scheme', 'http://x/y'],
    ['https scheme', 'https://x'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['leading space', ' /x'],
    // Browsers drop tab and newline when parsing a URL, so "/<tab>/evil.test" becomes "//evil.test".
    ['embedded tab', '/\t/evil.test/x'],
    ['embedded newline', '/\n/evil.test/x'],
    ['carriage return', '/a\rb']
  ]) {
    it(`rejects ${name}`, () => {
      assert.equal(isRelativePath(p), false);
    });
  }

  it('rejects non-strings', () => {
    assert.equal(isRelativePath(undefined as unknown as string), false);
    assert.equal(isRelativePath(42 as unknown as string), false);
  });
});
