export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white shadow-sm rounded-lg p-8 sm:p-12">
        {/* Header */}
        <div className="mb-10 border-b pb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500">
            <strong>App Name:</strong> Test &amp; Tag Reporting Tool
          </p>
          <p className="text-sm text-gray-500">
            <strong>Operated by:</strong> The Local Guys
          </p>
          <p className="text-sm text-gray-500">
            <strong>Last Updated:</strong> April 9, 2026
          </p>
        </div>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          {/* Introduction */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
            <p>
              The Local Guys ("we", "us", or "our") operates the Test &amp; Tag Reporting Tool mobile
              application (the "App"). This Privacy Policy explains how we collect, use, disclose, and
              safeguard your information when you use our App. Please read this policy carefully. If you
              disagree with its terms, please discontinue use of the App.
            </p>
          </section>

          {/* Information We Collect */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
            <p className="mb-3">We may collect the following types of information:</p>

            <h3 className="text-base font-semibold text-gray-800 mb-2">a) Account Information</h3>
            <ul className="list-disc pl-6 space-y-1 mb-4">
              <li>Full name and username</li>
              <li>Email address</li>
              <li>Password (stored in hashed/encrypted form — never in plain text)</li>
              <li>Role (technician, support center, super admin)</li>
            </ul>

            <h3 className="text-base font-semibold text-gray-800 mb-2">b) Test &amp; Job Data</h3>
            <ul className="list-disc pl-6 space-y-1 mb-4">
              <li>Test session details (client name, site address, job date)</li>
              <li>Individual test results (pass/fail, readings, notes)</li>
              <li>Equipment item descriptions and serial numbers</li>
              <li>Photos captured during inspections (uploaded as part of test records)</li>
              <li>Certificate and compliance report data</li>
            </ul>

            <h3 className="text-base font-semibold text-gray-800 mb-2">c) Usage Data</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Pages visited and features used within the App</li>
              <li>Session activity timestamps</li>
              <li>Device type and operating system (collected anonymously via analytics)</li>
            </ul>
          </section>

          {/* How We Use Your Information */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
            <p className="mb-3">We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Authenticate and manage user accounts</li>
              <li>Enable technicians to record, save, and retrieve test sessions and results</li>
              <li>Generate compliance reports and certificates (PDF and Excel formats)</li>
              <li>Support administrators in managing users, environments, and form types</li>
              <li>Monitor and improve App performance and reliability</li>
              <li>Provide customer support</li>
              <li>Comply with applicable Australian and New Zealand electrical safety regulations</li>
            </ul>
          </section>

          {/* Data Storage */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Data Storage &amp; Security</h2>
            <p className="mb-3">
              All application data is stored in a secure cloud-hosted PostgreSQL database (Neon). We
              implement industry-standard security measures including:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Encrypted connections (HTTPS/TLS) for all data in transit</li>
              <li>Bcrypt password hashing — your password is never stored in plain text</li>
              <li>Session-based authentication with secure, server-side session management</li>
              <li>Role-based access control — users only access data relevant to their role</li>
              <li>Soft-delete architecture — records are flagged as deleted, not permanently removed, to preserve audit trails</li>
            </ul>
            <p className="mt-3">
              While we take reasonable precautions, no method of transmission over the Internet or
              electronic storage is 100% secure. We cannot guarantee absolute security.
            </p>
          </section>

          {/* Sharing of Information */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Sharing of Information</h2>
            <p className="mb-3">We do not sell, trade, or rent your personal information. We may share data with:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Service Providers:</strong> Third-party vendors that assist with database hosting,
                analytics (PostHog), and email delivery (SendGrid), who are bound by confidentiality
                obligations.
              </li>
              <li>
                <strong>Legal Requirements:</strong> If required by law, regulation, or valid legal
                process (e.g., court order), we may disclose information to relevant authorities.
              </li>
              <li>
                <strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of
                assets, your information may be transferred as part of that transaction.
              </li>
            </ul>
          </section>

          {/* Analytics */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Analytics</h2>
            <p>
              We use PostHog for product analytics to understand how the App is used. PostHog collects
              anonymised usage events (page views, feature interactions) and does not collect personally
              identifiable information beyond what you provide. You can learn more at{" "}
              <a
                href="https://posthog.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                posthog.com/privacy
              </a>
              .
            </p>
          </section>

          {/* Retention */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Data Retention</h2>
            <p>
              We retain your account and test data for as long as your account is active or as needed to
              provide services, comply with legal obligations, resolve disputes, and enforce agreements.
              If you wish to request deletion of your data, please contact us using the details below.
            </p>
          </section>

          {/* Children */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Children's Privacy</h2>
            <p>
              The App is intended for use by professional electrical technicians and business users. We do
              not knowingly collect personal information from children under the age of 13. If we become
              aware that we have collected such information, we will take steps to delete it promptly.
            </p>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Your Rights</h2>
            <p className="mb-3">
              Depending on your location, you may have the right to:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your personal data</li>
              <li>Object to or restrict certain processing of your data</li>
              <li>Withdraw consent where processing is based on consent</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, please contact us at the email address below. We will
              respond within a reasonable timeframe in accordance with applicable law.
            </p>
          </section>

          {/* Changes */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify users of material
              changes by updating the "Last Updated" date at the top of this page. Continued use of the
              App after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Contact Us</h2>
            <p className="mb-2">
              If you have any questions or concerns about this Privacy Policy, please contact us:
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4 text-sm">
              <p className="font-semibold text-gray-900">The Local Guys</p>
              <p>Email: <a href="mailto:info@thelocalguys.com.au" className="text-blue-600 hover:underline">info@thelocalguys.com.au</a></p>
              <p>Website: <a href="https://www.thelocalguys.com.au" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">www.thelocalguys.com.au</a></p>
              <p>Country: Australia</p>
            </div>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t text-center text-xs text-gray-400">
          &copy; {new Date().getFullYear()} The Local Guys. All rights reserved.
        </div>
      </div>
    </div>
  );
}
