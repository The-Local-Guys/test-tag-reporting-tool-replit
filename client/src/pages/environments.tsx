import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Environment } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, Edit, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

type Item = {
  type: string;
  name: string;
  icon: string;
  description: string;
  classification?: string;
};

const CLASSIFICATION_OPTIONS = [
  { value: 'class1', label: 'Class 1' },
  { value: 'class2', label: 'Class 2' },
  { value: 'epod', label: 'EPOD' },
  { value: 'rcd', label: 'RCD' },
  { value: '3phase', label: '3 Phase' },
];

// Predefined icon library organized by category - focused on electrical testing
const ICON_LIBRARY = {
  "Power & Electrical": [
    "⚡", "🔌", "🔋", "🪫", "⚙️", "💡", "🔦", "🕯️", "💫", "⚠️",
  ],
  "Tools & Equipment": [
    "🔧", "🔨", "🪛", "🪚", "⛏️", "🪓", "⚒️", "🛠️", "🔩", "🧲",
    "⛓️", "🪝", "🧰", "✂️", "📏",
  ],
  "Computing & Office": [
    "💻", "🖥️", "⌨️", "🖱️", "🖨️", "📱", "☎️", "📠", "📞", "🖇️",
    "📎", "📋", "📁", "🗂️",
  ],
  "Electronics": [
    "📺", "📻", "📡", "🎙️", "🎚️", "🎛️", "📟", "🔊", "🎧", "📷",
    "📹", "🎥", "📽️", "🕹️",
  ],
  "Kitchen Appliances": [
    "☕", "🫖", "🍳", "🧊", "🌡️", "🥘", "🍲", "🥄", "🔪", "🥢",
  ],
  "Home Appliances": [
    "🧹", "🧺", "🪣", "🚿", "🛁", "🚽", "🧴", "🧼", "🪠", "🧯",
    "🪟", "🚪", "🛋️", "🪑",
  ],
  "Heating & Cooling": [
    "🌡️", "❄️", "🔥", "💨", "🌬️", "💧", "☂️", "⛱️",
  ],
  "Safety & Security": [
    "🧯", "⚠️", "🚨", "🔔", "📢", "🔑", "🔒", "🔓", "🛡️", "🚦",
  ],
};

