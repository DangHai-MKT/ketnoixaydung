import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

function moduleUrl(source) {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  });
  return 'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64');
}

const read = path => readFile(new URL('../../' + path, import.meta.url), 'utf8');
const permissions = moduleUrl(await read('lib/auth/permissions.ts'));
const { notificationHref } = await import(moduleUrl(
  (await read('lib/notifications/contracts.ts')).replace('../auth/permissions', permissions),
));
const { chatPath } = await import(moduleUrl(await read('lib/projects/purchase-chat.ts')));
const purchaseId = '97d137a0-9b67-4fab-9aa9-2f59a681ca2e';

test('Partner notifications accept only the expected internal request links', () => {
  for (const base of ['/find-partners', '/admin/partner-requests']) {
    const href = base + '/' + purchaseId;
    assert.equal(notificationHref(href), href);
    assert.equal(notificationHref(href + '/edit'), null);
    assert.equal(notificationHref('https://example.com' + href), null);
  }
});

test('Chat notifications lead to the relevant buyer or seller conversation', () => {
  for (const side of ['buyer', 'seller']) {
    const path = chatPath(side, purchaseId);
    assert.equal(notificationHref(path), path);
    assert.equal(notificationHref(chatPath(side, 'invalid')), null);
    assert.equal(notificationHref(path + '?next=https://example.com'), null);
    assert.equal(notificationHref('https://example.com' + path), null);
  }
});
