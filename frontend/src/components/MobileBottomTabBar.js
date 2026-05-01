import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { House, Receipt, BookOpen, Table, DotsThree, Kanban, ClipboardText, ChartBar } from "@phosphor-icons/react";

/**
 * MobileBottomTabBar - Persistent bottom tab bar for mobile navigation
 * Shows 5 primary destinations with single-tap access
 * "More" opens the full sidebar for less-used admin pages
 * 
 * @param {Object} props
 * @param {Function} props.onOpenSidebar - Callback to open the full sidebar (for "More" and admin pages)
 */
export default function MobileBottomTabBar({ onOpenSidebar }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const role = user?.role || "cashier";
  const isManager = ["admin", "manager"].includes(role);
  const isAdmin = role === "admin";

  // Define the 5 primary tabs based on user role
  const getTabs = () => {
    // All users get: Home, New Bill
    const tabs = [
      { key: "home", label: "Home", icon: House, path: "/" },
      { key: "bill", label: "Bill", icon: Receipt, path: "/new-bill" },
    ];

    // Managers get Daybook, otherwise show Job Work
    if (isManager) {
      tabs.push({ key: "daybook", label: "Daybook", icon: BookOpen, path: "/daybook" });
    } else {
      tabs.push({ key: "jobwork", label: "Job Work", icon: Kanban, path: "/jobwork" });
    }

    // Managers get Orders, otherwise show Order Status
    if (isManager) {
      tabs.push({ key: "orders", label: "Orders", icon: Table, path: "/items" });
    } else {
      tabs.push({ key: "status", label: "Status", icon: ClipboardText, path: "/order-status" });
    }

    // All users get More (opens sidebar)
    tabs.push({ key: "more", label: "More", icon: DotsThree, path: null, action: "sidebar" });

    return tabs;
  };

  const tabs = getTabs();

  const handleClick = (tab) => {
    if (tab.action === "sidebar") {
      onOpenSidebar();
    } else if (tab.path) {
      navigate(tab.path);
    }
  };

  const isActive = (tab) => {
    if (tab.action === "sidebar") return false;
    return location.pathname === tab.path;
  };

  return (
    <nav 
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--surface)] border-t border-[var(--border-subtle)] safe-area-bottom"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab);
          
          return (
            <button
              key={tab.key}
              onClick={() => handleClick(tab)}
              className={`flex flex-col items-center justify-center flex-1 h-full min-w-0 transition-colors ${
                active 
                  ? 'text-[var(--brand)]' 
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              aria-label={tab.label}
            >
              <Icon 
                size={22} 
                weight={active ? "fill" : "regular"} 
                className="flex-shrink-0"
              />
              <span className="text-[10px] font-medium mt-0.5 truncate max-w-full px-1">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
      
      {/* iOS home indicator spacing */}
      <div className="h-[env(safe-area-inset-bottom,0px)]" />
    </nav>
  );
}
