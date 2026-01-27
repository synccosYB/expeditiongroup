import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UserCog,
  Search,
  Mail,
  Phone,
  Building,
  MapPin,
  User,
} from "lucide-react";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import type { Associate, Project } from "@shared/schema";

type AssociateWithProjects = Associate & { 
  projects?: Project[];
};

const ASSOCIATE_TYPES = [
  { value: "all", label: "All Types" },
  { value: "engineer", label: "Engineer" },
  { value: "architect", label: "Architect" },
  { value: "surveyor", label: "Surveyor" },
  { value: "lawyer", label: "Lawyer" },
  { value: "contractor", label: "Contractor" },
  { value: "consultant", label: "Consultant" },
  { value: "other", label: "Other" },
];

export default function ClientAssociates() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: associates, isLoading } = useQuery<AssociateWithProjects[]>({
    queryKey: ["/api/client/associates"],
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const filteredAssociates = associates?.filter((associate) => {
    const matchesSearch =
      associate.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      associate.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      associate.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || associate.type === typeFilter;
    return matchesSearch && matchesType;
  }) || [];

  const getTypeBadge = (type: string) => {
    const typeColors: Record<string, string> = {
      engineer: "bg-chart-1 text-white",
      architect: "bg-chart-2 text-white",
      surveyor: "bg-chart-3 text-white",
      lawyer: "bg-chart-4 text-white",
      contractor: "bg-chart-5 text-white",
      consultant: "bg-primary text-primary-foreground",
      other: "",
    };
    const className = typeColors[type] || "";
    return (
      <Badge className={className} variant={className ? "default" : "secondary"}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground" data-testid="text-client-associates-title">
          Associates
        </h1>
        <p className="text-muted-foreground mt-1">
          View professionals working on your projects
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search associates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-associates"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-type-filter">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            {ASSOCIATE_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredAssociates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssociates.map((associate) => (
            <Card key={associate.id} data-testid={`card-associate-${associate.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-muted">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold">
                        {associate.name}
                      </CardTitle>
                      {associate.company && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          {associate.company}
                        </p>
                      )}
                    </div>
                  </div>
                  {getTypeBadge(associate.type)}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {associate.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <a href={`mailto:${associate.email}`} className="hover:text-foreground">
                      {associate.email}
                    </a>
                  </div>
                )}
                {associate.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <a href={`tel:${associate.phone}`} className="hover:text-foreground">
                      {associate.phone}
                    </a>
                  </div>
                )}
                {associate.address && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{associate.address}</span>
                  </div>
                )}
                {associate.projects && associate.projects.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-1">Working on:</p>
                    <div className="flex flex-wrap gap-1">
                      {associate.projects.slice(0, 3).map((project) => (
                        <Badge key={project.id} variant="outline" className="text-xs">
                          {project.name}
                        </Badge>
                      ))}
                      {associate.projects.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{associate.projects.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={UserCog}
              title="No associates found"
              description={searchTerm || typeFilter !== "all"
                ? "Try adjusting your search or filters"
                : "Associates working on your projects will appear here"}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
