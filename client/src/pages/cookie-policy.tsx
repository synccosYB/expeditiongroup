import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import logoFull from "@/assets/logo-expedition-group-checkbox.svg";

export default function CookiePolicy() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center">
          <a href="/" className="flex items-center" data-testid="link-logo-header">
            <img src={logoFull} alt="Expedition Group" className="h-9" />
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 lg:px-8 py-12">
        <Button variant="ghost" size="sm" asChild className="mb-6" data-testid="button-back">
          <a href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </a>
        </Button>

        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-8">Cookie Policy</h1>
        
        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-muted-foreground">
          <p className="text-lg">
            <strong className="text-foreground">Last Updated:</strong> December 14, 2025
          </p>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">What Are Cookies</h2>
            <p>
              Cookies are small text files that are stored on your computer or mobile device when you visit our website. 
              They are widely used to make websites work more efficiently and provide information to website owners.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">How We Use Cookies</h2>
            <p>Expedition Group uses cookies for the following purposes:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-foreground">Essential Cookies:</strong> These cookies are necessary for the website to function properly. They enable core functionality such as security, authentication, and session management.</li>
              <li><strong className="text-foreground">Performance Cookies:</strong> These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously.</li>
              <li><strong className="text-foreground">Functional Cookies:</strong> These cookies allow the website to remember choices you make (such as your preferred language or theme) and provide enhanced, more personal features.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Types of Cookies We Use</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-foreground">Session Cookies:</strong> These are temporary cookies that expire when you close your browser. We use these to maintain your login session.</li>
              <li><strong className="text-foreground">Persistent Cookies:</strong> These cookies remain on your device for a set period or until you delete them. We use these to remember your preferences.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Managing Cookies</h2>
            <p>
              Most web browsers allow you to control cookies through their settings. You can set your browser to refuse cookies 
              or delete certain cookies. However, if you block or delete cookies, some features of our website may not work properly.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Contact Us</h2>
            <p>
              If you have any questions about our Cookie Policy, please contact us at:
            </p>
            <p>
              <strong className="text-foreground">Email:</strong> Info@expeditiongroupny.com<br />
              <strong className="text-foreground">Phone:</strong> (845) 212-2040<br />
              <strong className="text-foreground">Address:</strong> 17 Sandybrook Drive, Spring Valley, NY 10977
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
