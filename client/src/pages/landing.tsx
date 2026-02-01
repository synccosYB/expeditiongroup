import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  FileCheck,
  Clock,
  Users,
  CheckCircle2,
  MapPin,
  ArrowRight,
  Briefcase,
  Building2,
  HardHat,
  Ruler,
  Mail,
  Loader2,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import logoFull from "@/assets/logo-expedition-group-checkbox.svg";
import { motion, useInView } from "framer-motion";

const services = [
  {
    icon: FileCheck,
    title: "Permit Processing",
    description:
      "Complete handling of permit applications from initial submission through final approval.",
  },
  {
    icon: Clock,
    title: "Expedited Reviews",
    description:
      "Fast-track your projects with our established municipal relationships.",
  },
  {
    icon: Users,
    title: "Stakeholder Coordination",
    description:
      "Seamless coordination between architects, engineers, and municipal offices.",
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
    description: "Our team prepares all necessary permit documentation.",
  },
  {
    number: "03",
    title: "Submission & Tracking",
    description: "We submit applications and actively track progress.",
  },
  {
    number: "04",
    title: "Approval & Handoff",
    description: "Receive permits with full documentation and records.",
  },
];

const clientTypes = [
  { icon: HardHat, label: "General Contractors", href: "/for-general-contractors" },
  { icon: Building2, label: "Property Developers", href: "/for-property-developers" },
  { icon: Ruler, label: "Architects & Engineers", href: "/for-architects-engineers" },
  { icon: Briefcase, label: "Construction Managers", href: "/for-construction-managers" },
];

const stats = [
  { value: "10+", label: "Years Experience" },
  { value: "200+", label: "Projects Completed" },
  { value: "98%", label: "Success Rate" },
];

function AnimatedSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
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
      initial={{ opacity: 0, y: 25 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 25 }}
      transition={{ duration: 0.4, delay: index * 0.1, ease: "easeOut" }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
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
      initial={{ opacity: 0, scale: 0.9 }}
      animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="text-center"
    >
      <motion.div 
        className="text-4xl md:text-5xl font-bold text-primary"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
      >
        {value}
      </motion.div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mt-2">{label}</div>
    </motion.div>
  );
}

