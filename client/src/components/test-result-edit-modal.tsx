import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { failureReasons, emergencyFailureReasons, fireFailureReasons, rcdFailureReasons } from '@shared/schema';
import { parseRcdTripTimesInput, resolveRcdTripTimes } from "@/lib/rcd-trip-times";

interface TestResultEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  editResultData: any;
  setEditResultData: (data: any | ((prev: any) => any)) => void;
  onSave: (data?: any) => void;
  serviceType?: string;
  assetNumberError?: string;
  onAssetNumberChange?: (value: string) => void;
  onFrequencyChange?: (value: string) => void;
  isSaving?: boolean;
  title?: string;
  saveLabel?: string;
  savingLabel?: string;
}

export function TestResultEditModal({
  isOpen,
  onClose,
  editResultData,
  setEditResultData,
  onSave,
  serviceType,
  assetNumberError = "",
  onAssetNumberChange,
  onFrequencyChange,
  isSaving = false,
  title = "Edit Test Result",
  saveLabel = "Update Result",
  savingLabel = "Updating...",
}: TestResultEditModalProps) {

  // Local raw string for the trip times input so typing commas/partial numbers works naturally.
  // Parsed to numbers only on blur.
  const [tripTimesInput, setTripTimesInput] = useState('');
  useEffect(() => {
    if (isOpen) {
      setTripTimesInput(resolveRcdTripTimes(editResultData).join(', '));
    }
  }, [isOpen, editResultData.tripTimes, editResultData.trip_times]);

  const saveWithCurrentTripTimes = () => {
    onSave({
      ...editResultData,
      tripTimes: parseRcdTripTimesInput(tripTimesInput),
    });
  };

  const getFailureReasons = () => {
    switch (serviceType) {
      case 'emergency_exit_light':
        return emergencyFailureReasons;
      case 'fire_testing':
        return fireFailureReasons;
      case 'rcd_reporting':
        return rcdFailureReasons;
      default:
        return failureReasons; // electrical testing
    }
  };

  const getFailureReasonLabel = (reason: string) => {
    const labelMap: { [key: string]: string } = {
      // Electrical testing reasons
      'vision': 'Vision',
      'earth': 'Earth',
      'insulation': 'Insulation',
      'polarity': 'Polarity',
      // Emergency exit light reasons
      'physical_damage': 'Physical Damage',
      'battery_failure': 'Battery Failure',
      'lamp_failure': 'Lamp/LED Failure',
      'wiring_fault': 'Wiring Fault',
      'charging_fault': 'Charging Fault',
      'insufficient_illumination': 'Insufficient Illumination',
      'mounting_issue': 'Mounting Issue',
      // Fire testing reasons
      'pressure_loss': 'Pressure Loss',
      'corrosion': 'Corrosion',
      'blocked_nozzle': 'Blocked Nozzle',
      'damaged_seal': 'Damaged Seal',
      'expired': 'Expired',
      // RCD testing reasons
      'push_button': 'Push Button Test Failed',
      'injection_timed': 'Injection/Timed Test Failed',
      'tripping_time': 'Tripping Time Out of Range',
      'no_trip': 'No Trip Occurred',
      'visual': 'Visual Inspection Failed',
      // Common reasons
      'other': 'Other',
    };
    return labelMap[reason] || reason;
  };

  const handleAssetNumberChange = (value: string) => {
    setEditResultData((prev: any) => ({ ...prev, assetNumber: value }));
    onAssetNumberChange?.(value);
  };

  const handleFrequencyChange = (value: string) => {
    setEditResultData((prev: any) => ({ ...prev, frequency: value }));
    onFrequencyChange?.(value);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="edit-itemName">Item Name</Label>
          <Input
            id="edit-itemName"
            value={editResultData.itemName}
            onChange={(e) => setEditResultData((prev: any) => ({ ...prev, itemName: e.target.value }))}
            className="text-base"
          />
        </div>

        <div>
          <Label htmlFor="edit-itemType">Item Type</Label>
          <Input
            id="edit-itemType"
            value={editResultData.itemType}
            onChange={(e) => setEditResultData((prev: any) => ({ ...prev, itemType: e.target.value }))}
            className="text-base"
          />
        </div>

        <div>
          <Label htmlFor="edit-location">Location</Label>
          <Input
            id="edit-location"
            value={editResultData.location}
            onChange={(e) => setEditResultData((prev: any) => ({ ...prev, location: e.target.value }))}
            className="text-base"
          />
        </div>

        <div>
          <Label htmlFor="edit-assetNumber">Asset Number</Label>
          <Input
            id="edit-assetNumber"
            value={editResultData.assetNumber}
            onChange={(e) => handleAssetNumberChange(e.target.value)}
            className={`text-base ${assetNumberError ? 'border-red-500' : ''}`}
            placeholder="Enter asset number"
          />
          {assetNumberError && (
            <div className="text-red-500 text-sm mt-1">{assetNumberError}</div>
          )}
        </div>

        {/* Classification field - shown differently per service type */}
        {/* Electrical PAT: Show as "Classification" with class options */}
        {serviceType === 'electrical' && (
          <div>
            <Label htmlFor="edit-classification">Classification</Label>
            <Select
              value={editResultData.classification}
              onValueChange={(value) => setEditResultData((prev: any) => ({ ...prev, classification: value as any }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="class1">Class 1</SelectItem>
                <SelectItem value="class2">Class 2</SelectItem>
                <SelectItem value="epod">EPOD</SelectItem>
                <SelectItem value="rcd">RCD</SelectItem>
                <SelectItem value="3phase">3 Phase</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Fire Testing: Show as "Equipment Type" */}
        {serviceType === 'fire_testing' && (
          <div>
            <Label htmlFor="edit-classification">Equipment Type</Label>
            <Select
              value={editResultData.classification}
              onValueChange={(value) => setEditResultData((prev: any) => ({
                ...prev,
                classification: value as any,
                equipmentType: value,
              }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fire_extinguisher">Fire Extinguisher</SelectItem>
                <SelectItem value="fire_blanket">Fire Blanket</SelectItem>
                <SelectItem value="fire_hose_reel">Fire Hose Reel</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* RCD Reporting: Show as "Equipment Type" */}
        {serviceType === 'rcd_reporting' && (
          <div>
            <Label htmlFor="edit-classification">Equipment Type</Label>
            <Select
              value={editResultData.classification}
              onValueChange={(value) => setEditResultData((prev: any) => ({ ...prev, classification: value as any }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed-rcd">Fixed RCD</SelectItem>
                <SelectItem value="portable-rcd">Portable RCD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Emergency Exit Light & Microwave Leakage: Hide classification (not relevant) */}

        <div>
          <Label htmlFor="edit-result">
            Test Result
            {serviceType === 'microwave_leakage' && (
              <span className="text-xs text-gray-500 ml-2">(Auto-calculated from leakage reading)</span>
            )}
          </Label>
          <Select
            value={editResultData.result}
            onValueChange={(value) => setEditResultData((prev: any) => ({ ...prev, result: value as any }))}
            disabled={serviceType === 'microwave_leakage'}
          >
            <SelectTrigger className={serviceType === 'microwave_leakage' ? 'cursor-not-allowed opacity-75' : ''}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pass">Pass</SelectItem>
              <SelectItem value="fail">Fail</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Hide frequency for RCD Reporting and Microwave Leakage Testing */}
        {serviceType !== 'rcd_reporting' && serviceType !== 'microwave_leakage' && (
          <div>
            <Label htmlFor="edit-frequency">Test Frequency</Label>
            <Select
              value={editResultData.frequency}
              onValueChange={handleFrequencyChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="threemonthly">3 Monthly</SelectItem>
                <SelectItem value="sixmonthly">6 Monthly</SelectItem>
                {/* Show 'annually' for emergency exit light, 'twelvemonthly' for others */}
                {serviceType === 'emergency_exit_light' ? (
                  <SelectItem value="annually">12 Monthly</SelectItem>
                ) : (
                  <SelectItem value="twelvemonthly">12 Monthly</SelectItem>
                )}
                <SelectItem value="twentyfourmonthly">24 Monthly</SelectItem>
                <SelectItem value="fiveyearly">5 Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* RCD-specific fields */}
        {serviceType === 'rcd_reporting' && (
          <>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-pushButtonTest"
                checked={editResultData.pushButtonTest === true}
                onCheckedChange={(checked) => setEditResultData((prev: any) => ({ ...prev, pushButtonTest: !!checked }))}
              />
              <Label htmlFor="edit-pushButtonTest">Push Button Test</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-injectionTimedTest"
                checked={editResultData.injectionTimedTest === true}
                onCheckedChange={(checked) => setEditResultData((prev: any) => ({ ...prev, injectionTimedTest: !!checked }))}
              />
              <Label htmlFor="edit-injectionTimedTest">Injection/Timed Test</Label>
            </div>

            {editResultData.injectionTimedTest && (
              <div>
                <Label>Trip Times (ms, comma-separated)</Label>
                <Input
                  value={tripTimesInput}
                  onChange={(e) => setTripTimesInput(e.target.value)}
                  onBlur={(e) => {
                    const times = parseRcdTripTimesInput(e.target.value);
                    setEditResultData((prev: any) => ({ ...prev, tripTimes: times }));
                  }}
                  placeholder="e.g., 30, 28, 31"
                  className="text-base"
                />
              </div>
            )}

            {editResultData.classification === 'fixed-rcd' && (
              <>
                <div>
                  <Label htmlFor="edit-distributionBoardNumber">Distribution Board Number</Label>
                  <Input
                    id="edit-distributionBoardNumber"
                    value={editResultData.distributionBoardNumber || ''}
                    onChange={(e) => setEditResultData((prev: any) => ({ ...prev, distributionBoardNumber: e.target.value || null }))}
                    placeholder="e.g., DB-1"
                    className="text-base"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-circuitBreakerNumber">Circuit Breaker Number</Label>
                  <Input
                    id="edit-circuitBreakerNumber"
                    value={editResultData.circuitBreakerNumber || ''}
                    onChange={(e) => setEditResultData((prev: any) => ({ ...prev, circuitBreakerNumber: e.target.value || null }))}
                    placeholder="e.g., CB3"
                    className="text-base"
                  />
                </div>
              </>
            )}
          </>
        )}

        {/* Emergency Exit Light criteria fields */}
        {serviceType === 'emergency_exit_light' && (
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-700">Test Criteria</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-visionInspection"
                checked={editResultData.visionInspection}
                onCheckedChange={(checked) => setEditResultData((prev: any) => ({ ...prev, visionInspection: !!checked }))}
              />
              <Label htmlFor="edit-visionInspection">Visual Inspection</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-switchingTest"
                checked={editResultData.switchingTest}
                onCheckedChange={(checked) => setEditResultData((prev: any) => ({ ...prev, switchingTest: !!checked }))}
              />
              <Label htmlFor="edit-switchingTest">Automatic Switching Test</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-chargingTest"
                checked={editResultData.chargingTest}
                onCheckedChange={(checked) => setEditResultData((prev: any) => ({ ...prev, chargingTest: !!checked }))}
              />
              <Label htmlFor="edit-chargingTest">Charging Circuit Test</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-dischargeTest"
                checked={editResultData.dischargeTest}
                onCheckedChange={(checked) => setEditResultData((prev: any) => ({ ...prev, dischargeTest: !!checked }))}
              />
              <Label htmlFor="edit-dischargeTest">90-Minute Discharge Test</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-luxTest"
                checked={editResultData.luxTest}
                onCheckedChange={(checked) => {
                  setEditResultData((prev: any) => ({
                    ...prev,
                    luxTest: !!checked,
                    // Clear lux fields if unchecking
                    ...(checked ? {} : { luxReading: null, luxCompliant: false })
                  }));
                }}
              />
              <Label htmlFor="edit-luxTest">Lux Level Test</Label>
            </div>
            {editResultData.luxTest && (
              <div className="ml-6 space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div>
                  <Label htmlFor="edit-luxReading" className="text-sm font-medium">
                    Lux Reading (illuminance level)
                  </Label>
                  <Input
                    id="edit-luxReading"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="e.g., 0.2"
                    value={editResultData.luxReading || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEditResultData((prev: any) => ({
                        ...prev,
                        luxReading: value ? parseFloat(value) : null
                      }));
                    }}
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Minimum requirement: 0.2 lux for escape route lighting
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="edit-luxCompliant"
                    checked={editResultData.luxCompliant}
                    onCheckedChange={(checked) => setEditResultData((prev: any) => ({ ...prev, luxCompliant: !!checked }))}
                  />
                  <Label htmlFor="edit-luxCompliant" className="text-sm">
                    Meets minimum lux requirements (≥0.2 lux)
                  </Label>
                </div>
              </div>
            )}

            {/* Emergency Exit Light Equipment Info */}
            <div>
              <Label htmlFor="edit-manufacturerInfo">Manufacturer & Model</Label>
              <Input
                id="edit-manufacturerInfo"
                value={editResultData.manufacturerInfo || ''}
                onChange={(e) => setEditResultData((prev: any) => ({ ...prev, manufacturerInfo: e.target.value || null }))}
                placeholder="e.g., Brand Model123"
                className="text-base"
              />
            </div>

            <div>
              <Label htmlFor="edit-installationDate">Installation/Last Replacement Date</Label>
              <Input
                id="edit-installationDate"
                type="date"
                value={editResultData.installationDate || ''}
                onChange={(e) => setEditResultData((prev: any) => ({ ...prev, installationDate: e.target.value || null }))}
                className="text-base"
              />
            </div>

            <div>
              <Label htmlFor="edit-maintenanceType">Maintenance Type</Label>
              <Select
                value={editResultData.maintenanceType || ''}
                onValueChange={(value) => setEditResultData((prev: any) => ({ ...prev, maintenanceType: value || null }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select maintenance type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="maintained">Maintained</SelectItem>
                  <SelectItem value="non_maintained">Non-Maintained</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit-globeType">Globe Type</Label>
              <Select
                value={editResultData.globeType || ''}
                onValueChange={(value) => setEditResultData((prev: any) => ({ ...prev, globeType: value || null }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select globe type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="led">LED</SelectItem>
                  <SelectItem value="fluorescent">Fluorescent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Fire Testing criteria fields */}
        {serviceType === 'fire_testing' && (
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-700">Test Criteria</Label>

            {/* Common fields for all fire equipment */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-visionInspection-fire"
                checked={editResultData.visionInspection}
                onCheckedChange={(checked) => setEditResultData((prev: any) => ({ ...prev, visionInspection: !!checked }))}
              />
              <Label htmlFor="edit-visionInspection-fire">Visual Inspection</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-accessibilityCheck-fire"
                checked={editResultData.accessibilityCheck}
                onCheckedChange={(checked) => setEditResultData((prev: any) => ({ ...prev, accessibilityCheck: !!checked }))}
              />
              <Label htmlFor="edit-accessibilityCheck-fire">Accessibility Check</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-signageCheck-fire"
                checked={editResultData.signageCheck}
                onCheckedChange={(checked) => setEditResultData((prev: any) => ({ ...prev, signageCheck: !!checked }))}
              />
              <Label htmlFor="edit-signageCheck-fire">Signage Check</Label>
            </div>

            {/* Fire Extinguisher specific fields */}
            {editResultData.classification === 'fire_extinguisher' && (
              <>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="edit-pressureTest-fire-extinguisher"
                    checked={editResultData.pressureTest}
                    onCheckedChange={(checked) => setEditResultData((prev: any) => ({ ...prev, pressureTest: !!checked }))}
                  />
                  <Label htmlFor="edit-pressureTest-fire-extinguisher">Pressure Gauge Check</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="edit-operationalTest-fire-extinguisher"
                    checked={editResultData.operationalTest}
                    onCheckedChange={(checked) => setEditResultData((prev: any) => ({ ...prev, operationalTest: !!checked }))}
                  />
                  <Label htmlFor="edit-operationalTest-fire-extinguisher">Operational Test</Label>
                </div>
              </>
            )}

            {/* Fire Hose Reel specific fields */}
            {editResultData.classification === 'fire_hose_reel' && (
              <>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="edit-operationalTest-fire-hose"
                    checked={editResultData.operationalTest}
                    onCheckedChange={(checked) => setEditResultData((prev: any) => ({ ...prev, operationalTest: !!checked }))}
                  />
                  <Label htmlFor="edit-operationalTest-fire-hose">Operational Test</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="edit-pressureTest-fire-hose"
                    checked={editResultData.pressureTest}
                    onCheckedChange={(checked) => setEditResultData((prev: any) => ({ ...prev, pressureTest: !!checked }))}
                  />
                  <Label htmlFor="edit-pressureTest-fire-hose">Flow Rate Check</Label>
                </div>
              </>
            )}

            {/* Fire Blanket specific fields */}
            {editResultData.classification === 'fire_blanket' && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-operationalTest-fire-blanket"
                  checked={editResultData.operationalTest}
                  onCheckedChange={(checked) => setEditResultData((prev: any) => ({ ...prev, operationalTest: !!checked }))}
                />
                <Label htmlFor="edit-operationalTest-fire-blanket">Operational Test</Label>
              </div>
            )}

            {/* Fire Extinguisher Equipment Info */}
            {editResultData.classification === 'fire_extinguisher' && (
              <>
                <div>
                  <Label htmlFor="edit-extinguisherType">Fire Extinguisher Type</Label>
                  <Select
                    value={editResultData.extinguisherType || ''}
                    onValueChange={(value) => setEditResultData((prev: any) => ({ ...prev, extinguisherType: value || null }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select extinguisher type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dry_powder">Dry Powder</SelectItem>
                      <SelectItem value="water">Water</SelectItem>
                      <SelectItem value="co2">CO2</SelectItem>
                      <SelectItem value="wet_chemical">Wet Chemical</SelectItem>
                      <SelectItem value="foam">Foam</SelectItem>
                      <SelectItem value="vaporising_liquid">Vaporising Liquid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="edit-size">Net Size</Label>
                  <Input
                    id="edit-size"
                    value={editResultData.size || ''}
                    onChange={(e) => setEditResultData((prev: any) => ({ ...prev, size: e.target.value || null }))}
                    placeholder="e.g., 2.0kg, 9L"
                    className="text-base"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-weight">Gross Weight</Label>
                  <Input
                    id="edit-weight"
                    value={editResultData.weight || ''}
                    onChange={(e) => setEditResultData((prev: any) => ({ ...prev, weight: e.target.value || null }))}
                    placeholder="e.g., 2.5kg"
                    className="text-base"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Electrical (PAT) criteria fields */}
        {serviceType === 'electrical' && (
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-700">Test Criteria</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-visionInspection-pat"
                checked={editResultData.visionInspection}
                onCheckedChange={(checked) => setEditResultData((prev: any) => ({ ...prev, visionInspection: !!checked }))}
              />
              <Label htmlFor="edit-visionInspection-pat">Vision Inspection</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-electricalTest-pat"
                checked={editResultData.electricalTest}
                onCheckedChange={(checked) => setEditResultData((prev: any) => ({ ...prev, electricalTest: !!checked }))}
              />
              <Label htmlFor="edit-electricalTest-pat">Electrical Test</Label>
            </div>
          </div>
        )}

        {/* Microwave Leakage specific field */}
        {serviceType === 'microwave_leakage' && (
          <div>
            <Label htmlFor="edit-leakageReading">Leakage Reading (mW/cm²)</Label>
            <Input
              id="edit-leakageReading"
              type="number"
              step="0.1"
              value={editResultData.leakageReading || ''}
              onChange={(e) => {
                const value = e.target.value;
                setEditResultData((prev: any) => {
                  const newData = { ...prev, leakageReading: value || null };
                  // Auto-update result based on leakage reading
                  if (value && value.trim() !== '') {
                    const reading = parseFloat(value);
                    if (!isNaN(reading)) {
                      newData.result = reading > 5.0 ? 'fail' : 'pass';
                    }
                  }
                  return newData;
                });
              }}
              placeholder="Enter leakage reading (e.g., 0.5)"
              className="text-base"
            />
            <p className="text-xs text-gray-600 mt-1">
              Pass: ≤ 5.0 mW/cm² | Fail: &gt; 5.0 mW/cm²
            </p>
          </div>
        )}

        {/* Hide failure reason and action taken for Microwave Leakage Testing */}
        {editResultData.result === 'fail' && serviceType !== 'microwave_leakage' && (
          <>
            <div>
              <Label htmlFor="edit-failureReason">
                Failure Reason{serviceType === 'rcd_reporting' && ' (Multiple can be selected)'}
              </Label>
              {serviceType === 'rcd_reporting' ? (
                <div className="space-y-2">
                  {editResultData.failureReason && (
                    <div className="flex flex-wrap gap-2">
                      {editResultData.failureReason.split(',').map((reason: string) => (
                        <span key={reason} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                          {getFailureReasonLabel(reason.trim())}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="border rounded-md p-3 space-y-2">
                    {getFailureReasons().map((reason) => {
                      const selectedReasons = editResultData.failureReason?.split(',').map((r: string) => r.trim()) || [];
                      const isChecked = selectedReasons.includes(reason);
                      return (
                        <div key={reason} className="flex items-center space-x-2">
                          <Checkbox
                            id={`reason-${reason}`}
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              const currentReasons = editResultData.failureReason?.split(',').map((r: string) => r.trim()).filter((r: string) => r) || [];
                              let newReasons: string[];
                              if (checked) {
                                newReasons = [...currentReasons, reason];
                              } else {
                                newReasons = currentReasons.filter((r: string) => r !== reason);
                              }
                              setEditResultData((prev: any) => ({
                                ...prev,
                                failureReason: newReasons.length > 0 ? newReasons.join(',') : null
                              }));
                            }}
                          />
                          <Label htmlFor={`reason-${reason}`} className="cursor-pointer">
                            {getFailureReasonLabel(reason)}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <Select
                  value={editResultData.failureReason || ''}
                  onValueChange={(value) => setEditResultData((prev: any) => ({ ...prev, failureReason: value || null }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {getFailureReasons().map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {getFailureReasonLabel(reason)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Action Taken field - only show for electrical and RCD testing, not for emergency exit lights */}
            {serviceType !== 'emergency_exit_light' && (
              <div>
                <Label htmlFor="edit-actionTaken">
                  Action Taken{serviceType === 'rcd_reporting' && ' (Multiple can be selected)'}
                </Label>
                {serviceType === 'rcd_reporting' ? (
                  <div className="space-y-2">
                    {editResultData.actionTaken && (
                      <div className="flex flex-wrap gap-2">
                        {editResultData.actionTaken.split(',').map((action: string) => (
                          <span key={action} className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                            {action.trim() === 'notified' ? 'Site Contact Notified' :
                             action.trim() === 'off_position' ? 'RCD left in off position' :
                             action.trim() === 'given' ? 'Given to Site Contact' :
                             action.trim() === 'removed' ? 'Removed from Site' : action.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="border rounded-md p-3 space-y-2">
                      {[
                        { value: 'notified', label: 'Site Contact Notified' },
                        { value: 'off_position', label: 'RCD left in off position' }
                      ].map((action) => {
                        const selectedActions = editResultData.actionTaken?.split(',').map((a: string) => a.trim()) || [];
                        const isChecked = selectedActions.includes(action.value);
                        return (
                          <div key={action.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`action-${action.value}`}
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                const currentActions = editResultData.actionTaken?.split(',').map((a: string) => a.trim()).filter((a: string) => a) || [];
                                let newActions: string[];
                                if (checked) {
                                  newActions = [...currentActions, action.value];
                                } else {
                                  newActions = currentActions.filter((a: string) => a !== action.value);
                                }
                                setEditResultData((prev: any) => ({
                                  ...prev,
                                  actionTaken: newActions.length > 0 ? newActions.join(',') : null
                                }));
                              }}
                            />
                            <Label htmlFor={`action-${action.value}`} className="cursor-pointer">
                              {action.label}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <Select
                    value={editResultData.actionTaken || ''}
                    onValueChange={(value) => setEditResultData((prev: any) => ({ ...prev, actionTaken: value || null }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="given">Given to Site Contact</SelectItem>
                      <SelectItem value="removed">Removed from Site</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

          </>
        )}

        {/* Notes — always visible for fire testing, emergency exit light and rcd; visible on fail for other services */}
        {(serviceType === 'fire_testing' || serviceType === 'emergency_exit_light' || serviceType === 'rcd_reporting' || serviceType === 'microwave_leakage' || editResultData.result === 'fail') && (
          <div>
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              value={editResultData.notes || ''}
              onChange={(e) => setEditResultData((prev: any) => ({ ...prev, notes: e.target.value || null }))}
              placeholder="Additional notes..."
              className="text-base"
            />
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1 bg-primary"
            onClick={saveWithCurrentTripTimes}
            disabled={isSaving || !!assetNumberError || !editResultData.assetNumber?.trim()}
          >
            {isSaving ? savingLabel : saveLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
