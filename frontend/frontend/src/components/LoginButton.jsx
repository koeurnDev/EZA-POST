import React, { useState, useCallback } from "react";

const LoginButton = ({
  onFacebookLogin,
  loading = false,
  variant = "default",
  size = "medium",
}) => {
  const [ripples, setRipples] = useState([]);
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  // 🔹 Handle Click
  const handleLoginClick = useCallback(() => {
    if (!loading && onFacebookLogin) onFacebookLogin();
  }, [loading, onFacebookLogin]);

  // 🔹 Ripple effect
  const createRipple = (e) => {
    if (loading) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    const newRipple = {
      id: Date.now(),
      style: {
        position: "absolute",
        borderRadius: "50%",
        backgroundColor: "rgba(255,255,255,0.4)",
        width: size,
        height: size,
        left: x,
        top: y,
        transform: "scale(0)",
        animation: "ripple 0.6s ease-out",
        pointerEvents: "none",
      },
    };

    setRipples((prev) => [...prev, newRipple]);
    setTimeout(
      () => setRipples((prev) => prev.filter((r) => r.id !== newRipple.id)),
      600
    );
    handleLoginClick();
  };

  // 🔹 Button Styles
  const getButtonStyles = () => {
    const base = {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "12px",
      border: "none",
      borderRadius: "8px",
      fontWeight: 600,
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      cursor: loading ? "not-allowed" : "pointer",
      transition: "all 0.25s ease",
      width: "100%",
      position: "relative",
      overflow: "hidden",
      userSelect: "none",
    };

    const sizes = {
      small: { padding: "8px 14px", fontSize: 14 },
      medium: { padding: "12px 18px", fontSize: 15 },
      large: { padding: "16px 24px", fontSize: 16 },
    };

    const variants = {
      default: {
        backgroundColor: "#1877f2",
        color: "#fff",
        hover: {
          backgroundColor: "#166fe5",
          transform: "translateY(-2px)",
          boxShadow: "0 8px 18px rgba(24, 119, 242, 0.25)",
        },
        active: { backgroundColor: "#145dbf" },
      },
      outline: {
        backgroundColor: "transparent",
        color: "#1877f2",
        border: "2px solid #1877f2",
        hover: {
          backgroundColor: "#1877f2",
          color: "#fff",
          transform: "translateY(-2px)",
        },
        active: { backgroundColor: "#145dbf", borderColor: "#145dbf" },
      },
      minimal: {
        backgroundColor: "#f0f2f5",
        color: "#1877f2",
        hover: { backgroundColor: "#e4e6eb" },
        active: { backgroundColor: "#d8dadf" },
      },
    };

    const style = {
      ...base,
      ...sizes[size],
      ...variants[variant],
      ...(isHovered && !loading ? variants[variant].hover : {}),
      ...(isPressed && !loading ? variants[variant].active : {}),
      ...(loading ? { opacity: 0.7, transform: "none" } : {}),
    };
    return style;
  };

  // 🔹 UI Parts
  const styles = {
    icon: { fontSize: size === "small" ? 16 : 20 },
    spinner: {
      width: size === "small" ? 16 : 20,
      height: size === "small" ? 16 : 20,
      border: "2px solid transparent",
      borderTop: "2px solid currentColor",
      borderRadius: "50%",
      animation: "spin 1s linear infinite",
    },
    text: { flex: 1, textAlign: "center", whiteSpace: "nowrap" },
    featureList: {
      marginTop: 10,
      fontSize: 13,
      textAlign: "center",
      color: "#666",
      lineHeight: 1.6,
    },
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 400,
        margin: "0 auto",
        textAlign: "center",
      }}
    >
      <button
        style={getButtonStyles()}
        onClick={createRipple}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setIsPressed(false);
        }}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onTouchStart={() => setIsPressed(true)}
        onTouchEnd={() => setIsPressed(false)}
        disabled={loading}
        aria-busy={loading}
        aria-label="Login with Facebook"
      >
        {ripples.map((r) => (
          <span key={r.id} style={r.style} />
        ))}
        {loading ? (
          <>
            <div style={styles.spinner} />
            <span style={styles.text}>Connecting to Facebook...</span>
          </>
        ) : (
          <>
            <span style={styles.icon}>📘</span>
            <span style={styles.text}>
              {variant === "minimal"
                ? "Continue with Facebook"
                : "Login with Facebook"}
            </span>
          </>
        )}
      </button>

      {/* 💡 Features below main button */}
      {variant === "default" && (
        <div style={styles.featureList}>
          ✅ Post TikTok videos automatically <br />
          ✅ Schedule Facebook posts <br />
          ✅ Auto-reply to comments <br />
          🔒 Secure OAuth 2.0 Login (No password stored)
        </div>
      )}

      <style>
        {`
            @keyframes ripple {
              to { transform: scale(4); opacity: 0; }
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            button:focus-visible {
              outline: 2px solid #1877f2;
              outline-offset: 3px;
            }
          `}
      </style>
    </div>
  );
};

export default LoginButton;
