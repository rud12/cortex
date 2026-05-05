import fs from 'fs/promises';
import path from 'path';
import { randomUUID as uuid } from 'crypto';
import { fileURLToPath } from 'url';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import prisma from '../utils/prisma.js';
import { success, error } from '../utils/response.js';
import { updateAlertsForProduct } from '../services/alertService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(path.resolve(__dirname, '../../../data'), 'product');
const exec = promisify(execFile);
const exts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const mimes = { 'image/jpeg':'.jpg', 'image/jpg':'.jpg', 'image/png':'.png', 'image/webp':'.webp', 'image/gif':'.gif', 'image/avif':'.avif' };

const num = (v, f=null) => isNaN(Number(v)) || v===''||v==null ? f : Number(v);
const bool = (v, f=false) => v==='true'||v==='1'||v===1||v===true;
const clean = (v, f=null) => v ? String(v).trim() : f;
const san = (v, f='d') => (v?String(v).replace(/[^A-Za-z0-9_-]/g,'_'):f)||f;
const isAdmin = u => (u?.roles||[u?.role]).some(r => /admin/i.test(r||''));

const getOwner = async (tx, u) => {
  let id = process.env.BUSINESS_ADMIN_USER_ID;
  if (id) return san(id, 'br');
  const s = await tx.appSettings.upsert({ where: { id: 'default' }, update: {}, create: { id: 'default' } });
  if (s.businessAdminUserId) return san(s.businessAdminUserId, 'br');
  if (isAdmin(u) && u?.id) {
    await tx.appSettings.update({ where: { id: 'default' }, data: { businessAdminUserId: u.id } });
    return san(u.id, 'br');
  }
  return 'br';
};

const ext = f => mimes[f?.mimetype?.toLowerCase()] || (exts.has(path.extname(f?.originalname||'').toLowerCase()) ? path.extname(f.originalname).toLowerCase() : '.jpg');
const findF = (fs, fns) => (fs||[]).find(f => fns.includes(f.fieldname));
const fMap = fs => new Map((fs||[]).map(f => [f.fieldname, f]));

const procImg = async (f, buf) => {
  if (!buf?.length) throw new Error('Empty image');
  const e = ext(f);
  if (process.platform !== 'darwin') return { buf, ext: e };
  const d = await fs.mkdtemp(path.join(os.tmpdir(), 'cortex-'));
  const src = path.join(d, `s${e}`), out = path.join(d, 'n.jpg');
  try {
    await fs.writeFile(src, buf);
    await exec('/usr/bin/sips', ['-s','format','jpeg','-s','formatOptions','85','-Z','1024',src,'--out',out]);
    return { buf: await fs.readFile(out), ext: '.jpg' };
  } catch { return { buf, ext: e }; }
  finally { await fs.rm(d, { recursive: true, force: true }); }
};

const saveImg = async (f, b, tag, segs) => {
  const { buf, ext } = await procImg(f, b);
  const dir = path.join(ROOT, ...segs);
  await fs.mkdir(dir, { recursive: true });
  const fn = `${san(tag)}-${Date.now()}-${uuid()}${ext}`, fp = path.join(dir, fn);
  await fs.writeFile(fp, buf);
  return `/inventory-data/${path.relative(path.resolve(__dirname, '../../../data'), fp).replace(/\\/g, '/')}`;
};

const parseRows = (raw) => {
  if (Array.isArray(raw)) return raw.flatMap(parseRows);
  if (typeof raw !== 'string') return raw ? [raw] : [];
  const v = raw.trim();
  if (!v) return [];
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
};

const qErr = (res, e) => {
  if (e?.code !== 'P2002') return false;
  const t = e.meta?.target || [];
  const msg = t.includes('sku') ? 'SKU already exists'
    : t.includes('variantName') ? 'Variant name already exists for this product'
    : `${t[0]||'Field'} already exists`;
  return error(res, 409, 'DUP', msg) || true;
};

