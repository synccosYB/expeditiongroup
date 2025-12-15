import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import logoFull from "@/assets/logo-expedition-group-checkbox.svg";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <a href="/" className="flex items-center" data-testid="link-logo-header">
          <img src={logoFull} alt="Expedition Group" className="h-9" />
        </a>

        <nav className="hidden md:flex items-center gap-10">
          <a
            href="/#services"
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            data-testid="link-services"
          >
            Services
          </a>
          <a
            href="/#how-it-works"
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            data-testid="link-how-it-works"
          >
            How It Works
          </a>
          <a
            href="/#who-we-serve"
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            data-testid="link-who-we-serve"
          >
            Who We Serve
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button size="sm" asChild data-testid="button-login">
            <a href="/auth" target="_blank" rel="noopener noreferrer">Sign In</a>
          </Button>
        </div>
      </div>
    </header>
  );
}
