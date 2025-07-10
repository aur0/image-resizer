import { serve } from "bun";
import sharp from "sharp";

const port = Number(import.meta.env.PORT) || 3000;

serve({
  fetch: async (req: Request) => {
    const url = new URL(req.url);
    const imageUrl = url.searchParams.get("url");
    const width = parseInt(url.searchParams.get("width") || "") || undefined;
    const height = parseInt(url.searchParams.get("height") || "") || undefined;

    if (!imageUrl) {
      return new Response("Missing 'url' parameter", { status: 400 });
    }

    // Check Accept header for supported formats
    const accept = req.headers.get("accept") || "";

    // Decide output format
    let format: "avif" | "webp" | "jpeg" = "jpeg";
    if (accept.includes("image/avif")) {
      format = "avif";
    } else if (accept.includes("image/webp")) {
      format = "webp";
    }

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return new Response("Failed to fetch image", { status: 502 });
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      // Start sharp pipeline
      let pipeline = sharp(buffer).resize(width, height, {
        fit: "inside",
        withoutEnlargement: true,
      });

      // Convert format based on support
      if (format === "avif") {
        pipeline = pipeline.avif();
      } else if (format === "webp") {
        pipeline = pipeline.webp();
      } else {
        pipeline = pipeline.jpeg();
      }

      const outputBuffer = await pipeline.toBuffer();

      return new Response(outputBuffer, {
        headers: {
          "Content-Type":
            format === "avif"
              ? "image/avif"
              : format === "webp"
              ? "image/webp"
              : "image/jpeg",
          "Cache-Control": "public, max-age=86400, immutable",
        },
      });
    } catch (err: any) {
      return new Response("Error: " + err.message, { status: 500 });
    }
  },
  port,
});
