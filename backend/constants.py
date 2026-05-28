"""
Status constants and enums for Retail App (Fix 7.6)
Centralized status definitions to ensure consistency across the codebase.
"""

# Tailoring status values
TAILORING_STATUS = {
    "N/A": "Not applicable",
    "Not Required": "Tailoring not required",
    "Awaiting Order": "Order placed, awaiting tailoring",
    "Pending": "Tailoring in progress",
    "Stitched": "Stitching completed",
    "Delivered": "Item delivered to customer",
}

# Embroidery status values
EMBROIDERY_STATUS = {
    "N/A": "Not applicable",
    "Not Required": "Embroidery not required",
    "Required": "Embroidery required",
    "In Progress": "Embroidery in progress",
    "Finished": "Embroidery completed",
}

# Status progression for move-back operations
TAILORING_PREV = {
    "Stitched": "Pending",
    "Delivered": "Stitched",
}

EMB_PREV = {
    "In Progress": "Required",
    "Finished": "In Progress",
}

# Payment status values
PAYMENT_STATUS = {
    "Settled": "Payment completed",
    "Pending": "Payment pending",
    "N/A": "No payment required",
}

# User roles
USER_ROLES = {
    "admin": "Full system access",
    "manager": "Management access",
    "cashier": "Basic operations access",
}

# Bug report status values
BUG_REPORT_STATUS = {
    "new": "New report",
    "investigating": "Under investigation",
    "resolved": "Issue resolved",
    "wontfix": "Won't fix",
}

# Valid status values for validation
VALID_TAILORING_STATUSES = list(TAILORING_STATUS.keys())
VALID_EMBROIDERY_STATUSES = list(EMBROIDERY_STATUS.keys())
VALID_PAYMENT_STATUSES = list(PAYMENT_STATUS.keys())
VALID_USER_ROLES = list(USER_ROLES.keys())
VALID_BUG_REPORT_STATUSES = list(BUG_REPORT_STATUS.keys())
