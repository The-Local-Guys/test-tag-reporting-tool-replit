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
    { id: 'setup', label: 'Client\nSetup', shortLabel: 'Setup' },
    { id: 'items', label: 'Select\nItems', shortLabel: 'Items' },
    { id: 'test', label: 'Test\nDetails', shortLabel: 'Test' },
    { id: 'complete', label: 'View Report\n& Complete', shortLabel: 'Report' },
  ],
  emergency_exit_light: [
    { id: 'setup', label: 'Client\nSetup', shortLabel: 'Setup' },
    { id: 'items', label: 'Select\nItems', shortLabel: 'Items' },
    { id: 'test', label: 'Test\nDetails', shortLabel: 'Test' },
    { id: 'complete', label: 'View Report\n& Complete', shortLabel: 'Report' },
  ],
  fire_testing: [
    { id: 'setup', label: 'Client\nSetup', shortLabel: 'Setup' },
    { id: 'items', label: 'Select\nItems', shortLabel: 'Items' },
    { id: 'test', label: 'Test\nDetails', shortLabel: 'Test' },
    { id: 'complete', label: 'View Report\n& Complete', shortLabel: 'Report' },
  ],
  rcd_reporting: [
    { id: 'setup', label: 'Client\nSetup', shortLabel: 'Setup' },
    { id: 'items', label: 'Select\nItems', shortLabel: 'Items' },
    { id: 'test', label: 'Test\nDetails', shortLabel: 'Test' },
    { id: 'complete', label: 'View Report\n& Complete', shortLabel: 'Report' },
  ],
  microwave_leakage: [
    { id: 'setup', label: 'Client\nSetup', shortLabel: 'Setup' },
    { id: 'items', label: 'Select\nBrand', shortLabel: 'Brand' },
    { id: 'test', label: 'Test\nDetails', shortLabel: 'Test' },
    { id: 'complete', label: 'View Report\n& Complete', shortLabel: 'Report' },
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
    <div className={cn("w-full bg-white border-b border-gray-200 py-3 px-4 relative z-0", className)} data-testid="workflow-progress-bar">
      <div className="relative flex justify-between items-start max-w-lg mx-auto">
        {/* Connector lines - absolute positioned */}
        <div className="absolute top-4 left-0 right-0 flex justify-between px-10">
          {steps.slice(0, -1).map((_, index) => (
            <div
              key={`connector-${index}`}
              className={cn(
                "flex-1 h-0.5 mx-1 transition-all duration-300",
                index < currentStepIndex ? "bg-green-500" : "bg-gray-200"
              )}
              data-testid={`step-connector-${index}`}
            />
          ))}
        </div>

        {/* Steps */}
        {steps.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isPending = index > currentStepIndex;

          return (
            <div key={step.id} className="flex flex-col items-center z-10">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 bg-white",
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
                  "mt-2 text-xs font-medium text-center whitespace-pre-line hidden sm:block",
                  isCompleted && "text-green-600",
                  isCurrent && "text-primary",
                  isPending && "text-gray-400"
                )}
              >
                {step.label}
              </span>
              <span
                className={cn(
                  "mt-2 text-xs font-medium text-center whitespace-pre-line sm:hidden",
                  isCompleted && "text-green-600",
                  isCurrent && "text-primary",
                  isPending && "text-gray-400"
                )}
              >
                {step.shortLabel || step.label}
              </span>
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
