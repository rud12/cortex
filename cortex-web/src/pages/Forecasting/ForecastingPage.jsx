import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Autocomplete, Box, Button, Dialog, DialogContent, DialogTitle, IconButton, InputAdornment, MenuItem, Skeleton, TextField, Typography } from '@mui/material';
import CamIcon from '@mui/icons-material/CameraAltRounded';
import { toast } from 'react-toastify';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import DraggableChartCard from '../../components/forecasting/DraggableChartCard';
import ForecastChart from '../../components/forecasting/ForecastChart';
import RecommendationCard from '../../components/forecasting/RecommendationCard';

import { forecastService as fApi } from '../../services/api/forecastService';
import { inventoryService as iApi } from '../../services/api/inventoryService';
import { formatDate as fdt } from '../../utils/formatters';

const LK = 'cortex_forecast_cards_v1', DC = [{id:'forecast',title:'Forecast',size:'large'},{id:'recommendations',title:'Recommendations',size:'medium'},{id:'metrics',title:'KPIs',size:'medium'}];
const ldLayout = () => { try{const r=localStorage.getItem(LK);if(!r)return DC;const p=JSON.parse(r);return Array.isArray(p)&&p.length?p:DC;}catch{return DC;} };
const getTh = r => { if(!r)return null; const ro=Math.max(0,+r.recommended_order_quantity||0), eo=Math.max(0,+r.eoq||0), rp=Math.max(0,+r.reorder_point||0), ss=Math.max(0,+r.safety_stock||0), nu=Math.max(0,rp-ss), rl=Math.max(0,Math.ceil(ro)), mx=Math.max(rl,Math.ceil(rl+eo-nu)); return {reorderLevel:rl, maxStockLevel:mx, normalUsageDuringMinLeadTime:nu}; };

