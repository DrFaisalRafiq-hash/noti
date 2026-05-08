import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import NotiWordmark from "@/components/NotiWordmark";

export default function Privacy() {
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

      <main className="mx-auto max-w-3xl px-6 py-12 prose-noti">
        <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="ink-soft mt-2 text-sm">Last updated: April 28, 2026</p>

        <section className="mt-8 space-y-6 text-[15px] leading-relaxed">
          <p>
            Noti ("we", "us", or "our") respects your privacy. This Privacy Policy explains what
            information we collect, how we use it, and your rights when you use Noti — our notes,
            reminders, voice memos, and document app, available on the web and as an installable
            PWA at <strong>noti-time.com</strong> and related domains (the "Service").
          </p>

          <h2 className="text-xl font-semibold">1. Information we collect</h2>
          <p>We collect only what we need to run the Service:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Account info</strong> — email address, display name, and avatar (when you sign
              up with email or Google).
            </li>
            <li>
              <strong>Your content</strong> — notes, reminders, tags, folders, voice memos, uploaded
              documents, and captions you create. This content is yours.
            </li>
            <li>
              <strong>Push notification tokens</strong> — to deliver reminders to your device.
            </li>
            <li>
              <strong>Wallet & billing data</strong> — credit balance, AI usage logs, and payment
              records (processed via Stripe). We never see or store your full card details.
            </li>
            <li>
              <strong>Operational logs</strong> — minimal request/error logs for security and
              reliability.
            </li>
          </ul>

          <h2 className="text-xl font-semibold">2. How we use information</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To provide, maintain, and improve the Service.</li>
            <li>To deliver reminders and notifications you have asked for.</li>
            <li>To process AI requests you initiate (summaries, image generation, etc.).</li>
            <li>To process payments and maintain your credit wallet.</li>
            <li>To prevent abuse, fraud, and protect the Service and its users.</li>
            <li>To communicate important account or service notices.</li>
          </ul>

          <h2 className="text-xl font-semibold">3. AI processing</h2>
          <p>
            When you use AI features (summarize, transcribe, generate image, etc.), the relevant
            content is sent to our AI providers (currently Google and OpenAI via the Lovable AI
            Gateway) solely to fulfill that request. We do not use your content to train AI models.
            Provider usage is logged for billing and abuse prevention only.
          </p>

          <h2 className="text-xl font-semibold">4. Sharing</h2>
          <p>We do not sell your personal data. We share data only with:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Infrastructure providers</strong> (hosting, database, storage) bound by
              confidentiality obligations.
            </li>
            <li>
              <strong>Stripe</strong> for payment processing.
            </li>
            <li>
              <strong>AI providers</strong> only when you invoke an AI feature, as described above.
            </li>
            <li>
              <strong>Authorities</strong> if required by law or to protect rights and safety.
            </li>
          </ul>

          <h2 className="text-xl font-semibold">5. Data retention</h2>
          <p>
            Your content is retained for as long as your account is active. Deleting a note,
            document, or memo removes it from active storage; backups are rotated within 30 days.
            You can request full account deletion at any time (see Contact below).
          </p>

          <h2 className="text-xl font-semibold">6. Security</h2>
          <p>
            We use encryption in transit (HTTPS/TLS) and at rest, server-side authentication, and
            row-level security on the database. No system is perfectly secure, but we work to
            protect your data.
          </p>

          <h2 className="text-xl font-semibold">7. Your rights</h2>
          <p>
            Depending on where you live (e.g. EU/UK GDPR, California CCPA), you may have the right
            to access, correct, export, or delete your personal data, and to object to or restrict
            processing. Email us to exercise these rights.
          </p>

          <h2 className="text-xl font-semibold">8. Children</h2>
          <p>
            Noti is not directed at children under 13 (or under 16 in the EU). We do not knowingly
            collect personal data from children.
          </p>

          <h2 className="text-xl font-semibold">9. Changes to this policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Material changes will be announced
            in-app or by email. Continued use after changes means you accept the updated policy.
          </p>

          <h2 className="text-xl font-semibold">10. Contact</h2>
          <p>
            Questions or requests? Email{" "}
            <a className="underline" href="mailto:drfrafiq@gmail.com">
              drfrafiq@gmail.com
            </a>
            .
          </p>
        </section>

        <div className="mt-12 flex justify-between text-sm ink-soft">
          <Link to="/terms" className="underline">Terms & Conditions →</Link>
          <Link to="/" className="underline">Back to home</Link>
        </div>
      </main>
    </div>
  );
}
