import { Link } from 'react-router-dom'

/**
 * Demo registration page for Twilio verification
 * Shows the SMS opt-in UI without actual functionality
 */
export default function RegisterDemo() {
  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="DinkUp" className="w-20 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Join DinkUp</h1>
          <p className="text-gray-500 text-sm mt-1">Registration Form Preview</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-6">
          <p className="text-amber-800 text-sm">
            ⚠️ This is a <strong>preview</strong> of the registration form for compliance review. 
            Actual registration requires an invitation link.
          </p>
        </div>

        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              disabled
              placeholder="John Smith"
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              disabled
              placeholder="john@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              disabled
              placeholder="(555) 123-4567"
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Venmo Username
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">@</span>
              <input
                type="text"
                disabled
                placeholder="john-smith"
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
              />
            </div>
          </div>

          {/* SMS Opt-In Section - This is what Twilio needs to see */}
          <div className="pt-2 border-t">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Notification Preferences
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked
                  readOnly
                  className="mr-2 h-4 w-4 text-[#3CBBB1] focus:ring-[#3CBBB1] border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Email notifications</span>
              </label>
              <label className="flex items-center bg-[#EDF8F7] -mx-2 px-2 py-2 rounded border border-[#3CBBB1]/30">
                <input
                  type="checkbox"
                  checked
                  readOnly
                  className="mr-2 h-4 w-4 text-[#3CBBB1] focus:ring-[#3CBBB1] border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 font-medium">SMS notifications</span>
                <span className="ml-auto text-xs text-[#3CBBB1]">← Opt-in checkbox</span>
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              By enabling notifications, you agree to our{' '}
              <Link to="/terms" className="text-[#3CBBB1] hover:underline">
                Terms & Privacy Policy
              </Link>
              . You can opt out anytime.
            </p>
          </div>

          <button
            type="button"
            disabled
            className="w-full bg-gray-300 text-gray-500 py-2 px-4 rounded-md cursor-not-allowed"
          >
            Register (Preview Only)
          </button>
        </form>

        <div className="mt-6 pt-4 border-t">
          <h3 className="text-sm font-medium text-gray-900 mb-2">SMS Program Details</h3>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• <strong>Message Types:</strong> Session notifications, payment reminders, roster updates</li>
            <li>• <strong>Frequency:</strong> 1-5 messages per week during active seasons</li>
            <li>• <strong>Opt-out:</strong> Reply STOP to any message or disable in settings</li>
            <li>• <strong>Help:</strong> Reply HELP or email support@dinkup.link</li>
            <li>• <strong>Carrier costs:</strong> Message and data rates may apply</li>
          </ul>
          <p className="text-xs text-gray-500 mt-3">
            Full details: <Link to="/terms" className="text-[#3CBBB1] hover:underline">dinkup.link/terms</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
