import {
  generateReport,
  ReportInputError,
  validateReportDateRange,
} from "@/lib/reports";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const range = validateReportDateRange(await request.json());
    return Response.json(await generateReport(range));
  } catch (error) {
    if (error instanceof ReportInputError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
