/** Locked System submenu leaf desks — honest status, no fake metrics/success. */

export type HonestLeaf = {
  title: string;
  description: string;
  bullets: string[];
};

export const SECURITY_LEAVES: Record<string, HonestLeaf | "live-security"> = {
  authentication: {
    title: "Authentication",
    description: "Staff auth uses Supabase Auth via Settings / Users — no parallel login stack.",
    bullets: [
      "Sign-in and session cookies are owned by Supabase Auth.",
      "Staff roles and permissions are enforced in the CMS route guards and RLS.",
      "Open Users & Staff or Settings to manage accounts.",
    ],
  },
  mfa: {
    title: "2FA / MFA",
    description:
      "MFA enrollment is controlled by Supabase Auth — this desk does not invent counts.",
    bullets: [
      "Enable MFA in the Supabase project / staff account settings.",
      "No fabricated MFA enrollment metrics are shown here.",
    ],
  },
  "login-protection": {
    title: "Login Protection",
    description: "Protection controls reuse IP whitelist and Supabase auth rate limits.",
    bullets: [
      "IP / Access Rules live under Security → IP / Access Rules.",
      "Failed-login throttling depends on Supabase project configuration.",
    ],
  },
  sessions: {
    title: "Session Management",
    description: "Active sessions are owned by Supabase Auth.",
    bullets: [
      "Signing out from the public shell clears the local CMS session.",
      "Server-side session revoke requires Supabase Auth admin tooling.",
    ],
  },
  devices: {
    title: "Device Management",
    description: "Device inventory is not connected in this environment.",
    bullets: [
      "No fabricated device lists are displayed.",
      "Connect a device-trust provider before expecting live device data.",
    ],
  },
  "ip-rules": "live-security",
  captcha: {
    title: "CAPTCHA",
    description: "CAPTCHA provider is not connected.",
    bullets: [
      "Comment spam / banned-word controls live under Comments → Rules.",
      "Wire a CAPTCHA provider before showing challenge metrics.",
    ],
  },
  api: {
    title: "API Security",
    description: "Admin APIs require authenticated staff with RLS — no separate key vault desk.",
    bullets: [
      "Permission checks run in route beforeLoad and server functions.",
      "Supabase RLS remains the data-access boundary.",
    ],
  },
  encryption: {
    title: "Encryption",
    description: "Encryption follows Supabase / hosting defaults.",
    bullets: [
      "Data in transit uses TLS via the hosting provider.",
      "No custom encryption dashboard is wired in this CMS.",
    ],
  },
  policies: {
    title: "Security Policies",
    description: "Staff roles and permissions live under Users & Staff / Settings.",
    bullets: [
      "Use Settings and Staff modules for policy changes.",
      "This leaf does not duplicate the permission matrix.",
    ],
  },
  threats: {
    title: "Threat Monitoring",
    description: "External threat feeds are not connected.",
    bullets: [
      "Audit / security events appear under Security Events when available.",
      "No invented threat scores or alert volumes.",
    ],
  },
  events: "live-security",
};

export const PERFORMANCE_LEAVES: Record<string, HonestLeaf> = {
  cache: {
    title: "Cache Management",
    description: "Application cache controls are not exposed as a separate provider console.",
    bullets: [
      "React Query client caches are browser-local for CMS views.",
      "CDN / edge cache requires a connected provider — not configured here.",
    ],
  },
  cdn: {
    title: "CDN",
    description: "CDN status requires a provider API — not connected.",
    bullets: [
      "No fabricated CDN hit-ratio or purge history is shown.",
      "Configure a CDN provider before expecting live status.",
    ],
  },
  images: {
    title: "Image Optimization",
    description: "Image handling runs through Media Library uploads where configured.",
    bullets: [
      "Optimize and transform at upload / delivery time in Media Library.",
      "No invented compression savings percentages.",
    ],
  },
  database: {
    title: "Database Optimization",
    description: "Database tuning is owned by the Supabase project.",
    bullets: [
      "Use Supabase dashboards for query performance and indexes.",
      "This desk will not invent slow-query charts.",
    ],
  },
  queues: {
    title: "Queue Management",
    description: "Background queues only appear when their processors and migrations exist.",
    bullets: [
      "Breaking-news push and scheduled media use server processors where applied.",
      "Empty queues mean no jobs — not a simulated success state.",
    ],
  },
  cron: {
    title: "Cron Jobs",
    description: "Scheduled jobs depend on server cron / edge schedules.",
    bullets: [
      "No fabricated cron run history.",
      "Configure schedules in the hosting / Supabase environment.",
    ],
  },
  jobs: {
    title: "Background Jobs",
    description: "Background job runners are environment-specific.",
    bullets: [
      "Connect a job runner before expecting live job lists.",
      "Do not treat this desk as a fake worker monitor.",
    ],
  },
  "page-speed": {
    title: "Page Speed",
    description: "Page-speed measurements require an external lab / RUM provider.",
    bullets: [
      "No invented Lighthouse scores.",
      "Connect PageSpeed Insights or RUM before showing numbers.",
    ],
  },
  cwv: {
    title: "Core Web Vitals",
    description: "CWV requires a monitoring provider API — not connected.",
    bullets: [
      "This desk will not invent LCP / INP / CLS numbers.",
      "Wire RUM before expecting live vitals.",
    ],
  },
  monitoring: {
    title: "Performance Monitoring",
    description: "APM / uptime monitoring is not connected.",
    bullets: [
      "No fabricated uptime or latency graphs.",
      "Connect an APM provider to populate this desk.",
    ],
  },
};

