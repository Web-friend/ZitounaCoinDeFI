import { useEffect } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { ArrowLeft, Leaf } from "lucide-react";
import Layout from "./components/Layout.jsx";
import Market from "./pages/Market.jsx";
import LotDetail from "./pages/LotDetail.jsx";
import Buy from "./pages/Buy.jsx";
import Wallet from "./pages/Wallet.jsx";
import Redemptions from "./pages/Redemptions.jsx";
import RedemptionDetail from "./pages/RedemptionDetail.jsx";
import Passport from "./pages/Passport.jsx";
import Passports from "./pages/Passports.jsx";
import Label from "./pages/Label.jsx";
import Demo from "./pages/Demo.jsx";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

function NotFound() {
  return (
    <div className="shell flex flex-col items-center py-24 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-olive-light text-olive">
        <Leaf className="h-5 w-5" />
      </span>
      <h1 className="mt-4 font-display text-3xl font-bold">This row is empty</h1>
      <p className="mt-2 max-w-md text-sm text-ink-soft">
        The page you asked for is not in the ledger. Head back to the market and pick a lot.
      </p>
      <Link to="/" className="btn-primary mt-5">
        <ArrowLeft className="h-4 w-4" />
        Back to market
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Market />} />
        <Route path="/lots/:id" element={<LotDetail />} />
        <Route path="/lots/:id/buy" element={<Buy />} />
        <Route path="/lots/:id/label" element={<Label />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/redemptions" element={<Redemptions />} />
        <Route path="/redemptions/:id" element={<RedemptionDetail />} />
        <Route path="/passports" element={<Passports />} />
        <Route path="/l/:id" element={<Passport />} />
        <Route path="/demo" element={<Demo />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}
