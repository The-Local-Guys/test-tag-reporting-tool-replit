import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Menu, Home, Settings, ClipboardList, FileText, LogOut, User, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MenuItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  requireAuth?: boolean;
  adminOnly?: boolean;
}

const getMenuItems = (currentMode: string | null): MenuItem[] => {
  if (currentMode === 'admin') {
    return [
      {
        label: 'Admin Dashboard',
        path: '/',
        icon: <Shield className="h-4 w-4" />,
        requireAuth: true,
        adminOnly: true,
      },
    ];
  }

  return [
    {
      label: 'Home',
      path: '/',
      icon: <Home className="h-4 w-4" />,
      requireAuth: true,
    },
    {
      label: 'Setup Test',
      path: '/setup',
      icon: <Settings className="h-4 w-4" />,
      requireAuth: true,
    },
    {
      label: 'Test Items',
      path: '/items',
      icon: <ClipboardList className="h-4 w-4" />,
      requireAuth: true,
    },
    {
      label: 'Test Report',
      path: '/report',
      icon: <FileText className="h-4 w-4" />,
      requireAuth: true,
    },
  ];
};

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();

  const handleNavigation = (path: string) => {
    setLocation(path);
    setIsOpen(false);
  };

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
    setIsOpen(false);
  };

  const handleAdminToggle = () => {
    const currentMode = sessionStorage.getItem('loginMode');
    const newMode = currentMode === 'admin' ? 'testing' : 'admin';
    sessionStorage.setItem('loginMode', newMode);
    window.location.reload();
    setIsOpen(false);
  };

  // Don't show menu if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  const userRole = (user as any)?.role;
  const isAdmin = userRole === 'super_admin' || userRole === 'support_center';
  const currentMode = sessionStorage.getItem('loginMode');
  const menuItems = getMenuItems(currentMode);

  return (
    <div className="md:hidden fixed top-4 left-4 z-50">
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button 
            variant="outline" 
            size="icon"
            className="bg-white shadow-lg border-gray-200 hover:bg-gray-50"
          >
            <Menu className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </SheetTrigger>
        
        <SheetContent side="left" className="w-[280px] sm:w-[300px]">
          <SheetHeader>
            <SheetTitle className="text-left">Navigation</SheetTitle>
          </SheetHeader>
          
          <div className="flex flex-col h-full">
            {/* User Info */}
            <div className="border-b border-gray-200 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {(user as any)?.fullName || 'User'}
                  </p>
                  <p className="text-sm text-gray-500 capitalize">
                    {userRole?.replace('_', ' ') || 'User'}
                  </p>
                  {currentMode && (
                    <p className="text-xs text-blue-600 capitalize">
                      {currentMode} Mode
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Navigation Items */}
            <nav className="flex-1">
              <ul className="space-y-2">
                {menuItems.map((item) => {
                  const isActive = location === item.path;
                  
                  return (
                    <li key={item.path}>
                      <button
                        onClick={() => handleNavigation(item.path)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                          isActive
                            ? "bg-primary text-white"
                            : "text-gray-700 hover:bg-gray-100"
                        )}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* Footer Actions */}
            <div className="border-t border-gray-200 pt-4 space-y-2">
              {/* Admin Mode Toggle */}
              {isAdmin && (
                <button
                  onClick={handleAdminToggle}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <Shield className="h-4 w-4" />
                  <span>
                    Switch to {currentMode === 'admin' ? 'Testing' : 'Admin'} Mode
                  </span>
                </button>
              )}
              
              {/* Logout */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}