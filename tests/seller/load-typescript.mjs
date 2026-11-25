import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const cache = new Map();

export async function loadTs(url) {
  const key = String(url);
  if (cache.has(key)) return cache.get(key);
  const source = (await readFile(url, 'utf8')).replace(/import ['"]server-only['"];?/g, '');
  let { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
  const imports = [...outputText.matchAll(/from ['"]([^'"]+)['"]/g)];
  for (const [, specifier] of imports) {
    let resolved = specifier;
    if (specifier.startsWith('.')) resolved = await loadTs(new URL(`${specifier}.ts`, url));
    else if (!specifier.startsWith('node:')) resolved = pathToFileURL(require.resolve(specifier)).href;
    outputText = outputText.split(`'${specifier}'`).join(`'${resolved}'`).split(`"${specifier}"`).join(`"${resolved}"`);
  }
  const result = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
  cache.set(key, result);
  return result;
}
