import React from "react";
import { NavLink, Outlet, useNavigate, Navigate } from "react-router-dom";
import { useConfig } from "../config/ConfigProvider";
import { Home, Wallet, Gift, Star, QrCode, LayoutDashboard, Target, Medal, User } from "lucide-react";

const clienteNav = (f) => [
  { to: "/inicio", label: "Início", Icon: Home },
  f.wallet && { to: "/carteira", label: "Carteira", Icon: Wallet },
  "qr",
  { to: "/resgatar", label: "Resgatar", Icon: Gift },
  f.club && { to: "/clube", label: "Clube", Icon: Star },
].filter(Boolean);

/** Bloqueia rotas de recursos desligados na configuração da rede */
export function RequireFeature({ name }) {
  const { config } = useConfig();
  return config.features?.[name] === false ? <Navigate to="/inicio" replace /> : <Outlet />;
}

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
  const { config } = useConfig();
  return (
    <>
      <Outlet />
      <nav className="bottom-nav">
        {clienteNav(config.features || {}).map((n, i) =>
          n !== "qr" ? <NavItem key={n.to} {...n} /> : (
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
