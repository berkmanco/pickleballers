import { supabase } from './supabase'

export interface AvailableCourt {
  id: number
  name: string
}

export interface AvailabilitySlot {
  start: string
  end: string
}

export interface CourtAvailability {
  id: number
  name: string
  reservations: {
    courtId: number
    courtName: string
    start: string
    end: string
    type: string
  }[]
  availableSlots: AvailabilitySlot[]
}

export interface AvailabilityResult {
  date: string
  facility: string
  requestedSlot?: {
    startTime: string
    endTime: string
    courtsNeeded: number
    isAvailable: boolean
    availableCourts: AvailableCourt[]
    message: string
  }
  courts: CourtAvailability[]
}

/**
 * Check court availability at Pickle Shack
 * @param date - Date in YYYY-MM-DD format
 * @param startTime - Optional start time in HH:MM format (24h)
 * @param endTime - Optional end time in HH:MM format (24h)
 * @param courtsNeeded - Optional number of courts needed
 */
export async function checkCourtAvailability(
  date: string,
  startTime?: string,
  endTime?: string,
  courtsNeeded?: number
): Promise<AvailabilityResult> {
  if (!supabase) {
    throw new Error('Database connection not available')
  }

  const { data, error } = await supabase.functions.invoke('courtreserve', {
    body: {
      date,
      startTime,
      endTime,
      courtsNeeded,
    },
  })

  if (error) {
    console.error('CourtReserve error:', error)
    throw new Error(error.message || 'Failed to check availability')
  }

  if (data.error) {
    throw new Error(data.error)
  }

  return data as AvailabilityResult
}

/**
 * Convert time from HH:MM (form input) to HH:MM (24h) format
 * Handles both 12h and 24h input formats
 */
export function normalizeTime(time: string): string {
  // Already in HH:MM format
  return time
}

/**
 * Calculate end time based on start time and duration
 */
export function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(':').map(Number)
  const totalMinutes = hours * 60 + minutes + durationMinutes
  const endHours = Math.floor(totalMinutes / 60) % 24
  const endMinutes = totalMinutes % 60
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`
}

/**
 * Get display name for a court (maps IDs to friendly names)
 */
export function getCourtDisplayName(courtId: number): string {
  const courtNames: Record<number, string> = {
    21770: 'Court #1',
    21771: 'Court #2',
    21772: 'Court #3',
    21773: 'Court #4',
    21778: 'Court #5',
    21779: 'Court #6',
    28669: 'Court #7',
    28670: 'Court #8',
    28671: 'Court #9',
    28672: 'Court #10',
  }
  return courtNames[courtId] || `Court ${courtId}`
}
