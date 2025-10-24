import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { LogOut, User, Home, Settings, Lock, ExternalLink, TestTube, Users, FileText, ClipboardCheck, FolderTree } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMobileMenu } from "@/contexts/MobileMenuContext";
import { useConditionalNav } from '@/contexts/ConditionalNavContext';
import { useLocation } from 'wouter';

export function MobileMenu() {
  const { user, logout, isLoggingOut, hasUnsavedResults } = useAuth();
  const { isMobileMenuOpen, closeMobileMenu } = useMobileMenu();
  const { navigate } = useConditionalNav();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [location] = useLocation();
  
  // Type guard for user object
  const typedUser = user as { fullName?: string; role?: string } | undefined;

  // Get current login mode
  const currentLoginMode = sessionStorage.getItem('loginMode');
  const isAdminMode = currentLoginMode === 'admin';
  const isTestingMode = currentLoginMode === 'testing';

  // Check if user has admin privileges
  const hasAdminAccess = typedUser && (typedUser.role === 'super_admin' || typedUser.role === 'support_center');
  const hasTechnicianAccess = typedUser && typedUser.role === 'technician';

  const switchToTestingMode = () => {
    sessionStorage.setItem('loginMode', 'testing');
    closeMobileMenu();
    navigate('/');
  };

  const switchToAdminMode = () => {
    sessionStorage.setItem('loginMode', 'admin');
    closeMobileMenu();
    navigate('/admin');
  };

  const handleNavigation = (path: string) => {
    closeMobileMenu();
    navigate(path);
  };

  const handleLogout = async () => {
    try {
      await logout();
      closeMobileMenu();
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
      closeMobileMenu();
    } catch (error) {
      console.error('Force logout failed:', error);
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
                <div className="text-xs text-blue-600 mt-1">
                  {isAdminMode ? 'Admin Mode' : 'Testing Mode'}
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700 mb-3">Navigation</div>
            
            {/* Testing Mode */}
            <Button
              variant="ghost"
              onClick={switchToTestingMode}
              className={`w-full flex items-center justify-start gap-3 text-left ${isTestingMode ? 'bg-blue-50 text-blue-700' : ''}`}
            >
              <TestTube className="w-5 h-5" />
              <div>
                <div className="font-medium">Testing Mode</div>
                <div className="text-sm opacity-75">Perform electrical testing</div>
              </div>
            </Button>

            {/* Admin Mode - Only show if user has access */}
            {(hasAdminAccess || hasTechnicianAccess) && (
              <Button
                variant="ghost"
                onClick={switchToAdminMode}
                className={`w-full flex items-center justify-start gap-3 text-left ${isAdminMode ? 'bg-blue-50 text-blue-700' : ''}`}
              >
                <Settings className="w-5 h-5" />
                <div>
                  <div className="font-medium">
                    {hasAdminAccess ? 'Admin Dashboard' : 'View My Reports'}
                  </div>
                  <div className="text-sm opacity-75">
                    {hasAdminAccess ? 'Manage users & reports' : 'View your test reports'}
                </div>
                </div>
              </Button>
            )}

            {/* Environments - Only show for technicians */}
            {hasTechnicianAccess && (
              <Button
                variant="ghost"
                onClick={() => handleNavigation('/environments')}
                className={`w-full flex items-center justify-start gap-3 text-left ${location === '/environments' ? 'bg-blue-50 text-blue-700' : ''}`}
              >
                <FolderTree className="w-5 h-5" />
                <div>
                  <div className="font-medium">Environments</div>
                  <div className="text-sm opacity-75">Manage custom item sets</div>
                </div>
              </Button>
            )}



            {/* Admin Mode Info */}
            {isAdminMode && hasAdminAccess && (
              <div className="text-sm text-gray-600 p-2 bg-gray-50 rounded-lg ml-4">
                <div className="font-medium">Super Admin Access</div>
                <div>Full system management capabilities</div>
              </div>
            )}

            {isAdminMode && hasTechnicianAccess && !hasAdminAccess && (
              <div className="text-sm text-gray-600 p-2 bg-gray-50 rounded-lg ml-4">
                <div className="font-medium">Technician Access</div>
                <div>View and manage your test reports</div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-gray-200 space-y-3">
            <Button
              variant="outline"
              onClick={() => {
                window.open('https://forms.monday.com/forms/761a950aa279edcb02d48257ced6ecc6?r=use1', '_blank');
                closeMobileMenu();
              }}
              className="w-full flex items-center justify-center gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              <ExternalLink className="w-4 h-4" />
              Feedback
            </Button>
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
            <AlertDialogAction onClick={() => { closeMobileMenu(); navigate('/report'); }} className="bg-blue-600 hover:bg-blue-700">
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