import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { useStore } from "./store";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Templates from "./pages/Templates";
import Contracts from "./pages/Contracts";
import ContractCreate from "./pages/ContractCreate";
import ContractDetail from "./pages/ContractDetail";
import ContractSign from "./pages/ContractSign";
import PendingSign from "./pages/PendingSign";
import MySignature from "./pages/MySignature";
import Search from "./pages/Search";
import Stats from "./pages/Stats";
import ReviewRules from "./pages/ReviewRules";
import RiskDashboard from "./pages/RiskDashboard";

function ProtectedRoute() {
  const user = useStore((s) => s.user);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Layout />;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/contracts" element={<Contracts />} />
          <Route path="/contracts/create" element={<ContractCreate />} />
          <Route path="/contract/:id" element={<ContractDetail />} />
          <Route path="/contract/:id/edit" element={<ContractCreate />} />
          <Route path="/contract/:id/sign" element={<ContractSign />} />
          <Route path="/pending" element={<PendingSign />} />
          <Route path="/signature" element={<MySignature />} />
          <Route path="/search" element={<Search />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/review-rules" element={<ReviewRules />} />
          <Route path="/risk-dashboard" element={<RiskDashboard />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
