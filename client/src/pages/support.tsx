export default function Support() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white shadow-sm rounded-lg p-8 sm:p-12">
        {/* Header */}
        <div className="mb-10 border-b pb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Support</h1>
          <p className="text-sm text-gray-500">
            <strong>App Name:</strong> Test &amp; Tag Reporting Tool
          </p>
          <p className="text-sm text-gray-500">
            <strong>Operated by:</strong> The Local Guys
          </p>
        </div>

        <div className="space-y-10 text-gray-700 leading-relaxed">
          {/* Contact */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact Us</h2>
            <p className="mb-4">
              If you need help with the Test &amp; Tag Reporting Tool, our support team is here to
              assist you. Please reach out through any of the channels below and we'll get back to
              you as soon as possible.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-md p-5 space-y-2 text-sm">
              <p>
                <span className="font-semibold text-gray-900">Email:</span>{" "}
                <a
                  href="mailto:info@thelocalguys.com.au"
                  className="text-blue-600 hover:underline"
                >
                  info@thelocalguys.com.au
                </a>
              </p>
              <p>
                <span className="font-semibold text-gray-900">Website:</span>{" "}
                <a
                  href="https://www.thelocalguys.com.au"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  www.thelocalguys.com.au
                </a>
              </p>
              <p>
                <span className="font-semibold text-gray-900">Country:</span> Australia
              </p>
            </div>
          </section>

          {/* FAQ */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Frequently Asked Questions</h2>
            <div className="space-y-6">

              <div>
                <h3 className="font-semibold text-gray-800 mb-1">How do I log in to the App?</h3>
                <p>
                  Open the App and enter your assigned username and password on the login screen. If you
                  have forgotten your credentials, contact your administrator or email us at{" "}
                  <a href="mailto:info@thelocalguys.com.au" className="text-blue-600 hover:underline">
                    info@thelocalguys.com.au
                  </a>
                  .
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-1">How do I start a new test session?</h3>
                <p>
                  After logging in, select the service type (PAT, Emergency Exit Lighting, Fire
                  Equipment, RCD, or Microwave Leakage) from the home screen, then follow the on-screen
                  prompts to enter job details and begin testing.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-1">Can I resume an unfinished session?</h3>
                <p>
                  Yes. The App automatically saves your progress. When you return to the home screen you
                  will be prompted to resume any draft sessions that are still in progress.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-1">How do I generate a compliance report?</h3>
                <p>
                  Once all test items have been recorded, navigate to the Report screen and tap
                  "Generate Report". You can download the report as a PDF or Excel file directly from
                  the App.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-1">What should I do if a test result won't save?</h3>
                <p>
                  The App automatically retries saving in the background. Check your internet connection
                  and ensure you have not been logged out. If the issue persists, close and reopen the
                  App — your draft session will reload from the server.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-1">How do I add or manage users?</h3>
                <p>
                  User management is available to administrators via the Admin Dashboard. Navigate to
                  Admin → Users to create, edit, or deactivate accounts. Only Super Admin and Support
                  Center roles have access to this area.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-1">How do I request deletion of my data?</h3>
                <p>
                  Email us at{" "}
                  <a href="mailto:info@thelocalguys.com.au" className="text-blue-600 hover:underline">
                    info@thelocalguys.com.au
                  </a>{" "}
                  with the subject line "Data Deletion Request" and include your full name and
                  username. We will process your request in accordance with our{" "}
                  <a href="/privacy-policy" className="text-blue-600 hover:underline">
                    Privacy Policy
                  </a>
                  .
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-1">The App is not working correctly. What should I do?</h3>
                <p>
                  Try the following steps:
                </p>
                <ol className="list-decimal pl-6 mt-2 space-y-1 text-sm">
                  <li>Ensure you have a stable internet connection.</li>
                  <li>Close and reopen the App.</li>
                  <li>Check that you are running the latest version of the App.</li>
                  <li>
                    If the issue persists, email us at{" "}
                    <a
                      href="mailto:info@thelocalguys.com.au"
                      className="text-blue-600 hover:underline"
                    >
                      info@thelocalguys.com.au
                    </a>{" "}
                    with a description of the problem and, if possible, a screenshot.
                  </li>
                </ol>
              </div>

            </div>
          </section>

          {/* Response time */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Response Times</h2>
            <p>
              We aim to respond to all support enquiries within <strong>1–2 business days</strong>{" "}
              (Monday to Friday, Australian Eastern Time). Urgent issues affecting active test jobs
              will be prioritised.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t text-center text-xs text-gray-400">
          &copy; {new Date().getFullYear()} The Local Guys. All rights reserved.{" "}
          <a href="/privacy-policy" className="hover:underline">
            Privacy Policy
          </a>
        </div>
      </div>
    </div>
  );
}
