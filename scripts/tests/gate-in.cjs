const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const root = require('path').resolve(__dirname, '../..') + '/';
const ts = require(root + 'node_modules/typescript');
const compile = value => ts.transpileModule(value,{compilerOptions:{target:7,module:1}}).outputText;
const exportsObject = {};
vm.runInNewContext(compile(fs.readFileSync(root+'src/lib/vehicle-registration.ts','utf8')),{exports:exportsObject});
const {getVehicleNumberError,normalizeVehicleNumber}=exportsObject;
const now=new Date('2026-10-08T08:00:00Z');
const valid=['MH12AB1234','mh 12 ab 1234','MH-12-AB-1234','DL1CAA1234','DL2C1','MH12A7','TG09AB1234','TS09AB1234','OR02AB1234','OD02AB1234','UA07AB1234','UK07AB1234','LA02AB1234','MH121234','21BH0001A','26BH1234AA'];
const invalid=['','1234','AB12CD1234','MH00AB1234','MH12AB0000','MH12AB12345','MH12AB12@34','MH12AB12/34','20BH1234AA','27BH1234AA','26BH0000AA','26BH1234IO','26BH1234AAA','MH12ABCD1234'];
for(const number of valid) assert.equal(getVehicleNumberError(number,now),null,number);
for(const number of invalid) assert.equal(typeof getVehicleNumberError(number,now),'string',number);
assert.equal(normalizeVehicleNumber(' mh-12 ab 1234 '),'MH12AB1234');
assert.equal(normalizeVehicleNumber('MH12AB@1234'),'MH12AB@1234');
const source=fs.readFileSync(root+'src/app/(tabs)/watchman/gate-in.tsx','utf8');
const tree=ts.createSourceFile('gate-in.tsx',source,99,true,ts.ScriptKind.TSX);
function snippet(name) {let found;function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text===name)found=node.getText(tree);ts.forEachChild(node,visit);}visit(tree);assert(found,name);return found;}
function harness({number='mh 12 ab 1234',photo=true,pending=null,uploadFails=false}={}) {
 const notices=[],calls=[],uploads=[];let saved=pending,error='',submitting=false;
 const ref={current:false};
 const scope={vehicleNo:number,photo:photo?{uri:'camera://image'}:null,pendingGateIn:pending,submittingRef:ref,
  normalizeVehicleNumber,getVehicleNumberError:value=>getVehicleNumberError(value,now),
  setVehicleError:value=>{error=value;},showModal:(...args)=>notices.push(args),
  Keyboard:{dismiss:()=>{}},setSubmitting:value=>{submitting=value;},
  createStoragePath:()=> 'gate-in-pending/test.jpg',setPendingGateIn:value=>{saved=value;},
  uploadPhoto:async(...args)=>{uploads.push(args);if(uploadFails)throw Error('network failure');},
  supabase:{rpc:async(name,payload)=>{calls.push({name,payload});return {data:{vehicle_id:'v',visit_id:'visit',gate_entry_id:'entry',gate_in_photo_id:'photo'},error:null};}},
  console:{error:()=>{}}};
 vm.createContext(scope);vm.runInContext(compile(snippet('validateForm')+'\n'+snippet('handleGateIn')),scope);
 return {scope,notices,calls,uploads,ref,get saved(){return saved;},get error(){return error;},get submitting(){return submitting;}};
}
(async()=>{
 let h=harness({number:'wrong'});await h.scope.handleGateIn();assert.equal(h.calls.length,0);assert(h.error);assert.equal(h.notices[0][0],'Check vehicle number');
 h=harness({photo:false});await h.scope.handleGateIn();assert.equal(h.calls.length,0);assert.equal(h.notices[0][0],'Vehicle Photo Required');
 h=harness();await Promise.all([h.scope.handleGateIn(),h.scope.handleGateIn()]);assert.equal(h.calls.length,1);assert.equal(h.calls[0].payload.p_vehicle_no,'MH12AB1234');assert.equal(h.uploads.length,1);assert.equal(h.notices[0][2],true);assert.equal(h.ref.current,false);
 h=harness({uploadFails:true});await h.scope.handleGateIn();assert(h.saved);assert.equal(h.notices[0][0],'Photo Upload Failed');assert.equal(h.notices[0][2],false);assert.equal(h.submitting,false);
 const pending=h.saved;
 h=harness({pending});await h.scope.handleGateIn();assert.equal(h.calls.length,0);assert.equal(h.uploads[0][1],pending.storagePath);assert.equal(h.notices[0][2],true);
 h=harness({pending,uploadFails:true});await h.scope.handleGateIn();assert.equal(h.calls.length,0);assert.equal(h.saved,pending);assert.equal(h.notices[0][0],'Photo Upload Failed');
 // Confirm the only Gate In RPC still has the same arguments and no new write calls.
 const rpc=source.match(/await supabase\.rpc\([\s\S]*?\n      \);/)[0];
 assert(rpc.includes('"new_workflow_gate_in"'));
 for(const key of ['p_vehicle_no','p_gate_in_photo_path','p_remarks'])assert(rpc.includes(key));
 assert.equal((source.match(/await supabase\.rpc\(/g)||[]).length,1);
 assert(source.includes('<View style={styles.topBar}>\n          <BackButton'));
 assert(source.includes('disabled={submitting} />\n          <BrandPill />'));
 console.log(`${valid.length+invalid.length+2} registration cases and 6 Gate In validation/save/retry/concurrency scenarios passed; header alignment and RPC arguments checked.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
