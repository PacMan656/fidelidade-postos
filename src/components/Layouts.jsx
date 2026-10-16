import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Home, Wallet, Gift, Star, QrCode, LayoutDashboard, Target, Medal, User } from "lucide-react";

const clienteNav = [
  { to: "/inicio", label: "Início", Icon: Home },
  { to: "/carteira", label: "Carteira", Icon: Wallet },
  null,
  { to: "/resgatar", label: "Resgatar", Icon: Gift },
  { to: "/clube", label: "Clube", Icon: Star },
];

function NavItem({ to, label, Icon }) {
  return (
    <NavLink to={to} className={({ isActive }) => `nav-btn${isActive ? " on" : ""}`}>
      <Icon size={22} />
      <span>{label}</span>
    </NavLink>
  );
}

/* Abas do cliente com o botão central de QR */
export function ClienteTabs() {
  const nav = useNavigate();
  return (
    <>
      <Outlet />
      <nav className="bottom-nav">
        {clienteNav.map((n, i) =>
          n ? <NavItem key={n.to} {...n} /> : (
            <div key={i} style={{ flex: 1, display: "flex", justifyContent: "center" }}>
              <button className="nav-fab" onClick={() => nav("/qr")} aria-label="Meu QR Code"><QrCode size={26} color="#fff" /></button>
            </div>
          )
        )}
      </nav>
    </>
  );
}

const frNav = [
  { to: "/frentista", label: "Painel", Icon: LayoutDashboard, end: true },
  { to: "/frentista/metas", label: "Metas", Icon: Target },
  { to: "/frentista/ranking", label: "Ranking", Icon: Medal },
  { to: "/frentista/perfil", label: "Perfil", Icon: User },
];

export function FrentistaTabs() {
  return (
    <>
      <Outlet />
      <nav className="bottom-nav">
        {frNav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-btn${isActive ? " on" : ""}`}>
            <n.Icon size={22} />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
