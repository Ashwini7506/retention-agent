import nodemailer from "nodemailer";

// POST /api/send-email
// Body: { to: string, subject: string, body: string }
// Sends a plain-text email via SMTP.

export async function POST(request: Request) {
  const { to, subject, body } = await request.json() as {
    to: string;
    subject: string;
    body: string;
  };

  if (!to || !subject || !body) {
    return Response.json({ error: "to, subject, and body are required" }, { status: 400 });
  }

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? user;

  if (!host || !user || !pass) {
    return Response.json({ error: "SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS required)" }, { status: 500 });
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from,
      to,
      subject,
      text: body,
    });

    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
