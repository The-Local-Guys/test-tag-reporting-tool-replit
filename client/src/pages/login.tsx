import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, UserPlus, LogIn, Settings, Clipboard } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import logoPath from "@assets/The Local Guys - with plug wide boarder - png seek.png";

export default function Login() {
  const { login, register, isLoggingIn, isRegistering: isRegisteringMutation } = useAuth();
  const { toast } = useToast();
  
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    fullName: "",
    role: "technician" as const,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (isRegisterMode) {
        await register({
          username: formData.username,
          password: formData.password,
          fullName: formData.fullName,
          role: "admin", // Set first user as admin
        });
        toast({
          title: "Admin account created!",
          description: "You can now log in with your admin account.",
        });
        setIsRegisterMode(false);
        setFormData({ username: "", password: "", fullName: "", role: "technician" });
      } else {
        await login({
          username: formData.username,
          password: formData.password,
        });
        toast({
          title: "Login successful!",
          description: "Redirecting to your dashboard...",
        });
        // Force page reload to clear auth state
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={logoPath} alt="The Local Guys" className="h-16 w-auto" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {isRegisterMode ? "Create Account" : "Welcome Back"}
          </CardTitle>
          <CardDescription>
            {isRegisterMode 
              ? "Create your technician account to access the test and tag system"
              : "Sign in to access the test and tag reporting system"
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegisterMode && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => handleInputChange("fullName", e.target.value)}
                  placeholder="Enter your full name"
                  required
                />
              </div>
            )}

            {!isRegisterMode && (
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Clipboard className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium">Testing Tool</span>
                  </div>
                  <Switch
                    checked={isAdminMode}
                    onCheckedChange={setIsAdminMode}
                  />
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium">Admin Panel</span>
                    <Settings className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
                <p className="text-xs text-gray-600 text-center">
                  {isAdminMode 
                    ? "Access admin dashboard to manage your team and view all reports"
                    : "Access the testing tool to conduct electrical equipment tests"
                  }
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => handleInputChange("username", e.target.value)}
                placeholder="Enter your username"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  placeholder="Enter your password"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-auto p-1"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoggingIn || isRegisteringMutation}
            >
              {isRegisterMode ? (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  {isRegisteringMutation ? "Creating Account..." : "Create Account"}
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  {isLoggingIn ? "Signing In..." : "Sign In"}
                </>
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <Button
              variant="link"
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setFormData({ username: "", password: "", fullName: "", role: "technician" });
              }}
              className="text-sm"
            >
              {isRegisterMode 
                ? "Already have an account? Sign in" 
                : "Need an account? Create one here"
              }
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}