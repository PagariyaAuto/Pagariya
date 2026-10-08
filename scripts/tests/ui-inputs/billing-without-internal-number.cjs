const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),ts=require('typescript');
const file='src/components/billing/BillingWorkspace.tsx',source=fs.readFileSync(file,'utf8');
function code(file,name){const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),99,true,4);let code;function walk(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)===name)code=n.initializer.getText(ast);if(ts.isFunctionDeclaration(n)&&n.name?.text===name)code=n.getText(ast);ts.forEachChild(n,walk);}walk(ast);assert.ok(code);return ts.transpileModule('('+code+')',{compilerOptions:{target:7}}).outputText;}
async function main(){
 for(const job of ['PAID','INSURANCE'])for(const generated of [false,true]){
  const calls=[],scope={selected:{visit_id:'visit',job_type:job},generated,sent:false,generatedTime:'2026-10-08T10:00:00Z',invoice:'INV-1',invoiceAmount:'100',liability:'60',visitDates:{validate:()=>null},parseTime:v=>v,amount:Number,run:fn=>fn(),supabase:{rpc:(name,args)=>{calls.push({name,args});throw Error('captured');}}};
  const fn=vm.runInNewContext(code(file,'saveInvoice'),scope);
  await assert.rejects(fn(),/captured/);
  assert.equal(calls.length,1);assert.equal('bill_no' in calls[0].args.p_data,false);assert.equal(calls[0].args.p_data.tax_invoice_no,'INV-1');
  if(generated){scope.invoice='';await assert.rejects(fn(),/Enter the tax invoice number/);assert.equal(calls.length,1);}
 }
 const ready='src/app/(tabs)/advisor/ready-for-delivery.tsx';
 const blockers=vm.runInNewContext(code(ready,'blockers'),{});
 const base={billing_completed_at:'date',tax_invoice_no:'INV-1',generated_at:'date',inspection_result:'PASSED',customer_balance:0};
 assert.equal(blockers({...base,job_type:'PAID'}).length,0);
 assert.equal(blockers({...base,job_type:'INSURANCE',sent_at:'date'}).length,0);
 assert.equal(blockers({...base,job_type:'INSURANCE'}).length,1);
 assert.equal(blockers({...base,job_type:'PAID',tax_invoice_no:null}).length,1);
 assert.equal(blockers({...base,job_type:'PAID',customer_balance:1}).length,1);
 for(const file of ['src/components/billing/BillingWorkspace.tsx',ready,'src/app/(tabs)/advisor/billing.tsx','src/app/(tabs)/index.tsx'])assert.doesNotMatch(fs.readFileSync(file,'utf8'),/Internal Bill No|internal Bill No|bill_no|setBill\(/);
 assert.match(source,/Balance after Survey advance/);assert.match(source,/Customer difference/);
 console.log('Billing without Internal Bill No passed: Paid/Insurance draft and generation payloads, mandatory tax invoice, delivery blockers and obsolete-field removal.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
