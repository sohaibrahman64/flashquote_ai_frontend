import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const primaryNav = [
  "Dashboard",
  "New Quote",
  "Quotes",
  "Clients",
  "Templates",
];

const secondaryNav = ["Billing", "Settings", "Help"];

const kpiCards = [
  { label: "Quotes this month", value: "12" },
  { label: "Acceptance rate", value: "67%" },
  { label: "Avg quote value", value: "$2,450" },
  { label: "Pending follow-ups", value: "4" },
];

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
  workspaceName: "John Freelancer Workspace",
  notificationEmails: true,
  timezone: "UTC",
  defaultPricingModel: "Fixed",
  currency: "USD",
  defaultQuoteValidityDays: "14",
  autoSaveDrafts: true,
};

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

function Sidebar({ onNavigate }) {
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
      </div>

      <div className="border-t border-slate-200 px-4 py-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="m-0 text-sm font-semibold text-slate-900">John Freelancer</p>
          <p className="mt-0.5 text-xs text-slate-500">Free Plan</p>
          <p className="mt-3 text-xs text-slate-600">Usage this month: 3 / 5 quotes</p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full w-3/5 rounded-full bg-blue-600" />
          </div>
          <button
            type="button"
            className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
          >
            Logout
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
                  placeholder="$3,000"
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

function Dashboard() {
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
  const [quotes, setQuotes] = useState(initialRecentQuotes);
  const [clients, setClients] = useState(initialClients);
  const [templates, setTemplates] = useState(templateCards);
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
    setCreateForm(template.preset);
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
    await wait(700);

    const parsedModules = Number(templateForm.modules);
    const fallbackBudget = "$1,000 - $2,000";
    const fallbackTimeline = "4 weeks";
    const fallbackSummary = "Custom template for quote generation.";

    const newTemplate = {
      id: `TMP-${Math.floor(1000 + Math.random() * 9000)}`,
      name: templateForm.name.trim(),
      category: templateForm.category,
      budgetRange: templateForm.budgetRange.trim() || fallbackBudget,
      summary: templateForm.summary.trim() || fallbackSummary,
      modules: Number.isFinite(parsedModules) && parsedModules > 0 ? parsedModules : 5,
      preset: {
        clientName: "",
        projectTitle: templateForm.name.trim(),
        scopeSummary: templateForm.summary.trim() || fallbackSummary,
        timeline: templateForm.timeline.trim() || fallbackTimeline,
        budget: templateForm.budgetRange.trim() || fallbackBudget,
        pricingModel: templateForm.pricingModel,
        terms: templateForm.terms.trim() || "Payment terms to be discussed",
      },
    };

    setTemplates((previous) => [newTemplate, ...previous]);
    setIsSavingTemplate(false);
    setIsCreateTemplateModalOpen(false);
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

    setClients((previous) => [newClient, ...previous]);
    setIsSavingClient(false);
    setIsAddClientModalOpen(false);
  };

  const handleCreateDraft = async () => {
    setIsCreatingQuote(true);
    await wait(900);

    const draftId = `Q-${Math.floor(1000 + Math.random() * 9000)}`;
    const draftAmount = createForm.budget || "$1,500";
    const newDraft = {
      id: draftId,
      client: createForm.clientName || "New Client",
      amount: draftAmount,
      status: "Draft",
      updated: "Just now",
    };

    setQuotes((previous) => [newDraft, ...previous]);
    setAiPrompt(
      `Project: ${createForm.projectTitle || "New project"}\nClient: ${createForm.clientName || "New Client"}\nScope: ${createForm.scopeSummary || "To be defined"}\nTimeline: ${createForm.timeline || "TBD"}\nBudget: ${draftAmount}`,
    );

    setIsCreatingQuote(false);
    setIsCreateModalOpen(false);
    setCreateStep(1);
    setCreateForm(buildInitialCreateForm(settingsForm.defaultPricingModel));
    setCreateSuccessMessage("Draft quote created and added to Recent Quotes.");
  };

  const handleSaveSettings = () => {
    setSettingsMessage("Settings saved successfully.");
  };

  const handleResetSettings = () => {
    setSettingsForm(initialSettingsForm);
    setSettingsMessage("Settings reset to defaults.");
  };

  const handleApplyQuoteDefaults = () => {
    setCreateForm((previous) => ({
      ...previous,
      pricingModel: settingsForm.defaultPricingModel,
    }));
    setSettingsMessage("Quote defaults applied to the draft form.");
  };

  const handleSendTestEmail = () => {
    if (!settingsForm.notificationEmails) {
      setSettingsMessage("Enable notification emails first to send a test email.");
      return;
    }

    setSettingsMessage("Test notification email sent.");
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <div className="hidden md:block">
          <Sidebar onNavigate={handleSidebarNavigate} />
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
              <Sidebar onNavigate={handleSidebarNavigate} />
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
                    Welcome back, John.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`hidden rounded-full border px-2.5 py-1 text-xs font-semibold sm:inline-flex ${briefChip.className}`}
                >
                  {briefChip.label}
                </span>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                  onClick={openUploadModal}
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
              {kpiCards.map((card) => (
                <article
                  key={card.label}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <p className="m-0 text-sm text-slate-600">{card.label}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{card.value}</p>
                </article>
              ))}
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
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
                  onChange={(event) => setAiPrompt(event.target.value)}
                  className="mt-4 w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-400"
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Generate Quote
                  </button>
                  <button
                    type="button"
                    onClick={openTemplatesSection}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    Use Template
                  </button>
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="m-0 text-lg font-semibold text-slate-900">Plan Usage</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Free plan: 3 of 5 monthly quotes used.
                </p>
                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full w-3/5 rounded-full bg-blue-600" />
                </div>
                <button
                  type="button"
                  onClick={openUpgradeModal}
                  className="mt-4 w-full rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700"
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
                        <th className="py-2 pr-3 font-medium">Status</th>
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
                          <td className="py-3 pr-3 text-slate-700">{quote.status}</td>
                          <td className="py-3 pr-3 text-slate-700">{quote.updated}</td>
                          <td className="py-3">
                            <button
                              type="button"
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
                    <article key={quote.id} className="rounded-xl border border-slate-200 p-4">
                      <p className="m-0 text-sm font-semibold text-slate-900">{quote.id}</p>
                      <p className="mt-1 text-sm text-slate-700">{quote.client}</p>
                      <p className="mt-1 text-sm text-slate-600">{quote.amount}</p>
                      <p className="mt-1 text-sm text-slate-600">{quote.status}</p>
                      <p className="mt-1 text-xs text-slate-500">Updated {quote.updated}</p>
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
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="m-0 text-lg font-semibold text-slate-900">Clients</h2>
                <button
                  type="button"
                  onClick={openAddClientModal}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                >
                  + Add Client
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {clients.map((client) => (
                  <article key={client.id} className="rounded-xl border border-slate-200 p-4">
                    <p className="m-0 text-sm font-semibold text-slate-900">{client.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {client.activeQuotes} active quote{client.activeQuotes === 1 ? "" : "s"}
                    </p>
                  </article>
                ))}
              </div>
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
                  onClick={openUpgradeModal}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700"
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

                <article className="rounded-xl border border-slate-200 p-4">
                  <label className="mb-2 block text-sm text-slate-500">Notification Emails</label>
                  <button
                    type="button"
                    onClick={() =>
                      setSettingsForm((previous) => ({
                        ...previous,
                        notificationEmails: !previous.notificationEmails,
                      }))
                    }
                    className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                      settingsForm.notificationEmails
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    {settingsForm.notificationEmails ? "Enabled" : "Disabled"}
                  </button>
                </article>

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

                <article className="rounded-xl border border-slate-200 p-4">
                  <label className="mb-2 block text-sm text-slate-500">Auto-save Drafts</label>
                  <button
                    type="button"
                    onClick={() =>
                      setSettingsForm((previous) => ({
                        ...previous,
                        autoSaveDrafts: !previous.autoSaveDrafts,
                      }))
                    }
                    className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                      settingsForm.autoSaveDrafts
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    {settingsForm.autoSaveDrafts ? "Enabled" : "Disabled"}
                  </button>
                </article>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={handleResetSettings}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleApplyQuoteDefaults}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Apply to Quote Form
                </button>
                <button
                  type="button"
                  onClick={handleSendTestEmail}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Send Test Email
                </button>
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
    </div>
  );
}

export default Dashboard;
