// Hourly job: node engine/spikewatch.mjs
// Env: ANTHROPIC_ADMIN_KEY (read-only admin key), SLACK_WEBHOOK_URL (optional), MULT (3), FLOOR (5), MODE (sameHour|trailing24), COOLDOWN_H (6)
import {detect,usageToPoints,alertText} from "./detect.mjs";
const key=process.env.ANTHROPIC_ADMIN_KEY; if(!key){console.error("ANTHROPIC_ADMIN_KEY missing");process.exit(1)}
const opts={mult:+(process.env.MULT||3),floor:+(process.env.FLOOR||5),mode:process.env.MODE||"sameHour",cooldownH:+(process.env.COOLDOWN_H||6)};
const H=3600000, end=new Date(Math.floor(Date.now()/H)*H), start=new Date(end-15*24*H);
let data=[],page=null;
do{
  const u=new URL("https://api.anthropic.com/v1/organizations/usage_report/messages");
  u.searchParams.set("starting_at",start.toISOString());u.searchParams.set("ending_at",end.toISOString());
  u.searchParams.set("bucket_width","1h");u.searchParams.set("group_by[]","model");u.searchParams.set("limit","168");
  if(page)u.searchParams.set("page",page);
  const res=await fetch(u,{headers:{"x-api-key":key,"anthropic-version":"2023-06-01"}});
  if(!res.ok){console.error("Anthropic API error",res.status,(await res.text()).slice(0,300));process.exit(1)}
  const j=await res.json();data.push(...j.data);page=j.has_more?j.next_page:null;
}while(page);
const pts=usageToPoints({data});
const rows=detect(pts,opts), last=rows.filter(r=>r.t>=+end-2*H).filter(r=>r.alert);
console.log(`checked ${rows.length} hours, ${last.length} new alert(s)`);
for(const r of last){
  const text=alertText(r,opts);console.log(text);
  if(process.env.SLACK_WEBHOOK_URL){const s=await fetch(process.env.SLACK_WEBHOOK_URL,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({text})});console.log("slack",s.status)}
}
