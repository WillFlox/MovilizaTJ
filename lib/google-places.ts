import type { PlaceResult } from "@/lib/types";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const PLACES_API_BASE = "https://places.googleapis.com/v1";
const FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location,places.types";

type NewPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
};

type NewPlacesResponse = {
  places?: NewPlace[];
  error?: { message?: string; status?: string };
};

function getApiKey(): string {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("GOOGLE_MAPS_API_KEY no configurada.");
  }
  return GOOGLE_MAPS_API_KEY;
}

function formatGoogleError(message: string): string {
  if (message.includes("referer") && message.includes("blocked")) {
    return (
      "La API key de Google tiene restricción por referrer, pero las búsquedas " +
      "se hacen desde el servidor (Next.js). En Google Cloud → Credenciales, " +
      "cambia la key a 'Ninguno' o 'Direcciones IP' (no 'Referentes HTTP') " +
      "y restringe solo a Places API (New)."
    );
  }

  return message;
}

function mapPlace(place: NewPlace): PlaceResult | null {
  const lat = place.location?.latitude;
  const lng = place.location?.longitude;

  if (lat === undefined || lng === undefined) {
    return null;
  }

  return {
    place_id: place.id ?? crypto.randomUUID(),
    name: place.displayName?.text ?? "Lugar sin nombre",
    address: place.formattedAddress ?? "",
    latitude: lat,
    longitude: lng,
    types: place.types ?? []
  };
}

async function callPlacesApi<TBody extends object>(
  endpoint: string,
  body: TBody
): Promise<PlaceResult[]> {
  const response = await fetch(`${PLACES_API_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": getApiKey(),
      "X-Goog-FieldMask": FIELD_MASK
    },
    body: JSON.stringify(body)
  });

  const data = (await response.json()) as NewPlacesResponse;

  if (!response.ok) {
    const rawMessage =
      data.error?.message ?? `Google Places API error (${response.status})`;
    throw new Error(formatGoogleError(rawMessage));
  }

  return (data.places ?? [])
    .map(mapPlace)
    .filter((place): place is PlaceResult => place !== null)
    .slice(0, 8);
}

export async function searchPlaces(
  query: string,
  location?: { lat: number; lng: number }
): Promise<PlaceResult[]> {
  const body: Record<string, unknown> = {
    textQuery: `${query} Tijuana`,
    languageCode: "es",
    maxResultCount: 8
  };

  if (location) {
    body.locationBias = {
      circle: {
        center: { latitude: location.lat, longitude: location.lng },
        radius: 15000
      }
    };
  }

  return callPlacesApi("places:searchText", body);
}

const NEARBY_TYPE_MAP: Record<string, string[]> = {
  hospital: ["hospital"],
  farmacia: ["pharmacy"]
};

export async function nearbyPlaces(
  lat: number,
  lng: number,
  keyword: string
): Promise<PlaceResult[]> {
  const normalized = keyword.toLowerCase();
  const includedTypes = NEARBY_TYPE_MAP[normalized];

  if (includedTypes) {
    return callPlacesApi("places:searchNearby", {
      includedTypes,
      languageCode: "es",
      maxResultCount: 8,
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: 8000
        }
      }
    });
  }

  return searchPlaces(keyword, { lat, lng });
}

export function isGooglePlacesConfigured(): boolean {
  return Boolean(GOOGLE_MAPS_API_KEY);
}
