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
    <div className={cn("w-full bg-white border-b border-gray-200 py-3 px-4", className)} data-testid="workflow-progress-bar">
      <div className="flex flex-col max-w-md mx-auto">
        {/* Step indicators row - aligned horizontally */}
        <div className="flex items-center">
          {steps.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const isPending = index > currentStepIndex;

            return (
              <div key={step.id} className="flex items-center flex-1 last:flex-none">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 shrink-0",
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
        
        {/* Labels row - aligned below indicators */}
        <div className="flex mt-1">
          {steps.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const isPending = index > currentStepIndex;

            return (
              <div key={`label-${step.id}`} className="flex-1 last:flex-none flex justify-start">
                <span
                  className={cn(
                    "text-xs font-medium text-center hidden sm:block whitespace-pre",
                    isCompleted && "text-green-600",
                    isCurrent && "text-primary",
                    isPending && "text-gray-400"
                  )}
                  style={{ marginLeft: '-10px' }}
                >
                  {step.label}
                </span>
                <span
                  className={cn(
                    "text-xs font-medium text-center sm:hidden whitespace-pre",
                    isCompleted && "text-green-600",
                    isCurrent && "text-primary",
                    isPending && "text-gray-400"
                  )}
                  style={{ marginLeft: '-4px' }}
                >
                  {step.shortLabel || step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function getWorkflowSteps(serviceType: ServiceType): WorkflowStep[] {
  return workflowSteps[serviceType] || workflowSteps.electrical;
}
