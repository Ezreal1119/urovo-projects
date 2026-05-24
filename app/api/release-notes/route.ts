import { readReleaseNotes } from "@/lib/release-records";

export const runtime = "nodejs";

export async function GET() {
  try {
    return Response.json({ rows: await readReleaseNotes() });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
