import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Building2, Users, Award, TrendingUp } from "lucide-react";
import logoFull from "@/assets/logo-expedition-group-checkbox.svg";

const milestones = [
  {
    year: "2009",
    title: "The Beginning",
    description: "Expedition Group was founded with a simple mission: to help contractors navigate the complex permit process in the Hudson Valley.",
    icon: Building2
  },
  {
    year: "2014",
    title: "Expanding Our Reach",
    description: "After establishing strong relationships in Rockland County, we expanded our services to Orange and Sullivan Counties.",
    icon: TrendingUp
  },
  {
    year: "2019",
    title: "500+ Projects Milestone",
    description: "We celebrated completing our 500th successful permit expedition, serving clients from small contractors to major developers.",
    icon: Award
  },
  {
    year: "2024",
    title: "Digital Transformation",
    description: "Launch of our client portal, providing real-time project tracking and seamless communication for all clients.",
    icon: Users
  }
];

export default function OurStory() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center">
          <a href="/" className="flex items-center" data-testid="link-logo-header">
            <img src={logoFull} alt="Expedition Group" className="h-9" />
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        <Button variant="ghost" size="sm" asChild className="mb-6" data-testid="button-back">
          <a href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </a>
        </Button>

        <div className="max-w-4xl">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-6">Our Story</h1>
          
          <div className="space-y-6 text-muted-foreground mb-12">
            <p className="text-lg leading-relaxed">
              Expedition Group was born from a simple observation: construction professionals in the Hudson Valley 
              were spending too much time dealing with permit paperwork instead of doing what they do best, building.
            </p>
            
            <p className="leading-relaxed">
              Our founder, with deep roots in the local construction industry, recognized that navigating municipal 
              permit processes required specialized knowledge and relationships that most contractors simply didn't 
              have time to develop. What started as helping a few local contractors has grown into a comprehensive 
              permit expediting service trusted by developers, architects, and construction managers across three counties.
            </p>

            <p className="leading-relaxed">
              Over the years, we've built strong relationships with municipal offices throughout Orange, Rockland, 
              and Sullivan Counties. We understand the unique requirements of each jurisdiction, the nuances of 
              local regulations, and the most efficient paths to permit approval. This expertise translates directly 
              into faster turnarounds and fewer delays for our clients.
            </p>

            <p className="leading-relaxed">
              Today, Expedition Group continues to serve the Hudson Valley construction community with the same 
              dedication and personal touch that defined us from the beginning. While we've grown and evolved, 
              adopting new technologies to better serve our clients, our core commitment remains unchanged: 
              to be the reliable partner that helps construction professionals succeed.
            </p>
          </div>

          <h2 className="text-2xl font-semibold text-foreground mb-6">Our Journey</h2>
          <div className="space-y-4 mb-12">
            {milestones.map((milestone, index) => (
              <Card key={milestone.year} className="border-border/40">
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                      <milestone.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-medium text-primary">{milestone.year}</span>
                        <h3 className="text-lg font-semibold text-foreground">{milestone.title}</h3>
                      </div>
                      <p className="text-muted-foreground">{milestone.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-border/40 bg-primary/5">
            <CardContent className="p-6 text-center">
              <h2 className="text-xl font-semibold text-foreground mb-3">Looking Forward</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                As we look to the future, we remain committed to our mission of simplifying the permit process 
                for construction professionals in the Hudson Valley. We continue to invest in technology and 
                expand our expertise to serve you better.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
