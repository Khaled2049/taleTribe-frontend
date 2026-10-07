// Keep policy versions aligned with story-data/internal/store/writer_agreement.go.
export const LEGAL_VERSION = "2026-10-07";
export const LEGAL_UPDATED = "October 7, 2026";
export const SUPPORT_EMAIL = "khaledhossain.dev@gmail.com";
export interface LegalSection {
  title: string;
  paragraphs: string[];
}
export const termsSections: LegalSection[] = [
  {
    title: "Who operates the service and who may write",
    paragraphs: [
      "TheTaleTribe is a story writing, reading, publishing, and community service operated by Khaled Hossain. These Terms govern your use of the service. Contact: khaledhossain.dev@gmail.com. Creating, importing, editing, or publishing stories requires an account, express acceptance of these Terms, and confirmation that you are at least 18 and legally able to enter into this agreement. Do not use the service if you cannot comply with these Terms.",
      "Keep your sign-in credentials secure and give accurate account information. You are responsible for activity you authorize through your account and connected tools. Tell us promptly if you suspect unauthorized access. Do not use another person’s account or evade account restrictions.",
    ],
  },
  {
    title: "Your work, permissions, and the license you grant us",
    paragraphs: [
      "You retain the rights you hold in your stories and other contributions. We do not acquire ownership of your work merely because you use the service. You must own your contributions or have the permissions or other lawful basis needed to submit and use them, including text you import, cover images, quotations, and material supplied by collaborators.",
      "You grant us a nonexclusive, worldwide, royalty-free license to store, reproduce, process, transmit, and display your contributions only as needed to operate the service, provide features you request, maintain security, and handle reports and legal obligations. This includes processing story context for AI assistance and retrieval. Publishing authorizes us to make the published material available to readers through the service and its discovery features. Private drafts are not licensed for unrelated advertising or marketing.",
      "This license ends when the relevant content is deleted from active service systems, except for copies reasonably needed for backups, security, legal obligations, or resolving disputes. Deletion cannot recall copies other people have made or remove lawful records from third-party systems. Any separate license you choose for a published work may continue according to its own terms.",
    ],
  },
  {
    title: "Originality, plagiarism, and community rules",
    paragraphs: [
      "Do not plagiarize or present someone else’s work as your own. Attribution alone does not give permission to copy protected work. Do not upload, generate, publish, or distribute material that infringes copyright, trademarks, privacy, publicity, or other rights. Do not impersonate others, publish private personal information without a lawful basis, defame or harass people, threaten violence, exploit children, or submit unlawful content.",
      "Do not use the service for fraud, spam, malware, unauthorized access, scraping that violates others’ rights, bypassing quotas or billing, or disrupting the service. Apply these rules to stories, imports, images, community posts, AI prompts, and connected tools. You remain responsible for reviewing what you submit and publish.",
    ],
  },
  {
    title: "AI assistance and connected services",
    paragraphs: [
      "AI assistance may send your prompts, relevant story and worldbuilding context, conversation content, and settings to the model or infrastructure providers involved in the feature. Indexing and retrieval may also process story text through an embedding provider. Review the Privacy Policy before using these features and avoid submitting secrets or sensitive information you are not authorized to share.",
      "AI output can be inaccurate, biased, similar to existing works, or unsuitable for publication. We do not guarantee originality, copyright eligibility, exclusivity, accuracy, or noninfringement. Review and edit output, check relevant sources and permissions, and comply with any applicable disclosure requirements before publication. AI output is not professional legal, medical, financial, or other advice.",
      "External providers, wallets, and tools have their own terms. Connecting a tool does not authorize it to agree to new Terms for you. You are responsible for the access you grant and for revoking it when appropriate.",
    ],
  },
  {
    title: "Publishing and moderation",
    paragraphs: [
      "Published stories and public community activity can be read, indexed, quoted, or copied by others. Publish only material you are comfortable making public. Keep your own backups of important work. You are responsible for choosing accurate audience labels and content warnings where available.",
      "We may restrict access to content, unpublish it, or suspend or terminate accounts for violations, credible rights or safety complaints, security risks, or legal requirements. Where appropriate and lawful, we may notify you and allow you to respond. We are not required to review every contribution before it appears, and hosting a contribution does not mean we endorse it. You may ask for a moderation review through Help & Support.",
    ],
  },
  {
    title: "Copyright complaints and repeat infringement",
    paragraphs: [
      "If you believe material on the service infringes your copyright, use the copyright reporting instructions in Help & Support. Identify the work, the specific service URLs, your contact information, your authority to report, and the required good-faith and accuracy statements. We may request further information and remove or disable access when appropriate. Do not submit knowingly false claims.",
      "We maintain a policy to terminate, in appropriate circumstances, accounts of repeat copyright infringers. A content-rights checkbox does not establish ownership or replace our handling of complaints. A user who believes material was removed by mistake may contact support to request review or obtain counter-notice instructions.",
    ],
  },
  {
    title: "Credits, payments, competitions, and wallets",
    paragraphs: [
      "Where paid features or credits are available, review the displayed price, usage rules, and any additional terms before authorizing a purchase. Usage and remaining credit balances depend on the relevant feature. Ask support about billing errors and refunds; mandatory consumer rights still apply. These Terms do not exclude refunds required by law.",
      "Competitions may have additional eligibility, submission, voting, and prize rules. Review those rules before entering; we do not guarantee prizes or earnings outside the stated rules. Do not manipulate voting or use content you lack rights to enter.",
      "Wallet transactions may be public, incur network fees, and be irreversible. You are responsible for checking the address, amount, and network before approving a transaction. Never provide us with your seed phrase or private key. We do not guarantee the value of digital assets or provide investment advice.",
    ],
  },
  {
    title: "Privacy and communications",
    paragraphs: [
      "The Privacy Policy describes the data we process, service providers, public visibility, retention, and available choices. Acknowledging that policy is not blanket consent to every use of data and does not waive your privacy rights. We may send necessary account, security, billing, or service communications. Acceptance of these Terms does not opt you into marketing.",
    ],
  },
  {
    title: "Availability and warranties",
    paragraphs: [
      "To the extent permitted by applicable law, the service is provided “as is” and “as available,” without warranties of merchantability, fitness for a particular purpose, or noninfringement. We do not promise uninterrupted availability, error-free operation, permanent storage, or any particular result from writing, publishing, or AI features. Mandatory warranties and consumer protections are unaffected.",
    ],
  },
  {
    title: "Limits of liability",
    paragraphs: [
      "To the extent permitted by applicable law, Khaled Hossain and those providing the service are not liable for indirect, incidental, special, consequential, or punitive losses, including lost profits or opportunities, arising from use of the service. To that same extent, our total liability for claims arising out of the service is limited to the greater of US $100 or the amount you paid us for the service in the 12 months before the event giving rise to the claim.",
      "These limits do not exclude or limit liability that cannot lawfully be excluded or limited, including fraud, willful misconduct, or any applicable liability for personal injury or mandatory consumer rights. Some jurisdictions do not allow particular limitations, so those limitations apply only where lawful.",
    ],
  },
  {
    title: "Responsibility for third-party claims",
    paragraphs: [
      "To the extent permitted by applicable law, you agree to indemnify the operator for reasonable losses, damages, and legal costs arising from third-party claims caused by content you submit that infringes their rights, your unlawful use of the service, or your material breach of these Terms. This obligation does not apply to losses caused by our own unlawful conduct or to the extent prohibited by consumer law. We will give you reasonable notice of such a claim and an opportunity to participate in its defense; a settlement cannot impose an obligation on you without your consent.",
    ],
  },
  {
    title: "Ending use and resolving problems",
    paragraphs: [
      "You may stop using the service, delete your stories through available controls, or contact support about account deletion. We may discontinue features or the service, subject to any notice or other obligation imposed by applicable law. Provisions that reasonably need to continue, such as accrued payment obligations, lawful record retention, and responsibility for earlier conduct, survive termination.",
      "Contact support first if you wish to discuss a dispute; doing so is not a prerequisite to exercising legal rights. These Terms do not require arbitration, waive class actions, or remove mandatory local consumer protections. Applicable law and competent courts determine rights and disputes where these Terms do not specify otherwise. If a provision is unenforceable, the remaining provisions continue to the extent lawful.",
    ],
  },
  {
    title: "Policy changes and records of agreement",
    paragraphs: [
      "We identify the current Terms, Privacy Policy, and writer attestation by version and record your account ID, the accepted versions, and a server-generated acceptance time. We may update these documents as features or legal requirements change. Material changes to the writing agreement require you to review and accept the new version before further writing. Changes do not retroactively change the terms of an existing dispute. Ask support for a copy of the versions associated with your agreement.",
    ],
  },
];
export const privacySections: LegalSection[] = [
  {
    title: "Operator and scope",
    paragraphs: [
      "This policy describes how TheTaleTribe, operated by Khaled Hossain, processes information through its story writing, publishing, AI, and community features. For privacy questions or requests, contact khaledhossain.dev@gmail.com. This policy describes our practices; it does not transfer ownership of your work or ask you to waive privacy rights.",
    ],
  },
  {
    title: "Information we process",
    paragraphs: [
      "Account information includes your authentication identifier, email address, sign-in details provided by your identity provider, and profile information you choose to supply, such as your display name, biography, and photo. Firebase Authentication provides account identity.",
      "Content includes stories, chapters, imported text, cover images, characters, places, plots, summaries, comments, community contributions, AI prompts and responses, assistant conversations, and other material you save or submit. Preferences and activity include reading progress and history, likes, ratings, follows, book clubs, competition activity, and settings.",
      "Operational records can include request timestamps, account identifiers, IP or client network addresses, request paths, error details, usage and credit records, security signals, and support correspondence. We also record the versions and time of your writer agreement. Connected AI settings can include provider choices and API credentials you supply. Do not send passwords, wallet private keys, or seed phrases to support.",
    ],
  },
  {
    title: "How information is used",
    paragraphs: [
      "We process information to authenticate accounts; save and display work; provide reading, community, and publishing features; personalize discovery; provide AI assistance and story-context retrieval; meter usage and credits; investigate errors and abuse; handle support and rights complaints; and comply with applicable law. Reading and engagement signals may be used to improve story recommendations.",
      "We may send account, security, billing, and service messages. Agreeing to the writer terms does not subscribe you to marketing. We do not sell personal information or share it for cross-context behavioral advertising.",
    ],
  },
  {
    title: "Private drafts and public contributions",
    paragraphs: [
      "Unpublished story drafts are available through author workspace features rather than public story listings. They are still processed by service infrastructure and, for relevant features, AI and embedding providers. Authorized access may be necessary for support, security, rights complaints, or legal obligations.",
      "Publishing makes the published story, associated metadata, and displayed author details available to other people. Public profiles, comments, ratings where displayed, guestbook entries, book-club activity, and competition contributions may also be visible to others according to the relevant feature. Public content can be copied, cached, or indexed by search engines. Unpublishing or deleting content does not remove copies held by others.",
    ],
  },
  {
    title: "AI processing and service providers",
    paragraphs: [
      "AI features may send prompts, relevant passages or story context, worldbuilding, summaries, conversation history, and settings to the selected model provider and the services that route the request. Providers supported by the service include Google, OpenAI, and Anthropic; the provider used depends on your selection and the feature. Story indexing may send text to an embedding provider to build retrieval representations, including for unpublished work.",
      "Providers process requests under their applicable terms and data practices, which may differ by product, account type, or settings. We do not promise that every provider has identical retention or training policies. Avoid putting confidential material or sensitive personal information into AI requests unless you have the necessary authorization.",
      "Other service providers include Firebase/Google for authentication, hosting, storage, and legacy features; PostgreSQL database hosting for product records; and infrastructure used for credit metering, logs, and support. Provider credentials you save are processed to connect your selected AI service. The service uses encrypted storage for saved bring-your-own-key settings; encryption does not eliminate all risks.",
    ],
  },
  {
    title: "Other disclosures and wallet activity",
    paragraphs: [
      "We may disclose information when reasonably necessary to comply with legal obligations or valid legal process, respond to rights complaints, investigate fraud or abuse, protect people or the service, or establish or defend legal claims. If the service or its assets are transferred, relevant information may be transferred subject to applicable law and appropriate notice.",
      "Wallet addresses and transactions are public on the blockchain when you use wallet features. Wallet providers and blockchain networks have their own practices. We cannot delete on-chain records. Requests for external images or links may also expose your network address to the external host.",
    ],
  },
  {
    title: "Cookies and local storage",
    paragraphs: [
      "The service and authentication tools use browser storage, cookies, or similar mechanisms to maintain sign-in and remember preferences or feature state. You can control browser storage through your browser settings; blocking or clearing it can sign you out or prevent features from working. This policy is not consent to optional advertising or analytics technologies. If we introduce technologies requiring consent, we will provide the required notice and choice.",
    ],
  },
  {
    title: "Retention, deletion, and backups",
    paragraphs: [
      "We retain active account and content records while needed to provide the service. We may retain particular records longer for security, billing, fraud prevention, rights complaints, legal obligations, and resolving disputes. Writer agreement records may be retained to document acceptance and address related claims. Retention depends on the type of record and the reason for keeping it.",
      "You can remove stories through available controls and contact us to request account or personal-data deletion. Account deletion can require coordinated removal from authentication, content, storage, and related services; signing out does not delete an account. We may need to verify your identity and explain any records we must retain. Deleted data may remain in backups until those backups expire, and third-party or public copies may persist. We do not promise immediate deletion from every system.",
    ],
  },
  {
    title: "Privacy rights and requests",
    paragraphs: [
      "Depending on where you live and which laws apply, you may have rights to access, correct, delete, or obtain a copy of your personal information, object to or restrict certain processing, withdraw consent where processing relies on consent, or appeal a decision on a request. You may also have the right to complain to your local data-protection authority. Applicable legal exceptions and identity verification can affect a request.",
      "Email the privacy contact with the account email or user ID, the request you want to make, and your country or state if relevant. Do not include passwords or government identification in an initial email. We will handle requests within the time required by applicable law and explain any denial or applicable appeal process. We do not penalize you for exercising applicable privacy rights.",
    ],
  },
  {
    title: "Legal bases and international processing",
    paragraphs: [
      "Where a law requires a legal basis, we process information as necessary to provide the service and perform our agreement; for legitimate interests such as security, abuse prevention, and service maintenance, subject to applicable balancing requirements; to meet legal obligations; or with consent where required. Acknowledging this policy is not a substitute for consent where consent is legally required.",
      "Information may be processed in the United States and other countries where providers operate. Their laws can differ from those in your country. Where applicable law requires safeguards for international transfers, those safeguards must be in place; merely using the service does not waive those requirements. Contact us for information about processing relevant to your account.",
    ],
  },
  {
    title: "Age and security",
    paragraphs: [
      "Writing accounts and writer features are intended for people aged 18 or older. The service is not directed to children under 13, and children under 13 must not create accounts or submit personal information. If you believe a child has provided personal information, contact us so we can investigate and take appropriate action.",
      "We use access controls, authenticated service boundaries, and other safeguards appropriate to the service. No online service can guarantee complete security or prevent every loss. Protect your sign-in information, limit what you share, and keep your own copies of important writing. Report suspected account compromise or security issues through Help & Support.",
    ],
  },
  {
    title: "Updates and contact",
    paragraphs: [
      "We identify this policy by its version and update it when our practices change. Material changes will be communicated through the service or another appropriate channel as required by law. If a change requires consent, we will ask for it rather than treating continued use as blanket consent. Privacy, deletion, and data-access requests: khaledhossain.dev@gmail.com.",
    ],
  },
];
