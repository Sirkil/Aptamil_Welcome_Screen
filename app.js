const scenes={greeting:document.getElementById('greeting'),unknown:document.getElementById('unknown')};
const pavilionStage=document.getElementById('pavilion-stage');
const guestName=document.getElementById('guest-name');
const unknownMessage=document.getElementById('unknown-message');
const readerStatus=document.getElementById('reader-status');
const welcomeScreen=document.getElementById('welcome-screen');
const rainScreen=document.getElementById('rain-screen');
const rainStage=document.getElementById('rain-stage');
const rainNamesNode=document.getElementById('rain-names');
const rainMessage=document.getElementById('rain-message');
const controlScreen=document.getElementById('control-screen');
const scannerStatus=document.getElementById('scanner-status');
const databaseStatus=document.getElementById('database-status');
let sceneTimer=0;
let scanTimer=0;
let scanBuffer='';
let lastKeyAt=0;
let lastCode='';
let lastCodeAt=0;
let requestSequence=0;
let rainNames=[];
let rainSignature='';
let loadingRain=false;

function configuredOrigin(){
 try{
  const url=new URL(window.APTAMIL_API_ORIGIN);
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))return '';
  return url.origin;
 }catch{return '';}
}
const apiOrigin=configuredOrigin();

const backgroundGif=window.APTAMIL_BACKGROUND_GIF;
if(typeof backgroundGif==='string'&&backgroundGif.trim()){
 const gif=new Image();
 gif.onload=()=>{
  const layer=document.getElementById('pavilion-gif');
  layer.src=gif.src;
  layer.hidden=false;
 };
 gif.src=backgroundGif.trim();
}

function setScene(next){
 for(const [key,node] of Object.entries(scenes))node.classList.toggle('is-visible',key===next);
 pavilionStage.dataset.scene=next;
 clearTimeout(sceneTimer);
 if(next!=='idle')sceneTimer=setTimeout(()=>setScene('idle'),next==='greeting'?10000:4000);
}
async function api(path){
 if(!apiOrigin)throw new Error('The registration server URL is not configured.');
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),90000);
 try{
  const response=await fetch(`${apiOrigin}/api${path}`,{cache:'no-store',signal:controller.signal});
  const data=await response.json();
  if(!response.ok){const error=new Error(data.error||'The server did not respond.');error.status=response.status;throw error;}
  return data;
 }finally{clearTimeout(timeout);}
}
function showUnknown(message){unknownMessage.textContent=message;setScene('unknown');}
function acceptScan(code){
 if(!/^\d{10}$/.test(code))return;
 const time=new Date().toLocaleTimeString();
 scannerStatus.textContent=`Scan received at ${time}`;
 scannerStatus.dataset.state='ok';
 if(welcomeScreen.hidden)return;
 const now=Date.now();
 if(code===lastCode&&now-lastCodeAt<1500)return;
 lastCode=code;lastCodeAt=now;
 void arduinoLights.trigger();
 setScene('loading');
 void lookup(code);
}

async function lookup(code){
 const sequence=++requestSequence;
 readerStatus.textContent='';
 try{
  const result=await api(`/welcome/lookup/${code}`);
  if(sequence!==requestSequence)return;
  if(typeof result.name!=='string'||!result.name.trim())throw new Error('No name was returned.');
  const name=result.name.trim();
  guestName.textContent=/^Dr\.?\s+/i.test(name)?name:`Dr. ${name}`;
  readerStatus.textContent='';
  setScene('greeting');
 }catch(error){
  if(sequence!==requestSequence)return;
  readerStatus.textContent='';
  showUnknown(error.status===404?'This NFC tag is not registered. Please see our team.':'The registration server is unavailable. Please see our team.');
 }
}

function setRainMessage(message){
 rainMessage.textContent=message;
 rainMessage.hidden=!message;
}

