import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import NotiWordmark from "@/components/NotiWordmark";

export default function Terms() {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="border-b hairline">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/" className="inline-flex items-center gap-2 ink-soft hover:ink">
            <ArrowLeft size={16} /> Back
          </Link>
          <NotiWordmark size="sm" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Terms & Conditions</h1>
        <p className="ink-soft mt-2 text-sm">Last updated: April 28, 2026</p>

        <section className="mt-8 space-y-6 text-[15px] leading-relaxed">
          <p>
            Welcome to Noti. These Terms & Conditions ("Terms") govern your access to and use of
            Noti (the "Service") at <strong>noti-time.com</strong> and any related apps. By using
            the Service, you agree to these Terms. If you don't agree, please don't use Noti.
          </p>

          <h2 className="text-xl font-semibold">1. Eligibility</h2>
          <p>
            You must be at least 13 years old (16 in the EU) to use Noti. By using the Service, you
            represent that you meet this requirement.
          </p>

          <h2 className="text-xl font-semibold">2. Your account</h2>
          <p>
            You are responsible for the activity that happens under your account and for keeping
            your login credentials secure. Notify us immediately of any unauthorized use.
          </p>

          <h2 className="text-xl font-semibold">3. Acceptable use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Use Noti for anything illegal or harmful.</li>
            <li>
              Upload content that infringes intellectual property, privacy, or other rights, or
              that contains malware.
            </li>
            <li>Attempt to disrupt, reverse engineer, or gain unauthorized access to the Service.</li>
            <li>
              Abuse AI features (e.g. automated scraping, generating illegal or hateful content,
              circumventing rate limits or the credit wallet).
            </li>
            <li>Resell or sublicense the Service without our written permission.</li>
          </ul>

          <h2 className="text-xl font-semibold">4. Your content</h2>
          <p>
            You retain ownership of the notes, files, and other content you create. You grant us a
            limited license to host, store, transmit, and process your content solely as needed to
            operate the Service for you (including delivering it to AI providers when you invoke an
            AI feature).
          </p>

          <h2 className="text-xl font-semibold">5. Free and paid features</h2>
          <p>
            Core features — capturing notes, folders, reminders, lock screen, and document storage
            — are free. AI features (summarization, image generation, transcription, etc.) consume
            credits from your in-app wallet.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>1 credit equals US $0.01.</li>
            <li>
              Top-up packs are available at $5, $20, and $50 (with bonus credits on the $20 and
              $50 packs), or a custom amount.
            </li>
            <li>
              AI calls are charged at provider cost plus a service markup, deducted from your
              wallet at the time of use. The credits charged for any specific call are shown in
              your usage history.
            </li>
          </ul>

          <h2 className="text-xl font-semibold">6. Payments and refunds</h2>
          <p>
            Payments are processed by Stripe. Credit purchases are generally non-refundable once
            applied to your wallet. We may, at our discretion, refund unused credits in cases of
            duplicate charges, billing errors, or service outages. To request a refund, contact us
            at the address below.
          </p>

          <h2 className="text-xl font-semibold">7. Service changes and availability</h2>
          <p>
            We may modify, suspend, or discontinue parts of the Service at any time. We aim for
            reliability but do not guarantee uninterrupted availability.
          </p>

          <h2 className="text-xl font-semibold">8. Suspension and termination</h2>
          <p>
            We may suspend or terminate your account if you violate these Terms or abuse the
            Service (including the AI wallet). You can stop using Noti and request account deletion
            at any time.
          </p>

          <h2 className="text-xl font-semibold">9. Disclaimer</h2>
          <p>
            The Service is provided "as is" and "as available" without warranties of any kind,
            express or implied. AI-generated output may be inaccurate; do not rely on it for
            medical, legal, financial, or other professional advice.
          </p>

          <h2 className="text-xl font-semibold">10. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, Noti and its operators are not liable for any
            indirect, incidental, special, consequential, or punitive damages, or any loss of data,
            profits, or revenue. Our total liability for any claim related to the Service will not
            exceed the greater of (a) US $50 or (b) the amount you paid us in the 12 months before
            the claim.
          </p>

          <h2 className="text-xl font-semibold">11. Indemnity</h2>
          <p>
            You agree to indemnify and hold harmless Noti and its operators from any claim arising
            out of your content, your use of the Service, or your violation of these Terms.
          </p>

          <h2 className="text-xl font-semibold">12. Governing law</h2>
          <p>
            These Terms are governed by the laws of the State of New York, USA, without regard to
            conflict-of-law principles. Disputes will be resolved in the state or federal courts
            located in New York County, New York, unless your local consumer protection laws grant
            you the right to choose another venue.
          </p>

          <h2 className="text-xl font-semibold">13. Changes to these Terms</h2>
          <p>
            We may update these Terms from time to time. Material changes will be announced in-app
            or by email. Continued use after changes means you accept the updated Terms.
          </p>

          <h2 className="text-xl font-semibold">14. Contact</h2>
          <p>
            Questions? Email{" "}
            <a className="underline" href="mailto:drfrafiq@gmail.com">
              drfrafiq@gmail.com
            </a>
            .
          </p>
        </section>

        <div className="mt-12 flex justify-between text-sm ink-soft">
          <Link to="/privacy" className="underline">← Privacy Policy</Link>
          <Link to="/" className="underline">Back to home</Link>
        </div>
      </main>
    </div>
  );
}
