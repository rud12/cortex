import prisma from '../utils/prisma.js';

const resA = (pId, ts) => prisma.stockAlert.updateMany({ where: { productId: pId, type: { in: ts }, resolvedAt: null }, data: { resolvedAt: new Date() } });

const ensA = async (pId, t, m) => !await prisma.stockAlert.findFirst({ where: { productId: pId, type: t, resolvedAt: null } }) &&
  prisma.stockAlert.create({ data: { productId: pId, type: t, message: m } });

const evalA = async pId => {
  const p = await prisma.product.findUnique({
    where: { id: pId },
    include: { inventoryItem: true, batches: true, variants: { include: { inventoryItem: true, batches: true } } }
  });
  if (!p) return null;

  const isR = !p.parentProductId && p.hasVariants,
        v = p.variants || [],
        qOH = isR ? v.reduce((s, i) => s + Number(i.inventoryItem?.quantityOnHand || 0), 0)
                  : Number(p.inventoryItem?.quantityOnHand || 0);

  qOH <= 0 ? await ensA(pId, 'STOCKOUT', `${p.name} out of stock`) : await resA(pId, ['STOCKOUT']);
  p.reorderLevel > 0 && qOH <= p.reorderLevel ? await ensA(pId, 'LOW_STOCK', `${p.name} below reorder level`) : await resA(pId, ['LOW_STOCK']);
  p.maxStockLevel > 0 && qOH > p.maxStockLevel ? await ensA(pId, 'OVERSTOCK', `${p.name} exceeds max stock`) : await resA(pId, ['OVERSTOCK']);

  const b = (isR ? v.flatMap(i => i.batches || []) : p.batches || []).filter(b => Number(b.quantity || 0) > 0),
        ex = b.find(b => b.expiryDate && b.expiryDate <= new Date(Date.now() + 30 * 864e5));

  ex ? await ensA(pId, 'EXPIRY_SOON', `${p.name} batch expiring`) : await resA(pId, ['EXPIRY_SOON']);
  return p.parentProductId || null;
};

export const updateAlertsForProduct = async pId => {
  const pp = await evalA(pId);
  if (pp) await evalA(pp);
};