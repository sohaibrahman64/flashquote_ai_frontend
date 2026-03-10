import { useEffect, useState } from "react";
import {
  CardElement,
  Elements,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import {
  useAuth,
  useUser,
  SignIn,
  SignUp,
  SignedIn,
  SignedOut,
  SignOutButton,
  UserButton,
} from "@clerk/clerk-react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { BASE_URL } from "./Constants";
import Dashboard from "./Dashboard";

const stripePublishableKey = (
  process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY ||
  process.env.STRIPE_PUBLISHABLE_KEY ||
  ""
).trim();
const stripePromise =
  stripePublishableKey.length > 0 ? loadStripe(stripePublishableKey) : null;

const planPricing = {
  Free: 0,
  Starter: 9,
  Professional: 29,
  "Agency Plus": 79,
};

const apiBaseUrl = `${BASE_URL}`;
const syncedUserSessions = new Set();
const processedSubscriptionRequests = new Set();
const SYNC_STORAGE_KEY = "session_token";
const SUBSCRIPTION_STORAGE_KEY = "subscription_snapshot";

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function storePendingFreeSubscription(source = "landing_page_try_for_free") {
  const payload = {
    plan_code: "FREE",
    idempotency_key: createIdempotencyKey(),
    source,
    client_timestamp: new Date().toISOString(),
  };

  sessionStorage.setItem("pending_free_subscription", JSON.stringify(payload));
  return payload;
}

function getPendingFreeSubscription(source = "landing_page_try_for_free") {
  const rawPending = sessionStorage.getItem("pending_free_subscription");
  const fallback = {
    plan_code: "FREE",
    idempotency_key: createIdempotencyKey(),
    source,
    client_timestamp: new Date().toISOString(),
  };

  if (!rawPending) {
    sessionStorage.setItem("pending_free_subscription", JSON.stringify(fallback));
    return fallback;
  }

  try {
    const parsed = JSON.parse(rawPending);
    const normalized = {
      plan_code: "FREE",
      idempotency_key: parsed?.idempotency_key || createIdempotencyKey(),
      source: parsed?.source || source,
      client_timestamp: parsed?.client_timestamp || new Date().toISOString(),
    };

    sessionStorage.setItem("pending_free_subscription", JSON.stringify(normalized));
    return normalized;
  } catch {
    sessionStorage.setItem("pending_free_subscription", JSON.stringify(fallback));
    return fallback;
  }
}

async function activateFreeSubscription({
  getToken,
  bearerToken,
  source = "landing_page_try_for_free",
}) {
  const pending = getPendingFreeSubscription(source);
  const idempotencyKey = pending.idempotency_key;

  if (processedSubscriptionRequests.has(idempotencyKey)) {
    return {
      status: "skipped",
      reason: "already_processed_in_session",
      idempotencyKey,
    };
  }

  processedSubscriptionRequests.add(idempotencyKey);

  try {
    const jwt = bearerToken || (await getToken?.());

    if (!jwt) {
      throw new Error("Missing auth token for subscription request.");
    }

    const response = await fetch(`${apiBaseUrl}/api/subscriptions/subscribe`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        plan_code: "FREE",
        idempotency_key: idempotencyKey,
        source: pending.source,
        client_timestamp: pending.client_timestamp,
      }),
    });

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok && response.status !== 409) {
      throw new Error(
        responseData.message || "Failed to activate free subscription.",
      );
    }

    if (responseData && typeof responseData === "object") {
      localStorage.setItem(
        SUBSCRIPTION_STORAGE_KEY,
        JSON.stringify(responseData),
      );
    }

    sessionStorage.removeItem("pending_free_subscription");
    return {
      status: response.status === 409 ? "already_active" : "success",
      data: responseData,
      idempotencyKey,
    };
  } catch (requestError) {
    processedSubscriptionRequests.delete(idempotencyKey);
    throw requestError;
  }
}

