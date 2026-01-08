// Utility functions

/**
 * Extract first name from a full name
 * "Mike Berkman" → "Mike"
 * "Mike" → "Mike"
 */
export function getFirstName(fullName: string): string {
  return fullName.split(' ')[0]
}

/**
 * Format a date for display
 * "2026-01-15" → "Wed, Jan 15"
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format a time for display
 * "10:00" → "10:00 AM"
 */
export function formatTime(timeString: string): string {
  const [hours, minutes] = timeString.split(':')
  const date = new Date()
  date.setHours(parseInt(hours), parseInt(minutes))
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * Format a phone number for display
 * "+16145376574" → "(614) 537-6574"
 * "6145376574" → "(614) 537-6574"
 * Returns original string if format not recognized
 */
export function formatPhone(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')
  
  // Handle US numbers (10 or 11 digits)
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  
  // Return original if we can't format it
  return phone
}
