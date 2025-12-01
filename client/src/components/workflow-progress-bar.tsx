import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type ServiceType = 'electrical' | 'emergency_exit_light' | 'fire_testing' | 'rcd_reporting' | 'microwave_leakage';

export interface WorkflowStep {
  id: string;
  label: string;
  shortLabel?: string;
}

const workflowSteps: Record<ServiceType, WorkflowStep[]> = {
  electrical: [
    { id: 'setup', label: 'Client Setup', shortLabel: 'Setup' },
    { id: 'items', label: 'Select Items', shortLabel: 'Items' },
    { id: 'test', label: 'Test Details', shortLabel: 'Test' },
    { id: 'complete', label: 'View Report & Complete', shortLabel: 'Report' },
  ],
  emergency_exit_light: [
    { id: 'setup', label: 'Client Setup', shortLabel: 'Setup' },
    { id: 'items', label: 'Select Items', shortLabel: 'Items' },
    { id: 'test', label: 'Test Details', shortLabel: 'Test' },
    { id: 'complete', label: 'View Report & Complete', shortLabel: 'Report' },
  ],
  fire_testing: [
    { id: 'setup', label: 'Client Setup', shortLabel: 'Setup' },
    { id: 'items', label: 'Select Items', shortLabel: 'Items' },
    { id: 'test', label: 'Test Details', shortLabel: 'Test' },
    { id: 'complete', label: 'View Report & Complete', shortLabel: 'Report' },
  ],
  rcd_reporting: [
    { id: 'setup', label: 'Client Setup', shortLabel: 'Setup' },
    { id: 'items', label: 'Select Items', shortLabel: 'Items' },
    { id: 'test', label: 'Test Details', shortLabel: 'Test' },
    { id: 'complete', label: 'View Report & Complete', shortLabel: 'Report' },
  ],
  microwave_leakage: [
    { id: 'setup', label: 'Client Setup', shortLabel: 'Setup' },
    { id: 'items', label: 'Select Brand', shortLabel: 'Brand' },
    { id: 'test', label: 'Test Details', shortLabel: 'Test' },
    { id: 'complete', label: 'View Report & Complete', shortLabel: 'Report' },
  ],
};

interface WorkflowProgressBarProps {
  serviceType: ServiceType;
  currentStep: string;
  className?: string;
}

export function WorkflowProgressBar({ serviceType, currentStep, className }: WorkflowProgressBarProps) {
  const steps = workflowSteps[serviceType] || workflowSteps.electrical;
  const currentStepIndex = steps.findIndex(step => step.id === currentStep);

  return (
    <div className={cn("w-full bg-white border-b border-gray-200 py-3 px-4", className)} data-testid="workflow-progress-bar">
      <div className="flex items-center justify-between max-w-2xl mx-auto">
        {steps.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isPending = index > currentStepIndex;

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-initial">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300",
                    isCompleted && "bg-green-500 text-white",
                    isCurrent && "bg-primary text-white ring-2 ring-primary ring-offset-2",
                    isPending && "bg-gray-200 text-gray-500"
                  )}
                  data-testid={`step-indicator-${step.id}`}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <span
                  className={cn(
                    "mt-1 text-xs font-medium text-center hidden sm:block",
                    isCompleted && "text-green-600",
                    isCurrent && "text-primary",
                    isPending && "text-gray-400"
                  )}
                >
                  {step.label}
                </span>
                <span
                  className={cn(
                    "mt-1 text-xs font-medium text-center sm:hidden",
                    isCompleted && "text-green-600",
                    isCurrent && "text-primary",
                    isPending && "text-gray-400"
                  )}
                >
                  {step.shortLabel || step.label}
                </span>
              </div>
              
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-2 transition-all duration-300",
                    index < currentStepIndex ? "bg-green-500" : "bg-gray-200"
                  )}
                  data-testid={`step-connector-${index}`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function getWorkflowSteps(serviceType: ServiceType): WorkflowStep[] {
  return workflowSteps[serviceType] || workflowSteps.electrical;
}
