const fs = require('fs'), vm = require('vm'), assert = require('assert/strict'), ts = require('typescript');
const root = 'src/components/inputs/';
const compile = s => ts.transpileModule(s, { compilerOptions: { target: 7, module: 1, jsx: 4 } }).outputText;
function focus(os) { const calls = [], input = { tag: 10 }; const exports = {}; const doc = { activeElement: { closest: () => true, blur: () => calls.push('blur') } }; vm.runInNewContext(compile(fs.readFileSync(root + 'keyboard-focus.ts', 'utf8')), { exports, document: doc, require: () => ({ Platform: { OS: os }, findNodeHandle: x => x.tag, Keyboard: { dismiss: () => calls.push('dismiss') }, TextInput: { State: { currentlyFocusedInput: () => input } } }) }); return { calls, input, exports }; }
let n = 0;
for (const os of ['android', 'ios']) {
    const t = focus(os);
    t.exports.registerInput(t.input);
    assert.equal(t.exports.dismissOnOutsideTouch({ target: t.input }), false);
    assert.equal(t.calls.length, 0);
    assert.equal(t.exports.dismissOnOutsideTouch({ target: 10 }), false);
    assert.equal(t.calls.length, 0);
    let pressed = 0;
    assert.equal(t.exports.dismissOnOutsideTouch({ target: { tag: 20 } }), false);
    pressed++;
    assert.equal(pressed, 1);
    assert.deepEqual(t.calls, ['dismiss']);
    t.exports.unregisterInput(t.input);
    assert.equal(t.exports.isInputTarget(t.input), false);
    n++;
}
{
    const t = focus('web');
    assert.equal(t.exports.dismissOnOutsideTouch({ target: { closest: () => true } }), false);
    assert.equal(t.calls.length, 0);
    assert.equal(t.exports.dismissOnOutsideTouch({ target: { closest: () => null } }), false);
    assert.deepEqual(t.calls, ['blur']);
    n++;
}
console.log(`${n} outside-touch checks passed: native input switching and first-tap buttons; web blur.`);
