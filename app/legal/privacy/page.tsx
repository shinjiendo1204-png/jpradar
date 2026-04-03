export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <a href="/" className="text-blue-600 text-sm mb-8 block hover:text-blue-700">← Back to JPRADAR</a>
        <h1 className="text-3xl font-black mb-2">Privacy Policy</h1>
        <p className="text-slate-400 text-sm mb-10">Last updated: April 3, 2026</p>

        <div className="space-y-8 text-sm text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">1. Information We Collect</h2>
            <p>We collect information you provide directly to us, including your email address and alert preferences (categories, minimum profit threshold, webhook URLs). We also collect usage data such as login timestamps and feature interactions.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">2. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>To provide and improve the JPRADAR service</li>
              <li>To send deal alerts to your configured Slack or Discord webhook</li>
              <li>To manage your subscription and billing</li>
              <li>To respond to support inquiries</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">3. Data Storage and Security</h2>
            <p>Your data is stored securely using Supabase (hosted on AWS). We implement industry-standard security measures including encryption in transit and at rest. We do not sell your personal information to third parties.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">4. Third-Party Services</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Supabase</strong> — database and authentication</li>
              <li><strong>Vercel</strong> — hosting and deployment</li>
              <li><strong>OpenAI</strong> — product name translation (Japanese to English)</li>
              <li><strong>Stripe</strong> — payment processing (when applicable)</li>
              <li><strong>Slack / Discord</strong> — deal alert delivery (webhook URLs you provide)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">5. Webhook URLs</h2>
            <p>If you provide a Slack or Discord webhook URL, it is stored securely and used only to deliver deal alerts on your behalf. We do not use webhook URLs for any other purpose. You can delete your webhook URLs at any time from your dashboard.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">6. Data Retention</h2>
            <p>We retain your account data for as long as your account is active. Deal records are retained for 90 days. You may request deletion of your account and associated data at any time by contacting us.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">7. Your Rights</h2>
            <p>You have the right to access, correct, or delete your personal data. To exercise these rights, contact us at the email below.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">8. Contact</h2>
            <p>For privacy inquiries: <strong>legal@wakaruai.net</strong><br />
            Operator: WAKARUAI · wakaruai.net</p>
          </section>
        </div>
      </div>
    </div>
  );
}
