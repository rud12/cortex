import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, Button, Grid, Skeleton, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { toast } from 'react-toastify';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';
import InvIcon from '@mui/icons-material/Inventory2Rounded';
import WarnIcon from '@mui/icons-material/WarningAmberRounded';
import ErrIcon from '@mui/icons-material/ErrorOutlineRounded';
import TrendIcon from '@mui/icons-material/TrendingUpRounded';
import ChevronIcon from '@mui/icons-material/ChevronRightRounded';
import PosIcon from '@mui/icons-material/PointOfSaleRounded';
import CamIcon from '@mui/icons-material/CameraAltRounded';
import DataIcon from '@mui/icons-material/DataObjectRounded';
import QueryIcon from '@mui/icons-material/QueryStatsRounded';
import WareIcon from '@mui/icons-material/WarehouseRounded';
import LocalIcon from '@mui/icons-material/LocalShippingRounded';
import { useAuth } from '../../contexts/AuthContext';
import { inventoryService as invApi } from '../../services/api/inventoryService';
import { posService as posApi } from '../../services/api/posService';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const num = (v, f=0) => Number.isFinite(Number(v)) ? Number(v) : f;
const dtKey = v => { const d=new Date(v); return isNaN(d)?null:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const lstDt = d => { const r=[], n=new Date(); n.setHours(0,0,0,0); for(let i=d-1;i>=0;i--){ const k=new Date(n); k.setDate(n.getDate()-i); r.push(dtKey(k)); } return r; };
const cur = v => `₹${num(v).toLocaleString('en-IN', {maximumFractionDigits:0})}`;
const pct = v => `${num(v).toFixed(2)}%`;
const fDt = k => { const d=new Date(k); return isNaN(d)?String(k||''):d.toLocaleDateString('en-IN',{day:'2-digit',month:'short'}); };
const chg = (c, p) => { const cv=num(c), pv=num(p); return pv===0 ? (cv===0?0:100) : ((cv-pv)/Math.abs(pv))*100; };
const isLow = a => String(a?.type||'').toUpperCase()==='LOW_STOCK' || String(a?.message||'').toLowerCase().includes('reorder');
const isOut = a => String(a?.type||'').toUpperCase()==='STOCKOUT' || String(a?.message||'').toLowerCase().includes('out of stock');

const loadDash = ({ txs=[], inv=[], bts=[], alts=[], dys=30 }) => {
  const ks = lstDt(dys), sD=new Map(ks.map(k=>[k,0])), pD=new Map(ks.map(k=>[k,0])), cD=new Map(ks.map(k=>[k,0])), slP=new Map();
  const cs = new Map(); bts.forEach(b => { if(!b?.productId) return; const q=Math.max(0,num(b.quantity)), c=Math.max(0,num(b.unitCost)); cs.set(b.productId, (cs.get(b.productId)||{q:0,c:0})); const x=cs.get(b.productId); x.q+=q; x.c+=(q*c); });
  const cBp = new Map(); cs.forEach((v,k) => cBp.set(k, v.q>0?v.c/v.q:0));

  txs.forEach(t => {
    const k = dtKey(t.createdAt); if(!k || !sD.has(k)) return;
    const r = num(t.subtotal, num(t.grandTotal)), is = Array.isArray(t.items)?t.items:[]; let cg = 0;
    is.forEach(i => { const q=Math.max(0,num(i.quantity)), p=Math.max(0,num(i.unitPrice)), u=Math.max(0,cBp.get(i.productId??(p*0.6))); cg+=q*u; if(i.productId) slP.set(i.productId, num(slP.get(i.productId))+q); });
    sD.set(k, num(sD.get(k))+r); cD.set(k, num(cD.get(k))+cg); pD.set(k, num(pD.get(k))+(r-cg));
  });

  const iV = inv.reduce((s, r)=>s+(Math.max(0,num(r.quantityOnHand))*Math.max(0,cBp.get(r.productId)??0)), 0);
  const tD = new Map(ks.map(k=>[k, iV>0?(num(cD.get(k))/iV)*100:0]));
  const tK = ks[ks.length-1], yK = ks[ks.length-2]||tK, mP = String(tK||'').slice(0,7), mS = ks.filter(k=>k.startsWith(mP)).reduce((s,k)=>s+num(sD.get(k)),0);
  
  const sBp = new Map(inv.map(r=>[String(r.productId||''), Math.max(0,num(r.quantityOnHand))])), os = [...sBp.values()].filter(q=>q<=0).length;
  const sV = [...slP.values()].filter(q=>q>0), aS = sV.length>0 ? sV.reduce((s,q)=>s+q,0)/sV.length : 0, fM = sV.filter(q=>q>=Math.max(2,aS*1.2)).length;
  const dS = inv.filter(r=>num(r.quantityOnHand)>0 && num(slP.get(r.productId))<=0).slice(0,8).map(r=>({ id:r.productId, t:r.productName||r.sku||'Unk', s:`${r.sku||'—'} • ${Math.max(0,num(r.quantityOnHand))} in stock` }));
  const lsA = alts.filter(isLow), osA = alts.filter(isOut);

  return { l: ks.map(fDt), sS: ks.map(k=>num(sD.get(k))), pS: ks.map(k=>num(pD.get(k))), tS: ks.map(k=>num(tD.get(k))), 
    kpi: { tS:num(sD.get(tK)), yS:num(sD.get(yK)), tP:num(pD.get(tK)), yP:num(pD.get(yK)), tT:num(tD.get(tK)), yT:num(tD.get(yK)), mS, iV },
    inv: { lC:lsA.length, oC:Math.max(os, osA.length), fC:fM, dS, ls:lsA.slice(0,4).map(a=>({id:a.id,t:a.product?.name||a.message||'Low',s:a.product?.sku||'Reorder'})), os:osA.slice(0,4).map(a=>({id:a.id,t:a.product?.name||a.message||'Out',s:a.product?.sku||'Stockout'})) }
  };
};

const TC = ({ t, s, ls, vs, c, p='', x='' }) => {
  const tm = useTheme(), tc = tm.palette.text.secondary, gc = tm.palette.mode==='dark'?'rgba(148,163,184,0.15)':'#E6EEF8';
  return <Box className="cortex-card dash-panel p-5" sx={{height:'100%'}}><Typography variant="h6" sx={{fontWeight:750}}>{t}</Typography><Typography sx={{color:'var(--muted)', mt:0.5, mb:1.5}}>{s}</Typography><Box sx={{height:240}}><Line data={{labels:ls,datasets:[{label:t,data:vs,borderColor:c,backgroundColor:`${c}22`,pointRadius:1.6,tension:0.35}]}} options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ct=>`${p}${num(ct.parsed?.y).toFixed(2)}${x}`}}},scales:{x:{ticks:{color:tc,maxTicksLimit:7},grid:{color:gc}},y:{ticks:{color:tc},grid:{color:gc}}}}} /></Box></Box>;
};

