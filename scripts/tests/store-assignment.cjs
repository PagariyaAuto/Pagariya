const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict'), ts=require('typescript');
function method(file,name) {
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let result;
 function visit(n) { if(ts.isVariableDeclaration(n)&&n.name.getText(source)===name) result=ts.isCallExpression(n.initializer)?n.initializer.arguments[0].getText(source):n.initializer.getText(source); ts.forEachChild(n,visit); }
 visit(source); assert.ok(result,`${name} exists`); return result;
}
const compile=code=>ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
const queueCode=method('src/app/(tabs)/store/index.tsx','loadData');
const detailCode=method('src/app/(tabs)/store/vehicle-action.tsx','loadData');
const assignCode=method('src/components/store/StoreAssignmentControl.tsx','save');
function queue(role='store_team',active=true,failed=false) {
 const queries=[], vehicles=[{id:'mine',current_assigned_to:'store1',current_stage:'STORE',current_status:'PENDING'}, {id:'other',current_assigned_to:'store2',current_stage:'STORE',current_status:'PENDING'}];
 const scope={ profile:null, items:[{stale:true}], selectedItem:{stale:true}, profileResult:null,
   supplementaryRequirements:async()=>new Map(), requirementView:()=>null, console:{error:()=>{}}, showPopup:()=>{}, closePopup:()=>{} };
 function builder(table) {
  queries.push(table); const filters=[];
  const q={select:()=>q,eq:(k,v)=>{filters.push(x=>x[k]===v);return q;},in:(k,vs)=>{filters.push(x=>vs.includes(x[k]));return q;},order:()=>q,
   single:async()=>({data:{id:'store1',role,is_active:active},error:null}),
   then:(resolve,reject)=>Promise.resolve({data:table==='vehicles'?vehicles.filter(x=>filters.every(f=>f(x))):[],error:failed&&table==='vehicles'?new Error('Load failed'):null}).then(resolve,reject)};
  return q;
 }
 scope.supabase={auth:{getUser:async()=>({data:{user:{id:'store1'}},error:null})},from:builder};
 for(const [setter,key] of Object.entries({setLoading:'loading',setRefreshing:'refreshing',setItems:'items',setSelectedItem:'selectedItem',setProfile:'profile'}))scope[setter]=v=>scope[key]=v;
 return {scope,queries,load:vm.runInNewContext(compile(`(${queueCode})`),scope)};
}
function assignment(result) {
 const calls=[],scope={visit:{id:'visit1',current_assigned_to:'store1'},selected:'store2',busy:{current:false},onAssigned:()=>calls.push('refresh')};
 for(const [setter,key] of Object.entries({setSaving:'saving',setError:'error',setOpen:'open'}))scope[setter]=v=>scope[key]=v;
 scope.supabase={rpc:async(name,args)=>{calls.push({name,args});return result;}};
 return {scope,calls,save:vm.runInNewContext(compile(`(${assignCode})`),scope)};
}
(async()=>{
 let t=queue(); await t.load(); assert.deepEqual(Array.from(t.scope.items,x=>x.vehicle.id),['mine']);
 t=queue('ceo_admin');await t.load();assert.equal(t.scope.items.length,2);
 for(const [role,active] of [['store_team',false],['advisor',true]]) {t=queue(role,active);await t.load();assert.equal(t.scope.items.length,0);assert.equal(t.scope.selectedItem,null);assert.ok(!t.queries.includes('vehicles'));}
 t=queue('store_team',true,true);await t.load();assert.equal(t.scope.items.length,0);assert.equal(t.scope.selectedItem,null);
 t=assignment({data:{success:true},error:null});await t.save();assert.equal(t.calls[0].name,'new_workflow_assign_store');assert.equal(t.calls[0].args.p_expected_assigned_to,'store1');assert.equal(t.calls[0].args.p_store_incharge_id,'store2');assert.equal(t.calls[1],'refresh');assert.equal(t.scope.open,false);
 t=assignment({data:null,error:{message:'The assignment has changed. Refresh and try again.'}});await t.save();assert.equal(t.calls.length,1);assert.match(t.scope.error,/assignment has changed/);assert.equal(t.scope.busy.current,false);
 t=assignment({data:{success:false},error:null});await t.save();assert.equal(t.calls.length,1);assert.match(t.scope.error,/could not be confirmed/);
 t=assignment({data:{success:true},error:null});t.scope.busy.current=true;await t.save();assert.equal(t.calls.length,0);
 // Screen guards stay connected to the same ownership filter used by the queue.
 assert.match(detailCode,/vehicleQuery\.eq\("current_assigned_to", userId\)/);
 assert.match(detailCode,/setVehicle\(null\)/);
 assert.match(detailCode,/setLoadError\(getErrorMessage\(error\)\)/);
 for(const file of ['src/app/(tabs)/advisor/advisor_work_form.tsx','src/components/SupplementaryWorkspace.tsx']) {
  const code=fs.readFileSync(file,'utf8');assert.match(code,/<StoreInchargePicker/);assert.match(code,/p_store_incharge_id: (needsParts \? )?selectedStoreInchargeId/);
 }
 console.log('Store UI checks passed: assigned queue/count scope, Admin scope, inactive/unauthorized/error clearing, reassignment payload/stale errors/confirmed success/double tap, and handover/direct-link integration.');
})().catch(e=>{console.error(e);process.exitCode=1;});
