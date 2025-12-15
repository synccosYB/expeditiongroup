import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />

      <main className="max-w-4xl mx-auto px-6 lg:px-8 py-12">
        <Button variant="ghost" size="sm" asChild className="mb-6" data-testid="button-back">
          <a href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </a>
        </Button>

        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-8">Privacy Policy</h1>
        
        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-muted-foreground">
          <p className="text-lg">
            <strong className="text-foreground">Last Updated:</strong> December 14, 2025
          </p>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Introduction</h2>
            <p>
              Expedition Group ("we," "our," or "us") respects your privacy and is committed to protecting your personal information. 
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website 
              or use our permit expediting services.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Information We Collect</h2>
            <p>We may collect information about you in a variety of ways:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-foreground">Personal Data:</strong> Name, email address, phone number, company name, and mailing address that you voluntarily provide when registering for our services or contacting us.</li>
              <li><strong className="text-foreground">Project Information:</strong> Details about your construction projects, permits, and related documentation.</li>
              <li><strong className="text-foreground">Usage Data:</strong> Information about how you use our website, including IP address, browser type, pages visited, and time spent on pages.</li>
              <li><strong className="text-foreground">Newsletter Subscriptions:</strong> Email addresses provided for our newsletter service.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide, operate, and maintain our permit expediting services</li>
              <li>Process and manage your permit applications</li>
              <li>Communicate with you about your projects and our services</li>
              <li>Send you newsletters and marketing communications (with your consent)</li>
              <li>Improve our website and services</li>
              <li>Respond to your inquiries and provide customer support</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Information Sharing</h2>
            <p>We may share your information with:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-foreground">Municipal Authorities:</strong> As necessary to process permit applications on your behalf.</li>
              <li><strong className="text-foreground">Service Providers:</strong> Third-party vendors who help us operate our business.</li>
              <li><strong className="text-foreground">Legal Requirements:</strong> When required by law or to protect our rights.</li>
            </ul>
            <p>We do not sell your personal information to third parties.</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Data Security</h2>
            <p>
              We implement appropriate technical and organizational security measures to protect your personal information. 
              However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your information</li>
              <li>Opt-out of marketing communications</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <p>
              <strong className="text-foreground">Email:</strong> Info@expeditiongroupny.com<br />
              <strong className="text-foreground">Phone:</strong> (845) 212-2040<br />
              <strong className="text-foreground">Address:</strong> 17 Sandybrook Drive, Spring Valley, NY 10977
            </p>
          </section>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
