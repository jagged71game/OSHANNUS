// Original score: The Returning Tide. Eight-bar phrases with scene arrangements.
// Uses its own deterministic score; never touches the combat random generator.
export function createMusic(){
  const key='oshannus-music-v1';let ctx,master,bus,surf,timer,step=0,next=0,scene='calm',muted=false,volume=.35;
  const voices=new Set();
  try{const p=JSON.parse(localStorage.getItem(key));if(p){muted=p.muted===true;if(Number.isFinite(p.volume))volume=Math.max(0,Math.min(1,p.volume));}}catch{}
  const save=()=>{try{localStorage.setItem(key,JSON.stringify({muted,volume}));}catch{}};
  function gain(){if(master)master.gain.setTargetAtTime(muted||document.hidden?0:volume*.65,ctx.currentTime,.12);}
  function clear(){clearInterval(timer);timer=null;for(const v of voices){try{v.stop();}catch{}}voices.clear();}
  function note(midi,time,length,level,type='sine',pad=false){
    const osc=ctx.createOscillator(),env=ctx.createGain(),filter=ctx.createBiquadFilter();
    osc.type=type;osc.frequency.value=440*2**((midi-69)/12);
    filter.type='lowpass';filter.frequency.value=pad?850:2200;
    env.gain.setValueAtTime(0,time);env.gain.linearRampToValueAtTime(level,time+(pad?.65:.015));
    env.gain.exponentialRampToValueAtTime(.0001,time+length);
    osc.connect(filter);filter.connect(env);env.connect(bus);
    voices.add(osc);osc.onended=()=>{voices.delete(osc);osc.disconnect();filter.disconnect();env.disconnect();};
    osc.start(time);osc.stop(time+length+.05);
  }
  function drum(time,accent=1){
    const osc=ctx.createOscillator(),env=ctx.createGain();osc.frequency.setValueAtTime(95,time);osc.frequency.exponentialRampToValueAtTime(38,time+.22);
    env.gain.setValueAtTime(.15*accent,time);env.gain.exponentialRampToValueAtTime(.0001,time+.35);osc.connect(env);env.connect(bus);
    voices.add(osc);osc.onended=()=>{voices.delete(osc);osc.disconnect();env.disconnect();};osc.start(time);osc.stop(time+.4);
  }
  function water(time,length,level,swell=false){
    const src=ctx.createBufferSource(),env=ctx.createGain(),filter=ctx.createBiquadFilter();src.buffer=surf;src.loop=true;
    filter.type='bandpass';filter.Q.value=.6;filter.frequency.setValueAtTime(swell?350:3200,time);filter.frequency.exponentialRampToValueAtTime(swell?2600:1400,time+length);
    env.gain.setValueAtTime(0,time);env.gain.linearRampToValueAtTime(level,time+(swell?length*.7:.008));env.gain.exponentialRampToValueAtTime(.0001,time+length);
    src.connect(filter);filter.connect(env);env.connect(bus);voices.add(src);
    src.onended=()=>{voices.delete(src);src.disconnect();filter.disconnect();env.disconnect();};src.start(time);src.stop(time+length+.02);
  }
  // D minor, Bb, F, C, G minor, Bb, A suspended, D minor.
  const chords=[[50,57,62,65],[46,53,58,62],[41,53,57,60],[48,55,60,64],[43,55,58,62],[46,53,58,65],[45,57,62,64],[50,57,62,65]];
  const melody=[[74,null,77,null,76,null,69,null],[70,null,74,null,77,null,74,null],[72,null,69,null,65,null,69,null],[67,null,72,null,76,null,72,null],[74,null,70,null,67,null,69,null],[70,null,74,null,77,null,79,null],[76,null,74,null,73,null,69,null],[74,null,null,null,69,null,74,null]];
  // Combat lifts into D Dorian: open fifths, rising phrases and rolling surf.
  const surgeChords=[[50,57,62,65],[48,55,60,64],[43,55,59,62],[50,57,62,65],[53,57,60,65],[43,55,59,62],[48,55,60,64],[50,57,62,69]];
  const surgeMelody=[[74,76,77,null,81,79,77,76],[72,null,76,79,84,null,79,76],[71,74,79,null,83,81,79,74],[74,null,77,81,86,null,81,77],[77,79,81,null,84,81,79,77],[79,null,83,86,83,null,81,79],[76,79,84,null,86,84,79,76],[77,81,86,null,81,77,76,74]];
  function schedule(){
    if(!ctx||ctx.state!=='running'||muted||volume===0||document.hidden)return;
    const beat=60/(scene==='boss'?128:scene==='battle'?120:66),tick=beat/2;
    if(next<ctx.currentTime-.2)next=ctx.currentTime+.05;
    while(next<ctx.currentTime+.2){
      const bar=Math.floor(step/8)%8,pos=step%8,combat=scene!=='calm',dark=scene==='boss',c=(combat?surgeChords:chords)[bar];
      if(pos===0){c.slice(1).forEach(n=>note(n-(dark?12:0),next,beat*4.6,combat?.03:.045,'triangle',true));if(!combat)note(c[0]-12,next,beat*3.5,.09,'sine',true);}
      const m=(combat?surgeMelody:melody)[bar][pos];if(m!==null)note(m,next,beat*(combat?.8:1.8),combat?.065:.085,combat?'triangle':'sine');
      if(combat){
        // Alternating root/fifth bass and offbeat splashes drive the wave forward.
        if(pos%2===0)note(c[0]-12+(pos===6?7:0),next,beat*.7,.1,'triangle');
        note(c[1+pos%3]+12,next,tick*.8,.025,'sine');
        if(pos===0||pos===4||pos===7)drum(next,pos===7?.5:1);
        if(pos===2||pos===6){water(next,.18,.12);drum(next,.45);}
        else if(pos%2===1)water(next,.09,.045);
        if(pos===6&&bar%2===1)water(next,beat*1.8,.13,true);
        if(dark&&pos===7){drum(next+tick*.5,.55);note(c[0]-12,next,beat,.08);}
      }else if(pos===2||pos===6)note(c[2]+12,next,beat*1.6,.035,'sine');
      step++;next+=tick;
    }
  }
  function start(){if(!ctx||muted||volume===0||document.hidden||ctx.state!=='running'||timer)return;next=ctx.currentTime+.05;timer=setInterval(schedule,80);schedule();}
  async function unlock(){
    try{
      if(!ctx){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;ctx=new Audio();master=ctx.createGain();bus=ctx.createGain();bus.connect(master);master.connect(ctx.destination);
        surf=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);const data=surf.getChannelData(0);let seed=46291;
        for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/2147483648-1;}
        // A quiet echo adds space without a downloadable reverb recording.
        const delay=ctx.createDelay(1),wet=ctx.createGain(),filter=ctx.createBiquadFilter();delay.delayTime.value=.32;wet.gain.value=.22;filter.type='lowpass';filter.frequency.value=1600;bus.connect(delay);delay.connect(filter);filter.connect(wet);wet.connect(master);gain();}
      if(ctx.state==='suspended')await ctx.resume();start();
    }catch{}
  }
  function setScene(value){if(!['calm','battle','boss'].includes(value)||scene===value)return;scene=value;
    // Let the current phrase decay; pick up the new arrangement at its next bar.
    step=Math.ceil(step/8)*8;
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();else start();gain();});
  window.addEventListener('pagehide',clear);
  window.addEventListener('pageshow',start);
  return {unlock,setScene,get muted(){return muted;},get volume(){return volume;},
    setMuted(v){muted=!!v;if(muted)clear();else start();gain();save();},
    setVolume(v){if(Number.isFinite(v)){volume=Math.max(0,Math.min(1,v));if(volume===0)clear();else start();gain();save();}}
  };
}