const vSku = (p, v, i) => `${p}-${(v||`V${i}`).toUpperCase().replace(/[^A-Z0-9]+/g,'-').slice(0,18)}`;
const uniqueSku = async (tx, base, ex) => {
  let sku = base || `SKU-${Date.now()}`;
  for (let n = 2; await tx.product.findFirst({ where: { sku, ...(ex ? { id: { not: ex } } : {}) }, select: { id: true } }); n++) sku = `${base}-${n}`;
  return sku;
};
const dupParent = async (tx, b, ex) => b && await tx.product.findFirst({ where: { barcode: clean(b), parentProductId: null, ...(ex ? { id: { not: ex } } : {}) }, select: { id: true } });

const getSts = async () => prisma.appSettings.upsert({ where: { id: 'default' }, update: {}, create: { id: 'default' } });
const pVar = (r, i, d) => ({ id: clean(r?.id), name: clean(r?.name||r?.variantName)||`V${i+1}`, sku: clean(r?.sku), bc: clean(r?.barcode), rp: num(r?.retailPrice,0), mrp: num(r?.mrp,0), rl: num(r?.reorderLevel,0), ml: num(r?.maxStockLevel,0), cgst: num(r?.cgstRate, d.cgst), sgst: num(r?.sgstRate, d.sgst), imgF: clean(r?.imageField) });
const getP = id => prisma.product.findUnique({ where: { id }, include: { supplier: true, inventoryItem: true, variants: { include: { inventoryItem: true, supplier: true }, orderBy: { createdAt: 'asc' } }, parentProduct: { select: { id: true, sku: true, name: true } } } });

export const createProduct = async (req, res, next) => {
  try {
    const b = req.body || {}, hasV = bool(b.hasVariants), exp = bool(b.hasExpiryDate);
    const sku = clean(b.sku), name = clean(b.name), pBc = clean(b.barcode);
    if (!sku || !name) return error(res, 400, 'INV', 'SKU/name req');
    const s = await getSts(), d = { cgst: num(s.defaultCgst,0), sgst: num(s.defaultSgst,0) };
    const vars = hasV ? parseRows(b.variants).map((v,i) => pVar(v,i,d)) : [];
    if (hasV && !vars.length) return error(res, 400, 'INV', 'Variant req');
    const rp = num(b.retailPrice, hasV ? vars[0]?.rp : null), mrp = num(b.mrp, hasV ? vars[0]?.mrp : null);
    if (rp===null || mrp===null) return error(res, 400, 'INV', 'Price req');
    
    const pImg = findF(req.files, ['image','parentImage','productImage']), fM = fMap(req.files);
    
    const pid = await prisma.$transaction(async tx => {
      const ow = await getOwner(tx, req.user);
      if (await dupParent(tx, pBc)) throw { code: 'DUP_BC' };
      const p = await tx.product.create({ data: { sku, name, description: clean(b.description), brand: clean(b.brand), barcode: pBc, retailPrice: rp, mrp, reorderLevel: num(b.reorderLevel,0), maxStockLevel: num(b.maxStockLevel,0), supplierId: clean(b.supplierId), imageUrl: '/product_placeholder.png', hasVariants: hasV, hasExpiryDate: exp, cgstRate: num(b.cgstRate, d.cgst), sgstRate: num(b.sgstRate, d.sgst) } });
      await tx.inventoryItem.create({ data: { productId: p.id, quantityOnHand: 0 } });
      if (pImg?.buffer) await tx.product.update({ where: { id: p.id }, data: { imageUrl: await saveImg(pImg, pImg.buffer, `${p.id}-main`, [ow]) } });
      
      for (const [i, v] of vars.entries()) {
        const vp = await tx.product.create({ data: { sku: v.sku||await uniqueSku(tx, vSku(sku, v.name, i)), name: `${name} - ${v.name}`, description: clean(b.description), brand: clean(b.brand), barcode: v.bc, retailPrice: v.rp, mrp: v.mrp, reorderLevel: v.rl, maxStockLevel: v.ml, supplierId: clean(b.supplierId), imageUrl: '/product_placeholder.png', hasVariants: false, hasExpiryDate: exp, parentProductId: p.id, variantName: v.name, cgstRate: v.cgst, sgstRate: v.sgst } });
        await tx.inventoryItem.create({ data: { productId: vp.id, quantityOnHand: 0 } });
        const vf = fM.get(v.imgF) || fM.get(`variantImage_${i}`) || fM.get(`variantImage_${vp.id}`);
        if (vf?.buffer) await tx.product.update({ where: { id: vp.id }, data: { imageUrl: await saveImg(vf, vf.buffer, `${p.id}-${vp.id}`, [ow]) } });
      }
      return p.id;
    });
    const p = await getP(pid);
    await Promise.all([p.id, ...(p.variants||[]).map(v=>v.id)].map(updateAlertsForProduct));
    success(res, p, 'Created');
  } catch (e) {
    if (e?.code==='DUP_BC') return error(res, 409, 'DUP', 'Barcode exists');
    if (!qErr(res, e)) next(e);
  }
};

