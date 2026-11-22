import { Compass } from "lucide-react";
import { Link } from "react-router-dom";
import { buttonClasses } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";

export default function NotFoundPage() {
  return (
    <EmptyState
      className="py-24"
      icon={<Compass />}
      title="Page not found"
      description="The page you’re looking for doesn’t exist or has moved."
      action={
        <Link to="/" className={buttonClasses("primary")}>
          Back to dashboard
        </Link>
      }
    />
  );
}
