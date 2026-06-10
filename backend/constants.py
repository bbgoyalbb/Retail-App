"""
Status constants and enums for Retail App (Fix 7.6)
Centralized status definitions to ensure consistency across the codebase.
"""

# Tailoring status values
TAILORING_STATUS = {
    "N/A": "N/A",
    "Not Required": "Not Required",
    "Awaiting Order": "Awaiting Order",
    "Pending": "Pending",
    "Stitched": "Stitched",
    "Delivered": "Delivered",
}

# Embroidery status values
EMBROIDERY_STATUS = {
    "N/A": "N/A",
    "Not Required": "Not Required",
    "Required": "Required",
    "In Progress": "In Progress",
    "Finished": "Finished",
}

LEGACY_TAILORING_STATUS_VALUES = {
    "N/A": ["Not applicable"],
    "Not Required": ["Tailoring not required"],
    "Awaiting Order": ["Order placed, awaiting tailoring"],
    "Pending": ["Tailoring in progress"],
    "Stitched": ["Stitching completed"],
    "Delivered": ["Item delivered to customer"],
}

LEGACY_EMBROIDERY_STATUS_VALUES = {
    "N/A": ["Not applicable"],
    "Not Required": ["Embroidery not required"],
    "Required": ["Embroidery required"],
    "In Progress": ["Embroidery in progress"],
    "Finished": ["Embroidery completed"],
}


def _status_query_values(statuses, legacy_map):
    if isinstance(statuses, str):
        statuses = [statuses]
    values = []
    for status in statuses:
        if not status:
            continue
        if status not in values:
            values.append(status)
        for legacy in legacy_map.get(status, []):
            if legacy not in values:
                values.append(legacy)
    return values


def tailoring_status_values(statuses):
    return _status_query_values(statuses, LEGACY_TAILORING_STATUS_VALUES)


def embroidery_status_values(statuses):
    return _status_query_values(statuses, LEGACY_EMBROIDERY_STATUS_VALUES)

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