function renderRain(){
 const count=rainNames.length;
 rainNamesNode.replaceChildren();
 if(!count){setRainMessage('Waiting for submitted names');return;}
 setRainMessage('');
 const columns=Math.max(1,Math.ceil(Math.sqrt(count*1.5)));
 const rows=Math.ceil(count/columns);
 rainNamesNode.style.setProperty('--rain-columns',columns);
 rainNamesNode.style.setProperty('--rain-rows',rows);
 const cellWidth=rainStage.clientWidth*.94/columns;
 const cellHeight=rainStage.clientHeight*.92/rows;
 const fontSize=Math.min(46,cellWidth/10,cellHeight/2.5);
 rainNamesNode.style.setProperty('--rain-font-size',`${Math.max(5,fontSize)}px`);
 const fragment=document.createDocumentFragment();
 rainNames.forEach((name,index)=>{
  const item=document.createElement('div');
  item.className='rain-name';
  item.textContent=name;
  item.style.setProperty('--rain-duration',`${4+(index%7)*.55}s`);
  item.style.setProperty('--rain-delay',`${-(index%11)*.45}s`);
  fragment.appendChild(item);
 });
 rainNamesNode.appendChild(fragment);
}

async function refreshRain(){
 if(rainScreen.hidden||loadingRain)return;
 loadingRain=true;
 if(!rainSignature)setRainMessage('Loading submitted names…');
 try{
  const result=await api('/welcome/names');
  if(!Array.isArray(result.names)||!result.names.every(name=>typeof name==='string'))throw new Error('Unexpected names response.');
  const signature=JSON.stringify(result.names);
  if(signature!==rainSignature){
   rainNames=result.names;
   rainSignature=signature;
   if(!rainScreen.hidden)renderRain();
  }
 }catch{
  if(!rainNames.length&&!rainScreen.hidden)setRainMessage('Could not load submitted names');
 }finally{loadingRain=false;}
}

function showView(view){
 welcomeScreen.hidden=view!=='welcome';
 rainScreen.hidden=view!=='rain';
 controlScreen.hidden=view!=='controls';
 clearTimeout(scanTimer);
 scanBuffer='';
 if(view!=='welcome'){
  requestSequence++;
  setScene('idle');
 }
 if(view==='controls'){
  controlScreen.querySelector('h1').focus();
  void heartbeat();
 }
 if(view==='rain'){
  if(rainNames.length)renderRain();
  void refreshRain();
 }
}

document.getElementById('show-welcome').addEventListener('click',()=>showView('welcome'));
window.addEventListener('keydown',event=>{
 if(event.ctrlKey||event.altKey||event.metaKey||event.isComposing)return;
 if(event.key.toLowerCase()==='q'){
  if(!event.repeat){event.preventDefault();showView(controlScreen.hidden?'controls':'welcome');}
  return;
 }
 if(event.key.toLowerCase()==='w'){
  if(!event.repeat){event.preventDefault();showView('rain');}
  return;
 }
 if(welcomeScreen.hidden)return;
 if(event.key==='Enter'){
  if(scanBuffer){event.preventDefault();const code=scanBuffer;scanBuffer='';clearTimeout(scanTimer);acceptScan(code);}
  return;
 }
 if(!/^\d$/.test(event.key))return;
 const now=performance.now();
 if(now-lastKeyAt>220)scanBuffer='';
 lastKeyAt=now;scanBuffer+=event.key;
 if(scanBuffer.length>10)scanBuffer=scanBuffer.slice(-10);
 clearTimeout(scanTimer);
 scanTimer=setTimeout(()=>{acceptScan(scanBuffer);scanBuffer='';},190);
});

window.addEventListener('resize',()=>{if(!rainScreen.hidden&&rainNames.length)renderRain();});
setInterval(()=>{if(!rainScreen.hidden)void refreshRain();},10000);

let checkingDatabase=false;
async function heartbeat(){
 if(checkingDatabase)return;
 checkingDatabase=true;
 try{
  const result=await api('/welcome/heartbeat');
  if(result.ok!==true)throw new Error('Unexpected heartbeat response.');
  databaseStatus.textContent='Connected';
  databaseStatus.dataset.state='ok';
  readerStatus.textContent='';
 }catch{
  const message=apiOrigin?'Cannot reach registration database.':'Registration server URL is not configured.';
  databaseStatus.textContent=message;
  databaseStatus.dataset.state='error';
  readerStatus.textContent=message;
 }finally{
  checkingDatabase=false;
 }
}
void heartbeat();
setInterval(()=>{void heartbeat();},60000);