export const BACKUP_LEAF_TITLES: Record<string, string> = {
  database: "Database Backup",
  files: "Files Backup",
  media: "Media Backup",
  config: "Configuration Backup",
  automated: "Automated Backup",
  schedule: "Backup Schedule",
  retention: "Retention Policy",
  cloud: "Cloud Backup",
  encryption: "Backup Encryption",
  restore: "Restore",
  dr: "Disaster Recovery",
  failover: "Failover",
  "recovery-points": "Recovery Points",
  "dr-testing": "DR Testing",
};

export const BACKUP_LEAF_NOTES: Record<string, string> = {
  database:
    "Database dumps/PITR are owned by the Supabase project. Record verified checkpoints below — never invent Backup Successful.",
  files:
    "Application file backups require hosting provider tooling. Checkpoints here are operational records only.",
  media:
    "Media objects live in Supabase Storage. Use Media → Storage Usage for live totals; record storage dump checkpoints here.",
  config:
    "Export newsroom settings manually after critical changes, then record a configuration checkpoint.",
  automated:
    "Automated schedules require a connected backup provider cron — not configured in this CMS.",
  schedule:
    "No fabricated schedule history. Configure schedules in Supabase / hosting, then log checkpoints here.",
  retention:
    "Retention is enforced by the backup provider. Document the policy in checkpoint notes.",
  cloud:
    "Cloud backup destinations are not connected. Do not mark cloud sync as successful without a provider.",
  encryption:
    "Encryption follows provider defaults (TLS / at-rest). No custom encryption dashboard is wired.",
  restore:
    "Restores are performed in Supabase / hosting. Record restore drills as checkpoints — this desk does not execute restores.",
  dr: "Disaster recovery runbooks live outside the CMS. Use checkpoints to document DR drills.",
  failover: "Failover requires infrastructure DNS/load-balancer control — not connected here.",
  "recovery-points": "Recovery points appear only as recorded checkpoints in admin_backup_records.",
  "dr-testing": "Log DR test outcomes as checkpoints. No simulated pass/fail metrics.",
};

export const QA_LEAF_TITLES: Record<string, string> = {
  cases: "Test Cases",
  suites: "Test Suites",
  functional: "Functional Testing",
  ui: "UI / UX Testing",
  api: "API Testing",
  security: "Security Testing",
  performance: "Performance Testing",
  browsers: "Cross-Browser Testing",
  mobile: "Mobile Testing",
  regression: "Regression Testing",
  bugs: "Bug Management",
  "uat-env": "UAT Environment",
  uat: "UAT Testing",
  "uat-approval": "UAT Approval",
  "sign-off": "Release Sign-off",
};

export const QA_LEAF_NOTES: Record<string, string> = {
  cases: "Create and track manual test cases. Automated runners are not connected.",
  suites: "Group cases by suite type in the QA tables. Suite runners are not connected.",
  functional: "Log functional test cases and results as cases/bugs — no invented coverage %.",
  ui: "UI/UX findings go into bugs. No external visual-regression service is wired.",
  api: "API checks are manual or CI-owned. Record cases here; do not fake API pass rates.",
  security:
    "Security testing is recorded as cases/bugs. Threat feeds are under Security → Threats (not connected).",
  performance:
    "Performance lab scores require an external provider — use Performance desks for status.",
  browsers: "Cross-browser results are manual. No BrowserStack integration is connected.",
  mobile: "Mobile test results are manual. Record cases/bugs honestly.",
  regression: "Regression suites are tracked as cases. CI regression is outside this desk.",
  bugs: "Track open defects in qa_bugs.",
  "uat-env": "UAT environment URLs are not managed here. Document the environment in case notes.",
  uat: "Record UAT scenarios as test cases; approvals use release sign-off records.",
  "uat-approval":
    "Create release sign-off drafts when UAT is ready. Approval is a recorded workflow, not a fake gate.",
  "sign-off":
    "Draft release sign-offs from the QA desk. Signed releases require a real approver action.",
};
