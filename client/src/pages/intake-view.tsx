import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Edit, User, MapPin, FileText, Mountain, History, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { IntakeApplication } from "@shared/schema";

const statusStyles: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  draft: { variant: "secondary", label: "Draft" },
  submitted: { variant: "default", label: "Submitted" },
  under_review: { variant: "outline", label: "Under Review" },
  approved: { variant: "default", label: "Approved" },
  rejected: { variant: "destructive", label: "Rejected" },
};

function InfoItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "-"}</p>
    </div>
  );
}

function CheckItem({ label, checked }: { label: string; checked: boolean | null | undefined }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-4 h-4 rounded border flex items-center justify-center ${checked ? "bg-primary border-primary" : "border-muted-foreground"}`}>
        {checked && <span className="text-primary-foreground text-xs">✓</span>}
      </div>
      <span className="text-sm">{label}</span>
    </div>
  );
}

export default function IntakeView() {
  const params = useParams();
  const [, navigate] = useLocation();
  const applicationId = params.id ? parseInt(params.id) : null;

  const { data: application, isLoading, error } = useQuery<IntakeApplication>({
    queryKey: ["/api/intake-applications", applicationId],
    enabled: !!applicationId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Application not found</p>
        <Button variant="outline" onClick={() => navigate("/intake")} className="mt-4">
          Back to Intake
        </Button>
      </div>
    );
  }

  const status = statusStyles[application.status] || statusStyles.draft;
  const boardsApprovals = (application.boardsApprovals as Record<string, boolean>) || {};
  const proximityFeatures = (application.proximityFeatures as string[]) || [];
  const referralAgencies = (application.referralAgencies as string[]) || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/intake")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold" data-testid="text-application-title">
                {application.projectName || "Untitled Application"}
              </h1>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              {application.ownerName}
            </p>
          </div>
        </div>
        <Button onClick={() => navigate(`/intake/${applicationId}/edit`)} data-testid="button-edit">
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-4">
          <User className="h-5 w-5" />
          <CardTitle>Applicant Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoItem label="Owner Name" value={application.ownerName} />
            <InfoItem label="Business Name" value={application.businessName} />
            <InfoItem label="Email" value={application.email} />
            <InfoItem label="Home Phone" value={application.homeNumber} />
            <InfoItem label="Cell Phone" value={application.cellNumber} />
            <InfoItem label="Date of Birth" value={application.dateOfBirth} />
            <InfoItem label="Current Address" value={application.currentAddress} />
            <InfoItem label="Mailing Address" value={application.mailingAddressSameAsCurrent ? "Same as current" : application.mailingAddress} />
          </div>

          {application.hasSecondOwner && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-4">Second Owner</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <InfoItem label="Name" value={application.secondOwnerName} />
                  <InfoItem label="Business" value={application.secondOwnerBusinessName} />
                  <InfoItem label="Email" value={application.secondOwnerEmail} />
                  <InfoItem label="Home Phone" value={application.secondOwnerHomeNumber} />
                  <InfoItem label="Cell Phone" value={application.secondOwnerCellNumber} />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-4">
          <MapPin className="h-5 w-5" />
          <CardTitle>Project Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoItem label="Project Name" value={application.projectName} />
            <InfoItem label="Section" value={application.section} />
            <InfoItem label="Block" value={application.block} />
            <InfoItem label="Lot" value={application.lot} />
            <InfoItem label="Current Zoning" value={application.currentZoning} />
            <InfoItem label="Acreage" value={application.acreageOfParcel} />
            <InfoItem label="Town" value={application.locationTown} />
            <InfoItem label="Village" value={application.locationVillage} />
            <InfoItem label="Street" value={application.locationStreet} />
          </div>

          <Separator className="my-6" />

          <h4 className="font-medium mb-4">Districts</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoItem label="Zoning District" value={application.zoningDistrict} />
            <InfoItem label="School District" value={application.schoolDistrict} />
            <InfoItem label="Fire District" value={application.fireDistrict} />
            <InfoItem label="Ambulance District" value={application.ambulanceDistrict} />
            <InfoItem label="Water District" value={application.waterDistrict} />
            <InfoItem label="Sewer District" value={application.sewerDistrict} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-4">
          <FileText className="h-5 w-5" />
          <CardTitle>Project Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-6">
            <CheckItem label="Demolish House" checked={application.needDemolishHouse} />
            <CheckItem label="Well Being Done" checked={application.wellBeingDone} />
            <CheckItem label="Temporary Electric/Gas Needed" checked={application.temporaryElectricGasNeeded} />
            <CheckItem label="Open Space Offered" checked={application.openSpaceOffered} />
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoItem label="Total Building Size" value={application.totalBuildingSize} />
            <InfoItem label="Proposed Addition" value={application.proposedAddition} />
            <InfoItem label="Dwelling Units" value={application.numberOfDwellingUnits} />
            <InfoItem label="Subdivision Type" value={application.subdivisionType} />
            <InfoItem label="Open Space Amount" value={application.openSpaceAmount} />
          </div>

          {application.specialPermitUse && (
            <InfoItem label="Special Permit Use" value={application.specialPermitUse} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-4">
          <Mountain className="h-5 w-5" />
          <CardTitle>Site Characteristics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div>
              <CheckItem label="Slopes greater than 25%" checked={application.hasSlopesGreaterThan25} />
              {application.hasSlopesGreaterThan25 && application.slopesDetails && (
                <p className="ml-6 mt-2 text-sm text-muted-foreground">{application.slopesDetails}</p>
              )}
            </div>
            <div>
              <CheckItem label="Streams on site" checked={application.hasStreams} />
              {application.hasStreams && application.streamsNames && (
                <p className="ml-6 mt-2 text-sm text-muted-foreground">{application.streamsNames}</p>
              )}
            </div>
            <div>
              <CheckItem label="Wetlands on site" checked={application.hasWetlands} />
              {application.hasWetlands && application.wetlandsDetails && (
                <p className="ml-6 mt-2 text-sm text-muted-foreground">{application.wetlandsDetails}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-4">
          <History className="h-5 w-5" />
          <CardTitle>History & Proximity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <CheckItem label="Project reviewed before" checked={application.hasBeenReviewedBefore} />
            {application.hasBeenReviewedBefore && application.projectHistoryNarrative && (
              <p className="ml-6 mt-2 text-sm text-muted-foreground">{application.projectHistoryNarrative}</p>
            )}
          </div>

          {proximityFeatures.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-3">Proximity Features (within 500 feet)</h4>
                <div className="flex flex-wrap gap-2">
                  {proximityFeatures.map((feature) => (
                    <Badge key={feature} variant="outline">{feature}</Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {referralAgencies.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-3">Referral Agencies</h4>
                <div className="flex flex-wrap gap-2">
                  {referralAgencies.map((agency) => (
                    <Badge key={agency} variant="outline">{agency}</Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {application.adjacentMunicipality && (
            <InfoItem label="Adjacent Municipality" value={application.adjacentMunicipality} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-4">
          <Building className="h-5 w-5" />
          <CardTitle>Boards & Approvals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">Boards</h4>
              <div className="space-y-2">
                <CheckItem label="Planning Board" checked={boardsApprovals.planningBoard} />
                <CheckItem label="Zoning Board of Appeals" checked={boardsApprovals.zoningBoardOfAppeals} />
                <CheckItem label="Municipal Board" checked={boardsApprovals.municipalBoard} />
                <CheckItem label="Historical Board" checked={boardsApprovals.historicalBoard} />
                <CheckItem label="Architectural Review Board" checked={boardsApprovals.architecturalReviewBoard} />
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-3">Application Type</h4>
              <div className="space-y-2">
                <CheckItem label="Subdivision" checked={boardsApprovals.subdivision} />
                <CheckItem label="Site Plan" checked={boardsApprovals.sitePlan} />
                <CheckItem label="Pre-preliminary/Sketch" checked={boardsApprovals.prePreliminarySketch} />
                <CheckItem label="Preliminary" checked={boardsApprovals.preliminary} />
                <CheckItem label="Final" checked={boardsApprovals.final} />
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">Special Permit / Zoning</h4>
              <div className="space-y-2">
                <CheckItem label="Special Permit" checked={boardsApprovals.specialPermit} />
                <CheckItem label="Zoning Code Amendment" checked={boardsApprovals.zoningCodeAmendment} />
                <CheckItem label="Variance" checked={boardsApprovals.variance} />
                <CheckItem label="Conditional Use" checked={boardsApprovals.conditionalUse} />
                <CheckItem label="Zone Change" checked={boardsApprovals.zoneChange} />
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-3">Additional Applications</h4>
              <div className="space-y-2">
                <CheckItem label="NYDEC Application Needed" checked={application.nydecApplicationNeeded} />
                <CheckItem label="USACOA Application Needed" checked={application.usacoaApplicationNeeded} />
              </div>
            </div>
          </div>

          {boardsApprovals.subdivision && application.numberOfLots && (
            <InfoItem label="Number of Lots" value={application.numberOfLots} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
