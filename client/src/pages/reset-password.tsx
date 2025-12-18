import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, ArrowLeft, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import logoFull from "@/assets/logo-expedition-group-checkbox.svg";

const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function ResetPassword() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const token = new URLSearchParams(searchString).get("token");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const validateTokenQuery = useQuery({
    queryKey: ["/api/auth/validate-reset-token", token],
    queryFn: async () => {
      if (!token) throw new Error("No token provided");
      const response = await fetch(`/api/auth/validate-reset-token?token=${token}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Invalid or expired token");
      }
      return response.json();
    },
    enabled: !!token,
    retry: false,
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPasswordFormData) => {
      const response = await apiRequest("POST", "/api/auth/reset-password-with-token", {
        token,
        password: data.password,
      });
      return response.json();
    },
    onSuccess: () => {
      setIsSuccess(true);
      toast({
        title: "Password reset successful",
        description: "You can now sign in with your new password.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Reset failed",
        description: error.message || "Please try again or request a new reset link.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ResetPasswordFormData) => {
    resetPasswordMutation.mutate(data);
  };

  if (!token) {
    return (
      <div className="min-h-screen flex flex-col relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-primary/10 pointer-events-none" />
        
        <header className="relative p-4 border-b bg-background/50 backdrop-blur-sm">
          <Link href="/auth" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </header>
        
        <div className="relative flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-xl border-border/50 bg-card/95 backdrop-blur-sm">
            <CardHeader className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
              </div>
              <CardTitle className="text-2xl">Invalid Link</CardTitle>
              <CardDescription>
                This password reset link is invalid or has expired.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                <Button asChild className="w-full" data-testid="button-request-new-link">
                  <Link href="/forgot-password">Request a new link</Link>
                </Button>
                <Button variant="outline" asChild className="w-full" data-testid="button-back-signin">
                  <Link href="/auth">Back to sign in</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (validateTokenQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (validateTokenQuery.isError) {
    return (
      <div className="min-h-screen flex flex-col relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-primary/10 pointer-events-none" />
        
        <header className="relative p-4 border-b bg-background/50 backdrop-blur-sm">
          <Link href="/auth" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </header>
        
        <div className="relative flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-xl border-border/50 bg-card/95 backdrop-blur-sm">
            <CardHeader className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
              </div>
              <CardTitle className="text-2xl">Link Expired</CardTitle>
              <CardDescription>
                This password reset link has expired or has already been used.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                <Button asChild className="w-full" data-testid="button-request-new">
                  <Link href="/forgot-password">Request a new link</Link>
                </Button>
                <Button variant="outline" asChild className="w-full" data-testid="button-back-to-signin">
                  <Link href="/auth">Back to sign in</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex flex-col relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-primary/10 pointer-events-none" />
        
        <header className="relative p-4 border-b bg-background/50 backdrop-blur-sm">
          <Link href="/auth" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </header>
        
        <div className="relative flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-xl border-border/50 bg-card/95 backdrop-blur-sm">
            <CardHeader className="text-center space-y-4">
              <div className="flex justify-center">
                <img src={logoFull} alt="Expedition Group" className="h-12" />
              </div>
              <div className="flex justify-center">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </div>
              </div>
              <CardTitle className="text-2xl">Password Reset!</CardTitle>
              <CardDescription>
                Your password has been successfully reset. You can now sign in with your new password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full" data-testid="button-signin-after-reset">
                <Link href="/auth">Sign in</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-primary/10 pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      
      <header className="relative p-4 border-b bg-background/50 backdrop-blur-sm">
        <Link href="/auth" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </header>
      
      <div className="relative flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-border/50 bg-card/95 backdrop-blur-sm">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <img src={logoFull} alt="Expedition Group" className="h-12" />
            </div>
            <div>
              <CardTitle className="text-2xl">Reset your password</CardTitle>
              <CardDescription>
                Enter your new password below.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="At least 8 characters"
                            className="pr-10"
                            data-testid="input-new-password"
                            {...field}
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setShowPassword(!showPassword)}
                            data-testid="button-toggle-new-password"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirm your password"
                            className="pr-10"
                            data-testid="input-confirm-new-password"
                            {...field}
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            data-testid="button-toggle-confirm-new-password"
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={resetPasswordMutation.isPending}
                  data-testid="button-reset-submit"
                >
                  {resetPasswordMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    "Reset password"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
