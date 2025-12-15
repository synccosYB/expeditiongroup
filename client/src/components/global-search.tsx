import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, User, Building, Briefcase, X } from "lucide-react";
import type { Client, Project, Associate } from "@shared/schema";

interface SearchResults {
  clients: Client[];
  projects: (Project & { client: Client })[];
  associates: Associate[];
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: results, isLoading } = useQuery<SearchResults>({
    queryKey: ["/api/search", query],
    queryFn: async () => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error("Search failed");
      return response.json();
    },
    enabled: query.length >= 2,
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (event.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelect = (type: string, id: number) => {
    setIsOpen(false);
    setQuery("");
    if (type === "client") {
      setLocation(`/clients/${id}`);
    } else if (type === "project") {
      setLocation(`/projects/${id}`);
    } else if (type === "associate") {
      setLocation(`/associates/${id}`);
    }
  };

  const hasResults = results && (results.clients.length > 0 || results.projects.length > 0 || results.associates.length > 0);
  const showDropdown = isOpen && query.length >= 2;

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search clients, jobs, associates... (Ctrl+K)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-9 pr-8"
          data-testid="input-global-search"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover-elevate rounded-md p-0.5"
            data-testid="button-clear-search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showDropdown && (
        <Card className="absolute top-full left-0 right-0 mt-1 z-50 max-h-80 overflow-auto">
          <div className="p-2">
            {isLoading && (
              <div className="space-y-2 p-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            )}

            {!isLoading && !hasResults && (
              <div className="p-4 text-center text-muted-foreground text-sm" data-testid="text-no-results">
                No results found for "{query}"
              </div>
            )}

            {!isLoading && hasResults && (
              <>
                {results.clients.length > 0 && (
                  <div className="mb-2">
                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Clients
                    </div>
                    {results.clients.map((client) => (
                      <button
                        key={`client-${client.id}`}
                        onClick={() => handleSelect("client", client.id)}
                        className="w-full flex items-center gap-3 px-2 py-2 rounded-md text-left hover-elevate active-elevate-2"
                        data-testid={`search-result-client-${client.id}`}
                      >
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{client.name}</div>
                          {client.company && (
                            <div className="text-sm text-muted-foreground truncate">{client.company}</div>
                          )}
                        </div>
                        <Badge variant="outline" className="shrink-0">Client</Badge>
                      </button>
                    ))}
                  </div>
                )}

                {results.projects.length > 0 && (
                  <div className="mb-2">
                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Jobs / Projects
                    </div>
                    {results.projects.map((project) => (
                      <button
                        key={`project-${project.id}`}
                        onClick={() => handleSelect("project", project.id)}
                        className="w-full flex items-center gap-3 px-2 py-2 rounded-md text-left hover-elevate active-elevate-2"
                        data-testid={`search-result-project-${project.id}`}
                      >
                        <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{project.name}</div>
                          <div className="text-sm text-muted-foreground truncate">
                            {project.propertyAddress} {project.internalCode && `(${project.internalCode})`}
                          </div>
                        </div>
                        <Badge variant="outline" className="shrink-0">Job</Badge>
                      </button>
                    ))}
                  </div>
                )}

                {results.associates.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Associates
                    </div>
                    {results.associates.map((associate) => (
                      <button
                        key={`associate-${associate.id}`}
                        onClick={() => handleSelect("associate", associate.id)}
                        className="w-full flex items-center gap-3 px-2 py-2 rounded-md text-left hover-elevate active-elevate-2"
                        data-testid={`search-result-associate-${associate.id}`}
                      >
                        <Building className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{associate.name}</div>
                          {associate.company && (
                            <div className="text-sm text-muted-foreground truncate">{associate.company}</div>
                          )}
                        </div>
                        <Badge variant="outline" className="shrink-0">Associate</Badge>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
