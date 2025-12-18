import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Settings, Users, Key, Loader2, UserCog, UserPlus, Mail, Check, Clock, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import type { User } from "@shared/schema";
import { format } from "date-fns";

type PasswordResetRequest = {
  id: number;
  email: string;
  userId: string | null;
  status: "pending" | "completed" | "expired";
  handledBy: string | null;
  handledAt: string | null;
  createdAt: string;
};

const passwordResetSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const addUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(["admin", "client"]),
});

type PasswordResetFormData = z.infer<typeof passwordResetSchema>;
type AddUserFormData = z.infer<typeof addUserSchema>;

export default function SettingsPage() {
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"admin" | "client">("client");

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: resetRequests, isLoading: isLoadingRequests } = useQuery<PasswordResetRequest[]>({
    queryKey: ["/api/auth/password-reset-requests"],
  });

  const resetForm = useForm<PasswordResetFormData>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const addUserForm = useForm<AddUserFormData>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      role: "client",
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { userId: string; newPassword: string }) => {
      return await apiRequest("POST", "/api/auth/reset-password", data);
    },
    onSuccess: () => {
      toast({
        title: "Password reset successful",
        description: `Password has been reset for ${selectedUser?.email}`,
      });
      setIsResetDialogOpen(false);
      setSelectedUser(null);
      resetForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Password reset failed",
        description: error.message || "Could not reset password",
        variant: "destructive",
      });
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: async (data: { userId: string; role: "admin" | "client" }) => {
      return await apiRequest("PATCH", `/api/users/${data.userId}/role`, { role: data.role });
    },
    onSuccess: () => {
      toast({
        title: "Role updated",
        description: `${selectedUser?.email} is now ${selectedRole === "admin" ? "an Admin" : "a Client"}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsRoleDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to change role",
        description: error.message || "Could not update role",
        variant: "destructive",
      });
    },
  });

  const markRequestCompletedMutation = useMutation({
    mutationFn: async (requestId: number) => {
      return await apiRequest("PATCH", `/api/auth/password-reset-requests/${requestId}`, { status: "completed" });
    },
    onSuccess: () => {
      toast({
        title: "Request marked as completed",
        description: "The password reset request has been handled",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/password-reset-requests"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update request",
        description: error.message || "Could not update request",
        variant: "destructive",
      });
    },
  });

  const addUserMutation = useMutation({
    mutationFn: async (data: AddUserFormData) => {
      return await apiRequest("POST", "/api/users", data);
    },
    onSuccess: () => {
      toast({
        title: "User created",
        description: "New user has been added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsAddUserDialogOpen(false);
      addUserForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create user",
        description: error.message || "Could not create user",
        variant: "destructive",
      });
    },
  });

  const onResetPassword = (data: PasswordResetFormData) => {
    if (!selectedUser) return;
    resetPasswordMutation.mutate({
      userId: selectedUser.id,
      newPassword: data.newPassword,
    });
  };

  const openResetDialog = (user: User) => {
    setSelectedUser(user);
    resetForm.reset();
    setIsResetDialogOpen(true);
  };

  const openRoleDialog = (user: User) => {
    setSelectedUser(user);
    setSelectedRole(user.role === "admin" || user.role === "super_admin" ? "admin" : "client");
    setIsRoleDialogOpen(true);
  };

  const onChangeRole = () => {
    if (!selectedUser) return;
    changeRoleMutation.mutate({
      userId: selectedUser.id,
      role: selectedRole,
    });
  };

  const onAddUser = (data: AddUserFormData) => {
    addUserMutation.mutate(data);
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage users and system settings</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Management
            </CardTitle>
            <CardDescription>
              View all users, change roles, and reset passwords
            </CardDescription>
          </div>
          <Button
            onClick={() => {
              addUserForm.reset();
              setIsAddUserDialogOpen(true);
            }}
            data-testid="button-add-user"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {users?.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card"
                data-testid={`user-row-${user.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate" data-testid={`text-user-email-${user.id}`}>
                      {user.email}
                    </p>
                    <Badge variant="outline">
                      {user.role}
                    </Badge>
                  </div>
                  {(user.firstName || user.lastName) && (
                    <p className="text-sm text-muted-foreground truncate">
                      {[user.firstName, user.lastName].filter(Boolean).join(" ")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openRoleDialog(user)}
                    data-testid={`button-change-role-${user.id}`}
                  >
                    <UserCog className="h-4 w-4 mr-2" />
                    Change Role
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openResetDialog(user)}
                    data-testid={`button-reset-password-${user.id}`}
                  >
                    <Key className="h-4 w-4 mr-2" />
                    Reset Password
                  </Button>
                </div>
              </div>
            ))}
            {(!users || users.length === 0) && (
              <p className="text-center text-muted-foreground py-8">
                No users found
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Password Reset Requests
          </CardTitle>
          <CardDescription>
            Users who have requested password resets. Reset their password above and mark as completed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingRequests ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {resetRequests?.filter(r => r.status === "pending").map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card"
                  data-testid={`reset-request-row-${request.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate" data-testid={`text-reset-email-${request.id}`}>
                        {request.email}
                      </p>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Pending
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Requested {format(new Date(request.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {request.userId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const user = users?.find(u => u.id === request.userId);
                          if (user) {
                            openResetDialog(user);
                          }
                        }}
                        data-testid={`button-reset-for-request-${request.id}`}
                      >
                        <Key className="h-4 w-4 mr-2" />
                        Reset Password
                      </Button>
                    )}
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => markRequestCompletedMutation.mutate(request.id)}
                      disabled={markRequestCompletedMutation.isPending}
                      data-testid={`button-mark-completed-${request.id}`}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Mark Completed
                    </Button>
                  </div>
                </div>
              ))}
              {(!resetRequests || resetRequests.filter(r => r.status === "pending").length === 0) && (
                <p className="text-center text-muted-foreground py-8">
                  No pending password reset requests
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter a new password for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <Form {...resetForm}>
            <form onSubmit={resetForm.handleSubmit(onResetPassword)} className="space-y-4">
              <FormField
                control={resetForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter new password"
                        data-testid="input-new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={resetForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Confirm new password"
                        data-testid="input-confirm-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsResetDialogOpen(false)}
                  data-testid="button-cancel-reset"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={resetPasswordMutation.isPending}
                  data-testid="button-confirm-reset"
                >
                  {resetPasswordMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    "Reset Password"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Select a new role for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as "admin" | "client")}>
                <SelectTrigger data-testid="select-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin - Full CRM access</SelectItem>
                  <SelectItem value="client">Client - Portal access only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRoleDialogOpen(false)}
              data-testid="button-cancel-role"
            >
              Cancel
            </Button>
            <Button
              onClick={onChangeRole}
              disabled={changeRoleMutation.isPending}
              data-testid="button-confirm-role"
            >
              {changeRoleMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Role"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new admin or client user
            </DialogDescription>
          </DialogHeader>
          <Form {...addUserForm}>
            <form onSubmit={addUserForm.handleSubmit(onAddUser)} className="space-y-4">
              <FormField
                control={addUserForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="user@example.com"
                        data-testid="input-add-email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={addUserForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="John"
                          data-testid="input-add-firstname"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addUserForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Doe"
                          data-testid="input-add-lastname"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={addUserForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Minimum 8 characters"
                        data-testid="input-add-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addUserForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-add-role">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Admin - Full CRM access</SelectItem>
                        <SelectItem value="client">Client - Portal access only</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddUserDialogOpen(false)}
                  data-testid="button-cancel-add-user"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={addUserMutation.isPending}
                  data-testid="button-confirm-add-user"
                >
                  {addUserMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Add User"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
