import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileCheck,
  Clock,
  Users,
  CheckCircle2,
  MapPin,
  ArrowRight,
  Phone,
  Mail,
  Briefcase,
  Building2,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import logoFull from "@/assets/logo.svg";
import logoIcon from "@/assets/logo-icon.svg";

const services = [
  {
    icon: FileCheck,
    title: "Permit Processing",
    description:
      "We handle all aspects of permit applications, from initial submission to final approval.",
  },
  {
    icon: Clock,
    title: "Expedited Reviews",
    description:
      "Fast-track your projects with our established relationships with local municipalities.",
  },
  {
    icon: Users,
    title: "Stakeholder Coordination",
    description:
      "We coordinate between architects, engineers, surveyors, and municipal offices.",
  },
];

const steps = [
  {
    number: "01",
    title: "Initial Consultation",
    description: "We review your project requirements and timeline goals.",
  },
  {
    number: "02",
    title: "Document Preparation",
    description: "Our team prepares and organizes all necessary permit documentation.",
  },
  {
    number: "03",
    title: "Submission & Tracking",
    description: "We submit applications and actively track progress with authorities.",
  },
  {
    number: "04",
    title: "Approval & Handoff",
    description: "Receive your permits with full documentation and compliance records.",
  },
];

const clientTypes = [
  { icon: Building2, label: "General Contractors" },
  { icon: Briefcase, label: "Property Developers" },
  { icon: Users, label: "Architects & Engineers" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <a href="/" className="flex items-center" data-testid="link-logo-header">
            <img src={logoFull} alt="Expedition Plus Group" className="h-9" />
          </a>

          <nav className="hidden md:flex items-center gap-8">
            <a
              href="#services"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-services"
            >
              Services
            </a>
            <a
              href="#how-it-works"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-how-it-works"
            >
              How It Works
            </a>
            <a
              href="#who-we-serve"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-who-we-serve"
            >
              Who We Serve
            </a>
            <a
              href="#contact"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-contact"
            >
              Contact
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild data-testid="button-login">
              <a href="/api/login">Sign In</a>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden py-12 lg:py-16">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/5 to-background" />
          <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-foreground mb-6">
                  Permit Expediting for{" "}
                  <span className="text-primary">New York</span> Construction
                </h1>
                <p className="text-lg text-muted-foreground mb-8 max-w-lg">
                  Streamline your construction projects with professional permit
                  expediting services in Orange, Rockland, and Sullivan Counties.
                </p>
                <div className="flex flex-wrap gap-4 mb-8">
                  <Button size="lg" asChild data-testid="button-get-started">
                    <a href="/api/login">
                      Get Started
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                  <Button size="lg" variant="outline" asChild data-testid="button-contact-us">
                    <a href="#contact">Contact Us</a>
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span>Serving Orange, Rockland & Sullivan Counties, NY</span>
                </div>
              </div>
              <div className="relative hidden lg:block">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl" />
                <div className="relative bg-card border rounded-2xl p-8 shadow-lg">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-chart-2" />
                      <span className="text-sm font-medium">15+ Years Experience</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-chart-2" />
                      <span className="text-sm font-medium">500+ Projects Completed</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-chart-2" />
                      <span className="text-sm font-medium">Municipal Relationships</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-chart-2" />
                      <span className="text-sm font-medium">Real-Time Project Tracking</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="services" className="py-12 bg-gradient-to-b from-primary/10 to-muted/30">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-foreground mb-2">
                Our Services
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Comprehensive permit expediting services to keep your construction
                projects on schedule.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {services.map((service) => (
                <Card key={service.title} className="hover-elevate">
                  <CardContent className="p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-4">
                      <service.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                      {service.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {service.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="py-12">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-foreground mb-2">
                How It Works
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Our streamlined process ensures your permits are handled efficiently
                from start to finish.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {steps.map((step, index) => (
                <div key={step.number} className="relative h-full">
                  {index < steps.length - 1 && (
                    <div className="hidden lg:block absolute top-8 left-full w-full h-px bg-border -translate-x-1/2" />
                  )}
                  <Card className="h-full">
                    <CardContent className="p-6">
                      <div className="text-3xl font-bold text-primary/20 mb-2">
                        {step.number}
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        {step.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {step.description}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="who-we-serve" className="py-12 bg-gradient-to-b from-muted/30 to-primary/10">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold text-foreground mb-4">
                  Who We Serve
                </h2>
                <p className="text-muted-foreground mb-6">
                  We partner with construction professionals across the New York
                  metropolitan area to streamline permit processes and accelerate
                  project timelines.
                </p>
                <div className="space-y-4">
                  {clientTypes.map((type) => (
                    <div key={type.label} className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <type.icon className="h-5 w-5 text-primary" />
                      </div>
                      <span className="font-medium text-foreground">
                        {type.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <Card>
                <CardContent className="p-8">
                  <div className="text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mx-auto mb-4">
                      <MapPin className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                      Service Area
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Proudly serving construction projects throughout
                    </p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-chart-2" />
                        <span>Orange County, NY</span>
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-chart-2" />
                        <span>Rockland County, NY</span>
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-chart-2" />
                        <span>Sullivan County, NY</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section id="contact" className="py-12">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-foreground mb-2">
                Get In Touch
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Ready to streamline your permit process? Contact us today for a
                consultation.
              </p>
            </div>
            <div className="max-w-xl mx-auto">
              <Card>
                <CardContent className="p-8">
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Phone className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <a href="tel:845-212-2040" className="font-medium text-foreground hover:text-primary transition-colors" data-testid="link-phone">(845) 212-2040</a>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Mail className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <a href="mailto:Info@expeditiongroupny.com" className="font-medium text-foreground hover:text-primary transition-colors" data-testid="link-email">
                          Info@expeditiongroupny.com
                        </a>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <MapPin className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Address</p>
                        <p className="font-medium text-foreground">
                          17 Sandybrook Drive<br />Spring Valley, NY 10977
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-8 pt-6 border-t">
                    <Button className="w-full" size="lg" asChild data-testid="button-sign-in-contact">
                      <a href="/api/login">
                        Sign In to Your Account
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="mb-4">
                <img src={logoFull} alt="Expedition Plus Group" className="h-9" />
              </div>
              <p className="text-sm text-muted-foreground">
                Professional permit expediting services for construction projects
                in New York.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Quick Links</h4>
              <div className="space-y-2 text-sm">
                <a
                  href="#services"
                  className="block text-muted-foreground hover:text-foreground transition-colors"
                >
                  Services
                </a>
                <a
                  href="#how-it-works"
                  className="block text-muted-foreground hover:text-foreground transition-colors"
                >
                  How It Works
                </a>
                <a
                  href="#contact"
                  className="block text-muted-foreground hover:text-foreground transition-colors"
                >
                  Contact
                </a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Service Area</h4>
              <p className="text-sm text-muted-foreground">
                Orange, Rockland & Sullivan Counties, NY
              </p>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Expedition Plus Group. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