const Kpi = ({ t, v, d, c }) => <Box className={`cortex-card dash-kpi-card ${c}`} sx={{p:2.2, h:'100%'}}><Typography sx={{color:'var(--muted)', fontWeight:650, fontSize:14}}>{t}</Typography><Typography variant="h5" sx={{fontWeight:800, mt:0.7}}>{v}</Typography>{d&&<Typography sx={{mt:0.7, color:'var(--muted)', fontSize:12}}>{d}</Typography>}</Box>;
const OC = ({ t, v, s, i, c }) => <Box className={`cortex-card dash-overview-card ${c}`} sx={{p:2.2, h:'100%'}}><Box sx={{display:'flex', alignItems:'center', gap:1.1, color:'var(--muted)'}}>{i}<Typography sx={{fontWeight:650}}>{t}</Typography></Box><Typography sx={{mt:1.3, fontSize:38, lineHeight:1, fontWeight:800}}>{v}</Typography><Typography sx={{mt:1, color:'var(--muted)', fontSize:13}}>{s}</Typography></Box>;
const WA = ({ t, is, i, c }) => <Box sx={{mt:2}}><Box sx={{display:'flex', alignItems:'center', gap:1, mb:1}}><Box className={`dash-alert-icon ${c}`}>{i}</Box><Typography sx={{fontWeight:700}}>{t}</Typography></Box><Box sx={{display:'grid', gap:1}}>{!is?.length ? <Box className="dash-alert-row"><Typography sx={{color:'var(--muted)',fontSize:13}}>No items</Typography></Box> : is.map((x,idx)=><Box key={x.id||idx} className="dash-alert-row"><Box><Typography sx={{fontWeight:650, fontSize:14}}>{x.t}</Typography><Typography sx={{color:'var(--muted)', fontSize:12, mt:0.2}}>{x.s}</Typography></Box><ChevronIcon sx={{color:'var(--muted)',fontSize:18}}/></Box>)}</Box></Box>;

