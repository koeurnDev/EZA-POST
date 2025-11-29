// ============================================================
// 🌐 AccountSelector.jsx - Optimized & Stable Final Version
// ============================================================

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useDeferredValue,
} from "react";

// 🕒 Polyfill for requestIdleCallback (for Safari/Firefox)
const safeRequestIdleCallback =
  window.requestIdleCallback ||
  function (cb) {
    return setTimeout(cb, 1);
  };

const safeCancelIdleCallback =
  window.cancelIdleCallback ||
  function (id) {
    clearTimeout(id);
  };

// ============================================================
// 💡 Main Component
// ============================================================
const AccountSelector = React.memo(function AccountSelector({
  accounts = [],
  availablePages = [],
  onChange,
}) {
  const [selectedAccounts, setSelectedAccounts] = useState(accounts);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [customAccounts, setCustomAccounts] = useState([]);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const deferredSearch = useDeferredValue(searchTerm);

  // --- Load custom accounts from localStorage ---
  useEffect(() => {
    const id = safeRequestIdleCallback(() => {
      try {
        const saved = localStorage.getItem("eza_post_custom_accounts");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setCustomAccounts(parsed);
        }
      } catch {
        setCustomAccounts([]);
      }
    });
    return () => safeCancelIdleCallback(id);
  }, []);

  // --- Save custom accounts to localStorage (debounced) ---
  useEffect(() => {
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem(
          "eza_post_custom_accounts",
          JSON.stringify(customAccounts)
        );
      } catch {
        // ignore
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [customAccounts]);

  // --- Notify parent on change ---
  useEffect(() => {
    onChange?.(selectedAccounts);
  }, [selectedAccounts, onChange]);

  // --- Combine available + custom ---
  const allAccounts = useMemo(
    () => [...availablePages, ...customAccounts],
    [availablePages, customAccounts]
  );

  // --- Filter accounts by search term ---
  const filteredAccounts = useMemo(() => {
    const term = deferredSearch.toLowerCase();
    return allAccounts.filter((acc) => {
      const name = acc.name?.toLowerCase() || "";
      const id = String(acc.id || "");
      return name.includes(term) || id.includes(term);
    });
  }, [allAccounts, deferredSearch]);

  // --- Toggle selected account ---
  const toggleAccount = useCallback((id, name) => {
    const key = String(id || name);
    setSelectedAccounts((prev) =>
      prev.includes(key)
        ? prev.filter((a) => a !== key)
        : [...prev, key]
    );
  }, []);

  // --- Add custom account ---
  const addCustomAccount = useCallback(() => {
    const id = prompt("Enter Facebook Page ID, Group ID, or Username:");
    if (!id?.trim()) return;
    const name = prompt("Enter display name:") || id;
    const newAcc = { id: id.trim(), name: name.trim(), custom: true };

    setCustomAccounts((prev) => {
      if (prev.some((a) => a.id === newAcc.id)) {
        alert("Account ID already exists!");
        return prev;
      }
      return [...prev, newAcc];
    });

    toggleAccount(newAcc.id, newAcc.name);
    setSearchTerm("");
  }, [toggleAccount]);

  // --- Remove custom account ---
  const removeCustomAccount = useCallback((id, e) => {
    e?.stopPropagation();
    if (confirm("Remove this custom account?")) {
      setCustomAccounts((prev) => prev.filter((a) => a.id !== id));
      setSelectedAccounts((prev) => prev.filter((a) => a !== id));
    }
  }, []);

  // --- Clear all ---
  const clearAll = useCallback(() => {
    if (selectedAccounts.length && confirm("Clear all selected?")) {
      setSelectedAccounts([]);
    }
  }, [selectedAccounts]);

  // --- Keyboard navigation ---
  const handleKeyDown = useCallback(
    (e) => {
      if (!showDropdown) return;
      if (e.key === "Escape") return setShowDropdown(false);
      if (e.key === "ArrowDown")
        setFocusedIndex((i) => (i < filteredAccounts.length - 1 ? i + 1 : 0));
      if (e.key === "ArrowUp")
        setFocusedIndex((i) => (i > 0 ? i - 1 : filteredAccounts.length - 1));
      if (e.key === "Enter" && filteredAccounts[focusedIndex]) {
        const acc = filteredAccounts[focusedIndex];
        toggleAccount(acc.id, acc.name);
      }
    },
    [showDropdown, filteredAccounts, focusedIndex, toggleAccount]
  );

  useEffect(() => setFocusedIndex(-1), [filteredAccounts]);

  const getAccountType = (acc) =>
    acc.custom ? "custom" : acc.category ? "page" : acc.type || "unknown";

  const colorMap = {
    custom: "bg-amber-500",
    page: "bg-blue-500",
    group: "bg-emerald-500",
    profile: "bg-violet-500",
    unknown: "bg-gray-500",
  };

  // ============================================================
  // 🧱 Render
  // ============================================================
  return (
    <div className="relative w-full" onKeyDown={handleKeyDown}>
      {/* --- Selector --- */}
      <div
        className={`border rounded-lg p-3 min-h-[52px] bg-white cursor-pointer flex flex-wrap gap-2 items-center shadow-sm transition-all duration-200 ${showDropdown
          ? "border-blue-500 ring-2 ring-blue-200"
          : "border-gray-300"
          }`}
        onClick={(e) => {
          e.stopPropagation();
          setShowDropdown(!showDropdown);
        }}
        tabIndex={0}
        role="combobox"
        aria-expanded={showDropdown}
        aria-activedescendant={
          focusedIndex >= 0 && filteredAccounts[focusedIndex]
            ? `acc-${filteredAccounts[focusedIndex].id}`
            : undefined
        }
      >
        {selectedAccounts.length > 0 ? (
          <>
            {selectedAccounts.map((id) => {
              const acc = allAccounts.find((a) => String(a.id || a.name) === id) || {
                id,
                name: id,
                type: "unknown",
              };
              return (
                <span
                  key={id}
                  className="bg-blue-50 border border-blue-100 text-sm font-medium rounded-full px-3 py-1 flex items-center gap-1 max-w-[200px] truncate"
                  title={acc.name}
                >
                  {acc.picture && (
                    <img
                      src={acc.picture}
                      alt=""
                      className="w-4 h-4 rounded-full object-cover"
                    />
                  )}
                  {acc.name}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAccount(acc.id, acc.name);
                    }}
                    className="text-red-500 hover:bg-red-100 rounded-full w-5 h-5 flex items-center justify-center"
                    aria-label={`Remove ${acc.name}`}
                  >
                    ×
                  </button>
                </span>
              );
            })}
            <span className="ml-auto text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600">
              {selectedAccounts.length} selected
            </span>
          </>
        ) : (
          <span className="text-gray-400 text-sm">
            Select Facebook accounts...
          </span>
        )}
      </div>

      {/* --- Dropdown --- */}
      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-10 bg-transparent"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-xl mt-1 z-20 max-h-[400px] overflow-auto">
            {/* Search */}
            <div className="p-3 border-b bg-gray-50">
              <input
                type="text"
                placeholder="Search accounts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                autoFocus
              />
            </div>

            {/* Actions */}
            <div className="p-3 flex gap-2 border-b bg-gray-50">
              <button
                onClick={addCustomAccount}
                className="bg-emerald-500 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-emerald-600 transition"
              >
                + Add Custom
              </button>
              {selectedAccounts.length > 0 && (
                <button
                  onClick={clearAll}
                  className="bg-red-500 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-red-600 transition"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* List */}
            {filteredAccounts.length === 0 ? (
              <div className="text-center text-gray-500 py-8 text-sm flex flex-col items-center gap-3">
                <div className="text-3xl">🔍</div>
                <p>No accounts found.</p>
                <button
                  onClick={() => window.location.href = `${(import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/api$/, "")}/api/auth/facebook`}
                  className="mt-2 px-4 py-2 bg-[#1877f2] hover:bg-[#166fe5] text-white rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
                >
                  <span>📘</span> Connect Facebook
                </button>
              </div>
            ) : (
              filteredAccounts.map((acc, i) => {
                const selected = selectedAccounts.includes(String(acc.id || acc.name));
                const type = getAccountType(acc);
                return (
                  <div
                    key={acc.id || i}
                    id={`acc-${acc.id}`}
                    className={`flex items-center justify-between px-4 py-3 border-b cursor-pointer transition ${selected
                      ? "bg-blue-50 border-blue-100"
                      : i === focusedIndex
                        ? "bg-gray-100"
                        : "hover:bg-gray-50"
                      }`}
                    onClick={() => toggleAccount(acc.id, acc.name)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {acc.picture ? (
                        <img
                          src={acc.picture}
                          alt={acc.name}
                          className="w-8 h-8 rounded-full object-cover border border-gray-200"
                        />
                      ) : (
                        <div
                          className={`w-8 h-8 border-2 rounded-full ${selected
                            ? "border-blue-500 bg-blue-500 text-white"
                            : "border-gray-300 bg-gray-100 text-gray-500"
                            } flex items-center justify-center text-xs font-bold`}
                        >
                          {acc.name?.[0]}
                        </div>
                      )}
                      <div className="flex-1 truncate">
                        <div className="font-medium text-sm truncate">
                          {acc.name}
                        </div>
                        <div className="text-xs text-gray-500 flex gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-white text-[10px] font-semibold ${colorMap[type]}`}
                          >
                            {type.toUpperCase()}
                          </span>
                          {acc.id && <span>ID: {acc.id}</span>}
                        </div>
                      </div>
                    </div>
                    {acc.custom && (
                      <button
                        onClick={(e) => removeCustomAccount(acc.id, e)}
                        className="text-gray-400 hover:text-red-500 text-sm"
                        title="Remove custom account"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                );
              })
            )}

            {/* Footer */}
            <div className="p-3 text-xs text-gray-500 text-center bg-gray-50 border-t">
              {selectedAccounts.length} selected • {filteredAccounts.length} total
            </div>
          </div>
        </>
      )}
    </div>
  );
});

export default AccountSelector;
