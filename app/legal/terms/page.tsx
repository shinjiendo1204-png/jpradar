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
            <p>By accessing or using JPRADAR ("Service"), you agree to be bound by these Terms of Service. If you do not agree, you may not use the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">2. Description of Service</h2>
            <p>JPRADAR is a market intelligence tool that scans Japanese second-hand marketplaces (including Surugaya, Yahoo Auctions, and Hard Off) and compares prices against international resale platforms (including eBay and Whatnot) to identify potential arbitrage opportunities. The Service provides price data, profit estimates, and deal alerts for informational purposes only.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">3. Disclaimer of Warranties</h2>
            <p className="font-medium text-slate-900">THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND.</p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>Price data and profit calculations are estimates only and may not reflect actual market conditions</li>
              <li>Shipping cost estimates are approximations based on typical forwarding service rates and actual costs may vary</li>
              <li>Exchange rates are fetched from third-party sources and may be delayed</li>
              <li>We do not guarantee that any deal will result in actual profit</li>
              <li>The Service should not be used as the sole basis for purchasing decisions</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">4. Data Sources and Scraping</h2>
            <p>JPRADAR accesses publicly available product listings on Japanese marketplaces. We respect each website's robots.txt and crawl delay policies. We do not access password-protected, private, or non-public content. Product titles, prices, and images remain the property of their respective owners and platforms. JPRADAR does not claim ownership of any third-party content.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">5. User Responsibilities</h2>
            <p>You are solely responsible for:</p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>Verifying product condition, authenticity, and legality before purchasing</li>
              <li>Complying with import/export laws in your country</li>
              <li>Complying with the terms of service of any platform you use to resell goods</li>
              <li>Paying applicable taxes and customs duties</li>
              <li>Any losses incurred as a result of acting on information provided by the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">6. Acceptable Use</h2>
            <p>You may not use JPRADAR to:</p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>Violate any applicable laws or regulations</li>
              <li>Resell or redistribute the Service's data or alerts without permission</li>
              <li>Attempt to reverse-engineer or scrape the Service itself</li>
              <li>Use the Service for any fraudulent or deceptive purpose</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">7. Subscription and Billing</h2>
            <p>Paid plans are billed monthly. You may cancel at any time effective at the end of the current billing period. Refunds are provided within 7 days of initial purchase if the Service does not meet expectations. No refunds after 7 days.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">8. Limitation of Liability</h2>
            <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, JPRADAR AND ITS OPERATORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS OR BUSINESS OPPORTUNITIES, ARISING FROM YOUR USE OF THE SERVICE OR ANY PURCHASING DECISIONS MADE BASED ON ITS OUTPUT.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">9. Governing Law</h2>
            <p>These Terms are governed by the laws of Japan. Any disputes shall be resolved in the courts of Tokyo, Japan.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900 mb-3">10. Contact</h2>
            <p>For legal inquiries: <strong>legal@wakaruai.net</strong><br />
            Operator: WAKARUAI · wakaruai.net</p>
          </section>
        </div>
      </div>
    </div>
  );
}