export default function Landing() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");

  const subscribeMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest("POST", "/api/newsletter/subscribe", { email });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Subscribed!",
        description: "Thank you for subscribing to our newsletter.",
      });
      setEmail("");
    },
    onError: (error: Error) => {
      toast({
        title: "Subscription failed",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      subscribeMutation.mutate(email.trim());
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/50">
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

          <nav className="hidden md:flex items-center gap-10">
            {[
              { href: "#services", label: "Services" },
              { href: "#how-it-works", label: "How It Works" },
              { href: "#who-we-serve", label: "Who We Serve" },
            ].map((link, i) => (
              <motion.a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors relative group"
                data-testid={`link-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.1 }}
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full" />
              </motion.a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <Button size="sm" asChild data-testid="button-login">
                <a href="/auth" target="_blank" rel="noopener noreferrer">Sign In</a>
              </Button>
            </motion.div>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden py-16 lg:py-20">
          <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background pointer-events-none" />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[700px] bg-primary/8 rounded-full blur-3xl opacity-40 pointer-events-none dark:opacity-20" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl opacity-60 pointer-events-none dark:opacity-30" />
          <div className="absolute top-0 left-0 w-[300px] h-[300px] bg-primary/3 rounded-full blur-3xl opacity-50 pointer-events-none dark:opacity-25" />
          
          <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <span className="text-lg md:text-xl text-muted-foreground font-medium">
                    Permit Expediting for
                  </span>
                </motion.div>
                <motion.h1 
                  className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mt-2 mb-6"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                >
                  Orange, Rockland &amp; Sullivan County{" "}
                  <span className="text-primary">Construction</span>
                </motion.h1>
                <motion.p 
                  className="text-lg md:text-xl text-muted-foreground mb-8 max-w-lg leading-relaxed"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  Streamline your construction projects with professional permit
                  expediting services. We handle the paperwork so you can focus on building.
                </motion.p>
                <motion.div 
                  className="flex flex-wrap gap-4 mb-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  <Button size="lg" asChild data-testid="button-get-started" className="text-base px-8">
                    <motion.a 
                      href="/auth"
                      target="_blank"
                      rel="noopener noreferrer"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Get Started
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </motion.a>
                  </Button>
                  <Button size="lg" variant="outline" asChild data-testid="button-learn-more" className="text-base">
                    <motion.a 
                      href="#services"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Learn More
                    </motion.a>
                  </Button>
                </motion.div>
                <motion.p 
                  className="text-sm text-muted-foreground"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                >
                  Typical response time: within 1 business day
                </motion.p>
              </div>
              
              <motion.div 
                className="relative hidden lg:block"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, delay: 0.3 }}
              >
                <div className="absolute -inset-2 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent rounded-2xl blur-lg" />
                <Card className="relative border-border/50 shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex justify-between gap-6">
                      {stats.map((stat, i) => (
                        <Counter key={stat.label} value={stat.value} label={stat.label} />
                      ))}
                    </div>
                    <div className="mt-6 pt-4 border-t border-border/50">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span>Serving NY Hudson Valley Region</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </section>

        <section id="services" className="relative py-14 lg:py-16 bg-muted/30">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/3 to-transparent pointer-events-none dark:via-primary/2" />
          <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
            <AnimatedSection className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Our Services
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Comprehensive permit expediting services to keep your construction
                projects on schedule and within budget.
              </p>
            </AnimatedSection>
            <div className="grid md:grid-cols-3 gap-6">
              {services.map((service, index) => (
                <AnimatedCard key={service.title} index={index}>
                  <Card className="h-full border-border/40 shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-4">
                        <service.icon className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        {service.title}
                      </h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {service.description}
                      </p>
                    </CardContent>
                  </Card>
                </AnimatedCard>
              ))}
            </div>
          </div>
        </section>

        <section className="py-10 lg:py-12 border-y border-border/30 bg-background">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <AnimatedSection>
              <div className="text-center mb-4">
                <p className="text-sm uppercase tracking-wider text-muted-foreground mb-1">Trusted By</p>
                <h3 className="text-lg font-medium text-foreground">Construction Professionals Across the Hudson Valley</h3>
              </div>
              <div className="flex flex-wrap justify-center gap-12 items-center opacity-70">
                {clientTypes.map((type, i) => (
                  <motion.div 
                    key={type.label}
                    className="flex items-center gap-3 text-muted-foreground"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <type.icon className="h-6 w-6" />
                    <span className="font-medium">{type.label}</span>
                  </motion.div>
                ))}
              </div>
            </AnimatedSection>
          </div>
        </section>

        <section id="how-it-works" className="relative py-14 lg:py-16">
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-primary/2 to-transparent pointer-events-none dark:via-primary/1" />
          <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
            <AnimatedSection className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                How It Works
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Our streamlined process ensures your permits are handled efficiently
                from start to finish.
              </p>
            </AnimatedSection>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {steps.map((step, index) => (
                <AnimatedCard key={step.number} index={index} className="relative h-full">
                  {index < steps.length - 1 && (
                    <div className="hidden lg:block absolute top-10 left-full w-full h-px bg-border -translate-x-1/2 z-0" />
                  )}
                  <Card className="h-full border-border/40 shadow-sm relative z-10">
                    <CardContent className="p-5">
                      <div className="text-4xl font-bold text-primary/30 mb-3">
                        {step.number}
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        {step.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {step.description}
                      </p>
                    </CardContent>
                  </Card>
                </AnimatedCard>
              ))}
            </div>
          </div>
        </section>

        <section id="who-we-serve" className="relative py-14 lg:py-16 bg-muted/30">
          <div className="absolute inset-0 bg-gradient-to-t from-transparent via-primary/3 to-transparent pointer-events-none dark:via-primary/2" />
          <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <AnimatedSection>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                  Who We Serve
                </h2>
                <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                  We partner with construction professionals across the New York
                  Hudson Valley region to streamline permit processes and accelerate
                  project timelines.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {clientTypes.map((type, index) => (
                    <motion.a 
                      key={type.label}
                      href={type.href}
                      className="flex items-center gap-3 p-4 rounded-lg bg-background border border-border/40 cursor-pointer"
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      whileHover={{ y: -3, transition: { duration: 0.2 } }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: index * 0.1 }}
                      data-testid={`link-client-type-${type.label.toLowerCase().replace(/\s+/g, "-").replace("&", "and")}`}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <type.icon className="h-5 w-5 text-primary" />
                      </div>
                      <span className="font-medium text-foreground text-sm">
                        {type.label}
                      </span>
                    </motion.a>
                  ))}
                </div>
              </AnimatedSection>
              <AnimatedSection delay={0.2}>
                <Card className="border-border/40 shadow-sm">
                  <CardContent className="p-6">
                    <div className="text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mx-auto mb-4">
                        <MapPin className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-3">
                        Service Area
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        Proudly serving construction projects throughout
                      </p>
                      <div className="space-y-2">
                        {["Orange County, NY", "Rockland County, NY", "Sullivan County, NY"].map((county, i) => (
                          <motion.div 
                            key={county}
                            className="flex items-center justify-center gap-3"
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.15 }}
                          >
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                            <span className="font-medium">{county}</span>
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

        <section className="relative py-14 lg:py-16 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/15 to-primary/10 pointer-events-none dark:from-primary/5 dark:via-primary/8 dark:to-primary/5" />
          <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-primary/10 rounded-full blur-3xl opacity-50 pointer-events-none dark:opacity-25" />
          <div className="absolute bottom-0 left-1/4 w-[300px] h-[300px] bg-primary/5 rounded-full blur-3xl opacity-60 pointer-events-none dark:opacity-30" />
          <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
            <AnimatedSection>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-5">
                Ready to Expedite Your Permits?
              </h2>
              <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
                Get started with a free consultation and see how we can accelerate your next project.
              </p>
              <Button size="lg" asChild data-testid="button-cta-bottom" className="text-base px-10">
                <motion.a 
                  href="/auth"
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </motion.a>
              </Button>
            </AnimatedSection>
          </div>
        </section>

        <section id="newsletter" className="py-14 lg:py-16 bg-muted/40 border-t border-border/30">
          <div className="max-w-2xl mx-auto px-6 lg:px-8 text-center">
            <AnimatedSection>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mx-auto mb-5">
                <Mail className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                Sign Up for Our Newsletter
              </h2>
              <p className="text-muted-foreground mb-8">
                Stay updated with the latest permit news, regulatory changes, and industry insights.
              </p>
              <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1"
                  data-testid="input-newsletter-email"
                />
                <Button 
                  type="submit" 
                  disabled={subscribeMutation.isPending}
                  data-testid="button-newsletter-subscribe"
                >
                  {subscribeMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Subscribe"
                  )}
                </Button>
              </form>
              <p className="text-xs text-muted-foreground mt-4">
                We respect your privacy. Unsubscribe at any time.
              </p>
            </AnimatedSection>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50 bg-background">
        <div className="py-10 lg:py-12">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="col-span-2 md:col-span-1">
                <div className="mb-4">
                  <img src={logoFull} alt="Expedition Group" className="h-9" />
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Professional permit expediting for construction projects in the Hudson Valley.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-4">Quick Links</h4>
                <div className="space-y-3 text-sm">
                  <a href="#services" className="block text-muted-foreground hover:text-primary transition-colors">
                    Services
                  </a>
                  <a href="#how-it-works" className="block text-muted-foreground hover:text-primary transition-colors">
                    How It Works
                  </a>
                  <a href="/about-us" className="block text-muted-foreground hover:text-primary transition-colors" data-testid="link-about-us">
                    About Us
                  </a>
                  <a href="/our-story" className="block text-muted-foreground hover:text-primary transition-colors" data-testid="link-our-story">
                    Our Story
                  </a>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-4">Contact</h4>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>(845) 212-2040</p>
                  <p>Info@expeditiongroupny.com</p>
                  <p>17 Sandybrook Drive<br />Spring Valley, NY 10977</p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-4">Service Area</h4>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>Orange County, NY</p>
                  <p>Rockland County, NY</p>
                  <p>Sullivan County, NY</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t py-6">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
              <p>&copy; {new Date().getFullYear()} Expedition Group. All rights reserved.</p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <a href="/privacy-policy" className="hover:text-primary transition-colors" data-testid="link-privacy-policy">
                  Privacy Policy
                </a>
                <a href="/terms-of-service" className="hover:text-primary transition-colors" data-testid="link-terms-of-service">
                  Terms of Service
                </a>
                <a href="/cookie-policy" className="hover:text-primary transition-colors" data-testid="link-cookie-policy">
                  Cookie Policy
                </a>
              </div>
              <a href="/auth" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors" data-testid="link-client-portal">
                Client Portal
              </a>
            </div>
            <div className="text-center mt-4 text-sm text-muted-foreground">
              Site powered by{" "}
              <a 
                href="https://www.synkdex.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="font-medium text-primary underline"
                data-testid="link-synkdex-footer"
              >
                www.synkdex.com
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
