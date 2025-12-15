import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, MapPin, Phone, Mail, CheckCircle2 } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";

const values = [
  {
    title: "Expertise",
    description: "Over 15 years of experience navigating municipal permit processes in the Hudson Valley region."
  },
  {
    title: "Efficiency",
    description: "Streamlined processes and established relationships that accelerate your project timelines."
  },
  {
    title: "Transparency",
    description: "Clear communication and real-time updates on your permit application status."
  },
  {
    title: "Reliability",
    description: "A 98% success rate and consistent delivery on our commitments to clients."
  }
];

const stats = [
  { value: "15+", label: "Years of Experience" },
  { value: "500+", label: "Projects Completed" },
  { value: "98%", label: "Success Rate" },
  { value: "3", label: "Counties Served" }
];

export default function AboutUs() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />

      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        <Button variant="ghost" size="sm" asChild className="mb-6" data-testid="button-back">
          <a href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </a>
        </Button>

        <div className="max-w-4xl">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-6">About Expedition Group</h1>
          
          <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
            Expedition Group is a premier permit expediting firm serving the construction industry in Orange, Rockland, 
            and Sullivan Counties, New York. We specialize in navigating the complex municipal permit process, 
            allowing contractors, developers, and construction professionals to focus on what they do best: building.
          </p>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-4">Our Mission</h2>
              <p className="text-muted-foreground leading-relaxed">
                To streamline the construction permit process in the Hudson Valley region, reducing delays and 
                frustration for our clients while maintaining the highest standards of professionalism and integrity.
              </p>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-4">Our Vision</h2>
              <p className="text-muted-foreground leading-relaxed">
                To be the trusted partner for every construction professional in our service area, known for our 
                expertise, reliability, and commitment to client success.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            {stats.map((stat) => (
              <Card key={stat.label} className="border-border/40">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-primary mb-2">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <h2 className="text-2xl font-semibold text-foreground mb-6">Our Values</h2>
          <div className="grid md:grid-cols-2 gap-4 mb-12">
            {values.map((value) => (
              <div key={value.title} className="flex gap-4 p-4 rounded-lg bg-muted/30 border border-border/40">
                <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{value.title}</h3>
                  <p className="text-sm text-muted-foreground">{value.description}</p>
                </div>
              </div>
            ))}
          </div>

          <Card className="border-border/40">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">Contact Information</h2>
              <div className="space-y-3 text-muted-foreground">
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-primary" />
                  <span>(845) 212-2040</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-primary" />
                  <span>Info@expeditiongroupny.com</span>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span>17 Sandybrook Drive<br />Spring Valley, NY 10977</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
