import { serve } from "bun";
import sharp from "sharp";

const port = Number(import.meta.env.PORT) || 3000;

serve({
  fetch: async (req: Request) => {
    const url = new URL(req.url);
    const imageUrl = url.searchParams.get("url");
    const width = parseInt(url.searchParams.get("width") || "") || null;
    const height = parseInt(url.searchParams.get("height") || "") || null;

    if (!imageUrl) {
      return new Response("Missing 'url' parameter", { status: 400 });
    }

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return new Response("Failed to fetch image", { status: 502 });
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      const resized = await sharp(buffer)
        .resize(width || undefined, height || undefined, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .toBuffer();

      return new Response(resized, {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=86400, immutable",
        },
      });
    } catch (err: any) {
      return new Response("Error: " + err.message, { status: 500 });
    }
  },
  port
});
