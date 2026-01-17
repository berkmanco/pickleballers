# CourtReserve Integration

## Overview
Integration with CourtReserve to check court availability at Pickle Shack (Facility ID: 7878).

## How It Works
1. **Fetch public page** → Extract JWT + RequestData tokens (no login required!)
2. **Call backend API** → Get all reservations for a date
3. **Calculate availability** → Find gaps between reservations
4. **Return structured data** → Courts, reservations, available slots

## API Endpoint

**URL:** `POST /functions/v1/courtreserve`

### Check Specific Time Slot
```json
{
  "date": "2026-01-19",
  "startTime": "18:00",
  "endTime": "20:00",
  "courtsNeeded": 2
}
```

**Response:**
```json
{
  "requestedSlot": {
    "startTime": "18:00",
    "endTime": "20:00",
    "courtsNeeded": 2,
    "isAvailable": true,
    "availableCourts": [
      {"id": 21770, "name": "Court #1"},
      {"id": 21771, "name": "Court #2"}
    ],
    "message": "✅ 4 court(s) available from 18:00 to 20:00"
  }
}
```

### Get All Available Slots
```json
{
  "date": "2026-01-19"
}
```

**Response includes each court's schedule:**
```json
{
  "date": "2026-01-19",
  "facility": "Pickle Shack",
  "courts": [{
    "id": 21770,
    "name": "Court #1",
    "reservations": [...],
    "availableSlots": [
      {"start": "06:00", "end": "08:00"},
      {"start": "16:30", "end": "23:00"}
    ]
  }]
}
```

## Courts at Pickle Shack
| ID | Name |
|----|------|
| 21770 | Court #1 |
| 21771 | Court #2 |
| 21772 | Court #3 |
| 21773 | Court #4 |
| 21778 | Court #5 |
| 21779 | Court #6 |
| 28669 | Court #7 |
| 28670 | Court #8 |
| 28671 | Court #9 |
| 28672 | Court #10 |

## Technical Details

### Token Extraction
CourtReserve embeds a public JWT token and RequestData in the HTML of the reservations page:
- **JWT Token**: `Bearer eyJ...` (expires, but regenerated on each page load)
- **RequestData**: Base64-encoded session data

### Backend API
```
https://backend.courtreserve.com/api/scheduler/member-expanded
?id=7878
&RequestData=<token>
&jsonData={"startDate":"2026-01-19T05:00:00.000Z","orgId":"7878",...}
```

## Future Enhancements
- [ ] Add UI to session creation for checking availability
- [ ] Support multiple facilities (configurable facility ID)
- [ ] Cache tokens to reduce page fetches
- [ ] Auto-suggest available time slots

## Status
✅ **Working** - Edge function deployed and tested
