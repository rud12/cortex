import prisma from '../utils/prisma.js';
import { success } from '../utils/response.js';

const updSts = async d => prisma.appSettings.upsert({ where: { id: 'default' }, update: d, create: { id: 'default', ...d } });
const num = (v, f=0) => isNaN(Number(v)) ? f : Number(v);

export const getSettings = async (req, res, next) => {
  try { success(res, { settings: await updSts({}) }, 'Fetched'); } catch (e) { next(e); }
};

export const updateBusinessSettings = async (req, res, next) => {
  try {
    const { businessName: bN, ownerName: oN, businessPhone: bP, businessEmail: bE } = req.body || {};
    const aId = req.user?.id && (req.user?.roles||[req.user?.role]).some(r => /admin/i.test(r||'')) ? String(req.user.id) : null;
    success(res, await updSts({ businessName: bN??null, ownerName: oN??null, businessPhone: bP??null, businessEmail: bE??null, ...(aId?{businessAdminUserId: aId}:{}) }), 'Updated');
  } catch (e) { next(e); }
};

export const updateTaxDefaults = async (req, res, next) => {
  try { success(res, await updSts({ defaultCgst: num(req.body?.defaultCgst), defaultSgst: num(req.body?.defaultSgst) }), 'Updated'); } catch (e) { next(e); }
};

export const updatePaymentSettings = async (req, res, next) => {
  try { success(res, await updSts({ upiId: String(req.body?.upiId||'').trim()||null }), 'Updated'); } catch (e) { next(e); }
};

export const updateThemeSettings = async (req, res, next) => {
  try { success(res, await updSts({ themeMode: String(req.body?.themeMode||'').toUpperCase() }), 'Updated'); } catch (e) { next(e); }
};
