const scenes={idle:document.getElementById('idle'),greeting:document.getElementById('greeting'),unknown:document.getElementById('unknown')};
const guestName=document.getElementById('guest-name');
const unknownMessage=document.getElementById('unknown-message');
const readerStatus=document.getElementById('reader-status');
const loginOverlay=document.getElementById('login-overlay');
const loginForm=document.getElementById('kiosk-login');
const loginError=document.getElementById('login-error');
const apiUrlInput=document.getElementById('api-url');
const usernameInput=document.getElementById('username');
const passwordInput=document.getElementById('password');
let token='';
let apiOrigin='';
let sceneTimer=0;
let scanTimer=0;
let scanBuffer='';
let lastKeyAt=0;
let lastCode='';
let lastCodeAt=0;
let requestSequence=0;

apiUrlInput.value=localStorage.getItem('aptamil-registration-api-url')||'';

function setScene(next){
 for(const [key,node] of Object.entries(scenes))node.classList.toggle('is-visible',key===next);
 clearTimeout(sceneTimer);
 if(next!=='idle')sceneTimer=setTimeout(()=>setScene('idle'),next==='greeting'?10000:4000);
}
function normalizeApiUrl(raw){
 const url=new URL(raw.trim());
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw new Error('Enter the HTTPS Render service URL.');
 if(url.pathname!=='/'||url.search||url.hash)throw new Error('Enter only the server origin, without a path.');
 return url.origin;
}
async function api(path,body){
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch(`${apiOrigin}/api${path}`,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:controller.signal});
  const data=await response.json();
  if(!response.ok){const error=new Error(data.error||'The server did not respond.');error.status=response.status;throw error;}
  return data;
 }finally{clearTimeout(timeout);}
}
function requireLogin(message){
 token='';loginOverlay.hidden=false;readerStatus.textContent='Waiting for staff sign-in.';
 loginError.textContent=message||'';setScene('idle');
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
  if(error.status===401){requireLogin('Session expired. Sign in again.');return;}
  readerStatus.textContent=error.status===404?'Tag not registered.':'Cannot reach registration server.';
  showUnknown(error.status===404?'This NFC tag is not registered. Please see our team.':'The registration server is unavailable. Please see our team.');
 }
}

loginForm.addEventListener('submit',async event=>{
 event.preventDefault();loginError.textContent='';
 const button=loginForm.querySelector('button');button.disabled=true;
 try{
  apiOrigin=normalizeApiUrl(apiUrlInput.value);
  token='';
  const result=await api('/login',{username:usernameInput.value.trim(),password:passwordInput.value});
  if(typeof result.token!=='string'||!result.token)throw new Error('The server is not configured for this welcome screen URL.');
  token=result.token;
  localStorage.setItem('aptamil-registration-api-url',apiOrigin);
  passwordInput.value='';loginOverlay.hidden=true;
  readerStatus.textContent='Connected. Tap your NFC tag.';
 }catch(error){loginError.textContent=error.message||'Sign-in failed.';}
 finally{button.disabled=false;}
});

window.addEventListener('keydown',event=>{
 if(!token||event.ctrlKey||event.altKey||event.metaKey||event.isComposing)return;
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

setInterval(async()=>{
 if(!token)return;
 try{await api('/welcome/heartbeat');if(readerStatus.textContent==='Cannot reach registration server.')readerStatus.textContent='Connected. Tap your NFC tag.';}
 catch(error){if(error.status===401)requireLogin('Session expired. Sign in again.');else readerStatus.textContent='Cannot reach registration server.';}
},60000);
