const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
function method(file,name){const s=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let code;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(s)===name)code=n.initializer.getText(s);ts.forEachChild(n,visit);}visit(s);assert.ok(code);return code;}
function run(code,scope){return vm.runInNewContext(ts.transpileModule('('+code+')',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,scope);}
const watcher=method('src/app/(tabs)/watchman/vehicles.tsx','confirmAssignment');
const floor=method('src/app/(tabs)/vehicle-detail.tsx','handleAssignFloorIncharge');
function test(code,result,isFloor=false){const calls=[],messages=[],scope={assignmentBusy:{current:false},floorAssignmentBusy:{current:false},selectedVisit:{id:'visit',vehicle_id:'vehicle'},selectedAdvisor:{id:'advisor',name:'Advisor'},remarks:'',profile:{id:'watchman'},vehicleId:'vehicle',surveyJob:{id:'job'},selectedFloorInchargeId:'floor',canAssignFloorIncharge:true,console:{log(){},error(){}},getVehicle:()=>({vehicle_no:'MH12AB1234'}),loadCurrentVehicles:async()=>{},loadAssignments:async()=>{},loadVehicle:async()=>{},showPopup:(...a)=>messages.push(a),showModal:(...a)=>messages.push(a)};
 for(const n of ['setAssigning','setShowConfirmModal','setSelectedVisit','setSelectedAdvisor','setRemarks','setAssigningFloorIncharge'])scope[n]=()=>{};
 scope.supabase={rpc:async(name,args)=>{calls.push({name,args});return result;}};
 return {scope,calls,messages,save:run(code,scope)};}
(async()=>{
 for(const [code,isFloor] of [[watcher,false],[floor,true]]){
  let t=test(code,{data:{success:true},error:null},isFloor);await t.save();assert.equal(t.calls.length,1);assert.match(t.messages[0][isFloor?0:1],/Assigned/);
  t=test(code,{data:null,error:null},isFloor);await t.save();assert.match(t.messages[0].join(' '),/could not be confirmed/);
  t=test(code,{data:null,error:{message:'Vehicle moved'}},isFloor);await t.save();assert.match(t.messages[0].join(' '),/Vehicle moved/);
  t=test(code,{data:{success:true},error:null},isFloor);t.scope[isFloor?'floorAssignmentBusy':'assignmentBusy'].current=true;await t.save();assert.equal(t.calls.length,0);
  t=test(code,{data:{success:true},error:null},isFloor);let release;t.scope.supabase.rpc=async()=>{t.calls.push('rpc');await new Promise(r=>release=r);return {data:{success:true},error:null};};const pending=t.save();await t.save();assert.equal(t.calls.length,1);release();await pending;
 }
 const t=test(floor,{data:{success:true},error:null},true);t.scope.canAssignFloorIncharge=false;await t.save();assert.equal(t.calls.length,0);assert.match(t.messages[0].join(' '),/Permission Denied/);
 console.log('Assignment screen checks passed: confirmed save, uncertain save, server failure, unauthorized Floor action and duplicate submissions.');
})().catch(e=>{console.error(e);process.exitCode=1;});
