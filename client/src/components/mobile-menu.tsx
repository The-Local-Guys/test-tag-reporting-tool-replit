import { Button } from "@/components/ui/button";
import { LogOut, User, Home, Settings, BarChart3, Smartphone, Calendar } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMobileMenu } from "@/contexts/MobileMenuContext";
import { useLocation } from "wouter";

export function MobileMenu() {
  const { user, logout, isLoggingOut } = useAuth();
  const { isMobileMenuOpen, closeMobileMenu } = useMobileMenu();
  const [, setLocation] = useLocation();
  
  // Type guard for user object
  const typedUser = user as { fullName?: string; role?: string } | undefined;

  const handleNavigation = (path: string) => {
    setLocation(path);
    closeMobileMenu();
  };

  const handleLogout = async () => {
    try {
      await logout();
      closeMobileMenu();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (!isMobileMenuOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
        onClick={closeMobileMenu}
      />
      
      {/* Mobile Menu */}
      <div className="fixed top-0 right-0 h-full w-80 bg-white shadow-lg z-50 md:hidden transform transition-transform duration-300 ease-in-out">
        <div className="p-6 space-y-6 h-full overflow-y-auto">
          {/* Close button */}
          <div className="flex justify-end mb-4">
            <button
              onClick={closeMobileMenu}
              className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <span className="sr-only">Close menu</span>
              ✕
            </button>
          </div>
          {/* User info section */}
          {typedUser && (
            <div className="flex items-center space-x-3 pb-4 border-b border-gray-200">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="font-medium text-gray-900">{typedUser.fullName}</div>
                <div className="text-sm text-gray-500">{typedUser.role?.replace('_', ' ').toUpperCase()}</div>
              </div>
            </div>
          )}

          {/* Navigation items */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700 mb-3">Navigation</div>
            <button
              onClick={() => {
                sessionStorage.setItem('loginMode', 'testing');
                window.location.reload();
              }}
              className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <Home className="w-5 h-5" />
              <span>Testing Mode</span>
            </button>
            {typedUser && (typedUser.role === 'super_admin' || typedUser.role === 'support_center' || typedUser.role === 'technician') && (
              <button
                onClick={() => {
                  sessionStorage.setItem('loginMode', 'admin');
                  window.location.reload();
                }}
                className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Settings className="w-5 h-5" />
                <span>Admin Dashboard</span>
              </button>
            )}
          </div>

          {/* Coming soon section */}
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-700">Features</div>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div className="flex items-center space-x-3">
                  <BarChart3 className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-600">Dashboard Analytics</span>
                </div>
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">Coming Soon</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div className="flex items-center space-x-3">
                  <Smartphone className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-600">Mobile App</span>
                </div>
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">Coming Soon</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div className="flex items-center space-x-3">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-600">Automated Scheduling</span>
                </div>
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">Coming Soon</span>
              </div>
            </div>
          </div>

          {/* Sign out button */}
          <div className="pt-4 border-t border-gray-200">
            <Button
              variant="outline"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full flex items-center justify-center gap-2 text-red-600 border-red-200 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" />
              {isLoggingOut ? "Signing out..." : "Sign out"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}