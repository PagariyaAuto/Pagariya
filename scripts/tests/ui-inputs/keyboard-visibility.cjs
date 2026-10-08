const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),ts=require('typescript');
const root='src/components/inputs/';
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:7,module:1,jsx:4}}).outputText;
const geometry={};vm.runInNewContext(compile(fs.readFileSync(root+'keyboard-visibility.ts','utf8')),{exports:geometry});
const delta=geometry.keyboardRevealDelta;
assert.equal(delta({top:200,bottom:250},{top:100,bottom:500}),0);
assert.equal(delta({top:440,bottom:490},{top:100,bottom:500}),0);
assert.equal(delta({top:480,bottom:530},{top:100,bottom:500}),42);
assert.equal(delta({top:80,bottom:130},{top:100,bottom:500}),-32);
assert.equal(delta({top:100,bottom:600},{top:100,bottom:500}),0);
assert.equal(delta({top:90,bottom:180},{top:100,bottom:100}),0);
const nearFull={top:110,bottom:508};const movement=delta(nearFull,{top:100,bottom:500});
assert.equal(delta({top:nearFull.top-movement,bottom:nearFull.bottom-movement},{top:100,bottom:500}),0);

function harness(os='android',{avoiding=false,automaticInsets,keyboard=true}={}) {
 const nodes=[],contexts=[],listeners={},cleanups=[],frames=new Map(),instances=[],effects=[];
 const measurements=[],calls=[];let nextFrame=0,activeInstance,hookIndex=0;
 let viewport={top:50,bottom:600},metrics=keyboard?{screenY:600,height:300,screenX:0,width:400}:undefined;
 let currentOffset=100,active=true,layoutCalls=0,scrollEvents=0,contentEvents=0;
 let dimensionHandler;
 const visualHandlers={};const visual={offsetTop:0,height:600,addEventListener:(e,fn)=>{visualHandlers[e]=fn;},removeEventListener:e=>{delete visualHandlers[e];}};
 const jsx=(type,props)=>{const node={type,props};nodes.push(node);return node;};
 const react={
  createContext:value=>{const c={value,Provider:'Provider'+contexts.length};contexts.push(c);return c;},
  useContext:c=>c.value,forwardRef:fn=>fn,
  useRef:value=>{const i=hookIndex++;return activeInstance.hooks[i]??=( {current:value} );},
  useState:value=>{const i=hookIndex++,instance=activeInstance;if(!(i in instance.hooks))instance.hooks[i]=value;return [instance.hooks[i],next=>{const result=typeof next==='function'?next(instance.hooks[i]):next;if(!Object.is(result,instance.hooks[i])){instance.hooks[i]=result;instance.dirty=true;}}];},
  useEffect:(fn,deps)=>{const i=hookIndex++,instance=activeInstance,previous=instance.hooks[i];if(!previous||deps.some((d,n)=>!Object.is(d,previous.deps[n]))){instance.hooks[i]={deps};effects.push(()=>{previous?.cleanup?.();const cleanup=fn();instance.hooks[i].cleanup=cleanup;if(cleanup)cleanups.push(cleanup);});}},
 };
 const native={Platform:{OS:os},Keyboard:{metrics:()=>metrics,addListener:(event,fn)=>{listeners[event]=fn;return {remove:()=>{delete listeners[event];}};}},Dimensions:{addEventListener:(_event,fn)=>{dimensionHandler=fn;return {remove:()=>{dimensionHandler=null;}};}},View:'View',ScrollView:'ScrollView',TextInput:'TextInput',KeyboardAvoidingView:'KAV',Modal:'Modal'};
 const moduleOut={};
 vm.runInNewContext(compile(fs.readFileSync(root+'KeyboardAware.tsx','utf8')),{exports:moduleOut,window:{visualViewport:visual,innerHeight:900},require:name=>name==='react'?react:name==='react/jsx-runtime'?{jsx,jsxs:jsx}:name==='react-native'?native:name.includes('keyboard-visibility')?geometry:name.includes('keyboard-focus')?{registerInput(){},unregisterInput(){}}:{__esModule:true,default:'Boundary'},requestAnimationFrame:fn=>{frames.set(++nextFrame,fn);return nextFrame;},cancelAnimationFrame:id=>frames.delete(id)});
 contexts[1].value=avoiding;
 function render(instance){activeInstance=instance;hookIndex=0;instance.dirty=false;nodes.length=0;instance.result=instance.component(instance.props,instance.ref);instance.nodes=[...nodes];}
 function mount(component,props,ref){const instance={component,props,ref,hooks:[],dirty:false};instances.push(instance);render(instance);return instance;}
 const externalRef={current:null};
 const owner=mount(moduleOut.ScrollView,{children:'form',automaticallyAdjustKeyboardInsets:automaticInsets,onLayout:()=>layoutCalls++,onScroll:()=>scrollEvents++,onContentSizeChange:()=>contentEvents++},externalRef);
 function scrollNode(){return owner.nodes.find(n=>n.type==='ScrollView');}
 const container={getBoundingClientRect:()=>({...viewport,height:viewport.bottom-viewport.top}),get scrollTop(){return currentOffset;}};
 const scroll={getNativeScrollRef:()=>({measureInWindow:fn=>measurements.push(()=>fn(0,viewport.top,400,viewport.bottom-viewport.top))}),getScrollableNode:()=>container,scrollTo:value=>{calls.push(value);const movement=value.y-currentOffset;currentOffset=value.y;for(const item of inputs){item.top-=movement;item.bottom-=movement;}scrollNode().props.onScroll({nativeEvent:{contentOffset:{y:currentOffset}}});}};
 const inputs=[];
 scrollNode().props.ref(scroll);
 scrollNode().props.onScroll({nativeEvent:{contentOffset:{y:currentOffset}}});
 contexts[0].value=owner.nodes.find(n=>n.type===contexts[0].Provider).props.value;
 function input(top,bottom){let focused=true,focusCalls=0,blurCalls=0,selectionCalls=0,sizeCalls=0;
  const ref={current:null};
  const instance=mount(moduleOut.TextInput,{value:'keep this text',onFocus:()=>focusCalls++,onBlur:()=>blurCalls++,onSelectionChange:()=>selectionCalls++,onContentSizeChange:()=>sizeCalls++},ref);
  const node=instance.nodes.find(n=>n.type==='TextInput');
  const host={top,bottom,isFocused:()=>focused,measureInWindow:fn=>measurements.push(()=>fn(0,host.top,300,host.bottom-host.top)),getBoundingClientRect:()=>({top:host.top,bottom:host.bottom})};
  inputs.push(host);node.props.ref(host);
  return {host,ref,node,focus:()=>{focused=true;node.props.onFocus({});},blur:()=>{focused=false;node.props.onBlur({});},get callbacks(){return [focusCalls,blurCalls,selectionCalls,sizeCalls];}};
 }
 function flush(){for(let i=0;i<40;i++){const dirty=instances.filter(n=>n.dirty);dirty.forEach(render);while(effects.length)effects.shift()();const tasks=[...frames.values()];frames.clear();tasks.forEach(fn=>fn());const measures=measurements.splice(0);measures.forEach(fn=>fn());if(!frames.size&&!measurements.length&&!effects.length&&!instances.some(n=>n.dirty))return;}throw Error('Keyboard reveal did not settle');}
 flush();
 return {input,flush,calls,owner,externalRef,scrollNode,visual,visualHandlers,listeners,measurements,
  setViewport:(top,bottom)=>{viewport={top,bottom};},setKeyboard:value=>{metrics=value;},
  layout:()=>scrollNode().props.onLayout({}),resize:()=>dimensionHandler?.(),
  show:()=>listeners.keyboardDidShow({endCoordinates:metrics}),
  frameStep:()=>{const tasks=[...frames.values()];frames.clear();tasks.forEach(fn=>fn());},hide:()=>{metrics=undefined;listeners.keyboardDidHide();},
  content:()=>scrollNode().props.onContentSizeChange(400,1200),
  cleanup:()=>{active=false;cleanups.forEach(fn=>fn());},
  get offsets(){return {layoutCalls,scrollEvents,contentEvents,currentOffset};},
  get state(){return owner.hooks;},
  get active(){return active;},
 };
}
let checks=7;
for(const os of ['android','ios','web']){
 const h=harness(os),input=h.input(200,250);input.focus();h.flush();assert.equal(h.calls.length,0,os+' visible field moved');
 h.layout();h.content();h.resize();h.flush();assert.equal(h.calls.length,0,os+' layout moved visible field');
 assert.equal(h.offsets.layoutCalls,1);assert.equal(h.offsets.contentEvents,1);assert.equal(h.externalRef.current!==null,true);
 assert.equal(h.scrollNode().props.keyboardShouldPersistTaps,'always');
 const hidden=h.input(580,630);input.blur();hidden.focus();h.flush();assert.equal(h.calls.at(-1).y,142,os+' hidden field wrong movement');
 assert.equal(hidden.node.props.value,'keep this text');assert.equal(hidden.ref.current,hidden.host);
 const previous=h.calls.length;hidden.node.props.onSelectionChange({});hidden.node.props.onContentSizeChange({});h.flush();assert.equal(h.calls.length,previous,os+' typing moved visible field');
 assert.deepEqual(hidden.callbacks,[1,0,1,1]);
 h.hide();h.flush();assert.equal(h.calls.length,previous,os+' hide jumped scroll');
 h.layout();h.flush();assert.equal(h.calls.length,previous);
 h.cleanup();assert.equal(Object.keys(h.listeners).length,0);
 checks+=8;
}
{
 const h=harness('android');const input=h.input(580,630);input.focus();
 // Delay native measurement, then change focus: stale callbacks cannot scroll.
 h.layout();input.blur();h.flush();assert.equal(h.calls.length,0);checks++;
}
{
 const h=harness('android',{keyboard:false});const input=h.input(580,630);input.focus();h.setViewport(50,600);h.layout();h.flush();assert.equal(h.calls.at(-1).y,142);checks++;
}
{
 const h=harness('android');const input=h.input(580,630);h.setKeyboard({screenY:600,height:300,screenX:0,width:400});h.setViewport(50,900);input.focus();h.show();h.flush();assert.equal(h.calls.at(-1).y,142);assert(h.owner.nodes.some(n=>n.type==='View'&&n.props.style?.height===300));
 const previous=h.calls.length;h.show();h.flush();assert.equal(h.calls.length,previous);h.hide();h.flush();assert(!h.owner.nodes.some(n=>n.type==='View'&&n.props.style?.height>0));checks+=3;
}
{
 const h=harness('ios',{avoiding:true});assert.equal(h.scrollNode().props.automaticallyAdjustKeyboardInsets,false);const input=h.input(200,250);input.focus();h.flush();assert.equal(h.calls.length,0);checks++;
}
{
 const h=harness('web');const input=h.input(200,250);input.focus();h.flush();h.visual.height=220;h.visualHandlers.resize();h.flush();assert.equal(h.calls.at(-1).y,142);checks++;
}
{
 const h=harness('android'),old=h.input(200,250),next=h.input(580,630);
 old.focus();h.frameStep();next.focus();old.blur();h.flush();assert.equal(h.calls.at(-1).y,142);checks++;
}
{
 const h=harness('android'),input=h.input(580,630);input.focus();h.frameStep();h.cleanup();h.flush();assert.equal(h.calls.length,0);checks++;
}
console.log(`${checks} keyboard visibility checks passed: stable visible inputs, minimal reveal, platform resizing, overlay space, typing, callbacks, stale focus and keyboard dismissal.`);
