import React from "react";
import { HashRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AppProvider, useApp } from "./store/AppStore";
import { Toast } from "./components/ui";
import { ClienteTabs, FrentistaTabs } from "./components/Layouts";
import { Welcome, Login } from "./screens/auth/Auth";
import Inicio from "./screens/cliente/Inicio";
import Carteira, { AdicionarCredito, AdicionarCartao, Cartoes, Pagar, Comprovante } from "./screens/cliente/Carteira";
import Resgatar, { MeuQR, Extrato, DetalhePremio, Vouchers, Voucher, Clube, DetalheParceiro } from "./screens/cliente/Pontos";
import { TravaPreco, Manutencao, Agendar, Notificacoes, Perfil, Veiculo } from "./screens/cliente/Servicos";
import { Painel, Metas, Ranking, FrPerfil } from "./screens/frentista/Frentista";

function RequireRole({ role }) {
  const { s } = useApp();
  if (!s.session) return <Navigate to="/" replace />;
  if (s.session.role !== role) return <Navigate to={s.session.role === "cliente" ? "/inicio" : "/frentista"} replace />;
  return <Outlet />;
}

function PublicOnly() {
  const { s } = useApp();
  if (s.session) return <Navigate to={s.session.role === "cliente" ? "/inicio" : "/frentista"} replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <div className="app">
          <Routes>
            <Route element={<PublicOnly />}>
              <Route path="/" element={<Welcome />} />
              <Route path="/entrar" element={<Login />} />
            </Route>

            <Route element={<RequireRole role="cliente" />}>
              <Route element={<ClienteTabs />}>
                <Route path="/inicio" element={<Inicio />} />
                <Route path="/carteira" element={<Carteira />} />
                <Route path="/resgatar" element={<Resgatar />} />
                <Route path="/clube" element={<Clube />} />
              </Route>
              <Route path="/qr" element={<MeuQR />} />
              <Route path="/extrato" element={<Extrato />} />
              <Route path="/carteira/adicionar-credito" element={<AdicionarCredito />} />
              <Route path="/carteira/adicionar-cartao" element={<AdicionarCartao />} />
              <Route path="/carteira/cartoes" element={<Cartoes />} />
              <Route path="/carteira/pagar" element={<Pagar />} />
              <Route path="/carteira/comprovante" element={<Comprovante />} />
              <Route path="/resgatar/:id" element={<DetalhePremio />} />
              <Route path="/vouchers" element={<Vouchers />} />
              <Route path="/vouchers/:code" element={<Voucher />} />
              <Route path="/clube/:id" element={<DetalheParceiro />} />
              <Route path="/trava-de-preco" element={<TravaPreco />} />
              <Route path="/manutencao" element={<Manutencao />} />
              <Route path="/manutencao/agendar/:id" element={<Agendar />} />
              <Route path="/notificacoes" element={<Notificacoes />} />
              <Route path="/perfil" element={<Perfil />} />
              <Route path="/perfil/veiculo" element={<Veiculo />} />
            </Route>

            <Route element={<RequireRole role="frentista" />}>
              <Route element={<FrentistaTabs />}>
                <Route path="/frentista" element={<Painel />} />
                <Route path="/frentista/metas" element={<Metas />} />
                <Route path="/frentista/ranking" element={<Ranking />} />
                <Route path="/frentista/perfil" element={<FrPerfil />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toast />
        </div>
      </HashRouter>
    </AppProvider>
  );
}
