import React from "react";
import { ButtonSpinner } from "../LoadingSpinner";

const Button = ({
    children,
    onClick,
    type = "button",
    variant = "primary", // primary, secondary, danger, outline, ghost
    size = "medium", // small, medium, large
    isLoading = false,
    disabled = false,
    icon: Icon,
    className = "",
    fullWidth = false,
}) => {
    // 🎨 Variants
    const variants = {
        primary: "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 border-transparent",
        secondary: "bg-gray-100 hover:bg-gray-200 text-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white border-transparent",
        danger: "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30 border-transparent",
        outline: "bg-transparent border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-500 hover:text-blue-500 dark:hover:border-blue-400 dark:hover:text-blue-400",
        ghost: "bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 border-transparent",
    };

    // 📏 Sizes
    const sizes = {
        small: "px-3 py-1.5 text-xs",
        medium: "px-5 py-2.5 text-sm",
        large: "px-6 py-3 text-base",
    };

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled || isLoading}
            className={`
        relative inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200
        border focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900
        disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none
        ${variants[variant] || variants.primary}
        ${sizes[size] || sizes.medium}
        ${fullWidth ? "w-full" : ""}
        ${className}
      `}
        >
            {/* 🔄 Loading Spinner */}
            {isLoading && (
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <ButtonSpinner color="currentColor" />
                </span>
            )}

            {/* 📄 Content (Hidden when loading to keep width) */}
            <span className={`flex items-center gap-2 ${isLoading ? "invisible" : ""}`}>
                {Icon && <Icon size={size === "large" ? 20 : 18} />}
                {children}
            </span>
        </button>
    );
};

export default Button;