export default function ForecastingPage() {
  const [q, setQ] = useState(''), [selP, setSelP] = useState(null), [hw, setHw] = useState(4);
  const [ld, setLd] = useState(false), [apTh, setApTh] = useState(false), [scen, setScen] = useState([]), [rec, setRec] = useState(null), [met, setMet] = useState(null), [aPId, setAPId] = useState('');
  const [cards, setCards] = useState(ldLayout), [hLd, setHLd] = useState(true), [hx, setHx] = useState([]);
  const [camOp, setCamOp] = useState(false), vRef = useRef(), sRef = useRef(), fRef = useRef();

  useEffect(()=>{try{localStorage.setItem(LK,JSON.stringify(cards))}catch{}}, [cards]);
  const mvC = (f,t) => setCards(p=>{const nx=[...p],[rm]=nx.splice(f,1);nx.splice(t,0,rm);return nx;});
  const szC = (id,s) => setCards(p=>p.map(c=>c.id===id?{...c,size:s}:c));

  const stopC = () => { if(fRef.current){cancelAnimationFrame(fRef.current);fRef.current=0;} if(sRef.current){sRef.current.getTracks().forEach(t=>t.stop());sRef.current=null;} if(vRef.current)vRef.current.srcObject=null; };
  useEffect(() => stopC, []);

  useEffect(() => {
    (async () => {
      setHLd(true);
      try {
        const r = await iApi.listProducts(1,400,{includeChildren:true}); if(!r?.success)throw new Error('Fail');
        const m = new Map();
        const col = (e,p=null) => {
          if(!e?.id||m.has(e.id))return; const isV=!!e.parentProductId||!!p?.id;
          if(!isV&&e.hasVariants){(e.variants||[]).forEach(v=>col(v,e));return;}
          const pN=String(p?.name||e.parentName||e.parentProduct?.name||'').trim(), vN=String(e.variantName||'').trim(), bN=String(e.name||'').trim();
          m.set(e.id, {id:e.id, name:isV?(pN&&vN?`${pN} / ${vN}`:vN||bN):bN, sku:e.sku||'', barcode:e.barcode||'', brand:e.brand||''});
          if(isV&&Array.isArray(e.variants)) e.variants.forEach(v=>col(v,e));
        };
        (r.data||[]).forEach(x=>col(x)); setHx(Array.from(m.values()));
      } catch{setHx([]);} finally{setHLd(false);}
    })();
  }, []);

  const fHx = useMemo(()=>{ const k=q.trim().toLowerCase(); return !k?hx.slice(0,150):hx.filter(i=>`${i.name||''} ${i.sku||''} ${i.brand||''} ${i.barcode||''}`.toLowerCase().includes(k)).slice(0,150); }, [hx,q]);

  useEffect(() => {
    if(!camOp) return; let cn=false;
    const st = async () => {
      if(!navigator.mediaDevices?.getUserMedia||!('BarcodeDetector' in window)) return toast.error('No cam'), setCamOp(false);
      const dec=new window.BarcodeDetector({formats:['ean_13','ean_8','code_128','upc_a','upc_e','qr_code']}), str=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
      if(cn)return str.getTracks().forEach(t=>t.stop()); sRef.current=str; if(!vRef.current)return; vRef.current.srcObject=str; await vRef.current.play().catch(()=>{});
      const lp = async () => { if(cn||!vRef.current)return; try{ const rs=await dec.detect(vRef.current); if(rs.length){ const c=String(rs[0].rawValue||'').trim(); const match=hx.find(i=>[i.barcode,i.sku].map(x=>String(x||'').toLowerCase()).includes(c.toLowerCase())); if(match){setSelP(match);setQ(match.sku||match.name||c);}else{setSelP(null);setQ(c);} toast.success('Scanned'); stopC(); return setCamOp(false); } }catch{} fRef.current=requestAnimationFrame(lp); };
      fRef.current=requestAnimationFrame(lp);
    };
    st().catch(()=>{toast.error('Cam fail');setCamOp(false);stopC();}); return ()=>{cn=true;stopC();};
  }, [camOp, hx]);

  const run = async () => {
    const k=q.trim().toLowerCase(), s=selP?.sku || hx.find(i=>[i.sku,i.name,i.barcode,i.brand].map(x=>String(x||'').toLowerCase()).includes(k))?.sku || q.trim();
    if(!s) return toast.error('Select product');
    setLd(true); setScen([]); setRec(null); setMet(null); setAPId('');
    try {
      const [fR,rR,mR] = await Promise.all([fApi.forecast({sku:s,horizon_weeks:hw}), fApi.recommendations({sku:s,horizon_weeks:hw}).catch(()=>null), fApi.metrics({sku:s}).catch(()=>null)]);
      if(!fR?.success) throw new Error('Fail'); setScen(fR.data?.scenarios||[]); if(fR.data?.product_id) setAPId(fR.data.product_id);
      if(rR?.success) { setRec(rR.data?.recommendation||null); if(rR.data?.product_id) setAPId(rR.data.product_id); }
      if(mR?.success) setMet(mR.data||null); toast.success('Generated');
    } catch(e) { toast.error(e.message||'Fail'); } finally { setLd(false); }
  };

  const dTh = useMemo(()=>getTh(rec), [rec]);
  const apThFn = async () => {
    const pId=selP?.id||aPId; if(!pId||!rec) return toast.error('Generate first');
    if(!dTh) return toast.error('No thresholds'); setApTh(true);
    try { const r=await iApi.updateProductThresholds(pId,{reorderLevel:dTh.reorderLevel,maxStockLevel:dTh.maxStockLevel}); if(!r?.success)throw new Error('Fail'); toast.success('Applied levels'); } catch(e){toast.error(e.message||'Fail');} finally {setApTh(false);}
  };

  const lmM = useMemo(()=>{ const ls=met?.model_metrics; return Array.isArray(ls)&&ls.length?[...ls].sort((a,b)=>String(a.metric_date).localeCompare(String(b.metric_date))).pop():null; }, [met]);

  return (
    <Box sx={{ p:2 }}>
      <Typography variant="h4" sx={{ fontWeight:850, letterSpacing:-1.2 }}>Forecasting</Typography>
      <Typography sx={{ color:'rgba(255,255,255,0.66)', mt:0.5 }}>SARIMAX forecast visualizer & recommendations.</Typography>
      <Box sx={{ mt:2 }} className="cortex-card p-5">
        <Box sx={{ display:'grid', gridTemplateColumns:{xs:'1fr', md:'2fr 1fr auto'}, gap:1.5, alignItems:'end' }}>
          <Box>
            <Autocomplete options={fHx} value={selP} inputValue={q} isOptionEqualToValue={(o,v)=>o.id===v.id} onChange={(_,v)=>{setSelP(v||null);setQ(v?v.sku:'');}} onInputChange={(_,v,r)=>{if(r==='reset')return;setQ(v);if(selP&&v!==selP.sku)setSelP(null);}} getOptionLabel={o=>typeof o==='string'?o:o.sku||o.name||''} loading={hLd} renderOption={(p,o)=><Box component="li" {...p}><Box><Typography variant="body2" sx={{fontWeight:700}}>{o.name||o.sku}</Typography><Typography variant="caption" sx={{color:'rgba(255,255,255,0.65)'}}>{[o.sku,o.barcode,o.brand].filter(Boolean).join(' • ')}</Typography></Box></Box>} renderInput={(p)=><TextField {...p} label="Product" fullWidth InputProps={{...p.InputProps, endAdornment:<><InputAdornment position="end"><IconButton onClick={()=>setCamOp(true)} size="small"><CamIcon fontSize="small"/></IconButton></InputAdornment>{p.InputProps.endAdornment}</>}} />} />
          </Box>
          <TextField select label="Horizon" value={hw} onChange={e=>setHw(e.target.value)} fullWidth>{[1,2,3,4,6,8,12].map(v=><MenuItem key={v} value={v}>{v} weeks</MenuItem>)}</TextField>
          <Button variant="contained" onClick={run} disabled={ld}>{ld?'Running...':'Generate'}</Button>
        </Box>
      </Box>

      <Box sx={{ mt:2 }}><DndProvider backend={HTML5Backend}>
        <Box sx={{ display:'flex', flexWrap:'wrap', gap:2, alignItems:'flex-start' }}>
          {cards.map((c,i) => {
            const b = (()=>{
              if(c.id==='forecast') return ld?<Skeleton height="100%"/>:!scen?.length?<div className="text-sm text-white/70">Select prod & generate</div>:<ForecastChart scenarios={scen}/>;
              if(c.id==='recommendations') return ld?<Skeleton height="100%"/>:<RecommendationCard recommendation={rec} derivedThresholds={dTh} onApplyThresholds={apThFn} applyingThresholds={apTh}/>;
              if(c.id==='metrics') return ld?<Skeleton height="100%"/>:<Box sx={{display:'grid',gap:1.25}}><Typography variant="subtitle2" sx={{fontWeight:900}}>Model Metrics</Typography>{lmM?<Box sx={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:1.25}}><Box><div className="text-xs text-white/60">As of</div><div className="text-sm font-semibold">{fdt(lmM.metric_date)}</div></Box><Box><div className="text-xs text-white/60">MAPE</div><div className="text-sm font-semibold">{(+lmM.mape||0).toFixed(3)}</div></Box><Box><div className="text-xs text-white/60">RMSE</div><div className="text-sm font-semibold">{(+lmM.rmse||0).toFixed(3)}</div></Box><Box><div className="text-xs text-white/60">Bias</div><div className="text-sm font-semibold">{(+lmM.forecast_bias||0).toFixed(3)}</div></Box></Box>:<div className="text-sm text-white/70">No metrics yet.</div>}<Typography variant="subtitle2" sx={{fontWeight:900,mt:1}}>KPIs (Proxy)</Typography>{met?.kpis?<Box sx={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:1.25}}><Box><div className="text-xs text-white/60">Turnover</div><div className="text-sm font-semibold">{(+met.kpis.inventory_turnover||0).toFixed(2)}</div></Box><Box><div className="text-xs text-white/60">Stockout rate</div><div className="text-sm font-semibold">{(+met.kpis.stockout_rate||0).toFixed(2)}</div></Box><Box><div className="text-xs text-white/60">Carrying cost</div><div className="text-sm font-semibold">{(+met.kpis.carrying_cost_proxy||0).toFixed(0)}</div></Box></Box>:<div className="text-sm text-white/70">Generate forecast.</div>}</Box>; return <div/>;
            })();
            return <DraggableChartCard key={c.id} id={c.id} index={i} title={c.title} size={c.size} onSizeChange={s=>szC(c.id,s)} moveCard={mvC}>{b}</DraggableChartCard>;
          })}
        </Box>
      </DndProvider></Box>

      <Dialog open={camOp} onClose={()=>{stopC();setCamOp(false);}} fullWidth maxWidth="sm" PaperProps={{className:'cortex-dialog-paper'}}>
        <DialogTitle>Scan Barcode</DialogTitle>
        <DialogContent><Box sx={{display:'grid',gap:1.2}}><Box sx={{w:'100%',borderRadius:2,overflow:'hidden',border:'1px solid rgba(255,255,255,0.12)',bgcolor:'black',aspectRatio:'4/3'}}><video ref={vRef} autoPlay playsInline muted style={{width:'100%',height:'100%',objectFit:'cover'}}/></Box><Typography variant="caption" sx={{color:'rgba(255,255,255,0.72)'}}>Scan barcode.</Typography><Box sx={{display:'flex',justifyContent:'flex-end'}}><Button variant="outlined" onClick={()=>{stopC();setCamOp(false);}}>Close</Button></Box></Box></DialogContent>
      </Dialog>
    </Box>
  );
}
