import { serve } from "bun";
import sharp from "sharp";

const port = Number(import.meta.env.PORT) || 3000;

serve({
  fetch: async (req: Request) => {
    const url = new URL(req.url);
    const imageUrl = url.searchParams.get("url");

    if (!imageUrl) {
      return new Response("Missing 'url' parameter", { status: 400 });
    }

    // Decide max size based on device param
    let maxSize: number | undefined;
    if (url.searchParams.has("mobile")) {
      maxSize = 375;
    } else if (url.searchParams.has("desktop")) {
      maxSize = 1920; // Default max width
      if (url.searchParams.has("portrait")) {
        maxSize = 1080; // Reasonable max height for portrait images
      }
    }

    // Check Accept header for supported formats
    const accept = req.headers.get("accept") || "";

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

      // Get image metadata to check width & height
      const metadata = await sharp(buffer).metadata();

      // Determine resize options based on largest edge
      let resizeOptions: { width?: number; height?: number } = {};

      if (maxSize && metadata.width && metadata.height) {
        if (metadata.width >= metadata.height) {
          // Landscape or square: constrain by width
          resizeOptions.width = maxSize;
        } else {
          // Portrait: constrain by height
          resizeOptions.height = maxSize;
        }
      }

      // Start sharp pipeline with resize if needed
      let pipeline = sharp(buffer);
      if (resizeOptions.width || resizeOptions.height) {
        pipeline = pipeline.resize(resizeOptions.width, resizeOptions.height, {
          fit: "inside",
          withoutEnlargement: true,
        });
      }

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