async function syncUserSession({ getToken, userId, sessionId, user }) {
  if (!user || !userId || !sessionId) {
    throw new Error("Missing Clerk auth context for user sync.");
  }

  const syncKey = `${userId}:${sessionId}`;
  const token = await getToken();

  if (!token) {
    throw new Error("Missing auth token for user sync.");
  }

  if (syncedUserSessions.has(syncKey)) {
    return {
      alreadySynced: true,
      token,
      data: { message: "User already synced for this session." },
    };
  }

  syncedUserSessions.add(syncKey);

  const payload = {
    auth: {
      userId,
      sessionId,
    },
    user: {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      primaryEmailAddress: user.primaryEmailAddress?.emailAddress,
      imageUrl: user.imageUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  };

  try {
    const response = await fetch(`${apiBaseUrl}/api/users/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Failed to sync user.");
    }

    if (data?.session_token) {
      localStorage.setItem(SYNC_STORAGE_KEY, data.session_token);
    }

    return {
      alreadySynced: false,
      token,
      data,
      status: response.status,
    };
  } catch (error) {
    syncedUserSessions.delete(syncKey);
    throw error;
  }
}

function AuthCallbackPage() {
  const { getToken, sessionId, userId } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const runPostLoginFlow = async () => {
      if (!user || !userId || !sessionId) {
        return;
      }

      setStatus("loading");
      setErrorMessage("");

      try {
        const syncResult = await syncUserSession({
          getToken,
          sessionId,
          userId,
          user,
        });

        await activateFreeSubscription({
          getToken,
          bearerToken: syncResult.token,
          source: "auto_login_post_sync",
        });

        setStatus("success");
        navigate("/dashboard", { replace: true });
      } catch (error) {
        setStatus("error");
        setErrorMessage(error.message || "Failed to complete login setup.");
      }
    };

    runPostLoginFlow();
  }, [getToken, navigate, sessionId, user, userId]);

  return (
    <PageLayout>
      <main className="mx-auto max-w-3xl px-6 py-14">
        <h2 className="mb-2 text-3xl font-semibold">Setting Up Your Account</h2>
        {status === "loading" ? (
          <p className="text-gray-600">
            Completing login and activating your free plan...
          </p>
        ) : null}
        {status === "error" ? <p className="text-red-600">{errorMessage}</p> : null}
        {status === "success" ? (
          <p className="text-green-600">Setup complete. Redirecting to dashboard...</p>
        ) : null}
      </main>
    </PageLayout>
  );
}

function PageLayout({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-white text-gray-900">
      <header className="border-b border-slate-100 px-6 py-5">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-6">
          <Link to="/" className="text-xl font-bold text-gray-900 no-underline">
            FlashQuote AI
          </Link>
          <div className="flex items-center gap-5">
            <Link
              to="/"
              className="text-sm font-medium text-gray-700 no-underline hover:text-blue-700"
            >
              Home
            </Link>
            <a
              href="/#about-us"
              className="text-sm font-medium text-gray-700 no-underline hover:text-blue-700"
            >
              About Us
            </a>
            <a
              href="/#how-it-works"
              className="text-sm font-medium text-gray-700 no-underline hover:text-blue-700"
            >
              How It Works
            </a>
            <a
              href="/#pricing"
              className="text-sm font-medium text-gray-700 no-underline hover:text-blue-700"
            >
              Pricing
            </a>
            <SignedOut>
              <Link
                to="/sign-in"
                className="rounded-full border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-600 no-underline"
              >
                Login
              </Link>
            </SignedOut>
            <SignedIn>
              <SignOutButton>
                <button
                  type="button"
                  className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700"
                >
                  Logout
                </button>
              </SignOutButton>
            </SignedIn>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </nav>
      </header>
      {children}

      <footer className="border-t border-slate-100 px-6 py-8">
        <div className="mx-auto grid max-w-6xl gap-2 text-sm text-gray-600 md:grid-cols-3 md:items-center">
          <p className="m-0 font-semibold text-gray-800">FlashQuote AI</p>
          <p className="m-0 md:text-center">Owner Email: owner@flashquote.ai</p>
          <p className="m-0 md:text-right">Mobile: +91 98765 43210</p>
        </div>
      </footer>
    </div>
  );
}

function HomePage() {
  const navigate = useNavigate();

  const handleTryForFree = (isAuthenticated) => {
    storePendingFreeSubscription("landing_page_try_for_free");

    if (isAuthenticated) {
      navigate("/activate-free");
      return;
    }

    navigate(`/sign-in?redirect_url=${encodeURIComponent("/activate-free")}`);
  };

  return (
    <PageLayout>
      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="max-w-3xl" id="home">
          <p className="mb-4 font-semibold text-blue-700">
            AI-Powered Software Service Quotation
          </p>
          <h1 className="m-0 text-4xl font-bold leading-tight md:text-6xl">
            Create Professional Quotes in Minutes, Not Hours
          </h1>
          <p className="mt-5 max-w-2xl text-[1.05rem] leading-7 text-gray-700">
            Built for freelancers who struggle to price projects confidently.
            FlashQuote AI helps you generate clear, client-ready software
            service quotations you can export and send as a document.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <SignedOut>
              <button
                type="button"
                onClick={() => handleTryForFree(false)}
                className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white no-underline"
              >
                Try For Free
              </button>
            </SignedOut>
            <SignedIn>
              <button
                type="button"
                onClick={() => handleTryForFree(true)}
                className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white no-underline"
              >
                Try For Free
              </button>
            </SignedIn>
          </div>
        </div>

        <section className="mt-16" id="about-us">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-6">
            <h2 className="mb-3 text-3xl font-semibold">About Us</h2>
            <p className="m-0 leading-7 text-gray-700">
              FlashQuote AI is designed for freelancers who want to quote
              software services with confidence. The app helps convert project
              requirements into practical estimates and professional quotations
              ready to send to clients.
            </p>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="mb-5 text-3xl font-semibold">
            Why freelancers choose FlashQuote AI
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-2xl">
                🧩
              </div>
              <h3 className="mb-2 mt-0 text-lg font-semibold">
                Smart Project Breakdown
              </h3>
              <p className="m-0 leading-7 text-gray-600">
                Describe your project once and get instant effort estimates by
                module, timeline, and complexity.
              </p>
            </article>
            <article className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-2xl">
                💰
              </div>
              <h3 className="mb-2 mt-0 text-lg font-semibold">
                Accurate Pricing Guidance
              </h3>
              <p className="m-0 leading-7 text-gray-600">
                AI suggests pricing ranges based on scope, stack, delivery
                speed, and your working model.
              </p>
            </article>
            <article className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-2xl">
                📄
              </div>
              <h3 className="mb-2 mt-0 text-lg font-semibold">
                Client-Ready Documents
              </h3>
              <p className="m-0 leading-7 text-gray-600">
                Turn estimates into polished quotations you can export as a
                document and share directly with clients.
              </p>
            </article>
          </div>
        </section>

        <section className="mt-12" id="how-it-works">
          <h2 className="mb-5 text-3xl font-semibold">How it works</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-2xl">
                📝
              </div>
              <span className="mb-2 inline-block font-bold text-blue-700">
                01
              </span>
              <p className="m-0 leading-7 text-gray-600">
                Enter project requirements and expected deliverables.
              </p>
            </article>
            <article className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-2xl">
                🤖
              </div>
              <span className="mb-2 inline-block font-bold text-blue-700">
                02
              </span>
              <p className="m-0 leading-7 text-gray-600">
                Review AI-generated timeline, effort, and pricing suggestions.
              </p>
            </article>
            <article className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-2xl">
                📤
              </div>
              <span className="mb-2 inline-block font-bold text-blue-700">
                03
              </span>
              <p className="m-0 leading-7 text-gray-600">
                Export your final quotation document and send it to the client.
              </p>
            </article>
          </div>
        </section>

        <section className="mt-12" id="pricing">
          <h2 className="mb-2 text-3xl font-semibold">Pricing</h2>
          <p className="mb-6 text-gray-600">
            Choose a plan that matches your freelance workflow.
          </p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-gray-200 bg-white p-6">
              <h3 className="m-0 text-xl font-semibold">Free</h3>
              <p className="mb-4 mt-2 text-3xl font-bold text-blue-700">
                $0/month
              </p>
              <ul className="m-0 list-disc space-y-2 pl-5 text-gray-600">
                <li>Up to 5 quotations per month</li>
                <li>Core AI estimate suggestions</li>
                <li>Standard quotation template</li>
                <li>Export to PDF</li>
                <li>Community email support</li>
              </ul>
              <Link
                to="/checkout?plan=Free"
                className="mt-6 block w-full rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-center text-sm font-semibold text-blue-700 no-underline"
              >
                Subscribe to Free
              </Link>
            </article>

            <article className="rounded-2xl border border-gray-200 bg-white p-6">
              <h3 className="m-0 text-xl font-semibold">Starter</h3>
              <p className="mb-4 mt-2 text-3xl font-bold text-blue-700">
                $9/month
              </p>
              <ul className="m-0 list-disc space-y-2 pl-5 text-gray-600">
                <li>Up to 25 quotations per month</li>
                <li>Basic AI pricing suggestions</li>
                <li>Editable quotation templates</li>
                <li>Export to PDF and DOC</li>
                <li>Email support</li>
              </ul>
              <Link
                to="/checkout?plan=Starter"
                className="mt-6 block w-full rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white no-underline"
              >
                Subscribe to Starter
              </Link>
            </article>

            <article className="rounded-2xl border-2 border-blue-600 bg-blue-50 p-6">
              <p className="mb-2 inline-block rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                Most Popular
              </p>
              <h3 className="m-0 text-xl font-semibold">Professional</h3>
              <p className="mb-4 mt-2 text-3xl font-bold text-blue-700">
                $29/month
              </p>
              <ul className="m-0 list-disc space-y-2 pl-5 text-gray-700">
                <li>Unlimited quotations</li>
                <li>Advanced AI scope breakdown</li>
                <li>Profit margin recommendations</li>
                <li>Branded quotation templates</li>
                <li>Download PDF and DOC formats</li>
                <li>Priority email support</li>
              </ul>
              <Link
                to="/checkout?plan=Professional"
                className="mt-6 block w-full rounded-lg bg-blue-700 px-4 py-2 text-center text-sm font-semibold text-white no-underline"
              >
                Subscribe to Professional
              </Link>
            </article>

            <article className="rounded-2xl border border-gray-200 bg-white p-6">
              <h3 className="m-0 text-xl font-semibold">Agency Plus</h3>
              <p className="mb-4 mt-2 text-3xl font-bold text-blue-700">
                $79/month
              </p>
              <ul className="m-0 list-disc space-y-2 pl-5 text-gray-600">
                <li>Everything in Professional</li>
                <li>Multi-user team collaboration</li>
                <li>Client-wise pricing history</li>
                <li>Custom terms and tax settings</li>
                <li>API access for CRM integrations</li>
                <li>Dedicated support channel</li>
              </ul>
              <Link
                to="/checkout?plan=Agency%20Plus"
                className="mt-6 block w-full rounded-lg bg-gray-900 px-4 py-2 text-center text-sm font-semibold text-white no-underline"
              >
                Subscribe to Agency Plus
              </Link>
            </article>
          </div>
        </section>
      </main>
    </PageLayout>
  );
}

function CheckoutForm({ plan }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const amount = planPricing[plan] ?? 0;
  const isFreePlan = amount === 0;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (isFreePlan) {
      setSuccessMessage("Free plan activated successfully.");
      return;
    }

    if (!stripe || !elements) {
      setErrorMessage("Stripe is still loading. Please try again.");
      return;
    }

    const cardElement = elements.getElement(CardElement);

    if (!cardElement) {
      setErrorMessage("Card input is not ready yet. Please try again.");
      return;
    }

    setIsSubmitting(true);

    const { error } = await stripe.createPaymentMethod({
      type: "card",
      card: cardElement,
      billing_details: {
        name: "FlashQuote Customer",
      },
    });

    if (error) {
      setErrorMessage(
        error.message || "Payment failed. Please check your card details.",
      );
      setIsSubmitting(false);
      return;
    }

    setSuccessMessage(
      "Card details captured successfully. Connect backend payment intent to complete charge.",
    );
    setIsSubmitting(false);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-gray-200 bg-white p-6"
    >
      <p className="m-0 text-gray-600">Selected Plan</p>
      <p className="mt-2 text-2xl font-semibold text-blue-700">{plan}</p>
      <p className="mt-1 text-gray-600">Amount: ${amount}/month</p>

      {!isFreePlan ? (
        <div className="mt-5 rounded-lg border border-gray-300 bg-white p-3">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: "16px",
                  color: "#111827",
                  "::placeholder": {
                    color: "#9ca3af",
                  },
                },
                invalid: {
                  color: "#dc2626",
                },
              },
            }}
          />
        </div>
      ) : null}

      {errorMessage ? (
        <p className="mt-3 text-sm text-red-600">{errorMessage}</p>
      ) : null}
      {successMessage ? (
        <p className="mt-3 text-sm text-green-600">{successMessage}</p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting || (!stripe && !isFreePlan)}
        className="mt-5 w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting
          ? "Processing..."
          : isFreePlan
            ? "Activate Free Plan"
            : `Pay $${amount} with Stripe`}
      </button>
    </form>
  );
}

function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const plan = searchParams.get("plan") || "Free";

  return (
    <PageLayout>
      <main className="mx-auto max-w-3xl px-6 py-14">
        <h2 className="mb-2 text-3xl font-semibold">Checkout</h2>
        <SignedOut>
          <Navigate
            to={`/sign-in?redirect_url=${encodeURIComponent(`/checkout?plan=${plan}`)}`}
            replace
          />
        </SignedOut>
        <SignedIn>
          {plan === "Free" || stripePromise ? (
            <Elements stripe={stripePromise}>
              <CheckoutForm plan={plan} />
            </Elements>
          ) : (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
              Stripe publishable key is missing. Set
              REACT_APP_STRIPE_PUBLISHABLE_KEY in .env.
            </div>
          )}
        </SignedIn>
      </main>
    </PageLayout>
  );
}

function ActivateFreePageContent() {
  const { getToken, sessionId, userId } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const activate = async () => {
      setStatus("loading");
      setError("");

      try {
        const syncResult = await syncUserSession({
          getToken,
          sessionId,
          userId,
          user,
        });

        await activateFreeSubscription({
          getToken,
          bearerToken: syncResult.token,
          source: "landing_page_try_for_free",
        });
        setStatus("success");
        navigate("/dashboard", { replace: true });
      } catch (requestError) {
        setStatus("error");
        setError(requestError.message || "Failed to activate free subscription.");
      }
    };

    activate();
  }, [getToken, navigate, sessionId, user, userId]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <h2 className="mb-2 text-3xl font-semibold">Activating Free Plan</h2>
      {status === "loading" ? <p className="text-gray-600">Please wait while we activate your free plan...</p> : null}
      {status === "error" ? <p className="text-red-600">{error}</p> : null}
      {status === "success" ? <p className="text-green-600">Free plan activated. Redirecting to dashboard...</p> : null}
    </main>
  );
}

function ActivateFreePage() {
  return (
    <PageLayout>
      <SignedOut>
        <Navigate to={`/sign-in?redirect_url=${encodeURIComponent("/activate-free")}`} replace />
      </SignedOut>
      <SignedIn>
        <ActivateFreePageContent />
      </SignedIn>
    </PageLayout>
  );
}

function HomeRoute() {
  const hasSessionToken =
    typeof window !== "undefined" &&
    Boolean(localStorage.getItem(SYNC_STORAGE_KEY));

  if (hasSessionToken) {
    return <Navigate to="/dashboard" replace />;
  }

  return <HomePage />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/auth-callback" element={<AuthCallbackPage />} />
      <Route path="/activate-free" element={<ActivateFreePage />} />
      <Route path="/pricing" element={<Navigate to="/#pricing" replace />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route
        path="/sign-in/*"
        element={
          <PageLayout>
            <main className="flex min-h-[70vh] items-center justify-center px-6 py-10">
              <SignIn
                routing="path"
                path="/sign-in"
                signUpUrl="/sign-up"
                fallbackRedirectUrl="/auth-callback"
              />
            </main>
          </PageLayout>
        }
      />
      <Route
        path="/sign-up/*"
        element={
          <PageLayout>
            <main className="flex min-h-[70vh] items-center justify-center px-6 py-10">
              <SignUp
                routing="path"
                path="/sign-up"
                signInUrl="/sign-in"
                fallbackRedirectUrl="/auth-callback"
              />
            </main>
          </PageLayout>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
