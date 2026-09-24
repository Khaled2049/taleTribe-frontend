# Security Policy

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Report privately using one of these channels:

1. **GitHub Security Advisories** — open the repository **Security** tab and use **Report a vulnerability** (preferred).
2. **Email** — [khaledhossain.not@gmail.com](mailto:khaledhossain.not@gmail.com) with subject line `Found a vulnerability fool`.

Include as much detail as you can:

- Description of the issue and potential impact
- Steps to reproduce or proof of concept
- Affected components (frontend, Cloud Functions, Firestore/Storage rules, etc.)
- Your contact information for follow-up

## Response Timeline

| Severity                                                     | Target response  | Target fix  |
| ------------------------------------------------------------ | ---------------- | ----------- |
| Critical (active exploitation, credential leak, auth bypass) | 48 hours         | 14 days     |
| High (significant impact, no known active exploit)           | 5 business days  | 30 days     |
| Medium / Low                                                 | 10 business days | Best effort |

Timelines are goals, not guarantees. We will acknowledge receipt and keep you informed of progress when possible.

## Scope

In scope:

- This repository (`taleTribe-frontend`) — React app, Firebase Cloud Functions, Firestore/Storage rules, Terraform, and GitHub Actions workflows defined here.

Out of scope (report to the appropriate project or vendor):

- Third-party services (Firebase, Google Cloud, Replicate, etc.) — use their security programs
- Private companion repos (`taleTribe-agents`, `creditProxy`) unless you have been directed to report here
- Social engineering, physical attacks, or denial-of-service against infrastructure you do not operate

Thank you for helping keep TTT safe.

## Private vulnerability reporting

You can also use [GitHub private vulnerability reporting](https://github.com/Khaled2049/taleTribe-frontend/security/advisories/new). Repository code, dependencies, workflows, and deployment configuration are in scope. Include reproduction steps and the affected commit; redact credentials and personal data.
