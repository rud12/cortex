import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, Checkbox, Dialog, DialogContent, DialogTitle, Divider, FormControlLabel, IconButton, InputAdornment, TextField, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutlineRounded';
import AddIcon from '@mui/icons-material/AddRounded';
import CameraIcon from '@mui/icons-material/CameraAltRounded';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { toast } from 'react-toastify';
import { inventoryService as api } from '../../services/api/inventoryService';

const defTax = { cgst: '0', sgst: '0' };
const emptyVar = (tx = defTax) => ({ id:'', name:'', sku:'', barcode:'', price:'', mrp:'', min:0, max:0, cgst:tx.cgst, sgst:tx.sgst, img:null });

const initForm = (d) => ({
  sku: d?.sku||'', name: d?.name||'', brand: d?.brand||'', 
  barcode: d?.barcode||'', price: d?.retailPrice??'', mrp: d?.mrp??'', min: d?.reorderLevel??0, max: d?.maxStockLevel??0,
  cgst: d?.cgstRate??'', sgst: d?.sgstRate??'', hasVar: !!d?.hasVariants, exp: !!d?.hasExpiryDate, img: null,
  vars: d?.variants?.length ? d.variants.map(v => ({
    id: v.id, name: v.variantName||'', sku: v.sku||'', barcode: v.barcode||'', price: v.retailPrice??'', mrp: v.mrp??'',
    min: v.reorderLevel??0, max: v.maxStockLevel??0, cgst: v.cgstRate??'', sgst: v.sgstRate??'', img: null
  })) : [emptyVar()]
});

const hideSpin = { '& input[type=number]': { MozAppearance:'textfield' }, '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': { WebkitAppearance:'none', m:0 } };
const digs = (v) => String(v||'').replace(/\D/g,'');
const num = (v) => v===''? '': Number(v);

