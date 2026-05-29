import { NextRequest, NextResponse } from "next/server";
import { extractVoiceObstacles, extractVoiceRoute } from "@/lib/voice-route";

export const maxDuration = 60;

const VOICE_WEBHOOK_URL = process.env.N8N_VOICE_WEBHOOK_URL ?? "";

type N8nPayload = Record<string, unknown>;

function unwrapN8nPayload(raw: unknown): N8nPayload {
  if (Array.isArray(raw)) {
    const first = raw[0] as { json?: N8nPayload } | N8nPayload | undefined;
    if (first && typeof first === "object" && "json" in first && first.json) {
      return first.json as N8nPayload;
    }
    return (first as N8nPayload) ?? {};
  }
  return (raw as N8nPayload) ?? {};
}

function pickText(data: N8nPayload): string | null {
  const keys = ["text", "response", "message", "output", "transcript", "answer"];
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function pickAudioUrl(data: N8nPayload): string | null {
  const keys = ["audio_url", "audioUrl", "url", "audio_link"];
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.startsWith("http")) return value;
  }
  return null;
}

function pickAudioBase64Raw(data: N8nPayload): string | null {
  const keys = ["audio_base64", "audioBase64", "audio", "data"];
  for (const key of keys) {
    const value = data[key];
    if (typeof value !== "string" || !value.trim()) continue;
    const cleaned = value.replace(/^data:audio\/[^;]+;base64,/, "").trim();
    if (cleaned.length < 32) continue;
    return cleaned;
  }
  return null;
}

function pickAudioBase64(data: N8nPayload): Buffer | null {
  const keys = ["audio_base64", "audioBase64", "audio", "data"];
  for (const key of keys) {
    const value = data[key];
    if (typeof value !== "string" || !value.trim()) continue;

    const cleaned = value.replace(/^data:audio\/[^;]+;base64,/, "").trim();
    if (cleaned.length < 32) continue;

    try {
      return Buffer.from(cleaned, "base64");
    } catch {
      continue;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  if (!VOICE_WEBHOOK_URL) {
    return NextResponse.json(
      {
        error:
          "Asistente de voz no configurado. Agrega N8N_VOICE_WEBHOOK_URL al entorno.",
      },
      { status: 503 }
    );
  }

  try {
    const formData = await req.formData();
    const userLat = Number(formData.get("latitude"));
    const userLng = Number(formData.get("longitude"));
    const geoContext = {
      latitude: Number.isFinite(userLat) ? userLat : undefined,
      longitude: Number.isFinite(userLng) ? userLng : undefined,
    };

    const n8nRes = await fetch(VOICE_WEBHOOK_URL, {
      method: "POST",
      body: formData,
    });

    const contentType = n8nRes.headers.get("content-type") ?? "";
    const bodyBuffer = Buffer.from(await n8nRes.arrayBuffer());
    const bodyText = bodyBuffer.toString("utf8").trim();

    if (!n8nRes.ok) {
      console.error(
        "[voice-chat] n8n error:",
        n8nRes.status,
        bodyText.slice(0, 500) || "(vacío)"
      );
      return NextResponse.json(
        { error: `Error del webhook n8n: ${n8nRes.status}` },
        { status: 502 }
      );
    }

    if (bodyBuffer.length === 0) {
      console.error("[voice-chat] n8n respondió 200 con cuerpo vacío");
      return NextResponse.json(
        {
          error:
            "El webhook respondió vacío. Revisa en n8n el nodo «Responder al Webhook» y que el flujo termine correctamente.",
        },
        { status: 502 }
      );
    }

    // Audio binario directo
    if (
      contentType.includes("audio/") ||
      contentType.includes("octet-stream")
    ) {
      return new NextResponse(bodyBuffer, {
        status: 200,
        headers: {
          "Content-Type": contentType.includes("audio/")
            ? contentType
            : "audio/mpeg",
          "Content-Length": String(bodyBuffer.length),
          "Cache-Control": "no-store",
        },
      });
    }

    // JSON (o texto que parece JSON)
    const looksLikeJson =
      contentType.includes("application/json") ||
      bodyText.startsWith("{") ||
      bodyText.startsWith("[");

    if (looksLikeJson) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(bodyText);
      } catch {
        console.error(
          "[voice-chat] JSON inválido:",
          bodyText.slice(0, 300)
        );
        return NextResponse.json(
          { error: "El webhook devolvió JSON inválido." },
          { status: 502 }
        );
      }

      const data = unwrapN8nPayload(parsed);

      // ── DEBUG: muestra el payload completo de n8n en la consola del servidor ──
      console.log("[voice-chat] payload de n8n:", JSON.stringify({
        pide_ruta:    data.pide_ruta,
        ruta:         data.ruta,
        destino_ruta: data.destino_ruta,
        modo_consulta:data.modo_consulta,
        respuesta_texto: typeof data.respuesta_texto === "string"
          ? data.respuesta_texto.slice(0, 80)
          : undefined,
        obstaculos_count: Array.isArray(data.reportes_encontrados)
          ? data.reportes_encontrados.length
          : 0,
      }, null, 2));

      // Si viene ruta u obstáculos, devolver JSON completo para que el cliente
      // pueda dibujar la ruta y/o reproducir el audio base64.
      const ruta = extractVoiceRoute(data, geoContext);
      const obstaculos = extractVoiceObstacles(data);
      const hasObstacles = !!obstaculos?.length;

      if (ruta || hasObstacles) {
        const audioBase64Raw = pickAudioBase64Raw(data);
        const text =
          pickText(data) ??
          (typeof data.respuesta_texto === "string"
            ? data.respuesta_texto
            : null);
        const mimeType =
          typeof data.mime_type === "string" ? data.mime_type : "audio/mpeg";

        return NextResponse.json({
          ok: true,
          respuesta_texto: text ?? "",
          ...(audioBase64Raw ? { audio_base64: audioBase64Raw, mime_type: mimeType } : {}),
          ...(ruta ? { ruta } : {}),
          ...(hasObstacles ? { obstaculos } : {}),
        });
      }

      const audioBase64 = pickAudioBase64(data);
      if (audioBase64 && audioBase64.length > 0) {
        console.warn(
          "[voice-chat] Respuesta con audio pero sin campo `ruta`; el mapa no trazará ruta."
        );
        return new NextResponse(audioBase64.buffer as ArrayBuffer, {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            "Content-Length": String(audioBase64.length),
            "Cache-Control": "no-store",
          },
        });
      }

      const audioUrl = pickAudioUrl(data);
      if (audioUrl) {
        const audioRes = await fetch(audioUrl);
        if (audioRes.ok) {
          const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
          const ct = audioRes.headers.get("content-type") ?? "audio/mpeg";
          return new NextResponse(audioBuffer, {
            headers: { "Content-Type": ct, "Cache-Control": "no-store" },
          });
        }
      }

      const text = pickText(data);
      if (text) {
        return NextResponse.json({ text });
      }

      console.error(
        "[voice-chat] JSON sin audio ni texto reconocible:",
        JSON.stringify(data).slice(0, 500)
      );
      return NextResponse.json(
        {
          error:
            "El webhook respondió pero no incluyó audio ni texto. Revisa el nodo «Preparar respuesta» en n8n.",
        },
        { status: 502 }
      );
    }

    // Fallback: tratar como audio aunque el content-type no sea audio/*
    if (bodyBuffer.length > 256) {
      return new NextResponse(bodyBuffer, {
        headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
      });
    }

    return NextResponse.json(
      { error: "Formato de respuesta del webhook no reconocido." },
      { status: 502 }
    );
  } catch (err) {
    console.error("[voice-chat] error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}
