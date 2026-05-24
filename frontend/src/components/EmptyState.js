import { Package, Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

/**
 * EmptyState - Displayed when no data is available
 * 
 * @param {Object} props
 * @param {string} props.title - Title text
 * @param {string} props.description - Description text
 * @param {Function} props.action - Optional action callback
 * @param {string} props.actionLabel - Label for action button
 */
export function EmptyState({ title, description, action, actionLabel = "Get Started" }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
        <Package size={32} className="text-muted-foreground" aria-hidden="true" />
      </div>
      <h3 className="font-heading text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
      {action && (
        <Button onClick={action} className="gap-2">
          <Plus size={16} weight="bold" aria-hidden="true" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
