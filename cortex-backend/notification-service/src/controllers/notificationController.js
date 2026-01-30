import nodemailer from 'nodemailer';
import { success, error } from '../utils/response.js';

export const sendViaMail = async (req, res, next) => {
  try {
    const { receiverMail, payload } = req.body || {};
    if (!receiverMail || !payload) return error(res, 400, 'INVALID', 'receiverMail and payload required');

    const user = process.env.GOOGLE_APP_EMAIL;
    const pass = process.env.GOOGLE_APP_PASSWORD;
    if (!user || !pass) return error(res, 503, 'NO_MAIL', 'Mail not configured');

    const transport = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
    
    const isObj = typeof payload === 'object';
    await transport.sendMail({
      from: user, to: receiverMail,
      subject: isObj ? payload.subject || 'Cortex Notification' : 'Cortex Notification',
      text: isObj ? String(payload.text || '') : String(payload),
      html: isObj ? String(payload.html || '') : `<pre>${payload}</pre>`,
      attachments: isObj ? (payload.attachments || []).map((a, i) => a.contentBase64 ? ({
        filename: a.filename || `att-${i}`,
        content: Buffer.from(a.contentBase64, 'base64'),
        contentType: a.contentType
      }) : null).filter(Boolean) : []
    });
    
    success(res, { channel: 'mail', receiverMail, delivered: true }, 'Mail sent');
  } catch (err) {
    next(err);
  }
};
