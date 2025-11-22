import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Certificate } from "@shared/schema";

interface CertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  certificate?: Certificate;
}

export function CertificateModal({ isOpen, onClose, onSubmit, certificate }: CertificateModalProps) {
  const { user } = useAuth();
  const isEditMode = !!certificate;

  const [formData, setFormData] = useState({
    clientName: "",
    address: "",
    certificationDate: new Date().toISOString().split('T')[0],
    technicianName: (user as any)?.fullName || "",
    technicianLicense: "",
  });

  const [selectedServices, setSelectedServices] = useState<Record<string, boolean>>({
    electrical: false,
    emergency_exit_light: false,
    fire_testing: false,
    rcd_reporting: false,
    microwave_leakage: false,
  });

  const [validityPeriods, setValidityPeriods] = useState<Record<string, number>>({
    electrical: 12,
    emergency_exit_light: 12,
    fire_testing: 12,
    rcd_reporting: 12,
    microwave_leakage: 12,
  });

  // Pre-populate form when editing
  useEffect(() => {
    if (certificate) {
      setFormData({
        clientName: certificate.clientName,
        address: certificate.address,
        certificationDate: certificate.certificationDate,
        technicianName: certificate.technicianName,
        technicianLicense: certificate.technicianLicense || "",
      });

      // Set selected services
      const services = certificate.services as string[];
      const servicesMap: Record<string, boolean> = {
        electrical: false,
        emergency_exit_light: false,
        fire_testing: false,
        rcd_reporting: false,
        microwave_leakage: false,
      };
      services.forEach((service) => {
        servicesMap[service] = true;
      });
      setSelectedServices(servicesMap);

      // Set validity periods from existing certificate
      if (certificate.validityDates) {
        const periods: Record<string, number> = { ...validityPeriods };
        services.forEach((service) => {
          const validityDate = (certificate.validityDates as any)[service];
          if (validityDate) {
            // Calculate months between certification date and validity date
            const certDate = new Date(certificate.certificationDate);
            const validDate = new Date(validityDate);
            const months = Math.round((validDate.getTime() - certDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
            periods[service] = months;
          }
        });
        setValidityPeriods(periods);
      }
    }
  }, [certificate]);

  // Fetch all test sessions to get unique clients
  const { data: sessions } = useQuery({
    queryKey: ["/api/admin/sessions"],
  });

  // Extract unique clients from sessions (filter out empty names)
  const uniqueClients = Array.from(
    new Map(
      (sessions as any[] || [])
        .filter((s: any) => s.clientName && s.clientName.trim())
        .map((s: any) => [
          s.clientName,
          { name: s.clientName, address: s.address }
        ])
    ).values()
  );

  const handleClientSelect = (clientName: string) => {
    const client = uniqueClients.find((c: any) => c.name === clientName);
    if (client) {
      setFormData({
        ...formData,
        clientName: client.name,
        address: client.address,
      });
    }
  };

  const handleServiceToggle = (service: string) => {
    setSelectedServices({
      ...selectedServices,
      [service]: !selectedServices[service],
    });
  };

  const calculateValidityDate = (serviceType: string, baseDate: string): string => {
    const date = new Date(baseDate);
    // Use the selected validity period for this service
    const months = validityPeriods[serviceType] || 12;
    date.setMonth(date.getMonth() + months);
    return date.toISOString().split('T')[0];
  };

  const handleValidityPeriodChange = (service: string, months: string) => {
    setValidityPeriods({
      ...validityPeriods,
      [service]: parseInt(months),
    });
  };

  const handleSubmit = () => {
    // Build services array and validity dates object
    const services = Object.keys(selectedServices).filter(
      (key) => selectedServices[key]
    );

    const validityDates: Record<string, string> = {};
    services.forEach((service) => {
      validityDates[service] = calculateValidityDate(service, formData.certificationDate);
    });

    const certificateData = {
      ...formData,
      services,
      validityDates,
    };

    onSubmit(certificateData);
    // Don't close modal here - parent component will close it after mutation succeeds
  };

  const isValid = 
    formData.clientName &&
    formData.address &&
    Object.values(selectedServices).some(v => v);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? "Edit Certificate of Compliance" : "Create Certificate of Compliance"}
    >
      <div className="space-y-4">
        {/* Client Selection - only show in create mode */}
        {!isEditMode && (
          <div>
            <Label htmlFor="client-select">Select Client</Label>
            <Select onValueChange={handleClientSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Choose from existing clients..." />
              </SelectTrigger>
              <SelectContent>
                {uniqueClients.map((client: any) => (
                  <SelectItem key={client.name} value={client.name}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Manual Client Entry */}
        <div>
          <Label htmlFor="clientName">Client Name</Label>
          <Input
            id="clientName"
            value={formData.clientName}
            onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
            placeholder="Enter client name"
          />
        </div>

        <div>
          <Label htmlFor="address">Address</Label>
          <Textarea
            id="address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="Enter address (e.g., Street, Area, City)"
            rows={3}
            className="resize-none"
          />
        </div>

        {/* Services Selection with Validity Periods */}
        <div>
          <Label>Services Completed</Label>
          <div className="space-y-3 mt-2">
            {/* Electrical Service */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="electrical"
                  checked={selectedServices.electrical}
                  onCheckedChange={() => handleServiceToggle('electrical')}
                />
                <label htmlFor="electrical" className="text-sm font-medium">
                  Electrical Appliance Test & Tag
                </label>
              </div>
              {selectedServices.electrical && (
                <div className="ml-6">
                  <Label htmlFor="electrical-validity" className="text-xs text-gray-600">Valid for</Label>
                  <Select 
                    value={validityPeriods.electrical.toString()} 
                    onValueChange={(value) => handleValidityPeriodChange('electrical', value)}
                  >
                    <SelectTrigger id="electrical-validity" className="w-40" data-testid="select-electrical-validity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1" data-testid="electrical-validity-1">1 month</SelectItem>
                      <SelectItem value="3" data-testid="electrical-validity-3">3 months</SelectItem>
                      <SelectItem value="6" data-testid="electrical-validity-6">6 months</SelectItem>
                      <SelectItem value="12" data-testid="electrical-validity-12">12 months</SelectItem>
                      <SelectItem value="24" data-testid="electrical-validity-24">24 months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Emergency Exit Light Service */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="emergency"
                  checked={selectedServices.emergency_exit_light}
                  onCheckedChange={() => handleServiceToggle('emergency_exit_light')}
                />
                <label htmlFor="emergency" className="text-sm font-medium">
                  Emergency Exit Light Testing
                </label>
              </div>
              {selectedServices.emergency_exit_light && (
                <div className="ml-6">
                  <Label htmlFor="emergency-validity" className="text-xs text-gray-600">Valid for</Label>
                  <Select 
                    value={validityPeriods.emergency_exit_light.toString()} 
                    onValueChange={(value) => handleValidityPeriodChange('emergency_exit_light', value)}
                  >
                    <SelectTrigger id="emergency-validity" className="w-40" data-testid="select-emergency-validity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1" data-testid="emergency-validity-1">1 month</SelectItem>
                      <SelectItem value="3" data-testid="emergency-validity-3">3 months</SelectItem>
                      <SelectItem value="6" data-testid="emergency-validity-6">6 months</SelectItem>
                      <SelectItem value="12" data-testid="emergency-validity-12">12 months</SelectItem>
                      <SelectItem value="24" data-testid="emergency-validity-24">24 months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Fire Testing Service */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="fire"
                  checked={selectedServices.fire_testing}
                  onCheckedChange={() => handleServiceToggle('fire_testing')}
                />
                <label htmlFor="fire" className="text-sm font-medium">
                  Fire Equipment Maintenance
                </label>
              </div>
              {selectedServices.fire_testing && (
                <div className="ml-6">
                  <Label htmlFor="fire-validity" className="text-xs text-gray-600">Valid for</Label>
                  <Select 
                    value={validityPeriods.fire_testing.toString()} 
                    onValueChange={(value) => handleValidityPeriodChange('fire_testing', value)}
                  >
                    <SelectTrigger id="fire-validity" className="w-40" data-testid="select-fire-validity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1" data-testid="fire-validity-1">1 month</SelectItem>
                      <SelectItem value="3" data-testid="fire-validity-3">3 months</SelectItem>
                      <SelectItem value="6" data-testid="fire-validity-6">6 months</SelectItem>
                      <SelectItem value="12" data-testid="fire-validity-12">12 months</SelectItem>
                      <SelectItem value="24" data-testid="fire-validity-24">24 months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* RCD Service */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rcd"
                  checked={selectedServices.rcd_reporting}
                  onCheckedChange={() => handleServiceToggle('rcd_reporting')}
                />
                <label htmlFor="rcd" className="text-sm font-medium">
                  RCD Testing
                </label>
              </div>
              {selectedServices.rcd_reporting && (
                <div className="ml-6">
                  <Label htmlFor="rcd-validity" className="text-xs text-gray-600">Valid for</Label>
                  <Select 
                    value={validityPeriods.rcd_reporting.toString()} 
                    onValueChange={(value) => handleValidityPeriodChange('rcd_reporting', value)}
                  >
                    <SelectTrigger id="rcd-validity" className="w-40" data-testid="select-rcd-validity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1" data-testid="rcd-validity-1">1 month</SelectItem>
                      <SelectItem value="3" data-testid="rcd-validity-3">3 months</SelectItem>
                      <SelectItem value="6" data-testid="rcd-validity-6">6 months</SelectItem>
                      <SelectItem value="12" data-testid="rcd-validity-12">12 months</SelectItem>
                      <SelectItem value="24" data-testid="rcd-validity-24">24 months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Microwave Leakage Service */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="microwave"
                  checked={selectedServices.microwave_leakage}
                  onCheckedChange={() => handleServiceToggle('microwave_leakage')}
                />
                <label htmlFor="microwave" className="text-sm font-medium">
                  Microwave Leakage Testing
                </label>
              </div>
              {selectedServices.microwave_leakage && (
                <div className="ml-6">
                  <Label htmlFor="microwave-validity" className="text-xs text-gray-600">Valid for</Label>
                  <Select 
                    value={validityPeriods.microwave_leakage.toString()} 
                    onValueChange={(value) => handleValidityPeriodChange('microwave_leakage', value)}
                  >
                    <SelectTrigger id="microwave-validity" className="w-40" data-testid="select-microwave-validity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1" data-testid="microwave-validity-1">1 month</SelectItem>
                      <SelectItem value="3" data-testid="microwave-validity-3">3 months</SelectItem>
                      <SelectItem value="6" data-testid="microwave-validity-6">6 months</SelectItem>
                      <SelectItem value="12" data-testid="microwave-validity-12">12 months</SelectItem>
                      <SelectItem value="24" data-testid="microwave-validity-24">24 months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Certification Date */}
        <div>
          <Label htmlFor="certificationDate">Certification Date</Label>
          <Input
            id="certificationDate"
            type="date"
            value={formData.certificationDate}
            onChange={(e) => setFormData({ ...formData, certificationDate: e.target.value })}
          />
        </div>

        {/* Technician Info */}
        <div>
          <Label htmlFor="technicianName">Technician Name</Label>
          <Input
            id="technicianName"
            value={formData.technicianName}
            onChange={(e) => setFormData({ ...formData, technicianName: e.target.value })}
            placeholder="Technician name"
          />
        </div>

        <div>
          <Label htmlFor="technicianLicense">Technician License (Optional)</Label>
          <Input
            id="technicianLicense"
            value={formData.technicianLicense}
            onChange={(e) => setFormData({ ...formData, technicianLicense: e.target.value })}
            placeholder="License number"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            {isEditMode ? "Update Certificate" : "Create Certificate"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
