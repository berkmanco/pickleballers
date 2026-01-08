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
