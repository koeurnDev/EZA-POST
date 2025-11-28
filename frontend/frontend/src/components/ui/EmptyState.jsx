import React from "react";
import { RefreshCw } from "lucide-react";
import Button from "./Button";

const EmptyState = ({
    icon: Icon,
    title = "No Data Found",
    description = "There is nothing to show here yet.",
    actionLabel,
    onAction,
    isLoading = false,
}) => {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-gray-50 dark:bg-gray-900/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 text-gray-400 dark:text-gray-500">
                {Icon ? <Icon size={32} /> : <RefreshCw size={32} />}
            </div>

            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                {title}
            </h3>

            <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-6">
                {description}
            </p>

            {actionLabel && onAction && (
                <Button
                    onClick={onAction}
                    variant="outline"
                    isLoading={isLoading}
                    icon={RefreshCw}
                >
                    {actionLabel}
                </Button>
            )}
        </div>
    );
};

export default EmptyState;
