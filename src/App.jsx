import React, { Suspense, lazy } from "react";
import { HashRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { ConfigProvider, useConfig, PREVIEW } from "./config/ConfigProvider";
import { AppProvider, useApp } from "./store/AppStore";
import { Toast } from "./components/ui";
import { ClienteTabs, FrentistaTabs, RequireFeature } from "./components/Layouts";
import { Welcome, Login, Cadastro } from "./screens/auth/Auth";
import Inicio from "./screens/cliente/Inicio";
import Carteira, { AdicionarCredito, AdicionarCartao, Cartoes, Pagar, Comprovante } from "./screens/cliente/Carteira";
import Resgatar, { MeuQR, Extrato, DetalhePremio, Vouchers, Voucher, Clube, DetalheParceiro } from "./screens/cliente/Pontos";
import { TravaPreco, Manutencao, Agendar, Notificacoes, Perfil, Veiculo } from "./screens/cliente/Servicos";
import { Painel, Metas, Ranking, FrPerfil } from "./screens/frentista/Frentista";
import { Atender, ValidarVoucher } from "./screens/frentista/Atendimento";

// o painel só é baixado por quem abre /admin
const Admin = lazy(() => import("./admin/Admin"));

const Loading = () => <div className="col" style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><span className="subtitle">Carregando…</span></div>;

function RequireRole({ role }) {
  const { s } = useApp();
  if (s.ready === false) return <Loading />;
  if (s.needsJoin) return <Navigate to="/cadastro" replace />;
  if (!s.session) return <Navigate to="/" replace />;
  if (s.session.role !== role) return <Navigate to={s.session.role === "cliente" ? "/inicio" : "/frentista"} replace />;
  return <Outlet />;
}

function PublicOnly() {
  const { s } = useApp();
  if (s.ready === false) return <Loading />;
  if (s.needsJoin) return <Navigate to="/cadastro" replace />;
  if (s.session) return <Navigate to={s.session.role === "cliente" ? "/inicio" : "/frentista"} replace />;
  return <Outlet />;
}

function MobileApp() {
  const { config, tenantId } = useConfig();
  return (
    // estado do usuário separado por rede; a chave de versão redesenha as telas quando a configuração muda
    <AppProvider key={tenantId} preview={PREVIEW}>
      <div className="app">
        <Routes key={config.version}>
          <Route element={<PublicOnly />}>
            <Route path="/" element={<Welcome />} />
            <Route path="/entrar" element={<Login />} />
          </Route>
          <Route path="/cadastro" element={<Cadastro />} />

          <Route element={<RequireRole role="cliente" />}>
            <Route element={<ClienteTabs />}>
              <Route path="/inicio" element={<Inicio />} />
              <Route path="/resgatar" element={<Resgatar />} />
              <Route element={<RequireFeature name="wallet" />}><Route path="/carteira" element={<Carteira />} /></Route>
              <Route element={<RequireFeature name="club" />}><Route path="/clube" element={<Clube />} /></Route>
            </Route>
            <Route path="/qr" element={<MeuQR />} />
            <Route path="/extrato" element={<Extrato />} />
            <Route element={<RequireFeature name="wallet" />}>
              <Route path="/carteira/adicionar-credito" element={<AdicionarCredito />} />
              <Route path="/carteira/adicionar-cartao" element={<AdicionarCartao />} />
              <Route path="/carteira/cartoes" element={<Cartoes />} />
              <Route path="/carteira/pagar" element={<Pagar />} />
              <Route path="/carteira/comprovante" element={<Comprovante />} />
            </Route>
            <Route path="/resgatar/:id" element={<DetalhePremio />} />
            <Route path="/vouchers" element={<Vouchers />} />
            <Route path="/vouchers/:code" element={<Voucher />} />
            <Route element={<RequireFeature name="club" />}><Route path="/clube/:id" element={<DetalheParceiro />} /></Route>
            <Route element={<RequireFeature name="priceLock" />}><Route path="/trava-de-preco" element={<TravaPreco />} /></Route>
            <Route element={<RequireFeature name="maintenance" />}>
              <Route path="/manutencao" element={<Manutencao />} />
              <Route path="/manutencao/agendar/:id" element={<Agendar />} />
              <Route path="/perfil/veiculo" element={<Veiculo />} />
            </Route>
            <Route path="/notificacoes" element={<Notificacoes />} />
            <Route path="/perfil" element={<Perfil />} />
          </Route>

          <Route element={<RequireRole role="frentista" />}>
            <Route element={<FrentistaTabs />}>
              <Route path="/frentista" element={<Painel />} />
              <Route path="/frentista/metas" element={<Metas />} />
              <Route path="/frentista/ranking" element={<Ranking />} />
              <Route path="/frentista/perfil" element={<FrPerfil />} />
            </Route>
            <Route path="/frentista/atender" element={<Atender />} />
            <Route path="/frentista/voucher" element={<ValidarVoucher />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toast />
      </div>
    </AppProvider>
  );
}

export default function App() {
  return (
    <ConfigProvider>
      <HashRouter>
        <Routes>
          <Route path="/admin/*" element={<Suspense fallback={<div style={{ padding: 24 }}>Carregando painel…</div>}><Admin /></Suspense>} />
          <Route path="*" element={<MobileApp />} />
        </Routes>
      </HashRouter>
    </ConfigProvider>
  );
}
