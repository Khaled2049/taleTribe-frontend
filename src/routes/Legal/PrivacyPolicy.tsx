import { LegalDocument } from "@/components/legal/LegalDocument";
import { privacySections } from "@/config/legal";

export default function PrivacyPolicy() {
  return (
    <LegalDocument
      title="Privacy Policy"
      path="/privacy-policy"
      introduction="How TheTaleTribe processes account information, stories, AI requests, and community activity, and how to make a privacy request."
      sections={privacySections}
    />
  );
}
