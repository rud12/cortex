import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Checkbox, Chip, Dialog, DialogContent, DialogTitle, FormControlLabel, Skeleton, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { toast } from 'react-toastify';
import POBuilder from '../../components/inventory/POBuilder';
import { inventoryService as api } from '../../services/api/inventoryService';
import { formatDate } from '../../utils/formatters';

const getStyle = s => {
  const c = s==='DRAFT'?'255,211,0': s==='SENT'?'33,150,243': s==='RECEIVED'?'0,255,209': s==='CANCELLED'?'255,107,53': '255,255,255';
  return { bg:`rgba(${c},0.16)`, b:`rgba(${c},0.35)`, row:`rgba(${c},0.05)` };
};

const amt = o => +(o?.items||[]).reduce((s, i) => s + (+(i.quantity||0) * +(i.unitPrice||0)), 0).toFixed(2);
const iLbl = i => { const n = i?.product?.name || `Product ${i?.productId||''}`.trim(), vn = String(i?.product?.variantName||'').trim(); return vn ? `${n} / ${vn}` : n; };

const bMail = o => {
  const sn = o?.supplier?.name||'Supplier', exp = o?.expectedDate?formatDate(o.expectedDate):'Not specified';
  const ls = (o?.items||[]).map((i,x) => `${x+1}. ${iLbl(i)} (${i.product?.sku||i.productId}) - Qty: ${+i.quantity}, Unit: ${(+i.unitPrice).toFixed(2)}, Total: ${(+i.quantity * +i.unitPrice).toFixed(2)}`).join('\n');
  return { sub: `Purchase Order ${o.id} from ${sn}`, txt: `Hello ${sn},\n\nDetails below.\n\nPurchase Order ID: ${o.id}\nExpected: ${exp}\n\nItems:\n${ls}\n\nTotal: ${amt(o).toFixed(2)}\n\nPlease confirm.\n\nRegards,\nCortex Inventory` };
};

const hideSpin = { '& input[type=number]':{ MozAppearance:'textfield' }, '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button':{ WebkitAppearance:'none', m:0 } };

