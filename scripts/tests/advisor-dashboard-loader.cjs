process.chdir(require("node:path").resolve(__dirname, "../.."));
const fs = require('fs'), vm = require('vm'), assert = require('assert/strict'), ts = require('typescript');
const compile = s => ts.transpileModule(s, { compilerOptions: { target: 7, module: 1 } }).outputText;
const helpers = {};
vm.runInNewContext(compile(fs.readFileSync('src/lib/advisor-dashboard-counts.ts', 'utf8')), { exports: helpers });
const source = fs.readFileSync('src/app/(tabs)/advisor/index.tsx', 'utf8'), ast = ts.createSourceFile('index.tsx', source, 99, true, 4);
let callback;
function visit(n) { if (ts.isVariableDeclaration(n) && n.name.getText(ast) === 'loadDashboardCounts')
    callback = n.initializer.arguments[0].getText(ast); ts.forEachChild(n, visit); }
visit(ast);
assert.ok(callback);
const visits = [{ id: 'mine', current_stage: 'PENDING_SURVEY', current_status: 'PENDING', current_assigned_to: 'me', closed_at: null }, { id: 'other', current_stage: 'PENDING_SURVEY', current_status: 'PENDING', current_assigned_to: 'other', closed_at: null }, { id: 'floor', current_stage: 'FLOOR', current_status: 'PENDING', current_assigned_to: 'floor-user', closed_at: null }];
function setup(role) {
    const queries = [], events = { counts: [], errors: [] }, scope = { ...helpers, dashboardRequest: { current: 0 }, router: { replace: () => { } }, console: { error: () => { } }, setRefreshing: () => { }, setCountError: value => events.errors.push(value), setCounts: value => events.counts.push(value), setIsCeoAdmin: value => events.admin = value };
    const uid = role === 'advisor' ? 'me' : 'admin';
    scope.supabase = { auth: { getUser: async () => ({ data: { user: { id: uid } }, error: null }) }, from: table => {
            const filters = [];
            const q = { select: () => q, eq: (key, value) => { filters.push([key, value]); return q; }, is: (key, value) => { filters.push([key, value]); return q; }, not: () => q, in: (key, value) => { filters.push([key, value]); return q; }, order: () => q, single: async () => ({ data: { role, is_active: true }, error: null }), range: async () => {
                    queries.push({ table, filters });
                    let data = table === 'vehicle_assignments' ? [{ visit_id: 'mine', assigned_to: 'me', assignment_role: 'ADVISOR', unassigned_at: null }] : visits;
                    if (table === 'workshop_visits' && role === 'advisor')
                        assert.ok(filters.some(([key]) => ['current_assigned_to', 'id'].includes(key)), 'Unscoped Advisor visit query');
                    for (const [key, value] of filters)
                        data = data.filter(row => Array.isArray(value) ? value.includes(row[key]) : row[key] === value);
                    return { data, error: null };
                } };
            return q;
        }, rpc: async (name, args) => ({ error: null, data: { role, items: args?.p_floor && role === 'ceo_admin' ? [{ visit_id: 'floor', current_status: 'PENDING' }] : [] } }) };
    const fn = vm.runInNewContext(compile('(' + callback + ')'), scope);
    return { fn, scope, events, queries };
}
(async () => {
    let t = setup('advisor');
    await t.fn();
    const counts = t.events.counts.at(-1);
    assert.equal(counts.SURVEY, 1);
    for (const [key, value] of Object.entries(counts))
        if (key !== 'SURVEY')
            assert.equal(value, 0, key);
    assert.ok(t.queries.find(q => q.table === 'vehicle_assignments'));
    assert.equal(t.events.admin, false);
    t = setup('ceo_admin');
    await t.fn();
    assert.equal(t.events.counts.at(-1).SURVEY, 2);
    assert.equal(t.events.counts.at(-1).FLOOR, 1);
    assert.equal(t.events.admin, true);
    assert.ok(!t.queries.some(q => q.table === 'vehicle_assignments'));
    t = setup('advisor');
    t.scope.supabase.rpc = async () => ({ error: new Error('Queue unavailable'), data: null });
    await t.fn();
    assert.equal(t.events.counts.at(-1), null);
    assert.equal(t.events.errors.at(-1), true);
    t = setup('advisor');
    let release;
    t.scope.supabase.auth.getUser = () => new Promise(resolve => release = resolve);
    const pending = t.fn();
    t.scope.dashboardRequest.current++;
    release({ data: { user: { id: 'me' } }, error: null });
    await pending;
    assert.equal(t.events.counts.at(-1), null);
    console.log('Dashboard loader checks passed: scoped Advisor queries, all Admin visits, queue failures, and stale-response protection.');
})().catch(error => { console.error(error); process.exitCode = 1; });
