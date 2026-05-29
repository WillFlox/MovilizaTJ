import { NextResponse } from "next/server";
import { isGooglePlacesConfigured, nearbyPlaces } from "@/lib/google-places";

export async function GET(request: Request) {
  if (!isGooglePlacesConfigured()) {
    return NextResponse.json(
      { status: "error", message: "Google Places no configurado." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("keyword")?.trim() ?? "IMSS";
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { status: "error", message: "Coordenadas lat/lng requeridas." },
      { status: 400 }
    );
  }

  try {
    const results = await nearbyPlaces(lat, lng, keyword);
    return NextResponse.json({ status: "success", data: results });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al buscar cercanos.";
    return NextResponse.json({ status: "error", message }, { status: 502 });
  }
}
