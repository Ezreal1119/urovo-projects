import {
  askProjectAi,
  ProjectAiInputError,
  validateProjectAiMessages,
} from "@/lib/project-ai";
import { projectKeyFromSegments } from "@/lib/projects";

export const runtime = "nodejs";

type Context = { params: Promise<{ country: string; project: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { country, project } = await context.params;
    const key = projectKeyFromSegments([country, project]);
    const input = await parseJsonRequest(request);
    const messages = validateProjectAiMessages(input);
    return Response.json({ answer: await askProjectAi(key, messages) });
  } catch (error) {
    if (error instanceof ProjectAiInputError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}

async function parseJsonRequest(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new ProjectAiInputError("Invalid Ask AI request.");
  }
}
