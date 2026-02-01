import logoFull from "@/assets/logo-expedition-group-checkbox.svg";

export function PublicFooter() {
  return (
    <footer className="border-t bg-background">
      <div className="py-8">
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
                <a href="/#services" className="block text-muted-foreground hover:text-primary transition-colors">
                  Services
                </a>
                <a href="/#how-it-works" className="block text-muted-foreground hover:text-primary transition-colors">
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
  );
}
