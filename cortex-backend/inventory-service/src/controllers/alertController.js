import prisma from '../utils/prisma.js';
import { success } from '../utils/response.js';

export const listAlerts = async (req, res, next) => {
  try {
    const r = req.query.resolved;
    success(res, await prisma.stockAlert.findMany({ where: { resolvedAt: r==='true'?{not:null}:r==='false'?null:undefined }, include: { product: true }, orderBy: { createdAt: 'desc' } }), 'Fetched');
  } catch (err) { next(err); }
};
