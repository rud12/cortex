import { Agent } from 'undici';
import prisma from '../utils/prisma.js';
import { success, error } from '../utils/response.js';

const NOTIF_URL = String(process.env.NOTIFICATION_SERVICE_URL) || 'https://127.0.0.1:3007';
const dsp = new Agent({ connect: { rejectUnauthorized: false } });
const INC = { supplier: true, items: { include: { product: { select: { id: true, sku: true, name: true, barcode: true, hasExpiryDate: true, variantName: true, parentProductId: true } } } } };

const dt = v => v && !isNaN(new Date(v)) ? new Date(v) : null;
const getItems = b => (Array.isArray(b)?b:[]).map(i => ({ productId: String(i?.productId||'').trim(), quantity: Number(i?.quantity||0), unitPrice: Number(i?.unitPrice||0) })).filter(i => i.productId);
const amt = o => Number((o.items||[]).reduce((s, i) => s + Number(i.quantity||0) * Number(i.unitPrice||0), 0).toFixed(2));
const lTxt = o => (o.items||[]).map((i, x) => `${x+1}. ${i.product?.name||'P'} (${i.product?.sku||i.productId}) - Qty: ${Number(i.quantity||0)}, Unit: ${Number(i.unitPrice||0).toFixed(2)}, Line Total: ${(Number(i.quantity||0)*Number(i.unitPrice||0)).toFixed(2)}`).join('\n');
const bTk = v => (String(v||'').trim().toLowerCase().startsWith('bearer ') ? String(v||'').trim().slice(7).trim() : String(v||'').trim());

const reqNotif = async (end, body, token) => {
  const r = await fetch(`${NOTIF_URL}${end}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) }, body: JSON.stringify(body||{}), dispatcher: dsp });
  const p = await r.json().catch(()=>({}));
  if (!r.ok || !p?.success) throw new Error(p?.error?.message || p?.message || `Notif failed (${r.status})`);
  return p;
};

const sendMail = async ({ to, subject, text, html, token }) => {
  if (!to || !token) throw new Error('Mail/Token req');
  return reqNotif('/api/v1/notifications/mail', { receiverMail: to, payload: { subject, text, html } }, token);
};

const getO = id => prisma.purchaseOrder.findUnique({ where: { id }, include: INC });

const buildM = (o, st) => {
  const sn = o.supplier?.name||'Supplier', ex = o.expectedDate?new Date(o.expectedDate).toLocaleDateString():'None', t = amt(o).toFixed(2), ls = lTxt(o);
  let sub = `Purchase Order ${o.id} ${st==='CANCELLED'?'Cancelled':st==='RECEIVED'?'Received':`from ${sn}`}`;
  let txt = `Hello ${sn},\n\n${st==='CANCELLED'?`PO ${o.id} cancelled.`:st==='RECEIVED'?`PO ${o.id} received.`: `Please find our PO below.`}\n\n${st==='DRAFT'?`PO ID: ${o.id}\n`:''}Expected Delivery: ${ex}\nTotal Amount: ${t}\n\nItems:\n${ls}\n\n${st==='DRAFT'?'Please confirm.':'Thank you.'}\n\nRegards,\nCortex`;
  let htm = st==='DRAFT'?`<div style="font-family:Arial;line-height:1.5"><p>Hello ${sn},</p><p>Please find our PO below.</p><p><strong>PO ID:</strong> ${o.id}<br/><strong>Expected Delivery:</strong> ${ex}</p><p><strong>Items:</strong><br/><pre>${ls}</pre></p><p><strong>Total Amount:</strong> ${t}</p><p>Please confirm.</p><p>Regards,<br/>Cortex</p></div>`:`<pre style="font-family:Arial;white-space:pre-wrap">${txt}</pre>`;
  return { subject: sub, text: txt, html: htm };
};

export const createPurchaseOrder = async (req, res, next) => {
  try {
    const { supplierId: sId, expectedDate: eD } = req.body || {}, items = getItems(req.body?.items);
    if (!sId || !items.length) return error(res, 400, 'INV', 'Supplier and items req');
    success(res, await prisma.purchaseOrder.create({ data: { supplierId: sId, expectedDate: dt(eD), items: { create: items } }, include: INC }), 'Created');
  } catch (e) { next(e); }
};

export const listPurchaseOrders = async (req, res, next) => {
  try { success(res, await prisma.purchaseOrder.findMany({ include: INC, orderBy: { createdAt: 'desc' } }), 'Fetched'); } catch (e) { next(e); }
};

export const getPurchaseOrder = async (req, res, next) => {
  try { const o = await getO(req.params.id); o ? success(res, o, 'Fetched') : error(res, 404, 'NOT_FOUND', 'Not found'); } catch (e) { next(e); }
};

export const updatePurchaseOrder = async (req, res, next) => {
  try {
    const { id } = req.params, { supplierId: sId, expectedDate: eD } = req.body || {}, items = getItems(req.body?.items);
    const ex = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!ex) return error(res, 404, 'NOT_FOUND', 'Not found');
    if (ex.status !== 'DRAFT') return error(res, 400, 'INV_STATE', 'Only DRAFT editable');
    if (!sId || !items.length) return error(res, 400, 'INV', 'Supplier and items req');
    await prisma.$transaction(async tx => {
      await tx.purchaseOrder.update({ where: { id }, data: { supplierId: sId, expectedDate: dt(eD) } });
      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
      await tx.purchaseOrderItem.createMany({ data: items.map(i => ({ purchaseOrderId: id, ...i })) });
    });
    success(res, await getO(id), 'Updated');
  } catch (e) { next(e); }
};

export const sendPurchaseOrderMail = async (req, res, next) => {
  try {
    const o = await getO(req.params.id);
    if (!o) return error(res, 404, 'NOT_FOUND', 'Not found');
    if (o.status !== 'DRAFT') return error(res, 400, 'INV_STATE', 'Only DRAFT sendable');
    if (!o.supplier?.email) return error(res, 400, 'INV', 'Email req');
    const fb = buildM(o, 'DRAFT'), c = req.body||{};
    await sendMail({ to: o.supplier.email, subject: String(c.subject||'').trim()||fb.subject, text: String(c.text||'').trim()||fb.text, html: String(c.html||'').trim()||fb.html, token: bTk(req.headers.authorization) });
    success(res, { order: await prisma.purchaseOrder.update({ where: { id: o.id }, data: { status: 'SENT' }, include: INC }), notification: { mail: true } }, 'Sent');
  } catch (e) { next(e); }
};

export const updatePurchaseOrderStatus = async (req, res, next) => {
  try {
    const st = String(req.body?.status||'').trim();
    if (!st) return error(res, 400, 'INV', 'Status req');
    const o = await getO(req.params.id);
    if (!o) return error(res, 404, 'NOT_FOUND', 'Not found');
    if (st === 'RECEIVED' || st === 'CANCELLED') {
      if (o.status !== 'SENT') return error(res, 400, 'INV_STATE', 'Only SENT updateable');
      if (!o.supplier?.email) return error(res, 400, 'INV', 'Email req');
      if (req.body?.notifySupplier !== false) await sendMail({ to: o.supplier.email, ...buildM(o, st), token: bTk(req.headers.authorization) });
    }
    success(res, await prisma.purchaseOrder.update({ where: { id: o.id }, data: { status: st }, include: INC }), 'Updated');
  } catch (e) { next(e); }
};
