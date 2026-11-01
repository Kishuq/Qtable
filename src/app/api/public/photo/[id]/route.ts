import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public menu photo stored in the database (no Blob/S3 account needed).
// URLs are unique per upload and never change, so they can be cached forever
// at the edge — the database is hit once per photo, not once per customer.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return new NextResponse("Not found", { status: 404 });

  const photo = await db.menuPhoto.findUnique({ where: { id }, select: { data: true, mime: true } });
  if (!photo) return new NextResponse("Not found", { status: 404 });

  const body = Buffer.from(photo.data);
  return new NextResponse(body, {
    headers: {
      "Content-Type": photo.mime,
      "Content-Length": String(body.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
