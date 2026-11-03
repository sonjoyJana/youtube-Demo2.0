import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;

function getTransporter() {
  if (!env.smtp.host) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined
    });
  }
  return transporter;
}

function otpEmailHtml({ name, otp, minutes, context }) {
  return `
  <div style="background:#0f0f0f;padding:32px 16px;font-family:Roboto,Arial,sans-serif">
    <div style="max-width:520px;margin:0 auto;background:#181818;border:1px solid #303030;border-radius:16px;overflow:hidden">
      <div style="padding:22px 26px;border-bottom:1px solid #303030;display:flex;align-items:center;gap:10px">
        <span style="display:inline-block;background:#ff0000;color:#fff;border-radius:6px;padding:3px 10px;font-weight:700;font-size:18px">▶ YouTube</span>
      </div>
      <div style="padding:28px 26px;color:#f1f1f1">
        <h2 style="margin:0 0 12px;font-size:21px">Verify it's you, ${name || 'there'}</h2>
        <p style="margin:0 0 20px;color:#aaaaaa;line-height:1.55;font-size:14px">
          Use the one-time password below to finish signing in. It expires in ${minutes} minutes.
        </p>
        <div style="font-size:34px;letter-spacing:12px;font-weight:700;background:#212121;border:1px solid #3f3f3f;border-radius:12px;padding:18px;text-align:center">${otp}</div>
        <p style="margin:20px 0 0;color:#aaaaaa;font-size:13px;line-height:1.6">
          ${context?.browserName ? `Requested from ${context.browserName} (${context.deviceType || 'Device'})` : ''}
          ${context?.locationLabel ? `<br/>Approximate location: ${context.locationLabel}` : ''}
          ${context?.ip ? `<br/>IP address: ${context.ip}` : ''}
        </p>
        <p style="margin:18px 0 0;color:#f28b82;font-size:13px">If this wasn't you, change your password immediately.</p>
      </div>
      <div style="padding:16px 26px;background:#0f0f0f;color:#717171;font-size:12px">YouTube account security</div>
    </div>
  </div>`;
}

async function sendEmail({ to, otp, name, context }) {
  const tx = getTransporter();
  if (!tx) return { delivered: false, provider: 'console' };

  await tx.sendMail({
    from: env.smtp.from,
    to,
    subject: `${otp} is your YouTube verification code`,
    text: `Your YouTube verification code is ${otp}. It expires in ${env.otpTtlMinutes} minutes.`,
    html: otpEmailHtml({ name, otp, minutes: env.otpTtlMinutes, context })
  });
  return { delivered: true, provider: 'smtp' };
}

async function sendSms({ to, otp }) {
  if (!env.twilio.accountSid || !env.twilio.authToken || !env.twilio.from) {
    return { delivered: false, provider: 'console' };
  }
  const body = new URLSearchParams({
    To: to,
    From: env.twilio.from,
    Body: `YouTube: ${otp} is your verification code. It expires in ${env.otpTtlMinutes} minutes.`
  });
  const auth = Buffer.from(`${env.twilio.accountSid}:${env.twilio.authToken}`).toString('base64');
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.twilio.accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Twilio delivery failed: ${response.status} ${text.slice(0, 160)}`);
  }
  return { delivered: true, provider: 'twilio' };
}

export async function deliverOtp({ user, destination, channel, otp, context }) {
  try {
    if (channel === 'mobile') {
      const to = destination.startsWith('+') ? destination : `+91${destination}`;
      const result = await sendSms({ to, otp });
      if (!result.delivered) logOtp(channel, destination, otp, context);
      return result;
    }

    const result = await sendEmail({ to: destination, otp, name: user.name, context });
    if (!result.delivered) logOtp(channel, destination, otp, context);
    return result;
  } catch (error) {
    logOtp(channel, destination, otp, context);
    console.error(`[otp] delivery error: ${error.message}`);
    return { delivered: false, provider: 'console', error: error.message };
  }
}

function logOtp(channel, destination, otp, context) {
  if (env.isProduction) {
    console.error(
      `[otp] ${channel} delivery is not configured for ${destination}; code was not logged in production.`
    );
    return;
  }

  console.log('\n============================================================');
  console.log(`  YouTube OTP (${channel}) → ${destination}`);
  console.log(`  CODE: ${otp}   (valid ${env.otpTtlMinutes} minutes)`);
  if (context?.ip) console.log(`  IP: ${context.ip}  ${context.locationLabel || ''}`);
  console.log('============================================================\n');
}
