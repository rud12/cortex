import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { createWriteStream } from 'fs';
import { Agent } from 'undici';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';

import prisma from '../utils/prisma.js';
import { success, error } from '../utils/response.js';

const INVENTORY_URL = (process.env.INVENTORY_SERVICE_URL || 'https://localhost:3002').replace(/\/+$/, '');
const NOTIFICATION_URL = (process.env.NOTIFICATION_SERVICE_URL || 'https://127.0.0.1:3007').replace(/\/+$/, '');
const DATA_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../data');
const BILL_ROOT = path.join(DATA_ROOT, 'bills');
const dispatcher = new Agent({ connect: { rejectUnauthorized: false } });

const round2 = v => Number(v.toFixed(2));
const genBill = (d = new Date()) => `BILL-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

const fetchApi = async (url, method = 'GET', token, body) => {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: token.includes('Bearer') ? token : `Bearer ${token}` }) }, body: body ? JSON.stringify(body) : undefined, dispatcher });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) throw new Error(data?.error?.message || data?.message || `API failed (${res.status})`);
  return data;
};

const createPdfBill = async ({ transaction, items, customer }) => {
  await fs.mkdir(BILL_ROOT, { recursive: true });
  const fileName = `${transaction.billNumber}-${randomUUID()}.pdf`, fullPath = path.join(BILL_ROOT, fileName);
  await new Promise((res, rej) => {
    const doc = new PDFDocument({ margin: 40 }), stream = createWriteStream(fullPath);
    doc.pipe(stream);
    doc.fontSize(18).text('CORTEX Invoice', { align: 'center' }).moveDown(0.5);
    doc.fontSize(10).text(`Bill Number: ${transaction.billNumber}`).text(`Date: ${new Date(transaction.createdAt).toLocaleString()}`).text(`Cashier: ${transaction.cashierName || '-'}`).moveDown(0.5);
    doc.fontSize(11).text(`Customer: ${customer.name}`).text(`Phone: ${customer.phone}`).text(`Email: ${customer.email}`).moveDown(0.75);
    doc.fontSize(11).text('Items', { underline: true }).moveDown(0.3);
    items.forEach(i => doc.fontSize(10).text(`${i.productName} (${i.sku}) x ${i.quantity}`).text(`Unit: ${i.unitPrice.toFixed(2)}  Subtotal: ${i.totalPrice.toFixed(2)}  CGST: ${i.cgstAmount.toFixed(2)}  SGST: ${i.sgstAmount.toFixed(2)}`).moveDown(0.2));
    doc.moveDown(0.8).fontSize(11).text(`Subtotal: ${Number(transaction.subtotal).toFixed(2)}`).text(`CGST: ${Number(transaction.cgstTotal).toFixed(2)}`).text(`SGST: ${Number(transaction.sgstTotal).toFixed(2)}`).text(`Tax Total: ${Number(transaction.taxTotal).toFixed(2)}`).text(`Discount: ${Number(transaction.discountTotal).toFixed(2)}`);
    doc.fontSize(13).text(`Grand Total: ${Number(transaction.grandTotal).toFixed(2)}`, { underline: true }).end();
    stream.on('finish', res).on('error', rej);
  });
  return { fullPath, publicPath: `/pos-data/bills/${fileName}` };
};

const sendEmail = async (to, { fullPath }, billNumber, name, total, token) => {
  if (!to) return { sent: false, reason: 'EMAIL_MISSING' };
  const html = `<div style="font-family: Arial, sans-serif;"><p>Hi ${name || 'Customer'},</p><p>Thank you for shopping with us. Your transaction <strong>${billNumber}</strong> is completed successfully. Total paid: <strong>${Number(total || 0).toFixed(2)}</strong></p><p>Regards,<br/>Cortex</p></div>`;
  await fetchApi(`${NOTIFICATION_URL}/api/v1/notifications/mail`, 'POST', token, {
    receiverMail: to, payload: { subject: `Purchase Invoice: ${billNumber}`, text: html.replace(/<[^>]+>/g, ''), html, attachments: [{ filename: path.basename(fullPath), contentBase64: (await fs.readFile(fullPath)).toString('base64'), contentType: 'application/pdf' }] }
  });
  return { sent: true };
};

export const createTransaction = async (req, res, next) => {
  try {
    const { items = [], paymentMethod, customer = {} } = req.body;
    const cust = { name: customer.name?.trim(), phone: customer.phone?.trim(), email: customer.email?.trim() };
    if (!items.length || !paymentMethod) return error(res, 400, 'INVALID_INPUT', 'Items and payment method are required');
    if (!cust.name || !cust.phone || !cust.email) return error(res, 400, 'INVALID_INPUT', 'Customer name, phone, email are required');

    const token = req.headers.authorization;
    const settings = (await fetchApi(`${INVENTORY_URL}/api/v1/settings`, 'GET', token))?.data?.settings || {};
    const [defCgst, defSgst] = [Number(settings.defaultCgst || 0), Number(settings.defaultSgst || 0)];

    const nItems = await Promise.all(items.map(async (i) => {
      if (!i?.productId || Number(i.quantity) <= 0) throw new Error('Invalid item payload');
      const p = (await fetchApi(`${INVENTORY_URL}/api/v1/products/${encodeURIComponent(i.productId)}`, 'GET', token)).data;
      if (!p) throw new Error('Product not found');
      const q = Number(i.quantity), u = round2(p.retailPrice), t = round2(u * q), cgR = round2(p.cgstRate ?? defCgst), sgR = round2(p.sgstRate ?? defSgst);
      return { productId: p.id, sku: p.sku, productName: p.name, barcode: p.barcode || null, quantity: q, unitPrice: u, totalPrice: t, cgstRate: cgR, sgstRate: sgR, cgstAmount: round2(t * cgR / 100), sgstAmount: round2(t * sgR / 100) };
    }));

    const sum = k => round2(nItems.reduce((s, i) => s + i[k], 0));
    const [sub, cgst, sgst] = [sum('totalPrice'), sum('cgstAmount'), sum('sgstAmount')];
    const tax = round2(cgst + sgst), grand = round2(sub + tax), billNumber = genBill();

    await fetchApi(`${INVENTORY_URL}/api/v1/inventory/consume`, 'POST', token, { reference: billNumber, items: nItems.map(i => ({ productId: i.productId, quantity: i.quantity })) });

    const customerRecord = await prisma.customer.upsert({ where: { phone: cust.phone }, update: { name: cust.name, email: cust.email }, create: cust });
    let txn = await prisma.transaction.create({
      data: {
        billNumber, cashierId: req.user?.id || null, cashierName: req.user?.email || req.user?.username || null,
        subtotal: sub, taxTotal: tax, cgstTotal: cgst, sgstTotal: sgst, discountTotal: 0, grandTotal: grand, paymentMethod, customerId: customerRecord.id,
        items: { create: nItems }, payments: { create: [{ method: paymentMethod, amount: grand }] }
      }, include: { items: true, payments: true, customer: true }
    });

    const bill = await createPdfBill({ transaction: txn, items: nItems, customer: cust });
    txn = await prisma.transaction.update({ where: { id: txn.id }, data: { billPdfPath: bill.publicPath }, include: { items: true, payments: true, customer: true } });
    
    const emailRes = await sendEmail(cust.email, bill, txn.billNumber, cust.name, txn.grandTotal, token).catch(() => ({ sent: false, reason: 'EMAIL_SEND_FAILED' }));
    return success(res, { ...txn, email: emailRes }, 'Transaction created');
  } catch (err) { next(err); }
};

export const listTransactions = async (req, res, next) => prisma.transaction.findMany({ orderBy: { createdAt: 'desc' }, include: { items: true, customer: true } }).then(data => success(res, data, 'Transactions fetched')).catch(next);
export const getTransaction = async (req, res, next) => prisma.transaction.findUnique({ where: { id: req.params.id }, include: { items: true, payments: true, customer: true } }).then(t => t ? success(res, t, 'Transaction fetched') : error(res, 404, 'NOT_FOUND', 'Transaction not found')).catch(next);
export const getCustomerByPhone = async (req, res, next) => prisma.customer.findUnique({ where: { phone: String(req.query.phone || '').trim() } }).then(c => success(res, c, 'Customer fetched')).catch(next);

export const getTransactionBillPdf = async (req, res, next) => {
  try {
    const t = await prisma.transaction.findUnique({ where: { id: req.params.id } });
    if (!t?.billPdfPath) return error(res, 404, 'NOT_FOUND', t ? 'Bill PDF not available' : 'Transaction not found');
    try {
      const p = path.resolve(DATA_ROOT, String(t.billPdfPath).replace(/^\/pos-data\//, ''));
      await fs.access(p); return res.sendFile(p);
    } catch {}
  } catch (e) { next(e); }
};
