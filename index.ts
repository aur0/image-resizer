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
    } else {
      maxSize = 1920; // Default max width for desktop
    }

    // Check Accept header for supported formats
    const accept = req.headers.get("accept") || "";

    let format: "webp" | "jpeg" = "jpeg";
    if (accept.includes("image/webp")) {
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

      // Determine resize options based on image dimensions
      let resizeOptions: { width?: number; height?: number } = {};

      if (maxSize && metadata.width && metadata.height) {
        // If height is greater than width, it's portrait
        if (metadata.height > metadata.width) {
          resizeOptions.height = maxSize;
        } else {
          // Otherwise, it's landscape or square
          resizeOptions.width = maxSize;
        }
      }

      // Start with basic sharp pipeline and chain resize and format conversion
      let pipeline = sharp(buffer);
      
      // Chain resize operation if needed
      if (resizeOptions.width || resizeOptions.height) {
        pipeline = pipeline.resize(resizeOptions.width, resizeOptions.height, {
          fit: "inside",
          withoutEnlargement: true,
        });
      }

      // Chain format conversion
      if (format === "webp") {
        pipeline = pipeline.webp({ 
          quality: 60,
          effort: 6,
          smartSubsample: true,
          lossless: false,
          nearLossless: false
        });
      } else {
        pipeline = pipeline.jpeg({ quality: 75 });
      }

      try {
        const outputBuffer = await pipeline.toBuffer();

        return new Response(outputBuffer, {
          headers: {
            "Content-Type": format === "webp" ? "image/webp" : "image/jpeg",
            "Cache-Control": "public, max-age=86400, immutable",
          },
        });
      } catch (err: any) {
        return new Response("Error: " + err.message, { status: 500 });
      }
    } catch (err: any) {
      return new Response("Error: " + err.message, { status: 500 });
    }
  },
  port,
});
