import {
  askProjectAi,
  projectAiModelFromRequest,
  ProjectAiInputError,
  validateProjectAiMessages,
} from "@/lib/project-ai";
import { listProjects } from "@/lib/projects";

export const runtime = "nodejs";

type Context = { params: Promise<{ projectId: string }> };

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: askAiResponseHeaders(request),
  });
}

export async function POST(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const project = (await listProjects()).find(
      (item) => item.project.project_id === projectId,
    );
    if (!project) {
      return askAiJson(request, { error: "Project not found." }, 404);
    }

    const input = await parseJsonRequest(request);
    const messages = validateProjectAiMessages(input);
    const model = projectAiModelFromRequest(input);
    return askAiJson(request, {
      answer: await askProjectAi(project.folder, messages, model),
    });
  } catch (error) {
    if (error instanceof ProjectAiInputError) {
      return askAiJson(request, { error: error.message }, 400);
    }
    return askAiJson(request, { error: (error as Error).message }, 500);
  }
}

async function parseJsonRequest(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new ProjectAiInputError("Invalid Ask AI request.");
  }
}

function askAiJson(
  request: Request,
  body: Record<string, string>,
  status = 200,
) {
  return Response.json(body, {
    status,
    headers: askAiResponseHeaders(request),
  });
}

function askAiResponseHeaders(request: Request) {
  const origin = request.headers.get("origin");
  const headers = new Headers({
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  });
  headers.set("Access-Control-Allow-Origin", origin || "*");
  if (origin) {
    headers.set("Vary", "Origin");
  }
  return headers;
}
