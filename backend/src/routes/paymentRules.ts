import { Router } from "express";
import { checkWithdrawalWindow, getPaymentRules } from "../lib/paymentSettings.js";

export const paymentRulesRouter = Router();

// Public: limits, fees, and the current withdrawal-window state so the
// wallet UI can show accurate hints before the user submits anything.
paymentRulesRouter.get("/", async (_req, res) => {
  try {
    const rules = await getPaymentRules();
    const window = checkWithdrawalWindow(rules);
    res.json({ ...rules, withdrawalOpenNow: window.allowed, withdrawalClosedReason: window.reason ?? null });
  } catch (error) {
    console.error("Error fetching payment rules:", error);
    res.status(500).json({ error: "Failed to fetch payment rules" });
  }
});
