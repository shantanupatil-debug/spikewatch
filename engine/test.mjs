import {detect,median,usageToPoints,weeklyDigest} from "./detect.mjs";
import assert from "node:assert";
const H=3600000,t0=Date.UTC(2026,9,1);const pts=[];
for(let i=0;i<15*24;i++)pts.push({t:t0+i*H,v:10+(i%24===9?20:0)});
pts[pts.length-5].v=41; // spike
const rows=detect(pts,{mult:3,floor:5});
const al=rows.filter(r=>r.alert);
assert.equal(al.length,1,"exactly one alert"); assert.equal(al[0].t,pts[pts.length-5].t);
assert(al[0].ratio>3.9&&al[0].ratio<4.3);
// cooldown: two adjacent spikes -> one alert
pts[pts.length-4].v=45; const r2=detect(pts,{mult:3,floor:5}); assert.equal(r2.filter(r=>r.alert).length,1);
assert.equal(r2.filter(r=>r.suppressed).length,1);
// floor: tiny spend never alerts
const tiny=pts.map(p=>({...p,v:p.v/100})); assert.equal(detect(tiny,{mult:3,floor:5}).filter(r=>r.alert).length,0);
// usage conversion
const u=usageToPoints({data:[{starting_at:"2026-10-01T00:00:00Z",results:[{model:"claude-sonnet-5-5",uncached_input_tokens:1e6,output_tokens:1e6}]}]});
assert.equal(u[0].v,18);
// weekly digest: totals, week-over-week change, alert count
{const end=t0+14*24*H;const flat=[];for(let i=0;i<14*24;i++)flat.push({t:t0+i*H,v:i<7*24?1:2});
 const d=weeklyDigest(detect(flat,{mult:3,floor:5}),end);
 assert(d.includes("$336.00"),d); assert(d.includes("+100%"),d); assert(d.includes("No spikes"),d);
 const d2=weeklyDigest(rows,pts[pts.length-1].t+H); assert(d2.includes("1 spike alert sent"),d2);}
console.log("all tests passed");
