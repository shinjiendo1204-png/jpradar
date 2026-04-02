export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <a href="/" className="text-blue-600 text-sm mb-8 block hover:text-blue-700">← Back to JPRADAR</a>
        <h1 className="text-3xl font-black mb-2">Terms of Service</h1>
        <p className="text-slate-400 text-sm mb-10">Last updated: April 3, 2026</p>

        <div className="space-y-8 text-sm text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using JPRADAR ("Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">2. Description of Service</h2>
            <p>JPRADAR provides AI-powered intelligence reports summarizing publicly available Japanese social media content. Reports are generated using artificial intelligence and are provided for informational purposes only.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">3. Disclaimer of Warranties</h2>
            <p className="font-medium text-slate-900">THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND.</p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>We do not guarantee the accuracy, completeness, or timeliness of intelligence reports</li>
              <li>AI-generated summaries may contain errors or omissions</li>
              <li>Reports should not be used as the sole basis for business decisions</li>
              <li>We are not responsible for business decisions made based on our reports</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">4. Data Sources and Content</h2>
            <p>JPRADAR monitors publicly available content on Japanese social media platforms. We do not access private, password-protected, or non-public content. All monitored content originates from public sources. We summarize content using AI; original content remains the property of its respective authors.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">5. Limitation of Liability</h2>
            <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, JPRADAR AND WAKARUAI SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES, ARISING FROM YOUR USE OF THE SERVICE.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">6. Acceptable Use</h2>
            <p>You may not use JPRADAR to:</p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>Harass, monitor, or track specific individuals</li>
              <li>Engage in competitive intelligence for illegal purposes</li>
              <li>Violate any applicable laws or regulations</li>
              <li>Resell or redistribute reports without permission</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">7. Subscription and Billing</h2>
            <p>Paid plans are billed monthly. You may cancel at any time. Refunds are provided within 7 days of initial purchase if the service does not meet expectations. No refunds after 7 days.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">8. Governing Law</h2>
            <p>These Terms are governed by the laws of Japan. Any disputes shall be resolved in the courts of Tokyo, Japan.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">9. Contact</h2>
            <p>For legal inquiries: <strong>legal@wakaruai.net</strong><br />
            Operator: WAKARUAI · wakaruai.net</p>
          </section>
        </div>
      </div>
    </div>
  );
}
