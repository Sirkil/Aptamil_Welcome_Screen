const scenes={idle:document.getElementById('idle'),greeting:document.getElementById('greeting'),unknown:document.getElementById('unknown')};
const guestName=document.getElementById('guest-name');
const unknownMessage=document.getElementById('unknown-message');
const readerStatus=document.getElementById('reader-status');
const welcomeScreen=document.getElementById('welcome-screen');
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

function configuredOrigin(){
 try{
  const url=new URL(window.APTAMIL_API_ORIGIN);
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))return '';
  return url.origin;
 }catch{return '';}
}
const apiOrigin=configuredOrigin();

function setScene(next){
 for(const [key,node] of Object.entries(scenes))node.classList.toggle('is-visible',key===next);
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
 if(!controlScreen.hidden)return;
 const now=Date.now();
 if(code===lastCode&&now-lastCodeAt<1500)return;
 lastCode=code;lastCodeAt=now;
 void arduinoLights.trigger();
 void lookup(code);
}

async function lookup(code){
 const sequence=++requestSequence;
 readerStatus.textContent='';
 try{
  const result=await api(`/welcome/lookup/${code}`);
  if(sequence!==requestSequence)return;
  if(typeof result.name!=='string'||!result.name.trim())throw new Error('No name was returned.');
  guestName.textContent=result.name.trim();
  readerStatus.textContent='';
  setScene('greeting');
 }catch(error){
  if(sequence!==requestSequence)return;
  readerStatus.textContent='';
  showUnknown(error.status===404?'This NFC tag is not registered. Please see our team.':'The registration server is unavailable. Please see our team.');
 }
}

function showControls(show){
 welcomeScreen.hidden=show;
 controlScreen.hidden=!show;
 clearTimeout(scanTimer);
 scanBuffer='';
 if(show){
  requestSequence++;
  setScene('idle');
  controlScreen.querySelector('h1').focus();
  void heartbeat();
 }
}

document.getElementById('show-welcome').addEventListener('click',()=>showControls(false));
window.addEventListener('keydown',event=>{
 if(event.ctrlKey||event.altKey||event.metaKey||event.isComposing)return;
 if(event.key.toLowerCase()==='q'){
  if(!event.repeat){event.preventDefault();showControls(controlScreen.hidden);}
  return;
 }
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
