import { createFileRoute, Link } from "@tanstack/react-router";
import { RingRegistry } from "@/components/ring-registry";

export const Route = createFileRoute("/contract")({ component: ContractPage });

function ContractPage() {
  return (
    <div className="min-h-dvh bg-bg">
      <div className="border-b border-line px-4 py-3">
        <Link to="/" className="inline-flex min-h-11 items-center text-sm text-reticle">
          Back to range
        </Link>
      </div>
      <RingRegistry />
    </div>
  );
}
