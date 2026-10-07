# Legal preparation for public release

Implemented: writing-specific Terms, a privacy notice, help and rights reporting,
and explicit versioned writer agreement in PostgreSQL. The API requires current
agreement for story creation and author workspace writes. This improves notice
and evidence of assent; it does not verify ownership, guarantee enforceability,
or provide immunity from claims.

## Information and decisions still needed

- Confirm the operator is Khaled Hossain and the monitored contact mailbox is
  khaledhossain.dev@gmail.com. These come from the previous Terms, not a new
  owner confirmation. Confirm operating country/state, release countries, and
  individual/entity status. Have local counsel review liability, indemnity,
  consumer rights, law/venue, privacy, and payment/competition terms.
- The draft restricts writing to adults 18+. This is an attestation, not age
  verification. Decide whether all accounts should be adult-only and whether
  additional signup age controls are needed for the intended audience.
- Inventory actual production hosts, AI/embedding providers, credentials,
  logs, cookies, analytics, and billing. Verify these disclosures against that
  deployment, including international transfer safeguards and provider
  retention/training terms. Avoid unverified training or residency guarantees.
- Establish retention periods and test export/deletion across Firebase Auth
  and legacy records, PostgreSQL, embeddings/outbox, object storage, assistant
  conversations, credit ledger, logs, and backups. Record lawful exceptions.
  The policy provides email requests, not automated account erasure.

## Copyright risk and DMCA operations

For U.S. section 512 safe-harbor protections, registration and operational
compliance are required; a checkbox or reporting email alone does not qualify.
The Help page provides a reporting contact and does not claim registration.

1. Choose and register a designated agent with the U.S. Copyright Office using
   the operator's legal name, service/domain alternate names, and required agent
   details. Confirm address/phone publication requirements. Do not invent
   details or assume your home address must be the agent's address. Publish
   matching required agent contact details on Help after registration. Calendar
   renewal before three years.
2. Monitor notices, promptly assess sufficiently detailed reports, disable or
   remove appropriate material, notify contributors, preserve evidence, and
   maintain a private repeat-infringer record. Actually enforce termination
   in appropriate circumstances. The public policy requires an operated process.
3. Handle eligible counter-notices and the statutory restoration window with
   counsel as needed; do not restore material after notice of a qualifying court
   action or where another lawful reason requires it to remain unavailable.
4. Keep moderation/privacy records private. Track receipt, decisions, deadlines,
   and appeals. Share only necessary details; do not collect unnecessary ID
   documents or passwords.

Primary references:
- https://www.copyright.gov/dmca-directory/faq.html
- https://www.govinfo.gov/content/pkg/USCODE-2024-title17/html/USCODE-2024-title17-chap5-sec512.htm
- https://www.ftc.gov/business-guidance/privacy-security/consumer-privacy

## Deployment and future updates

Deploy API/migration 000029 and frontend together. Archive exact policy and
attestation text for each version; never rewrite an old archive. Bump matching
server constants and frontend versions for document changes. Old records remain,
but the new version requires renewed assent before further writing.

Agreement records contain Firebase UID, accepted versions, and server time,
without additional personal IP/device collection. Retain evidence according to
lawful policy rather than deleting it when stories are removed. Delegated
service-token clients cannot agree on a user's behalf. Auto-acceptance in local
seeds/tests is only for synthetic fixtures.

Verify public policy links and support mail delivery, unchecked fresh-user
controls, persistence after reload, API rejection without agreement, import and
editing gates, and policy updates. No public deployment or registration is
performed by these changes.
