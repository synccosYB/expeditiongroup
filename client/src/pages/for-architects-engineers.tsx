import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Ruler, Clock, FileCheck, CheckCircle2, AlertTriangle, Pencil } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";

const benefits = [
  {
    icon: Clock,
    title: "More Time for Design",
    description: "Stop chasing permits and focus on what you trained for: creating exceptional designs. We handle the municipal interface so you can focus on your craft."
  },
  {
    icon: FileCheck,
    title: "Seamless Submissions",
    description: "We know exactly what each municipality requires. We ensure your drawings and documents are submitted correctly the first time, avoiding costly revision cycles."
  },
  {
    icon: CheckCircle2,
    title: "Better Client Experience",
    description: "Offer your clients faster project timelines with our expediting partnership. Differentiate your practice with streamlined permit processing."
  }
];

const painPoints = [
  "Hours spent on permit submissions instead of billable design work",
  "Navigating different requirements across multiple jurisdictions",
  "Back-and-forth revisions due to incomplete or incorrect submissions",
  "Clients frustrated by permit-related project delays",
  "Keeping up with ever-changing code requirements and local amendments"
];

const services = [
  "Permit application preparation and submission",
  "Code compliance pre-review",
  "Drawing review coordination with examiners",
  "Revision management and resubmission",
  "Variance and special permit applications",
  "Direct communication with municipal reviewers"
];

export default function ForArchitectsEngineers() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />

      <main className="flex-1">
        <section className="relative py-16 lg:py-20 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background pointer-events-none dark:from-primary/3" />
          <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl opacity-50 pointer-events-none dark:opacity-25" />
          <div className="absolute bottom-0 left-1/3 w-[300px] h-[300px] bg-primary/3 rounded-full blur-3xl opacity-40 pointer-events-none dark:opacity-20" />
          
          <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
            <Button variant="ghost" size="sm" asChild className="mb-8" data-testid="button-back">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Link>
            </Button>

            <div className="max-w-4xl">
              <div className="flex items-center gap-4 mb-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10">
                  <Ruler className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">For Architects & Engineers</h1>
                  <p className="text-lg text-muted-foreground mt-1">Design more. Wait less.</p>
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <Pencil className="h-6 w-6 text-primary shrink-0 mt-1" />
                  <div>
                    <h2 className="text-xl font-semibold text-foreground mb-2">Your Expertise is Design, Not Paperwork</h2>
                    <p className="text-muted-foreground leading-relaxed">
                      You spent years mastering your craft, whether it's creating beautiful architectural designs 
                      or engineering sound structural solutions. Your time is best spent on design innovation and 
                      client collaboration, not navigating municipal bureaucracy or waiting at permit counters. 
                      Every hour you spend on permit administration is an hour you're not doing what you love and 
                      what you're best at. Let Expedition Group handle the permit process while you focus on your designs.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-14 lg:py-16 bg-muted/30">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="max-w-4xl">
              <h2 className="text-2xl font-semibold text-foreground mb-6">Challenges You Face</h2>
              <Card className="border-border/40 bg-background">
                <CardContent className="p-6">
                  <ul className="space-y-3">
                    {painPoints.map((point, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{point}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="relative py-14 lg:py-16">
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-primary/2 to-transparent pointer-events-none dark:via-primary/1" />
          <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
            <div className="max-w-4xl">
              <h2 className="text-2xl font-semibold text-foreground mb-8">How We Help Architects & Engineers</h2>
              <div className="grid md:grid-cols-3 gap-4">
                {benefits.map((benefit, index) => (
                  <Card key={index} className="border-border/40">
                    <CardContent className="p-5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-3">
                        <benefit.icon className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-semibold text-foreground mb-2">{benefit.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{benefit.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-14 lg:py-16 bg-muted/30">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="max-w-4xl">
              <h2 className="text-2xl font-semibold text-foreground mb-6">Services for Architects & Engineers</h2>
              <Card className="border-border/40 bg-background">
                <CardContent className="p-6">
                  <div className="grid sm:grid-cols-2 gap-3">
                    {services.map((service, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                        <span className="text-foreground">{service}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-14 lg:py-16">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="max-w-4xl">
              <h2 className="text-2xl font-semibold text-foreground mb-6">Why It Pays to Partner With Us</h2>
              <Card className="border-border/40">
                <CardContent className="p-6">
                  <div className="space-y-4 text-muted-foreground">
                    <p className="leading-relaxed">
                      <strong className="text-foreground">Reclaim your billable hours.</strong> If you bill $100-250/hour 
                      for design work, every hour spent on permit administration is money left on the table. 
                      Our flat-fee expediting services often cost less than the hours you'd spend doing it yourself.
                    </p>
                    <p className="leading-relaxed">
                      <strong className="text-foreground">Fewer revision cycles.</strong> We know exactly what each 
                      municipality is looking for. Our pre-submission review catches issues before they become 
                      costly revision requests, saving you time and protecting your client relationships.
                    </p>
                    <p className="leading-relaxed">
                      <strong className="text-foreground">Competitive advantage.</strong> Offer your clients faster 
                      project timelines by including our expediting services. It's a differentiator that sets 
                      your practice apart and adds value clients will pay for.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="relative py-14 lg:py-16 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/15 to-primary/10 pointer-events-none dark:from-primary/5 dark:via-primary/8 dark:to-primary/5" />
          <div className="absolute top-0 right-1/3 w-[400px] h-[400px] bg-primary/10 rounded-full blur-3xl opacity-50 pointer-events-none dark:opacity-25" />
          <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-2xl font-semibold text-foreground mb-4">Ready to Focus on What You Do Best?</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
                Partner with Expedition Group and offer your clients faster project timelines. 
                We handle the permit bureaucracy while you focus on creating exceptional designs. 
                Get started today.
              </p>
              <Button asChild size="lg" data-testid="button-cta-architects">
                <a href="/auth" target="_blank" rel="noopener noreferrer">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
