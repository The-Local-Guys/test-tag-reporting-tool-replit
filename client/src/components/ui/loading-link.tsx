import { ReactNode } from 'react';
import { Link } from 'wouter';
import { useLoading } from '@/contexts/LoadingContext';

interface LoadingLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function LoadingLink({ href, children, className, onClick }: LoadingLinkProps) {
  const { startPageLoad } = useLoading();

  const handleClick = () => {
    startPageLoad();
    onClick?.();
  };

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}