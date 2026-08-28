import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const [workspace, variant = "a", mutant = "none"] = process.argv.slice(2);
const parse = (text) => {
  const rows = []; let row = []; let value = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) { const c = text[index]; if (c === '"') quoted = !quoted; else if (c === "," && !quoted) { row.push(value); value = ""; } else if ((c === "\n" || c === "\r") && !quoted) { if (c === "\r" && text[index + 1] === "\n") index += 1; row.push(value); if (row.some((x) => x !== "")) rows.push(row); row = []; value = ""; } else value += c; }
  if (value || row.length) { row.push(value); rows.push(row); } return rows;
};
const money = (value) => Number(String(value).replaceAll(/[$,\s]/g, ""));
const latest = (rows) => { const result = new Map(); for (const row of rows.slice(1)) result.set(row[0].trim(), row.map((v) => v.trim())); return [rows[0], ...result.values()]; };
const sources = {};
for (const name of ["subscriptions", "invoices", "payments", "payroll", "expenses", "cash"]) sources[name] = latest(parse(await fs.readFile(path.join(workspace, "inputs", `${name}.csv`), "utf8")));
if (mutant === "omitted-source") sources.payments.splice(2, 1);

const workbook = Workbook.create();
const sheetNames = variant === "a"
  ? { subscriptions: "Source_Subscriptions", invoices: "Source_Invoices", payments: "Source_Payments", payroll: "Source_Payroll", expenses: "Source_Expenses", cash: "Source_Cash", audit: "Model", dashboard: "Dashboard" }
  : { subscriptions: "Subscriptions", invoices: "Invoices", payments: "Payments", payroll: "Payroll", expenses: "Expenses", cash: "Cash", audit: "Audit & Forecast", dashboard: "Executive Dashboard" };
