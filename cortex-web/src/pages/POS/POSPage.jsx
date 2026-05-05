import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Dialog, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import ArrowBackIcon from '@mui/icons-material/ArrowBackRounded';
import LogoutIcon from '@mui/icons-material/LogoutRounded';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import BarcodeScannerInput from '../../components/pos/BarcodeScannerInput';
import Cart from '../../components/pos/Cart';
import LiveCam from '../../components/pos/LiveBarcodeCameraCard';
import TotalsBar from '../../components/pos/TotalsBar';
import PaymentPanel from '../../components/pos/PaymentPanel';
import ReceiptPreview from '../../components/pos/ReceiptPreview';
import { inventoryService as invApi } from '../../services/api/inventoryService';
import { posService as posApi } from '../../services/api/posService';
import { formatMoney } from '../../utils/formatters';
import { useAuth } from '../../contexts/AuthContext';

const dispName = p => { if(!p) return ''; const v=String(p.variantName||'').trim(), n=String(p.parentName||p.parentProduct?.name||p.name||'').trim(); return v&&n?`${n} / ${v}`:n||v; };
const subLbl = p => { const v=String(p?.variantName||'').trim(); return v?`Variant: ${v}`:'Base product'; };
const avail = p => { const v=Number(p?.inventoryItem?.quantityOnHand ?? p?.quantityOnHand ?? 0); return Number.isFinite(v)?Math.max(0,Math.floor(v)):0; };
const isEdit = t => { if(!t) return false; const tt=String(t.tagName||'').toLowerCase(); return tt==='input'||tt==='textarea'||tt==='select'||!!t.isContentEditable; };
const dedup = ls => { const m=new Map(); (ls||[]).forEach(i => { if(i?.id&&!m.has(i.id)) m.set(i.id,i); }); return Array.from(m.values()); };

