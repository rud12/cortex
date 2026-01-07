import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography } from '@mui/material';
import { toast } from 'react-toastify';
import { QRCodeCanvas } from 'qrcode.react';
import { inventoryService as invApi } from '../../services/api/inventoryService';
import { visionService as visApi } from '../../services/api/visionService';

const pSum = v => { try { return typeof v==='string'?JSON.parse(v):v; } catch { return null; } };
const clamp = v => Math.max(0, Math.min(1, Number(v)||0));

export default function ReceivingPage() {
  const [mob, setMob] = useState(null);
  const [st, setSt] = useState('IDLE');
  const [sd, setSd] = useState(null);
  const [lds, setLds] = useState({ tok:false, stop:false, roi:false, sum:false });
  const [tick, setTick] = useState(0);
  const [sum, setSum] = useState(null);
  const [msg, setMsg] = useState('');
  const [roi, setRoi] = useState({ dft:null, drw:null });
  const [sumOp, setSumOp] = useState(false);
  const [rows, setRows] = useState([]);
  const [sups, setSups] = useState([]);
  const [pMap, setPmap] = useState({});

  const boxRef = useRef(null), drwRef = useRef(false), startRef = useRef(null), sidRef = useRef('');

  const src = useMemo(() => (!mob?.session_id || mob?.link_disabled) ? '' : `${visApi.sessionMjpegUrl(mob.session_id)}?v=${tick}`, [mob?.session_id, mob?.link_disabled, tick]);

  const ptr = e => {
    const r = boxRef.current?.getBoundingClientRect();
    return r ? { x: Math.max(0, Math.min(r.width, e.clientX-r.left)), y: Math.max(0, Math.min(r.height, e.clientY-r.top)), w: r.width, h: r.height } : null;
  };

  const pDown = e => {
    if(!src || !mob?.session_id || mob?.link_disabled) return;
    const p = ptr(e); if(!p) return;
    try { e.currentTarget?.setPointerCapture(e.pointerId); } catch {}
    drwRef.current = true; startRef.current = p;
    setRoi(v => ({...v, drw: {x1:p.x, y1:p.y, x2:p.x, y2:p.y, w:p.w, h:p.h}}));
  };

  const pMove = e => {
    if(!drwRef.current) return;
    const s = startRef.current, p = ptr(e); if(!s || !p) return;
    setRoi(v => ({...v, drw: {x1:s.x, y1:s.y, x2:p.x, y2:p.y, w:p.w, h:p.h}}));
  };

  const pUp = e => {
    if(!drwRef.current) return;
    drwRef.current = false;
    try { e.currentTarget?.releasePointerCapture(e.pointerId); } catch {}
    const p = ptr(e), c = roi.drw; startRef.current = null;
    if(!c || !p) return setRoi({ dft:null, drw:null });
    const x1=Math.min(c.x1,p.x), y1=Math.min(c.y1,p.y), x2=Math.max(c.x1,p.x), y2=Math.max(c.y1,p.y);
    if(x2-x1<20 || y2-y1<20) return setRoi(v => ({...v, drw:null}));
    setRoi({ dft: {x1:clamp(x1/p.w), y1:clamp(y1/p.h), x2:clamp(x2/p.w), y2:clamp(y2/p.h)}, drw:null });
  };

  const confRoi = async () => {
    if(!mob?.session_id || !roi.dft) return toast.error(mob?.session_id?'Draw ROI first':'Start session first');
    setLds(p=>({...p, roi:true}));
    try {
      const {success, data, message, error} = await visApi.setSessionRoi(mob.session_id, roi.dft);
      if(!success) throw new Error(error?.message || message || 'Fail');
      setSd(data); setRoi(v=>({...v, dft:null})); toast.success('ROI active');
    } catch(err) { toast.error(err.message); }
    setLds(p=>({...p, roi:false}));
  };

  const genLink = async () => {
    setLds(p=>({...p, tok:true}));
    try {
      const rs = await visApi.startSession({cameraId:'mobile'});
      if(!rs?.success) throw new Error(rs?.error?.message || 'Start fail');
      const sid = rs.data.session.id, rt = await visApi.mobileToken(sid);
      if(!rt?.success) throw new Error(rt?.error?.message || 'Token fail');
      const d = rt.data;
      setMob({ tok:d.token, session_id:d.session_id||sid, mobile_url:d.mobile_url, dp:d.session_data_path||'', rp:d.dataset_reference_path||'', rp_cnt:Number(d.ready_products_count||0), rl:d.ready_reference_labels||[], link_disabled:false });
      setSd({ id:d.session_id||sid, status:'ACTIVE', roi:d.roi||null, roi_confirmed:!!d.roi_confirmed });
      setSt('ACTIVE'); setTick(Date.now()); setSum(null); setMsg(''); setRoi({dft:null, drw:null});
      toast.success('Generated');
    } catch(e) { toast.error(e.message); }
    setLds(p=>({...p, tok:false}));
  };

  const buildSum = async (sm) => {
    setLds(p=>({...p, sum:true}));
    try {
      const c = sm?.counts||{}, ls = Object.keys(c); if(!ls.length) return setRows([]);
      let pg=1, ps=[], t=1;
      while(pg<=t) { const r = await invApi.listProducts(pg,200,{}); if(!r?.success) break; t=r.pagination?.totalPages||1; ps.push(...r.data||[]); pg++; }
      const sr = await invApi.listSuppliers().catch(()=>null);
      const m = {}; ps.forEach(p => m[p.id]=p); setPmap(m); setSups(sr?.data||[]);
      setRows(ls.map((l,i) => {
        const p = m[l]; return { id:`${l}-${i}`, pid:l, pname:p?.name||l, sku:p?.sku||'', exp:!!p?.hasExpiryDate, qty:Math.max(0,Number(c[l]||0)), bno:`RCV-${String(sidRef.current).slice(0,6)}-${i+1}`, xd:'', sid:'', cost:'' };
      }));
    } catch(e) { toast.error(e.message); }
    setLds(p=>({...p, sum:false}));
  };

  const stopSess = async () => {
    if(!mob?.session_id && !mob?.tok) return;
    setLds(p=>({...p, stop:true}));
    const errs=[];
    if(mob?.session_id) {
      try {
        const r = await visApi.stopSession(mob.session_id,{}); if(!r?.success) throw new Error('Stop fail');
        const s = pSum(r.data?.summary); setSum(s);
        if(s?.counts) { sidRef.current = mob.session_id; await buildSum(s); setSumOp(true); }
        setMsg(r.data?.mobile_message || 'Stopped');
      } catch(e) { errs.push(e.message); }
    }
    if(mob?.tok) await visApi.revokeMobileToken(mob.tok).catch(e=>errs.push('Revoke fail'));
    setMob(p=>p?{...p, link_disabled:true}:p); setSt('STOPPED'); setSd(p=>p?{...p, status:'STOPPED'}:p); setRoi({dft:null, drw:null});
    errs.length ? toast.error(errs.join(' | ')) : toast.success('Stopped');
    setLds(p=>({...p, stop:false}));
  };

  useEffect(() => {
    if(!mob?.session_id || mob?.link_disabled) return;
    let act=true;
    const int = setInterval(async () => {
      try {
        const r = await visApi.getSession(mob.session_id); if(!r?.success||!act) return;
        setSd(r.data); const s = String(r.data.status||'ACTIVE').toUpperCase(); setSt(s);
        setMob(p => p?{...p, roi_confirmed:!!r.data.roi_confirmed}:p);
        if(s==='STOPPED') {
          const sm = pSum(r.data.summary); setSum(sm);
          if(sm?.counts&&!sumOp) { sidRef.current=mob.session_id; await buildSum(sm); setSumOp(true); }
          setMsg(p=>p||'Stopped by receiver'); setMob(p=>p?{...p, link_disabled:true}:p);
        }
      } catch {}
    }, 2000);
    return () => { act=false; clearInterval(int); };
  }, [mob?.session_id, mob?.link_disabled, sumOp]);

  const saveSum = async () => {
    if(!rows.length) return setSumOp(false);
    for(const r of rows) {
      if(+r.qty<=0) continue;
      if(!r.bno?.trim()||!r.sid||!r.cost||+r.cost<=0||(r.exp&&!r.xd)) return toast.error(`Missing fields for ${r.pname}`);
    }
    setLds(p=>({...p, sum:true}));
    try {
      for(const r of rows) if(+r.qty>0) await invApi.manualStockEntry({ productId:r.pid, batchNumber:r.bno, expiryDate:r.exp?r.xd:null, supplierId:r.sid, quantity:+r.qty, unitCost:+r.cost });
      toast.success('Stock added'); setSumOp(false);
    } catch(e) { toast.error(e.message); }
    setLds(p=>({...p, sum:false}));
  };

  const oL = roi.dft || sd?.roi || null;
  const oLs = oL ? { left:`${clamp(oL.x1)*100}%`, top:`${clamp(oL.y1)*100}%`, width:`${(clamp(oL.x2)-clamp(oL.x1))*100}%`, height:`${(clamp(oL.y2)-clamp(oL.y1))*100}%` } : null;

  return (
    <Box sx={{ p:2, display:'grid', gap:2 }}>
      <Box sx={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:2, flexWrap:'wrap' }}>
        <Box><Typography variant="h4" sx={{ fontWeight:850, letterSpacing:-1.2 }}>Receiving</Typography></Box>
        <Box sx={{ display:'flex', gap:1 }}>
          <Button variant="outlined" onClick={genLink} disabled={lds.tok||lds.stop}>{lds.tok?'Generating':'Generate Link'}</Button>
          <Button variant="outlined" onClick={confRoi} disabled={!mob?.session_id||mob.link_disabled||!roi.dft||lds.roi||lds.stop}>{lds.roi?'Saving':'Confirm ROI'}</Button>
          <Button color="secondary" variant="contained" onClick={stopSess} disabled={!mob?.session_id||lds.stop||mob.link_disabled}>{lds.stop?'Stopping':'Stop'}</Button>
        </Box>
      </Box>

      <Box sx={{ display:'grid', gridTemplateColumns:{xs:'1fr', xl:'420px 1fr'}, gap:2 }}>
        <Box className="cortex-card" sx={{ p:2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight:800 }}>Mobile Link</Typography>
          {mob?.mobile_url ? (
            <Box sx={{ mt:2, display:'grid', gap:1.5 }}>
              <Box sx={{ p:1, borderRadius:2, bgcolor:'white', width:'fit-content' }}><QRCodeCanvas value={mob.mobile_url} size={160} /></Box>
              <Typography sx={{ fontSize:13, wordBreak:'break-all' }}>{mob.mobile_url}</Typography>
              <Box sx={{ display:'flex', gap:1, flexWrap:'wrap' }}>
                <Chip size="small" label={`Token: ${mob.tok?'Y':'N'}`} /> <Chip size="small" label={`Session: ${mob.session_id}`} />
                <Chip size="small" label={st} /> <Chip size="small" label={mob.link_disabled?'Disabled':'Active'} />
                <Chip size="small" label={`Products: ${mob.rp_cnt}`} /> <Chip size="small" color={sd?.roi_confirmed?'success':'warning'} label={`ROI: ${sd?.roi_confirmed?'Y':'N'}`} />
              </Box>
              {mob.dp && <Typography variant="caption">DP: {mob.dp}</Typography>}
            </Box>
          ) : <Box sx={{ mt:2, fontSize:13 }}>No link.</Box>}
        </Box>

        <Box className="cortex-card" sx={{ p:2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight:800 }}>Live Stream</Typography>
          <Box sx={{ mt:1.5, borderRadius:2, border:'1px solid rgba(255,255,255,0.12)', overflow:'hidden', minHeight:260, bgcolor:'rgba(0,0,0,0.25)' }}>
            {src ? (
              <Box ref={boxRef} sx={{ position:'relative', width:'100%', lineHeight:0, touchAction:'none', userSelect:'none' }} onPointerDown={pDown} onPointerMove={pMove} onPointerUp={pUp} onPointerCancel={pUp} onPointerLeave={pUp}>
                <img src={src} alt="Stream" draggable={false} style={{ width:'100%', display:'block', pointerEvents:'none' }} onError={()=>setTimeout(()=>setTick(Date.now()),600)} />
                {oLs && <Box sx={{ position:'absolute', border:`2px solid ${sd?.roi_confirmed?'rgba(20,220,146,0.95)':'rgba(255,188,66,0.95)'}`, bgcolor:sd?.roi_confirmed?'rgba(20,220,146,0.18)':'rgba(255,188,66,0.18)', pointerEvents:'none', ...oLs }} />}
                {roi.drw && <Box sx={{ position:'absolute', left:Math.min(roi.drw.x1, roi.drw.x2), top:Math.min(roi.drw.y1, roi.drw.y2), width:Math.abs(roi.drw.x2-roi.drw.x1), height:Math.abs(roi.drw.y2-roi.drw.y1), border:'2px dashed #fff', bgcolor:'rgba(255,255,255,0.12)', pointerEvents:'none' }} />}
              </Box>
            ) : <Box sx={{ p:2, fontSize:13 }}>Waiting for stream.</Box>}
          </Box>
        </Box>
      </Box>

      <Dialog open={sumOp} onClose={()=>setSumOp(false)} fullWidth maxWidth="md">
        <DialogTitle>Summary</DialogTitle>
        <DialogContent>
          {lds.sum ? <Typography>Loading...</Typography> : !rows.length ? <Typography>No products</Typography> : (
            <Box sx={{ display:'grid', gap:1 }}>
              {rows.map(r => (
                <Box key={r.id} className="cortex-card" sx={{ p:1.5, display:'grid', gap:1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight:700 }}>{r.pname} ({r.sku})</Typography>
                  <Box sx={{ display:'grid', gridTemplateColumns:{xs:'1fr', md:'repeat(2,1fr)'}, gap:1 }}>
                    <TextField label="Qty" value={r.qty} onChange={e=>setRows(p=>p.map(x=>x.id===r.id?{...x,qty:e.target.value.replace(/\D/g,'')}:x))} />
                    <TextField label="Batch" value={r.bno} onChange={e=>setRows(p=>p.map(x=>x.id===r.id?{...x,bno:e.target.value}:x))} />
                    <TextField select label="Supplier" value={r.sid} onChange={e=>setRows(p=>p.map(x=>x.id===r.id?{...x,sid:e.target.value}:x))}>
                      {sups.map(s=><MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                    </TextField>
                    <TextField label="Cost" value={r.cost} onChange={e=>setRows(p=>p.map(x=>x.id===r.id?{...x,cost:e.target.value.replace(/[^\d.]/g,'')}:x))} />
                    {r.exp && <TextField type="date" label="Expiry" value={r.xd} onChange={e=>setRows(p=>p.map(x=>x.id===r.id?{...x,xd:e.target.value}:x))} InputLabelProps={{shrink:true}} />}
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p:2 }}>
          <Button onClick={()=>setSumOp(false)} variant="outlined">Close</Button>
          <Button onClick={saveSum} variant="contained" disabled={lds.sum}>{lds.sum?'Saving':'Add Stock'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
