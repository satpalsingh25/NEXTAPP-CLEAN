"use client";

import { ApprovalWorkbench } from "@/components/ApprovalWorkbench";

export default function CompliancePendingApprovalPage() {
  return <ApprovalWorkbench module="COMPLIANCE" apiBase="/api/compliance" />;
}
