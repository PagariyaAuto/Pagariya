// Source integration guard. Runtime geometry and touch behavior are covered by
// keyboard-visibility.cjs and keyboard-focus.cjs; this does not replace device QA.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');
const errors = [];
let inputCount = 0, listCount = 0;
const inputFiles = new Set();
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? files(file) : /\.tsx?$/.test(file) ? [file] : [];
  });
}
for (const file of files(path.join(root, 'src'))) {
  const relative = path.relative(root, file).replaceAll('\\', '/');
  if (relative === 'src/components/inputs/KeyboardAware.tsx') continue;
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const shared = new Map(), native = new Map();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const binding of bindings.elements) {
      const imported = binding.propertyName?.text || binding.name.text;
      if (specifier.endsWith('/inputs/KeyboardAware')) shared.set(binding.name.text, imported);
      if (specifier === 'react-native') native.set(binding.name.text, imported);
    }
  }
  function fail(node, message) {
    const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    errors.push(`${relative}:${line}: ${message}`);
  }
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      const nativeName = native.get(tag);
      if (['TextInput', 'ScrollView', 'KeyboardAvoidingView', 'Modal'].includes(nativeName)) {
        fail(node, `${nativeName} bypasses the shared keyboard components.`);
      }
      if (shared.get(tag) === 'TextInput') {
        inputCount++;
        inputFiles.add(relative);
      }
      if (['FlatList', 'SectionList'].includes(nativeName)) {
        listCount++;
        const render = node.attributes.properties.find(prop => ts.isJsxAttribute(prop) && prop.name.text === 'renderScrollComponent');
        let hasSharedScroll = false;
        function findScroll(child) {
          if ((ts.isJsxOpeningElement(child) || ts.isJsxSelfClosingElement(child)) && shared.get(child.tagName.getText(source)) === 'ScrollView') hasSharedScroll = true;
          ts.forEachChild(child, findScroll);
        }
        if (render) findScroll(render);
        if (!hasSharedScroll) fail(node, 'List must connect its scroll container to the shared keyboard component.');
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
const layout = fs.readFileSync(path.join(root, 'src/app/_layout.tsx'), 'utf8');
assert.match(layout, /<KeyboardBoundary>/, 'Root outside-tap boundary must remain connected.');
assert.equal(errors.length, 0, errors.join('\n'));
assert.ok(inputCount > 0 && listCount > 0, 'Coverage scan must discover inputs and lists.');
console.log(`Project keyboard integration passed: ${inputCount} input controls across ${inputFiles.size} files; ${listCount} list scroll connections; no native JSX bypasses.`);
