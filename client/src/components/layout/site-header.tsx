import { Button } from "@/components/ui/button";
import { LogOut, User, Menu, X, Home, Settings, FileText, Shield, TestTube, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMobileMenu } from "@/contexts/MobileMenuContext";
import { useLocation, Link } from "wouter";

export function SiteHeader() {
  const { user, logout, isLoggingOut } = useAuth();
  const { isMobileMenuOpen, toggleMobileMenu } = useMobileMenu();
  const [location] = useLocation();
  
  // Type guard for user object
  const typedUser = user as { fullName?: string; role?: string } | undefined;

  // Don't show header on login page
  if (location === '/login') {
    return null;
  }

  // Get page title based on current route
  const getPageTitle = () => {
    switch (location) {
      case '/':
        return 'Service Selection';
      case '/setup':
        return 'Test Setup';
      case '/items':
        return 'Item Selection';
      case '/test':
        return 'Test Details';
      case '/emergency-test':
        return 'Emergency Exit Light Testing';
      case '/failure':
        return 'Failure Details';
      case '/report':
        return 'Report Preview';
      default:
        if (location.startsWith('/admin')) {
          return 'Admin Dashboard';
        }
        return 'TLG Reporting Tool';
    }
  };

  const getPageSubtitle = () => {
    const loginMode = sessionStorage.getItem('loginMode');
    if (loginMode === 'admin') {
      return 'Administrative Interface';
    }
    
    switch (location) {
      case '/':
        return 'Choose your testing service';
      case '/setup':
        return 'Configure test session details';
      case '/items':
        return 'Select items for testing';
      case '/test':
        return 'Record test results';
      case '/emergency-test':
        return 'AS 2293.2:2019 Compliance Testing';
      case '/failure':
        return 'Document failure details';
      case '/report':
        return 'Review and generate reports';
      default:
        return 'Professional Testing & Compliance';
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 mb-6">
      <div className="flex justify-between items-center">
        {/* Left side - Title */}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold truncate">{getPageTitle()}</h1>
          <div className="text-blue-100 text-xs sm:text-sm mt-1 truncate">{getPageSubtitle()}</div>
        </div>

        {/* Desktop navigation - hidden on mobile */}
        <div className="hidden md:flex items-center gap-3">
          {/* Navigation Links */}
          <nav className="flex items-center gap-1">
            <Link href="/">
              <Button
                variant="ghost" 
                size="sm"
                className="text-white hover:bg-white/20 flex items-center gap-2"
              >
                <TestTube className="w-4 h-4" />
                <span>Testing</span>
              </Button>
            </Link>
            
            {/* Show admin link for all authorized users */}
            {(typedUser?.role === 'super_admin' || typedUser?.role === 'support_center' || typedUser?.role === 'technician') && (
              <Link href="/admin">
                <Button
                  variant="ghost" 
                  size="sm"
                  className="text-white hover:bg-white/20 flex items-center gap-2"
                >
                  <Shield className="w-4 h-4" />
                  <span>
                    {(typedUser?.role === 'super_admin' || typedUser?.role === 'support_center') ? 'Admin' : 'Reports'}
                  </span>
                </Button>
              </Link>
            )}
            
            {/* Feedback Link */}
            <Button
              variant="ghost" 
              size="sm"
              onClick={() => window.open('https://forms.monday.com/forms/761a950aa279edcb02d48257ced6ecc6?r=use1', '_blank')}
              className="text-white hover:bg-white/20 flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Feedback</span>
            </Button>
          </nav>
          
          {/* User info and logout */}
          {typedUser && (
            <div className="flex items-center space-x-2 text-sm text-blue-100 pl-2 border-l border-white/20">
              <User className="w-4 h-4" />
              <span className="hidden xl:inline">{typedUser.fullName}</span>
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
            <span className="hidden xl:inline">{isLoggingOut ? "Signing out..." : "Sign out"}</span>
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