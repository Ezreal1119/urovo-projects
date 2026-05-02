import { readDashboard } from "@/lib/projects";

export const runtime = "nodejs";

export async function GET() {
  try {
    return Response.json(await readDashboard());
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