const Picker = ({ open, onClose, prods, onPick, defQ='', fs=false }) => {
  const [q, setQ] = useState(defQ);
  useEffect(()=>{if(open)setQ(defQ||'')},[open,defQ]);
  const ls = useMemo(() => {
    const all = (prods||[]).filter(p=>avail(p)>0), key = String(q||'').trim().toLowerCase();
    if(!key) return all.slice(0,50);
    return all.filter(p=>`${p.name||''} ${p.sku||''} ${p.barcode||''}`.toLowerCase().includes(key)).slice(0,100);
  }, [prods, q]);
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" fullScreen={fs} PaperProps={{ className:'cortex-dialog-paper' }}>
      <DialogTitle>Select Product</DialogTitle>
      <DialogContent>
        <TextField autoFocus label="Search" fullWidth value={q} onChange={e=>setQ(e.target.value)} sx={{mt:1}} />
        <Box sx={{ mt:2, display:'grid', gap:1 }}>
          {ls.map(p => (
            <button key={p.id} type="button" onClick={()=>onPick(p)} className="cortex-card pos-picker-product-card p-4 hover:brightness-110 transition">
              <div className="flex justify-between gap-3"><div className="min-w-0"><div className="pos-picker-product-title font-semibold truncate">{dispName(p)}</div><div className="pos-picker-product-meta text-xs truncate">SKU: {p.sku} • Barcode: {p.barcode||'—'} • {subLbl(p)}</div></div><div className="pos-picker-product-price font-extrabold">{formatMoney(p.retailPrice)}</div></div>
            </button>
          ))}
          {!ls.length && <Box className="cortex-card" sx={{ p:2, color:'rgba(255,255,255,0.75)' }}>No matches</Box>}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default function POSPage() {
  const fs = useMediaQuery(useTheme().breakpoints.down('sm')), nav = useNavigate(), { logout } = useAuth();
  const idx = useRef({ bc:{}, sku:{} }), lstScan = useRef({ c:'', t:0 });
  const [ps, setPs] = useState([]);
  const [cSt, setCSt] = useState({ loading:true, lp:0, tp:0, lps:0 });
  const [cart, setCart] = useState([]), [pm, setPm] = useState('CASH'), [subm, setSubm] = useState(false), [txn, setTxn] = useState(null);
  const [cust, setCust] = useState({ name:'', phone:'', email:'' }), [defs, setDefs] = useState({ cg:0, sg:0, upi:'' });
  const [pck, setPck] = useState({ op:false, q:'', ps:[] }), [cam, setCam] = useState(true);

  const lItems = useMemo(() => cart.map(i => ({ ...i, st: +i.unitPrice * +i.quantity, cg: (+i.unitPrice * +i.quantity * +i.cgstRate)/100, sg: (+i.unitPrice * +i.quantity * +i.sgstRate)/100 })), [cart]);
  const sTot = useMemo(()=>lItems.reduce((s,i)=>s+i.st,0), [lItems]), cgTot = useMemo(()=>lItems.reduce((s,i)=>s+i.cg,0), [lItems]), sgTot = useMemo(()=>lItems.reduce((s,i)=>s+i.sg,0), [lItems]), gTot = sTot+cgTot+sgTot;

  const add = useCallback((p, q=1) => {
    if(!p?.id) return;
    const dn=dispName(p), st=avail(p); if(st<=0) return toast.error(`${dn} out of stock`);
    setCart(pv => {
      const ex = pv.find(x=>x.productId===p.id);
      if(ex) { const nq=Math.min(+ex.quantity+Math.max(1,q), st); return nq===+ex.quantity ? pv : pv.map(x=>x.productId===p.id?{...x,quantity:nq}:x); }
      return [...pv, { productId:p.id, sku:p.sku, barcode:p.barcode||null, productName:dn, variantName:p.variantName||null, parentName:p.parentName||p.parentProduct?.name||null, unitPrice:+(p.retailPrice||0), quantity:Math.min(Math.max(1,q),st), availableStock:st, cgstRate:+(p.cgstRate??defs.cg), sgstRate:+(p.sgstRate??defs.sg) }];
    });
  }, [defs.cg, defs.sg]);

  const oPck = useCallback((pLs, q='') => { setPck({ op:true, q, ps:dedup(pLs).filter(x=>avail(x)>0) }); }, []);

  const scan = useCallback(rc => {
    const c = String(rc||'').trim(), n = Date.now(); if(!c || (lstScan.current.c===c && n-lstScan.current.t<1400)) return; lstScan.current={c,t:n};
    const bM = dedup(idx.current.bc[c]||[]), isM = bM.filter(x=>avail(x)>0);
    if(isM.length===1) return add(isM[0], 1);
    if(isM.length>1) { toast.info('Multiple matches. Select one.'); return oPck(isM, c); }
    if(bM.length>0 && !isM.length) return toast.error('Out of stock');
    const sM = idx.current.sku[c];
    if(sM) { if(avail(sM)>0) add(sM,1); else toast.error('Out of stock'); return; }
    toast.info('Not in cache. Pick manually.'); oPck(ps, c);
  }, [add, oPck, ps]);

  const loadC = async () => {
    setCSt({ loading:true, lp:0, tp:0, lps:0 }); idx.current={ bc:{}, sku:{} }; setPs([]);
    try {
      const [r1, sr] = await Promise.all([invApi.listProducts(1,200,{includeChildren:false}), invApi.getSettings().catch(()=>null)]);
      if(!r1?.success) throw new Error('Fetch fail');
      if(sr?.success) setDefs({ cg:+(sr.data?.settings?.defaultCgst||0), sg:+(sr.data?.settings?.defaultSgst||0), upi:sr.data?.settings?.upiId||'' });
      
      const flat = ls => { const f=[]; (ls||[]).forEach(i=>{f.push(i);(i.variants||[]).forEach(v=>f.push({...v,parentName:i.name||'',parentSku:i.sku||''}));}); return dedup(f); };
      const bIdx = ls => dedup(ls).forEach(p=>{if(!p?.id)return; if(p.barcode){idx.current.bc[p.barcode]=idx.current.bc[p.barcode]||[];if(!idx.current.bc[p.barcode].find(x=>x.id===p.id))idx.current.bc[p.barcode].push(p);} if(p.sku)idx.current.sku[p.sku]=p;});
      
      const all = flat(r1.data||[]), tp = r1.pagination?.totalPages||1; bIdx(all); setCSt({ loading:true, lp:1, tp, lps:all.length });
      for(let i=2; i<=tp; i++) { const r=await invApi.listProducts(i,200,{includeChildren:false}); if(!r?.success) throw new Error('Fetch fail'); const nx=flat(r.data||[]); bIdx(nx); all.push(...nx); setCSt(p=>({...p,lp:i,lps:all.length})); }
      setPs(dedup(all)); setCSt(p=>({...p,loading:false}));
    } catch(e) { setCSt(p=>({...p,loading:false})); toast.error(e.message||'Cache fail'); }
  };
  useEffect(() => { loadC(); }, []);

  const modQ = (id, qy) => {
    let c = null;
    setCart(p => p.map(i => {
      if(i.productId!==id) return i; const ms = Number.isFinite(+i.availableStock) ? Math.max(0,+i.availableStock) : 999999, nq = Math.min(qy, ms);
      if(nq!==qy && Number.isFinite(ms)) c=ms; return { ...i, quantity:Math.max(1,nq) };
    }));
    if(c!=null) toast.info(`Only ${c} in stock`);
  };

  const clr = () => { setCart([]); setTxn(null); };
  const back = () => { setCam(false); setTimeout(()=>nav(window.history.length>1?-1:'/dashboard'),80); };
  const out = async () => { setCam(false); await logout(); nav('/login',{replace:true}); };
  const lkup = async () => { if(!cust.phone) return; const r = await posApi.getCustomerByPhone(cust.phone).catch(()=>null); if(r?.data) setCust(p=>({...p, name:r.data.name||p.name, email:r.data.email||p.email})); };

  const sub = async () => {
    if(!cart.length) return toast.info('Cart empty');
    const os = cart.find(i=>Number.isFinite(+i.availableStock) && +i.quantity > Math.max(0,+i.availableStock)); if(os) return toast.error(`Exceeds stock for ${os.productName}`);
    if(!pm) return toast.error('Select payment'); if(!cust.name||!cust.phone||!cust.email) return toast.error('Customer info required');
    setSubm(true);
    try {
      const r = await posApi.createTransaction({ items:cart.map(i=>({productId:i.productId, quantity:+i.quantity})), paymentMethod:pm, customer:cust });
      if(!r?.success) throw new Error('Transaction fail'); setTxn(r.data); setCart([]); toast.success('Completed');
    } catch(e) { toast.error(e.message||'Fail'); }
    setSubm(false);
  };

  useEffect(() => {
    const hk = e => {
      if(isEdit(e.target)) return;
      if(e.key==='Escape'){e.preventDefault();clr();} if(e.key==='F2'){e.preventDefault();oPck(ps,'');} if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();sub();}
    };
    window.addEventListener('keydown',hk); return ()=>window.removeEventListener('keydown',hk);
  }, [cart, pm, cust, ps, oPck]);

  return (
    <Box sx={{ p:{xs:1.5, md:2}, minHeight:'100vh' }}>
      <BarcodeScannerInput onScan={scan} enabled />
      <Box sx={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:2, flexWrap:'wrap', px:1 }}>
        <Box><Typography variant="h4" sx={{ fontWeight:900, letterSpacing:-1.2 }}>POS</Typography></Box>
        <Box sx={{ display:'flex', gap:1, flexWrap:'wrap' }}>
          <Button variant="outlined" startIcon={<ArrowBackIcon/>} onClick={back}>Back</Button>
          <Button variant="outlined" startIcon={<LogoutIcon/>} onClick={out}>Logout</Button>
          <Button variant="outlined" onClick={()=>oPck(ps,'')}>Search (F2)</Button>
          <Button variant="outlined" color="error" onClick={clr}>Clear (Esc)</Button>
        </Box>
      </Box>
      <Box sx={{ mt:2, display:'grid', gridTemplateColumns:{xs:'1fr', lg:'1.1fr 0.9fr'}, gap:2 }}>
        <Box sx={{ display:'grid', gap:2 }}>
          {txn ? <ReceiptPreview transaction={txn} onNewSale={clr} /> : <Cart items={cart} onInc={id=>modQ(id, +(cart.find(x=>x.productId===id)?.quantity||0)+1)} onDec={id=>modQ(id, +(cart.find(x=>x.productId===id)?.quantity||0)-1)} onSetQty={(id,v)=>modQ(id, +String(v).replace(/\D/g,'')||1)} onRemove={id=>setCart(p=>p.filter(x=>x.productId!==id))} />}
        </Box>
        <Box sx={{ display:'grid', gap:2 }}>
          <LiveCam enabled={cam} onDetected={scan} cacheStatus={cSt} onRefreshCache={loadC} />
          <TotalsBar subtotal={sTot} cgstTotal={cgTot} sgstTotal={sgTot} taxTotal={cgTot+sgTot} grandTotal={gTot} />
          <PaymentPanel paymentMethod={pm} onPaymentMethodChange={setPm} onSubmit={sub} disabled={subm||!cart.length} customer={cust} onCustomerChange={(k,v)=>setCust(p=>({...p,[k]:v}))} onLookupByPhone={lkup} upiId={defs.upi} amount={gTot} />
        </Box>
      </Box>
      <Picker open={pck.op} onClose={()=>setPck(p=>({...p,op:false}))} prods={pck.ps} defQ={pck.q} fs={fs} onPick={p=>{add(p,1); setPck(x=>({...x,op:false}));}} />
    </Box>
  );
}
