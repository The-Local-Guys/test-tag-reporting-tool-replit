import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, LogIn, Settings, Clipboard } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import logoPath from "@assets/The Local Guys - with plug wide boarder - png seek.png";

export default function Login() {
  const { login, isLoggingIn } = useAuth();
  const { toast } = useToast();
  
  const [showPassword, setShowPassword] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await login({
        username: formData.username,
        password: formData.password,
      });
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={logoPath} alt="The Local Guys" className="h-16 w-auto" />
          </div>
          <CardTitle className="text-2xl font-bold">
            Welcome Back
          </CardTitle>
          <CardDescription>
            Sign in to access the test and tag reporting system
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            
            <Button
              type="submit"
              className="w-full"
              disabled={isLoggingIn}
            >
              {isLoggingIn ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing in...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </div>
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Need an account? Contact your administrator.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}