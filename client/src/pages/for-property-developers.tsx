import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Building2, Clock, FileCheck, CheckCircle2, AlertTriangle, TrendingUp } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";

const benefits = [
  {
    icon: Clock,
    title: "Accelerate Your Timeline",
    description: "Permit delays can cost thousands per day in carrying costs. Our expediting services keep your projects moving and your ROI on track."
  },
  {
    icon: FileCheck,
    title: "Multi-Project Management",
    description: "Developing multiple properties? We manage all your permit applications simultaneously, providing consolidated tracking and reporting."
  },
  {
    icon: TrendingUp,
    title: "Maximize Your Investment",
    description: "Every day of delay is money lost. Our established municipal relationships help get approvals faster, protecting your investment timeline."
  }
];

const painPoints = [
  "Permit delays pushing back project timelines and increasing carrying costs",
  "Coordinating permits across multiple simultaneous development projects",
  "Navigating different requirements across Orange, Rockland, and Sullivan Counties",
  "Managing architects, engineers, and municipal requirements",
  "Unexpected permit rejections derailing financing schedules"
];

const services = [
  "Site plan and subdivision approvals",
  "Zoning variance applications",
  "Multi-family and commercial building permits",
  "Environmental and planning board submissions",
  "Cross-department coordination",
  "Phased development permit strategies"
];

export default function ForPropertyDevelopers() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />

      <main className="flex-1">
        <section className="relative py-16 lg:py-20 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background pointer-events-none dark:from-primary/3" />
          <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl opacity-50 pointer-events-none dark:opacity-25" />
          <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] bg-primary/3 rounded-full blur-3xl opacity-40 pointer-events-none dark:opacity-20" />
          
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
                  <Building2 className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">For Property Developers</h1>
                  <p className="text-lg text-muted-foreground mt-1">Protect your timeline. Maximize your returns.</p>
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <TrendingUp className="h-6 w-6 text-primary shrink-0 mt-1" />
                  <div>
                    <h2 className="text-xl font-semibold text-foreground mb-2">Your Expertise is Development, Not Red Tape</h2>
                    <p className="text-muted-foreground leading-relaxed">
                      As a property developer, your focus should be on identifying opportunities, securing financing, 
                      and managing your investment portfolio. Every day spent navigating municipal bureaucracy is a day 
                      your capital isn't working. Permit delays directly impact your carrying costs and ROI. 
                      Let Expedition Group handle the complex permit process while you focus on growing your 
                      development business.
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
              <h2 className="text-2xl font-semibold text-foreground mb-6">Challenges Developers Face</h2>
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
              <h2 className="text-2xl font-semibold text-foreground mb-8">How We Help Property Developers</h2>
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
              <h2 className="text-2xl font-semibold text-foreground mb-6">Services for Property Developers</h2>
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
                      <strong className="text-foreground">Time is money, literally.</strong> With carrying costs 
                      running $500-5,000+ per day on typical development projects, every week of permit delay 
                      directly erodes your ROI. Our expediting services typically save 2-4 weeks on approval timelines.
                    </p>
                    <p className="leading-relaxed">
                      <strong className="text-foreground">Protect your financing schedules.</strong> Lenders and investors 
                      have deadlines. Permit delays can trigger extension fees, penalty rates, or worse, jeopardize 
                      your funding entirely. We provide the predictability your financial partners require.
                    </p>
                    <p className="leading-relaxed">
                      <strong className="text-foreground">Scale without the headaches.</strong> Managing permits across 
                      multiple simultaneous projects requires significant administrative overhead. We handle that 
                      complexity so you can focus on finding and closing your next deal.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="relative py-14 lg:py-16 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/15 to-primary/10 pointer-events-none dark:from-primary/5 dark:via-primary/8 dark:to-primary/5" />
          <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-primary/10 rounded-full blur-3xl opacity-50 pointer-events-none dark:opacity-25" />
          <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-2xl font-semibold text-foreground mb-4">Ready to Protect Your Investment Timeline?</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
                Don't let permit delays eat into your profits. Partner with Expedition Group for 
                streamlined permit processing that keeps your developments on schedule. 
                Schedule a consultation today.
              </p>
              <Button asChild size="lg" data-testid="button-cta-developers">
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
