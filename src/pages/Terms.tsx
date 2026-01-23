import { Link } from 'react-router-dom'

export default function Terms() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link to="/" className="text-[#3CBBB1] hover:underline text-sm">
          ← Back to Home
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6 sm:p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service & Privacy Policy</h1>
          <p className="text-gray-500 text-sm">Last updated: January 9, 2026</p>
        </div>

        {/* Overview */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Overview</h2>
          <p className="text-gray-700 leading-relaxed">
            DinkUp is a pickleball session coordination platform that helps players organize games, 
            manage rosters, and handle payments. By using DinkUp, you agree to these terms.
          </p>
        </section>

        {/* SMS Terms */}
        <section className="bg-[#EDF8F7] border border-[#3CBBB1]/20 rounded-lg p-5">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">📱 SMS Messaging Terms</h2>
          
          <div className="space-y-4 text-gray-700">
            <div>
              <h3 className="font-medium text-gray-900">Opt-In</h3>
              <p className="text-sm leading-relaxed">
                By enabling SMS notifications in your account settings, you consent to receive text 
                messages from DinkUp. SMS notifications are optional and disabled by default. You can 
                enable or disable SMS notifications at any time in your account settings.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-gray-900">Message Types</h3>
              <p className="text-sm leading-relaxed">
                SMS notifications are used only for time-sensitive updates:
              </p>
              <ul className="text-sm list-disc list-inside space-y-1 mt-1">
                <li>24-hour game reminders</li>
                <li>Waitlist promotion alerts</li>
                <li>Session cancellation notices</li>
              </ul>
              <p className="text-sm leading-relaxed mt-2">
                All other notifications (session creation, roster lock, payment reminders, etc.) 
                are sent via email, which is enabled by default.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-gray-900">Message Frequency</h3>
              <p className="text-sm leading-relaxed">
                Message frequency varies based on your pool activity. Typically 1-5 messages per week 
                during active playing seasons.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-gray-900">Opt-Out</h3>
              <p className="text-sm leading-relaxed">
                To stop receiving SMS messages, you can:
              </p>
              <ul className="text-sm list-disc list-inside space-y-1 mt-1">
                <li>Reply <strong>STOP</strong> to any message</li>
                <li>Disable SMS in your <Link to="/settings" className="text-[#3CBBB1] hover:underline">account settings</Link></li>
                <li>Contact us at <a href="mailto:support@dinkup.link" className="text-[#3CBBB1] hover:underline">support@dinkup.link</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-gray-900">Costs</h3>
              <p className="text-sm leading-relaxed">
                Message and data rates may apply. DinkUp does not charge for SMS, but your carrier may.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-gray-900">Help</h3>
              <p className="text-sm leading-relaxed">
                Reply <strong>HELP</strong> for assistance or contact <a href="mailto:support@dinkup.link" className="text-[#3CBBB1] hover:underline">support@dinkup.link</a>.
              </p>
            </div>
          </div>
        </section>

        {/* Privacy Policy */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">🔒 Privacy Policy</h2>
          
          <div className="space-y-4 text-gray-700">
            <div>
              <h3 className="font-medium text-gray-900">Information We Collect</h3>
              <ul className="text-sm list-disc list-inside space-y-1">
                <li><strong>Account info:</strong> Name, email, phone number</li>
                <li><strong>Payment info:</strong> Venmo username (we don't store payment credentials)</li>
                <li><strong>Usage data:</strong> Session participation, payment history</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-gray-900">How We Use Your Information</h3>
              <ul className="text-sm list-disc list-inside space-y-1">
                <li>Coordinate pickleball sessions and rosters</li>
                <li>Send notifications (email and SMS, based on your preferences)</li>
                <li>Facilitate payments between players</li>
                <li>Improve the service</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-gray-900">Information Sharing</h3>
              <p className="text-sm leading-relaxed">
                We share your name and contact info with other players in your pools to facilitate 
                coordination. We do not sell your information to third parties.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-gray-900">Data Retention</h3>
              <p className="text-sm leading-relaxed">
                We retain your data while your account is active. You can request deletion by 
                contacting <a href="mailto:support@dinkup.link" className="text-[#3CBBB1] hover:underline">support@dinkup.link</a>.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-gray-900">Third-Party Services</h3>
              <ul className="text-sm list-disc list-inside space-y-1">
                <li><strong>Supabase:</strong> Database and authentication</li>
                <li><strong>Resend:</strong> Email delivery</li>
                <li><strong>Twilio:</strong> SMS delivery</li>
                <li><strong>Venmo:</strong> Payment processing (user-initiated)</li>
                <li><strong>Vercel:</strong> Hosting and analytics</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Terms of Service */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">📋 Terms of Service</h2>
          
          <div className="space-y-4 text-gray-700">
            <div>
              <h3 className="font-medium text-gray-900">Acceptable Use</h3>
              <p className="text-sm leading-relaxed">
                DinkUp is for coordinating recreational pickleball sessions. You agree not to use the 
                service for spam, harassment, or illegal activities.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-gray-900">Payments</h3>
              <p className="text-sm leading-relaxed">
                DinkUp facilitates payment coordination but does not process payments directly. 
                All payments are made through Venmo between users. DinkUp is not responsible for 
                payment disputes.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-gray-900">Liability</h3>
              <p className="text-sm leading-relaxed">
                DinkUp is provided "as is" without warranties. We are not liable for injuries, 
                disputes, or damages arising from pickleball activities coordinated through the platform.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-gray-900">Changes</h3>
              <p className="text-sm leading-relaxed">
                We may update these terms at any time. Continued use constitutes acceptance of changes.
              </p>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="border-t pt-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">📧 Contact Us</h2>
          <p className="text-gray-700 text-sm">
            Questions? Contact us at{' '}
            <a href="mailto:support@dinkup.link" className="text-[#3CBBB1] hover:underline">
              support@dinkup.link
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}
