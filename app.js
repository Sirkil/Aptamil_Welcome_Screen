const scenes={idle:document.getElementById('idle'),greeting:document.getElementById('greeting'),unknown:document.getElementById('unknown')};
const guestName=document.getElementById('guest-name');
const unknownMessage=document.getElementById('unknown-message');
const readerStatus=document.getElementById('reader-status');
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
async function lookup(rawCode){
 const code=rawCode.trim();
 if(!/^\d{10}$/.test(code))return;
 const now=Date.now();
 if(code===lastCode&&now-lastCodeAt<1500)return;
 lastCode=code;lastCodeAt=now;
 const sequence=++requestSequence;
 readerStatus.textContent='Finding attendee…';
 try{
  const result=await api(`/welcome/lookup/${code}`);
  if(sequence!==requestSequence)return;
  if(typeof result.name!=='string'||!result.name.trim())throw new Error('No name was returned.');
  guestName.textContent=result.name.trim().replace(/^Dr\.?\s+/i,'');
  readerStatus.textContent='Connected. Tap your NFC tag.';
  setScene('greeting');
 }catch(error){
  if(sequence!==requestSequence)return;
  readerStatus.textContent=error.status===404?'Tag not registered.':'Cannot reach registration server.';
  showUnknown(error.status===404?'This NFC tag is not registered. Please see our team.':'The registration server is unavailable. Please see our team.');
 }
}

window.addEventListener('keydown',event=>{
 if(!apiOrigin||event.ctrlKey||event.altKey||event.metaKey||event.isComposing)return;
 if(event.key==='Enter'){
  if(scanBuffer){event.preventDefault();const code=scanBuffer;scanBuffer='';clearTimeout(scanTimer);void lookup(code);}
  return;
 }
 if(!/^\d$/.test(event.key))return;
 const now=performance.now();
 if(now-lastKeyAt>220)scanBuffer='';
 lastKeyAt=now;scanBuffer+=event.key;
 if(scanBuffer.length>10)scanBuffer=scanBuffer.slice(-10);
 clearTimeout(scanTimer);
 scanTimer=setTimeout(()=>{if(scanBuffer.length===10)void lookup(scanBuffer);scanBuffer='';},190);
});

async function heartbeat(){
 try{await api('/welcome/heartbeat');readerStatus.textContent='Connected. Tap your NFC tag.';}
 catch{readerStatus.textContent=apiOrigin?'Cannot reach registration server.':'Registration server URL is not configured.';}
}
void heartbeat();
setInterval(()=>{void heartbeat();},60000);
