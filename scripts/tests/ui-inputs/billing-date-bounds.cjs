const fs = require('fs'), vm = require('vm'), assert = require('assert/strict'), ts = require('typescript');
const compile = source => ts.transpileModule(source, { compilerOptions: { target: 7, module: 1 } }).outputText;
function moduleAt(file, imports = {}) {
  const exports = {};
  vm.runInNewContext(compile(fs.readFileSync(file, 'utf8')), { exports, Date, require: name => {
    if (!(name in imports)) throw Error('Unexpected import ' + name);
    return imports[name];
  }});
  return exports;
}
const dates = moduleAt('src/lib/date-time.ts');
const visit = moduleAt('src/lib/visit-date-time.ts', { './date-time': dates });
const gate = '2026-10-07T09:38:14.789Z';
const valid = '2026-10-07T10:30:00.000Z';
const april = '2026-04-01T10:30:00.000Z';
assert.match(visit.validateVisitDateTime(april, gate), /Gate In/);
assert.equal(visit.validateVisitDateTime(gate, gate), null);
assert.equal(visit.validateVisitDateTime(valid, gate), null);
assert.match(visit.validateVisitDateTime(new Date(Date.now() + 60000).toISOString(), gate), /current time/);
assert.match(visit.validateVisitDateTime(valid, null), /could not be loaded/);
assert.match(visit.validateVisitDateTime(valid, 'invalid'), /could not be loaded/);
assert.match(visit.validateVisitDateTime(valid, new Date(Date.now() + 60000).toISOString()), /could not be loaded/);
assert.equal(visit.validateVisitDateTime(gate, gate), null);
assert.equal(visit.validateVisitDateTime(valid, gate), null);
assert.equal(visit.visitDateTimeBounds(gate).minimumDate, gate);
assert.equal(dates.parseIndiaLocal('2026-10-07T15:08') .toISOString(), '2026-10-07T09:38:00.000Z');
assert.match(visit.validateVisitDateTime('2026-10-07T09:38:00.000Z', gate), /Gate In/);

function initializer(file, name) {
  const source = fs.readFileSync(file, 'utf8'), ast = ts.createSourceFile(file, source, 99, true, 4);
  let found;
  function walk(node) { if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) found = node.initializer.getText(ast); ts.forEachChild(node, walk); }
  walk(ast); assert.ok(found, name); return compile('(' + found + ')');
}
const billing = 'src/app/(tabs)/advisor/billing.tsx';
const base = {
  dateValidation: { getError: () => undefined },
  selected: { visit_id: 'visit', job_type: 'INSURANCE', handoff: null },
  preSent: true, liabilityReceived: false, preTime: valid, liabilityTime: valid,
  parseIndiaInput: value => value,
  visitDates: { validate: value => visit.validateVisitDateTime(value, gate) },
};
function values(changes = {}) { return vm.runInNewContext(initializer(billing, 'values'), { ...base, ...changes })(); }
assert.throws(() => values({ preTime: april }), /Gate In/);
assert.throws(() => values({ liabilityReceived: true, liabilityTime: april }), /Gate In/);
assert.throws(() => values({ visitDates: { validate: () => visit.GATE_IN_UNAVAILABLE } }), /could not be loaded/);
assert.equal(values({ liabilityReceived: true, liabilityTime: gate }).p_liability_received_at, gate); // liability first
assert.equal(values({ preSent: false, liabilityReceived: true, liabilityTime: gate }).p_pre_invoice_sent_at, null); // save liability alone
assert.throws(() => values({ preSent: false, liabilityReceived: false }), /Record pre-invoice/);
assert.equal(values().p_liability_received_at, null); // save pre-invoice while waiting
assert.equal(values({ liabilityReceived: true }).p_liability_received_at, valid);
assert.equal(values({ selected: { visit_id: 'paid', job_type: 'PAID' }, verified: true, visitDates: { validate: () => { throw Error('Should not validate Paid timestamps'); } } }).p_details_verified, true);
assert.equal(values({ selected: { visit_id: 'history', job_type: 'INSURANCE', handoff: { pre_invoice_sent_at: april, liability_received_at: april } }, visitDates: { validate: () => { throw Error('Do not rewrite saved history'); } } }).p_pre_invoice_sent_at, april);

async function run() {
  let rpcCalls = 0, popup;
  const invalidValues = () => values({ preTime: april });
  const save = vm.runInNewContext(initializer(billing, 'save'), {
    selected: base.selected, busy: { current: false }, disabled: false, values: invalidValues,
    setConfirmTransfer: () => {}, setNotice: value => { popup = value; }, setSaving: () => {},
    supabase: { rpc: () => { rpcCalls++; } },
  });
  await save(false);
  assert.equal(rpcCalls, 0);
  assert.match(popup.body, /Gate In/);

  // Exercise actual hook effects with deferred reads and persistent React state.
  let state, effect, cleanup, effectDeps, memo, request = [], focused = true;
  const react = {
    useState: initial => {
      // The hook has two state cells: refresh counter, then visit-bound data.
      const cell = react.index++;
      if (cell === 0) return [react.revision || 0, next => { react.revision = next(react.revision || 0); }];
      state ??= initial; return [state, next => { state = next; }];
    },
    useCallback: fn => memo ??= fn,
    useEffect: (fn, deps) => {
      if (!effectDeps || deps.some((value, i) => value !== effectDeps[i])) { cleanup?.(); effect = fn; effectDeps = deps; }
    },
  };
  const hook = moduleAt('src/components/inputs/useVisitDateTimeBounds.ts', {
    react, 'expo-router': { useIsFocused: () => focused },
    '../../../lib/supabase': { supabase: { from: table => {
      assert.equal(table, 'gate_entries');
      return { select: fields => { assert.equal(fields, 'gate_in_at'); return { eq: (key, id) => {
        assert.equal(key, 'visit_id');
        return { maybeSingle: () => new Promise(resolve => request.push({ id, resolve })) };
      }}; }};
    }}}, '../../lib/date-time': dates, '../../lib/visit-date-time': visit,
  }).default;
  function render(id) { react.index = 0; const value = hook(id); if (effect) { const fn = effect; effect = null; cleanup = fn(); } return value; }
  render('A');
  request[0].resolve({ data: { gate_in_at: gate }, error: null }); await new Promise(setImmediate);
  assert.equal(render('A').bounds().minimumDate, gate);
  const switched = render('B');
  assert.match(switched.validate(valid), /could not be loaded/);
  render('C');
  request[1].resolve({ data: { gate_in_at: april }, error: null }); await new Promise(setImmediate);
  assert.match(render('C').validate(valid), /could not be loaded/); // ignore stale B
  request[2].resolve({ data: null, error: null }); await new Promise(setImmediate);
  assert.match(render('C').error, /could not be loaded/);
  render('C').reload(); render('C');
  request[3].resolve({ data: { gate_in_at: gate }, error: null }); await new Promise(setImmediate);
  assert.equal(render('C').validate(valid), null);
  cleanup?.();
  console.log('Billing date bounds passed: April rejection, inclusive Gate In/current-time limits, IST minute precision, independent event order, failed/missing lookup, stale vehicle reads, retry, saved history, Paid verification, and blocked save with popup/no RPC.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
