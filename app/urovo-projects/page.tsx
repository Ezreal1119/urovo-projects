import { notFound } from "next/navigation";
import ProjectPublicPreview from "@/components/public-preview/ProjectPublicPreview";
import {
  listProjects,
  readOverview,
  readRequirements,
  readTickets,
} from "@/lib/projects";

type PublicPreviewPageProps = {
  searchParams: Promise<{
    project_id?: string | string[];
  }>;
};

export default async function PublicPreviewPage({
  searchParams,
}: PublicPreviewPageProps) {
  const params = await searchParams;
  const projectId = Array.isArray(params.project_id)
    ? params.project_id[0]
    : params.project_id;

  if (!projectId) {
    notFound();
  }

  const projects = await listProjects();
  const item = projects.find(
    ({ project }) => project.project_id === projectId,
  );

  if (!item) {
    notFound();
  }

  const [overview, requirements, tickets] = await Promise.all([
    readOverview(item.folder),
    readRequirements(item.folder),
    readTickets(item.folder),
  ]);

  return (
    <ProjectPublicPreview
      project={item.project}
      overview={overview}
      requirements={requirements}
      tickets={tickets}
    />
  );
}
