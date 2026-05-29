import { NextRequest, NextResponse } from "next/server";

const NOMINATIM_HEADERS = {
  "Accept-Language": "es",
  "User-Agent": "MovilizaTJ/1.0 (geocode; contacto@movilizatj.local)",
};

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "Falta el parámetro q." }, { status: 400 });
  }

  try {
    const query = encodeURIComponent(`${q}, Tijuana, Baja California, Mexico`);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
      { headers: NOMINATIM_HEADERS, next: { revalidate: 3600 } }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "No se pudo geocodificar el destino." },
        { status: 502 }
      );
    }

    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data.length) {
      return NextResponse.json(
        { error: "Destino no encontrado en el mapa." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    });
  } catch {
    return NextResponse.json(
      { error: "Error al geocodificar." },
      { status: 500 }
    );
  }
}
