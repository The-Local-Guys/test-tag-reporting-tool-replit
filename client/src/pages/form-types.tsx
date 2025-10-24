import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, FileText, Upload } from 'lucide-react';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import type { CustomFormType } from '@shared/schema';

export default function FormTypes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formToDelete, setFormToDelete] = useState<CustomFormType | null>(null);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [serviceType, setServiceType] = useState<string>('');
  const [csvData, setCsvData] = useState('');
  
  // Type guard for user
  const typedUser = user as { role?: string } | undefined;
  const hasAdminAccess = typedUser && (typedUser.role === 'super_admin' || typedUser.role === 'support_center');
  
  // Redirect non-admins
  if (!hasAdminAccess) {
    navigate('/');
    return null;
  }
  
  // Fetch all custom form types
  const { data: formTypes, isLoading } = useQuery<CustomFormType[]>({
    queryKey: ['/api/custom-forms'],
  });
  
  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; serviceType: string; csvData: string }) => {
      return await apiRequest('POST', '/api/custom-forms', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/custom-forms'] });
      toast({
        title: 'Success',
        description: 'Custom form type created successfully',
      });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create custom form type',
        variant: 'destructive',
      });
    },
  });
  
  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/custom-forms/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/custom-forms'] });
      toast({
        title: 'Success',
        description: 'Custom form type deleted successfully',
      });
      setDeleteDialogOpen(false);
      setFormToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete custom form type',
        variant: 'destructive',
      });
    },
  });
  
  const resetForm = () => {
    setFormName('');
    setServiceType('');
    setCsvData('');
  };
  
  const handleCreate = () => {
    if (!formName || !serviceType || !csvData) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }
    
    createMutation.mutate({ name: formName, serviceType, csvData });
  };
  
  const handleDelete = (formType: CustomFormType) => {
    setFormToDelete(formType);
    setDeleteDialogOpen(true);
  };
  
  const confirmDelete = () => {
    if (formToDelete) {
      deleteMutation.mutate(formToDelete.id);
    }
  };
  
  const getServiceTypeLabel = (type: string) => {
    switch (type) {
      case 'electrical': return 'Electrical Testing';
      case 'emergency_exit_light': return 'Emergency Exit Light';
      case 'fire_testing': return 'Fire Equipment';
      default: return type;
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Custom Form Types</h1>
            <p className="text-sm text-gray-600 mt-1">
              Create and manage custom testing forms that appear in the setup page
            </p>
          </div>
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="flex items-center gap-2"
            data-testid="button-create-form"
          >
            <Plus className="w-4 h-4" />
            Add Form Type
          </Button>
        </div>
        
        {/* Main Content */}
        <Card>
          <CardHeader>
            <CardTitle>Form Types</CardTitle>
            <CardDescription>
              These forms will be available alongside ARA Compliance in the country selection
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : formTypes && formTypes.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Service Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formTypes.map((formType) => (
                    <TableRow key={formType.id} data-testid={`row-form-${formType.id}`}>
                      <TableCell className="font-medium">{formType.name}</TableCell>
                      <TableCell>{getServiceTypeLabel(formType.serviceType)}</TableCell>
                      <TableCell>
                        <Badge variant={formType.isActive ? 'default' : 'secondary'}>
                          {formType.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formType.createdAt ? new Date(formType.createdAt).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(formType)}
                          data-testid={`button-delete-${formType.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 space-y-4">
                <FileText className="w-12 h-12 text-gray-400 mx-auto" />
                <div>
                  <h3 className="text-lg font-medium text-gray-900">No custom form types</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Create your first custom form type to get started
                  </p>
                </div>
                <Button
                  onClick={() => setIsCreateDialogOpen(true)}
                  variant="outline"
                  data-testid="button-create-first"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Form Type
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Custom Form Type</DialogTitle>
            <DialogDescription>
              Upload a CSV file with items for this form type. Format: code,itemName (one per line)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="formName">Form Type Name</Label>
              <Input
                id="formName"
                placeholder="e.g., Custom Client Items"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                data-testid="input-form-name"
              />
              <p className="text-xs text-gray-600">
                This name will appear in the country selection dropdown
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="serviceType">Service Type</Label>
              <Select value={serviceType} onValueChange={setServiceType}>
                <SelectTrigger data-testid="select-service-type">
                  <SelectValue placeholder="Select service type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="electrical">Electrical Testing</SelectItem>
                  <SelectItem value="emergency_exit_light">Emergency Exit Light</SelectItem>
                  <SelectItem value="fire_testing">Fire Equipment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="csvData">CSV Data</Label>
              <Textarea
                id="csvData"
                placeholder="1122,3D Printer&#10;1123,Air Conditioner&#10;1124,Coffee Machine"
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
                rows={10}
                className="font-mono text-sm"
                data-testid="textarea-csv"
              />
              <p className="text-xs text-gray-600">
                Format: code,itemName (one item per line). Example: 1122,3D Printer
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                resetForm();
              }}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              data-testid="button-submit"
            >
              {createMutation.isPending ? (
                'Creating...'
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Create Form Type
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Form Type</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{formToDelete?.name}"? This will also delete all associated items. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setFormToDelete(null);
              }}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
