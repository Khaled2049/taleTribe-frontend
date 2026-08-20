import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import * as nodemailer from "nodemailer";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";

// Define configuration parameters
const smtpHost = "email-smtp.us-east-1.amazonaws.com";
const smtpPort = "587";
const smtpUser = defineSecret("SMTP_USER");
const smtpPass = defineSecret("SMTP_PASS");
const emailFrom = defineSecret("EMAIL_FROM");
const magicLinkRedirectUrl = defineSecret("MAGIC_LINK_REDIRECT_URL");

interface InviteData {
  email: string;
  status: "pending" | "approved" | "sent" | "completed" | "rejected";
  requestedAt: admin.firestore.Timestamp;
  approvedAt?: admin.firestore.Timestamp;
  sentAt?: admin.firestore.Timestamp;
  completedAt?: admin.firestore.Timestamp;
  approvedBy?: string;
  linkSentCount: number;
}

/**
 * Firestore trigger that fires when an invite document is updated.
 * When status changes to "approved", sends a magic link email.
 */
export const onInviteApproved = onDocumentUpdated(
  {
    document: "invites/{email}",
    secrets: [smtpUser, smtpPass, emailFrom, magicLinkRedirectUrl],
  },
  async (event) => {
    const beforeData = event.data?.before.data() as InviteData | undefined;
    const afterData = event.data?.after.data() as InviteData | undefined;

    if (!beforeData || !afterData) {
      logger.error("Missing document data");
      return;
    }

    // Only trigger when status changes to "approved"
    if (beforeData.status === "approved" || afterData.status !== "approved") {
      return;
    }

    const email = afterData.email;
    const documentRef = event.data?.after.ref;

    if (!documentRef) {
      logger.error("Missing document reference");
      return;
    }

    logger.info(`Processing approved invite for: ${email}`);

    const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";

    try {
      // Generate the magic link
      const redirectUrl = isEmulator
        ? (process.env.LOCAL_REDIRECT_URL ?? magicLinkRedirectUrl.value())
        : magicLinkRedirectUrl.value();

      const actionCodeSettings: admin.auth.ActionCodeSettings = {
        url: redirectUrl,
        handleCodeInApp: true,
      };

      const magicLink = await admin
        .auth()
        .generateSignInWithEmailLink(email, actionCodeSettings);

      if (isEmulator) {
        logger.info(`[EMULATOR] Magic link for ${email}: ${magicLink}`);
      }

      // Send email (skip in emulator if SMTP not configured)
      if (!isEmulator || (smtpUser.value() && smtpPass.value())) {
        try {
          // Create email transporter
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: parseInt(smtpPort, 10),
            secure: false,
            auth: {
              user: smtpUser.value(),
              pass: smtpPass.value(),
            },
            tls: {
              rejectUnauthorized: true,
            },
          });

          // Send email
          await transporter.sendMail({
            from: emailFrom.value(),
            to: email,
            subject: "You're in! Welcome to TheTaleTribe",
            html: `
              <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; background-color: #FDFCF9; color: #1a1a1a;">
                <p style="color: #B91C1C; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; margin: 0 0 8px; font-weight: bold;">TheTaleTribe</p>
                <h1 style="color: #1a1a1a; font-size: 30px; margin: 0 0 20px; line-height: 1.2;">A pen, a page, and you.</h1>

                <p style="color: #333; font-size: 16px; line-height: 1.7;">
                  Great news — your application to join the tribe has been <strong>approved</strong>!
                  Every storyteller needs a beginning, and yours is one click away. Tap the button below
                  to set up your author profile and start spinning tales.
                </p>

                <div style="text-align: center; margin: 36px 0;">
                  <a href="${magicLink}"
                     style="display: inline-block; background-color: #B91C1C; color: #ffffff;
                            padding: 15px 36px; text-decoration: none; border-radius: 10px;
                            font-size: 16px; font-weight: bold; font-family: Helvetica, Arial, sans-serif;">
                    Begin your tale
                  </a>
                </div>

                <p style="color: #666; font-size: 14px; line-height: 1.7;">
                  This magic link expires in 24 hours (even fairy tales have deadlines).
                  If the button doesn't work, copy and paste this URL into your browser:
                </p>
                <p style="color: #B91C1C; font-size: 12px; word-break: break-all;">
                  ${magicLink}
                </p>

                <hr style="border: none; border-top: 1px solid #e7e2d8; margin: 32px 0;">

                <p style="color: #999; font-size: 12px; line-height: 1.6;">
                  Didn't apply to The Tale Tribe? No worries — you can safely ignore this email,
                  and this chapter will close on its own.
                </p>
              </div>
            `,
            text: `
The Tale Tribe — A pen, a page, and you.

Great news — your application to join the tribe has been approved!
Tap the link below to set up your author profile and start spinning tales:

${magicLink}

This magic link expires in 24 hours.

Didn't apply to The Tale Tribe? You can safely ignore this email.
            `,
          });

          logger.info(`Magic link email sent to: ${email}`);
        } catch (emailError) {
          logger.warn(`Failed to send email to ${email}:`, emailError);
          if (!isEmulator) {
            throw emailError; // Re-throw in production
          }
        }
      }

      // Update the invite document
      const updateData: any = {
        status: "sent",
        sentAt: FieldValue.serverTimestamp(),
        linkSentCount: FieldValue.increment(1),
      };

      if (isEmulator) {
        updateData.magicLink = magicLink;
      }

      await documentRef.update(updateData);
    } catch (error) {
      logger.error(`Failed to process invite for ${email}:`, error);

      // Update document with error status (optional - keeps it at approved for retry)
      // await documentRef.update({
      //   lastError: (error as Error).message,
      //   lastErrorAt: FieldValue.serverTimestamp(),
      // });
    }
  },
);
