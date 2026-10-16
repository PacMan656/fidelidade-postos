/**
 * Backend da plataforma de fidelidade. Regras: docs/REGRAS_DE_NEGOCIO.md.
 * Todas as alterações de saldo, pontos, vouchers e vendas passam por aqui (RN-64).
 */
export {
  joinTenant, updateProfile, issueCheckinToken, activateOffer, redeemReward, createPixCharge,
  addCard, removeCard, setDefaultCard, creditWithCard, payWithApp, lockFuelPrice, scheduleMaintenance, claimCoupon,
} from "./callable/customer.js";
export { lookupCustomer, registerSale, validateVoucher } from "./callable/staff.js";
export {
  publishConfig, rollbackConfig, listConfigHistory, myTenants, createTenant, setTenantStatus, setStaffRole,
  adjustPoints, cancelVoucher, confirmPixCharge,
} from "./callable/admin.js";
export { pixWebhook } from "./http/pixWebhook.js";
export { dailyExpirations, pixChargeExpiration } from "./scheduled/expirations.js";
