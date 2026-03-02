// src/app/api/vision/route.ts
// Isolated vision extraction route — accepts base64 images, returns RigIntent JSON.
//
// This route is COMPLETELY SEPARATE from /api/generate.
// The generate route is NOT modified in Phase 19. Zero shared code paths.
//
// Transport: JSON body with base64-encoded images (not multipart/FormData).
// Reason: consistent with req.json() pattern used by /api/generate and /api/chat;
// client-side compression handles size before encoding.

import { NextRequest, NextResponse } from "next/server";
import { callRigVisionPlanner } from "@/lib/rig-vision";
import type { VisionImage } from "@/lib/rig-vision";

// Required for Vercel Fluid Compute — without this the Hobby plan caps at 10s.
// Enable Fluid Compute in: Vercel Dashboard → Project → Settings → Functions.
export const maxDuration = 60;

// Prevents static caching of POST handler output.
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Validation constants
// ---------------------------------------------------------------------------

const ALLOWED_MEDIA_TYPES = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_IMAGES = 3;

// 1,200,000 base64 chars ≈ 900 KB raw — well under Anthropic's 5 MB per-image limit.
// Client targets 800 KB compressed; this allows a small overage.
const MAX_BASE64_LENGTH = 1_200_000;

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { images?: unknown };
    const images = body.images;

    // Validate presence and type
    if (!Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { error: "No images provided" },
        { status: 400 }
      );
    }

    // Validate count
    if (images.length > MAX_IMAGES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_IMAGES} images allowed` },
        { status: 400 }
      );
    }

    // Validate each image entry
    for (let i = 0; i < images.length; i++) {
      const img = images[i] as { data?: unknown; mediaType?: unknown };

      if (typeof img.data !== "string" || img.data.length === 0) {
        return NextResponse.json(
          { error: `Image ${i + 1}: missing or empty data field` },
          { status: 400 }
        );
      }

      if (img.data.length > MAX_BASE64_LENGTH) {
        return NextResponse.json(
          { error: `Image ${i + 1} exceeds maximum allowed size` },
          { status: 400 }
        );
      }

      if (
        typeof img.mediaType !== "string" ||
        !ALLOWED_MEDIA_TYPES.has(img.mediaType)
      ) {
        return NextResponse.json(
          {
            error: `Image ${i + 1}: unsupported media type "${img.mediaType}". Accepted: image/jpeg, image/png, image/webp`,
          },
          { status: 400 }
        );
      }
    }

    // Cast to typed array after validation
    const typedImages: VisionImage[] = (images as Array<{ data: string; mediaType: string }>).map(
      (img) => ({
        data: img.data,
        mediaType: img.mediaType as VisionImage["mediaType"],
      })
    );

    const rigIntent = await callRigVisionPlanner(typedImages);

    return NextResponse.json({ rigIntent });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Vision extraction failed";
    console.error("Vision extraction error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
