import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Dialog, DialogContent, DialogTitle, IconButton, InputAdornment, MenuItem, Skeleton, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import CamIcon from '@mui/icons-material/CameraAltRounded';
import { toast } from 'react-toastify';
import { inventoryService as api } from '../../services/api/inventoryService';
import { formatDateTime as fdt } from '../../utils/formatters';

const eEnt = { root:'', tgt:'', b:'', exp:'', sup:'', q:'', c:'' };
const numSx = { '& input[type=number]':{MozAppearance:'textfield'}, '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button':{WebkitAppearance:'none',m:0} };

export default function StockPage() {
  const [ld, setLd] = useState(true), [ps, setPs] = useState([]), [sups, setSups] = useState([]), [q, setQ] = useState('');
  const [camOp, setCamOp] = useState(false), vRef = useRef(), sRef = useRef(), fRef = useRef();
  const [ent, setEnt] = useState(eEnt), [entOp, setEntOp] = useState(false), [sv, setSv] = useState(false);
  const [sum, setSum] = useState(null), [sumOp, setSumOp] = useState(false), [sLd, setSLd] = useState(false);

  const load = async () => {
    setLd(true);
    try {
      const [p,s] = await Promise.all([api.listProducts(1,500), api.listSuppliers().catch(()=>null)]);
      if(!p?.success) throw new Error('Load fail'); setPs(p.data||[]); if(s?.success) setSups(s.data||[]);
    } catch(e) { toast.error(e.message||'Load fail'); } finally { setLd(false); }
  };
  useEffect(() => { load(); }, []);

  const stopC = () => { if(fRef.current){cancelAnimationFrame(fRef.current);fRef.current=0;} if(sRef.current){sRef.current.getTracks().forEach(t=>t.stop());sRef.current=null;} if(vRef.current)vRef.current.srcObject=null; };
  useEffect(() => stopC, []);

  useEffect(() => {
    if(!camOp) return; let cn=false;
    const st = async () => {
      if(!navigator.mediaDevices?.getUserMedia || !('BarcodeDetector' in window)) return toast.error('No camera/scanner'), setCamOp(false);
      const dec = new window.BarcodeDetector({formats:['ean_13','ean_8','code_128','upc_a','upc_e']}), str = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
      if(cn) return str.getTracks().forEach(t=>t.stop()); sRef.current=str; if(!vRef.current)return; vRef.current.srcObject=str; await vRef.current.play().catch(()=>{});
      const lp = async () => { if(cn||!vRef.current)return; try{ const res=await dec.detect(vRef.current); if(res.length){ setQ(String(res[0].rawValue||'').replace(/\D/g,'')||res[0].rawValue); toast.success('Scanned'); stopC(); return setCamOp(false); } }catch{} fRef.current=requestAnimationFrame(lp); };
      fRef.current=requestAnimationFrame(lp);
    };
    st().catch(()=>{toast.error('Cam fail');setCamOp(false);stopC();}); return ()=>{cn=true;stopC();};
  }, [camOp]);

  const oEnt = p => { setEnt({...eEnt, root:p.id, tgt:p.variants?.[0]?.id || p.id}); setEntOp(true); };
  const oSum = async id => { setSumOp(true); setSLd(true); setSum(null); try{ const r=await api.getProductStockSummary(id); if(!r?.success)throw new Error('Fail'); setSum(r.data); }catch(e){toast.error(e.message);setSumOp(false);} finally {setSLd(false);} };

  const sRt = useMemo(()=>ps.find(p=>p.id===ent.root)||null, [ps,ent.root]), vE = sRt?.hasVariants?sRt.variants||[]:[], sTgt = (!sRt?.hasVariants)?sRt:(sRt.variants||[]).find(v=>v.id===ent.tgt)||null, reqEx = !!sTgt?.hasExpiryDate;

  const svEnt = async () => {
    if(!ent.tgt||!ent.q) return toast.error('Variant/qty req'); if(!ent.c||+ent.c<=0) return toast.error('Cost req'); if(!ent.sup) return toast.error('Supplier req'); if(reqEx&&!ent.exp) return toast.error('Expiry req');
    setSv(true);
    try {
      const r=await api.manualStockEntry({ productId:ent.tgt, batchNumber:ent.b, expiryDate:reqEx?ent.exp:null, supplierId:ent.sup, quantity:+ent.q, unitCost:+ent.c });
      if(!r?.success) throw new Error('Fail'); toast.success('Saved'); setEntOp(false); setEnt(eEnt); await load();
    } catch(e) { toast.error(e.message||'Fail'); } finally { setSv(false); }
  };

  const rows = useMemo(()=>ps.map(p=>({...p, qOH: (+p.inventoryItem?.quantityOnHand||0) + (p.variants||[]).reduce((s,i)=>s+(+i.inventoryItem?.quantityOnHand||0),0)})), [ps]);
  const fRows = useMemo(()=>{ const k=q.trim().toLowerCase(); return !k?rows:rows.filter(r=>`${r.name||''} ${r.sku||''} ${r.brand||''} ${r.barcode||''} ${(r.variants||[]).map(v=>`${v.variantName||''} ${v.name||''} ${v.sku||''} ${v.barcode||''}`).join(' ')}`.toLowerCase().includes(k)); }, [rows, q]);

  return (
    <Box sx={{ p:{xs:1.5, sm:2} }}>
      <Typography variant="h4" sx={{ fontWeight:850, letterSpacing:-1.2 }}>Stock</Typography>
      <Typography sx={{ color:'rgba(255,255,255,0.66)', mt:0.5 }}>View stock summary and add entries.</Typography>
      <Box sx={{ mt:2 }} className="cortex-card p-5">
        <TextField fullWidth size="small" label="Search" value={q} onChange={e=>setQ(e.target.value)} sx={{mb:1.5}} InputProps={{endAdornment:<InputAdornment position="end"><IconButton onClick={()=>setCamOp(true)} size="small"><CamIcon fontSize="small"/></IconButton></InputAdornment>}} />
        {ld ? <><Skeleton height={40}/><Skeleton height={260} sx={{mt:2}}/></> : (
          <Box sx={{ overflowX:'auto' }}>
            <Table size="small" sx={{ minWidth:900 }}><TableHead><TableRow><TableCell>Product</TableCell><TableCell align="right">On Hand</TableCell><TableCell>Variants</TableCell><TableCell>Updated</TableCell><TableCell>Actions</TableCell></TableRow></TableHead><TableBody>
              {fRows.map(r=><TableRow key={r.id} hover onClick={()=>oSum(r.id)} sx={{cursor:'pointer'}}><TableCell><div className="font-semibold">{r.name}</div><div className="text-xs text-white/60">{r.sku}</div></TableCell><TableCell align="right">{r.qOH}</TableCell><TableCell>{r.hasVariants?`${r.variants?.length||0} vars`:'—'}</TableCell><TableCell>{fdt(r.updatedAt)}</TableCell><TableCell onClick={e=>e.stopPropagation()}><Button variant="outlined" size="small" onClick={()=>oEnt(r)}>Manual Entry</Button></TableCell></TableRow>)}
            </TableBody></Table>
          </Box>
        )}
      </Box>

      <Dialog open={entOp} onClose={()=>setEntOp(false)} fullWidth maxWidth="sm" PaperProps={{className:'cortex-dialog-paper'}}>
        <DialogTitle>Manual Entry</DialogTitle>
        <DialogContent>
          <Box sx={{ display:'grid', gap:1.5, mt:1 }}>
            <TextField select label="Variant/Product" value={ent.tgt} onChange={e=>setEnt(p=>({...p,tgt:e.target.value}))}>{sRt&&!sRt.hasVariants&&<MenuItem value={sRt.id}>{sRt.name}</MenuItem>}{vE.map(v=><MenuItem key={v.id} value={v.id}>{v.variantName||v.name}</MenuItem>)}</TextField>
            <TextField label="Batch" value={ent.b} onChange={e=>setEnt(p=>({...p,b:e.target.value}))} />
            {reqEx&&<TextField label="Expiry" type="date" value={ent.exp} onChange={e=>setEnt(p=>({...p,exp:e.target.value}))} InputLabelProps={{shrink:true}} />}
            <TextField select label="Supplier" value={ent.sup} onChange={e=>setEnt(p=>({...p,sup:e.target.value}))}>{sups.map(s=><MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}</TextField>
            <TextField label="Qty Added" type="number" value={ent.q} onChange={e=>setEnt(p=>({...p,q:e.target.value}))} inputProps={{min:1}} sx={numSx} />
            <TextField label="Unit Cost" type="number" value={ent.c} onChange={e=>setEnt(p=>({...p,c:e.target.value}))} inputProps={{min:0,step:0.01}} sx={numSx} />
            <Box sx={{ display:'flex', justifyContent:'flex-end', gap:1, mt:1 }}><Button variant="outlined" onClick={()=>setEntOp(false)}>Cancel</Button><Button variant="contained" onClick={svEnt} disabled={sv}>{sv?'...':'Save'}</Button></Box>
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={camOp} onClose={()=>{stopC();setCamOp(false);}} fullWidth maxWidth="sm" PaperProps={{className:'cortex-dialog-paper'}}>
        <DialogTitle>Scan Barcode</DialogTitle>
        <DialogContent><Box sx={{display:'grid',gap:1.2}}><Box sx={{w:'100%',borderRadius:2,overflow:'hidden',border:'1px solid rgba(255,255,255,0.12)',bgcolor:'black',aspectRatio:'4/3'}}><video ref={vRef} autoPlay playsInline muted style={{width:'100%',height:'100%',objectFit:'cover'}}/></Box><Typography variant="caption" sx={{color:'rgba(255,255,255,0.72)'}}>Scan barcode.</Typography><Box sx={{display:'flex',justifyContent:'flex-end'}}><Button variant="outlined" onClick={()=>{stopC();setCamOp(false);}}>Close</Button></Box></Box></DialogContent>
      </Dialog>

      <Dialog open={sumOp} onClose={()=>setSumOp(false)} fullWidth maxWidth="md" PaperProps={{className:'cortex-dialog-paper'}}>
        <DialogTitle>Stock Summary</DialogTitle>
        <DialogContent>
          {sLd ? <Skeleton height={220} /> : sum ? (()=>{
            const rs = sum.product?.hasVariants?(sum.variants||[]):(sum.root?[sum.root]:[]);
            const tOH = rs.reduce((s,i)=>s+(+i.quantityOnHand||0),0);
            return <Box sx={{display:'grid',gap:1.4,mt:1}}>
              <Box sx={{display:'flex',justifyContent:'space-between'}}><Typography variant="subtitle1" sx={{fontWeight:800}}>{sum.product?.name} ({sum.product?.sku})</Typography></Box>
              <Box sx={{border:'1px solid rgba(255,255,255,0.12)',borderRadius:2,p:1.1}}><Typography variant="caption" sx={{color:'rgba(255,255,255,0.65)'}}>On Hand</Typography><Typography sx={{fontWeight:800}}>{tOH}</Typography></Box>
              <Box sx={{display:'grid',gap:1}}>
                {rs.map(i => <Box key={i.id} sx={{border:'1px solid rgba(255,255,255,0.12)',borderRadius:2,p:1.2}}>
                  <Box sx={{display:'flex',justifyContent:'space-between'}}><Typography sx={{fontWeight:700}}>{i.variantName||sum.product?.name}</Typography><Typography variant="caption">On hand {i.quantityOnHand}</Typography></Box>
                  {(i.batches||[]).length ? <Box sx={{mt:1,overflowX:'auto'}}><Table size="small"><TableHead><TableRow><TableCell>Batch</TableCell><TableCell align="right">Qty</TableCell><TableCell>Expiry</TableCell><TableCell>Supplier</TableCell></TableRow></TableHead><TableBody>{i.batches.map(b=><TableRow key={b.id}><TableCell>{b.batchNumber}</TableCell><TableCell align="right">{b.quantity}</TableCell><TableCell>{b.expiryDate?fdt(b.expiryDate):'—'}</TableCell><TableCell>{b.supplier?.name||'—'}</TableCell></TableRow>)}</TableBody></Table></Box> : <Typography variant="caption" sx={{color:'rgba(255,255,255,0.6)',mt:1,display:'block'}}>No batches.</Typography>}
                </Box>)}
              </Box>
            </Box>
          })() : null}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
