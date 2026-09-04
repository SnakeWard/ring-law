import { createFileRoute } from "@tanstack/react-router";
import { RangeYard } from "@/components/range-yard";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <RangeYard />;
}
