import { createFileRoute } from "@tanstack/react-router";
import { LevelEditor } from "@/components/level-editor";

export const Route = createFileRoute("/editor")({ component: EditorPage });

function EditorPage() {
  return <LevelEditor />;
}
