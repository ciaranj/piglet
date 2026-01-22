const nodemailer = require('nodemailer');

let transporter = null;

/**
 * Get or create the email transporter
 */
function getTransporter() {
  if (!transporter) {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host) {
      console.warn('SMTP not configured - emails will be logged to console');
      return null;
    }

    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass } : undefined
    });
  }

  return transporter;
}

/**
 * Send an email
 */
async function sendEmail(to, subject, html, text) {
  const transport = getTransporter();
  const from = process.env.SMTP_FROM || 'noreply@piglet.local';

  const mailOptions = {
    from,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, '')
  };

  if (!transport) {
    // Log email to console for development
    console.log('=== EMAIL (not sent - SMTP not configured) ===');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('Body:', text || html);
    console.log('==============================================');
    return { messageId: 'console-' + Date.now() };
  }

  return transport.sendMail(mailOptions);
}

/**
 * Send a magic link email
 */
async function sendMagicLink(to, verifyUrl, siteName) {
  const subject = `Sign in to ${siteName}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
      <h2>Sign in to ${siteName}</h2>
      <p>Click the button below to sign in:</p>
      <p style="margin: 30px 0;">
        <a href="${verifyUrl}" style="background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Sign In
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">
        Or copy and paste this link into your browser:<br>
        <a href="${verifyUrl}" style="color: #0066cc;">${verifyUrl}</a>
      </p>
      <p style="color: #999; font-size: 12px; margin-top: 40px;">
        This link will expire in 1 hour. If you didn't request this email, you can safely ignore it.
      </p>
    </body>
    </html>
  `;

  const text = `
Sign in to ${siteName}

Click this link to sign in:
${verifyUrl}

This link will expire in 1 hour. If you didn't request this email, you can safely ignore it.
  `;

  return sendEmail(to, subject, html, text);
}

/**
 * Send a verification email for registration
 */
async function sendVerificationEmail(to, verifyUrl, siteName) {
  const subject = `Verify your email for ${siteName}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
      <h2>Verify your email</h2>
      <p>Thanks for registering for ${siteName}. Click the button below to verify your email address:</p>
      <p style="margin: 30px 0;">
        <a href="${verifyUrl}" style="background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Verify Email
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">
        Or copy and paste this link into your browser:<br>
        <a href="${verifyUrl}" style="color: #0066cc;">${verifyUrl}</a>
      </p>
      <p style="color: #999; font-size: 12px; margin-top: 40px;">
        This link will expire in 1 hour. If you didn't request this email, you can safely ignore it.
      </p>
    </body>
    </html>
  `;

  const text = `
Verify your email for ${siteName}

Thanks for registering. Click this link to verify your email address:
${verifyUrl}

This link will expire in 1 hour. If you didn't request this email, you can safely ignore it.
  `;

  return sendEmail(to, subject, html, text);
}

module.exports = {
  sendEmail,
  sendMagicLink,
  sendVerificationEmail
};
