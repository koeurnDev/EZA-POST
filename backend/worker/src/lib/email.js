export async function sendPasswordResetEmail(email, resetLink, env) {
  if (typeof env.RESEND_API_KEY !== "string" || !env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY Worker secret is not configured.");
  }
  if (typeof env.EMAIL_FROM !== "string" || !env.EMAIL_FROM) {
    throw new Error("EMAIL_FROM Worker variable is not configured.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email],
      subject: "Reset Your Password - EZA_POST",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #dc2626;">Reset Your Password</h2>
          <p>You requested a password reset. Use the link below to choose a new password:</p>
          <a href="${escapeHtml(resetLink)}" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
          <p style="margin-top: 20px; font-size: 12px; color: #666;">If you didn't request this, please ignore this email.</p>
          <p style="font-size: 12px; color: #666;">Link expires in 1 hour.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Resend password-reset email failed:", response.status, error.slice(0, 500));
    throw new Error("Password-reset email delivery failed.");
  }
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}
