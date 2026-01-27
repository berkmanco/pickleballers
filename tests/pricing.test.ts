import { describe, it, expect } from 'vitest'

/**
 * CourtReserve Pricing Tests
 * 
 * Verifies that the pricing calculation matches CourtReserve's doubles rates:
 * - 30 min: $4.50 admin + $24 guest pool
 * - 60 min: $9.00 admin + $48 guest pool
 * - 90 min: $13.50 admin + $72 guest pool
 * - 120 min: $18.00 admin + $96 guest pool
 * 
 * Formula: 
 * - Admin: $0.15/minute
 * - Guest pool: $0.80/minute (3 guests at $0.2667/min each)
 */

/**
 * Calculate CourtReserve pricing based on duration (doubles rate)
 */
function calculateCourtReservePricing(durationMinutes: number) {
  return {
    admin_cost_per_court: durationMinutes * 0.15,
    guest_pool_per_court: durationMinutes * 0.80,
  }
}

describe('CourtReserve Pricing Calculation', () => {
  describe('Standard Durations', () => {
    it('should calculate correct pricing for 30 minutes', () => {
      const pricing = calculateCourtReservePricing(30)
      
      expect(pricing.admin_cost_per_court).toBe(4.50)
      expect(pricing.guest_pool_per_court).toBe(24.00)
    })

    it('should calculate correct pricing for 60 minutes', () => {
      const pricing = calculateCourtReservePricing(60)
      
      expect(pricing.admin_cost_per_court).toBe(9.00)
      expect(pricing.guest_pool_per_court).toBe(48.00)
    })

    it('should calculate correct pricing for 90 minutes', () => {
      const pricing = calculateCourtReservePricing(90)
      
      expect(pricing.admin_cost_per_court).toBe(13.50)
      expect(pricing.guest_pool_per_court).toBe(72.00)
    })

    it('should calculate correct pricing for 120 minutes', () => {
      const pricing = calculateCourtReservePricing(120)
      
      expect(pricing.admin_cost_per_court).toBe(18.00)
      expect(pricing.guest_pool_per_court).toBe(96.00)
    })
  })

  describe('Per-Guest Cost Calculation', () => {
    it('should calculate correct per-guest cost for 90 min, 3 guests', () => {
      const pricing = calculateCourtReservePricing(90)
      const guestCount = 3
      const perGuestCost = pricing.guest_pool_per_court / guestCount
      
      expect(perGuestCost).toBe(24.00)
    })

    it('should calculate correct per-guest cost for 90 min, 4 guests', () => {
      const pricing = calculateCourtReservePricing(90)
      const guestCount = 4
      const perGuestCost = pricing.guest_pool_per_court / guestCount
      
      expect(perGuestCost).toBe(18.00)
    })

    it('should calculate correct per-guest cost for 90 min, 5 guests', () => {
      const pricing = calculateCourtReservePricing(90)
      const guestCount = 5
      const perGuestCost = pricing.guest_pool_per_court / guestCount
      
      expect(perGuestCost).toBe(14.40)
    })

    it('should calculate correct per-guest cost for 60 min, 3 guests', () => {
      const pricing = calculateCourtReservePricing(60)
      const guestCount = 3
      const perGuestCost = pricing.guest_pool_per_court / guestCount
      
      expect(perGuestCost).toBe(16.00)
    })
  })

  describe('Multiple Courts', () => {
    it('should scale pricing correctly for 2 courts (60 min)', () => {
      const pricing = calculateCourtReservePricing(60)
      const courts = 2
      
      const totalAdminCost = pricing.admin_cost_per_court * courts
      const totalGuestPool = pricing.guest_pool_per_court * courts
      
      expect(totalAdminCost).toBe(18.00)
      expect(totalGuestPool).toBe(96.00)
    })

    it('should calculate per-guest cost for 2 courts, 7 guests', () => {
      const pricing = calculateCourtReservePricing(60)
      const courts = 2
      const guestCount = 7
      
      const totalGuestPool = pricing.guest_pool_per_court * courts
      const perGuestCost = totalGuestPool / guestCount
      
      expect(perGuestCost).toBeCloseTo(13.71, 2)
    })
  })

  describe('Total Session Cost', () => {
    it('should calculate total session cost for 90 min, 1 court', () => {
      const pricing = calculateCourtReservePricing(90)
      const courts = 1
      
      const totalSessionCost = (pricing.admin_cost_per_court + pricing.guest_pool_per_court) * courts
      
      expect(totalSessionCost).toBe(85.50)
    })

    it('should calculate total session cost for 60 min, 2 courts', () => {
      const pricing = calculateCourtReservePricing(60)
      const courts = 2
      
      const totalSessionCost = (pricing.admin_cost_per_court + pricing.guest_pool_per_court) * courts
      
      expect(totalSessionCost).toBe(114.00)
    })
  })

  describe('Real-World Scenarios', () => {
    it('Pickle Shack: 90 min, 1 court, 4-6 people', () => {
      const pricing = calculateCourtReservePricing(90)
      const courts = 1
      
      // Admin pays
      expect(pricing.admin_cost_per_court).toBe(13.50)
      
      // Guest pool
      expect(pricing.guest_pool_per_court).toBe(72.00)
      
      // Total paid to venue
      const totalPaid = (pricing.admin_cost_per_court + pricing.guest_pool_per_court) * courts
      expect(totalPaid).toBe(85.50)
      
      // Test different guest counts
      const scenarios = [
        { guests: 3, expectedPerGuest: 24.00 },
        { guests: 4, expectedPerGuest: 18.00 },
        { guests: 5, expectedPerGuest: 14.40 },
      ]
      
      scenarios.forEach(({ guests, expectedPerGuest }) => {
        const perGuestCost = pricing.guest_pool_per_court / guests
        expect(perGuestCost).toBe(expectedPerGuest)
      })
    })

    it('Weekend Warriors: 60 min, 2 courts, 8 people', () => {
      const pricing = calculateCourtReservePricing(60)
      const courts = 2
      const totalPlayers = 8
      const guestCount = totalPlayers - 1 // Minus admin
      
      // Admin pays for 2 courts
      const adminTotal = pricing.admin_cost_per_court * courts
      expect(adminTotal).toBe(18.00)
      
      // Guest pool for 2 courts
      const guestPool = pricing.guest_pool_per_court * courts
      expect(guestPool).toBe(96.00)
      
      // Per guest
      const perGuestCost = guestPool / guestCount
      expect(perGuestCost).toBeCloseTo(13.71, 2)
      
      // Total collected
      const totalCollected = adminTotal + guestPool
      expect(totalCollected).toBe(114.00)
    })
  })

  describe('Formula Validation', () => {
    it('should use correct rate per minute for admin ($0.15/min)', () => {
      const ratePerMinute = 0.15
      
      expect(30 * ratePerMinute).toBe(4.50)
      expect(60 * ratePerMinute).toBe(9.00)
      expect(90 * ratePerMinute).toBe(13.50)
      expect(120 * ratePerMinute).toBe(18.00)
    })

    it('should use correct rate per minute for guest pool ($0.80/min)', () => {
      const ratePerMinute = 0.80
      
      expect(30 * ratePerMinute).toBe(24.00)
      expect(60 * ratePerMinute).toBe(48.00)
      expect(90 * ratePerMinute).toBe(72.00)
      expect(120 * ratePerMinute).toBe(96.00)
    })

    it('guest pool should equal 3 guests at $8/30min each', () => {
      // Verify that $0.80/min = 3 guests × $8/30min
      const guestFeeFor30Min = 8.00
      const numberOfGuests = 3
      const expectedPoolFor30Min = guestFeeFor30Min * numberOfGuests
      
      const pricing = calculateCourtReservePricing(30)
      expect(pricing.guest_pool_per_court).toBe(expectedPoolFor30Min)
    })
  })
})