// Icon Picker Component
function IconPicker({ 
  selectedIcon, 
  onSelectIcon 
}: { 
  selectedIcon: string; 
  onSelectIcon: (icon: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [customEmoji, setCustomEmoji] = useState("");
  const { toast } = useToast();

  const handleCustomEmojiSubmit = () => {
    if (customEmoji.trim()) {
      onSelectIcon(customEmoji.trim());
      setCustomEmoji("");
      setIsOpen(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type - only JPG and PNG
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a JPG or PNG image only",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 200KB to account for base64 expansion)
    if (file.size > 200 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload an image smaller than 200KB",
        variant: "destructive",
      });
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64String = e.target?.result as string;
      onSelectIcon(base64String);
      setIsOpen(false);
      // Reset the input
      event.target.value = '';
    };
    reader.onerror = () => {
      toast({
        title: "Upload Failed",
        description: "Failed to read the image file",
        variant: "destructive",
      });
    };
    reader.readAsDataURL(file);
  };

  // Check if icon is a base64 image
  const isBase64Image = selectedIcon?.startsWith('data:image/');

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-10 w-16 p-0 overflow-hidden"
          data-testid="button-select-icon"
        >
          {isBase64Image ? (
            <img 
              src={selectedIcon} 
              alt="Custom icon" 
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-2xl">{selectedIcon || "📦"}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] sm:w-[400px] max-h-[400px] overflow-y-auto p-4" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-sm">Select Icon</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Custom Image Upload */}
          <div className="border-b pb-3">
            <Label htmlFor="custom-image" className="text-xs font-medium text-gray-600 mb-2 block">
              Upload Custom Image
            </Label>
            <div className="space-y-2">
              <Input
                id="custom-image"
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleImageUpload}
                className="text-sm"
                data-testid="input-custom-image"
              />
              <p className="text-xs text-gray-500">Max 200KB • JPG and PNG only</p>
            </div>
          </div>

          {/* Custom Emoji Input */}
          <div className="border-b pb-3">
            <Label htmlFor="custom-emoji" className="text-xs font-medium text-gray-600 mb-2 block">
              Custom Emoji
            </Label>
            <div className="flex gap-2">
              <Input
                id="custom-emoji"
                placeholder="Paste emoji here..."
                value={customEmoji}
                onChange={(e) => setCustomEmoji(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCustomEmojiSubmit();
                  }
                }}
                className="text-xl text-center"
                data-testid="input-custom-emoji"
              />
              <Button
                size="sm"
                onClick={handleCustomEmojiSubmit}
                disabled={!customEmoji.trim()}
                data-testid="button-use-custom-emoji"
              >
                Use
              </Button>
            </div>
          </div>
          
          {Object.entries(ICON_LIBRARY).map(([category, icons]) => (
            <div key={category}>
              <h5 className="text-xs font-medium text-gray-600 mb-2">{category}</h5>
              <div className="grid grid-cols-8 sm:grid-cols-10 gap-1">
                {icons.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => {
                      onSelectIcon(icon);
                      setIsOpen(false);
                    }}
                    className={`
                      h-10 w-10 rounded-md text-xl hover:bg-gray-100 transition-colors
                      flex items-center justify-center
                      ${selectedIcon === icon ? 'bg-blue-100 ring-2 ring-blue-500' : ''}
                    `}
                    data-testid={`icon-option-${icon}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const EMPTY_ITEM: Item = { type: "", name: "", description: "", icon: "📦", classification: "class1" };

/**
 * Add/edit form for a single environment item.
 *
 * One component serves both actions so the two flows are identical - the only
 * difference is the title and the submit label. Mounted only while open and
 * keyed by the item being edited, so its state starts from `initialItem`
 * without needing to sync on every render.
 */
function ItemFormDialog({
  mode,
  initialItem,
  isSaving,
  onSubmit,
  onClose,
}: {
  mode: "add" | "edit";
  initialItem: Item;
  isSaving: boolean;
  onSubmit: (item: Item) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Item>(initialItem);
  const { toast } = useToast();

  const handleSubmit = () => {
    if (!values.name.trim() || !values.type.trim()) {
      toast({
        title: "Error",
        description: "Please fill in item name and type",
        variant: "destructive",
      });
      return;
    }
    onSubmit({ ...values, name: values.name.trim(), type: values.type.trim() });
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Add Item" : "Edit Item"}</DialogTitle>
          <DialogDescription>
            {mode === "add"
              ? "Add an item to this environment. Changes are saved straight away."
              : "Update this item. Changes are saved straight away."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr] gap-3">
            <div className="space-y-2">
              <Label className="text-sm block">Icon</Label>
              <IconPicker
                selectedIcon={values.icon}
                onSelectIcon={(icon) => setValues({ ...values, icon })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-form-name" className="text-sm">Item Name</Label>
              <Input
                id="item-form-name"
                data-testid="input-item-name"
                placeholder="e.g., Drill, Lamp"
                value={values.name}
                onChange={(e) => setValues({ ...values, name: e.target.value })}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-form-type" className="text-sm">Item Type</Label>
              <Input
                id="item-form-type"
                data-testid="input-item-type"
                placeholder="e.g., drill, lamp"
                value={values.type}
                onChange={(e) =>
                  setValues({ ...values, type: e.target.value.toLowerCase().replace(/\s+/g, '-') })
                }
                className="text-sm"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-form-description" className="text-sm block">Description</Label>
            <Input
              id="item-form-description"
              data-testid="input-item-description"
              placeholder="e.g., Power Tool"
              value={values.description}
              onChange={(e) => setValues({ ...values, description: e.target.value })}
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm block">Classification</Label>
            <div className="flex flex-wrap gap-2">
              {CLASSIFICATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setValues({ ...values, classification: opt.value })}
                  data-testid={`classification-${opt.value}`}
                  className={`px-3 py-1.5 rounded-md border-2 text-sm font-medium transition-all ${
                    values.classification === opt.value
                      ? 'border-primary bg-primary text-white'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving} data-testid="button-cancel-item">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving} data-testid="button-save-item">
            {isSaving ? "Saving..." : mode === "add" ? "Add Item" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Environments() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  // Environments are only for electrical testing
  const selectedTab = "electrical";
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDetailsDialogOpen, setIsEditDetailsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [environmentToDelete, setEnvironmentToDelete] = useState<{ id: number; name: string } | null>(null);
  const [environmentDetailsToEdit, setEnvironmentDetailsToEdit] = useState<{
    id: number;
    name: string;
    description: string;
  } | null>(null);
  const [newEnvironment, setNewEnvironment] = useState({
    name: "",
    description: "",
  });
  // Which item the form dialog is open for. A null index means "adding a new item".
  const [itemDialog, setItemDialog] = useState<{ envId: number; index: number | null } | null>(null);


  // Fetch environments
  const { data: environments, isLoading } = useQuery<Environment[]>({
    queryKey: ["/api/environments"],
  });

  // Create environment mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string | null; serviceType: string }) => {
      return await apiRequest("POST", "/api/environments", { ...data, items: [] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/environments"] });
      setIsCreateDialogOpen(false);
      setNewEnvironment({ name: "", description: "" });
      toast({
        title: "Success",
        description: "Environment created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create environment",
        variant: "destructive",
      });
    },
  });

  // Environment metadata uses its own additive endpoint so legacy mobile updates stay unchanged.
  const updateDetailsMutation = useMutation({
    mutationFn: async (data: { id: number; name: string; description: string | null }) => {
      return await apiRequest("PATCH", `/api/environments/${data.id}/details`, {
        name: data.name,
        description: data.description,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/environments"] });
      setIsEditDetailsDialogOpen(false);
      setEnvironmentDetailsToEdit(null);
      toast({
        title: "Success",
        description: "Environment details updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update environment details",
        variant: "destructive",
      });
    },
  });

  // Items are saved as soon as they change - there is no separate commit step
  const saveItemsMutation = useMutation({
    mutationFn: async ({ id, items }: { id: number; items: Item[] }) => {
      return await apiRequest("PATCH", `/api/environments/${id}`, { items });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/environments"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save changes",
        variant: "destructive",
      });
    },
  });

  // Delete environment mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/environments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/environments"] });
      toast({
        title: "Success",
        description: "Environment deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete environment",
        variant: "destructive",
      });
    },
  });

  const handleCreateEnvironment = () => {
    if (!newEnvironment.name.trim()) {
      toast({
        title: "Error",
        description: "Please enter an environment name",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate({
      name: newEnvironment.name.trim(),
      description: newEnvironment.description.trim() || null,
      serviceType: selectedTab,
    });
  };

  const handleOpenEditDetails = (env: Environment) => {
    setEnvironmentDetailsToEdit({
      id: env.id,
      name: env.name,
      description: env.description ?? "",
    });
    setIsEditDetailsDialogOpen(true);
  };

  const handleSaveEnvironmentDetails = () => {
    if (!environmentDetailsToEdit?.name.trim()) {
      toast({
        title: "Error",
        description: "Please enter an environment name",
        variant: "destructive",
      });
      return;
    }

    updateDetailsMutation.mutate({
      id: environmentDetailsToEdit.id,
      name: environmentDetailsToEdit.name.trim(),
      description: environmentDetailsToEdit.description.trim() || null,
    });
  };

  /** Items of an environment, guarded against the jsonb column holding anything else. */
  const itemsOf = (env: Environment): Item[] => (Array.isArray(env.items) ? (env.items as Item[]) : []);

  const environmentBeingEdited = itemDialog
    ? environments?.find((env) => env.id === itemDialog.envId)
    : undefined;

  const itemBeingEdited =
    environmentBeingEdited && itemDialog?.index !== null && itemDialog !== null
      ? itemsOf(environmentBeingEdited)[itemDialog.index]
      : undefined;

  /** Writes the whole items array back, which is what the endpoint expects. */
  const handleSubmitItem = async (values: Item) => {
    if (!itemDialog || !environmentBeingEdited) return;

    const items = itemsOf(environmentBeingEdited);
    const updatedItems =
      itemDialog.index === null
        ? [...items, values]
        : items.map((item, i) => (i === itemDialog.index ? values : item));

    try {
      await saveItemsMutation.mutateAsync({ id: itemDialog.envId, items: updatedItems });
      setItemDialog(null);
      toast({
        title: "Success",
        description: itemDialog.index === null ? "Item added" : "Item updated",
      });
    } catch {
      // The dialog stays open with the entered values so the save can be retried
    }
  };

  const handleRemoveItem = async (env: Environment, index: number) => {
    const updatedItems = itemsOf(env).filter((_, i) => i !== index);

    try {
      await saveItemsMutation.mutateAsync({ id: env.id, items: updatedItems });
      toast({ title: "Success", description: "Item removed" });
    } catch {
      // The error toast comes from the mutation, and the list is still the server's
    }
  };

  const getServiceTypeLabel = (serviceType: string) => {
    // Environments are only for electrical testing
    return "Electrical Testing";
  };
  
  // Type guard for user object
  const typedUser = user as { fullName?: string; role?: string } | undefined;
  
  // Redirect non-technician users
  useEffect(() => {
    if (user && typedUser?.role !== 'technician') {
      toast({
        title: "Access Denied",
        description: "Environments are only available for technician accounts",
        variant: "destructive",
      });
      setLocation('/');
    }
  }, [user, typedUser?.role, setLocation, toast]);
  
  // Don't render anything if not a technician
  if (!user || typedUser?.role !== 'technician') {
    return null;
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading environments...</div>
      </div>
    );
  }

  // Filter environments by selected tab
  const filteredEnvironments = environments?.filter(env => env.serviceType === selectedTab) || [];

  return (
    <div className="container mx-auto px-4 py-4 sm:py-8">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Environments</h1>
        <p className="text-sm sm:text-base text-gray-600">Manage your custom item sets for different testing types</p>
      </div>

      {/* Header - Environments are only for Electrical Testing */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center">
          <div className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full font-medium text-sm">
            Electrical Testing Only
          </div>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto" data-testid="button-create-environment">
              <Plus className="w-4 h-4 mr-2" />
              Create Environment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Environment</DialogTitle>
              <DialogDescription>
                Create a custom environment for {getServiceTypeLabel(selectedTab)}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="env-name">Environment Name</Label>
                <Input
                  id="env-name"
                  data-testid="input-environment-name"
                  placeholder="e.g., Office Equipment, Workshop Tools"
                  value={newEnvironment.name}
                  maxLength={120}
                  onChange={(e) =>
                    setNewEnvironment({ ...newEnvironment, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="env-description">Description</Label>
                <Textarea
                  id="env-description"
                  data-testid="input-environment-description"
                  placeholder="e.g., Equipment commonly tested in office areas"
                  value={newEnvironment.description}
                  maxLength={500}
                  onChange={(e) =>
                    setNewEnvironment({ ...newEnvironment, description: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                data-testid="button-cancel-create"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateEnvironment}
                disabled={createMutation.isPending}
                data-testid="button-submit-create"
              >
                {createMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!filteredEnvironments || filteredEnvironments.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-500">
              <p className="text-lg mb-2">No environments for {getServiceTypeLabel(selectedTab)}</p>
              <p className="text-sm">Create your first environment to get started</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {filteredEnvironments.map((env) => {
            const items = itemsOf(env);
            return (
            <Card key={env.id} data-testid={`card-environment-${env.id}`}>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                  <div>
                    <CardTitle className="text-lg sm:text-xl">{env.name}</CardTitle>
                    <CardDescription className="text-sm">{getServiceTypeLabel(env.serviceType)}</CardDescription>
                    {env.description && (
                      <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">{env.description}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => setItemDialog({ envId: env.id, index: null })}
                      data-testid={`button-add-item-${env.id}`}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Item
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEditDetails(env)}
                      data-testid={`button-edit-details-${env.id}`}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit Details
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setEnvironmentToDelete({ id: env.id, name: env.name });
                        setIsDeleteDialogOpen(true);
                      }}
                      data-testid={`button-delete-${env.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <div className="text-center border border-dashed rounded-lg py-8">
                    <p className="text-gray-500 text-sm mb-3">No items in this environment yet</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setItemDialog({ envId: env.id, index: null })}
                      data-testid={`button-add-first-item-${env.id}`}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add your first item
                    </Button>
                  </div>
                ) : (
                  <>
                    <h4 className="font-semibold text-sm mb-3">Items ({items.length})</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {items.map((item, index) => {
                        const isBase64Image = item.icon?.startsWith('data:image/');
                        return (
                          <div
                            key={index}
                            data-testid={`item-${index}`}
                            className="flex items-start justify-between gap-2 border rounded-lg p-3 bg-white"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="shrink-0 overflow-hidden">
                                {isBase64Image ? (
                                  <img src={item.icon} alt="Custom icon" className="w-8 h-8 object-cover rounded" />
                                ) : (
                                  <span className="text-2xl leading-none">{item.icon || "📦"}</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-sm break-words">{item.name}</div>
                                {item.description && (
                                  <div className="text-xs text-gray-500 break-words">{item.description}</div>
                                )}
                                {item.classification && (
                                  <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                                    {CLASSIFICATION_OPTIONS.find(o => o.value === item.classification)?.label ?? item.classification}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setItemDialog({ envId: env.id, index })}
                                disabled={saveItemsMutation.isPending}
                                data-testid={`button-edit-item-${index}`}
                              >
                                <Edit className="w-4 h-4 text-blue-500" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    data-testid={`button-remove-item-${index}`}
                                    disabled={saveItemsMutation.isPending}
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove Item?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Remove {item.name} from this environment?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleRemoveItem(env, index)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Remove
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      {/* Keyed so each add/edit starts from the right values without syncing state */}
      {itemDialog && (
        <ItemFormDialog
          key={`${itemDialog.envId}-${itemDialog.index ?? "new"}`}
          mode={itemDialog.index === null ? "add" : "edit"}
          initialItem={itemBeingEdited ?? EMPTY_ITEM}
          isSaving={saveItemsMutation.isPending}
          onSubmit={handleSubmitItem}
          onClose={() => setItemDialog(null)}
        />
      )}

      <Dialog
        open={isEditDetailsDialogOpen}
        onOpenChange={(open) => {
          setIsEditDetailsDialogOpen(open);
          if (!open) setEnvironmentDetailsToEdit(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Environment Details</DialogTitle>
            <DialogDescription>
              Update the environment name and description. Existing reports will not be changed.
            </DialogDescription>
          </DialogHeader>
          {environmentDetailsToEdit && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-env-name">Environment Name</Label>
                <Input
                  id="edit-env-name"
                  data-testid="input-edit-environment-name"
                  value={environmentDetailsToEdit.name}
                  maxLength={120}
                  onChange={(e) =>
                    setEnvironmentDetailsToEdit({
                      ...environmentDetailsToEdit,
                      name: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-env-description">Description</Label>
                <Textarea
                  id="edit-env-description"
                  data-testid="input-edit-environment-description"
                  placeholder="Add a short description"
                  value={environmentDetailsToEdit.description}
                  maxLength={500}
                  onChange={(e) =>
                    setEnvironmentDetailsToEdit({
                      ...environmentDetailsToEdit,
                      description: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDetailsDialogOpen(false)}
              disabled={updateDetailsMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEnvironmentDetails}
              disabled={updateDetailsMutation.isPending}
              data-testid="button-save-environment-details"
            >
              {updateDetailsMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Environment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{environmentToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setEnvironmentToDelete(null);
              }}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (environmentToDelete) {
                  deleteMutation.mutate(environmentToDelete.id);
                  setIsDeleteDialogOpen(false);
                  setEnvironmentToDelete(null);
                }
              }}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
