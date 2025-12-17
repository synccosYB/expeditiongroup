import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, HardHat, Clock, FileCheck, CheckCircle2, AlertTriangle, Hammer } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";

const benefits = [
  {
    icon: Clock,
    title: "Save Valuable Time",
    description: "Stop spending hours in DOB offices waiting in line. We handle all permit submissions, follow-ups, and corrections so you can stay on the job site."
  },
  {
    icon: FileCheck,
    title: "Expert Navigation",
    description: "We know the local codes, required documents, and municipal processes inside and out. Avoid costly rejections and delays from incomplete applications."
  },
  {
    icon: CheckCircle2,
    title: "Faster Approvals",
    description: "Our established relationships with local building departments help expedite reviews and get your permits approved faster."
  }
];

const painPoints = [
  "Waiting hours at the DOB only to find out you're missing one document",
  "Juggling multiple permit applications across different projects",
  "Losing billable hours to paperwork instead of building",
  "Dealing with confusing municipal requirements and code changes",
  "Project delays due to permit rejections or revision requests"
];

const services = [
  "Building permit applications and submissions",
  "Code compliance review and consultation",
  "Permit status tracking and follow-up",
  "Document preparation and organization",
  "Revision handling and resubmissions",
  "Certificate of Occupancy processing"
];

export default function ForGeneralContractors() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />

      <main className="flex-1">
        <section className="relative py-16 lg:py-20 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background pointer-events-none dark:from-primary/3" />
          <div className="absolute top-0 right-1/3 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl opacity-50 pointer-events-none dark:opacity-25" />
          <div className="absolute bottom-0 left-1/4 w-[300px] h-[300px] bg-primary/3 rounded-full blur-3xl opacity-40 pointer-events-none dark:opacity-20" />
          
          <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
            <Button variant="ghost" size="sm" asChild className="mb-8" data-testid="button-back">
              <a href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </a>
            </Button>

            <div className="max-w-4xl">
              <div className="flex items-center gap-4 mb-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10">
                  <HardHat className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">For General Contractors</h1>
                  <p className="text-lg text-muted-foreground mt-1">Focus on building. We'll handle the permits.</p>
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <Hammer className="h-6 w-6 text-primary shrink-0 mt-1" />
                  <div>
                    <h2 className="text-xl font-semibold text-foreground mb-2">Your Profession is Building, Not Bureaucracy</h2>
                    <p className="text-muted-foreground leading-relaxed">
                      As a general contractor, your expertise is putting hammer to nail and making houses stand. 
                      Why waste valuable time sitting in DOB offices, navigating complex permit requirements, 
                      and dealing with endless paperwork? Every hour you spend in line is an hour you're not 
                      on the job site generating revenue. Let Expedition Group handle the bureaucratic navigation 
                      while you focus on what you do best: building.
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
              <h2 className="text-2xl font-semibold text-foreground mb-6">Sound Familiar?</h2>
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
              <h2 className="text-2xl font-semibold text-foreground mb-8">How We Help General Contractors</h2>
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
              <h2 className="text-2xl font-semibold text-foreground mb-6">Services for General Contractors</h2>
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
                      <strong className="text-foreground">Every hour at the DOB costs you money.</strong> When you're waiting 
                      in line instead of on the job site, you're losing billable hours. If you charge $75-150/hour for your 
                      time, a single permit run can cost you $300-600 in lost productivity, not counting the gas, parking, 
                      and frustration.
                    </p>
                    <p className="leading-relaxed">
                      <strong className="text-foreground">Permit rejections are expensive.</strong> An incomplete application 
                      doesn't just delay your project, it means another trip, more waiting, and potentially weeks of 
                      schedule slippage. Our expertise means applications are complete the first time.
                    </p>
                    <p className="leading-relaxed">
                      <strong className="text-foreground">Your crew is waiting.</strong> When permits are delayed, your 
                      subcontractors move to other jobs. You lose scheduling priority and momentum. We keep your 
                      permit pipeline flowing so your crews stay working.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="relative py-14 lg:py-16 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/15 to-primary/10 pointer-events-none dark:from-primary/5 dark:via-primary/8 dark:to-primary/5" />
          <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-primary/10 rounded-full blur-3xl opacity-50 pointer-events-none dark:opacity-25" />
          <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-2xl font-semibold text-foreground mb-4">Ready to Get Back to Building?</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
                Stop losing time to permit paperwork. Partner with Expedition Group and let us handle 
                the DOB while you focus on your projects. Get started with a free consultation today.
              </p>
              <Button asChild size="lg" data-testid="button-cta-contractors">
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