export default function DashboardPage() {
  const { roles } = useAuth(), [ld, setLd] = useState(true), [dys, setDys] = useState(30), [d, setD] = useState({txs:[],inv:[],bts:[],alts:[]});
  useEffect(() => {
    let mt=true; setLd(true);
    (async () => {
      try { const [tR,iR,bR,aR] = await Promise.allSettled([posApi.listTransactions(), invApi.listInventory(), invApi.listBatches(), invApi.listAlerts(false)]); if(!mt) return; setD({ txs:tR.status==='fulfilled'?tR.value?.data||[]:[], inv:iR.status==='fulfilled'?iR.value?.data||[]:[], bts:bR.status==='fulfilled'?bR.value?.data||[]:[], alts:aR.status==='fulfilled'?aR.value?.data||[]:[] }); } catch { if(mt) toast.error('Load fail'); } finally { if(mt) setLd(false); }
    })();
    return ()=>mt=false;
  }, []);
  
  const dd = useMemo(()=>loadDash({...d,dys}), [d,dys]), qls = useMemo(()=>{ const l=[]; const ad=roles.includes('Administrator'), w=ad||roles.includes('WarehouseManager'), ws=w||roles.includes('WarehouseStaff'); if(ws) { l.push({t:'/inventory/products',l:'Products',i:<InvIcon sx={{fontSize:16}}/>},{t:'/inventory/stock',l:'Stock',i:<WareIcon sx={{fontSize:16}}/>},{t:'/receiving',l:'Receiving',i:<CamIcon sx={{fontSize:16}}/>},{t:'/vision/dataset',l:'Vision',i:<DataIcon sx={{fontSize:16}}/>}); } if(w) l.push({t:'/forecasting',l:'Forecast',i:<QueryIcon sx={{fontSize:16}}/>},{t:'/purchase-orders',l:'POs',i:<LocalIcon sx={{fontSize:16}}/>}); if(ad||roles.includes('Cashier')) l.push({t:'/pos',l:'POS',i:<PosIcon sx={{fontSize:16}}/>}); return l.slice(0,7); }, [roles]);

  return (
    <Box sx={{ p:{xs:1.5, md:2} }}>
      <Typography variant="h4" sx={{ fontWeight:850, letterSpacing:-1.2 }}>Dashboard</Typography>
      <Typography sx={{ color:'var(--muted)', mt:1 }}>Sales, turnover & profit.</Typography>
      <Box sx={{ mt:2, display:'grid', gap:2, gridTemplateColumns:{xs:'1fr', sm:'1fr 1fr', lg:'repeat(5, 1fr)'} }}>
        {ld ? Array(5).fill(0).map((_,i)=><Skeleton key={i} variant="rounded" height={104}/>) : <>
          <Kpi t="Today Sales" v={cur(dd.kpi.tS)} d={`${chg(dd.kpi.tS,dd.kpi.yS).toFixed(1)}% vs yes.`} c="tone-indigo" />
          <Kpi t="Today Profit" v={cur(dd.kpi.tP)} d={`${chg(dd.kpi.tP,dd.kpi.yP).toFixed(1)}% vs yes.`} c="tone-rose" />
          <Kpi t="Today Turnover" v={pct(dd.kpi.tT)} d={`${chg(dd.kpi.tT,dd.kpi.yT).toFixed(1)}% vs yes.`} c="tone-teal" />
          <Kpi t="Monthly Sales" v={cur(dd.kpi.mS)} c="tone-blue" />
          <Kpi t="Inventory Value" v={cur(dd.kpi.iV)} c="tone-slate" />
        </>}
      </Box>
      <Grid container spacing={2} sx={{ mt:1 }}>
        <Grid item xs={12} xl={8.6}>
          <Box className="cortex-card dash-panel p-5">
            <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:1.2, flexWrap:'wrap' }}>
              <Typography variant="h6" sx={{ fontWeight:800 }}>Inventory Overview</Typography>
              <Box className="dash-window-switch">{[7,30,60].map(d=><button key={d} className={d===dys?'active':''} onClick={()=>setDys(d)}>{d}D</button>)}</Box>
            </Box>
            <Grid container spacing={2} sx={{ mt:0.2 }}>
              <Grid item xs={12} md={4}>{ld?<Skeleton height={165}/>:<OC t="Low Stock" v={dd.inv.lC} s="Below reorder levels" i={<WarnIcon sx={{fontSize:20}}/>} c="tone-amber" />}</Grid>
              <Grid item xs={12} md={4}>{ld?<Skeleton height={165}/>:<OC t="Out of Stock" v={dd.inv.oC} s="Need refill" i={<ErrIcon sx={{fontSize:20}}/>} c="tone-rose" />}</Grid>
              <Grid item xs={12} md={4}>{ld?<Skeleton height={165}/>:<OC t="Fast Moving" v={dd.inv.fC} s={`Top movers (${dys}d)`} i={<TrendIcon sx={{fontSize:20}}/>} c="tone-teal" />}</Grid>
            </Grid>
          </Box>
          <Box className="cortex-card dash-panel p-5" sx={{ mt:2 }}>
             <Typography variant="h6" sx={{ fontWeight:800 }}>Quick Actions</Typography>
             <Box sx={{ mt:2, display:'grid', gap:1, gridTemplateColumns:{xs:'1fr 1fr', md:'repeat(4,1fr)', lg:'repeat(7,1fr)'} }}>
               {qls.map(l=><Button key={l.t} component={Link} to={l.t} variant="outlined" className="dash-chip-btn" sx={{justifyContent:'flex-start',gap:0.8,borderColor:'var(--cardBorder)'}}>{l.i}{l.l}</Button>)}
             </Box>
          </Box>
          <Grid container spacing={2} sx={{ mt:0.4 }}>
            <Grid item xs={12} lg={4}>{ld?<Skeleton height={340}/>:<TC t="Sales Graph" s={`Sales (${dys}d)`} ls={dd.l} vs={dd.sS} c="#6B82B0" p="₹" />}</Grid>
            <Grid item xs={12} lg={4}>{ld?<Skeleton height={340}/>:<TC t="Turnover Graph" s={`Turnover (${dys}d)`} ls={dd.l} vs={dd.tS} c="#4A9E8E" x="%" />}</Grid>
            <Grid item xs={12} lg={4}>{ld?<Skeleton height={340}/>:<TC t="Profit Graph" s={`Profit (${dys}d)`} ls={dd.l} vs={dd.pS} c="#C9A96E" p="₹" />}</Grid>
          </Grid>
        </Grid>
        <Grid item xs={12} xl={3.4}>
          <Box className="cortex-card dash-panel p-5" sx={{ height:'100%' }}>
            <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}><Typography variant="h6" sx={{ fontWeight:800 }}>Alerts</Typography><Button component={Link} to="/inventory/alerts" size="small" variant="outlined">All</Button></Box>
            {ld ? <Box sx={{ mt:2, display:'grid', gap:1 }}><Skeleton height={74}/><Skeleton height={74}/><Skeleton height={74}/></Box> : <>
              <WA t="Low Stock" c="warn" i={<WarnIcon sx={{fontSize:16}}/>} is={dd.inv.ls} />
              <WA t="Out of Stock" c="danger" i={<ErrIcon sx={{fontSize:16}}/>} is={dd.inv.os} />
              <WA t="Dead Stock" c="cold" i={<InvIcon sx={{fontSize:16}}/>} is={dd.inv.dS} />
            </>}
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
