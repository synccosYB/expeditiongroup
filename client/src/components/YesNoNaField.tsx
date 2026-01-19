import { FormControl, FormItem, FormLabel } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface YesNoNaFieldProps {
  label: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  testId?: string;
}

export function YesNoNaField({ label, value, onChange, testId }: YesNoNaFieldProps) {
  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <RadioGroup
          value={value || ""}
          onValueChange={onChange}
          className="flex items-center gap-6 pt-1"
          data-testid={testId}
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="yes" id={`${testId}-yes`} />
            <Label htmlFor={`${testId}-yes`} className="font-normal cursor-pointer">Yes</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="no" id={`${testId}-no`} />
            <Label htmlFor={`${testId}-no`} className="font-normal cursor-pointer">No</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="na" id={`${testId}-na`} />
            <Label htmlFor={`${testId}-na`} className="font-normal cursor-pointer">N/A</Label>
          </div>
        </RadioGroup>
      </FormControl>
    </FormItem>
  );
}
