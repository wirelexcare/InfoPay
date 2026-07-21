import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useAuthStore } from "./lib/store";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { KycPage } from "./pages/KycPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { PortfolioPage } from "./pages/PortfolioPage";
import { InvestmentDetailPage } from "./pages/InvestmentDetailPage";
import { WalletPage } from "./pages/WalletPage";
import { ReferralDashboardPage } from "./pages/ReferralDashboardPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { AdminPage } from "./pages/AdminPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { AdminUserDetailPage } from "./pages/AdminUserDetailPage";
import { AdminKycPage } from "./pages/AdminKycPage";
import { AdminProjectsPage } from "./pages/AdminProjectsPage";
import { AdminProjectEditPage } from "./pages/AdminProjectEditPage";
import { AdminFinancialsPage } from "./pages/AdminFinancialsPage";
import { AdminPaymentsPage } from "./pages/AdminPaymentsPage";
import { AdminPaymentDetailPage } from "./pages/AdminPaymentDetailPage";
import { AdminWithdrawalsPage } from "./pages/AdminWithdrawalsPage";
import { AdminWithdrawalDetailPage } from "./pages/AdminWithdrawalDetailPage";
import { AdminRoiPage } from "./pages/AdminRoiPage";
import { AdminRoiDetailPage } from "./pages/AdminRoiDetailPage";
import { AdminReferralConfigPage } from "./pages/AdminReferralConfigPage";
import { AdminDepositsPage } from "./pages/AdminDepositsPage";
import { AdminDepositDetailPage } from "./pages/AdminDepositDetailPage";

function RequireAuth({ children }: { children: JSX.Element }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Landing() {
  const user = useAuthStore((s) => s.user);
  if (user) return <Navigate to="/dashboard" replace />;
  return <LoginPage />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route
          path="/kyc"
          element={
            <RequireAuth>
              <KycPage />
            </RequireAuth>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/portfolio"
          element={
            <RequireAuth>
              <PortfolioPage />
            </RequireAuth>
          }
        />
        <Route
          path="/portfolio/:id"
          element={
            <RequireAuth>
              <InvestmentDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/wallet"
          element={
            <RequireAuth>
              <WalletPage />
            </RequireAuth>
          }
        />
        <Route path="/profile" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/referrals"
          element={
            <RequireAuth>
              <ReferralDashboardPage />
            </RequireAuth>
          }
        />
      </Route>

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <AdminPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/users"
        element={
          <RequireAuth>
            <AdminUsersPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/users/:userId"
        element={
          <RequireAuth>
            <AdminUserDetailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/kyc"
        element={
          <RequireAuth>
            <AdminKycPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/projects"
        element={
          <RequireAuth>
            <AdminProjectsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/projects/:projectId"
        element={
          <RequireAuth>
            <AdminProjectEditPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/financials"
        element={
          <RequireAuth>
            <AdminFinancialsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/payments"
        element={
          <RequireAuth>
            <AdminPaymentsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/payments/:paymentId"
        element={
          <RequireAuth>
            <AdminPaymentDetailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/withdrawals"
        element={
          <RequireAuth>
            <AdminWithdrawalsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/withdrawals/:txnId"
        element={
          <RequireAuth>
            <AdminWithdrawalDetailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/roi"
        element={
          <RequireAuth>
            <AdminRoiPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/roi/:investmentId"
        element={
          <RequireAuth>
            <AdminRoiDetailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/referrals"
        element={
          <RequireAuth>
            <AdminReferralConfigPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/deposits"
        element={
          <RequireAuth>
            <AdminDepositsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/deposits/:depositId"
        element={
          <RequireAuth>
            <AdminDepositDetailPage />
          </RequireAuth>
        }
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