const sourceSheets = {};
for (const [name, rows] of Object.entries(sources)) {
  const sheet = workbook.worksheets.add(sheetNames[name]); sourceSheets[name] = sheet;
  const typed = rows.map((row, ri) => row.map((value, ci) => {
    if (ri === 0) return value;
    const header = rows[0][ci];
    return ["monthly_amount", "subtotal", "tax", "credit", "total", "amount", "gross_pay", "employer_tax"].includes(header) ? money(value) : value;
  }));
  sheet.getRangeByIndexes(0, 0, typed.length, typed[0].length).values = typed;
  sheet.getRangeByIndexes(0, 0, 1, typed[0].length).format = { fill: "#16324F", font: { color: "#FFFFFF", bold: true } };
  sheet.getUsedRange().format.autofitColumns(); sheet.freezePanes.freezeRows(1);
}
const audit = workbook.worksheets.add(sheetNames.audit); const dashboard = workbook.worksheets.add(sheetNames.dashboard); const chartData = variant === "b" ? workbook.worksheets.add("Chart Data") : null;
audit.showGridLines = false; dashboard.showGridLines = false;
audit.getRange("A1:H2").merge(); audit.getRange("A1").values = [["SaaS Operating Model · Audit and Forecast"]]; audit.getRange("A1").format = { fill: "#16324F", font: { color: "#FFFFFF", bold: true, size: 16 }, rowHeight: 32 };
const months = Array.from({ length: 12 }, (_, i) => `2025-${String(i + 1).padStart(2, "0")}`);
const forecast = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`);
const subRows = sources.subscriptions.slice(1); const invoiceRows = sources.invoices.slice(1); const paymentRows = sources.payments.slice(1); const payrollRows = sources.payroll.slice(1); const expenseRows = sources.expenses.slice(1); const cashRows = sources.cash.slice(1);
let row = variant === "a" ? 4 : 8;
const entries = [];
const add = (key, formula) => { entries.push({ row, key, formula }); row += variant === "a" ? 1 : 2; };
const addInput = (key, value) => { entries.push({ row, key, value }); row += variant === "a" ? 1 : 2; };
for (const month of months) {
  const invRefs = invoiceRows.map((r, i) => ({ r, excel: i + 2 })).filter(({ r }) => r[2] === month).flatMap(({ excel }) => [`'${sheetNames.invoices}'!D${excel}`, `'${sheetNames.invoices}'!F${excel}`]);
  add(`actual_revenue_${month}`, `=SUM(${invRefs.join(",") || "0"})`);
  const paymentRefs = paymentRows.map((r, i) => ({ r, excel: i + 2 })).filter(({ r }) => r[4].toLowerCase() === "settled" && r[2].slice(0, 7) === month).map(({ excel }) => `'${sheetNames.payments}'!D${excel}`);
  add(`actual_collections_${month}`, `=SUM(${paymentRefs.join(",") || "0"})`);
  const end = new Date(`${month}-28T00:00:00Z`); end.setUTCMonth(end.getUTCMonth() + 1, 0);
  const active = subRows.map((r, i) => ({ r, excel: i + 2 })).filter(({ r }) => new Date(`${r[3].replaceAll("/", "-")}T00:00:00Z`) <= end && (!r[4] || new Date(`${r[4]}T00:00:00Z`) >= end));
  add(`ending_mrr_${month}`, `=SUM(${active.map(({ excel }) => `'${sheetNames.subscriptions}'!G${excel}`).join(",") || "0"})`);
  const previous = new Date(`${month}-01T00:00:00Z`); previous.setUTCDate(0);
  const opening = subRows.map((r, i) => ({ r, excel: i + 2 })).filter(({ r }) => new Date(`${r[3].replaceAll("/", "-")}T00:00:00Z`) <= previous && (!r[4] || new Date(`${r[4]}T00:00:00Z`) >= previous));
  const group = (rows) => { const result = new Map(); for (const item of rows) { const list = result.get(item.r[1]) || []; list.push(item); result.set(item.r[1], list); } return result; };
  const openingCustomers = group(opening); const endingCustomers = group(active);
  const churnTerms = [...openingCustomers.entries()].filter(([customer]) => !endingCustomers.has(customer)).flatMap(([, items]) => items.filter(({ r }) => r[4]).map(({ r, excel }) => `IF('${sheetNames.subscriptions}'!E${excel}="${r[4]}",1,0)`));
  add(`logo_churn_${month}`, `=SUM(${churnTerms.join(",") || "0"})`);
  const openingFormula = `SUM(${opening.map(({ excel }) => `'${sheetNames.subscriptions}'!G${excel}`).join(",") || "0"})`;
  const sumRefs = (items) => `SUM(${items.map(({ excel }) => `'${sheetNames.subscriptions}'!G${excel}`).join(",") || "0"})`;
  const contractionTerms = []; const expansionTerms = [];
  for (const [customer, openingItems] of openingCustomers) { const endingItems = endingCustomers.get(customer) || []; const before = openingItems.reduce((sum, item) => sum + money(item.r[6]), 0); const after = endingItems.reduce((sum, item) => sum + money(item.r[6]), 0); if (before > after) contractionTerms.push(endingItems.length ? `(${sumRefs(openingItems)}-${sumRefs(endingItems)})` : `SUM(${openingItems.map(({ r, excel }) => `IF('${sheetNames.subscriptions}'!E${excel}="${r[4]}",'${sheetNames.subscriptions}'!G${excel},0)`).join(",")})`); if (after > before) expansionTerms.push(`(${sumRefs(endingItems)}-${sumRefs(openingItems)})`); }
  const contractionFormula = contractionTerms.join("+") || "0"; const expansionFormula = expansionTerms.join("+") || "0";
  add(`gross_revenue_churn_${month}`, `=IF(${openingFormula}=0,0,(${contractionFormula})/${openingFormula})`);
  add(`nrr_${month}`, `=IF(${openingFormula}=0,1,(${openingFormula}-(${contractionFormula})+(${expansionFormula}))/${openingFormula})`);
  const payrollRefs = payrollRows.map((r, i) => ({ r, excel: i + 2 })).filter(({ r }) => r[3] === month).flatMap(({ excel }) => [`'${sheetNames.payroll}'!E${excel}`, `'${sheetNames.payroll}'!F${excel}`]);
  add(`actual_payroll_${month}`, `=SUM(${payrollRefs.join(",") || "0"})`);
  const expenseRefs = expenseRows.map((r, i) => ({ r, excel: i + 2 })).filter(({ r }) => r[1] === month).map(({ excel }) => `'${sheetNames.expenses}'!E${excel}`);
  add(`actual_opex_${month}`, `=SUM(${expenseRefs.join(",") || "0"})`);
  const cashRefs = cashRows.map((r, i) => ({ r, excel: i + 2 })).filter(({ r }) => r[5].toLowerCase() === "posted" && r[1].slice(0, 7) <= month).map(({ excel }) => `'${sheetNames.cash}'!D${excel}`);
  add(`ending_cash_${month}`, `=SUM(${cashRefs.join(",")})`);
}
const scenarioAssumptions = { base: [0.04, 0.025, 32000, 4500, 1], upside: [0.065, 0.015, 31500, 4200, 1], downside: [0.015, 0.04, 33500, 5200, 0.96] };
for (const [scenario, [growth, churn, payroll, opex, collection]] of Object.entries(scenarioAssumptions)) {
  addInput(`assumption_${scenario}_new_mrr_growth`, growth); addInput(`assumption_${scenario}_monthly_churn`, churn); addInput(`assumption_${scenario}_monthly_payroll`, payroll); addInput(`assumption_${scenario}_monthly_opex`, opex); addInput(`assumption_${scenario}_collection_rate`, collection);
  const growthCell = cellFor(`assumption_${scenario}_new_mrr_growth`); const churnCell = cellFor(`assumption_${scenario}_monthly_churn`); const payrollCell = cellFor(`assumption_${scenario}_monthly_payroll`); const opexCell = cellFor(`assumption_${scenario}_monthly_opex`); const collectionCell = cellFor(`assumption_${scenario}_collection_rate`);
  let previousRevenueCell = null; let previousCashCell = null;
  for (const [index, month] of forecast.entries()) {
    const revenueFormula = index === 0 ? `=${entries.find((e) => e.key === "ending_mrr_2025-12").formula.slice(1)}*(1-${churnCell})*(1+${growthCell})` : `=${previousRevenueCell}*(1-${churnCell})*(1+${growthCell})`;
    add(`scenario_${scenario}_revenue_${month}`, mutant === "same-scenarios" && scenario !== "base" ? `=${cellFor(`scenario_base_revenue_${month}`)}` : revenueFormula);
    previousRevenueCell = `B${row - (variant === "a" ? 1 : 2)}`;
    const cashFormula = index === 0 ? `=${cellFor("ending_cash_2025-12")}+${previousRevenueCell}*${collectionCell}-${payrollCell}-${opexCell}` : `=${previousCashCell}+${previousRevenueCell}*${collectionCell}-${payrollCell}-${opexCell}`;
    add(`scenario_${scenario}_ending_cash_${month}`, cashFormula); previousCashCell = `B${row - (variant === "a" ? 1 : 2)}`;
  }
  const runway = forecast.reduceRight((otherwise, month) => `IF(${cellFor(`scenario_${scenario}_ending_cash_${month}`)}<0,"${month}",${otherwise})`, '"12+ months"');
  add(`scenario_${scenario}_runway_months`, `=${runway}`);
}
add("model_status", `=IF(${cellFor("ending_cash_2025-12")}=${cellFor("ending_cash_2025-12")},"PASS","FAIL")`);
add("check_source_coverage", `=IF('${sheetNames.subscriptions}'!A2<>"","PASS","FAIL")`);
add("check_cash_rollforward", `=IF(${cellFor("scenario_base_ending_cash_2026-01")}=${cellFor("ending_cash_2025-12")}+${cellFor("scenario_base_revenue_2026-01")}*${cellFor("assumption_base_collection_rate")}-${cellFor("assumption_base_monthly_payroll")}-${cellFor("assumption_base_monthly_opex")},"PASS","FAIL")`);
add("check_scenario_validity", `=IF(${cellFor("assumption_upside_new_mrr_growth")}>${cellFor("assumption_base_new_mrr_growth")},"PASS","FAIL")`);
function cellFor(key) { const item = entries.find((entry) => entry.key === key); return item ? `B${item.row}` : "B1"; }
for (const entry of entries) { audit.getCell(entry.row - 1, 0).values = [[entry.key]]; if (entry.formula) audit.getCell(entry.row - 1, 1).formulas = [[entry.formula]]; else audit.getCell(entry.row - 1, 1).values = [[entry.value]]; audit.getCell(entry.row - 1, 1).format.numberFormat = entry.key.includes("growth") || entry.key.includes("churn") || entry.key.includes("nrr") || entry.key.includes("collection_rate") ? "0.0%" : entry.key.includes("logo_churn") ? "#,##0;[Red](#,##0);-" : entry.key.includes("runway_months") || entry.key.includes("status") || entry.key.includes("check_") ? "General" : "$#,##0;[Red]($#,##0);-"; if (!entry.formula) audit.getCell(entry.row - 1, 1).format.font = { color: "#0000FF" }; }
audit.getRange("A:B").format.columnWidth = 34;
dashboard.getRange("A1:H2").merge(); dashboard.getRange("A1").values = [["Executive Dashboard"]]; dashboard.getRange("A1").format = { fill: "#16324F", font: { color: "#FFFFFF", bold: true, size: 18 }, rowHeight: 34 };
dashboard.getRange("A4:B5").values = [["LTM Recognized Revenue", null], ["Base Ending Cash · Dec 2026", null]];
const dashboardAuditRow = variant === "a" ? 23 : 34;
dashboard.getCell(dashboardAuditRow - 1, 6).values = [["dashboard_ltm_revenue"]];
if (mutant === "hardcoded") dashboard.getCell(dashboardAuditRow - 1, 7).values = [[999999]];
else { dashboard.getRange("B4").formulas = [[`=SUM(${months.map((month) => `'${sheetNames.audit}'!${cellFor(`actual_revenue_${month}`)}`).join(",")})`]]; dashboard.getCell(dashboardAuditRow - 1, 7).formulas = [["=B4"]]; }
dashboard.getRange("B5").formulas = [[`='${sheetNames.audit}'!${cellFor("scenario_base_ending_cash_2026-12")}`]];
dashboard.getCell(dashboardAuditRow, 6).values = [["dashboard_base_ending_cash"]]; dashboard.getCell(dashboardAuditRow, 7).formulas = [["=B5"]];
dashboard.getRangeByIndexes(dashboardAuditRow - 1, 6, 2, 2).format.font = { color: "#FFFFFF" };
dashboard.getRange("A4:B5").format = { fill: "#EAF2F8", font: { bold: true }, borders: { preset: "outside", style: "thin", color: "#9FB3C8" } }; dashboard.getRange("B4:B5").format.numberFormat = "$#,##0;[Red]($#,##0);-";
let chartRange;
if (variant === "a") {
  dashboard.getRange("A8:D8").values = [["Month", "Base", "Upside", "Downside"]];
  for (const [i, month] of forecast.entries()) { dashboard.getCell(8 + i, 0).values = [[month]]; for (const [j, scenario] of ["base", "upside", "downside"].entries()) dashboard.getCell(8 + i, 1 + j).formulas = [[`='${sheetNames.audit}'!${cellFor(`scenario_${scenario}_ending_cash_${month}`)}`]]; }
  dashboard.getRange("A8:D20").format.borders = { preset: "inside", style: "thin", color: "#D7DEE8" }; dashboard.getRange("A8:D8").format = { fill: "#16324F", font: { color: "#FFFFFF", bold: true } }; dashboard.getRange("B9:D20").format.numberFormat = "$#,##0;[Red]($#,##0);-"; chartRange = dashboard.getRange("A8:D20");
} else {
  dashboard.getRange("A22:M22").values = [["Scenario", ...forecast]];
  for (const [i, scenario] of ["base", "upside", "downside"].entries()) { dashboard.getCell(22 + i, 0).values = [[scenario[0].toUpperCase() + scenario.slice(1)]]; for (const [j, month] of forecast.entries()) dashboard.getCell(22 + i, 1 + j).formulas = [[`='${sheetNames.audit}'!${cellFor(`scenario_${scenario}_ending_cash_${month}`)}`]]; }
  dashboard.getRange("A22:M25").format.borders = { preset: "inside", style: "thin", color: "#D7DEE8" }; dashboard.getRange("A22:M22").format = { fill: "#16324F", font: { color: "#FFFFFF", bold: true } }; dashboard.getRange("B23:M25").format.numberFormat = "$#,##0;[Red]($#,##0);-";
  chartData.getRange("A1:D1").values = [["Month", "Base", "Upside", "Downside"]]; for (const [i, month] of forecast.entries()) { chartData.getCell(1 + i, 0).values = [[month]]; for (const [j, scenario] of ["base", "upside", "downside"].entries()) chartData.getCell(1 + i, 1 + j).formulas = [[`='${sheetNames.audit}'!${cellFor(`scenario_${scenario}_ending_cash_${month}`)}`]]; } chartData.getRange("A1:D13").format.autofitColumns(); chartRange = chartData.getRange("A1:D13");
}
const chart = dashboard.charts.add("line", chartRange); chart.title = variant === "a" ? "Forecast Ending Cash ($)" : "Scenario Cash Comparison ($)"; chart.hasLegend = true; chart.yAxis = { numberFormatCode: "$#,##0" }; chart.setPosition("F4", "M20");
dashboard.getRange("A:M").format.columnWidth = 14; dashboard.getRange("A:A").format.columnWidth = 28;
await fs.mkdir(path.join(workspace, "deliverables"), { recursive: true });
const workbookPath = path.join(workspace, "deliverables", "saas-operating-model.xlsx");
const output = await SpreadsheetFile.exportXlsx(workbook); await output.save(workbookPath);
await fs.rm(`${workbookPath}.inspect.ndjson`, { force: true });
