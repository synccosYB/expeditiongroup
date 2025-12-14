import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileCheck,
  Clock,
  Users,
  CheckCircle2,
  MapPin,
  ArrowRight,
  Briefcase,
  Building2,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import logoFull from "@/assets/logo-expedition-group-checkbox.svg";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

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

const stats = [
  { value: "15+", label: "Years Experience" },
  { value: "500+", label: "Projects Completed" },
  { value: "98%", label: "Success Rate" },
  { value: "3", label: "Counties Served" },
];

function AnimatedSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function AnimatedCard({ children, className = "", index = 0 }: { children: React.ReactNode; className?: string; index?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 30, scale: 0.95 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: "easeOut" }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Counter({ value, label }: { value: string; label: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="text-center"
    >
      <motion.div 
        className="text-3xl md:text-4xl font-bold text-primary"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
      >
        {value}
      </motion.div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </motion.div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <motion.a 
            href="/" 
            className="flex items-center" 
            data-testid="link-logo-header"
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.2 }}
          >
            <img src={logoFull} alt="Expedition Group" className="h-9" />
          </motion.a>

          <nav className="hidden md:flex items-center gap-8">
            {[
              { href: "#services", label: "Services" },
              { href: "#how-it-works", label: "How It Works" },
              { href: "#who-we-serve", label: "Who We Serve" },
            ].map((link, i) => (
              <motion.a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative"
                data-testid={`link-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.1 }}
                whileHover={{ y: -2 }}
              >
                {link.label}
              </motion.a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <Button asChild data-testid="button-login">
                <a href="/api/login">Sign In</a>
              </Button>
            </motion.div>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden py-20 lg:py-28">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-accent/10 to-background" />
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-accent/15 to-transparent" />
          <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-gradient-to-tr from-primary/20 to-transparent rounded-full blur-3xl" />
          <motion.div 
            className="absolute inset-0 opacity-40"
            animate={{ 
              backgroundPosition: ["0% 0%", "100% 100%"],
            }}
            transition={{ 
              duration: 15, 
              repeat: Infinity, 
              repeatType: "reverse",
              ease: "linear"
            }}
            style={{
              backgroundImage: "radial-gradient(ellipse at 30% 20%, hsl(var(--primary) / 0.2) 0%, transparent 40%), radial-gradient(ellipse at 70% 80%, hsl(var(--accent) / 0.15) 0%, transparent 40%)",
              backgroundSize: "100% 100%",
            }}
          />
          <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <motion.h1 
                  className="text-4xl lg:text-5xl font-bold tracking-tight text-foreground mb-6"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                >
                  Permit Expediting for{" "}
                  <motion.span 
                    className="text-primary"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                  >
                    New York
                  </motion.span>{" "}
                  Construction
                </motion.h1>
                <motion.p 
                  className="text-lg text-muted-foreground mb-8 max-w-lg"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  Streamline your construction projects with professional permit
                  expediting services in Orange, Rockland, and Sullivan Counties.
                </motion.p>
                <motion.div 
                  className="flex flex-wrap gap-4 mb-8"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <Button size="lg" asChild data-testid="button-get-started">
                    <motion.a 
                      href="/api/login"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Get Started
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </motion.a>
                  </Button>
                  <Button size="lg" variant="outline" asChild data-testid="button-contact-us">
                    <motion.a 
                      href="#who-we-serve"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Learn More
                    </motion.a>
                  </Button>
                </motion.div>
                <motion.div 
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                >
                  <MapPin className="h-4 w-4 text-primary" />
                  <span>Serving Orange, Rockland & Sullivan Counties, NY</span>
                </motion.div>
              </div>
              <motion.div 
                className="relative hidden lg:block"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
              >
                <div className="absolute -inset-4 bg-gradient-to-br from-primary/30 via-accent/20 to-primary/10 rounded-3xl blur-xl" />
                <Card className="relative shadow-xl border-2 border-primary/20">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 rounded-lg" />
                  <CardContent className="relative p-8">
                    <div className="grid grid-cols-2 gap-6">
                      {stats.map((stat, i) => (
                        <Counter key={stat.label} value={stat.value} label={stat.label} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </section>

        <section id="services" className="py-20 bg-gradient-to-br from-primary/15 via-accent/5 to-muted/20">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <AnimatedSection className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground mb-3">
                Our Services
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Comprehensive permit expediting services to keep your construction
                projects on schedule.
              </p>
            </AnimatedSection>
            <div className="grid md:grid-cols-3 gap-6">
              {services.map((service, index) => (
                <AnimatedCard key={service.title} index={index}>
                  <Card className="h-full cursor-default border-primary/10 shadow-md">
                    <CardContent className="p-6">
                      <motion.div 
                        className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 mb-4 shadow-sm"
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        transition={{ duration: 0.2 }}
                      >
                        <service.icon className="h-7 w-7 text-primary" />
                      </motion.div>
                      <h3 className="text-xl font-semibold text-foreground mb-2">
                        {service.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {service.description}
                      </p>
                    </CardContent>
                  </Card>
                </AnimatedCard>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="py-20 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/5 to-transparent" />
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <AnimatedSection className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground mb-3">
                How It Works
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Our streamlined process ensures your permits are handled efficiently
                from start to finish.
              </p>
            </AnimatedSection>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {steps.map((step, index) => (
                <AnimatedCard key={step.number} index={index} className="relative h-full">
                  {index < steps.length - 1 && (
                    <div className="hidden lg:block absolute top-8 left-full w-full h-px bg-border -translate-x-1/2" />
                  )}
                  <Card className="h-full">
                    <CardContent className="p-6">
                      <div className="text-3xl font-bold text-muted-foreground/40 mb-2">
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
                </AnimatedCard>
              ))}
            </div>
          </div>
        </section>

        <section id="who-we-serve" className="py-20 bg-gradient-to-br from-accent/10 via-primary/10 to-muted/20">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <AnimatedSection>
                <h2 className="text-3xl font-bold text-foreground mb-4">
                  Who We Serve
                </h2>
                <p className="text-muted-foreground mb-6">
                  We partner with construction professionals across the New York
                  metropolitan area to streamline permit processes and accelerate
                  project timelines.
                </p>
                <div className="space-y-4">
                  {clientTypes.map((type, index) => (
                    <motion.div 
                      key={type.label} 
                      className="flex items-center gap-3"
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: index * 0.1 }}
                    >
                      <motion.div 
                        className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"
                        whileHover={{ scale: 1.1 }}
                      >
                        <type.icon className="h-5 w-5 text-primary" />
                      </motion.div>
                      <span className="font-medium text-foreground">
                        {type.label}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </AnimatedSection>
              <AnimatedSection delay={0.2}>
                <Card>
                  <CardContent className="p-8">
                    <div className="text-center">
                      <motion.div 
                        className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mx-auto mb-4"
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      >
                        <MapPin className="h-8 w-8 text-primary" />
                      </motion.div>
                      <h3 className="text-xl font-semibold text-foreground mb-2">
                        Service Area
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        Proudly serving construction projects throughout
                      </p>
                      <div className="space-y-2 text-sm">
                        {["Orange County, NY", "Rockland County, NY", "Sullivan County, NY"].map((county, i) => (
                          <motion.div 
                            key={county}
                            className="flex items-center justify-center gap-2"
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.15 }}
                          >
                            <CheckCircle2 className="h-4 w-4 text-chart-2" />
                            <span>{county}</span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </AnimatedSection>
            </div>
          </div>
        </section>

      </main>

      <footer className="border-t bg-muted/30">
        <div className="bg-primary/10 py-8">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <motion.div 
              className="flex flex-col md:flex-row items-center justify-between gap-4"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div>
                <h3 className="text-xl font-semibold text-foreground">Need permits expedited?</h3>
                <p className="text-muted-foreground">Get started with a free consultation today.</p>
              </div>
              <Button size="lg" asChild data-testid="button-footer-cta">
                <motion.a 
                  href="/api/login"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </motion.a>
              </Button>
            </motion.div>
          </div>
        </div>

        <div className="py-12">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="col-span-2 md:col-span-1">
                <div className="mb-4">
                  <img src={logoFull} alt="Expedition Group" className="h-9" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Professional permit expediting for construction projects in New York.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-4">Quick Links</h4>
                <div className="space-y-2 text-sm">
                  <a href="#services" className="block text-muted-foreground hover:text-foreground transition-colors">
                    Services
                  </a>
                  <a href="#how-it-works" className="block text-muted-foreground hover:text-foreground transition-colors">
                    How It Works
                  </a>
                  <a href="#who-we-serve" className="block text-muted-foreground hover:text-foreground transition-colors">
                    Who We Serve
                  </a>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-4">Contact</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>(845) 212-2040</p>
                  <p>Info@expeditiongroupny.com</p>
                  <p>17 Sandybrook Drive<br />Spring Valley, NY 10977</p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-4">Service Area</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>Orange County, NY</p>
                  <p>Rockland County, NY</p>
                  <p>Sullivan County, NY</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t py-6">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Expedition Group. All rights reserved.</p>
            <a href="/api/login" className="hover:text-foreground transition-colors" data-testid="link-client-portal">
              Client Portal
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
