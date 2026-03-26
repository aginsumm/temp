import { Outlet } from "react-router-dom";
import Header from "../components/layout/Header";

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-cream to-amber-50/30">
      <Header />
      <main className="pt-16 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
