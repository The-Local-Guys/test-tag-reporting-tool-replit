import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Eye, FileSpreadsheet, FileText, ListChecks, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { DataTableFrame, RowAction, SectionPanel, StatTile } from '@/components/admin-v2/admin-ui';
import { ConfirmDeleteDialog } from '@/features/admin/components/ConfirmDeleteDialog';
import type { CustomFormType } from '@shared/schema';

type FormItem = { code: string; itemName: string };

/** Items previewed in the upload dialog before "and N more". */
const PREVIEW_ITEM_COUNT = 5;

/** Parses code,itemName lines the same way GET /api/custom-forms/:id/items does. */
function parseCsvItems(csvData: string): FormItem[] {
  const lines = csvData.trim().split('\n');
  const startIndex = lines[0] && lines[0].toLowerCase().includes('code') ? 1 : 0;
  const items: FormItem[] = [];
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',').map((part) => part.trim());
    if (parts.length >= 2) {
      items.push({ code: parts[0], itemName: parts.slice(1).join(',') });
    }
  }
  return items;
}

function formatDate(value: string | Date | null): string {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ItemList({ items }: { items: FormItem[] }) {
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((item, index) => (
        <li key={`${item.code}-${index}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
          <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-600">
            {item.code}
          </span>
          <span className="min-w-0 truncate text-slate-700">{item.itemName}</span>
        </li>
      ))}
    </ul>
  );
}

/** Redesigned custom form types page (/form-types/v2). Same behaviour as /form-types, refreshed layout. */
export default function FormTypesV2() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formToDelete, setFormToDelete] = useState<CustomFormType | null>(null);
  const [formToView, setFormToView] = useState<CustomFormType | null>(null);
  const [search, setSearch] = useState('');

  // Form state
  const [formName, setFormName] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const typedUser = user as { role?: string } | undefined;
  const hasAdminAccess = !!typedUser && (typedUser.role === 'super_admin' || typedUser.role === 'support_center');

  // Redirect non-admins
  useEffect(() => {
    if (!hasAdminAccess) navigate('/');
  }, [hasAdminAccess, navigate]);

  const { data: formTypes, isLoading } = useQuery<CustomFormType[]>({
    queryKey: ['/api/custom-forms'],
    enabled: hasAdminAccess,
  });

  const formsWithItems = useMemo(
    () => (formTypes ?? []).map((formType) => ({ formType, items: parseCsvItems(formType.csvData) })),
    [formTypes],
  );
  const filteredForms = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return formsWithItems;
    return formsWithItems.filter(({ formType }) => formType.name.toLowerCase().includes(term));
  }, [formsWithItems, search]);

  const totalItems = formsWithItems.reduce((sum, { items }) => sum + items.length, 0);
  const latestForm = formsWithItems.reduce<CustomFormType | null>((latest, { formType }) => {
    if (!formType.createdAt) return latest;
    if (!latest?.createdAt || new Date(formType.createdAt) > new Date(latest.createdAt)) return formType;
    return latest;
  }, null);

  const csvItems = useMemo(() => (csvData ? parseCsvItems(csvData) : []), [csvData]);
  const viewItems = useMemo(() => (formToView ? parseCsvItems(formToView.csvData) : []), [formToView]);

  const resetForm = () => {
    setFormName('');
    setCsvFile(null);
    setCsvData('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const closeCreateDialog = () => {
    setIsCreateDialogOpen(false);
    resetForm();
  };

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; csvData: string }) => {
      return await apiRequest('POST', '/api/custom-forms', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/custom-forms'] });
      toast({
        title: 'Success',
        description: 'Custom form type created successfully',
      });
      closeCreateDialog();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create custom form type',
        variant: 'destructive',
      });
    },
  });

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
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete custom form type',
        variant: 'destructive',
      });
    },
  });

  if (!hasAdminAccess) return null;

  const loadFile = (file: File | undefined) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: 'Invalid File',
        description: 'Please upload a CSV file',
        variant: 'destructive',
      });
      return;
    }

    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvData(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  const clearFile = () => {
    setCsvFile(null);
    setCsvData('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreate = () => {
    if (!formName.trim() || !csvData) {
      toast({
        title: 'Validation Error',
        description: 'Please provide form name and upload a CSV file',
        variant: 'destructive',
      });
      return;
    }
    if (csvItems.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'No items found. Each line should be: code,itemName',
        variant: 'destructive',
      });
      return;
    }

    createMutation.mutate({ name: formName.trim(), csvData });
  };

  const openCreateDialog = () => setIsCreateDialogOpen(true);

  return (
    <div className="-mt-6 min-h-screen bg-slate-50 px-4 pb-12 pt-6 font-['Inter',ui-sans-serif,system-ui,sans-serif] text-slate-900 antialiased sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">Custom Form Types</h1>
              <p className="text-sm text-slate-500">Create and manage custom testing forms that appear in the setup page</p>
            </div>
          </div>
          <Button
            onClick={openCreateDialog}
            className="h-10 gap-2 rounded-lg bg-blue-600 shadow-sm hover:bg-blue-700"
            data-testid="button-create-form"
          >
            <Plus className="h-4 w-4" />
            Add Form Type
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <StatTile label="Form types" value={isLoading ? '—' : formsWithItems.length} icon={FileText} accent="blue" />
          <StatTile label="Total items" value={isLoading ? '—' : totalItems} icon={ListChecks} accent="violet" />
          <div className="col-span-2 min-w-0 sm:col-span-1">
            <StatTile
              label="Latest added"
              value={<span className="block truncate text-lg sm:text-xl">{latestForm?.name ?? '—'}</span>}
              icon={Calendar}
              accent="emerald"
              hint={latestForm ? formatDate(latestForm.createdAt) : 'No forms yet'}
            />
          </div>
        </div>

        {/* Form types */}
        <SectionPanel
          title="Form Types"
          count={formTypes ? formTypes.length : undefined}
          description="These forms will be available alongside ARA Compliance in the country selection"
          actions={
            formsWithItems.length > 0 && (
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search form types"
                  className="h-9 rounded-lg border-slate-200 pl-9 shadow-none"
                  data-testid="input-search-forms"
                />
              </div>
            )
          }
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-3 py-12 text-sm text-slate-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              Loading form types...
            </div>
          ) : formsWithItems.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-400 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">No custom form types</h3>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                Upload a CSV of item codes and names to create your first custom form type
              </p>
              <Button
                onClick={openCreateDialog}
                variant="outline"
                className="mt-5 gap-2 rounded-lg border-slate-200"
                data-testid="button-create-first"
              >
                <Plus className="h-4 w-4" />
                Create Form Type
              </Button>
            </div>
          ) : filteredForms.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">No form types match "{search}"</div>
          ) : (
            <DataTableFrame>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredForms.map(({ formType, items }) => (
                    <TableRow key={formType.id} data-testid={`row-form-${formType.id}`}>
                      <TableCell data-label="Name" data-span="full">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                            <FileSpreadsheet className="h-4 w-4" />
                          </div>
                          <span className="font-medium text-slate-900">{formType.name}</span>
                        </div>
                      </TableCell>
                      <TableCell data-label="Items">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">
                          {items.length} item{items.length !== 1 ? 's' : ''}
                        </span>
                      </TableCell>
                      <TableCell data-label="Created" className="tabular-nums text-slate-600">
                        {formatDate(formType.createdAt)}
                      </TableCell>
                      <TableCell data-actions className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <RowAction
                            icon={Eye}
                            title="View items"
                            tone="blue"
                            onClick={() => setFormToView(formType)}
                            testId={`button-view-${formType.id}`}
                          />
                          <RowAction
                            icon={Trash2}
                            title="Delete form type"
                            tone="red"
                            onClick={() => setFormToDelete(formType)}
                            testId={`button-delete-${formType.id}`}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataTableFrame>
          )}
        </SectionPanel>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => (open ? setIsCreateDialogOpen(true) : closeCreateDialog())}>
        <DialogContent className="max-w-xl gap-0 overflow-hidden rounded-2xl p-0">
          <DialogHeader className="border-b border-slate-100 px-6 py-5 text-left">
            <DialogTitle className="text-lg font-semibold tracking-tight">Create Custom Form Type</DialogTitle>
            <DialogDescription className="text-slate-500">
              Upload a CSV file with the items for this form type
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[65vh] space-y-5 overflow-y-auto px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="formName" className="text-sm font-medium text-slate-700">Form Type Name</Label>
              <Input
                id="formName"
                placeholder="e.g., Custom Client Items"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="h-10 rounded-lg border-slate-200"
                data-testid="input-form-name"
              />
              <p className="text-xs text-slate-500">This name will appear in the country selection dropdown</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="csvFile" className="text-sm font-medium text-slate-700">CSV File</Label>
              <input
                ref={fileInputRef}
                id="csvFile"
                type="file"
                accept=".csv"
                onChange={(e) => loadFile(e.target.files?.[0])}
                className="sr-only"
                data-testid="input-csv-file"
              />
              {csvFile ? (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3 bg-slate-50/70 px-4 py-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                      <FileSpreadsheet className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-900">{csvFile.name}</div>
                      <div className={cn('text-xs', csvItems.length > 0 ? 'text-slate-500' : 'text-red-600')}>
                        {csvItems.length > 0
                          ? `${csvItems.length} item${csvItems.length !== 1 ? 's' : ''} found`
                          : 'No items found. Each line should be: code,itemName'}
                      </div>
                    </div>
                    <RowAction icon={X} title="Remove file" tone="red" onClick={clearFile} testId="button-remove-file" />
                  </div>
                  {csvItems.length > 0 && (
                    <div className="border-t border-slate-100">
                      <ItemList items={csvItems.slice(0, PREVIEW_ITEM_COUNT)} />
                      {csvItems.length > PREVIEW_ITEM_COUNT && (
                        <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
                          and {csvItems.length - PREVIEW_ITEM_COUNT} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <label
                  htmlFor="csvFile"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    loadFile(e.dataTransfer.files?.[0]);
                  }}
                  className={cn(
                    'flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors',
                    isDragging ? 'border-blue-400 bg-blue-50/60' : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50',
                  )}
                  data-testid="dropzone-csv"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-blue-600 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div className="mt-3 text-sm font-medium text-slate-900">
                    Drop a CSV here or <span className="text-blue-600">browse</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">One item per line</div>
                </label>
              )}
              <div className="rounded-lg bg-slate-50 px-3 py-2.5">
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Expected format</div>
                <pre className="mt-1 font-mono text-xs leading-relaxed text-slate-600">{'code,itemName\nKTL01,Kettle\nTST02,Toaster'}</pre>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 border-t border-slate-100 bg-slate-50/50 px-6 py-4 sm:space-x-0">
            <Button
              variant="outline"
              onClick={closeCreateDialog}
              className="rounded-lg border-slate-200"
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="gap-2 rounded-lg bg-blue-600 hover:bg-blue-700"
              data-testid="button-submit"
            >
              {createMutation.isPending ? (
                'Creating...'
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Create Form Type
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Items Dialog */}
      <Dialog open={formToView !== null} onOpenChange={(open) => !open && setFormToView(null)}>
        <DialogContent className="max-w-lg gap-0 overflow-hidden rounded-2xl p-0">
          <DialogHeader className="border-b border-slate-100 px-6 py-5 text-left">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              {formToView?.name}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">
                {viewItems.length}
              </span>
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              Items technicians see when they select this form type
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto [&_li]:px-6">
            {viewItems.length > 0 ? (
              <ItemList items={viewItems} />
            ) : (
              <div className="py-10 text-center text-sm text-slate-500">This form type has no items</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={formToDelete !== null}
        onCancel={() => setFormToDelete(null)}
        onConfirm={() => {
          if (formToDelete) deleteMutation.mutate(formToDelete.id);
          setFormToDelete(null);
        }}
        title="Delete form type?"
        description={`"${formToDelete?.name}" and all of its items will be deleted. This action cannot be undone.`}
      />
    </div>
  );
}
