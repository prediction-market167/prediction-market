import { Zap } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function TermsPage() {
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

        <h1 className="text-3xl font-black text-white mb-2">Terms of Service</h1>
        <p className="text-sm text-ink-500 mb-8">Effective date: May 8, 2026</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-base font-bold text-white mb-2">1. Acceptance of Terms</h2>
            <p>
              By opening or using Quiz Star ("the App", "we", "us"), you agree to be bound by
              these Terms of Service. If you do not agree, do not use the App.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">2. Eligibility</h2>
            <p>
              You must be at least 18 years old (or the legal age of majority in your jurisdiction,
              whichever is higher) to use paid features of the App. By participating in paid
              contests you confirm that you meet this requirement and that using the App does not
              violate any law in your jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">3. Description of Service</h2>
            <p>
              Quiz Star is a knowledge-based quiz competition platform accessible via Telegram Mini
              App. Users answer timed questions and compete for prize pools funded by entry fees
              paid with Telegram Stars. Contests are not games of pure chance — correct answers and
              response speed jointly determine outcomes.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">4. Telegram Stars & Payments</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Entry fees are denominated in Telegram Stars (⭐), purchased through Telegram's own payment system.</li>
              <li>1 ⭐ = 1 in-app credit. Stars have no guaranteed monetary value outside of Telegram's ecosystem.</li>
              <li>All purchases are final. Refunds are only issued automatically when a contest is cancelled due to insufficient participants.</li>
              <li>We are not responsible for issues arising from Telegram's payment infrastructure.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">5. Prize Pool & Distribution</h2>
            <p>Of every paid entry fee:</p>
            <ul className="list-disc list-inside space-y-1 mt-1">
              <li><span className="text-white font-semibold">50%</span> — Prize pool (split among top 5 fastest correct answers: 40 / 25 / 15 / 10 / 10%)</li>
              <li><span className="text-white font-semibold">10%</span> — Jackpot fund (periodic random prize draw)</li>
              <li><span className="text-white font-semibold">10%</span> — Referral commissions</li>
              <li><span className="text-white font-semibold">10%</span> — Monthly bonus pool</li>
              <li><span className="text-white font-semibold">20%</span> — Platform fee</li>
            </ul>
            <p className="mt-2">
              Prize distributions are calculated automatically by the platform. We reserve the right
              to adjust the fee structure with 7 days' notice posted in the App.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">6. Fair Play & Prohibited Conduct</h2>
            <p>You agree not to:</p>
            <ul className="list-disc list-inside space-y-1 mt-1">
              <li>Use bots, scripts, or automated tools to submit answers.</li>
              <li>Create multiple accounts to manipulate outcomes or referral rewards.</li>
              <li>Exploit bugs or vulnerabilities. Report them to us instead.</li>
              <li>Collude with other users to manipulate contest results.</li>
              <li>Attempt to reverse-engineer or tamper with the platform.</li>
            </ul>
            <p className="mt-2">
              Violations may result in immediate account suspension, forfeiture of balances, and
              being permanently banned from the App.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">7. Withdrawals</h2>
            <p>
              Stars balance may be withdrawn as TON to a connected TON wallet, subject to the
              current exchange rate displayed in the App. Withdrawals require a connected TON wallet
              and are subject to availability. We reserve the right to delay or reject withdrawals
              if fraud is suspected or compliance review is required.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">8. Referral Program</h2>
            <p>
              By sharing your referral link you earn 10% of every paid entry fee made by referred
              users, credited to your in-app balance. Referral rewards are forfeited if your
              account is suspended for policy violations. We may modify or discontinue the referral
              program at any time with reasonable notice.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">9. Intellectual Property</h2>
            <p>
              All content, branding, question sets, and software in the App are owned by or
              licensed to Quiz Star. You may not copy, modify, distribute, or create derivative
              works without our written permission.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">10. Disclaimers</h2>
            <p>
              The App is provided "as is" without warranties of any kind. We do not guarantee
              uninterrupted service, specific prize amounts, or any particular outcome. Contest
              results are final once settled by the platform.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">11. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, Quiz Star is not liable for any indirect,
              incidental, special, or consequential damages arising from your use of the App,
              including loss of Stars balance due to technical failure. Our total liability for any
              claim is limited to the amount you paid in entry fees in the 30 days preceding the
              claim.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">12. Termination</h2>
            <p>
              We may suspend or terminate your account at any time for violations of these Terms.
              You may stop using the App at any time. Upon termination, any remaining balance may
              be forfeited if the account was closed due to policy violations.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">13. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. Material changes will be announced
              inside the App at least 7 days before taking effect. Continued use after the
              effective date constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">14. Governing Law</h2>
            <p>
              These Terms are governed by applicable law. Any disputes shall be resolved through
              good-faith negotiation first. If unresolved, disputes shall be subject to binding
              arbitration.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">15. Contact</h2>
            <p>
              Questions about these Terms? Reach us at:{' '}
              <span className="text-gold">telegrambotmon@gmail.com</span>
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-surface-600/50 text-xs text-ink-600 text-center">
          © 2026 Quiz Star · All rights reserved ·{' '}
          <Link to="/privacy" className="hover:text-ink-400 transition-colors">Privacy Policy</Link>
        </div>
      </div>
    </div>
  )
}