export const listProducts = async (req, res, next) => {
  try {
    const inc = /true|1|yes/i.test(req.query.includeChildren||'');
    success(res, await prisma.product.findMany({ where: inc ? undefined : { parentProductId: null }, orderBy: { createdAt: 'desc' }, include: { supplier: true, inventoryItem: true, parentProduct: { select: { id:true, sku:true, name:true } }, variants: { include: { inventoryItem: true, supplier: true }, orderBy: { createdAt: 'asc' } } } }), 'Fetched');
  } catch (e) { next(e); }
};

export const getProduct = async (req, res, next) => {
  try {
    const p = await prisma.product.findUnique({ where: { id: req.params.id }, include: { supplier: true, inventoryItem: true, parentProduct: { select: { id:true, sku:true, name:true } }, variants: { include: { inventoryItem: true, supplier: true, batches: true }, orderBy: { createdAt: 'asc' } }, batches: true } });
    p ? success(res, p, 'Fetched') : error(res, 404, 'NOT_FOUND', 'Not found');
  } catch (e) { next(e); }
};

export const updateProduct = async (req, res, next) => {
  try {
    const pInfo = await prisma.product.findUnique({ where: { id: req.params.id }, include: { variants: true } });
    if (!pInfo) return error(res, 404, 'NOT_FOUND', 'Not found');
    const b = req.body || {}, hasV = bool(b.hasVariants, pInfo.hasVariants), exp = bool(b.hasExpiryDate, pInfo.hasExpiryDate);
    const incBc = b.barcode==='' ? null : clean(b.barcode, undefined);
    const s = await getSts(), d = { cgst: num(s.defaultCgst,0), sgst: num(s.defaultSgst,0) };
    const vars = hasV ? parseRows(b.variants).map((v,i) => pVar(v,i,d)) : [];
    if (hasV && !vars.length) return error(res, 400, 'INV', 'Variant req');
    
    const pImg = findF(req.files, ['image','parentImage','productImage']), fM = fMap(req.files);
    await prisma.$transaction(async tx => {
      const ow = await getOwner(tx, req.user);
      if (!pInfo.parentProductId && incBc && await dupParent(tx, incBc, pInfo.id)) throw { code: 'DUP_BC' };
      
      const u = { sku: clean(b.sku, undefined), name: clean(b.name, undefined), description: clean(b.description, undefined), brand: clean(b.brand, undefined), supplierId: b.supplierId===''?null:clean(b.supplierId, undefined), hasVariants: hasV, hasExpiryDate: exp };
      if (!hasV) Object.assign(u, { barcode: incBc, retailPrice: num(b.retailPrice, undefined), mrp: num(b.mrp, undefined), reorderLevel: num(b.reorderLevel, undefined), maxStockLevel: num(b.maxStockLevel, undefined), cgstRate: num(b.cgstRate, undefined), sgstRate: num(b.sgstRate, undefined) });
      Object.keys(u).forEach(k => u[k]===undefined && delete u[k]);
      
      await tx.product.update({ where: { id: pInfo.id }, data: u });
      if (pImg?.buffer) await tx.product.update({ where: { id: pInfo.id }, data: { imageUrl: await saveImg(pImg, pImg.buffer, `${pInfo.id}-main`, [ow]) } });
      if (!hasV) return tx.product.deleteMany({ where: { parentProductId: pInfo.id } });
      
      const vMap = new Map(pInfo.variants.map(v => [v.id, v]));
      for (const [i, v] of vars.entries()) {
        const tid = v.id && vMap.has(v.id) ? v.id : null;
        let cId = tid;
        if (tid) await tx.product.update({ where: { id: tid }, data: { sku: v.sku||vMap.get(tid).sku, name: `${clean(b.name, pInfo.name)} - ${v.name}`, variantName: v.name, barcode: v.bc, retailPrice: v.rp, mrp: v.mrp, reorderLevel: v.rl, maxStockLevel: v.ml, cgstRate: v.cgst, sgstRate: v.sgst, hasExpiryDate: exp, supplierId: b.supplierId===''?null:clean(b.supplierId, vMap.get(tid).supplierId) } });
        else {
          const baseSku = vSku(clean(b.sku, pInfo.sku), v.name, i);
          const vp = await tx.product.create({ data: { sku: v.sku||await uniqueSku(tx, baseSku), name: `${clean(b.name, pInfo.name)} - ${v.name}`, description: clean(b.description, pInfo.description), brand: clean(b.brand, pInfo.brand), barcode: v.bc, retailPrice: v.rp, mrp: v.mrp, reorderLevel: v.rl, maxStockLevel: v.ml, supplierId: b.supplierId===''?null:clean(b.supplierId, pInfo.supplierId), imageUrl: '/product_placeholder.png', hasVariants: false, hasExpiryDate: exp, parentProductId: pInfo.id, variantName: v.name, cgstRate: v.cgst, sgstRate: v.sgst } });
          await tx.inventoryItem.create({ data: { productId: vp.id, quantityOnHand: 0 } });
          cId = vp.id;
        }
        const vf = fM.get(v.imgF) || fM.get(`variantImage_${i}`) || fM.get(`variantImage_${cId}`);
        if (vf?.buffer && cId) await tx.product.update({ where: { id: cId }, data: { imageUrl: await saveImg(vf, vf.buffer, `${pInfo.id}-${cId}`, [ow]) } });
      }
    });
    const upd = await getP(pInfo.id);
    await Promise.all([upd.id, ...(upd.variants||[]).map(v=>v.id)].map(updateAlertsForProduct));
    success(res, upd, 'Updated');
  } catch (e) {
    if (e?.code==='DUP_BC') return error(res, 409, 'DUP', 'Barcode exists');
    if (!qErr(res, e)) next(e);
  }
};

export const updateProductThresholds = async (req, res, next) => {
  try {
    const rl = num(req.body?.reorderLevel, null), ml = num(req.body?.maxStockLevel, null);
    if (rl===null || ml===null) return error(res, 400, 'INV', 'Levels req');
    const p = await prisma.product.update({ where: { id: req.params.id }, data: { reorderLevel: Math.max(0, Math.round(rl)), maxStockLevel: Math.max(0, Math.round(ml)) } });
    await updateAlertsForProduct(p.id);
    success(res, p, 'Updated');
  } catch (e) { e.code === 'P2025' ? error(res, 404, 'NOT_FOUND', 'Not found') : next(e); }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const id = req.params.id;
    await prisma.$transaction(async tx => { await tx.product.deleteMany({ where: { parentProductId: id } }); await tx.product.delete({ where: { id } }); });
    success(res, { deleted: true }, 'Deleted');
  } catch (e) { e.code === 'P2025' ? error(res, 404, 'NOT_FOUND', 'Not found') : next(e); }
};
