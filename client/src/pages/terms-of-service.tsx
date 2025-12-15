import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";

export default function TermsOfService() {
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

        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-8">Terms of Service</h1>
        
        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-muted-foreground">
          <p className="text-lg">
            <strong className="text-foreground">Last Updated:</strong> December 14, 2025
          </p>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Agreement to Terms</h2>
            <p>
              By accessing or using the services provided by Expedition Group ("Company," "we," "our," or "us"), 
              you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Services Description</h2>
            <p>
              Expedition Group provides permit expediting services for construction projects in Orange, Rockland, and Sullivan Counties, New York. 
              Our services include but are not limited to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Permit application preparation and submission</li>
              <li>Coordination with municipal authorities</li>
              <li>Application tracking and status updates</li>
              <li>Document management and organization</li>
              <li>Stakeholder coordination</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Client Responsibilities</h2>
            <p>As a client, you agree to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide accurate and complete information for permit applications</li>
              <li>Respond promptly to requests for additional documentation</li>
              <li>Pay fees as agreed upon in your service agreement</li>
              <li>Maintain communication with our team throughout the permit process</li>
              <li>Comply with all applicable laws and regulations</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Fees and Payment</h2>
            <p>
              Fees for our services are outlined in individual service agreements. Payment terms, refund policies, 
              and billing schedules will be specified in your contract with Expedition Group.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Limitation of Liability</h2>
            <p>
              While we strive for excellence in our permit expediting services, we cannot guarantee approval of any permit application. 
              Approval decisions are made by municipal authorities and are outside our control. Expedition Group shall not be liable for:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Permit denials or delays caused by municipal authorities</li>
              <li>Inaccurate information provided by clients</li>
              <li>Changes in regulations or municipal requirements</li>
              <li>Indirect, incidental, or consequential damages</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Intellectual Property</h2>
            <p>
              All content on our website, including text, graphics, logos, and software, is the property of Expedition Group 
              and is protected by copyright and trademark laws.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Confidentiality</h2>
            <p>
              We maintain strict confidentiality of all client information and project details. Your data will only be 
              shared as necessary to process permit applications or as required by law.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Termination</h2>
            <p>
              Either party may terminate services with written notice as specified in the service agreement. 
              Termination does not affect any outstanding payment obligations.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Governing Law</h2>
            <p>
              These Terms of Service shall be governed by and construed in accordance with the laws of the State of New York, 
              without regard to its conflict of law provisions.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Contact Us</h2>
            <p>
              If you have questions about these Terms of Service, please contact us at:
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
