import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { LogOut, User, Menu, X, Home, Settings, FileText, Shield, TestTube, ExternalLink, FolderTree } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMobileMenu } from "@/contexts/MobileMenuContext";
import { useLocation } from "wouter";
import { useConditionalNav } from '@/contexts/ConditionalNavContext';

export function SiteHeader() {
  const { user, logout, isLoggingOut, hasUnsavedResults } = useAuth();
  const { isMobileMenuOpen, toggleMobileMenu } = useMobileMenu();
  const [location] = useLocation();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const { navigate } = useConditionalNav();
  
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
      case '/fire-test':
        return 'Fire Equipment Testing';
      case '/failure':
        return 'Failure Details';
      case '/report':
        return 'Report Preview';
      case '/environments':
        return 'Environments';
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
      case '/fire-test':
        return 'AS 1851 / NZS 4503:2005 Compliance Testing';
      case '/failure':
        return 'Document failure details';
      case '/report':
        return 'Review and generate reports';
      case '/environments':
        return 'Manage your custom item sets';
      default:
        return 'Professional Testing & Compliance';
    }
  };

  const handleLogoutClick = async () => {
    try {
      await logout();
    } catch (error: any) {
      if (error.message === 'UNSAVED_RESULTS') {
        setShowLogoutConfirm(true);
      } else {
        console.error('Logout failed:', error);
      }
    }
  };

  const confirmLogout = async () => {
    try {
      await logout(true); // Force logout
      setShowLogoutConfirm(false);
    } catch (error) {
      console.error('Force logout failed:', error);
    }
  };

  return (
    <>
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
            {/* Replace Link with Button calling navigate */}
            <Button
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/')} // Use conditional navigate
              className="text-white hover:bg-white/20 flex items-center gap-2"
              data-testid="nav-testing"
            >
              <TestTube className="w-4 h-4" />
              <span>Testing</span>
            </Button>
            
            {/* Environments link - only in testing mode */}
            {sessionStorage.getItem('loginMode') === 'testing' && (
              <Button
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/environments')}
                className="text-white hover:bg-white/20 flex items-center gap-2"
                data-testid="nav-environments"
              >
                <FolderTree className="w-4 h-4" />
                <span>Environments</span>
              </Button>
            )}
            
            {/* Show admin link for all authorized users */}
            {(typedUser?.role === 'super_admin' || typedUser?.role === 'support_center' || typedUser?.role === 'technician') && (
              // Replace Link with Button calling navigate
              <Button
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/admin')} // Use conditional navigate
                className="text-white hover:bg-white/20 flex items-center gap-2"
                data-testid="nav-admin"
              >
                <Shield className="w-4 h-4" />
                <span>
                  {(typedUser?.role === 'super_admin' || typedUser?.role === 'support_center') ? 'Admin' : 'Reports'}
                </span>
              </Button>
            )}
            
            {/* Feedback Link */}
            <Button
              variant="ghost" 
              size="sm"
              onClick={() => window.open('https://forms.monday.com/forms/761a950aa279edcb02d48257ced6ecc6?r=use1', '_blank')}
              className="text-white hover:bg-white/20 flex items-center gap-2"
              data-testid="nav-feedback"
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
            onClick={handleLogoutClick}
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

    {/* Logout Confirmation Dialog */}
    <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved Test Results</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved test results that will be lost if you sign out. Would you like to save your work first?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setShowLogoutConfirm(false)}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => navigate('/report')} className="bg-blue-600 hover:bg-blue-700">
            Save Work
          </AlertDialogAction>
          <AlertDialogAction onClick={confirmLogout} className="bg-red-600 hover:bg-red-700">
            Sign Out Anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}