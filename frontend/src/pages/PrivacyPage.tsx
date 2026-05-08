import { Zap } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-surface-900 text-ink-300 px-6 py-10">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link to="/" className="w-9 h-9 rounded-xl bg-gradient-gold flex items-center justify-center shadow-glow-gold">
            <Zap className="w-5 h-5 text-surface-900" />
          </Link>
          <span className="text-lg font-black text-gradient-gold tracking-tight uppercase">Quiz Star</span>
        </div>

        <h1 className="text-3xl font-black text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-ink-500 mb-8">Effective date: May 8, 2026</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-base font-bold text-white mb-2">1. Who We Are</h2>
            <p>
              Quiz Star ("we", "us", "our") is a quiz competition platform accessible as a Telegram
              Mini App. This Privacy Policy explains what data we collect, why we collect it, and
              how we handle it.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">2. Data We Collect</h2>
            <ul className="list-disc list-inside space-y-1">
              <li><span className="text-white font-semibold">Telegram identity</span> — your Telegram user ID, username, and display name, provided by Telegram when you open the app.</li>
              <li><span className="text-white font-semibold">Gameplay data</span> — contest entries, answers submitted, timestamps, and results.</li>
              <li><span className="text-white font-semibold">Transaction data</span> — Stars deposits, withdrawals, and bet history.</li>
              <li><span className="text-white font-semibold">Referral data</span> — which users you referred and associated earnings.</li>
              <li><span className="text-white font-semibold">TON wallet address</span> — only if you voluntarily connect a TON wallet for withdrawals.</li>
            </ul>
            <p className="mt-2">We do <span className="text-white font-semibold">not</span> collect email addresses, phone numbers, or any data beyond what Telegram and your in-app actions provide.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">3. How We Use Your Data</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>To authenticate you and manage your account.</li>
              <li>To operate contests, calculate prizes, and process payouts.</li>
              <li>To detect and prevent fraud or bot activity.</li>
              <li>To credit referral commissions correctly.</li>
              <li>To display leaderboards and statistics within the app.</li>
            </ul>
            <p className="mt-2">We do not sell your data to third parties or use it for advertising.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">4. Telegram Stars & Payments</h2>
            <p>
              Payments are processed through Telegram's built-in Stars system. We receive a
              confirmation of payment along with a Telegram-issued charge ID. We do not handle raw
              payment card data. For Stars-to-TON withdrawals, your TON wallet address is stored
              solely to process the transfer.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">5. Data Retention</h2>
            <p>
              We retain account and transaction data for as long as your account is active and for
              up to 2 years after closure for financial record-keeping purposes. You may request
              deletion of your account by contacting us at the address below.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">6. Data Sharing</h2>
            <p>
              We share data only with infrastructure providers necessary to run the service
              (database hosting, cloud platforms). These providers are contractually bound to
              protect your data. We do not share personal data with any other third parties unless
              required by law.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">7. Your Rights</h2>
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc list-inside space-y-1 mt-1">
              <li>Access the personal data we hold about you.</li>
              <li>Request correction of inaccurate data.</li>
              <li>Request deletion of your account and associated data.</li>
              <li>Object to or restrict certain processing.</li>
            </ul>
            <p className="mt-2">To exercise any of these rights, contact us at <span className="text-gold">telegrambotmon@gmail.com</span>.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">8. Security</h2>
            <p>
              We use industry-standard security measures including encrypted connections (TLS),
              server-side hashing, and access controls. No system is perfectly secure; we will
              notify you promptly if a breach affects your data.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">9. Children</h2>
            <p>
              Quiz Star is not directed at children under 13. We do not knowingly collect data
              from anyone under 13. If you believe a child has registered, contact us and we will
              delete the account.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">10. Changes to This Policy</h2>
            <p>
              We may update this policy from time to time. Material changes will be announced
              inside the app. Continued use after an update constitutes acceptance of the revised
              policy.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">11. Contact</h2>
            <p>
              For any privacy-related questions or requests, reach us at:{' '}
              <span className="text-gold">telegrambotmon@gmail.com</span>
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-surface-600/50 text-xs text-ink-600 text-center">
          © 2026 Quiz Star · All rights reserved
        </div>
      </div>
    </div>
  )
}
