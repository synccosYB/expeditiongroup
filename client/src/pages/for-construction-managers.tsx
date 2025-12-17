import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Briefcase, Clock, FileCheck, CheckCircle2, AlertTriangle, ClipboardList } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";

const benefits = [
  {
    icon: Clock,
    title: "Keep Projects On Schedule",
    description: "Permit delays ripple through entire project timelines. Our expediting services prevent bottlenecks and keep your carefully planned schedules intact."
  },
  {
    icon: FileCheck,
    title: "Centralized Permit Management",
    description: "Managing multiple trades and permits? We provide consolidated tracking and status updates, giving you visibility across all permit activities."
  },
  {
    icon: CheckCircle2,
    title: "Reduce Your Risk",
    description: "Late permits mean missed deadlines and unhappy clients. Our proactive approach identifies and resolves potential issues before they impact your schedule."
  }
];

const painPoints = [
  "Coordinating permits across multiple subcontractors and trades",
  "Permit delays throwing off carefully planned construction schedules",
  "Lack of visibility into permit status across all project phases",
  "Time spent following up with municipalities instead of managing the site",
  "Unexpected permit issues causing costly project delays"
];

const services = [
  "Multi-trade permit coordination",
  "Phased permit scheduling",
  "Real-time status tracking and reporting",
  "Inspection scheduling and coordination",
  "Change order permit processing",
  "Close-out documentation and CO processing"
];

export default function ForConstructionManagers() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />

      <main className="flex-1">
        <section className="relative py-16 lg:py-20 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background pointer-events-none dark:from-primary/3" />
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl opacity-50 pointer-events-none dark:opacity-25" />
          <div className="absolute bottom-0 right-1/3 w-[300px] h-[300px] bg-primary/3 rounded-full blur-3xl opacity-40 pointer-events-none dark:opacity-20" />
          
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
                  <Briefcase className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">For Construction Managers</h1>
                  <p className="text-lg text-muted-foreground mt-1">Manage your projects. We'll manage your permits.</p>
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <ClipboardList className="h-6 w-6 text-primary shrink-0 mt-1" />
                  <div>
                    <h2 className="text-xl font-semibold text-foreground mb-2">Your Job is Keeping Projects On Track</h2>
                    <p className="text-muted-foreground leading-relaxed">
                      As a construction manager, you're the orchestrator of complex projects, coordinating dozens of 
                      moving pieces to deliver on time and on budget. Your value is in managing schedules, 
                      coordinating trades, and solving problems on the job site, not sitting in municipal offices 
                      waiting for permit approvals. Every hour you spend on permit bureaucracy is an hour you're 
                      not managing your project. Let Expedition Group handle the permit coordination while you 
                      keep your projects running smoothly.
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
              <h2 className="text-2xl font-semibold text-foreground mb-6">Challenges Construction Managers Face</h2>
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
              <h2 className="text-2xl font-semibold text-foreground mb-8">How We Help Construction Managers</h2>
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
              <h2 className="text-2xl font-semibold text-foreground mb-6">Services for Construction Managers</h2>
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
                      <strong className="text-foreground">Project delays are costly.</strong> When permits hold up 
                      one trade, it cascades through your entire schedule. Subcontractors get rescheduled, 
                      equipment rentals extend, and overhead costs compound. We prevent those bottlenecks before 
                      they happen.
                    </p>
                    <p className="leading-relaxed">
                      <strong className="text-foreground">Visibility without the work.</strong> Managing permit status 
                      across multiple trades and phases takes significant coordination. We provide consolidated 
                      tracking and proactive updates so you always know where things stand without chasing it down.
                    </p>
                    <p className="leading-relaxed">
                      <strong className="text-foreground">Protect your reputation.</strong> Missed deadlines affect 
                      client relationships and future bids. Our proactive approach identifies and resolves 
                      permit issues early, helping you deliver on time and build the track record that wins 
                      new business.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="relative py-14 lg:py-16 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/15 to-primary/10 pointer-events-none dark:from-primary/5 dark:via-primary/8 dark:to-primary/5" />
          <div className="absolute top-0 left-1/3 w-[400px] h-[400px] bg-primary/10 rounded-full blur-3xl opacity-50 pointer-events-none dark:opacity-25" />
          <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-2xl font-semibold text-foreground mb-4">Ready to Eliminate Permit Bottlenecks?</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
                Stop letting permit delays derail your project schedules. Partner with Expedition Group 
                for proactive permit management that keeps your projects moving forward. 
                Schedule a consultation today.
              </p>
              <Button asChild size="lg" data-testid="button-cta-managers">
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
