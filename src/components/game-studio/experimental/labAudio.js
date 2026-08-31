// Small synthesized sound studies, isolated from production players and exports.
export const soundPalettes={
 cinema:{name:'Điện ảnh · hợp âm êm và tiếng chạm nhẹ',notes:[220,261.63,329.63,392],wave:'sine',pace:2600},
 storybook:{name:'Trang sách · chuông gỗ nhẹ',notes:[261.63,329.63,392,523.25],wave:'sine',pace:2300},
 system:{name:'Hệ thống · tín hiệu điện tử',notes:[164.81,220,246.94,329.63],wave:'triangle',pace:1900},
 mystery:{name:'Bí ẩn · âm trầm thưa',notes:[110,130.81,164.81,123.47],wave:'sine',pace:3600},
 palace:{name:'Cung đấu · giai điệu ngũ cung',notes:[220,246.94,329.63,369.99,440],wave:'triangle',pace:2800},
 tycoon:{name:'Làm giàu · nhịp điện tử nhẹ',notes:[196,246.94,293.66,392],wave:'sine',pace:2100},
};
export class LabAudio {
 constructor({createContext=()=>{const C=window.AudioContext||window.webkitAudioContext;if(!C)throw new Error('Trình duyệt không hỗ trợ âm thanh thử nghiệm.');return new C();},schedule=(callback,delay)=>window.setInterval(callback,delay),cancel=timer=>window.clearInterval(timer)}={}){this.createContext=createContext;this.schedule=schedule;this.cancel=cancel;this.context=null;this.nodes=new Set();this.enabled=false;this.hidden=false;this.disposed=false;this.background=.25;this.effects=.45;this.genre='cinema';this.generation=0;}
 async enable(){if(this.disposed)return;const generation=++this.generation;this.context||=this.createContext();await this.context.resume();if(this.disposed||generation!==this.generation)return;this.enabled=true;this.start();}
 disable(){this.generation++;this.enabled=false;this.stop();}
 setGenre(id){this.genre=soundPalettes[id]?id:'cinema';this.stop();if(this.enabled)this.start();}
 setVolumes(background,effects){this.background=background;this.effects=effects;for(const n of this.nodes){n.gain.gain.cancelScheduledValues(this.context.currentTime);n.gain.gain.setTargetAtTime(0,this.context.currentTime,.025);try{n.osc.stop(this.context.currentTime+.12);}catch{/* already stopping */}}}
 setHidden(hidden){this.hidden=hidden;if(hidden)this.stop();else if(this.enabled)this.start();}
 stop(){if(this.timer){this.cancel(this.timer);this.timer=null;}for(const n of [...this.nodes]){try{n.osc.stop();}catch{/* already stopped */}n.osc.disconnect();n.gain.disconnect();}this.nodes.clear();}
 tone(frequency,duration,volume,delay=0,wave='sine'){
  if(!this.enabled||this.hidden||this.disposed||!volume||this.context?.state!=='running')return;
  const c=this.context,osc=c.createOscillator(),gain=c.createGain(),start=c.currentTime+delay;
  osc.type=wave;osc.frequency.value=frequency;osc.connect(gain);gain.connect(c.destination);
  gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume,start+.025);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
  const node={osc,gain};this.nodes.add(node);osc.onended=()=>{osc.disconnect();gain.disconnect();this.nodes.delete(node);};osc.start(start);osc.stop(start+duration+.04);
 }
 start(){if(!this.enabled||this.hidden||this.disposed)return;this.stop();const p=soundPalettes[this.genre];let i=0;const tick=()=>{this.tone(p.notes[i++%p.notes.length],2.4,this.background*.07,0,p.wave);};tick();this.timer=this.schedule(tick,p.pace);}
 play(kind){const p=soundPalettes[this.genre],base=p.notes[0];const notes=kind==='system'?[base*2,base*3]:kind==='good'?[base,base*1.25,base*1.5,base*2]:kind==='bad'?[base*1.5,base*1.2,base]:[base*2];notes.forEach((f,i)=>this.tone(f,kind==='choice'?.14:.7,this.effects*.1,i*.15,p.wave));}
 dispose(){this.disposed=true;this.disable();if(this.context){this.context.close().catch(()=>{});this.context=null;}}
}
