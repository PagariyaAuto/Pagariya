const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const ts = require('typescript');
const root = 'src/';
const compile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const utilModule = { exports: {} };
vm.runInNewContext(compile(fs.readFileSync(root + 'lib/date-time.ts', 'utf8')), { exports: utilModule.exports });
const util = utilModule.exports;
const component = fs.readFileSync(root + 'components/inputs/DateTimeField.tsx', 'utf8');
const ast = ts.createSourceFile('field.tsx', component, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), stateNames = [];
function states(node) { if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name) && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(ast) === 'useState')
    stateNames.push(node.name.elements[0].getText(ast)); ts.forEachChild(node, states); }
states(ast);
const gate = '2026-10-05T09:30:25.125Z', selected = '2026-10-06T06:00:00.000Z';
function render(os = 'web', overrides = {}, state = {}, focused = true) {
    let index = 0;
    const nodes = [], changes = [], validation = [], stateChanges = {};
    const jsx = (type, props) => { const node = { type, props }; nodes.push(node); return node; };
    const react = { useRef: value => ({ current: value }), createElement: jsx, useEffect: () => { }, useState: initial => { const name = stateNames[index++], value = name in state ? state[name] : typeof initial === 'function' ? initial() : initial; return [value, next => { stateChanges[name] = typeof next === 'function' ? next(stateChanges[name] ?? value) : next; }]; } };
    const native = { Platform: { OS: os }, Keyboard: { dismiss: () => { } }, StyleSheet: { create: value => value }, Pressable: 'Pressable', Text: 'Text', View: 'View' };
    const module = { exports: {} };
    vm.runInNewContext(compile(component), { exports: module.exports, require: name => {
            if (name === 'react')
                return react;
            if (name === 'react/jsx-runtime')
                return { jsx, jsxs: jsx, Fragment: 'Fragment' };
            if (name === 'react-native')
                return native;
            if (name === 'expo-router')
                return { useIsFocused: () => focused };
            if (name.includes('datetimepicker'))
                return { default: 'NativePicker' };
            if (name.includes('date-time'))
                return util;
            if (name.includes('theme'))
                return { colors: { primary: 'red', border: 'gray' } };
            return { default: 'Icon' };
        }, setInterval: () => 0, clearInterval: () => { } });
    const props = { title: 'Claim Date & Time', value: selected, onChange: value => changes.push(value), onValidationError: issue => validation.push(issue), minimumDate: gate, maximumDate: 'now', required: true, ...overrides };
    module.exports.default(props);
    return { nodes, changes, validation, stateChanges, props };
}
let checks = 0;
async function check(fn) { await fn(); checks++; }
(async () => {
    await check(() => { assert.equal(util.formatDateTimeIST('2026-10-08T05:05:00Z'), '08/10/2026 10:35 AM'); assert.equal(util.parseIndiaLocal('2026-10-08T10:35').toISOString(), '2026-10-08T05:05:00.000Z'); });
    await check(() => { for (const invalid of ['2026-02-30T12:00', 'bad', '2026-10-05T25:00'])
        assert.equal(util.parseIndiaLocal(invalid), null); assert.equal(util.parseDateTime('2026-10-05T15:00'), null); });
    await check(() => { const b = { minimumDate: gate, maximumDate: 'now', required: true }; const now = Date.parse(selected); assert.equal(util.validateDateTime(gate, b, now), null); assert.equal(util.validateDateTime(selected, b, now), null); assert.ok(util.validateDateTime(new Date(Date.parse(gate) - 1).toISOString(), b, now)); assert.ok(util.validateDateTime(new Date(now + 1).toISOString(), b, now)); });
    await check(() => { assert.equal(util.validateDateTime(null), null); assert.ok(util.validateDateTime(null, { required: true })); assert.ok(util.validateDateTime(selected, { minimumDate: 'bad' })); assert.ok(util.validateDateTime(selected, { minimumDate: selected, maximumDate: gate })); });
    await check(() => { assert.equal(util.validateDateTime('2030-01-01T00:00:00Z'), null); assert.equal(util.validateDateTime(selected, { minimumDate: gate }), null); assert.equal(util.validateDateTime(gate, { maximumDate: selected }), null); });
    await check(() => { assert.equal(util.validateDateTime(gate, { minimumDate: selected, minimumMessage: 'Too early' }), 'Too early'); assert.equal(util.validateDateTime(selected, { maximumDate: gate, maximumMessage: 'Too late' }), 'Too late'); });
    await check(() => { const t = render(); const input = t.nodes.find(n => n.type === 'input'); assert.equal(input.props.min, '2026-10-05T15:00:26'); assert.equal(input.props.value, '2026-10-06T11:30:00'); assert.equal(input.props.required, true); assert.equal(input.props.style.opacity, 0); });
    await check(() => { const t = render(); t.nodes.find(n => n.type === 'input').props.onChange({ currentTarget: { value: '2026-10-06T12:00' } }); assert.equal(t.changes[0], '2026-10-06T06:30:00.000Z'); assert.equal(t.validation[0], null); });
    await check(() => { const t = render(); t.nodes.find(n => n.type === 'input').props.onChange({ currentTarget: { value: '2026-10-05T14:00' } }); assert.ok(t.validation[0]); assert.equal(t.changes.length, 1); });
    await check(() => { const t = render('web', { required: false }); t.nodes.find(n => n.type === 'input').props.onChange({ currentTarget: { value: '' } }); assert.equal(t.changes[0], null); assert.equal(t.validation[0], null); });
    await check(() => { const t = render('web', { disabled: true }); const input = t.nodes.find(n => n.type === 'input'); assert.equal(input.props.disabled, true); input.props.onChange({ currentTarget: { value: '2026-10-06T12:00' } }); assert.equal(t.changes.length, 0); });
    await check(() => { const t = render(); const input = t.nodes.find(n => n.type === 'input'); input.props.onClick({ currentTarget: {} }); assert.equal(t.stateChanges.webFallback, true); });
    await check(() => { const t = render(); t.nodes.find(n => n.type === 'input').props.onClick({ currentTarget: { showPicker: () => { throw Error('Unsupported'); } } }); assert.equal(t.stateChanges.webFallback, true); });
    await check(() => { const t = render('web', {}, { webFallback: true }); assert.equal(t.nodes.find(n => n.type === 'input').props.style.minHeight, 44); });
    await check(() => { const t = render('android', {}, { picker: 'date', pickerDate: new Date(selected) }); const picker = t.nodes.find(n => n.type === 'NativePicker'); assert.equal(picker.props.timeZoneName, 'Asia/Kolkata'); assert.equal(picker.props.minimumDate.toISOString(), gate); picker.props.onChange({ type: 'set' }, new Date('2026-10-07T09:00:00Z')); assert.equal(t.stateChanges.picker, 'time'); assert.equal(t.changes[0], '2026-10-07T06:00:00.000Z'); });
    await check(() => { const t = render('android', {}, { picker: 'time', pickerDate: new Date(gate) }); t.nodes.find(n => n.type === 'NativePicker').props.onChange({ type: 'set' }, new Date('2026-10-05T08:00:00Z')); assert.equal(t.changes.length, 0); assert.ok(t.validation[0]); assert.equal(t.stateChanges.picker, null); });
    await check(() => { const t = render('android', {}, { picker: 'date', pickerDate: new Date(selected) }); t.nodes.find(n => n.type === 'NativePicker').props.onChange({ type: 'dismissed' }); assert.equal(t.changes.length, 0); assert.equal(t.stateChanges.picker, null); });
    await check(() => { const t = render('ios', {}, { picker: 'datetime', pickerDate: new Date(selected) }); const picker = t.nodes.find(n => n.type === 'NativePicker'); assert.equal(picker.props.mode, 'datetime'); picker.props.onChange({ type: 'set' }, new Date(selected)); assert.equal(t.changes[0], selected); assert.equal(t.stateChanges.picker, undefined); });
    for (const overrides of [{ active: false }, { disabled: true }])
        await check(() => { assert.equal(render('android', overrides, { picker: 'date' }).nodes.filter(n => n.type === 'NativePicker').length, 0); });
    await check(() => { assert.equal(render('android', {}, { picker: 'date' }, false).nodes.filter(n => n.type === 'NativePicker').length, 0); });
    await check(() => { const t = render('web', { minimumDate: undefined, maximumDate: undefined, required: false }); const input = t.nodes.find(n => n.type === 'input'); assert.equal(input.props.min, undefined); assert.equal(input.props.max, undefined); assert.equal(input.props.required, false); });
    await check(() => { const form = fs.readFileSync(root + 'app/(tabs)/advisor/claim-intimation-form.tsx', 'utf8'); assert.match(form, /<DateTimeField/); assert.match(form, /onValidationError=\{onTimeValidationError\}/); assert.ok(!form.includes('NativePicker')); assert.ok(!form.includes('datetime-local')); assert.match(form, /rejectedTime.current \|\| rangeError/); assert.match(form, /title: next.time \? "Check claim date & time"/); });
    await check(() => { for (const mode of ['date', 'time'])
        for (const os of ['android', 'ios']) {
            const t = render(os, { mode, minimumDate: undefined, maximumDate: undefined }, { picker: mode, pickerDate: new Date(selected) });
            const picker = t.nodes.find(n => n.type === 'NativePicker');
            assert.equal(picker.props.mode, mode);
            picker.props.onChange({ type: 'set' }, new Date('2026-10-07T08:00:00Z'));
            assert.equal(t.changes.length, 1);
            assert.notEqual(t.stateChanges.picker, 'time');
        } });
    await check(() => { for (const [mode, raw, expected] of [['date', '2026-10-07', '2026-10-07T06:00:00.000Z'], ['time', '14:45:00', '2026-10-06T09:15:00.000Z']]) {
        const t = render('web', { mode, minimumDate: undefined, maximumDate: undefined });
        const input = t.nodes.find(n => n.type === 'input');
        assert.equal(input.props.type, mode);
        input.props.onChange({ currentTarget: { value: raw } });
        assert.equal(t.changes[0], expected);
    } });
    await check(() => { const t = render('web', { mode: 'time', minimumDate: '2026-10-05T00:00:00Z', maximumDate: '2026-10-07T00:00:00Z' }); const input = t.nodes.find(n => n.type === 'input'); assert.equal(input.props.min, undefined); assert.equal(input.props.max, undefined); });
    console.log(`${checks} shared date/time component, platform callback, boundary and integration checks passed (TZ=${process.env.TZ || 'system'}).`);
})().catch(error => { console.error(error); process.exitCode = 1; });
