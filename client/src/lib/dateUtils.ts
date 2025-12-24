export function parseLocalDate(dateString: string): Date {
  if (!dateString) return new Date();
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

export function formatDateForInput(date: Date | string | null | undefined): string {
  if (!date) return "";
  
  // If it's a string, extract the date portion directly to avoid timezone shifts
  if (typeof date === 'string') {
    // Handle ISO date strings like "2024-12-23T12:00:00.000Z"
    const isoMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }
  }
  
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDateFromISO(dateString: string | Date | null | undefined): Date | null {
  if (!dateString) return null;
  
  if (dateString instanceof Date) {
    return dateString;
  }
  
  // Extract date portion from ISO string to avoid timezone shifts
  const isoMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    // Create date at noon local time to avoid any edge cases
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
  }
  
  return new Date(dateString);
}

export function formatTime12h(time24: string | null | undefined): string {
  if (!time24) return "";
  const [hours, minutes] = time24.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return time24;
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function formatTimeRange12h(startTime: string | null | undefined, endTime: string | null | undefined): string {
  if (!startTime || !endTime) return "";
  return `${formatTime12h(startTime)} - ${formatTime12h(endTime)}`;
}

/**
 * Format a datetime (timestamp with timezone) for display in the user's local timezone.
 * Use this for timestamps that have time components (e.g., reminder scheduledAt).
 * The input should be an ISO string from the server (e.g., "2024-12-25T14:00:00.000Z").
 */
export function formatDateTimeLocal(dateTimeString: string | Date | null | undefined, formatStr: string = "MMM d, yyyy h:mm a"): string {
  if (!dateTimeString) return "";
  
  // Create a Date object which will be in local timezone
  const date = typeof dateTimeString === 'string' ? new Date(dateTimeString) : dateTimeString;
  
  // Check for invalid dates
  if (isNaN(date.getTime())) return "";
  
  // Import format dynamically to avoid circular dependencies
  // Using native Intl.DateTimeFormat for consistent local timezone handling
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };
  
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

/**
 * Format a datetime for detailed display (includes more detail).
 * Use this for full datetime display in detail views.
 */
export function formatDateTimeLocalFull(dateTimeString: string | Date | null | undefined): string {
  if (!dateTimeString) return "";
  
  const date = typeof dateTimeString === 'string' ? new Date(dateTimeString) : dateTimeString;
  
  if (isNaN(date.getTime())) return "";
  
  const options: Intl.DateTimeFormatOptions = {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };
  
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

/**
 * Format a datetime-local input value for pre-filling input fields.
 * Returns format: "YYYY-MM-DDTHH:mm" in local timezone.
 */
export function formatDateTimeForInput(dateTimeString: string | Date | null | undefined): string {
  if (!dateTimeString) return "";
  
  const date = typeof dateTimeString === 'string' ? new Date(dateTimeString) : dateTimeString;
  
  if (isNaN(date.getTime())) return "";
  
  // Format in local timezone for datetime-local input
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