export default function PurchaseOrdersPage() {
  const [lds, setLds] = useState({ fetch:true, act:false });
  const [ords, setOrds] = useState([]);
  const [q, setQ] = useState('');
  const [bOpen, setBOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [sel, setSel] = useState(null);
  const [dlg, setDlg] = useState({ sum:false, rev:false, conf:false });
  const [mail, setMail] = useState({ sub:'', txt:'' });
  const [conf, setConf] = useState({ o:null, s:null, chk:false });
  const [stk, setStk] = useState({ op:false, o:null, rows:[] });

  const load = async () => {
    setLds(p=>({...p,fetch:true}));
    try {
      const res = await api.listPurchaseOrders(); if(!res?.success) throw new Error('Fetch fail');
      setOrds(res.data||[]);
      if(sel?.id) setSel((res.data||[]).find(x=>x.id===sel.id)||sel);
    } catch(e) { toast.error(e.message||'Load error'); }
    setLds(p=>({...p,fetch:false}));
  };
  useEffect(() => { load(); }, []);

  const viewO = useMemo(() => {
    const k = q.trim().toLowerCase(); if(!k) return ords;
    return ords.filter(o => `${o.id} ${o.status} ${o.supplier?.name||''} ${o.supplier?.email||''}`.toLowerCase().includes(k));
  }, [ords, q]);

  const actLoad = async (fn, msg) => {
    setLds(p=>({...p,act:true}));
    try { await fn(); toast.success(msg); await load(); } catch(e) { toast.error(e.message||'Action error'); }
    setLds(p=>({...p,act:false}));
  };

  const sendPO = () => actLoad(async () => {
    const r = await api.sendPurchaseOrder(sel.id, { subject:mail.sub, text:mail.txt });
    if(!r?.success) throw new Error('Send fail'); setDlg(p=>({...p,rev:false}));
  }, 'Sent to supplier');

  const upStat = (o, s) => actLoad(async () => {
    const r = await api.updatePurchaseOrderStatus(o.id, s);
    if(!r?.success) throw new Error('Status fail');
  }, `Marked ${s.toLowerCase()}`);

  const onConf = async () => {
    const {o,s,chk} = conf; setDlg(p=>({...p,conf:false})); if(!o||!s) return;
    if(s==='RECEIVED' && chk) setStk({ op:true, o, rows:(o.items||[]).map((i,x)=>({ id:i.id, pid:i.productId, pname:iLbl(i), sku:i.product?.sku||i.productId, qty:+i.quantity, cost:+i.unitPrice, exp:!!i.product?.hasExpiryDate, bno:`PO-${String(o.id).slice(0,8)}-${x+1}`, xd:'' })) });
    else await upStat(o, s);
  };

  const saveStk = () => actLoad(async () => {
    for(const r of stk.rows) if(!r.bno?.trim() || !r.cost || +r.cost<=0 || (r.exp&&!r.xd)) throw new Error(`Missing fields for ${r.pname}`);
    for(const r of stk.rows) {
      const rs = await api.manualStockEntry({ productId:r.pid, batchNumber:r.bno, expiryDate:r.exp?r.xd:null, supplierId:stk.o.supplierId, quantity:+r.qty, unitCost:+r.cost });
      if(!rs?.success) throw new Error('Stock fail');
    }
    const rs2 = await api.updatePurchaseOrderStatus(stk.o.id, 'RECEIVED'); if(!rs2?.success) throw new Error('Status fail');
    setStk({ op:false, o:null, rows:[] });
  }, 'Stock added & marked received');

  const acts = o => (
    <Box sx={{ display:'inline-flex', gap:1, flexWrap:'wrap', justifyContent:'flex-end' }}>
      {o.status==='DRAFT' && <Button size="small" variant="outlined" onClick={()=>{setEdit(o); setBOpen(true);}}>Edit</Button>}
      {o.status==='DRAFT' && <Button size="small" variant="outlined" onClick={()=>{setSel(o); setMail(bMail(o)); setDlg(p=>({...p,rev:true}));}}>Review & Send</Button>}
      {o.status==='SENT' && <Button size="small" variant="outlined" color="secondary" onClick={()=>{setConf({o, s:'CANCELLED', chk:false}); setDlg(p=>({...p,conf:true}));}} disabled={lds.act}>Cancel</Button>}
      {o.status==='SENT' && <Button size="small" variant="outlined" onClick={()=>{setConf({o, s:'RECEIVED', chk:false}); setDlg(p=>({...p,conf:true}));}} disabled={lds.act}>Received</Button>}
      <Button size="small" variant="outlined" onClick={()=>{setSel(o); setDlg(p=>({...p,sum:true}));}}>Summary</Button>
    </Box>
  );

  return (
    <Box sx={{ p:{xs:1.5, sm:2} }}>
      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:2, flexWrap:'wrap' }}>
        <Box><Typography variant="h4" sx={{ fontWeight:850, letterSpacing:-1.2 }}>Purchase Orders</Typography></Box>
        <Button variant="contained" onClick={()=>{setEdit(null); setBOpen(true);}}>New PO</Button>
      </Box>
      <Box sx={{ mt:2 }} className="cortex-card p-5">
        <TextField fullWidth size="small" label="Search" value={q} onChange={e=>setQ(e.target.value)} sx={{mb:1.5}} />
        {lds.fetch ? <><Skeleton height={40}/><Skeleton height={240} sx={{mt:2}}/></> : (
          <Box sx={{ overflowX:'auto' }}>
            <Table size="small" sx={{ minWidth:980 }}>
              <TableHead><TableRow><TableCell>ID</TableCell><TableCell>Supplier</TableCell><TableCell>Status</TableCell><TableCell>Expected</TableCell><TableCell align="right">Items</TableCell><TableCell align="right">Amount</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
              <TableBody>
                {viewO.map(o => {
                  const s = getStyle(o.status);
                  return (
                    <TableRow key={o.id} hover onClick={()=>{setSel(o); setDlg(p=>({...p,sum:true}));}} sx={{ cursor:'pointer', bgcolor:s.row }}>
                      <TableCell>{o.id}</TableCell><TableCell>{o.supplier?.name||o.supplierId}</TableCell>
                      <TableCell><Chip size="small" label={o.status} sx={{ bgcolor:s.bg, border:`1px solid ${s.b}` }} /></TableCell>
                      <TableCell>{o.expectedDate?formatDate(o.expectedDate):'—'}</TableCell>
                      <TableCell align="right">{o.items?.length||0}</TableCell><TableCell align="right">₹{amt(o).toFixed(2)}</TableCell>
                      <TableCell align="right" onClick={e=>e.stopPropagation()}>{acts(o)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        )}
      </Box>

      <POBuilder open={bOpen} initialOrder={edit} onClose={ok => { setBOpen(false); setEdit(null); if(ok) load(); }} />

      <Dialog open={dlg.sum} onClose={()=>setDlg(p=>({...p,sum:false}))} fullWidth maxWidth="md" PaperProps={{ className:'cortex-dialog-paper' }}>
        <DialogTitle>PO Summary</DialogTitle>
        <DialogContent>
          {sel && (
            <Box sx={{ display:'grid', gap:1.2, mt:1 }}>
              <Typography><strong>ID:</strong> {sel.id}</Typography><Typography><strong>Supplier:</strong> {sel.supplier?.name||sel.supplierId}</Typography>
              <Typography><strong>Status:</strong> {sel.status}</Typography><Typography><strong>Expected:</strong> {sel.expectedDate?formatDate(sel.expectedDate):'—'}</Typography>
              <Box className="cortex-card" sx={{ p:1.5, mt:1 }}>
                <Typography sx={{ fontWeight:700, mb:1 }}>Items</Typography>
                {(sel.items||[]).map(i => <Typography key={i.id} variant="body2" sx={{ py:0.6, borderBottom:'1px solid rgba(255,255,255,0.08)' }}>{iLbl(i)} ({i.product?.sku||i.productId}) • Qty {i.quantity} • ₹{(+i.unitPrice||0).toFixed(2)}</Typography>)}
                <Typography sx={{ mt:1, fontWeight:700 }}>Total: ₹{amt(sel).toFixed(2)}</Typography>
              </Box>
              <Box sx={{ display:'flex', justifyContent:'flex-end', gap:1, mt:1 }}>{acts(sel)}<Button variant="outlined" onClick={()=>setDlg(p=>({...p,sum:false}))}>Close</Button></Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dlg.rev} onClose={()=>setDlg(p=>({...p,rev:false}))} fullWidth maxWidth="md" PaperProps={{ className:'cortex-dialog-paper' }}>
        <DialogTitle>Review & Send</DialogTitle>
        <DialogContent>
          {sel && (
            <Box sx={{ display:'grid', gap:1.2, mt:1 }}>
              <Typography><strong>To:</strong> {sel.supplier?.email||'No email'}</Typography>
              <TextField label="Subject" value={mail.sub} onChange={e=>setMail(p=>({...p,sub:e.target.value}))} />
              <TextField label="Body" multiline minRows={12} value={mail.txt} onChange={e=>setMail(p=>({...p,txt:e.target.value}))} />
              <Box sx={{ display:'flex', justifyContent:'flex-end', gap:1 }}>
                <Button variant="outlined" onClick={()=>setDlg(p=>({...p,rev:false}))}>Close</Button>
                <Button variant="contained" onClick={sendPO} disabled={lds.act||!sel.supplier?.email}>{lds.act?'Sending...':'Send'}</Button>
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dlg.conf} onClose={()=>setDlg(p=>({...p,conf:false}))} fullWidth maxWidth="sm" PaperProps={{ className:'cortex-dialog-paper' }}>
        <DialogTitle>Confirm</DialogTitle>
        <DialogContent>
          <Box sx={{ mt:1, display:'grid', gap:1.4 }}>
            <Typography>Mark as <strong>{conf.s||'-'}</strong>?</Typography>
            {conf.s==='RECEIVED' && <FormControlLabel control={<Checkbox checked={conf.chk} onChange={e=>setConf(p=>({...p,chk:e.target.checked}))}/>} label="Directly add stock" />}
            <Box sx={{ display:'flex', justifyContent:'flex-end', gap:1 }}>
              <Button variant="outlined" onClick={()=>setDlg(p=>({...p,conf:false}))}>No</Button>
              <Button variant="contained" onClick={onConf}>Yes</Button>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={stk.op} onClose={()=>setStk({op:false,o:null,rows:[]})} fullWidth maxWidth="md" PaperProps={{ className:'cortex-dialog-paper' }}>
        <DialogTitle>Stock Entry</DialogTitle>
        <DialogContent>
          <Box sx={{ mt:1, display:'grid', gap:1.2 }}>
            {stk.rows.map((r,x) => (
              <Box key={r.id||x} className="cortex-card" sx={{ p:1.5, display:'grid', gap:1, gridTemplateColumns:{xs:'1fr', md:r.exp?'1.5fr 1fr 1fr 1fr':'1.5fr 1fr 1fr'} }}>
                <TextField label="Product" value={`${r.pname} (${r.sku}) • Qty ${r.qty}`} InputProps={{ readOnly:true }} />
                <TextField label="Batch" value={r.bno} onChange={e=>setStk(p=>({...p, rows:p.rows.map((o,i)=>i===x?{...o,bno:e.target.value}:o)}))} />
                <TextField label="Unit Cost" type="number" value={r.cost} onChange={e=>setStk(p=>({...p, rows:p.rows.map((o,i)=>i===x?{...o,cost:e.target.value}:o)}))} sx={hideSpin} />
                {r.exp && <TextField label="Expiry" type="date" value={r.xd} onChange={e=>setStk(p=>({...p, rows:p.rows.map((o,i)=>i===x?{...o,xd:e.target.value}:o)}))} InputLabelProps={{shrink:true}} />}
              </Box>
            ))}
            <Box sx={{ display:'flex', justifyContent:'flex-end', gap:1, mt:1 }}>
              <Button variant="outlined" onClick={()=>setStk({op:false,o:null,rows:[]})}>Cancel</Button>
              <Button variant="contained" onClick={saveStk} disabled={lds.act}>{lds.act?'Saving...':'Save & Mark Received'}</Button>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
