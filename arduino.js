const arduinoLights=(()=>{
 const serial=navigator.serial;
 const connectButton=document.getElementById('arduino-connect');
 const testButton=document.getElementById('arduino-test');
 const status=document.getElementById('arduino-status');
 const storageKey='aptamil-welcome-arduino';
 const blue=new TextEncoder().encode('BLUE\n');
 let active=null;
 let opening=false;
 let closing;
 let testTimer=0;

 function showStatus(message,state='pending'){
  status.textContent=message;
  status.dataset.state=state;
  connectButton.disabled=!serial||opening||Boolean(active);
  testButton.disabled=!active?.started||Boolean(testTimer);
 }

 // A saved USB ID enables automatic reopening after the operator grants permission.
 function usbId(port){
  const {usbVendorId,usbProductId}=port.getInfo();
  if(usbVendorId===undefined||usbProductId===undefined)return null;
  return usbVendorId+':'+usbProductId;
 }

 function receiveLine(connection,line){
  if(active!==connection)return;
  if(line!=='READY'&&line!=='BLUE 10 SECONDS')return;
  connection.verified=true;
  if(line==='BLUE 10 SECONDS'&&testTimer){
   clearTimeout(testTimer);
   testTimer=0;
   showStatus('Connected · LED test acknowledged','ok');
  }else if(connection.started&&!testTimer){
   showStatus('Connected · Firmware responding','ok');
  }
 }

 function readReplies(connection,readable){
  const decoder=new TextDecoder();
  let pending='';
  return readable.pipeTo(new WritableStream({
   write(bytes){
    const lines=(pending+decoder.decode(bytes,{stream:true})).split('\n');
    pending=lines.pop().slice(-100);
    for(const line of lines)receiveLine(connection,line.trim());
   }
  }),{signal:connection.input.signal});
 }

 async function openPort(choosePort){
  if(!serial||opening||active)return;
  opening=true;
  showStatus('Connecting…');
  let message='Disconnected · Choose the Nano USB port.';
  let state='pending';
  try{
   const port=await choosePort();
   if(!port)return;
   await closing;
   await port.open({baudRate:115200});
   const readable=port.readable;
   const writable=port.writable;
   if(!readable||!writable){
    await port.close().catch(()=>{});
    throw new Error('Serial streams are unavailable.');
   }
   const connection={port,writer:writable.getWriter(),input:new AbortController(),started:false,verified:false};
   active=connection;
   // The Nano may reset when USB serial opens and needs time to boot.
   connection.ready=new Promise(resolve=>setTimeout(resolve,2000));
   connection.inputClosed=readReplies(connection,readable);
   void connection.inputClosed.catch(()=>disconnect(connection,'Disconnected · Reconnect the Arduino.'));
   void connection.ready.then(()=>{
    if(active!==connection)return;
    connection.started=true;
    if(connection.verified)showStatus('Connected · Firmware responding','ok');
    else showStatus('USB port open · Test LEDs to verify.');
   });
   message='USB port open · Arduino starting…';
   try{
    const id=usbId(port);
    if(id)window.localStorage.setItem(storageKey,id);
    else window.localStorage.removeItem(storageKey);
   }catch{}
  }catch(error){
   if(error.name!=='NotFoundError'){
    message='Could not open the port. Close Serial Monitor and try again.';
    state='error';
   }
  }finally{
   opening=false;
   showStatus(message,state);
  }
 }

 async function previouslySelectedPort(){
  let savedId;
  try{savedId=window.localStorage.getItem(storageKey);}catch{}
  if(!savedId)return;
  const matches=(await serial.getPorts()).filter(port=>usbId(port)===savedId);
  if(matches.length===1)return matches[0];
 }

 function disconnect(connection,message){
  if(active!==connection)return;
  active=null;
  clearTimeout(testTimer);
  testTimer=0;
  connection.writer.releaseLock();
  connection.input.abort();
  closing=connection.inputClosed.catch(()=>{}).then(()=>connection.port.close()).catch(()=>{});
  showStatus(message,'error');
 }

 async function trigger(){
  const connection=active;
  if(!connection)return;
  await connection.ready;
  if(active!==connection)return;
  try{await connection.writer.write(blue);}
  catch{disconnect(connection,'Serial command failed. Reconnect the Arduino.');}
 }

 testButton.addEventListener('click',()=>{
  if(!active?.started||testTimer)return;
  testTimer=setTimeout(()=>{
   testTimer=0;
   showStatus('USB port open · No LED response. Check the sketch and try again.','error');
  },2500);
  showStatus('Testing LEDs…');
  void trigger();
 });

 if(serial){
  connectButton.addEventListener('click',()=>{void openPort(()=>serial.requestPort());});
  serial.addEventListener('connect',()=>{void openPort(previouslySelectedPort);});
  serial.addEventListener('disconnect',event=>{
   if(active?.port===(event.port??event.target))disconnect(active,'Disconnected · Reconnect the Arduino.');
  });
  void openPort(previouslySelectedPort);
 }else{
  showStatus('Use the HTTPS page in desktop Chrome or Edge.','error');
 }

 return {trigger};
})();
