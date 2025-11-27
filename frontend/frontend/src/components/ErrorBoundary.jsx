import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      componentStack: "",
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo,
      componentStack: errorInfo.componentStack,
    });

    console.error("🧱 ErrorBoundary caught:", error, errorInfo);

    this.logErrorToService(error, errorInfo);
  }

  logErrorToService = (error, errorInfo) => {
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    this.sendToErrorReportingService(error, errorInfo);
  };

  sendToErrorReportingService = async (error, errorInfo) => {
    const errorData = {
      error: error?.toString(),
      componentStack: errorInfo?.componentStack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };

    if (this.props.enableErrorReporting) {
      try {
        await fetch(
          `${import.meta.env.VITE_API_BASE_URL || ""}/api/error-log`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(errorData),
          }
        );
        console.log("📨 Error report sent");
      } catch (err) {
        console.warn("⚠️ Failed to send error report:", err.message);
      }
    }
  };

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      componentStack: "",
      retryCount: this.state.retryCount + 1,
    });
    this.props.onRetry?.();
  };

  handleReset = () => window.location.reload();
  handleGoHome = () => (window.location.href = "/");
  handleReportIssue = () => {
    const subject = encodeURIComponent(`Error: ${this.state.error?.toString()}`);
    const body = encodeURIComponent(
      `Error Details:\n\n${this.state.error}\n\nComponent Stack:\n${this.state.componentStack}\n\nURL: ${window.location.href}`
    );
    window.open(`mailto:support@krpost.com?subject=${subject}&body=${body}`);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.header}>
              <div style={styles.icon}>🚨</div>
              <h1 style={styles.title}>
                {this.props.fallbackTitle || "Something went wrong"}
              </h1>
              <p style={styles.subtitle}>
                {this.props.fallbackMessage ||
                  "We encountered an unexpected error. Please try again."}
              </p>
            </div>

            {(import.meta.env.DEV || this.props.showErrorDetails) && (
              <details style={styles.details}>
                <summary style={styles.summary}>Technical Details</summary>
                <pre style={styles.pre}>
                  {this.state.error?.toString()}
                  {"\n\n"}
                  {this.state.componentStack}
                </pre>
              </details>
            )}

            <div style={styles.actions}>
              <button
                onClick={this.handleRetry}
                style={styles.primaryButton}
                disabled={this.state.retryCount >= 3}
              >
                {this.state.retryCount >= 3
                  ? "Too many retries"
                  : "Try Again"}{" "}
                {this.state.retryCount > 0 &&
                  `(${this.state.retryCount})`}
              </button>

              <button onClick={this.handleReset} style={styles.secondaryButton}>
                Reload
              </button>

              <button onClick={this.handleGoHome} style={styles.outlineButton}>
                Home
              </button>

              {this.props.enableIssueReporting && (
                <button
                  onClick={this.handleReportIssue}
                  style={styles.warnButton}
                >
                  Report Issue
                </button>
              )}
            </div>

            <div style={styles.help}>
              <h3>Need help?</h3>
              <p>📧 support@krpost.com</p>
              <p>📚 Check documentation</p>
              <p>🔄 Refresh the page</p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/* ----------------------------- Inline Styles ----------------------------- */
const styles = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    backgroundColor: "#f8fafc",
    padding: "20px",
  },
  card: {
    backgroundColor: "white",
    padding: "40px",
    borderRadius: "16px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
    maxWidth: "600px",
    width: "100%",
    textAlign: "center",
  },
  header: { marginBottom: "24px" },
  icon: { fontSize: "48px", marginBottom: "12px" },
  title: { fontSize: "24px", margin: 0, fontWeight: 700 },
  subtitle: { color: "#64748b", marginTop: "8px" },
  details: {
    marginTop: "20px",
    textAlign: "left",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "10px",
    background: "#f9fafb",
  },
  summary: { cursor: "pointer", fontWeight: "600", color: "#1e40af" },
  pre: {
    background: "#f1f5f9",
    borderRadius: "6px",
    padding: "10px",
    overflow: "auto",
    fontSize: "12px",
  },
  actions: { display: "flex", gap: "10px", justifyContent: "center", marginTop: "20px" },
  primaryButton: {
    background: "#3b82f6",
    color: "white",
    border: "none",
    borderRadius: "8px",
    padding: "10px 20px",
    cursor: "pointer",
    fontWeight: "600",
  },
  secondaryButton: {
    background: "#6b7280",
    color: "white",
    border: "none",
    borderRadius: "8px",
    padding: "10px 20px",
    cursor: "pointer",
    fontWeight: "600",
  },
  outlineButton: {
    background: "transparent",
    color: "#3b82f6",
    border: "1px solid #3b82f6",
    borderRadius: "8px",
    padding: "10px 20px",
    cursor: "pointer",
    fontWeight: "600",
  },
  warnButton: {
    background: "#f59e0b",
    color: "white",
    border: "none",
    borderRadius: "8px",
    padding: "10px 20px",
    cursor: "pointer",
    fontWeight: "600",
  },
  help: {
    marginTop: "20px",
    borderTop: "1px solid #e5e7eb",
    paddingTop: "16px",
    fontSize: "14px",
    color: "#6b7280",
  },
};

export default ErrorBoundary;
