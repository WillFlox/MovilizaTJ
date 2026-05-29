import { NextResponse } from "next/server";
import { isGooglePlacesConfigured, searchPlaces } from "@/lib/google-places";

export async function GET(request: Request) {
  if (!isGooglePlacesConfigured()) {
    return NextResponse.json(
      { status: "error", message: "Google Places no configurado." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!query) {
    return NextResponse.json(
      { status: "error", message: "Parámetro q requerido." },
      { status: 400 }
    );
  }

  try {
    const location =
      lat && lng
        ? { lat: Number(lat), lng: Number(lng) }
        : undefined;

    const results = await searchPlaces(query, location);

    return NextResponse.json({ status: "success", data: results });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al buscar lugares.";
    return NextResponse.json({ status: "error", message }, { status: 502 });
  }
}
