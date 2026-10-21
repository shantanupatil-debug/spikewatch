// Spikewatch detection core. Pure functions, shared by the web checker and the hourly job.
// points: [{t: ms (start of hour, UTC), v: dollars}] sorted ascending.
export function median(a){const s=[...a].sort((x,y)=>x-y);const n=s.length;return n?(n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2):0}
export function baselineFor(points,i,mode="sameHour"){
  const p=points[i], H=3600000;
  if(mode==="trailing24"){const w=points.filter(q=>q.t<p.t&&q.t>=p.t-24*H).map(q=>q.v);return w.length>=12?median(w):null}
  const w=points.filter(q=>q.t<p.t&&q.t>=p.t-14*24*H&&((p.t-q.t)%(24*H)===0)).map(q=>q.v);
  return w.length>=3?median(w):null;
}
export function detect(points,{mult=3,floor=5,mode="sameHour",cooldownH=6}={}){
  const H=3600000,rows=[];let lastAlert=-Infinity;
  points.forEach((p,i)=>{
    const b=baselineFor(points,i,mode);
    const ratio=b&&b>0?p.v/b:null;
    let alert=false,suppressed=false;
    if(b!==null&&b>0&&p.v>=floor&&ratio>=mult){ if(p.t-lastAlert>=cooldownH*H){alert=true;lastAlert=p.t}else suppressed=true }
    rows.push({...p,baseline:b,ratio,alert,suppressed});
  });
  return rows;
}
export function plainRule({mult,floor,mode,cooldownH}){
  return `If spend in any hour reaches ${mult}x your usual level ${mode==="trailing24"?"(median of the previous 24 hours)":"for that hour (median of the same hour over the last 14 days)"}, and is at least $${floor}, send one message. The same alert is not repeated for ${cooldownH} hours.`;
}
export function alertText(r,{mult}){
  const d=new Date(r.t).toISOString().slice(0,13).replace("T"," ")+":00 UTC";
  return `Spikewatch: AI spend is at ${r.ratio.toFixed(1)}x your usual level (threshold ${mult}x). Hour starting ${d}: $${r.v.toFixed(2)}. Usual: $${r.baseline.toFixed(2)}.`;
}
// Approximate USD per million tokens (input/output). Estimates, edit to match your contract.
export const PRICES={"opus":[15,75],"sonnet":[3,15],"haiku":[1,5],"default":[3,15]};
export function priceKey(model=""){const m=model.toLowerCase();return m.includes("opus")?"opus":m.includes("haiku")?"haiku":m.includes("sonnet")?"sonnet":"default"}
// Convert an Anthropic usage_report/messages response (bucket_width=1h) to hourly estimated dollars.
export function usageToPoints(resp){
  return (resp.data||[]).map(b=>{
    let usd=0;
    for(const r of (b.results||[])){
      const [pi,po]=PRICES[priceKey(r.model)];
      const inp=(r.uncached_input_tokens||0)+(r.cache_creation?(r.cache_creation.ephemeral_5m_input_tokens||0)*1.25+(r.cache_creation.ephemeral_1h_input_tokens||0)*2:0)+(r.cache_read_input_tokens||0)*0.1;
      usd+=inp/1e6*pi+(r.output_tokens||0)/1e6*po;
    }
    return {t:Date.parse(b.starting_at),v:+usd.toFixed(4)};
  }).sort((a,b)=>a.t-b.t);
}
// Weekly "all clear" digest: a short proof-of-life summary so a quiet week still shows the watcher is running.
// rows: output of detect(); end: ms timestamp of the end of the week (exclusive).
export function weeklyDigest(rows,end){
  const H=3600000,W=7*24*H,sum=a=>a.reduce((s,r)=>s+r.v,0);
  const wk=rows.filter(r=>r.t>=end-W&&r.t<end), prev=rows.filter(r=>r.t>=end-2*W&&r.t<end-W);
  const tw=sum(wk),pw=sum(prev),alerts=wk.filter(r=>r.alert).length;
  const peak=wk.reduce((a,r)=>r.v>a.v?r:a,wk[0]||{t:end,v:0});
  const ch=pw>0&&prev.length>=6*24?` (${tw>=pw?"+":""}${((tw-pw)/pw*100).toFixed(0)}% vs the week before)`:"";
  const when=new Date(peak.t).toISOString().slice(0,13).replace("T"," ")+":00 UTC";
  return `Spikewatch weekly: $${tw.toFixed(2)} estimated AI spend in the last 7 days${ch}. ${alerts?`${alerts} spike alert${alerts>1?"s":""} sent.`:"No spikes, all quiet."} Busiest hour: ${when} at $${peak.v.toFixed(2)}. Still checking every hour.`;
}
