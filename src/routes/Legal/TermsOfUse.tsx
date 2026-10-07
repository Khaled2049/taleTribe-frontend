import { LegalDocument } from "@/components/legal/LegalDocument";
import { termsSections } from "@/config/legal";

export default function TermsOfUse() {
  return (
    <LegalDocument
      title="Terms of Use"
      path="/terms-of-use"
      introduction="The rules for writing, sharing, and using AI on TheTaleTribe, including your content rights and responsibilities."
      sections={termsSections}
    />
  );
}
