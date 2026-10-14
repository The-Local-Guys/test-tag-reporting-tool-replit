import { CalendarCheck, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatSuggestedDueDate, getThreeMonthlyBlockLabel } from '@/lib/three-monthly-due-date';

interface SuggestedDueDateButtonProps {
  suggestedDate: string; // yyyy-mm-dd
  currentDate: string | null | undefined;
  onApply: (date: string) => void;
  className?: string;
}

/**
 * Suggestion chip for 3 monthly items: fills the due date with the end of the
 * test date's 3-month block. Shows a ticked "applied" state once it is in use.
 */
export function SuggestedDueDateButton({ suggestedDate, currentDate, onApply, className }: SuggestedDueDateButtonProps) {
  const applied = currentDate === suggestedDate;

  return (
    <button
      type="button"
      onClick={() => onApply(suggestedDate)}
      aria-pressed={applied}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
        applied
          ? 'border-green-300 bg-green-50'
          : 'border-dashed border-primary/40 bg-primary/5 hover:border-primary/70 hover:bg-primary/10',
        className,
      )}
    >
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          applied ? 'bg-green-100 text-green-700' : 'bg-primary/10 text-primary',
        )}
      >
        {applied ? <Check className="h-4 w-4" /> : <CalendarCheck className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-gray-500">
          {applied ? 'Using suggested due date' : 'Suggested due date'}
        </span>
        <span className={cn('block text-sm font-semibold', applied ? 'text-green-800' : 'text-gray-900')}>
          {formatSuggestedDueDate(suggestedDate)}
          <span className="ml-1 font-normal text-gray-500">· end of {getThreeMonthlyBlockLabel(suggestedDate)}</span>
        </span>
      </span>
      {!applied && <span className="shrink-0 text-xs font-medium text-primary">Use</span>}
    </button>
  );
}
