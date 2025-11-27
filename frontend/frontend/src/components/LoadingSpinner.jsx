// ============================================================
// 🌐 LoadingSpinner.jsx - Final Production-Ready Version
// ============================================================

import React from "react";

const LoadingSpinner = ({
  size = "medium", // 'small' | 'medium' | 'large' | 'xlarge'
  color = "#3b82f6", // Primary blue
  type = "spinner", // 'spinner' | 'dots' | 'pulse' | 'ring' | 'bounce'
  text = "",
  overlay = false,
  fullScreen = false,
  centered = true,
  className = "", // Tailwind support
}) => {
  // 🔹 Size presets
  const sizes = {
    small: { spinner: 16, dots: 4, pulse: 16, ring: 40, bounce: 12, text: 12 },
    medium: { spinner: 24, dots: 6, pulse: 24, ring: 60, bounce: 16, text: 14 },
    large: { spinner: 32, dots: 8, pulse: 32, ring: 80, bounce: 20, text: 16 },
    xlarge: { spinner: 48, dots: 10, pulse: 48, ring: 100, bounce: 24, text: 18 },
  };
  const current = sizes[size] || sizes.medium;

  // 🔹 Different animation styles
  const spinnerTypes = {
    spinner: (
      <div
        style={{
          width: current.spinner,
          height: current.spinner,
          border: `2px solid ${color}33`,
          borderTop: `2px solid ${color}`,
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />
    ),
    dots: (
      <div style={{ display: "flex", gap: 4 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: current.dots,
              height: current.dots,
              backgroundColor: color,
              borderRadius: "50%",
              animation: "bounce 1.4s infinite ease-in-out both",
              animationDelay: `${i * 0.16}s`,
            }}
          />
        ))}
      </div>
    ),
    pulse: (
      <div
        style={{
          width: current.pulse,
          height: current.pulse,
          backgroundColor: color,
          borderRadius: "50%",
          animation: "pulse 1.5s ease-in-out infinite both",
        }}
      />
    ),
    ring: (
      <div style={{ position: "relative", width: current.ring, height: current.ring }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              border: "3px solid transparent",
              borderTop: `3px solid ${color}`,
              borderRadius: "50%",
              animation: "spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite",
              animationDelay: `${-0.45 + i * 0.15}s`,
            }}
          />
        ))}
      </div>
    ),
    bounce: (
      <div style={{ display: "flex", gap: 3, alignItems: "flex-end" }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: current.bounce,
              height: current.bounce,
              backgroundColor: color,
              borderRadius: "50%",
              animation: "bounceScale 1.4s ease-in-out infinite both",
              animationDelay: `${i * 0.16}s`,
            }}
          />
        ))}
      </div>
    ),
  };

  // 🔹 Spinner content (with optional text)
  const spinnerContent = (
    <div
      className={className}
      role="status"
      aria-busy="true"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: text ? 12 : 0,
      }}
    >
      {spinnerTypes[type] || spinnerTypes.spinner}
      {text && (
        <div style={{ fontSize: current.text, color, fontWeight: 500, marginTop: 8 }}>{text}</div>
      )}
    </div>
  );

  // 🔹 Overlay and fullScreen mode
  const containerStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    ...(centered && { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }),
    ...(overlay && {
      position: "absolute",
      inset: 0,
      backgroundColor: "rgba(255,255,255,0.85)",
      backdropFilter: "blur(2px)",
      zIndex: 1000,
    }),
    ...(fullScreen && {
      position: "fixed",
      inset: 0,
      backgroundColor: "rgba(255,255,255,0.95)",
      backdropFilter: "blur(4px)",
      zIndex: 9999,
    }),
  };

  // 🔹 Final JSX with animations
  return (
    <>
      {overlay || fullScreen ? <div style={containerStyle}>{spinnerContent}</div> : spinnerContent}

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1); }
          }
          @keyframes pulse {
            0%, 100% { transform: scale(0.9); opacity: 0.8; }
            50% { transform: scale(1.2); opacity: 1; }
          }
          @keyframes bounceScale {
            0%, 80%, 100% { transform: scale(0.3); }
            40% { transform: scale(1); }
          }
        `}
      </style>
    </>
  );
};

// ============================================================
// 🔧 Preset Variants for Common Usage
// ============================================================

export const PageLoader = ({ text = "Loading..." }) => (
  <LoadingSpinner type="ring" size="large" color="#3b82f6" text={text} fullScreen />
);

export const ButtonSpinner = ({ size = "small", color = "currentColor" }) => (
  <LoadingSpinner type="spinner" size={size} color={color} centered={false} />
);

export const InlineLoader = ({ text = "" }) => (
  <LoadingSpinner type="dots" size="small" color="#6b7280" text={text} centered={false} />
);

export const UploadSpinner = ({ text = "Uploading..." }) => (
  <LoadingSpinner type="pulse" size="medium" color="#10b981" text={text} />
);

export const ProcessingSpinner = ({ text = "Processing..." }) => (
  <LoadingSpinner type="bounce" size="medium" color="#f59e0b" text={text} />
);

export const SectionLoader = ({ text = "", height = "200px" }) => (
  <div style={{ position: "relative", height, width: "100%" }}>
    <LoadingSpinner type="spinner" size="medium" color="#6b7280" text={text} overlay />
  </div>
);

export default LoadingSpinner;
