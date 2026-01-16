import prisma from '../utils/prisma.js';
import { success, error } from '../utils/response.js';
import { updateAlertsForProduct } from '../services/alertService.js';
import { getInventorySocket } from '../websocket/inventorySocket.js';

const bcast = p => getInventorySocket()?.broadcast({ type: 'INVENTORY_UPDATE', payload: p });
const num = (v, f=0) => isNaN(Number(v)) ? f : Number(v);
const dt = v => v && !isNaN(new Date(v)) ? new Date(v) : null;

export const listInventory = async (req, res, next) => {
  try {
    const i = await prisma.inventoryItem.findMany({ include: { product: { include: { parentProduct: { select: { id:true, name:true, sku:true } } } } }, orderBy: { updatedAt: 'desc' } });
    success(res, i.map(i => ({ id: i.id, productId: i.productId, productName: i.product.name, sku: i.product.sku, hasVariants: !!i.product.hasVariants, parentProductId: i.product.parentProductId, parentProductName: i.product.parentProduct?.name||null, variantName: i.product.variantName||null, quantityOnHand: i.quantityOnHand, updatedAt: i.updatedAt })), 'Fetched');
  } catch (e) { next(e); }
};

export const manualStockEntry = async (req, res, next) => {
  try {
    const { productId: pId, batchNumber: bNum, manufactureDate: mD, expiryDate: eD, supplierId: sId, quantity: q, unitCost: c } = req.body || {};
    if (!pId || num(q)<=0 || num(c)<=0) return error(res, 400, 'INV', 'Valid product, quantity>0, unitCost>0 req');
    const [p, s] = await Promise.all([prisma.product.findUnique({ where: { id: pId } }), sId ? prisma.supplier.findUnique({ where: { id: sId } }) : null]);
    if (!p || (sId && !s)) return error(res, 404, 'NOT_FOUND', 'Not found');
    const xDt = dt(eD);
    if (p.hasExpiryDate && !xDt) return error(res, 400, 'INV', 'Valid expiryDate req');
    
    const rt = await prisma.$transaction(async tx => {
      const inv = await tx.inventoryItem.upsert({ where: { productId: pId }, update: { quantityOnHand: { increment: num(q) } }, create: { productId: pId, quantityOnHand: num(q) } });
      const b = await tx.batch.create({ data: { productId: pId, supplierId: sId||null, batchNumber: String(bNum||`B-${Date.now()}`), manufactureDate: dt(mD), expiryDate: p.hasExpiryDate?xDt:null, quantity: num(q), unitCost: num(c) }, include: { supplier: true } });
      await tx.stockMovement.create({ data: { productId: pId, batchId: b.id, supplierId: sId||null, type: 'RECEIVE', quantity: num(q), unitCost: num(c), reference: `MANUAL:${b.batchNumber}` } });
      return { inventory: inv, batch: b };
    });
    
    await updateAlertsForProduct(pId);
    bcast({ productId: pId, quantityOnHand: rt.inventory.quantityOnHand });
    success(res, rt, 'Created');
  } catch (e) { next(e); }
};

export const receiveStock = manualStockEntry;

export const listBatches = async (req, res, next) => {
  try { success(res, await prisma.batch.findMany({ where: req.query.productId ? { productId: req.query.productId } : undefined, include: { supplier: true }, orderBy: { receivedAt: 'desc' } }), 'Fetched'); } catch (e) { next(e); }
};

export const getProductStockSummary = async (req, res, next) => {
  try {
    const r = await prisma.product.findUnique({ where: { id: req.params.id }, include: { parentProduct: true } });
    if (!r) return error(res, 404, 'NOT_FOUND', 'Not found');
    const rt = await prisma.product.findUnique({ where: { id: r.parentProductId || r.id }, include: { inventoryItem: true, batches: { include: { supplier: true }, orderBy: { receivedAt: 'desc' } }, variants: { include: { inventoryItem: true, batches: { include: { supplier: true }, orderBy: { receivedAt: 'desc' } } }, orderBy: { createdAt: 'asc' } } } });
    const s = p => ({ id: p.id, sku: p.sku, name: p.name, variantName: p.variantName||null, quantityOnHand: Number(p.inventoryItem?.quantityOnHand||0), batches: (p.batches||[]).map(b => ({ ...b, unitCost: Number(b.unitCost||0), supplier: b.supplier ? { id: b.supplier.id, name: b.supplier.name } : null })) });
    const rs = s(rt), vs = (rt.variants||[]).map(s);
    success(res, { product: { id: rt.id, sku: rt.sku, name: rt.name, hasVariants: rt.hasVariants, selectedId: r.id }, totals: [rs, ...vs].reduce((a, i) => ({ onHand: a.onHand + i.quantityOnHand }), { onHand: 0 }), root: rs, variants: vs }, 'Fetched');
  } catch (e) { next(e); }
};

export const consumeStock = async (req, res, next) => {
  try {
    const items = (Array.isArray(req.body?.items) ? req.body.items : []).map(i => ({ pId: i?.productId, q: num(i?.quantity) })).filter(i => i.pId && i.q>0);
    if (!items.length) return error(res, 400, 'INV', 'Valid items req');
    const ref = String(req.body?.reference||'SALE');

    const result = await prisma.$transaction(async tx => {
      const upds = [];
      for (const { pId, q } of items) {
        const inv = await tx.inventoryItem.findUnique({ where: { productId: pId } });
        if (!inv || num(inv.quantityOnHand)<q) throw { msg: `Insufficient stock for ${pId}`, code: 'INSF' };
        const upd = await tx.inventoryItem.update({ where: { productId: pId }, data: { quantityOnHand: { decrement: q } } });
        let rem = q;
        const bs = await tx.batch.findMany({ where: { productId: pId, quantity: { gt: 0 } }, orderBy: [{ expiryDate: 'asc' }, { receivedAt: 'asc' }] });
        for (const b of bs) {
          if (rem<=0) break;
          const c = Math.min(num(b.quantity), rem);
          if (c<=0) continue;
          await tx.batch.update({ where: { id: b.id }, data: { quantity: { decrement: c } } });
          await tx.stockMovement.create({ data: { productId: pId, batchId: b.id, supplierId: b.supplierId||null, type: 'SALE', quantity: -c, unitCost: num(b.unitCost), reference: `${ref}:${b.batchNumber}` } });
          rem -= c;
        }
        if (rem>0) await tx.stockMovement.create({ data: { productId: pId, type: 'SALE', quantity: -rem, reference: `${ref}:UNMAPPED` } });
        upds.push({ productId: pId, quantityOnHand: upd.quantityOnHand });
      }
      return upds;
    });

    await Promise.all(result.map(i => updateAlertsForProduct(i.productId)));
    result.forEach(bcast);
    success(res, { items: result }, 'Consumed');
  } catch (e) { e?.code==='INSF' ? error(res, 400, 'INSUFFICIENT_STOCK', e.msg) : next(e); }
};
