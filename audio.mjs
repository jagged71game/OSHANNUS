// Original procedural effects. Audio randomness never consumes combat rolls.
export function createSound() {
  const key='oshannus-audio-v1';
  let ctx, master, noise, muted=false, volume=.45;
  const voices=new Set();
  try { const p=JSON.parse(localStorage.getItem(key)); if(p){muted=p.muted===true;if(Number.isFinite(p.volume))volume=Math.max(0,Math.min(1,p.volume));} } catch {}
  function save(){try{localStorage.setItem(key,JSON.stringify({muted,volume}));}catch{}}
  function gain(){if(master)master.gain.setTargetAtTime(muted||document.hidden?0:volume*.55,ctx.currentTime,.015);}
  function unlock(){
    try {
      if(!ctx){
        const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
        ctx=new Audio();master=ctx.createGain();master.connect(ctx.destination);gain();
        noise=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);
        const data=noise.getChannelData(0);let seed=9173;
        for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/2147483648-1;}
      }
      if(ctx.state==='suspended')ctx.resume().catch(()=>{});
    }catch{}
  }
  function stop(){for(const v of voices){try{v.stop();}catch{}}voices.clear();}
  function layer(kind,freq,end,duration,level,delay=0){
    const start=ctx.currentTime+delay, env=ctx.createGain();
    let src, filter;
    if(kind==='noise'){
      src=ctx.createBufferSource();src.buffer=noise;
      filter=ctx.createBiquadFilter();filter.type='bandpass';filter.Q.value=.7;
      filter.frequency.setValueAtTime(freq,start);filter.frequency.exponentialRampToValueAtTime(end,start+duration);
      src.connect(filter);filter.connect(env);
    }else{
      src=ctx.createOscillator();src.type=kind;src.frequency.setValueAtTime(freq,start);
      src.frequency.exponentialRampToValueAtTime(end,start+duration);src.connect(env);
    }
    env.gain.setValueAtTime(0,start);env.gain.linearRampToValueAtTime(level,start+.018);
    env.gain.exponentialRampToValueAtTime(.0001,start+duration);env.connect(master);
    voices.add(src);src.onended=()=>{voices.delete(src);src.disconnect();filter?.disconnect();env.disconnect();};
    src.start(start);src.stop(start+duration+.02);
  }
  function play(name){
    if(!ctx||ctx.state!=='running'||muted||volume===0||document.hidden)return;
    try {
      const tone=(a,b,d=.3,v=.15,t=0)=>layer('sine',a,b,d,v,t);
      const wash=(a,b,d=.4,v=.35,t=0)=>layer('noise',a,b,d,v,t);
      switch(name){
        case 'strike':wash(1600,280,.42);tone(480,110,.28,.12);break;
        case 'wave':wash(350,2200,.6,.5);wash(1800,180,.75,.35,.12);tone(130,48,.65,.2);break;
        case 'interrupt':wash(2200,350,.45,.4);tone(240,680,.3,.12);break;
        case 'shield':wash(700,1600,.45,.18);tone(300,600,.55,.17);tone(450,900,.6,.08);break;
        case 'block':wash(1800,600,.22,.25);tone(650,260,.25,.15);break;
        case 'heal':case 'grace':
          [392,494,587,784].forEach((f,i)=>tone(f,f*1.01,name==='grace'?1.1:.65,.1,i*.13));wash(900,2200,.7,.08);break;
        case 'hit':wash(1000,180,.18,.35);tone(100,45,.2,.2);break;
        case 'heavy':wash(600,90,.5,.5);tone(110,35,.65,.3);break;
        case 'earthquake':[0,.17,.36].forEach(t=>{wash(280,55,.7,.3,t);tone(80,30,.7,.22,t);});break;
        case 'tendrils':wash(180,1100,.6,.3);tone(170,65,.6,.1);break;
        case 'ghost':tone(260,70,.7,.18);tone(267,74,.7,.12);wash(1500,300,.65,.18);break;
        case 'mirror':[900,1400,2100].forEach((f,i)=>tone(f,f*.55,.35,.07,i*.035));wash(3000,900,.2,.18);break;
        case 'phase':wash(1800,400,.25,.2);tone(650,1200,.2,.06);break;
        case 'stun':tone(740,350,.7,.1);tone(753,360,.7,.08);break;
        case 'victory':[294,370,440,587].forEach((f,i)=>tone(f,f,1,.12,i*.15));break;
        case 'defeat':[220,185,147].forEach((f,i)=>tone(f,f*.85,.8,.13,i*.2));break;
      }
    }catch{} // Audio failure must never interrupt a combat turn.
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();gain();});
  window.addEventListener('pagehide',stop);
  return {unlock,play,stop,get muted(){return muted;},get volume(){return volume;},
    setMuted(value){muted=!!value;if(muted)stop();gain();save();},
    setVolume(value){if(Number.isFinite(value)){volume=Math.max(0,Math.min(1,value));gain();save();}}
  };
}
