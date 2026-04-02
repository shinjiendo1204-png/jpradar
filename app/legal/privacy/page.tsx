export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <a href="/" className="text-blue-600 text-sm mb-8 block hover:text-blue-700">← Back to JPRADAR</a>
        <h1 className="text-3xl font-black mb-2">Privacy Policy</h1>
        <p className="text-slate-400 text-sm mb-10">Last updated: April 3, 2026</p>

        <div className="prose prose-slate max-w-none space-y-8 text-sm text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">1. Information We Collect</h2>
            <p>We collect information you provide directly to us, including your name, email address, company name, and the keywords you choose to monitor. We also collect usage data such as login timestamps and feature interactions.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">2. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>To provide, maintain, and improve the JPRADAR service</li>
              <li>To generate intelligence reports based on your selected keywords</li>
              <li>To send you service notifications and reports</li>
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
            <p>We use the following third-party services:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Supabase</strong> — database and authentication</li>
              <li><strong>Vercel</strong> — hosting and deployment</li>
              <li><strong>Anthropic (Claude)</strong> — AI report generation and translation</li>
              <li><strong>Stripe</strong> — payment processing</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">5. Data Retention</h2>
            <p>We retain your account data for as long as your account is active. Intelligence reports are retained for 90 days. You may request deletion of your data at any time by contacting us.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">6. Your Rights (GDPR)</h2>
            <p>If you are located in the European Economic Area, you have the right to access, correct, or delete your personal data, object to processing, and data portability. Contact us at the email below to exercise these rights.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">7. Contact</h2>
            <p>For privacy-related inquiries: <strong>privacy@wakaruai.net</strong></p>
          </section>
        </div>
      </div>
    </div>
  );
}
