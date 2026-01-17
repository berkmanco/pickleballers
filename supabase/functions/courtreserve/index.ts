// Supabase Edge Function: courtreserve
// Fetches court availability from CourtReserve for Pickle Shack

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// @ts-ignore - Deno URL imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Pickle Shack configuration
const FACILITY_ID = "7878";
const FACILITY_URL = `https://app.courtreserve.com/Online/Reservations/Index/${FACILITY_ID}`;
const API_URL = "https://backend.courtreserve.com/api/scheduler/member-expanded";
const COST_TYPE_ID = "93236";
const COURT_IDS = "21770,21771,21772,21773,21778,21779,28669,28670,28671,28672";

// Court ID to name mapping
const COURT_NAMES: Record<string, string> = {
  "21770": "Court #1",
  "21771": "Court #2", 
  "21772": "Court #3",
  "21773": "Court #4",
  "21778": "Court #5",
  "21779": "Court #6",
  "28669": "CT7",
  "28670": "CT8",
  "28671": "CT9",
  "28672": "CT10",
};

interface CourtReserveRequest {
  date: string; // YYYY-MM-DD format
  startTime?: string; // HH:MM format (e.g., "09:00")
  endTime?: string; // HH:MM format (e.g., "11:00")
  courtsNeeded?: number; // How many courts do you need?
}

interface Reservation {
  courtId: number;
  courtName: string;
  start: string;
  end: string;
  type: string;
  isAvailable: boolean;
}

interface AvailabilityResponse {
  date: string;
  facility: string;
  // If specific time requested
  requestedSlot?: {
    startTime: string;
    endTime: string;
    courtsNeeded: number;
    isAvailable: boolean;
    availableCourts: { id: number; name: string }[];
    message: string;
  };
  // All courts with their schedules
  courts: {
    id: number;
    name: string;
    reservations: Reservation[];
    availableSlots: { start: string; end: string }[];
  }[];
}

// Helper: Check if two time ranges overlap
function timeRangesOverlap(
  start1: string, end1: string,
  start2: string, end2: string
): boolean {
  // Convert to comparable format (just time portion)
  const getTime = (dt: string) => {
    const d = new Date(dt);
    return d.getHours() * 60 + d.getMinutes();
  };
  
  const s1 = getTime(start1);
  const e1 = getTime(end1);
  const s2 = getTime(start2);
  const e2 = getTime(end2);
  
  // Overlap if one starts before the other ends
  return s1 < e2 && s2 < e1;
}

// Helper: Check if a court is available during a time window
function isCourtAvailable(
  reservations: Reservation[],
  startTime: string, // "HH:MM"
  endTime: string,   // "HH:MM"
  date: string       // "YYYY-MM-DD"
): boolean {
  // Create datetime strings for comparison
  const requestStart = `${date}T${startTime}:00`;
  const requestEnd = `${date}T${endTime}:00`;
  
  for (const res of reservations) {
    if (timeRangesOverlap(requestStart, requestEnd, res.start, res.end)) {
      return false; // Conflict found
    }
  }
  return true; // No conflicts
}

