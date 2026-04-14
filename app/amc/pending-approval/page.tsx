"use client";

import { ApprovalWorkbench } from "@/components/ApprovalWorkbench";

export default function AMCPendingApprovalPage() {
  return <ApprovalWorkbench module="AMC" apiBase="/api/amc" />;
}
