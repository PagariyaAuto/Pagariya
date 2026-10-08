const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const ts = require('typescript');
const path = 'src/app/(tabs)/advisor/claim-intimation-form.tsx';
const text = fs.readFileSync(path, 'utf8'), ast = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), snippets = {};
function visit(n) { if (ts.isVariableDeclaration(n) && ['save', 'leave', 'changeTime', 'onTimeValidationError', 'messageOf'].includes(n.name.getText(ast)))
    snippets[n.name.getText(ast)] = n.initializer.getText(ast); if (ts.isFunctionDeclaration(n) && ['rangeError', 'formatTime'].includes(n.name?.text))
    snippets[n.name.text] = n.getText(ast); ts.forEachChild(n, visit); }
visit(ast);
const compile = code => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
const utilities = {};
vm.runInNewContext(compile(fs.readFileSync('src/lib/date-time.ts', 'utf8')), { exports: utilities });
function setup(response = { data: { success: true, visit_id: 'visit-1', stage: 'PENDING_SURVEY' }, error: null }) {
    const calls = [], scope = { parseInput: utilities.parseDateTime, validateDateTime: utilities.validateDateTime, busy: { current: false }, disabled: false, context: { visit: { id: 'visit-1' }, vehicle: { vehicle_no: 'TEST1' }, gateInAt: '2026-10-05T09:30:00Z' }, time: '2026-10-06T06:00:00Z', estimate: 'EST1', claim: 'CL1', remarks: '', request: { current: 1 }, mounted: { current: true }, rejectedTime: { current: null }, Keyboard: { dismiss: () => { } }, returnToQueue: () => calls.push('back'), supabase: { rpc: async (...args) => { calls.push(args); return response; } } };
    for (const [setter, key] of Object.entries({ setTime: 'time', setDirty: 'dirty', setErrors: 'errors', setNotice: 'notice', setSaving: 'saving', setCompleted: 'completed' }))
        scope[setter] = next => { scope[key] = typeof next === 'function' ? next(scope[key] || {}) : next; };
    const methods = vm.runInNewContext(compile(`${snippets.rangeError};${snippets.formatTime};const messageOf=${snippets.messageOf};({save:${snippets.save},leave:${snippets.leave},changeTime:${snippets.changeTime},onTimeValidationError:${snippets.onTimeValidationError}});`), scope);
    return { scope, calls, ...methods };
}
(async () => {
    let t = setup();
    t.onTimeValidationError('Before Gate In');
    await t.save();
    assert.equal(t.calls.length, 0);
    assert.equal(t.scope.notice.title, 'Check claim date & time');
    assert.equal(t.scope.busy.current, false);
    t.changeTime('2026-10-06T07:00:00Z');
    t.onTimeValidationError(null);
    await t.save();
    assert.equal(t.calls.length, 1);
    assert.equal(t.scope.completed, true);
    assert.equal(t.scope.saving, false);
    assert.equal(t.scope.notice, null);
    assert.equal(t.calls[0][0], 'new_workflow_claim_intimation');
    t.leave();
    assert.equal(t.calls[1], 'back');
    t = setup();
    t.changeTime('2026-10-04T07:00:00Z');
    await t.save();
    assert.equal(t.calls.length, 0);
    assert.match(t.scope.notice.message, /Gate In/);
    t = setup();
    t.changeTime(null);
    await t.save();
    assert.equal(t.calls.length, 0);
    assert.equal(t.scope.notice.title, 'Check claim date & time');
    t = setup({ data: null, error: { message: 'Network failure' } });
    await t.save();
    assert.equal(t.scope.busy.current, false);
    assert.equal(t.scope.saving, false);
    assert.equal(t.scope.notice.title, 'Unable to complete');
    console.log('Claim integration checks passed: rejected selection, correction, missing/past time, save, error recovery and Back.');
})().catch(e => { console.error(e); process.exitCode = 1; });
