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
