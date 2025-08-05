import React from 'react';
import { useLocation } from 'wouter';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

const routeMap: Record<string, BreadcrumbItem[]> = {
  '/': [{ label: 'Home' }],
  '/setup': [
    { label: 'Home', path: '/' },
    { label: 'Setup Test' }
  ],
  '/items': [
    { label: 'Home', path: '/' },
    { label: 'Setup Test', path: '/setup' },
    { label: 'Select Items' }
  ],
  '/test': [
    { label: 'Home', path: '/' },
    { label: 'Setup Test', path: '/setup' },
    { label: 'Select Items', path: '/items' },
    { label: 'Test Details' }
  ],
  '/emergency-test': [
    { label: 'Home', path: '/' },
    { label: 'Setup Test', path: '/setup' },
    { label: 'Select Items', path: '/items' },
    { label: 'Emergency Test' }
  ],
  '/failure': [
    { label: 'Home', path: '/' },
    { label: 'Setup Test', path: '/setup' },
    { label: 'Select Items', path: '/items' },
    { label: 'Test Details', path: '/test' },
    { label: 'Failure Details' }
  ],
  '/report': [
    { label: 'Home', path: '/' },
    { label: 'Setup Test', path: '/setup' },
    { label: 'Select Items', path: '/items' },
    { label: 'Test Report' }
  ]
};

export function Breadcrumb() {
  const [location, setLocation] = useLocation();
  const breadcrumbs = routeMap[location] || [{ label: 'Unknown' }];

  const handleNavigate = (path: string) => {
    setLocation(path);
  };

  if (breadcrumbs.length <= 1) {
    return null; // Don't show breadcrumb for single item
  }

  return (
    <nav className="flex items-center space-x-1 text-sm text-gray-500 px-4 py-2 bg-white border-b border-gray-200 md:px-6">
      {breadcrumbs.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <ChevronRight className="h-4 w-4 flex-shrink-0" />}
          
          {item.path ? (
            <button
              onClick={() => handleNavigate(item.path!)}
              className="hover:text-primary transition-colors"
            >
              {index === 0 && <Home className="h-4 w-4 inline mr-1" />}
              {item.label}
            </button>
          ) : (
            <span className={cn(
              "font-medium",
              index === breadcrumbs.length - 1 ? "text-gray-900" : "text-gray-500"
            )}>
              {index === 0 && <Home className="h-4 w-4 inline mr-1" />}
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}