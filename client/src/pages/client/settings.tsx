import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Settings,
  User,
  Mail,
  Lock,
  Bell,
  Shield,
  Eye,
  EyeOff,
  Save,
  Check,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import type { ClientPortalSettings } from "@shared/schema";

export default function ClientSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { data: portalSettings, isLoading: settingsLoading } = useQuery<ClientPortalSettings>({
    queryKey: ["/api/client/portal-settings"],
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      return apiRequest("POST", "/api/auth/change-password", data);
    },
    onSuccess: () => {
      toast({
        title: "Password changed",
        description: "Your password has been updated successfully",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    },
  });

  if (settingsLoading) {
    return <DashboardSkeleton />;
  }

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  const handlePasswordChange = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Error",
        description: "Please fill in all password fields",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Error",
        description: "New password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground" data-testid="text-client-settings-title">
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Your account details (contact your administrator to update)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage
                    src={user?.profileImageUrl || undefined}
                    alt={user?.firstName || "User"}
                    className="object-cover"
                  />
                  <AvatarFallback className="text-lg bg-muted">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {user?.firstName && user?.lastName
                      ? `${user.firstName} ${user.lastName}`
                      : "Client User"}
                  </p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {user?.role || "client"}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input
                    value={user?.firstName || ""}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input
                    value={user?.lastName || ""}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={user?.email || ""}
                      disabled
                      className="pl-9 bg-muted"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Change Password
              </CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    data-testid="input-current-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    data-testid="input-new-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  data-testid="input-confirm-password"
                />
              </div>
              <Button
                onClick={handlePasswordChange}
                disabled={changePasswordMutation.isPending}
                data-testid="button-change-password"
              >
                {changePasswordMutation.isPending ? (
                  "Changing..."
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Change Password
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Portal Access
              </CardTitle>
              <CardDescription>
                Your current portal permissions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">View Projects</span>
                {portalSettings?.showProjects ? (
                  <Check className="h-4 w-4 text-chart-2" />
                ) : (
                  <span className="text-xs text-muted-foreground">Disabled</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">View Documents</span>
                {portalSettings?.showDocuments ? (
                  <Check className="h-4 w-4 text-chart-2" />
                ) : (
                  <span className="text-xs text-muted-foreground">Disabled</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">View Invoices</span>
                {portalSettings?.showInvoices ? (
                  <Check className="h-4 w-4 text-chart-2" />
                ) : (
                  <span className="text-xs text-muted-foreground">Disabled</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">View Messages</span>
                {portalSettings?.showMessages ? (
                  <Check className="h-4 w-4 text-chart-2" />
                ) : (
                  <span className="text-xs text-muted-foreground">Disabled</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">View Milestones</span>
                {portalSettings?.showMilestones ? (
                  <Check className="h-4 w-4 text-chart-2" />
                ) : (
                  <span className="text-xs text-muted-foreground">Disabled</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">View Timeline</span>
                {portalSettings?.showTimeline ? (
                  <Check className="h-4 w-4 text-chart-2" />
                ) : (
                  <span className="text-xs text-muted-foreground">Disabled</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Upload Documents</span>
                {portalSettings?.allowDocumentUpload ? (
                  <Check className="h-4 w-4 text-chart-2" />
                ) : (
                  <span className="text-xs text-muted-foreground">Disabled</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription>
                Notification preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Contact your administrator to update notification preferences.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
