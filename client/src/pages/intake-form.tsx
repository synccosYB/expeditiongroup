import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ChevronLeft,
  ChevronRight,
  Save,
  Check,
  User,
  MapPin,
  FileText,
  Mountain,
  History,
  Building,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { YesNoNaField } from "@/components/YesNoNaField";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertIntakeApplicationSchema, type IntakeApplication } from "@shared/schema";

const extendedFormSchema = insertIntakeApplicationSchema.extend({
  ownerName: insertIntakeApplicationSchema.shape.ownerName.refine(
    (val) => val && val.trim().length > 0,
    { message: "Owner name is required" }
  ),
});

type FormData = typeof extendedFormSchema._type;

const STEPS = [
  { id: 1, title: "Applicant Info", icon: User },
  { id: 2, title: "Project Info", icon: MapPin },
  { id: 3, title: "Project Details", icon: FileText },
  { id: 4, title: "Site Characteristics", icon: Mountain },
  { id: 5, title: "History & Proximity", icon: History },
  { id: 6, title: "Boards & Approvals", icon: Building },
];

const PROXIMITY_OPTIONS = [
  "State or County Road",
  "State or County Park",
  "County/State Land or Right-of-Way",
  "County Stream",
  "Municipal Boundary",
  "County Facility",
];

const REFERRAL_AGENCIES = [
  "RC Highway Department",
  "Town of Ramapo Dept. of Public Works",
  "RC Drainage Agency",
  "RC Dept. of Planning",
  "RC Soil and Water Conservation District",
  "RC Dept. of Environmental Health",
  "NYS Dept. of Transportation",
  "NYS Dept. of Environmental Conservation",
  "RC Sewer District #1",
  "Town of Ramapo Building Dept.",
  "Rockland County 911",
];