export default function ProductForm({ open, onClose, initial }) {
  const isSm = useMediaQuery(useTheme().breakpoints.down('sm'));
  const [load, setLoad] = useState(false);
  const [f, setF] = useState(() => initForm(initial));
  const [tax, setTax] = useState(defTax);
  const [scan, setScan] = useState({ open: false, type: '', idx: -1 });
  const vidRef = useRef(null), stRef = useRef(null), reqRef = useRef(0);

  useEffect(() => { setF(initForm(initial)); }, [initial, open]);

  useEffect(() => {
    if(!open) return;
    api.getSettings().then(r => {
      const s = r?.data?.settings || {};
      const t = { cgst: String(s.defaultCgst??'0'), sgst: String(s.defaultSgst??'0') };
      setTax(t);
      if(!initial?.id) setF(p => ({...p, cgst: p.cgst||t.cgst, sgst: p.sgst||t.sgst, vars: p.vars.map(v => ({...v, cgst: v.cgst||t.cgst, sgst: v.sgst||t.sgst}))}));
    }).catch(()=>{});
  }, [open, initial?.id]);

  const stopVid = () => {
    cancelAnimationFrame(reqRef.current);
    stRef.current?.getTracks().forEach(t => t.stop());
    stRef.current = null;
    if(vidRef.current) vidRef.current.srcObject = null;
  };
  useEffect(() => stopVid, []);

  useEffect(() => {
    if(!scan.open) return;
    let active = true;
    (async () => {
      if(!window.BarcodeDetector) return toast.error('Barcode scanner not supported');
      const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'upc_a', 'upc_e'] });
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if(!active) return s.getTracks().forEach(t => t.stop());
      stRef.current = s;
      if(vidRef.current) { vidRef.current.srcObject = s; await vidRef.current.play().catch(()=>{}); }
      const loop = async () => {
        if(!active || !vidRef.current) return;
        try {
          const res = await det.detect(vidRef.current);
          if(res.length > 0) {
            const v = digs(res[0].rawValue);
            if(scan.type === 'v') setF(p => { const nv=[...p.vars]; nv[scan.idx].barcode = v; return {...p, vars:nv}; });
            else setF(p => ({...p, barcode: v}));
            toast.success('Barcode scanned');
            stopVid(); setScan({ open: false, type: '', idx: -1 }); return;
          }
        } catch {}
        reqRef.current = requestAnimationFrame(loop);
      };
      reqRef.current = requestAnimationFrame(loop);
    })().catch(() => toast.error('Unable to start camera'));
    return () => { active = false; stopVid(); };
  }, [scan]);

  const save = async (e) => {
    e.preventDefault();
    if(!f.sku || !f.name) return toast.error('SKU and name required');
    if(!f.hasVar && (f.price==='' || f.mrp==='')) return toast.error('Retail price and MRP required');
    if(f.hasVar && !f.vars.length) return toast.error('Variant required');
    
    const fd = new FormData();
    fd.append('sku', f.sku); fd.append('name', f.name); fd.append('brand', f.brand);
    fd.append('hasVariants', String(f.hasVar)); fd.append('hasExpiryDate', String(f.exp));

    if(!f.hasVar) {
      fd.append('barcode', f.barcode); fd.append('retailPrice', f.price); fd.append('mrp', f.mrp);
      fd.append('reorderLevel', f.min); fd.append('maxStockLevel', f.max);
      if(f.cgst !== '') fd.append('cgstRate', f.cgst);
      if(f.sgst !== '') fd.append('sgstRate', f.sgst);
    } else {
      const vars = f.vars.map((v, i) => ({
        id: v.id||undefined, name: v.name, sku: v.sku, barcode: v.barcode, retailPrice: Number(v.price), mrp: Number(v.mrp),
        reorderLevel: Number(v.min), maxStockLevel: Number(v.max), cgstRate: v.cgst===''?undefined:Number(v.cgst), sgstRate: v.sgst===''?undefined:Number(v.sgst),
        imageField: `variantImage_${i}`
      }));
      fd.append('variants', JSON.stringify(vars));
      f.vars.forEach((v, i) => { if(v.img) fd.append(`variantImage_${i}`, v.img); });
    }
    if(f.img) fd.append('image', f.img);

    setLoad(true);
    try {
      const res = initial?.id ? await api.updateProduct(initial.id, fd) : await api.createProduct(fd);
      if(!res?.success) throw new Error(res?.error?.message || 'Save failed');
      toast.success(initial?.id ? 'Product updated' : 'Created');
      onClose(true);
    } catch (err) { toast.error(err.message || 'Error saving'); }
    setLoad(false);
  };

  const update = (k, v) => setF(p => ({...p, [k]: v}));
  const updateVar = (i, k, v) => setF(p => { const nv=[...p.vars]; nv[i]={...nv[i], [k]:v}; return {...p, vars:nv}; });

  const Fbox = ({lbl, k, numT, isVar, i, props}) => (
    <TextField
      label={lbl} type={numT?'number':'text'} sx={numT?hideSpin:undefined}
      value={numT ? num(isVar ? f.vars[i][k] : f[k]) : (isVar ? f.vars[i][k] : f[k])}
      onChange={e => {
        let v = e.target.value; if(k==='barcode') v=digs(v);
        if(isVar) updateVar(i, k, v); else update(k, v);
      }}
      {...props}
    />
  );

  return (
    <Dialog open={open} onClose={() => onClose(false)} fullWidth maxWidth="md" fullScreen={isSm} PaperProps={{ className: 'cortex-dialog-paper' }}>
      <DialogTitle>{initial?.id ? 'Edit Product' : 'New Product'}</DialogTitle>
      <DialogContent>
        <Box component="form" onSubmit={save} sx={{ display: 'grid', gap: 2, mt: 1 }}>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <Fbox lbl="SKU" k="sku" /> <Fbox lbl="Name" k="name" /> <Fbox lbl="Brand" k="brand" />
            {!f.hasVar && (
              <>
                <Fbox lbl="Barcode" k="barcode" props={{
                  inputProps:{inputMode:'numeric'},
                  InputProps:{endAdornment:<InputAdornment position="end"><IconButton onClick={()=>setScan({open:true, type:'p', idx:-1})}><CameraIcon fontSize="small"/></IconButton></InputAdornment>}
                }} />
                <Fbox lbl="Retail Price" k="price" numT /> <Fbox lbl="MRP" k="mrp" numT />
                <Fbox lbl="Reorder Level" k="min" numT /> <Fbox lbl="Max Stock Level" k="max" numT />
                <Fbox lbl="CGST %" k="cgst" numT /> <Fbox lbl="SGST %" k="sgst" numT />
              </>
            )}
          </Box>
          <Box sx={{ display: 'grid', gap: 1.2 }}>
            <FormControlLabel control={<Checkbox checked={f.hasVar} onChange={e => update('hasVar', e.target.checked)} />} label="Has Variants" />
            <FormControlLabel control={<Checkbox checked={f.exp} onChange={e => update('exp', e.target.checked)} />} label="Has Expiry Date" />
            <Button variant="outlined" component="label" sx={{ width: 'fit-content' }}>
              Upload Image <input type="file" hidden accept="image/*" onChange={e => update('img', e.target.files?.[0])} />
            </Button>
            {f.img && <Typography variant="caption" sx={{ color:'rgba(255,255,255,0.7)' }}>{f.img.name}</Typography>}
          </Box>
          
          {f.hasVar && (
            <>
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>Variants</Typography>
                <Button startIcon={<AddIcon />} variant="outlined" onClick={() => setF(p => ({...p, vars: [...p.vars, emptyVar(tax)]}))}>Add</Button>
              </Box>
              <Box sx={{ display: 'grid', gap: 1.5 }}>
                {f.vars.map((v, i) => (
                  <Box key={i} sx={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 2, p: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Typography sx={{ fontWeight: 700 }}>Variant {i+1}</Typography>
                      <IconButton color="error" onClick={() => setF(p => ({...p, vars: p.vars.filter((_, idx)=>idx!==i).length ? p.vars.filter((_, idx)=>idx!==i) : [emptyVar(tax)]}))}><DeleteIcon /></IconButton>
                    </Box>
                    <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                      <Fbox lbl="Name" k="name" isVar i={i} /> <Fbox lbl="SKU (opt)" k="sku" isVar i={i} />
                      <Fbox lbl="Barcode" k="barcode" isVar i={i} props={{
                        inputProps:{inputMode:'numeric'},
                        InputProps:{endAdornment:<InputAdornment position="end"><IconButton onClick={()=>setScan({open:true, type:'v', idx:i})}><CameraIcon fontSize="small"/></IconButton></InputAdornment>}
                      }}/>
                      <Fbox lbl="Retail Price" k="price" numT isVar i={i} /> <Fbox lbl="MRP" k="mrp" numT isVar i={i} />
                      <Fbox lbl="Reorder Level" k="min" numT isVar i={i} /> <Fbox lbl="Max Stock Level" k="max" numT isVar i={i} />
                      <Fbox lbl="CGST %" k="cgst" numT isVar i={i} /> <Fbox lbl="SGST %" k="sgst" numT isVar i={i} />
                      <Button variant="outlined" component="label" sx={{ gridColumn: { xs: '1', sm: '1 / span 2' } }}>
                        Upload Var Image <input type="file" hidden accept="image/*" onChange={e => updateVar(i, 'img', e.target.files?.[0])} />
                      </Button>
                    </Box>
                    {v.img && <Typography variant="caption" sx={{ color:'rgba(255,255,255,0.7)' }}>{v.img.name}</Typography>}
                  </Box>
                ))}
              </Box>
            </>
          )}

          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 1 }}>
            <Button onClick={() => onClose(false)} variant="outlined">Cancel</Button>
            <Button type="submit" variant="contained" disabled={load}>{load?'Saving...':'Save'}</Button>
          </Box>
        </Box>
      </DialogContent>
      
      <Dialog open={scan.open} onClose={() => {stopVid(); setScan({open:false, type:'', idx:-1})}} fullWidth maxWidth="sm" PaperProps={{ className: 'cortex-dialog-paper' }}>
        <DialogTitle>Scan Barcode</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 1.2 }}>
            <Box sx={{ width:'100%', borderRadius:2, overflow:'hidden', border:'1px solid rgba(255,255,255,0.12)', bgcolor:'black', aspectRatio:'4/3' }}>
              <video ref={vidRef} autoPlay playsInline muted style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            </Box>
            <Typography variant="caption" sx={{ color:'rgba(255,255,255,0.72)' }}>Point camera at barcode.</Typography>
            <Box sx={{ display:'flex', justifyContent:'flex-end' }}>
              <Button variant="outlined" onClick={() => {stopVid(); setScan({open:false, type:'', idx:-1})}}>Close Scanner</Button>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
