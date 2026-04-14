"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface User {
  id: string;
  email: string;
  role: string;
}

interface Template {
  id: string;
  title: string;
}

const quickLinks = [
  { label: "Manage Users",     href: "/admin/users",     desc: "Create, view, and update user roles" },
  { label: "Manage Companies", href: "/admin/companies", desc: "Add and view tenant companies" },
  { label: "Templates",        href: "/admin/templates", desc: "Manage compliance templates" },
  { label: "Approval Matrix",  href: "/admin/approval-matrix", desc: "Configure approval levels" },
];

export default function AdminPage() {
  const [userCount, setUserCount] = useState<number | null>(null);
  const [templateCount, setTemplateCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => setUserCount(Array.isArray(d) ? d.length : 0));
    fetch("/api/templates")
      .then((r) => r.json())
      .then((d: Template[]) => setTemplateCount(Array.isArray(d) ? d.length : 0));
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Overview</h1>
        <p className="text-sm text-gray-500 mt-1">Manage users, companies, and system configuration</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Users</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {userCount === null ? "—" : userCount}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Templates</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {templateCount === null ? "—" : templateCount}
          </p>
        </div>
      </div>

      {/* Quick links */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Quick Access</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {quickLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-blue-300 transition-all group"
            >
              <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                {item.label}
              </p>
              <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
