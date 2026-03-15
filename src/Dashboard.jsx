import { useEffect, useRef, useState } from "react";
import { useAuth, useClerk, useUser } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import { BASE_URL } from "./Constants";

const primaryNav = [
  "Dashboard",
  "New Quote",
  "Quotes",
  "Clients",
  "Templates",
];

const secondaryNav = ["Billing", "Settings", "Help"];
const apiBaseUrl = `${BASE_URL}`;
const SUBSCRIPTION_STORAGE_KEY = "subscription_snapshot";

function getStoredSubscriptionUsage() {
  const fallback = {
    planCode: "FREE",
    quotaLimit: 5,
    quotaUsed: 3,
    quotaRemaining: 2,
  };

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = localStorage.getItem(SUBSCRIPTION_STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);
    const quotaSource = parsed?.quota && typeof parsed.quota === "object" ? parsed.quota : parsed;
    const quotaLimit = Number(quotaSource?.quota_limit);
    const quotaUsed = Number(quotaSource?.quota_used);
    const quotaRemaining = Number(quotaSource?.quota_remaining);

    const normalizedLimit = Number.isFinite(quotaLimit) && quotaLimit >= 0 ? quotaLimit : fallback.quotaLimit;
    const normalizedUsed = Number.isFinite(quotaUsed) && quotaUsed >= 0 ? quotaUsed : fallback.quotaUsed;
    const normalizedRemaining = Number.isFinite(quotaRemaining) && quotaRemaining >= 0
      ? quotaRemaining
      : Math.max(normalizedLimit - normalizedUsed, 0);

    return {
      planCode: String(parsed?.plan_code || fallback.planCode),
      quotaLimit: normalizedLimit,
      quotaUsed: normalizedUsed,
      quotaRemaining: normalizedRemaining,
    };
  } catch {
    return fallback;
  }
}

