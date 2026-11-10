import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SERVICE_TYPE_FILTER_OPTIONS } from "../utils";

/** Options for a "Filter by Service Type" select, including "All Service Types". */
export function ServiceTypeSelectContent() {
  return (
    <SelectContent>
      <SelectItem value="all">All Service Types</SelectItem>
      {SERVICE_TYPE_FILTER_OPTIONS.map((option) => (
        <SelectItem key={option.value} value={option.value}>
          {option.label}
        </SelectItem>
      ))}
    </SelectContent>
  );
}

/** Searchable technician picker; `value` is a technician name or "all". */
export function TechnicianFilterCombobox({
  value,
  onChange,
  technicians,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  technicians: string[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const select = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between font-normal", className)}
        >
          {value === "all" ? "All Technicians" : value}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Search technician..." />
          <CommandList>
            <CommandEmpty>No technician found.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="all" onSelect={() => select("all")}>
                <Check className={`mr-2 h-4 w-4 ${value === "all" ? "opacity-100" : "opacity-0"}`} />
                All Technicians
              </CommandItem>
              {technicians.map((technician) => (
                <CommandItem key={technician} value={technician} onSelect={select}>
                  <Check className={`mr-2 h-4 w-4 ${value === technician ? "opacity-100" : "opacity-0"}`} />
                  {technician}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