// Helper: Find all available slots for a court (gaps between reservations)
function findAvailableSlots(
  reservations: Reservation[],
  openTime: string = "06:00",
  closeTime: string = "23:00"
): { start: string; end: string }[] {
  const slots: { start: string; end: string }[] = [];
  
  // Sort reservations by start time
  const sorted = [...reservations].sort((a, b) => 
    new Date(a.start).getTime() - new Date(b.start).getTime()
  );
  
  // Find gaps
  let currentEnd = openTime;
  
  for (const res of sorted) {
    const resStart = res.start.split("T")[1]?.substring(0, 5) || "00:00";
    const resEnd = res.end.split("T")[1]?.substring(0, 5) || "00:00";
    
    // If there's a gap before this reservation
    if (resStart > currentEnd) {
      slots.push({ start: currentEnd, end: resStart });
    }
    
    // Move current end forward
    if (resEnd > currentEnd) {
      currentEnd = resEnd;
    }
  }
  
  // Check for gap at the end of the day
  if (currentEnd < closeTime) {
    slots.push({ start: currentEnd, end: closeTime });
  }
  
  return slots;
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    const { date, startTime, endTime, courtsNeeded } = await req.json() as CourtReserveRequest;
    
    if (!date) {
      return new Response(
        JSON.stringify({ error: "date parameter required (YYYY-MM-DD)" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Validate time format if provided
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (startTime && !timeRegex.test(startTime)) {
      return new Response(
        JSON.stringify({ error: "startTime must be in HH:MM format (e.g., '09:00')" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (endTime && !timeRegex.test(endTime)) {
      return new Response(
        JSON.stringify({ error: "endTime must be in HH:MM format (e.g., '11:00')" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Step 1: Fetch the public page to get tokens
    console.log("Fetching CourtReserve page for tokens...");
    const pageResponse = await fetch(FACILITY_URL);
    const pageHtml = await pageResponse.text();

    // Extract JWT token
    const jwtMatch = pageHtml.match(/Bearer (eyJ[^"]+)/);
    if (!jwtMatch) {
      throw new Error("Could not extract JWT token from page");
    }
    const jwtToken = jwtMatch[1];

    // Extract RequestData (the second one with the actual token, not the backtick one)
    const requestDataMatches = pageHtml.match(/RequestData=([A-Za-z0-9+/=]{50,})/g);
    if (!requestDataMatches || requestDataMatches.length === 0) {
      throw new Error("Could not extract RequestData from page");
    }
    // Get the last/longest match which should be the actual token
    const requestData = requestDataMatches[requestDataMatches.length - 1].replace("RequestData=", "");

    console.log("Tokens extracted successfully");

    // Step 2: Build the API request
    const dateObj = new Date(date + "T05:00:00.000Z");
    const jsonData = {
      startDate: dateObj.toISOString(),
      orgId: FACILITY_ID,
      TimeZone: "America/New_York",
      CostTypeId: COST_TYPE_ID,
      ReservationMinInterval: "60",
      SelectedCourtIds: COURT_IDS,
      UiCulture: "en-US",
    };

    const apiUrl = `${API_URL}?id=${FACILITY_ID}&RequestData=${encodeURIComponent(requestData)}&jsonData=${encodeURIComponent(JSON.stringify(jsonData))}`;

    console.log("Calling CourtReserve API...");
    const apiResponse = await fetch(apiUrl, {
      headers: {
        "Authorization": `Bearer ${jwtToken}`,
        "Origin": "https://app.courtreserve.com",
      },
    });

    if (!apiResponse.ok) {
      throw new Error(`API returned ${apiResponse.status}`);
    }

    const apiData = await apiResponse.json();
    console.log(`Got ${apiData.Data?.length || 0} reservations`);

    // Step 3: Parse the response
    const reservations = apiData.Data || [];
    
    // Group by court
    const courtData: Record<string, Reservation[]> = {};
    for (const courtId of Object.keys(COURT_NAMES)) {
      courtData[courtId] = [];
    }

    for (const res of reservations) {
      const courtId = String(res.CourtId);
      if (courtData[courtId]) {
        courtData[courtId].push({
          courtId: res.CourtId,
          courtName: res.CourtLabel || COURT_NAMES[courtId],
          start: res.ReservationStart,
          end: res.ReservationEnd,
          type: res.ReservationType || "Reserved",
          isAvailable: false,
        });
      }
    }

    // Build courts data with available slots
    const courtsWithSlots = Object.entries(COURT_NAMES).map(([id, name]) => {
      const courtReservations = courtData[id] || [];
      return {
        id: parseInt(id),
        name,
        reservations: courtReservations,
        availableSlots: findAvailableSlots(courtReservations),
      };
    });

    // Build response
    const response: AvailabilityResponse = {
      date,
      facility: "Pickle Shack",
      courts: courtsWithSlots,
    };

    // If specific time slot requested, check availability
    if (startTime && endTime) {
      const availableCourts: { id: number; name: string }[] = [];
      
      for (const court of courtsWithSlots) {
        if (isCourtAvailable(court.reservations, startTime, endTime, date)) {
          availableCourts.push({ id: court.id, name: court.name });
        }
      }
      
      const needed = courtsNeeded || 1;
      const isAvailable = availableCourts.length >= needed;
      
      let message: string;
      if (isAvailable) {
        message = `✅ ${availableCourts.length} court(s) available from ${startTime} to ${endTime}`;
      } else if (availableCourts.length > 0) {
        message = `⚠️ Only ${availableCourts.length} court(s) available (need ${needed})`;
      } else {
        message = `❌ No courts available from ${startTime} to ${endTime}`;
      }
      
      response.requestedSlot = {
        startTime,
        endTime,
        courtsNeeded: needed,
        isAvailable,
        availableCourts,
        message,
      };
    }

    return new Response(JSON.stringify(response, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
