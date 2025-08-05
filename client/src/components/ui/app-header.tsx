import { Button } from "@/components/ui/button";
import { LogOut, User, Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMobileMenu } from "@/contexts/MobileMenuContext";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showUserInfo?: boolean;
  children?: React.ReactNode;
}

export function AppHeader({ title, subtitle, showUserInfo = true, children }: AppHeaderProps) {
  const { user, logout, isLoggingOut } = useAuth();
  const { isMobileMenuOpen, toggleMobileMenu } = useMobileMenu();
  
  // Type guard for user object
  const typedUser = user as { fullName?: string; role?: string } | undefined;

  return (
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
  );
}