export default function IntakeForm() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const isEditing = !!params.id && params.id !== "new";
  const applicationId = isEditing ? parseInt(params.id) : null;

  const { data: existingApplication, isLoading } = useQuery<IntakeApplication>({
    queryKey: ["/api/intake-applications", applicationId],
    enabled: isEditing && !!applicationId,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(extendedFormSchema),
    defaultValues: {
      ownerName: "",
      hasSecondOwner: false,
      secondOwnerName: "",
      businessName: "",
      homeNumber: "",
      cellNumber: "",
      email: "",
      alternateEmail: "",
      currentAddress: "",
      mailingAddress: "",
      mailingAddressSameAsCurrent: false,
      dateOfBirth: "",
      ssOrFid: "",
      secondOwnerBusinessName: "",
      secondOwnerHomeNumber: "",
      secondOwnerCellNumber: "",
      secondOwnerEmail: "",
      secondOwnerAlternateEmail: "",
      secondOwnerCurrentAddress: "",
      secondOwnerMailingAddress: "",
      secondOwnerMailingAddressSameAsCurrent: false,
      secondOwnerDateOfBirth: "",
      secondOwnerSsOrFid: "",
      projectName: "",
      section: "",
      block: "",
      lot: "",
      currentZoning: "",
      locationSide: "",
      locationStreet: "",
      locationFeet: "",
      locationOf: "",
      locationTown: "",
      locationVillage: "",
      acreageOfParcel: "",
      zoningDistrict: "",
      schoolDistrict: "",
      postalDistrict: "",
      fireDistrict: "",
      ambulanceDistrict: "",
      waterDistrict: "",
      sewerDistrict: "",
      needDemolishHouse: "",
      wellBeingDone: "",
      temporaryElectricGasNeeded: "",
      varianceFromSubdivision: "",
      openSpaceOffered: "",
      openSpaceAmount: "",
      subdivisionType: "",
      totalBuildingSize: "",
      proposedAddition: "",
      numberOfDwellingUnits: "",
      specialPermitUse: "",
      hasSlopesGreaterThan25: "",
      slopesDetails: "",
      hasStreams: "",
      streamsNames: "",
      hasWetlands: "",
      wetlandsDetails: "",
      hasBeenReviewedBefore: "",
      projectHistoryNarrative: "",
      abuttingPropertiesTaxMap: "",
      proximityFeatures: [],
      referralAgencies: [],
      adjacentMunicipality: "",
      boardsApprovals: {},
      numberOfLots: "",
      nydecApplicationNeeded: "",
      usacoaApplicationNeeded: "",
      status: "draft",
    },
  });

  const hasSecondOwner = form.watch("hasSecondOwner");
  const mailingAddressSameAsCurrent = form.watch("mailingAddressSameAsCurrent");
  const secondOwnerMailingAddressSameAsCurrent = form.watch("secondOwnerMailingAddressSameAsCurrent");
  const hasBeenReviewedBefore = form.watch("hasBeenReviewedBefore") === "yes";
  const openSpaceOffered = form.watch("openSpaceOffered") === "yes";
  const hasSlopesGreaterThan25 = form.watch("hasSlopesGreaterThan25") === "yes";
  const hasStreams = form.watch("hasStreams") === "yes";
  const hasWetlands = form.watch("hasWetlands") === "yes";
  const boardsApprovals = form.watch("boardsApprovals") || {};

  useEffect(() => {
    if (existingApplication) {
      form.reset({
        ...existingApplication,
        proximityFeatures: (existingApplication.proximityFeatures as string[]) || [],
        referralAgencies: (existingApplication.referralAgencies as string[]) || [],
        boardsApprovals: (existingApplication.boardsApprovals as Record<string, boolean>) || {},
      } as FormData);
    }
  }, [existingApplication, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (isEditing && applicationId) {
        return apiRequest("PATCH", `/api/intake-applications/${applicationId}`, data);
      }
      return apiRequest("POST", "/api/intake-applications", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/intake-applications"] });
      toast({ title: isEditing ? "Application updated" : "Application saved" });
      navigate("/intake");
    },
    onError: () => {
      toast({ title: "Failed to save application", variant: "destructive" });
    },
  });

  const handleSaveDraft = async () => {
    const data = form.getValues();
    if (!data.ownerName || data.ownerName.trim() === "") {
      toast({ title: "Owner name is required to save", variant: "destructive" });
      setCurrentStep(1);
      return;
    }
    saveMutation.mutate({ ...data, status: "draft" });
  };

  const getStepForField = (fieldName: string): number => {
    const baseField = fieldName.split(".")[0];
    
    const step1Fields = ["ownerName", "hasSecondOwner", "secondOwnerName", "businessName", "homeNumber", "cellNumber", "email", "alternateEmail", "currentAddress", "mailingAddress", "mailingAddressSameAsCurrent", "dateOfBirth", "ssOrFid", "secondOwnerBusinessName", "secondOwnerHomeNumber", "secondOwnerCellNumber", "secondOwnerEmail", "secondOwnerAlternateEmail", "secondOwnerCurrentAddress", "secondOwnerMailingAddress", "secondOwnerMailingAddressSameAsCurrent", "secondOwnerDateOfBirth", "secondOwnerSsOrFid"];
    const step2Fields = ["projectName", "section", "block", "lot", "currentZoning", "locationSide", "locationStreet", "locationFeet", "locationOf", "locationTown", "locationVillage", "acreageOfParcel", "zoningDistrict", "schoolDistrict", "postalDistrict", "fireDistrict", "ambulanceDistrict", "waterDistrict", "sewerDistrict"];
    const step3Fields = ["needDemolishHouse", "wellBeingDone", "temporaryElectricGasNeeded", "varianceFromSubdivision", "openSpaceOffered", "openSpaceAmount", "subdivisionType", "totalBuildingSize", "proposedAddition", "numberOfDwellingUnits", "specialPermitUse"];
    const step4Fields = ["hasSlopesGreaterThan25", "slopesDetails", "hasStreams", "streamsNames", "hasWetlands", "wetlandsDetails"];
    const step5Fields = ["hasBeenReviewedBefore", "projectHistoryNarrative", "abuttingPropertiesTaxMap", "proximityFeatures", "referralAgencies", "adjacentMunicipality"];
    const step6Fields = ["boardsApprovals", "numberOfLots", "nydecApplicationNeeded", "usacoaApplicationNeeded", "status"];
    
    if (step1Fields.includes(baseField)) return 1;
    if (step2Fields.includes(baseField)) return 2;
    if (step3Fields.includes(baseField)) return 3;
    if (step4Fields.includes(baseField)) return 4;
    if (step5Fields.includes(baseField)) return 5;
    if (step6Fields.includes(baseField)) return 6;
    return 1;
  };

  const handleSubmitApplication = async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      const errors = form.formState.errors;
      const errorKeys = Object.keys(errors);
      if (errorKeys.length > 0) {
        const firstErrorField = errorKeys[0];
        const targetStep = getStepForField(firstErrorField);
        setCurrentStep(targetStep);
        toast({ title: `Please fix validation errors in ${STEPS[targetStep - 1].title}`, variant: "destructive" });
      }
      return;
    }
    const data = form.getValues();
    saveMutation.mutate({ ...data, status: "submitted" });
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCheckboxArrayChange = (field: "proximityFeatures" | "referralAgencies", value: string, checked: boolean) => {
    const current = form.getValues(field) || [];
    if (checked) {
      form.setValue(field, [...current, value]);
    } else {
      form.setValue(field, current.filter((item: string) => item !== value));
    }
  };

  const handleBoardsChange = (key: string, checked: boolean) => {
    const current = form.getValues("boardsApprovals") || {};
    form.setValue("boardsApprovals", { ...current, [key]: checked });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const progress = (currentStep / STEPS.length) * 100;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-form-title">
            {isEditing ? "Edit Application" : "New Intake Application"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Fill out the permit application form
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/intake")} data-testid="button-back">
            Cancel
          </Button>
          <Button variant="outline" onClick={handleSaveDraft} disabled={saveMutation.isPending} data-testid="button-save-draft">
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <CardTitle className="text-lg">
              Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1].title}
            </CardTitle>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between mt-4 overflow-x-auto">
            {STEPS.map((step) => {
              const StepIcon = step.icon;
              const isActive = step.id === currentStep;
              const isComplete = step.id < currentStep;
              return (
                <button
                  key={step.id}
                  onClick={() => setCurrentStep(step.id)}
                  className={`flex flex-col items-center gap-1 px-2 py-1 rounded-md transition-colors min-w-[80px] ${
                    isActive ? "bg-primary/10 text-primary" : isComplete ? "text-primary" : "text-muted-foreground"
                  }`}
                  data-testid={`step-${step.id}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isActive ? "bg-primary text-primary-foreground" : isComplete ? "bg-primary/20" : "bg-muted"
                    }`}
                  >
                    {isComplete ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                  </div>
                  <span className="text-xs font-medium whitespace-nowrap">{step.title}</span>
                </button>
              );
            })}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form {...form}>
            <form onSubmit={(e) => e.preventDefault()}>
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Owner Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <FormField
                          control={form.control}
                          name="ownerName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name of Owner *</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-owner-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <FormField
                          control={form.control}
                          name="businessName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name of Business (if applicable)</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-business-name" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="homeNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Home Number</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-home-number" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="cellNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cell Number</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-cell-number" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" {...field} data-testid="input-email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="alternateEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Alternate Email</FormLabel>
                            <FormControl>
                              <Input type="email" {...field} data-testid="input-alt-email" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <div className="md:col-span-2">
                        <FormField
                          control={form.control}
                          name="currentAddress"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Current Address (Street, City, State, Postal Code)</FormLabel>
                              <FormControl>
                                <Textarea {...field} data-testid="input-current-address" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="md:col-span-2 flex items-center gap-2">
                        <FormField
                          control={form.control}
                          name="mailingAddressSameAsCurrent"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-mailing-same"
                                />
                              </FormControl>
                              <FormLabel className="cursor-pointer font-normal">Same as above</FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                      {!mailingAddressSameAsCurrent && (
                        <div className="md:col-span-2">
                          <FormField
                            control={form.control}
                            name="mailingAddress"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Mailing Address</FormLabel>
                                <FormControl>
                                  <Textarea {...field} data-testid="input-mailing-address" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                      <FormField
                        control={form.control}
                        name="dateOfBirth"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date of Birth</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="MM/DD/YYYY" data-testid="input-dob" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="ssOrFid"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SS# or FID#</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-ss-fid" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Separator />

                  <FormField
                    control={form.control}
                    name="hasSecondOwner"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value || false}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-second-owner"
                          />
                        </FormControl>
                        <FormLabel className="cursor-pointer font-medium">Add Second Owner</FormLabel>
                      </FormItem>
                    )}
                  />

                  {hasSecondOwner && (
                    <div className="space-y-4 border-l-4 border-primary/20 pl-4">
                      <h3 className="text-lg font-medium">Second Owner Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <FormField
                            control={form.control}
                            name="secondOwnerName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Name of Second Owner</FormLabel>
                                <FormControl>
                                  <Input {...field} data-testid="input-second-owner-name" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <FormField
                            control={form.control}
                            name="secondOwnerBusinessName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Name of Business (if applicable)</FormLabel>
                                <FormControl>
                                  <Input {...field} data-testid="input-second-owner-business" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={form.control}
                          name="secondOwnerHomeNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Home Number</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-second-owner-home" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="secondOwnerCellNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Cell Number</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-second-owner-cell" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="secondOwnerEmail"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input type="email" {...field} data-testid="input-second-owner-email" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="secondOwnerAlternateEmail"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Alternate Email</FormLabel>
                              <FormControl>
                                <Input type="email" {...field} data-testid="input-second-owner-alt-email" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <div className="md:col-span-2">
                          <FormField
                            control={form.control}
                            name="secondOwnerCurrentAddress"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Current Address</FormLabel>
                                <FormControl>
                                  <Textarea {...field} data-testid="input-second-owner-address" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="md:col-span-2 flex items-center gap-2">
                          <FormField
                            control={form.control}
                            name="secondOwnerMailingAddressSameAsCurrent"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value || false}
                                    onCheckedChange={field.onChange}
                                    data-testid="checkbox-second-owner-mailing-same"
                                  />
                                </FormControl>
                                <FormLabel className="cursor-pointer font-normal">Same as above</FormLabel>
                              </FormItem>
                            )}
                          />
                        </div>
                        {!secondOwnerMailingAddressSameAsCurrent && (
                          <div className="md:col-span-2">
                            <FormField
                              control={form.control}
                              name="secondOwnerMailingAddress"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Mailing Address</FormLabel>
                                  <FormControl>
                                    <Textarea {...field} data-testid="input-second-owner-mailing" />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        )}
                        <FormField
                          control={form.control}
                          name="secondOwnerDateOfBirth"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Date of Birth</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="MM/DD/YYYY" data-testid="input-second-owner-dob" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="secondOwnerSsOrFid"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>SS# or FID#</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-second-owner-ss-fid" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Project Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-3">
                        <FormField
                          control={form.control}
                          name="projectName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Project Name</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-project-name" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="section"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Section</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-section" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="block"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Block</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-block" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="lot"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Lot</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-lot" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <div className="md:col-span-3">
                        <FormField
                          control={form.control}
                          name="currentZoning"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Current Zoning</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-current-zoning" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-medium mb-4">Location</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="locationSide"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>On the _____ side of</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., North, South" data-testid="input-location-side" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="locationStreet"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Street Name</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-location-street" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="locationFeet"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Feet</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-location-feet" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="locationOf"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Of</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-location-of" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="locationTown"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>In the Town of</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-location-town" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="locationVillage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Village of</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-location-village" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-medium mb-4">Districts</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="acreageOfParcel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Acreage of Parcel</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-acreage" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="zoningDistrict"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Zoning District</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-zoning-district" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="schoolDistrict"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>School District</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-school-district" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="postalDistrict"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Postal District</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-postal-district" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="fireDistrict"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fire District</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-fire-district" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="ambulanceDistrict"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ambulance District</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-ambulance-district" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="waterDistrict"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Water District</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-water-district" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="sewerDistrict"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sewer District</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-sewer-district" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Project Description</h3>
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="needDemolishHouse"
                        render={({ field }) => (
                          <YesNoNaField
                            label="Need to demolish house?"
                            value={field.value}
                            onChange={field.onChange}
                            testId="radio-demolish"
                          />
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="wellBeingDone"
                        render={({ field }) => (
                          <YesNoNaField
                            label="Any well being done on the property?"
                            value={field.value}
                            onChange={field.onChange}
                            testId="radio-well"
                          />
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="temporaryElectricGasNeeded"
                        render={({ field }) => (
                          <YesNoNaField
                            label="Temporary electric and gas service needed?"
                            value={field.value}
                            onChange={field.onChange}
                            testId="radio-temp-electric"
                          />
                        )}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-medium mb-4">Subdivision Questions (if applicable)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <FormField
                          control={form.control}
                          name="varianceFromSubdivision"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Is any variance from subdivision regulations required?</FormLabel>
                              <FormControl>
                                <Textarea {...field} data-testid="input-variance" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="openSpaceOffered"
                        render={({ field }) => (
                          <YesNoNaField
                            label="Is any open space being offered?"
                            value={field.value}
                            onChange={field.onChange}
                            testId="radio-open-space"
                          />
                        )}
                      />
                      {openSpaceOffered && (
                        <FormField
                          control={form.control}
                          name="openSpaceAmount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>If yes, what amount?</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-open-space-amount" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      )}
                      <div className="md:col-span-2">
                        <FormField
                          control={form.control}
                          name="subdivisionType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Is this a standard or average density subdivision?</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-subdivision-type" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-medium mb-4">Site Plan Questions (if applicable)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="totalBuildingSize"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Total size of building(s) in square feet</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-building-size" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="proposedAddition"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Proposed addition</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-proposed-addition" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="numberOfDwellingUnits"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Number of dwelling units</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-dwelling-units" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-medium mb-4">Special Permit Questions (if applicable)</h3>
                    <FormField
                      control={form.control}
                      name="specialPermitUse"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>List special permit use and proposed property use</FormLabel>
                          <FormControl>
                            <Textarea {...field} rows={4} data-testid="input-special-permit" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Site Characteristics</h3>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <FormField
                          control={form.control}
                          name="hasSlopesGreaterThan25"
                          render={({ field }) => (
                            <YesNoNaField
                              label="Are there slopes greater than 25%?"
                              value={field.value}
                              onChange={field.onChange}
                              testId="radio-slopes"
                            />
                          )}
                        />
                        {hasSlopesGreaterThan25 && (
                          <div className="ml-6">
                            <FormField
                              control={form.control}
                              name="slopesDetails"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>If yes, indicate amount and show gross and net area</FormLabel>
                                  <FormControl>
                                    <Textarea {...field} data-testid="input-slopes-details" />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <FormField
                          control={form.control}
                          name="hasStreams"
                          render={({ field }) => (
                            <YesNoNaField
                              label="Are there streams on the site?"
                              value={field.value}
                              onChange={field.onChange}
                              testId="radio-streams"
                            />
                          )}
                        />
                        {hasStreams && (
                          <div className="ml-6">
                            <FormField
                              control={form.control}
                              name="streamsNames"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>If yes, provide names</FormLabel>
                                  <FormControl>
                                    <Input {...field} data-testid="input-streams-names" />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <FormField
                          control={form.control}
                          name="hasWetlands"
                          render={({ field }) => (
                            <YesNoNaField
                              label="Are there wetlands on the site?"
                              value={field.value}
                              onChange={field.onChange}
                              testId="radio-wetlands"
                            />
                          )}
                        />
                        {hasWetlands && (
                          <div className="ml-6">
                            <FormField
                              control={form.control}
                              name="wetlandsDetails"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>If yes, provide names and type</FormLabel>
                                  <FormControl>
                                    <Textarea {...field} data-testid="input-wetlands-details" />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 5 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Project History</h3>
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="hasBeenReviewedBefore"
                        render={({ field }) => (
                          <YesNoNaField
                            label="Has this project been reviewed before?"
                            value={field.value}
                            onChange={field.onChange}
                            testId="radio-reviewed-before"
                          />
                        )}
                      />
                      {hasBeenReviewedBefore && (
                        <FormField
                          control={form.control}
                          name="projectHistoryNarrative"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>If yes, provide narrative including case number, name, date, and board</FormLabel>
                              <FormControl>
                                <Textarea {...field} rows={4} data-testid="input-history-narrative" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      )}
                      <FormField
                        control={form.control}
                        name="abuttingPropertiesTaxMap"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>List tax map section, block, and lot numbers for all other abutting properties in same ownership</FormLabel>
                            <FormControl>
                              <Textarea {...field} rows={3} data-testid="input-abutting-properties" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-medium mb-4">Proximity to Features (within 500 feet)</h3>
                    <p className="text-sm text-muted-foreground mb-4">Check all that apply</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {PROXIMITY_OPTIONS.map((option) => (
                        <div key={option} className="flex items-center gap-2">
                          <Checkbox
                            id={`proximity-${option}`}
                            checked={(form.watch("proximityFeatures") || []).includes(option)}
                            onCheckedChange={(checked) => handleCheckboxArrayChange("proximityFeatures", option, !!checked)}
                            data-testid={`checkbox-proximity-${option.toLowerCase().replace(/\s+/g, "-")}`}
                          />
                          <label htmlFor={`proximity-${option}`} className="cursor-pointer text-sm">{option}</label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-medium mb-4">Referral Agencies</h3>
                    <p className="text-sm text-muted-foreground mb-4">Check all that will need a copy of the application</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {REFERRAL_AGENCIES.map((agency) => (
                        <div key={agency} className="flex items-center gap-2">
                          <Checkbox
                            id={`referral-${agency}`}
                            checked={(form.watch("referralAgencies") || []).includes(agency)}
                            onCheckedChange={(checked) => handleCheckboxArrayChange("referralAgencies", agency, !!checked)}
                            data-testid={`checkbox-referral-${agency.toLowerCase().replace(/\s+/g, "-")}`}
                          />
                          <label htmlFor={`referral-${agency}`} className="cursor-pointer text-sm">{agency}</label>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4">
                      <FormField
                        control={form.control}
                        name="adjacentMunicipality"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Adjacent Municipality</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-adjacent-municipality" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 6 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Boards / Approvals Needed</h3>
                    <p className="text-sm text-muted-foreground mb-4">Check all that apply</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">Boards</h4>
                        {[
                          { key: "planningBoard", label: "Planning Board" },
                          { key: "zoningBoardOfAppeals", label: "Zoning Board of Appeals" },
                          { key: "municipalBoard", label: "Municipal Board" },
                          { key: "historicalBoard", label: "Historical Board" },
                          { key: "architecturalReviewBoard", label: "Architectural Review Board" },
                        ].map(({ key, label }) => (
                          <div key={key} className="flex items-center gap-2">
                            <Checkbox
                              id={key}
                              checked={(boardsApprovals as Record<string, boolean>)?.[key] || false}
                              onCheckedChange={(checked) => handleBoardsChange(key, !!checked)}
                              data-testid={`checkbox-${key}`}
                            />
                            <label htmlFor={key} className="cursor-pointer text-sm">{label}</label>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">Application Type</h4>
                        {[
                          { key: "subdivision", label: "Subdivision" },
                          { key: "sitePlan", label: "Site Plan" },
                          { key: "prePreliminarySketch", label: "Pre-preliminary/Sketch" },
                          { key: "preliminary", label: "Preliminary" },
                          { key: "final", label: "Final" },
                        ].map(({ key, label }) => (
                          <div key={key} className="flex items-center gap-2">
                            <Checkbox
                              id={key}
                              checked={(boardsApprovals as Record<string, boolean>)?.[key] || false}
                              onCheckedChange={(checked) => handleBoardsChange(key, !!checked)}
                              data-testid={`checkbox-${key}`}
                            />
                            <label htmlFor={key} className="cursor-pointer text-sm">{label}</label>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {(boardsApprovals as Record<string, boolean>)?.subdivision && (
                      <div className="mt-4">
                        <FormField
                          control={form.control}
                          name="numberOfLots"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Number of Lots</FormLabel>
                              <FormControl>
                                <Input {...field} className="max-w-xs" data-testid="input-number-lots" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-medium text-sm mb-3">Special Permit / Zoning</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        { key: "specialPermit", label: "Special Permit" },
                        { key: "zoningCodeAmendment", label: "Zoning Code Amendment" },
                        { key: "variance", label: "Variance" },
                        { key: "conditionalUse", label: "Conditional Use" },
                        { key: "zoneChange", label: "Zone Change" },
                      ].map(({ key, label }) => (
                        <div key={key} className="flex items-center gap-2">
                          <Checkbox
                            id={key}
                            checked={(boardsApprovals as Record<string, boolean>)?.[key] || false}
                            onCheckedChange={(checked) => handleBoardsChange(key, !!checked)}
                            data-testid={`checkbox-${key}`}
                          />
                          <label htmlFor={key} className="cursor-pointer text-sm">{label}</label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-medium text-sm mb-3">Additional Applications</h4>
                    <div className="space-y-3">
                      <FormField
                        control={form.control}
                        name="nydecApplicationNeeded"
                        render={({ field }) => (
                          <YesNoNaField
                            label="NYDEC application needed?"
                            value={field.value}
                            onChange={field.onChange}
                            testId="radio-nydec"
                          />
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="usacoaApplicationNeeded"
                        render={({ field }) => (
                          <YesNoNaField
                            label="USACOA application needed?"
                            value={field.value}
                            onChange={field.onChange}
                            testId="radio-usacoa"
                          />
                        )}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-6 border-t mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrev}
                  disabled={currentStep === 1}
                  data-testid="button-prev"
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
                <div className="flex gap-2">
                  {currentStep === STEPS.length ? (
                    <Button type="button" onClick={handleSubmitApplication} disabled={saveMutation.isPending} data-testid="button-submit">
                      <Send className="h-4 w-4 mr-2" />
                      Submit Application
                    </Button>
                  ) : (
                    <Button type="button" onClick={handleNext} data-testid="button-next">
                      Next
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
