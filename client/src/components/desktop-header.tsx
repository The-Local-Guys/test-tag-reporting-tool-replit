import React from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut, Shield, User } from 'lucide-react';

export function DesktopHeader() {
  const [location, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        // Clear session storage and reload page
        sessionStorage.clear();
        localStorage.clear();
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleAdminToggle = () => {
    const currentMode = sessionStorage.getItem('loginMode');
    const newMode = currentMode === 'admin' ? 'testing' : 'admin';
    sessionStorage.setItem('loginMode', newMode);
    window.location.reload();
  };

  // Don't show header if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  const userRole = (user as any)?.role;
  const isAdmin = userRole === 'super_admin' || userRole === 'support_center';
  const currentMode = sessionStorage.getItem('loginMode');

  return (
    <header className="hidden md:flex items-center justify-between bg-white border-b border-gray-200 px-6 py-4">
      {/* Logo/Brand */}
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold text-gray-900">
          TLG Testing System
        </h1>
        {currentMode && (
          <span className="text-sm text-blue-600 capitalize bg-blue-50 px-2 py-1 rounded">
            {currentMode} Mode
          </span>
        )}
      </div>

      {/* User Info & Actions */}
      <div className="flex items-center gap-4">
        {/* User Info */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <User className="h-4 w-4 text-white" />
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">
              {(user as any)?.fullName || 'User'}
            </p>
            <p className="text-xs text-gray-500 capitalize">
              {userRole?.replace('_', ' ') || 'User'}
            </p>
          </div>
        </div>

        {/* Admin Mode Toggle */}
        {isAdmin && (
          <Button
            onClick={handleAdminToggle}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Shield className="h-4 w-4" />
            Switch to {currentMode === 'admin' ? 'Testing' : 'Admin'}
          </Button>
        )}

        {/* Logout */}
        <Button
          onClick={handleLogout}
          variant="ghost"
          size="sm"
          className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </header>
  );
}