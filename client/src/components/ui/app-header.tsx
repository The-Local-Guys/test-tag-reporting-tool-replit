import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, User, Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showUserInfo?: boolean;
  children?: React.ReactNode;
}

export function AppHeader({ title, subtitle, showUserInfo = true, children }: AppHeaderProps) {
  const { user, logout, isLoggingOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Type guard for user object
  const typedUser = user as { fullName?: string; role?: string } | undefined;

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <>
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 mb-6">
        <div className="flex justify-between items-center">
          {/* Left side - Title */}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold truncate">{title}</h1>
            {subtitle && <div className="text-blue-100 text-xs sm:text-sm mt-1 truncate">{subtitle}</div>}
          </div>

          {/* Desktop navigation - hidden on mobile */}
          <div className="hidden md:flex items-center gap-3">
            {children}
            {showUserInfo && typedUser && (
              <div className="flex items-center space-x-2 text-sm text-blue-100">
                <User className="w-4 h-4" />
                <span className="hidden lg:inline">{typedUser.fullName}</span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => logout()}
              disabled={isLoggingOut}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden lg:inline">{isLoggingOut ? "Signing out..." : "Sign out"}</span>
            </Button>
          </div>

          {/* Mobile hamburger menu button - visible on mobile only */}
          <div className="md:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleMobileMenu}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 p-2"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-200 shadow-lg">
          <div className="p-4 space-y-4">
            {/* User info section */}
            {showUserInfo && typedUser && (
              <div className="flex items-center space-x-3 pb-3 border-b border-gray-200">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-medium text-gray-900">{typedUser.fullName}</div>
                  <div className="text-sm text-gray-500">{typedUser.role?.replace('_', ' ').toUpperCase()}</div>
                </div>
              </div>
            )}

            {/* Additional menu items can go here */}
            {children && (
              <div className="pb-3 border-b border-gray-200">
                {children}
              </div>
            )}

            {/* Coming soon section */}
            <div className="py-3 border-b border-gray-200">
              <div className="text-sm font-medium text-gray-700 mb-2">Features</div>
              <div className="space-y-2">
                <div className="text-sm text-gray-500 flex items-center justify-between">
                  <span>Dashboard Analytics</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">Coming Soon</span>
                </div>
                <div className="text-sm text-gray-500 flex items-center justify-between">
                  <span>Mobile App</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">Coming Soon</span>
                </div>
                <div className="text-sm text-gray-500 flex items-center justify-between">
                  <span>Automated Scheduling</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">Coming Soon</span>
                </div>
              </div>
            </div>

            {/* Sign out button */}
            <div className="pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  logout();
                  setIsMobileMenuOpen(false);
                }}
                disabled={isLoggingOut}
                className="w-full flex items-center justify-center gap-2 text-red-600 border-red-200 hover:bg-red-50"
              >
                <LogOut className="w-4 h-4" />
                {isLoggingOut ? "Signing out..." : "Sign out"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}