// KPIs: Quotes This Month, Total Lifetime Quotes, Total Quote Value ($), Quote Value This Month ($)
function getKpiCards(quotes, currencySymbol = "$") {
  // Get current month/year
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Quotes this month
  const quotesThisMonth = quotes.filter((q) => {
    if (!q.updated) return false;
    const date = new Date(q.updated);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  // Total Lifetime Quotes
  const totalLifetimeQuotes = quotes.length;

  // Total Quote Value ($)
  const totalQuoteValue = quotes.reduce((sum, q) => {
    // Remove currency symbol and commas
    const val = typeof q.amount === "string" ? q.amount.replace(/[^\d.]/g, "") : q.amount;
    return sum + (parseFloat(val) || 0);
  }, 0);

  // Quote Value This Month ($)
  const quoteValueThisMonth = quotesThisMonth.reduce((sum, q) => {
    const val = typeof q.amount === "string" ? q.amount.replace(/[^\d.]/g, "") : q.amount;
    return sum + (parseFloat(val) || 0);
  }, 0);

  return [
    { label: "Quotes This Month", value: quotesThisMonth.length },
    { label: "Total Lifetime Quotes", value: totalLifetimeQuotes },
    { label: `Total Quote Value (${currencySymbol})`, value: `${currencySymbol}${totalQuoteValue.toLocaleString()}` },
    { label: `Quote Value This Month (${currencySymbol})`, value: `${currencySymbol}${quoteValueThisMonth.toLocaleString()}` },
  ];
}

const initialRecentQuotes = [
  {
    id: "Q-1001",
    client: "Acme Retail",
    amount: "$1,800",
    status: "Draft",
    updated: "2h ago",
  },
  {
    id: "Q-1002",
    client: "Northwind Labs",
    amount: "$3,200",
    status: "Sent",
    updated: "1d ago",
  },
  {
    id: "Q-1003",
    client: "Pixel Forge",
    amount: "$950",
    status: "Accepted",
    updated: "3d ago",
  },
];

const initialClients = [
  { id: "CL-1", name: "Acme Retail", activeQuotes: 3 },
  { id: "CL-2", name: "Northwind Labs", activeQuotes: 2 },
  { id: "CL-3", name: "Pixel Forge", activeQuotes: 1 },
];

const templateCards = [
  {
    id: "TMP-1",
    name: "Web App MVP",
    category: "Web App",
    budgetRange: "$2,000 - $5,000",
    summary: "Landing page, auth, dashboard, and admin basics.",
    modules: 8,
    preset: {
      clientName: "Acme Retail",
      projectTitle: "Web App MVP",
      scopeSummary:
        "Landing page, user auth, dashboard, profile settings, and admin panel with basic analytics.",
      timeline: "6 weeks",
      budget: "$3,500",
      pricingModel: "Milestone-based",
      terms: "40% upfront, 30% midpoint, 30% on handover",
    },
  },
  {
    id: "TMP-2",
    name: "Mobile App Launch",
    category: "Mobile App",
    budgetRange: "$3,000 - $7,000",
    summary: "Cross-platform app with API integration and release support.",
    modules: 10,
    preset: {
      clientName: "Northwind Labs",
      projectTitle: "Mobile App Launch",
      scopeSummary:
        "React Native app, auth, profile, push notifications, backend API integration, and app store submission support.",
      timeline: "8 weeks",
      budget: "$5,200",
      pricingModel: "Fixed",
      terms: "50% upfront, 50% before production release",
    },
  },
  {
    id: "TMP-3",
    name: "Maintenance Retainer",
    category: "Maintenance",
    budgetRange: "$800 - $2,000",
    summary: "Monthly bug fixes, performance checks, and minor enhancements.",
    modules: 5,
    preset: {
      clientName: "Pixel Forge",
      projectTitle: "Monthly Maintenance Retainer",
      scopeSummary:
        "Bug fixes, dependency updates, uptime monitoring, monthly performance optimization, and minor feature requests.",
      timeline: "Monthly",
      budget: "$1,200",
      pricingModel: "Hourly",
      terms: "Billed monthly with 20-hour cap",
    },
  },
];

const initialTemplateForm = {
  name: "",
  category: "Web App",
  budgetRange: "",
  summary: "",
  modules: "",
  timeline: "",
  pricingModel: "Fixed",
  terms: "",
};

const initialSettingsForm = {
  workspaceName: "",
  notificationEmails: true,
  timezone: "UTC",
  defaultPricingModel: "Fixed",
  currency: "USD",
  defaultQuoteValidityDays: "14",
};

const currencySymbols = { USD: "$", EUR: "€", INR: "₹", GBP: "£" };

function getCurrencySymbol(currency) {
  return currencySymbols[currency] || currency;
}

function buildInitialCreateForm(defaultPricingModel = "Fixed") {
  return {
    clientName: "",
    projectTitle: "",
    scopeSummary: "",
    timeline: "",
    budget: "",
    pricingModel: defaultPricingModel,
    terms: "",
  };
}

function wait(duration) {
  return new Promise((resolve) => {
    setTimeout(resolve, duration);
  });
}

function NavItem({ label, active = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
        active
          ? "bg-blue-50 text-blue-700"
          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {label}
    </button>
  );
}

function Sidebar({
  onNavigate,
  onLogout,
  isLoggingOut = false,
  planUsage,
  userName = "User",
}) {
  const usagePercent =
    planUsage.quotaLimit > 0
      ? Math.max(
          0,
          Math.min(100, (planUsage.quotaUsed / planUsage.quotaLimit) * 100),
        )
      : 0;


  return (
    <aside className="flex h-full w-64 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="m-0 text-lg font-bold text-slate-900">FlashQuote AI</p>
        <p className="mt-1 text-xs text-slate-500">Personal Workspace</p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Main
        </p>
        <div className="mt-2 space-y-1">
          {primaryNav.map((item, index) => (
            <NavItem
              key={item}
              label={item}
              active={index === 0}
              onClick={() => onNavigate?.(item)}
            />
          ))}
        </div>

        <p className="mt-6 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Account
        </p>
        <div className="mt-2 space-y-1">
          {secondaryNav.map((item) => (
            <NavItem key={item} label={item} onClick={() => onNavigate?.(item)} />
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="m-0 text-sm font-semibold text-slate-900">{userName}</p>
          <p className="mt-0.5 text-xs text-slate-500">{planUsage.planCode} Plan</p>
          <p className="mt-3 text-xs text-slate-600">
            Usage this month: {planUsage.quotaUsed} / {planUsage.quotaLimit} quotes
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-blue-600"
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <button
            type="button"
            onClick={onLogout}
            disabled={isLoggingOut}
            className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
          >
            {isLoggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>
    </aside>
  );
}

function UploadBriefModal({
  isOpen,
  onClose,
  onGenerateQuote,
  uploadState,
  selectedFileName,
  onFileChange,
  onStartUpload,
  onReplaceFile,
  onEditInputs,
  errorMessage,
  clientName,
  setClientName,
  projectType,
  setProjectType,
  parsedSummary,
}) {

  if (!isOpen) {
    return null;
  }
  // If user is on FREE plan, show upgrade message instead of modal content
  if (typeof window !== "undefined") {
    const planCode = (window.localStorage.getItem("subscription_snapshot") && JSON.parse(window.localStorage.getItem("subscription_snapshot")).plan_code) || "FREE";
    if (planCode.toUpperCase() === "FREE") {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="m-0 text-xl font-semibold text-slate-900">Upload Brief</h2>
                <p className="mt-1 text-sm text-slate-600">
                  This feature is available on paid plans only.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
              >
                Close
              </button>
            </div>
            <div className="py-8 text-center text-slate-600">
              <p className="text-lg font-semibold">Upgrade your plan to use Upload Brief and auto-extract requirements from files.</p>
            </div>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-xl font-semibold text-slate-900">Upload Brief</h2>
            <p className="mt-1 text-sm text-slate-600">
              Upload a project brief to pre-fill quote details.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
          >
            Close
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Client Name (optional)
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
                placeholder="Acme Retail"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Project Type (optional)
              </label>
              <input
                type="text"
                value={projectType}
                onChange={(event) => setProjectType(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
                placeholder="Web App"
              />
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="m-0 text-sm font-medium text-slate-800">
              Upload file (.pdf, .doc, .docx, .txt)
            </p>
            <p className="mt-1 text-xs text-slate-500">Max size: 10 MB</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                Browse File
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  className="hidden"
                  onChange={onFileChange}
                />
              </label>
              {selectedFileName ? (
                <span className="text-sm text-slate-700">Selected: {selectedFileName}</span>
              ) : (
                <span className="text-sm text-slate-500">No file selected</span>
              )}
            </div>
          </div>

          {uploadState === "uploading" ? (
            <p className="text-sm font-medium text-blue-700">Uploading brief...</p>
          ) : null}
          {uploadState === "parsing" ? (
            <p className="text-sm font-medium text-blue-700">Extracting requirements...</p>
          ) : null}
          {uploadState === "error" ? (
            <p className="text-sm font-medium text-red-600">{errorMessage}</p>
          ) : null}

          {uploadState === "success" ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <p className="m-0 text-sm font-semibold text-green-700">
                Brief parsed successfully
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {parsedSummary.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            {uploadState === "success" ? (
              <>
                <button
                  type="button"
                  onClick={onEditInputs}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Edit Inputs
                </button>
                <button
                  type="button"
                  onClick={onReplaceFile}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Replace File
                </button>
                <button
                  type="button"
                  onClick={onGenerateQuote}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Generate Quote
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onStartUpload}
                disabled={uploadState === "uploading" || uploadState === "parsing"}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Start Upload
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateQuoteModal({
  isOpen,
  onClose,
  form,
  setForm,
  step,
  setStep,
  onCreateDraft,
  isCreating,
  currencySymbol = "$",
}) {
  if (!isOpen) {
    return null;
  }

  const totalSteps = 4;

  const nextStep = () => {
    setStep((current) => Math.min(current + 1, totalSteps));
  };

  const previousStep = () => {
    setStep((current) => Math.max(current - 1, 1));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-xl font-semibold text-slate-900">Create New Quote</h2>
            <p className="mt-1 text-sm text-slate-600">
              Step {step} of {totalSteps}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
          >
            Close
          </button>
        </div>

        <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>

        {step === 1 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Client Name
              </label>
              <input
                type="text"
                value={form.clientName}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, clientName: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
                placeholder="Acme Retail"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Project Title
              </label>
              <input
                type="text"
                value={form.projectTitle}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, projectTitle: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
                placeholder="E-commerce Web App"
              />
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Scope Summary
              </label>
              <textarea
                rows={4}
                value={form.scopeSummary}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, scopeSummary: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
                placeholder="Catalog, cart, checkout, admin dashboard"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Timeline
                </label>
                <input
                  type="text"
                  value={form.timeline}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, timeline: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
                  placeholder="6 weeks"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Budget Estimate
                </label>
                <input
                  type="text"
                  value={form.budget}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, budget: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
                  placeholder={`${currencySymbol}3,000`}
                />
              </div>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Pricing Model
              </label>
              <select
                value={form.pricingModel}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, pricingModel: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
              >
                <option>Fixed</option>
                <option>Hourly</option>
                <option>Milestone-based</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Terms
              </label>
              <input
                type="text"
                value={form.terms}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, terms: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
                placeholder="50% upfront, 50% on delivery"
              />
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <p className="m-0 font-semibold text-slate-900">Review Draft</p>
            <div className="mt-3 space-y-1 text-slate-700">
              <p className="m-0">Client: {form.clientName || "-"}</p>
              <p className="m-0">Project: {form.projectTitle || "-"}</p>
              <p className="m-0">Scope: {form.scopeSummary || "-"}</p>
              <p className="m-0">Timeline: {form.timeline || "-"}</p>
              <p className="m-0">Budget: {form.budget || "-"}</p>
              <p className="m-0">Pricing: {form.pricingModel}</p>
              <p className="m-0">Terms: {form.terms || "-"}</p>
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={previousStep}
            disabled={step === 1 || isCreating}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Back
          </button>
          {step < totalSteps ? (
            <button
              type="button"
              onClick={nextStep}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={onCreateDraft}
              disabled={isCreating}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreating ? "Creating..." : "Create Draft"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AddClientModal({
  isOpen,
  onClose,
  clientForm,
  setClientForm,
  onSave,
  isSaving,
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-xl font-semibold text-slate-900">Add Client</h2>
            <p className="mt-1 text-sm text-slate-600">
              Create a new client profile for future quotes.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
          >
            Close
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Client Name
            </label>
            <input
              type="text"
              value={clientForm.name}
              onChange={(event) =>
                setClientForm((previous) => ({ ...previous, name: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
              placeholder="Client name"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Active Quotes
            </label>
            <input
              type="number"
              min="0"
              value={clientForm.activeQuotes}
              onChange={(event) =>
                setClientForm((previous) => ({
                  ...previous,
                  activeQuotes: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
              placeholder="0"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save Client"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateTemplateModal({
  isOpen,
  onClose,
  templateForm,
  setTemplateForm,
  onSave,
  isSaving,
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-xl font-semibold text-slate-900">Create Template</h2>
            <p className="mt-1 text-sm text-slate-600">
              Save a reusable quote format.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Template Name
            </label>
            <input
              type="text"
              value={templateForm.name}
              onChange={(event) =>
                setTemplateForm((previous) => ({ ...previous, name: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
              placeholder="API Integration Package"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Category
            </label>
            <select
              value={templateForm.category}
              onChange={(event) =>
                setTemplateForm((previous) => ({ ...previous, category: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
            >
              <option>Web App</option>
              <option>Mobile App</option>
              <option>SaaS</option>
              <option>Maintenance</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Budget Range
            </label>
            <input
              type="text"
              value={templateForm.budgetRange}
              onChange={(event) =>
                setTemplateForm((previous) => ({ ...previous, budgetRange: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
              placeholder="$1,500 - $3,000"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Modules Count
            </label>
            <input
              type="number"
              min="1"
              value={templateForm.modules}
              onChange={(event) =>
                setTemplateForm((previous) => ({ ...previous, modules: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
              placeholder="6"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Summary
            </label>
            <textarea
              rows={3}
              value={templateForm.summary}
              onChange={(event) =>
                setTemplateForm((previous) => ({ ...previous, summary: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
              placeholder="Short template summary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Default Timeline
            </label>
            <input
              type="text"
              value={templateForm.timeline}
              onChange={(event) =>
                setTemplateForm((previous) => ({ ...previous, timeline: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
              placeholder="4 weeks"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Pricing Model
            </label>
            <select
              value={templateForm.pricingModel}
              onChange={(event) =>
                setTemplateForm((previous) => ({ ...previous, pricingModel: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
            >
              <option>Fixed</option>
              <option>Hourly</option>
              <option>Milestone-based</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Terms
            </label>
            <input
              type="text"
              value={templateForm.terms}
              onChange={(event) =>
                setTemplateForm((previous) => ({ ...previous, terms: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
              placeholder="50% upfront, 50% on delivery"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save Template"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UpgradePlanModal({
  isOpen,
  onClose,
  selectedPlan,
  setSelectedPlan,
  onContinue,
}) {
  if (!isOpen) {
    return null;
  }

  const plans = ["Starter", "Professional", "Agency Plus"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-xl font-semibold text-slate-900">Upgrade Plan</h2>
            <p className="mt-1 text-sm text-slate-600">
              Choose a plan to continue to checkout.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
          >
            Close
          </button>
        </div>

        <div className="space-y-2">
          {plans.map((plan) => (
            <label
              key={plan}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2"
            >
              <input
                type="radio"
                name="upgrade_plan"
                checked={selectedPlan === plan}
                onChange={() => setSelectedPlan(plan)}
              />
              <span className="text-sm font-medium text-slate-800">{plan}</span>
            </label>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onContinue}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Continue to Checkout
          </button>
        </div>
      </div>
    </div>
  );
}

function TemplatePreviewModal({
  isOpen,
  onClose,
  template,
  onUseTemplate,
}) {
  if (!isOpen || !template) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-xl font-semibold text-slate-900">Template Preview</h2>
            <p className="mt-1 text-sm text-slate-600">{template.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <article className="rounded-xl border border-slate-200 p-4">
            <p className="m-0 text-xs uppercase tracking-wide text-slate-500">Category</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{template.category}</p>
          </article>
          <article className="rounded-xl border border-slate-200 p-4">
            <p className="m-0 text-xs uppercase tracking-wide text-slate-500">Budget Range</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{template.budgetRange}</p>
          </article>
          <article className="rounded-xl border border-slate-200 p-4 sm:col-span-2">
            <p className="m-0 text-xs uppercase tracking-wide text-slate-500">Summary</p>
            <p className="mt-1 text-sm text-slate-700">{template.summary}</p>
          </article>
          <article className="rounded-xl border border-slate-200 p-4">
            <p className="m-0 text-xs uppercase tracking-wide text-slate-500">Default Timeline</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{template.preset.timeline}</p>
          </article>
          <article className="rounded-xl border border-slate-200 p-4">
            <p className="m-0 text-xs uppercase tracking-wide text-slate-500">Pricing Model</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {template.preset.pricingModel}
            </p>
          </article>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => onUseTemplate(template)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Use Template
          </button>
        </div>
      </div>
    </div>
  );
}

function QuotePreviewModal({
  isOpen,
  onClose,
  quoteDocument,
  onEdit,
  onRegenerate,
  onDownloadPdf,
  isDownloadingPdf,
}) {
  if (!isOpen || !quoteDocument) {
    return null;
  }

  const formatMoney = (value) => {
    if (value === null || value === undefined || value === "") {
      return "-";
    }

    if (typeof value === "number") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: quoteDocument.currency || "USD",
      }).format(value);
    }

    return String(value);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-100">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <h2 className="m-0 text-xl font-semibold text-slate-900">PDF Preview</h2>
            <p className="mt-1 text-sm text-slate-600">
              Full-document preview generated from normalized quote data.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
            >
              Back to Dashboard
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
            >
              Edit Inputs
            </button>
            <button
              type="button"
              onClick={onRegenerate}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
            >
              Regenerate Quote
            </button>
            <button
              type="button"
              onClick={onDownloadPdf}
              disabled={isDownloadingPdf}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDownloadingPdf ? "Exporting..." : "Export To PDF"}
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <p className="m-0 text-2xl font-bold tracking-tight text-slate-900">SOFTWARE QUOTATION</p>
              <p className="mt-1 text-sm text-slate-600">FlashQuote AI</p>
            </div>
            <div className="text-sm text-slate-700">
              <p className="m-0"><span className="font-semibold">Quote #:</span> {quoteDocument.quoteNumber}</p>
              <p className="mt-1"><span className="font-semibold">Date:</span> {quoteDocument.issuedAt}</p>
              <p className="mt-1"><span className="font-semibold">Valid Until:</span> {quoteDocument.validUntil}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Prepared For</p>
              <p className="mt-2 text-base font-semibold text-slate-900">{quoteDocument.clientName}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Project</p>
              <p className="mt-2 text-base font-semibold text-slate-900">{quoteDocument.projectTitle}</p>
              <p className="mt-1 text-sm text-slate-600">Timeline: {quoteDocument.timeline}</p>
            </div>
          </div>

          <div className="mt-5">
            <p className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Scope Summary</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{quoteDocument.scopeSummary}</p>
          </div>

          <div className="mt-5">
            <p className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Scope and Deliverables</p>
            {quoteDocument.scopeAndDeliverables.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {quoteDocument.scopeAndDeliverables.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No deliverables were provided.</p>
            )}
          </div>

          <div className="mt-6">
            <p className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Line Items</p>
            {quoteDocument.lineItems.length > 0 ? (
              <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600">
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="px-3 py-2 font-medium">Hours</th>
                      <th className="px-3 py-2 font-medium">Rate</th>
                      <th className="px-3 py-2 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quoteDocument.lineItems.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-700">{item.description}</td>
                        <td className="px-3 py-2 text-slate-700">{item.quantity}</td>
                        <td className="px-3 py-2 text-slate-700">{formatMoney(item.rate)}</td>
                        <td className="px-3 py-2 text-right font-medium text-slate-900">
                          {formatMoney(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No line items were provided by the response.</p>
            )}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Assumptions</p>
              {quoteDocument.assumptions.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {quoteDocument.assumptions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No assumptions provided.</p>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Milestones</p>
              {quoteDocument.paymentMilestones.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {quoteDocument.paymentMilestones.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No milestones provided.</p>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-slate-200 p-4">
            <p className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Exclusions</p>
            {quoteDocument.exclusions.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {quoteDocument.exclusions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No exclusions were provided.</p>
            )}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Terms</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{quoteDocument.terms}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Summary</p>
              <div className="mt-2 space-y-1 text-sm text-slate-700">
                <p className="m-0">Subtotal: <span className="font-medium text-slate-900">{formatMoney(quoteDocument.subtotal)}</span></p>
                <p className="m-0">Tax: <span className="font-medium text-slate-900">{formatMoney(quoteDocument.tax)}</span></p>
                <p className="m-0 text-base">Total: <span className="font-semibold text-slate-900">{formatMoney(quoteDocument.total)}</span></p>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-slate-200 p-4">
            <p className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Next Steps</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{quoteDocument.nextSteps}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const { user } = useUser();
  const navigate = useNavigate();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [isCreateTemplateModalOpen, setIsCreateTemplateModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isTemplatePreviewOpen, setIsTemplatePreviewOpen] = useState(false);
  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState("Starter");
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [isCreatingQuote, setIsCreatingQuote] = useState(false);
  const [createSuccessMessage, setCreateSuccessMessage] = useState("");
  const [uploadState, setUploadState] = useState("idle");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [clientName, setClientName] = useState("");
  const [projectType, setProjectType] = useState("");
  const [quoteSearchQuery, setQuoteSearchQuery] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGeneratingAiQuote, setIsGeneratingAiQuote] = useState(false);
  const [aiGenerationError, setAiGenerationError] = useState("");
  const [aiGenerationMessage, setAiGenerationMessage] = useState("");
  const [isQuotePreviewOpen, setIsQuotePreviewOpen] = useState(false);
  const [isDownloadingQuotePdf, setIsDownloadingQuotePdf] = useState(false);
  const [generatedQuoteDocument, setGeneratedQuoteDocument] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [quotesError, setQuotesError] = useState("");
  const [manualClients, setManualClients] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templatesError, setTemplatesError] = useState("");
  const startWithAiSectionRef = useRef(null);
  const quotesSectionRef = useRef(null);
  const clientsSectionRef = useRef(null);
  const templatesSectionRef = useRef(null);
  const billingSectionRef = useRef(null);
  const settingsSectionRef = useRef(null);
  const helpSectionRef = useRef(null);
  const [createForm, setCreateForm] = useState(
    buildInitialCreateForm(initialSettingsForm.defaultPricingModel),
  );
  const [clientForm, setClientForm] = useState({
    name: "",
    activeQuotes: "0",
  });
  const [templateForm, setTemplateForm] = useState(initialTemplateForm);
  const [settingsForm, setSettingsForm] = useState(initialSettingsForm);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [planUsage, setPlanUsage] = useState(() => getStoredSubscriptionUsage());

  const defaultWorkspaceName = user?.firstName
    ? `${user.firstName}'s Workspace`
    : "My Workspace";

  const fetchSettings = async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${apiBaseUrl}/api/settings`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return;
      }
      const s = data?.settings || data?.data || data || {};
      setSettingsForm({
        workspaceName: s.workspace_name || s.workspaceName || defaultWorkspaceName,
        notificationEmails: s.notification_emails ?? s.notificationEmails ?? true,
        timezone: s.timezone || "UTC",
        defaultPricingModel: s.default_pricing_model || s.defaultPricingModel || "Fixed",
        currency: s.currency || "USD",
        defaultQuoteValidityDays: String(s.default_quote_validity_days ?? s.defaultQuoteValidityDays ?? "14"),
      });
    } catch {
      // Silently fall back to local defaults
    }
  };

  const fetchQuotes = async () => {
    setIsLoadingQuotes(true);
    setQuotesError("");
    try {
      const token = await getToken();
      const response = await fetch(`${apiBaseUrl}/api/quotes`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch quotes.");
      }
      const rawQuotes = Array.isArray(data) ? data : data?.quotes || data?.data || [];
      const mapped = rawQuotes.map((q) => {
        const inner = q.quote || {};
        const displayId = inner.quote_id || q.quote_id || q.id || "-";
        const clientName = inner.client_name || inner.clientName || "-";
        const projectTitle = inner.project_title || inner.projectTitle || q.title || "-";
        const totalAmount = q.total ?? inner.cost_summary?.grand_total ?? q.subtotal ?? "-";
        const currency = q.currency || inner.currency || "USD";
        const formattedAmount =
          typeof totalAmount === "number"
            ? new Intl.NumberFormat("en-US", { style: "currency", currency }).format(totalAmount)
            : totalAmount;
        const status = q.request_status || q.status || "Draft";
        const statusLabel = status === "completed" ? "Completed" : status === "pending" ? "Pending" : status === "failed" ? "Failed" : status;
        return {
          id: displayId,
          client: clientName,
          projectTitle,
          amount: formattedAmount,
          status: statusLabel,
          updated: q.created_at || q.updated_at || q.createdAt || q.updatedAt || "-",
          raw: q,
        };
      });
      setQuotes(mapped);
    } catch (error) {
      setQuotesError(error.message || "Failed to load quotes.");
    } finally {
      setIsLoadingQuotes(false);
    }
  };

  const fetchTemplates = async () => {
    setIsLoadingTemplates(true);
    setTemplatesError("");
    try {
      const token = await getToken();
      const response = await fetch(`${apiBaseUrl}/api/templates`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch templates.");
      }
      const rawTemplates = Array.isArray(data) ? data : data?.templates || data?.data || [];
      const mapped = rawTemplates.map((t) => ({
        id: t.id || t.template_id || t._id || `TMP-${Math.random().toString(36).slice(2, 6)}`,
        name: t.name || "Untitled Template",
        category: t.category || "Web App",
        budgetRange: t.budget_range || t.budgetRange || "-",
        summary: t.summary || t.description || "",
        modules: t.modules || 0,
        preset: {
          clientName: t.preset?.client_name || t.preset?.clientName || "",
          projectTitle: t.preset?.project_title || t.preset?.projectTitle || t.name || "",
          scopeSummary: t.preset?.scope_summary || t.preset?.scopeSummary || t.summary || "",
          timeline: t.preset?.timeline || "",
          budget: t.preset?.budget || t.budgetRange || t.budget_range || "",
          pricingModel: t.preset?.pricing_model || t.preset?.pricingModel || "Fixed",
          terms: t.preset?.terms || "",
        },
      }));
      setTemplates(mapped);
    } catch (error) {
      setTemplatesError(error.message || "Failed to load templates.");
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const clientsFromQuotes = (() => {
    const countMap = {};
    for (const q of quotes) {
      const name = q.client;
      if (!name || name === "-") continue;
      countMap[name] = (countMap[name] || 0) + 1;
    }
    return Object.entries(countMap).map(([name, count]) => ({
      id: `QC-${name}`,
      name,
      activeQuotes: count,
    }));
  })();

  const clients = [
    ...manualClients,
    ...clientsFromQuotes.filter(
      (qc) => !manualClients.some((mc) => mc.name.toLowerCase() === qc.name.toLowerCase()),
    ),
  ];

  useEffect(() => {
    setPlanUsage(getStoredSubscriptionUsage());
    fetchQuotes();
    fetchTemplates();
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (defaultWorkspaceName && !settingsForm.workspaceName) {
      setSettingsForm((previous) => ({
        ...previous,
        workspaceName: defaultWorkspaceName,
      }));
    }
  }, [defaultWorkspaceName]);

  const planUsagePercent =
    planUsage.quotaLimit > 0
      ? Math.max(0, Math.min(100, (planUsage.quotaUsed / planUsage.quotaLimit) * 100))
      : 0;

  const parsedSummary = [
    "Scope detected: E-commerce web app + admin panel",
    "Key modules: Catalog, Cart, Checkout, Admin Dashboard",
    "Timeline hint: 6 weeks",
    "Missing field: Payment gateway preference",
  ];

  const resetUploadFlow = () => {
    setUploadState("idle");
    setErrorMessage("");
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];
    setSelectedFileName(selectedFile ? selectedFile.name : "");
    resetUploadFlow();
  };

  const handleStartUpload = async () => {
    setErrorMessage("");

    if (!selectedFileName) {
      setUploadState("error");
      setErrorMessage("Please select a file before starting upload.");
      return;
    }

    const lower = selectedFileName.toLowerCase();
    const supported = [".pdf", ".doc", ".docx", ".txt"].some((ext) =>
      lower.endsWith(ext),
    );

    if (!supported) {
      setUploadState("error");
      setErrorMessage("Unsupported file type. Please upload PDF, DOC, DOCX, or TXT.");
      return;
    }

    setUploadState("uploading");
    await wait(1000);
    setUploadState("parsing");
    await wait(1200);
    setUploadState("success");
  };

  const handleGenerateQuoteFromBrief = () => {
    const generatedPrompt =
      "Create a quote for an e-commerce web app with admin panel, catalog, cart, checkout, and a 6-week delivery timeline. Include assumptions and payment milestones.";
    setAiPrompt(generatedPrompt);
    setIsUploadModalOpen(false);
  };

  const updatePlanUsageFromQuota = (quota) => {
    if (!quota || typeof quota !== "object") {
      return;
    }

    const limit = Number(quota.quota_limit);
    const used = Number(quota.quota_used);
    const remaining = Number(quota.quota_remaining);

    if (!Number.isFinite(limit) || !Number.isFinite(used)) {
      return;
    }

    const normalizedLimit = Math.max(0, limit);
    const normalizedUsed = Math.max(0, used);
    const normalizedRemaining = Number.isFinite(remaining)
      ? Math.max(0, remaining)
      : Math.max(normalizedLimit - normalizedUsed, 0);

    const nextUsage = {
      planCode: planUsage.planCode,
      quotaLimit: normalizedLimit,
      quotaUsed: normalizedUsed,
      quotaRemaining: normalizedRemaining,
    };

    setPlanUsage(nextUsage);

    try {
      const existingRaw = localStorage.getItem(SUBSCRIPTION_STORAGE_KEY);
      const existing = existingRaw ? JSON.parse(existingRaw) : {};
      const merged = {
        ...existing,
        quota_limit: normalizedLimit,
        quota_used: normalizedUsed,
        quota_remaining: normalizedRemaining,
      };
      localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(merged));
    } catch {
      localStorage.setItem(
        SUBSCRIPTION_STORAGE_KEY,
        JSON.stringify({
          plan_code: nextUsage.planCode,
          quota_limit: nextUsage.quotaLimit,
          quota_used: nextUsage.quotaUsed,
          quota_remaining: nextUsage.quotaRemaining,
        }),
      );
    }
  };

  const normalizeGeneratedQuoteResponse = (data) => {
    const fallbackQuoteDraft =
      data?.quoteDraft ||
      data?.quote_draft ||
      data?.data?.quoteDraft ||
      data?.data?.quote_draft ||
      {};
    const quoteDraft = data?.quote || data?.data?.quote || fallbackQuoteDraft;

    const rawLineItems =
      quoteDraft.phases ||
      quoteDraft.lineItems ||
      quoteDraft.line_items ||
      quoteDraft.items ||
      [];

    const lineItems = Array.isArray(rawLineItems)
      ? rawLineItems.map((item, index) => ({
          id: String(item?.id || item?.phase_number || item?.name || index),
          description:
            item?.phase_name || item?.description || item?.name || item?.title || `Line item ${index + 1}`,
          quantity: item?.effort_hours || item?.quantity || item?.qty || 1,
          rate:
            item?.rate ||
            item?.unit_price ||
            item?.price ||
            (item?.subtotal && item?.effort_hours ? item.subtotal / item.effort_hours : "-"),
          amount: item?.subtotal || item?.amount || item?.total || item?.line_total || "-",
        }))
      : [];

    const rawAssumptions = quoteDraft.assumptions || quoteDraft.notes || [];
    const rawMilestones =
      quoteDraft?.payment_terms?.milestones ||
      quoteDraft.paymentMilestones ||
      quoteDraft.payment_milestones ||
      quoteDraft.milestones ||
      [];
    const rawDeliverables = quoteDraft.scope_and_deliverables || quoteDraft.scopeAndDeliverables || [];
    const rawExclusions = quoteDraft.exclusions || [];
    const rawPhases = quoteDraft.phases || [];
    const rawPhaseSchedule = quoteDraft?.timeline?.phase_schedule || [];

    const assumptions = Array.isArray(rawAssumptions)
      ? rawAssumptions.map((item) => String(item))
      : [];
    const scopeAndDeliverables = Array.isArray(rawDeliverables)
      ? rawDeliverables.map((item) => String(item))
      : [];
    const exclusions = Array.isArray(rawExclusions)
      ? rawExclusions.map((item) => String(item))
      : [];
    const paymentMilestones = Array.isArray(rawMilestones)
      ? rawMilestones.map((item) => {
          if (typeof item === "string") {
            return item;
          }

          const label = item?.label || item?.name || "Milestone";
          const percent = item?.percent ? ` (${item.percent}%)` : "";
          const amount = item?.amount !== undefined ? ` - ${item.amount}` : "";
          const trigger = item?.trigger ? ` - ${item.trigger}` : "";
          return `${label}${percent}${amount}${trigger}`;
        })
      : [];
    const phases = Array.isArray(rawPhases)
      ? rawPhases.map((item, index) => ({
          phaseNumber: item?.phase_number || item?.phaseNumber || index + 1,
          phaseName: item?.phase_name || item?.phaseName || `Phase ${index + 1}`,
          tasks: Array.isArray(item?.tasks) ? item.tasks.map((task) => String(task)) : [],
          effortHours: item?.effort_hours || item?.effortHours || 0,
          subtotal: item?.subtotal || item?.amount || 0,
        }))
      : [];
    const phaseSchedule = Array.isArray(rawPhaseSchedule)
      ? rawPhaseSchedule.map((item, index) => ({
          phaseNumber: item?.phase_number || item?.phaseNumber || index + 1,
          phaseName: item?.phase_name || item?.phaseName || `Phase ${index + 1}`,
          duration: item?.duration || "-",
        }))
      : [];
    const preparedBy =
      quoteDraft.prepared_by ||
      quoteDraft.preparedBy ||
      data?.prepared_by ||
      data?.preparedBy ||
      data?.user_name ||
      data?.userName ||
      "John Freelancer";

    const subtotal =
      quoteDraft?.cost_summary?.subtotal ||
      quoteDraft.subtotal ||
      quoteDraft.sub_total ||
      quoteDraft.amount_without_tax ||
      null;
    const tax = quoteDraft?.cost_summary?.tax_amount || quoteDraft.tax || quoteDraft.tax_amount || null;
    const total =
      quoteDraft?.cost_summary?.grand_total ||
      quoteDraft.total ||
      quoteDraft.total_amount ||
      quoteDraft.amount ||
      quoteDraft.budget ||
      null;
    const generatedDate = quoteDraft.generated_date || quoteDraft.generatedDate;
    const timelineValue = quoteDraft?.timeline?.total_duration || quoteDraft.timeline || "TBD";

    return {
      quoteNumber:
        quoteDraft.quote_id || quoteDraft.quoteNumber || quoteDraft.quote_number || `Q-${Date.now()}`,
      issuedAt: generatedDate || new Date().toLocaleDateString(),
      validUntil: quoteDraft.valid_until || quoteDraft.validUntil || "-",
      clientName: quoteDraft.clientName || quoteDraft.client_name || clientName || "New Client",
      projectTitle:
        quoteDraft.projectTitle || quoteDraft.project_title || projectType || "New Project",
      scopeSummary:
        quoteDraft.executive_summary || quoteDraft.scopeSummary || quoteDraft.scope_summary || "To be defined",
      timeline: timelineValue,
      budget: quoteDraft.budget || total || "$1,500",
      pricingModel:
        quoteDraft.pricing_model ||
        quoteDraft.pricingModel ||
        quoteDraft?.payment_terms?.model ||
        settingsForm.defaultPricingModel,
      terms: quoteDraft.terms || "To be discussed",
      currency: quoteDraft.currency || settingsForm.currency,
      lineItems,
      scopeAndDeliverables,
      assumptions,
      exclusions,
      paymentMilestones,
      paymentTermsModel: quoteDraft?.payment_terms?.model || quoteDraft.pricing_model || quoteDraft.pricingModel || "-",
      phases,
      phaseSchedule,
      preparedBy,
      subtotal,
      tax,
      total,
      nextSteps: quoteDraft.next_steps || quoteDraft.nextSteps || "-",
      raw: quoteDraft,
    };
  };

  const handleGenerateQuote = async () => {
    if (!aiPrompt.trim()) {
      setAiGenerationError("Please describe the project before generating a quote.");
      setAiGenerationMessage("");
      return;
    }

    setIsGeneratingAiQuote(true);
    setAiGenerationError("");
    setAiGenerationMessage("");

    try {
      const token = await getToken();
      const response = await fetch(`${apiBaseUrl}/api/quotes/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          prompt: aiPrompt,
          context: {
            client_name: clientName,
            project_type: projectType,
            currency: settingsForm.currency,
            default_pricing_model: settingsForm.defaultPricingModel,
          },
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Failed to generate quote draft.");
      }

      const responseQuota = data?.quota || data?.data?.quota;
      updatePlanUsageFromQuota(responseQuota);

      const normalizedQuote = normalizeGeneratedQuoteResponse(data);
      setGeneratedQuoteDocument(normalizedQuote);
      setIsQuotePreviewOpen(true);
      setAiGenerationMessage("Quote generated successfully. Review and export to PDF.");
      fetchQuotes();
    } catch (error) {
      setAiGenerationError(error.message || "Failed to generate quote draft.");
    } finally {
      setIsGeneratingAiQuote(false);
    }
  };

  const handleDownloadQuotePdf = async () => {
    if (!generatedQuoteDocument) {
      return;
    }

    setIsDownloadingQuotePdf(true);

    try {

      const quote = generatedQuoteDocument;
      // Get user name for Prepared By
      const preparedByName = user?.firstName || user?.username || user?.email || "-";
      // Get validity days from settings or fallback
      const validityDays = settingsForm?.defaultQuoteValidityDays || initialSettingsForm.defaultQuoteValidityDays || "14";
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const left = 48;
      const right = 48;
      const contentWidth = pageWidth - left - right;
      const bottom = pageHeight - 48;
      let y = 52;
      const bodyFontSize = 13;
      const bodyLineHeight = 18;

      // Draw a horizontal line in grey
      const drawGreyLine = () => {
        const lineY = y;
        pdf.setDrawColor(180, 180, 180);
        pdf.setLineWidth(1);
        pdf.line(left, lineY, pageWidth - right, lineY);
        y += 8; // space after line
      };

      const ensureSpace = (requiredHeight = 24) => {
        if (y + requiredHeight > bottom) {
          pdf.addPage();
          y = 52;
        }
      };

      // Write a section heading with spacing and a grey line before
      const writeSectionHeading = (text) => {
        y += 8; // new line before
        drawGreyLine();
        y += 8; // new line after line
        ensureSpace(bodyLineHeight + 4);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(bodyFontSize);
        pdf.text(text, left, y);
        y += bodyLineHeight;
      };

      // Write a paragraph with normal font
      const writeParagraph = (text) => {
        const safeText = text || "-";
        const lines = pdf.splitTextToSize(String(safeText), contentWidth);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(bodyFontSize);
        lines.forEach((line) => {
          ensureSpace(bodyLineHeight);
          pdf.text(line, left, y);
          y += bodyLineHeight;
        });
        y += 4;
      };

      const writeLabeledValue = (label, value) => {
        const renderedValue = value === undefined || value === null || value === "" ? "-" : String(value);
        const labelText = `${label}: `;
        ensureSpace(bodyLineHeight);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(bodyFontSize);
        pdf.text(labelText, left, y);
        const labelWidth = pdf.getTextWidth(labelText);
        pdf.setFont("helvetica", "normal");
        const lines = pdf.splitTextToSize(renderedValue, contentWidth - labelWidth);
        if (lines.length > 0) {
          pdf.text(lines[0], left + labelWidth, y);
        }
        y += bodyLineHeight;

        if (lines.length > 1) {
          lines.slice(1).forEach((line) => {
            ensureSpace(bodyLineHeight);
            pdf.text(line, left, y);
            y += bodyLineHeight;
          });
        }
      };

      const writeList = (items, prefix = "- ") => {
        const normalizedItems = Array.isArray(items) && items.length > 0 ? items : ["-"];

        normalizedItems.forEach((item) => {
          const lines = pdf.splitTextToSize(`${prefix}${String(item)}`, contentWidth);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(bodyFontSize);
          lines.forEach((line) => {
            ensureSpace(bodyLineHeight);
            pdf.text(line, left, y);
            y += bodyLineHeight;
          });
        });

        y += 4;
      };

      // Use locale-specific formatting for INR to ensure ₹ is rendered correctly
      const formatAmount = (value) => {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
          return "-";
        }
        const currencyCode = String(quote.currency || settingsForm?.currency || initialSettingsForm.currency || "USD").toUpperCase();
        let locale = "en-US";
        try {
          let formatted = new Intl.NumberFormat(locale, {
            style: "currency",
            currency: currencyCode,
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          }).format(numericValue);
          // Replace ₹ with Rs. for INR in PDF only
          if (currencyCode === "INR") {
            // Remove the ₹ symbol and replace with Rs. and a space
            formatted = formatted.replace(/\u20B9|₹/g, "Rs. ");
          }
          return formatted;
        } catch (_error) {
          if (currencyCode === "INR") {
            return `Rs. ${numericValue.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
          }
          return `${currencyCode} ${numericValue.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
        }
      };

      const drawTable = (headers, rows, columnWidths) => {
        const startX = left;
        const defaultRowHeight = bodyLineHeight + 4;
        const cellPadding = 4;

        const drawRow = (cells, isHeader = false) => {
          const wrappedCells = cells.map((cell, index) => {
            const safeCell = cell === undefined || cell === null || cell === "" ? "-" : String(cell);
            return pdf.splitTextToSize(safeCell, columnWidths[index] - cellPadding * 2);
          });

          const rowHeight = Math.max(
            defaultRowHeight,
            ...wrappedCells.map((lines) => lines.length * bodyLineHeight + 6),
          );

          ensureSpace(rowHeight + 2);

          let x = startX;
          wrappedCells.forEach((lines, index) => {
            const cellWidth = columnWidths[index];
            pdf.setLineWidth(1);
            pdf.rect(x, y, cellWidth, rowHeight);
            pdf.setFont("helvetica", isHeader ? "bold" : "normal");
            pdf.setFontSize(bodyFontSize);
            lines.forEach((line, lineIndex) => {
              const textY = y + bodyLineHeight - 5 + lineIndex * bodyLineHeight;
              pdf.text(line, x + cellPadding, textY);
            });
            x += cellWidth;
          });

          y += rowHeight;
        };

        drawRow(headers, true);
        rows.forEach((row) => drawRow(row, false));
        y += 8;
      };


      // Centered heading
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(20);
      const heading = quote.projectTitle || "Project Quotation";
      const headingLines = pdf.splitTextToSize(heading, contentWidth);
      headingLines.forEach((line) => {
        ensureSpace(bodyLineHeight + 2);
        pdf.text(line, pageWidth / 2, y, { align: "center" });
        y += bodyLineHeight;
      });
      y += 8; // new line after heading

      // Prepared For, By (user), Date
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(bodyFontSize);
      writeLabeledValue("Prepared For", quote.clientName);
      writeLabeledValue("Prepared By", preparedByName);
      writeLabeledValue("Date", new Date().toLocaleDateString());
  // ...existing code for all sections...

  // Prepared By section at end
  y += 8;
  drawGreyLine();
  y += 8;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(bodyFontSize);
  pdf.text("Prepared By", left, y);
  y += bodyLineHeight;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(bodyFontSize);
  pdf.text(`User Name: ${preparedByName}`, left, y);
  y += bodyLineHeight;
  pdf.text(`Quotation Validity: ${validityDays} days from the date above.`, left, y);
  y += bodyLineHeight;

      // New line, grey line, new line before Executive Summary
      y += 8;
      drawGreyLine();
      y += 8;

      // Executive Summary
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(bodyFontSize);
      pdf.text("Executive Summary", left, y);
      y += bodyLineHeight;
      writeParagraph(quote.scopeSummary);
      writeLabeledValue(
        "Development Total",
        `${quote.timeline || "-"} | ${formatAmount(quote.total)}`,
      );

      // Section: Scope and Deliverables
      writeSectionHeading("Scope and Deliverables");
      writeList(quote.scopeAndDeliverables);

      // Section: Phase-Wise Breakdown and Costs
      writeSectionHeading("Phase-Wise Breakdown and Costs");
      const phases = Array.isArray(quote.phases) && quote.phases.length > 0
        ? quote.phases
        : [];
      const totalHours = phases.reduce((sum, phase) => sum + (Number(phase?.effortHours) || 0), 0);
      const totalAmount = phases.reduce((sum, phase) => sum + (Number(phase?.subtotal) || 0), 0);
      const phaseRows = phases.map((phase) => [
        String(phase.phaseNumber || "-"),
        phase.phaseName || "-",
        Array.isArray(phase.tasks) && phase.tasks.length > 0 ? phase.tasks.join(", ") : "-",
        String(phase.effortHours ?? "-"),
        formatAmount(phase.subtotal),
      ]);
      phaseRows.push(["", "Total", "", String(totalHours), formatAmount(totalAmount)]);
      drawTable(
        ["Phase Number", "Phase Name", "Tasks", "Hours", "Subtotal"],
        phaseRows,
        [70, 115, 160, 65, 78],
      );

      // Section: Timeline
      writeSectionHeading("Timeline");
      const phaseSchedule = Array.isArray(quote.phaseSchedule) && quote.phaseSchedule.length > 0
        ? quote.phaseSchedule
        : [];
      const timelineRows = phaseSchedule.map((item) => [
        String(item.phaseNumber || "-"),
        item.phaseName || "-",
        item.duration || "-",
      ]);
      drawTable(["Phase Number", "Phase Name", "Duration"], timelineRows, [120, 220, 143]);

      // Section: Payment Terms
      writeSectionHeading("Payment Terms");
      writeLabeledValue("Model", quote.paymentTermsModel || quote.pricingModel || "-");
      writeList(quote.paymentMilestones);

      // Section: Assumptions
      writeSectionHeading("Assumptions");
      writeList(quote.assumptions);

      // Section: Exclusions
      writeSectionHeading("Exclusions");
      writeList(quote.exclusions);

      // Section: Next Steps
      writeSectionHeading("Next Steps");
      writeParagraph(quote.nextSteps);

      const fileNameBase = String(quote.quoteNumber || "quote")
        .trim()
        .replace(/[^a-zA-Z0-9-_]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || "quote";
      pdf.save(`${fileNameBase}.pdf`);
      setAiGenerationMessage("PDF downloaded successfully.");
    } catch (error) {
      setAiGenerationError(error.message || "Failed to export quote PDF.");
    } finally {
      setIsDownloadingQuotePdf(false);
    }
  };

  const handleEditGeneratedQuote = () => {
    if (!generatedQuoteDocument) {
      return;
    }

    setCreateForm({
      clientName: generatedQuoteDocument.clientName,
      projectTitle: generatedQuoteDocument.projectTitle,
      scopeSummary: generatedQuoteDocument.scopeSummary,
      timeline: generatedQuoteDocument.timeline,
      budget: generatedQuoteDocument.budget,
      pricingModel: generatedQuoteDocument.pricingModel,
      terms: generatedQuoteDocument.terms,
    });
    setIsQuotePreviewOpen(false);
    setIsCreateModalOpen(true);
    setCreateStep(1);
    setCreateSuccessMessage("");
  };

  // Always open the Upload Brief modal; gating is handled inside the modal
  const openUploadModal = () => {
    setIsUploadModalOpen(true);
    resetUploadFlow();
  };

  const openCreateQuoteModal = () => {
    setIsCreateModalOpen(true);
    setCreateStep(1);
    setCreateSuccessMessage("");
  };

  const openTemplatesSection = () => {
    templatesSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const openUpgradeModal = () => {
    setSelectedUpgradePlan("Starter");
    setIsUpgradeModalOpen(true);
  };

  const closeUpgradeModal = () => {
    setIsUpgradeModalOpen(false);
  };

  const continueUpgrade = () => {
    setIsUpgradeModalOpen(false);
    navigate(`/checkout?plan=${encodeURIComponent(selectedUpgradePlan)}`);
  };

  const handleUseTemplate = (template) => {
    setIsTemplatePreviewOpen(false);
    const symbol = getCurrencySymbol(settingsForm.currency);
    const convertedBudget = template.preset.budget
      ? template.preset.budget.replace(/^\$/, symbol)
      : template.preset.budget;
    setCreateForm({ ...template.preset, budget: convertedBudget });
    setIsCreateModalOpen(true);
    setCreateStep(1);
    setCreateSuccessMessage("");
  };

  const openTemplatePreview = (template) => {
    setPreviewTemplate(template);
    setIsTemplatePreviewOpen(true);
  };

  const closeTemplatePreview = () => {
    setIsTemplatePreviewOpen(false);
  };

  const openCreateTemplateModal = () => {
    setTemplateForm(initialTemplateForm);
    setIsCreateTemplateModalOpen(true);
  };

  const closeCreateTemplateModal = () => {
    if (isSavingTemplate) {
      return;
    }

    setIsCreateTemplateModalOpen(false);
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim()) {
      return;
    }

    setIsSavingTemplate(true);
    try {
      const parsedModules = Number(templateForm.modules);
      const fallbackBudget = "$1,000 - $2,000";
      const fallbackTimeline = "4 weeks";
      const fallbackSummary = "Custom template for quote generation.";

      const payload = {
        name: templateForm.name.trim(),
        category: templateForm.category,
        budget_range: templateForm.budgetRange.trim() || fallbackBudget,
        summary: templateForm.summary.trim() || fallbackSummary,
        modules: Number.isFinite(parsedModules) && parsedModules > 0 ? parsedModules : 5,
        preset: {
          client_name: "",
          project_title: templateForm.name.trim(),
          scope_summary: templateForm.summary.trim() || fallbackSummary,
          timeline: templateForm.timeline.trim() || fallbackTimeline,
          budget: templateForm.budgetRange.trim() || fallbackBudget,
          pricing_model: templateForm.pricingModel,
          terms: templateForm.terms.trim() || "Payment terms to be discussed",
        },
      };

      const token = await getToken();
      const response = await fetch(`${apiBaseUrl}/api/templates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to save template.");
      }

      await fetchTemplates();
      setIsCreateTemplateModalOpen(false);
    } catch (error) {
      setTemplatesError(error.message || "Failed to save template.");
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleSidebarNavigate = (item) => {
    if (item === "New Quote") {
      openCreateQuoteModal();
    }

    if (item === "Quotes") {
      quotesSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }

    if (item === "Clients") {
      clientsSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }

    if (item === "Templates") {
      templatesSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }

    if (item === "Billing") {
      billingSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }

    if (item === "Settings") {
      settingsSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }

    if (item === "Help") {
      helpSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }

    if (isMobileSidebarOpen) {
      setIsMobileSidebarOpen(false);
    }
  };

  const closeCreateQuoteModal = () => {
    if (isCreatingQuote) {
      return;
    }

    setIsCreateModalOpen(false);
  };

  const openAddClientModal = () => {
    setClientForm({ name: "", activeQuotes: "0" });
    setIsAddClientModalOpen(true);
  };

  const closeAddClientModal = () => {
    if (isSavingClient) {
      return;
    }

    setIsAddClientModalOpen(false);
  };

  const handleSaveClient = async () => {
    if (!clientForm.name.trim()) {
      return;
    }

    setIsSavingClient(true);
    await wait(600);

    const parsedActiveQuotes = Number(clientForm.activeQuotes);
    const newClient = {
      id: `CL-${Math.floor(1000 + Math.random() * 9000)}`,
      name: clientForm.name.trim(),
      activeQuotes: Number.isFinite(parsedActiveQuotes) && parsedActiveQuotes >= 0
        ? parsedActiveQuotes
        : 0,
    };

    setManualClients((previous) => [newClient, ...previous]);
    setIsSavingClient(false);
    setIsAddClientModalOpen(false);
  };

  const handleCreateDraft = async () => {
    setIsCreatingQuote(true);

    const draftAmount = createForm.budget || "$1,500";
    setAiPrompt(
      `Project: ${createForm.projectTitle || "New project"}\nClient: ${createForm.clientName || "New Client"}\nScope: ${createForm.scopeSummary || "To be defined"}\nTimeline: ${createForm.timeline || "TBD"}\nBudget: ${draftAmount}`,
    );
    setClientName(createForm.clientName || "");
    setProjectType("");

    setIsCreatingQuote(false);
    setIsCreateModalOpen(false);
    setCreateStep(1);
    setCreateForm(buildInitialCreateForm(settingsForm.defaultPricingModel));
    setCreateSuccessMessage("Draft ready — click Generate Quote below to create it.");

    // After closing the wizard, guide users to the AI generation block.
    setTimeout(() => {
      startWithAiSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    setSettingsMessage("");
    try {
      const token = await getToken();
      const response = await fetch(`${apiBaseUrl}/api/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          workspace_name: settingsForm.workspaceName,
          notification_emails: settingsForm.notificationEmails,
          timezone: settingsForm.timezone,
          default_pricing_model: settingsForm.defaultPricingModel,
          currency: settingsForm.currency,
          default_quote_validity_days: Number(settingsForm.defaultQuoteValidityDays) || 14,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Failed to save settings.");
      }
      setCreateForm((previous) => ({
        ...previous,
        pricingModel: settingsForm.defaultPricingModel,
      }));
      setSettingsMessage("Settings saved successfully.");
    } catch (error) {
      setSettingsMessage(error.message || "Failed to save settings.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleResetSettings = () => {
    setSettingsForm({ ...initialSettingsForm, workspaceName: defaultWorkspaceName });
    setSettingsMessage("Settings reset to defaults.");
  };

  const handleSendTestEmail = () => {
    if (!settingsForm.notificationEmails) {
      setSettingsMessage("Enable notification emails first to send a test email.");
      return;
    }

    setSettingsMessage("Test notification email sent.");
  };

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      localStorage.removeItem("session_id");
      localStorage.removeItem("session_token");
      await signOut();
      navigate("/", { replace: true });
    } catch (error) {
      setSettingsMessage("Logout failed. Please try again.");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const briefChip =
    uploadState === "success"
      ? {
          label: "Brief parsed",
          className: "bg-green-50 text-green-700 border-green-200",
        }
      : uploadState === "uploading"
        ? {
            label: "Uploading...",
            className: "bg-blue-50 text-blue-700 border-blue-200",
          }
        : uploadState === "parsing"
          ? {
              label: "Parsing...",
              className: "bg-blue-50 text-blue-700 border-blue-200",
            }
          : uploadState === "error"
            ? {
                label: "Brief error",
                className: "bg-red-50 text-red-700 border-red-200",
              }
            : {
                label: "No brief",
                className: "bg-slate-100 text-slate-600 border-slate-200",
              };

  const handleViewQuote = (quote) => {
    if (quote.raw) {
      const normalizedQuote = normalizeGeneratedQuoteResponse(quote.raw);
      setGeneratedQuoteDocument(normalizedQuote);
      setIsQuotePreviewOpen(true);
    }
  };

  const formatQuoteUpdated = (dateStr) => {
    if (!dateStr || dateStr === "-") return dateStr;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const normalizedQuoteSearch = quoteSearchQuery.trim().toLowerCase();
  const filteredQuotes = normalizedQuoteSearch
    ? quotes.filter((quote) => {
        const searchableText = [
          quote.id,
          quote.client,
          quote.amount,
          quote.status,
          quote.updated,
        ]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(normalizedQuoteSearch);
      })
    : quotes;
  const myQuotes = quotes.slice(0, 5);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <div className="hidden md:block">
          <Sidebar
            onNavigate={handleSidebarNavigate}
            onLogout={handleLogout}
            isLoggingOut={isLoggingOut}
            planUsage={planUsage}
            userName={user?.fullName || "User"}
          />
        </div>

        {isMobileSidebarOpen ? (
          <div className="fixed inset-0 z-40 md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/40"
              onClick={() => setIsMobileSidebarOpen(false)}
              aria-label="Close sidebar"
            />
            <div className="relative z-50 h-full w-72">
              <Sidebar
                onNavigate={handleSidebarNavigate}
                onLogout={handleLogout}
                isLoggingOut={isLoggingOut}
                planUsage={planUsage}
                userName={user?.fullName || "User"}
              />
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 md:hidden"
                  onClick={() => setIsMobileSidebarOpen(true)}
                >
                  Menu
                </button>
                <div>
                  <h1 className="m-0 text-xl font-semibold text-slate-900">
                    Dashboard
                  </h1>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Welcome back, {user?.firstName || "there"}.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Hide No Brief tag */}
                {/* <span className={`hidden rounded-full border px-2.5 py-1 text-xs font-semibold sm:inline-flex ${briefChip.className}`}>{briefChip.label}</span> */}
                <button
                  type="button"
                  disabled
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-400 cursor-not-allowed"
                >
                  Upload Brief
                </button>
                <button
                  type="button"
                  onClick={openCreateQuoteModal}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
                >
                  + New Quote
                </button>
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6">
            {createSuccessMessage ? (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                {createSuccessMessage}
              </div>
            ) : null}

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {getKpiCards(quotes, getCurrencySymbol(settingsForm.currency)).map((card) => (
                <article
                  key={card.label}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <p className="m-0 text-sm text-slate-600">{card.label}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{card.value}</p>
                </article>
              ))}
            </section>

            <section ref={startWithAiSectionRef} className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <article className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-2">
                <h2 className="m-0 text-lg font-semibold text-slate-900">
                  Start with AI
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Describe the project to generate a structured quote draft.
                </p>
                <textarea
                  rows={5}
                  placeholder="Example: Build an e-commerce web app with admin panel, payment integration, and 6-week timeline..."
                  value={aiPrompt}
                  onChange={(event) => {
                    setAiPrompt(event.target.value);
                    if (aiGenerationError) {
                      setAiGenerationError("");
                    }
                    if (aiGenerationMessage) {
                      setAiGenerationMessage("");
                    }
                  }}
                  disabled={isGeneratingAiQuote}
                  className="mt-4 w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-400"
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                      type="button"
                      onClick={handleGenerateQuote}
                      disabled={isGeneratingAiQuote || (planUsage && planUsage.quotaUsed >= planUsage.quotaLimit)}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isGeneratingAiQuote ? "Generating..." : "Generate Quote"}
                    </button>
                  <button
                    type="button"
                    onClick={openTemplatesSection}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    Use Template
                  </button>
                </div>
                {aiGenerationError ? (
                  <p className="mt-3 text-sm font-medium text-red-600">{aiGenerationError}</p>
                ) : null}
                {aiGenerationMessage ? (
                  <p className="mt-3 text-sm font-medium text-green-700">{aiGenerationMessage}</p>
                ) : null}
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="m-0 text-lg font-semibold text-slate-900">Plan Usage</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {planUsage.planCode} plan: {planUsage.quotaUsed} of {planUsage.quotaLimit} monthly quotes used.
                </p>
                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{ width: `${planUsagePercent}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Remaining this period: {planUsage.quotaRemaining}
                </p>
                <button
                  type="button"
                  disabled
                  className="mt-4 w-full rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-400 cursor-not-allowed"
                >
                  Upgrade Plan
                </button>

                <h3 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Reminders
                </h3>
                <ul className="m-0 list-disc space-y-2 pl-5 text-sm text-slate-700">
                  <li>2 quotes need follow-up today</li>
                  <li>1 quote expires in 24 hours</li>
                </ul>
              </article>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="m-0 text-lg font-semibold text-slate-900">My Quotes</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Quick previews of your latest generated quotes.
                  </p>
                </div>
                <p className="m-0 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Showing up to 5
                </p>
              </div>

              {isLoadingQuotes ? (
                <p className="text-sm text-slate-500">Loading quotes...</p>
              ) : quotesError ? (
                <div className="flex items-center gap-2">
                  <p className="text-sm text-red-600">{quotesError}</p>
                  <button type="button" onClick={fetchQuotes} className="text-sm font-medium text-blue-600 hover:underline">Retry</button>
                </div>
              ) : myQuotes.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {myQuotes.map((quote) => (
                    <article
                      key={`my-${quote.id}`}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <p className="m-0 text-sm font-semibold text-slate-900">{quote.id}</p>
                      <p className="m-0 truncate text-sm text-slate-700">{quote.client}</p>
                      <p className="mt-1 text-base font-semibold text-slate-900">{quote.amount}</p>
                      <p className="mt-1 text-xs text-slate-500">Updated {formatQuoteUpdated(quote.updated)}</p>
                      <button
                        type="button"
                        onClick={() => handleViewQuote(quote)}
                        className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                      >
                        View Quote
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No quotes yet. Create one to see previews here.</p>
              )}
            </section>

            <section
              ref={quotesSectionRef}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="m-0 text-lg font-semibold text-slate-900">Recent Quotes</h2>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <input
                    type="text"
                    placeholder="Search quotes..."
                    value={quoteSearchQuery}
                    onChange={(event) => setQuoteSearchQuery(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-blue-400 sm:w-64"
                  />
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                  >
                    View All
                  </button>
                </div>
              </div>

              <div className="hidden overflow-x-auto md:block">
                {filteredQuotes.length > 0 ? (
                  <table className="min-w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2 pr-3 font-medium">Quote ID</th>
                        <th className="py-2 pr-3 font-medium">Client</th>
                        <th className="py-2 pr-3 font-medium">Amount</th>
                        <th className="py-2 pr-3 font-medium">Updated</th>
                        <th className="py-2 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQuotes.map((quote) => (
                        <tr key={quote.id} className="border-b border-slate-100 last:border-b-0">
                          <td className="py-3 pr-3 font-medium text-slate-800">{quote.id}</td>
                          <td className="py-3 pr-3 text-slate-700">{quote.client}</td>
                          <td className="py-3 pr-3 text-slate-700">{quote.amount}</td>
                          <td className="py-3 pr-3 text-slate-700">{formatQuoteUpdated(quote.updated)}</td>
                          <td className="py-3">
                            <button
                              type="button"
                              onClick={() => handleViewQuote(quote)}
                              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="py-4 text-sm text-slate-500">
                    No quotes found for "{quoteSearchQuery}".
                  </p>
                )}
              </div>

              <div className="space-y-3 md:hidden">
                {filteredQuotes.length > 0 ? (
                  filteredQuotes.map((quote) => (
                    <article
                      key={quote.id}
                      className="cursor-pointer rounded-xl border border-slate-200 p-4"
                      onClick={() => handleViewQuote(quote)}
                    >
                      <p className="m-0 text-sm font-semibold text-slate-900">{quote.id}</p>
                      <p className="mt-1 text-sm text-slate-700">{quote.client}</p>
                      <p className="mt-1 text-sm text-slate-600">{quote.amount}</p>
                      <p className="mt-1 text-xs text-slate-500">Updated {formatQuoteUpdated(quote.updated)}</p>
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No quotes found for "{quoteSearchQuery}".</p>
                )}
              </div>
            </section>

            <section
              ref={clientsSectionRef}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="mb-4">
                <h2 className="m-0 text-lg font-semibold text-slate-900">Clients</h2>
              </div>
              {isLoadingQuotes && clients.length === 0 ? (
                <p className="text-sm text-slate-500">Loading clients...</p>
              ) : clients.length === 0 ? (
                <p className="text-sm text-slate-500">No clients yet. Generate a quote to see clients here.</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {clients.map((client) => (
                    <article key={client.id} className="rounded-xl border border-slate-200 p-4">
                      <p className="m-0 text-sm font-semibold text-slate-900">{client.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {client.activeQuotes} quote{client.activeQuotes === 1 ? "" : "s"}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section
              ref={templatesSectionRef}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="m-0 text-lg font-semibold text-slate-900">Templates</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Start faster with reusable quote formats.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openCreateTemplateModal}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                >
                  + Create Template
                </button>
              </div>

              {isLoadingTemplates && templates.length === 0 ? (
                <p className="text-sm text-slate-500">Loading templates...</p>
              ) : templatesError && templates.length === 0 ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="m-0 text-sm text-red-600">{templatesError}</p>
                  <button
                    type="button"
                    onClick={fetchTemplates}
                    className="mt-2 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700"
                  >
                    Retry
                  </button>
                </div>
              ) : templates.length === 0 ? (
                <p className="text-sm text-slate-500">No templates yet.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {templates.map((template) => (
                    <article key={template.id} className="rounded-xl border border-slate-200 p-4">
                      <p className="m-0 text-sm font-semibold text-slate-900">{template.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {template.category} • {template.budgetRange}
                      </p>
                      <p className="mt-3 text-sm text-slate-700">{template.summary}</p>
                      <p className="mt-2 text-xs text-slate-500">{template.modules} modules</p>

                      <div className="mt-4 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleUseTemplate(template)}
                          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
                        >
                          Use Template
                        </button>
                        <button
                          type="button"
                          onClick={() => openTemplatePreview(template)}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
                        >
                          Preview
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section
              ref={billingSectionRef}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="m-0 text-lg font-semibold text-slate-900">Billing</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Manage your plan and invoices.
                  </p>
                </div>
                <button
                  type="button"
                  disabled
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-400 cursor-not-allowed"
                >
                  Upgrade Plan
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <article className="rounded-xl border border-slate-200 p-4">
                  <p className="m-0 text-sm text-slate-500">Current Plan</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">Free</p>
                  <p className="mt-1 text-sm text-slate-600">Renews monthly • $0/month</p>
                </article>
                <article className="rounded-xl border border-slate-200 p-4">
                  <p className="m-0 text-sm text-slate-500">Last Invoice</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">No paid invoices yet</p>
                  <p className="mt-1 text-sm text-slate-600">Upgrade to view billing history</p>
                </article>
              </div>
            </section>

            <section
              ref={settingsSectionRef}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="mb-4">
                <h2 className="m-0 text-lg font-semibold text-slate-900">Settings</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Manage your account preferences.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <article className="rounded-xl border border-slate-200 p-4">
                  <label className="mb-1 block text-sm text-slate-500">Workspace Name</label>
                  <input
                    type="text"
                    value={settingsForm.workspaceName}
                    onChange={(event) =>
                      setSettingsForm((previous) => ({
                        ...previous,
                        workspaceName: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
                  />
                </article>

                {/* Notification Emails toggle hidden */}

                <article className="rounded-xl border border-slate-200 p-4 md:col-span-2">
                  <label className="mb-1 block text-sm text-slate-500">Timezone</label>
                  <select
                    value={settingsForm.timezone}
                    onChange={(event) =>
                      setSettingsForm((previous) => ({
                        ...previous,
                        timezone: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
                  >
                    <option value="UTC">UTC</option>
                    <option value="IST">IST</option>
                    <option value="EST">EST</option>
                    <option value="PST">PST</option>
                  </select>
                </article>

                <article className="rounded-xl border border-slate-200 p-4">
                  <label className="mb-1 block text-sm text-slate-500">Default Pricing Model</label>
                  <select
                    value={settingsForm.defaultPricingModel}
                    onChange={(event) =>
                      setSettingsForm((previous) => ({
                        ...previous,
                        defaultPricingModel: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
                  >
                    <option>Fixed</option>
                    <option>Hourly</option>
                    <option>Milestone-based</option>
                  </select>
                </article>

                <article className="rounded-xl border border-slate-200 p-4">
                  <label className="mb-1 block text-sm text-slate-500">Currency</label>
                  <select
                    value={settingsForm.currency}
                    onChange={(event) =>
                      setSettingsForm((previous) => ({
                        ...previous,
                        currency: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="INR">INR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </article>

                <article className="rounded-xl border border-slate-200 p-4">
                  <label className="mb-1 block text-sm text-slate-500">Default Quote Validity (days)</label>
                  <input
                    type="number"
                    min="1"
                    value={settingsForm.defaultQuoteValidityDays}
                    onChange={(event) =>
                      setSettingsForm((previous) => ({
                        ...previous,
                        defaultQuoteValidityDays: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
                  />
                </article>


              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingSettings ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={handleResetSettings}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Reset
                </button>
                {/* Send Test Email button hidden */}
                {settingsMessage ? (
                  <p className="m-0 text-sm font-medium text-green-700">{settingsMessage}</p>
                ) : null}
              </div>
            </section>

            <section
              ref={helpSectionRef}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="mb-4">
                <h2 className="m-0 text-lg font-semibold text-slate-900">Help</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Quick support and guidance for using FlashQuote AI.
                </p>
              </div>

              <div className="space-y-3">
                <article className="rounded-xl border border-slate-200 p-4">
                  <p className="m-0 text-sm font-semibold text-slate-900">How to create a quote</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Use + New Quote, fill the wizard steps, and click Create Draft.
                  </p>
                </article>
                <article className="rounded-xl border border-slate-200 p-4">
                  <p className="m-0 text-sm font-semibold text-slate-900">Need billing help?</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Open Billing to review your current plan and upgrade options.
                  </p>
                </article>
              </div>
            </section>
          </main>
        </div>
      </div>

      <UploadBriefModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onGenerateQuote={handleGenerateQuoteFromBrief}
        uploadState={uploadState}
        selectedFileName={selectedFileName}
        onFileChange={handleFileChange}
        onStartUpload={handleStartUpload}
        onReplaceFile={() => {
          setSelectedFileName("");
          resetUploadFlow();
        }}
        onEditInputs={() => setUploadState("idle")}
        errorMessage={errorMessage}
        clientName={clientName}
        setClientName={setClientName}
        projectType={projectType}
        setProjectType={setProjectType}
        parsedSummary={parsedSummary}
      />

      <CreateQuoteModal
        isOpen={isCreateModalOpen}
        onClose={closeCreateQuoteModal}
        form={createForm}
        setForm={setCreateForm}
        step={createStep}
        setStep={setCreateStep}
        onCreateDraft={handleCreateDraft}
        isCreating={isCreatingQuote}
        currencySymbol={getCurrencySymbol(settingsForm.currency)}
      />

      <AddClientModal
        isOpen={isAddClientModalOpen}
        onClose={closeAddClientModal}
        clientForm={clientForm}
        setClientForm={setClientForm}
        onSave={handleSaveClient}
        isSaving={isSavingClient}
      />

      <CreateTemplateModal
        isOpen={isCreateTemplateModalOpen}
        onClose={closeCreateTemplateModal}
        templateForm={templateForm}
        setTemplateForm={setTemplateForm}
        onSave={handleSaveTemplate}
        isSaving={isSavingTemplate}
      />

      <UpgradePlanModal
        isOpen={isUpgradeModalOpen}
        onClose={closeUpgradeModal}
        selectedPlan={selectedUpgradePlan}
        setSelectedPlan={setSelectedUpgradePlan}
        onContinue={continueUpgrade}
      />

      <TemplatePreviewModal
        isOpen={isTemplatePreviewOpen}
        onClose={closeTemplatePreview}
        template={previewTemplate}
        onUseTemplate={handleUseTemplate}
      />

      <QuotePreviewModal
        isOpen={isQuotePreviewOpen}
        onClose={() => setIsQuotePreviewOpen(false)}
        quoteDocument={generatedQuoteDocument}
        onEdit={handleEditGeneratedQuote}
        onRegenerate={handleGenerateQuote}
        onDownloadPdf={handleDownloadQuotePdf}
        isDownloadingPdf={isDownloadingQuotePdf}
      />
    </div>
  );
}

export default Dashboard;
