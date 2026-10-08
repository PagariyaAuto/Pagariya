const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),ts=require('typescript');
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:7,module:1}}).outputText;
function exported(file,imports={}) { const exports={}; vm.runInNewContext(compile(fs.readFileSync(file,'utf8')),{exports,Date,require:key=>imports[key]}); return exports; }
const dt=exported('src/lib/date-time.ts'), visit=exported('src/lib/visit-date-time.ts',{'./date-time':dt});
function get(file,name){const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),99,true,4);let found;function walk(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)===name){const init=n.initializer;found=ts.isCallExpression(init)&&init.expression.getText(ast)==='useCallback'?init.arguments[0].getText(ast):init.getText(ast);}ts.forEachChild(n,walk);}walk(ast);assert.ok(found,name);return compile('('+found+')');}
const gate='2026-10-07T09:38:14.789Z', invalid=new Date('2026-04-01T10:00:00Z'), valid=new Date('2026-10-07T10:00:00Z');
const validate=value=>visit.validateVisitDateTime(value instanceof Date?value.toISOString():value,gate);
const advisor='src/app/(tabs)/advisor/', store='src/app/(tabs)/store/vehicle-action.tsx', supp='src/components/SupplementaryWorkspace.tsx', billing='src/components/billing/BillingWorkspace.tsx';
let checks=0;
async function main(){
 for(const [file,name,date,extra] of [
  [advisor+'survey_form.tsx','validateForm','surveyCompletedAt',{approvalStatus:'PENDING',markInvalid:(_field,error)=>error}],
  [advisor+'approval_form.tsx','validateBeforeSubmit','decisionAt',{}],
  [advisor+'advisor_work_form.tsx','validateForm','requisitionAt',{loading:false,saving:false,loadError:'',vehicle:{},needsParts:true}],
  ...['CreateOrder','ReceiveParts','Handover'].map((name,i)=>[store,'confirm'+name,['orderedAt','receivedAt','handoverAt'][i],{}]),
  ...['CreateOrder','ReceiveParts','Handover'].map((name,i)=>[store,'submit'+name,['orderedAt','receivedAt','handoverAt'][i],{handoverBusy:{current:false},savingRef:{current:false},handoverCompleted:{current:false}}]),
 ]) {
  const notices=[];const scope={...extra,[date]:invalid,dateValidation:{getError:()=>undefined},visitDates:{validate},showPopup:(...args)=>notices.push(args),supabase:{rpc:()=>{throw Error('Invalid date reached RPC');}}};
  const result=await vm.runInNewContext(get(file,name),scope)();
  if(name==='validateForm'&&date==='surveyCompletedAt')assert.match(result,/Gate In/);else assert.equal(notices.length,1,file+' '+name);
  checks++;
 }
 const scope={dateValidation:{getError:()=>undefined},visitDates:{validate},surveyCompletedAt:valid,approvalReceivedAt:invalid,approvalStatus:'RECEIVED',markInvalid:(field,error)=>({field,error})};
 const received=vm.runInNewContext(get(advisor+'survey_form.tsx','validateForm'),scope)();
 assert.equal(received.field,'approvalDate');assert.match(received.error,/Gate In/);checks++;
 const actionDateError=vm.runInNewContext(get(supp,'actionDateError'),{visitDates:{validate}});
 for(const key of ['p_survey_at','p_decision_at','p_requisition_at']){
  assert.match(actionDateError({[key]:invalid.toISOString()}),/Gate In/);assert.equal(actionDateError({[key]:valid.toISOString()}),null);checks++;
 }
 assert.equal(actionDateError({p_remarks:'No editable timestamp'}),null);
 let message;const perform=vm.runInNewContext(get(supp,'perform'),{item:{visit_id:'visit'},submitting:{current:false},loading:false,error:'',setBusy:()=>{},actionDateError,setMessage:m=>{message=m;},fetchQueue:()=>{throw Error('Must not load/upload/save invalid date');}});
 await perform('operation',{p_survey_at:invalid.toISOString()});assert.match(message.body,/Gate In/);checks++;
 for(const changes of [
  {generated:true,generatedTime:invalid.toISOString(),sent:false},
  {generated:false,sent:true,sentTime:invalid.toISOString()},
 ]){
  const fn=vm.runInNewContext(get(billing,'saveInvoice'),{selected:{visit_id:'visit'},...changes,visitDates:{validate},parseTime:v=>v,run:fn=>fn()});
  await assert.rejects(fn(),/Gate In/);checks++;
 }
 const record=vm.runInNewContext(get(billing,'recordPayment'),{selected:{visit_id:'visit',amount_due:100},pendingPayment:{current:null},paymentAmount:'50',paymentTime:invalid.toISOString(),amount:Number,parseTime:v=>v,visitDates:{validate},run:fn=>fn()});
 await assert.rejects(record(),/Gate In/);checks++;
 // Recorded invoice timestamps and payment retries must bypass new-entry validation.
 const sentinel='Reached original RPC';
 const saved=vm.runInNewContext(get(billing,'saveInvoice'),{selected:{visit_id:'visit',job_type:'PAID',generated_at:invalid.toISOString(),sent_at:invalid.toISOString()},generated:true,sent:true,invoiceAmount:'50',amount:Number,bill:'B1',invoice:'I1',visitDates:{validate:()=>{throw Error('Saved history revalidated');}},supabase:{rpc:()=>{throw Error(sentinel);}},run:fn=>fn()});
 await assert.rejects(saved(),new RegExp(sentinel));checks++;
 const retry=vm.runInNewContext(get(billing,'recordPayment'),{selected:{visit_id:'visit'},pendingPayment:{current:{id:'id',payload:{p_payment_at:invalid.toISOString()}}},visitDates:{validate:()=>{throw Error('Retry revalidated');}},supabase:{rpc:()=>{throw Error(sentinel);}},run:fn=>fn()});
 await assert.rejects(retry(),new RegExp(sentinel));checks++;
 // Every workflow picker call has bounds; shared wrappers receive caller bounds.
 for(const file of [advisor+'survey_form.tsx',advisor+'approval_form.tsx',advisor+'advisor_work_form.tsx',store,supp,'components/workflow/SurveyForm.tsx']){
  const source=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,source,99,true,4);
  function walk(n){if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){const tag=n.tagName.getText(ast);if(['DateValueField','DateTimeField'].includes(tag))assert.match(n.getText(ast),/visitDates.bounds/);}ts.forEachChild(n,walk);}walk(ast);checks++;
 }
 console.log(checks+' project date rollout checks passed: real form/Store/Supplementary/Billing save guards, hidden timestamp-free actions, saved invoice history, payment retries and picker coverage.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
