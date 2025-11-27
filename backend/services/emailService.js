const nodemailer = require("nodemailer");

const sendEmail = async ({ to, subject, html }) => {
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: process.env.EMAIL_SECURE === "true",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        await transporter.sendMail({
            from: `"KR Post" <${process.env.EMAIL_FROM}>`,
            to,
            subject,
            html,
        });

        console.log("📧 Email sent:", to);
    } catch (err) {
        console.error("❌ Email error:", err.message);
    }
};

module.exports = { sendEmail };
