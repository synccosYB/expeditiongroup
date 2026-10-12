export interface CheckDetails {
  number: string;
  date: string;
  amount: string;
  payee: string;
  payeeAddress: string;
  companyName: string;
  companyAddress: string;
  bankName: string;
  billNumber: string;
  memo: string;
  status: "issued" | "void";
  issuedBy: number;
  voidedBy?: number;
  voidedAt?: string;
}

export function moneyToCents(value: string): number {
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(value)) throw new Error("Enter a positive amount with at most two decimals");
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function validateCheckPayment(amount: string, total: string, paid: string): number {
  const cents = moneyToCents(amount);
  if (cents <= 0 || cents > moneyToCents(total) - moneyToCents(paid)) throw new Error("Check amount must be positive and cannot exceed the unpaid bill balance");
  return cents;
}

export function amountInWords(amount: string): string {
  const cents = moneyToCents(amount);
  const small = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const words = (n: number): string => {
    if (n < 20) return small[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + words(n % 10) : "");
    for (const [size, label] of [[1000000, "Million"], [1000, "Thousand"], [100, "Hundred"]] as const) {
      if (n >= size) return words(Math.floor(n / size)) + " " + label + (n % size ? " " + words(n % size) : "");
    }
    return "";
  };
  return `${words(Math.floor(cents / 100))} and ${String(cents % 100).padStart(2, "0")}/100 Dollars`;
}
