const fs = require('fs'), vm = require('vm'), assert = require('assert/strict'), ts = require('typescript');
const root = '', compile = s => ts.transpileModule(s, { compilerOptions: { target: 7, module: 1 } }).outputText;
const hook = {};
vm.runInNewContext(compile(fs.readFileSync(root + 'src/components/inputs/useDateTimeValidation.ts', 'utf8')), { exports: hook, require: () => ({ useRef: current => ({ current }), useCallback: fn => fn }) });
const validation = hook.default();
assert.equal(validation.field('a'), validation.field('a'));
validation.field('a')('Invalid A');
validation.field('b')('Invalid B');
validation.field('a')(null);
assert.equal(validation.getError(), 'Invalid B');
validation.field('b')(null);
assert.equal(validation.getError(), undefined);
function snippet(file, name) { const text = fs.readFileSync(root + file, 'utf8'), a = ts.createSourceFile(file, text, 99, true, 4); let out; function walk(n) { if (ts.isVariableDeclaration(n) && n.name.getText(a) === name)
    out = n.initializer.getText(a); ts.forEachChild(n, walk); } walk(a); assert.ok(out, file + ' ' + name); return out; }
let checks = 1;
for (const [file, name, expected] of [
    ['src/app/(tabs)/advisor/survey_form.tsx', 'validateForm', 'Bad selection'],
    ['src/app/(tabs)/advisor/approval_form.tsx', 'validateBeforeSubmit', false],
    ['src/app/(tabs)/advisor/advisor_work_form.tsx', 'validateForm', false],
    ['src/app/(tabs)/store/vehicle-action.tsx', 'confirmCreateOrder', undefined],
    ['src/app/(tabs)/store/vehicle-action.tsx', 'confirmReceiveParts', undefined],
    ['src/app/(tabs)/store/vehicle-action.tsx', 'confirmHandover', undefined],
    ['src/components/SupplementaryWorkspace.tsx', 'confirm', undefined],
    ['src/app/(tabs)/advisor/billing.tsx', 'values', 'throws']
]) {
    const popups = [];
    const scope = { dateErrors: { current: { surveyDate: 'Bad selection' } }, markInvalid: (_field, message) => message, dateValidation: { getError: () => 'Bad selection' }, showPopup: (...args) => popups.push(args), setMessage: msg => popups.push(msg) };
    const fn = vm.runInNewContext(compile('(' + snippet(file, name) + ')'), scope);
    if (expected === 'throws')
        assert.throws(() => fn(), /Bad selection/);
    else
        assert.equal(fn(), expected);
    if (expected !== 'Bad selection' && expected !== 'throws')
        assert.equal(popups.length, 1);
    checks++;
}
console.log(`${checks} rejected-date guard scenarios passed: independent fields, correction, Survey, Approval, Advisor Work, all Store actions, Supplementary and Advisor Billing.`);

// Survey errors identify the control to reveal after the popup closes.
const surveyFile = 'src/app/(tabs)/advisor/survey_form.tsx';
const surveyScope = {
  visitDates: { validate: () => null }, surveyCompletedAt: new Date(), approvalReceivedAt: new Date(),
  dateValidation: { getError: () => undefined }, dateErrors: { current: {} },
  approvalStatus: 'PENDING', workTypesLoading: false, workTypesError: '',
  workTypes: [{ id: 'strip', code: 'STRIPPING', is_active: true }],
  selectedWorkTypeIds: ['strip'], isInsurance: false, isPaid: true,
  vehicle: {}, visitId: 'visit', vehicleId: 'vehicle', insuranceType: 'PAID',
  paidAmount: '2500', receiptReferenceNo: 'REF-01',
};
for (const [changes, expected] of [
  [{ paidAmount: '' }, 'amount'],
  [{ paidAmount: 'invalid' }, 'amount'],
  [{ paidAmount: '-1' }, 'amount'],
  [{ receiptReferenceNo: '' }, 'receipt'],
  [{ approvalStatus: 'RECEIVED', selectedWorkTypeIds: [] }, 'work'],
  [{ approvalStatus: 'RECEIVED', isInsurance: true, isPaid: false, selectedWorkTypeIds: [] }, 'work'],
  [{ dateValidation: { getError: () => 'Invalid survey' }, dateErrors: { current: { surveyDate: 'Invalid survey' } } }, 'surveyDate'],
  [{ dateValidation: { getError: () => 'Invalid approval' }, dateErrors: { current: { approvalDate: 'Invalid approval' } } }, 'approvalDate'],
]) {
  let field;
  const scope = { ...surveyScope, ...changes, markInvalid: (key, message) => { field = key; return message; } };
  const fn = vm.runInNewContext(compile('(' + snippet(surveyFile, 'validateForm') + ')'), scope);
  assert.equal(typeof fn(), 'string');
  assert.equal(field, expected);
  assert.equal(scope.vehicleId, 'vehicle');
  checks++;
}
let marked;
const pendingErrorField = { current: null };
const mark = vm.runInNewContext(compile('(' + snippet(surveyFile, 'markInvalid') + ')'), { pendingErrorField, setFieldError: value => { marked = value; } });
assert.equal(mark('photo', 'Add a photo'), 'Add a photo');
assert.equal(pendingErrorField.current, 'photo');
assert.equal(marked.field, 'photo');
let cleared = false, dismissed = false, scrolled;
const close = vm.runInNewContext(compile('(' + snippet(surveyFile, 'closePopup') + ')'), {
  INITIAL_POPUP: {}, setPopup: () => { cleared = true; }, pendingErrorField,
  Keyboard: { dismiss: () => { dismissed = true; } }, requestAnimationFrame: fn => fn(),
  fieldViews: { current: { photo: { measureInWindow: fn => fn(0, 500) } } },
  viewportRef: { current: { measureInWindow: fn => fn(0, 20) } },
  scrollRef: { current: { scrollTo: value => { scrolled = value; } } }, scrollOffset: { current: 100 },
});
close();
assert(cleared && dismissed);
assert.equal(scrolled.y, 560);
assert.equal(pendingErrorField.current, null);
console.log('10 Survey field-target and popup-scroll checks passed.');
