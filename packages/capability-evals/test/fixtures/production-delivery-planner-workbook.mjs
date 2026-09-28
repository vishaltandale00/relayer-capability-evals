import fs from "node:fs/promises";
import { dirname } from "node:path";

import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const [, , outputPath, variant = "green-primary"] = process.argv;
if (!outputPath) throw new Error("Usage: production-delivery-planner-workbook.mjs <output.xlsx> [variant]");

const alternate = variant === "green-alternate";
const managementSheetName = alternate ? "Executive View" : "Management";
const hardcoded = variant === "mutant-hardcoded";
const capacityMutant = variant === "mutant-capacity";
const componentMutant = variant === "mutant-components";
const inventoryMutant = variant === "mutant-inventory";
const missingOrder = variant === "mutant-missing-order";
const dateMutant = variant === "mutant-late-delivery";
const receiptMutant = variant === "mutant-receipt";
const costMutant = variant === "mutant-cost";
const staleDashboardMutant = variant === "mutant-stale-dashboard";
const headerlessScenario = variant === "headerless-scenario-aliases";
const dashboardMutant = variant === "mutant-dashboard";
const weeks = ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"];
const products = ["FG-ALPHA", "FG-BETA", "FG-GAMMA"];
const components = ["CMP-A", "CMP-B", "CMP-C", "CMP-D", "CMP-E"];
const startRow = alternate ? 4 : 1;
const startCol = alternate ? 2 : 1;
const workbook = Workbook.create();
const sheetOrder = alternate
  ? [managementSheetName, "Order Projections", "Purchasing Decisions", "Production Schedule", "Cost Summary", "Component Inventory", "Finished Goods", "Capacity Plan", "Exceptions", "Product Inputs", "Shipping Inputs", "Inventory Inputs", "BOM Inputs", "Supplier Inputs", "Capacity Inputs", "Order Inputs", "Scenario"]
  : ["Scenario", "Order Inputs", "Capacity Inputs", "Supplier Inputs", "BOM Inputs", "Inventory Inputs", "Shipping Inputs", "Product Inputs", "Order Projections", "Production Schedule", "Finished Goods", "Component Inventory", "Purchasing Decisions", "Capacity Plan", "Exceptions", "Cost Summary", managementSheetName];
const sheets = Object.fromEntries(sheetOrder.map((name) => [name, workbook.worksheets.add(name)]));

function writeTable(sheetName, tableName, headers, rows, options = {}) {
  const sheet = sheets[sheetName];
  const row = options.row ?? startRow;
  const col = options.col ?? startCol;
  if (row > 1) sheet.getCell(row - 2, col - 1).values = [[sheetName]];
  const range = sheet.getRangeByIndexes(row - 1, col - 1, rows.length + 1, headers.length);
  range.values = [headers, ...rows];
  const table = sheet.tables.add(range, true, tableName);
  table.style = alternate ? "TableStyleMedium4" : "TableStyleMedium2";
  sheet.freezePanes.freezeRows(row);
  return { sheet, row, col, headers, rows };
}

function columnLabel(oneBasedColumn) {
  let value = oneBasedColumn;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

function cell(table, dataIndex, header) {
  const column = table.headers.indexOf(header);
  if (column < 0) throw new Error(`Unknown ${header} column`);
  return `${columnLabel(table.col + column)}${table.row + 1 + dataIndex}`;
}

function qualifiedCell(table, dataIndex, header) {
  return `'${table.sheet.name}'!${cell(table, dataIndex, header)}`;
}

// Excel's 1900 date system stores 1899-12-30 as serial 0. Numeric boundaries keep
// receipt aggregation numeric while retaining references to the actual receipt dates.
function excelDateSerial(isoDate) {
  const [year, month, day] = String(isoDate).split("-").map(Number);
  return (Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86_400_000;
}

function formula(table, dataIndex, header, expression) {
  const column = table.headers.indexOf(header);
  table.sheet.getCell(table.row + dataIndex, table.col - 1 + column).formulas = [[expression]];
}

const scenarioRows = headerlessScenario
  ? [["Demand Factor:", 0.5], ["Capacity Factor!", 1], ["Lead Time Adjustment (weeks)", 0], ["Allow Expedite?", true]]
  : [["Demand Multiplier", 1], ["Capacity Multiplier", 1], ["Supplier Lead Time Adjustment Weeks", 0], ["Expedite Enabled", true]];
let scenario;
if (headerlessScenario) {
  const sheet = sheets.Scenario;
  sheet.getRange("A1:B4").values = scenarioRows;
  sheet.getRange("A7:B7").values = [["Demand Factor:", 0.5]];
  sheet.getCell(8, 25).values = [["Unused Control"]];
  scenario = { sheet, row: 0, col: 1, headers: ["Control", "Value"], rows: scenarioRows };
} else {
  scenario = writeTable("Scenario", "ScenarioControls", ["Control", "Value"], scenarioRows);
}
const rawOrders = writeTable("Order Inputs", "SourceOrders", ["Order ID", "Customer", "SKU", "Quantity", "Order Date", "Requested Delivery Date", "Priority"], [
  ["ORD-1001", "Northstar Health", "FG-ALPHA", 18, "2026-09-01", "2026-09-18", "priority"],
  ["ORD-1002", "Atlas Retail", "FG-BETA", 16, "2026-09-02", "2026-10-02", "standard"],
  ["ORD-1003", "Summit Labs", "FG-GAMMA", 12, "2026-09-05", "2026-10-16", "priority"],
  ["ORD-1004", "Redwood Supply", "FG-ALPHA", 28, "2026-09-08", "2026-10-30", "standard"],
  ["ORD-1005", "Bluebird Systems", "FG-BETA", 24, "2026-09-11", "2026-11-13", "standard"],
  ["ORD-1006", "Cobalt Works", "FG-GAMMA", 70, "2026-09-01", "2026-09-18", "priority"],
]);
if (alternate) {
  const absolute = (address) => address.replace(/^([A-Z]+)(\d+)$/, (_match, column, row) => `$${column}$${row}`);
  workbook.names.addRange("PlannerOrder1001Quantity", `'Order Inputs'!${absolute(cell(rawOrders, 0, "Quantity"))}`);
  workbook.names.addRange("PlannerDemandMultiplier", `'Scenario'!${absolute(cell(scenario, 0, "Value"))}`);
}
const capacityHours = [62, 58, 66, 60, 64, 56, 68, 60, 64, 58, 54, 48];
if (capacityMutant) capacityHours[0] = 10;
const rawCapacity = writeTable("Capacity Inputs", "SourceCapacity", ["Week", "Hours"], weeks.map((week, index) => [week, capacityHours[index]]));
const rawSuppliers = writeTable("Supplier Inputs", "SourceSuppliers", ["Component", "Supplier", "Normal Lead Time Weeks", "Expedite Lead Time Weeks", "Unit Cost", "Expedite Premium Per Unit"], [
  ["CMP-A", "Apex Components", 3, 1, 4.2, 1.4], ["CMP-B", "Beacon Industrial", 2, 1, 2.8, 1.1],
  ["CMP-C", "Cirrus Parts", 4, 2, 5.5, 1.8], ["CMP-D", "Delta Fabrication", 5, 2, 8.6, 2.6], ["CMP-E", "Evergreen Metals", 3, 1, 3.7, 1.3],
]);
const rawBom = writeTable("BOM Inputs", "SourceBOM", ["SKU", "Component", "Quantity Per Unit"], [
  ["FG-ALPHA", "CMP-A", 2], ["FG-ALPHA", "CMP-B", 1], ["FG-BETA", "CMP-A", 1], ["FG-BETA", "CMP-C", 3],
  ["FG-GAMMA", "CMP-B", 2], ["FG-GAMMA", "CMP-D", 1], ["FG-GAMMA", "CMP-E", 2],
]);
const rawInventory = writeTable("Inventory Inputs", "SourceInventory", ["Item", "Item Type", "Quantity On Hand", "Holding Cost Per Unit Week"], [
  ["FG-ALPHA", "finished-good", 10, 0.45], ["FG-BETA", "finished-good", 4, 0.5], ["FG-GAMMA", "finished-good", 0, 0.65],
  ["CMP-A", "component", 55, 0.08], ["CMP-B", "component", 24, 0.06], ["CMP-C", "component", 18, 0.09],
  ["CMP-D", "component", 4, 0.12], ["CMP-E", "component", 10, 0.11],
]);
const rawShipping = writeTable("Shipping Inputs", "SourceShipping", ["Mode", "Transit Days", "Cost Per Unit"], [
  ["Ground", 5, 7], ["Two-Day", 2, 13], ["Next-Day", 1, 22],
]);
const rawProducts = writeTable("Product Inputs", "SourceProducts", ["SKU", "Production Hours Per Unit", "Production Cost Per Unit"], [
  ["FG-ALPHA", 1.5, 18], ["FG-BETA", 2, 24], ["FG-GAMMA", 2.5, 31],
]);

const projectionRows = [
  ["ORD-1001", "FG-ALPHA", 18, 18, 0, "2026-09-14", dateMutant ? "2026-09-15" : "2026-09-16", "Two-Day", "on-time"],
  ["ORD-1002", "FG-BETA", 16, 16, 0, alternate ? "2026-09-28" : "2026-09-21", alternate ? "2026-09-30" : "2026-09-26", alternate ? "Two-Day" : "Ground", "on-time"],
  ["ORD-1003", "FG-GAMMA", 12, 12, 0, "2026-10-12", "2026-10-13", "Next-Day", "on-time"],
  ["ORD-1004", "FG-ALPHA", 28, 28, 0, "2026-10-19", "2026-10-24", "Ground", "on-time"],
  ["ORD-1005", "FG-BETA", 24, 24, 0, "2026-11-02", "2026-11-07", "Ground", "on-time"],
  ["ORD-1006", "FG-GAMMA", 70, 0, 70, null, null, null, "infeasible"],
];
if (missingOrder) projectionRows.pop();
if (alternate) projectionRows.reverse();
const projections = writeTable("Order Projections", "FulfillmentPlan", ["Order ID", "SKU", "Requested Quantity", "Fulfilled Quantity", "Backorder Quantity", "Planned Ship Date", "Projected Delivery Date", "Shipping Mode", "Status"], projectionRows);
for (let index = 0; index < projections.rows.length; index += 1) {
  const orderId = projections.rows[index][0];
  const sourceIndex = rawOrders.rows.findIndex((row) => row[0] === orderId);
  const requestedFormula = alternate && orderId === "ORD-1001"
    ? "=PlannerOrder1001Quantity*PlannerDemandMultiplier"
    : `='Order Inputs'!${cell(rawOrders, sourceIndex, "Quantity")}*'Scenario'!${cell(scenario, 0, "Value")}`;
  formula(projections, index, "Requested Quantity", requestedFormula);
  const requested = cell(projections, index, "Requested Quantity");
  const fulfilled = cell(projections, index, "Fulfilled Quantity");
  const backorder = cell(projections, index, "Backorder Quantity");
  const allocationCap = Number(projections.rows[index][3]);
  formula(projections, index, "Fulfilled Quantity", orderId === "ORD-1006" ? `=0*${requested}` : `=MIN(${requested},${allocationCap}*MIN(1,'Scenario'!${cell(scenario, 1, "Value")}))`);
  formula(projections, index, "Backorder Quantity", orderId === "ORD-1006" ? `=${requested}-${fulfilled}` : `=MAX(0,${requested}-${fulfilled})`);
  formula(projections, index, "Status", `=IF(${backorder}>0,IF(${backorder}=${requested},"infeasible","short"),"on-time")`);
}

const productionValues = Object.fromEntries(weeks.flatMap((week) => products.map((sku) => [`${week}|${sku}`, 0])));
Object.assign(productionValues, { "2026-09-07|FG-ALPHA": 8, [`${alternate ? "2026-09-28" : "2026-09-21"}|FG-BETA`]: 12, "2026-10-12|FG-GAMMA": 12, "2026-10-19|FG-ALPHA": 28, "2026-11-02|FG-BETA": 24 });
const productionRows = weeks.flatMap((week) => products.map((sku) => [week, sku, productionValues[`${week}|${sku}`]]));
const production = writeTable("Production Schedule", "WeeklyProduction", ["Week", "SKU", "Production Quantity"], alternate ? [...productionRows].reverse() : productionRows);
for (let index = 0; index < production.rows.length; index += 1) formula(production, index, "Production Quantity", `=${Number(production.rows[index][2])}*MIN(1,'Scenario'!${cell(scenario, 1, "Value")})`);
const initialFg = { "FG-ALPHA": 10, "FG-BETA": 4, "FG-GAMMA": 0 };
const fgRows = [];
for (const sku of products) {
  let opening = initialFg[sku];
  for (const week of weeks) {
    const produced = productionValues[`${week}|${sku}`];
    const shipped = projectionRows.filter((row) => row[1] === sku && row[5] !== null && row[5] >= week && row[5] < new Date(Date.parse(`${week}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10)).reduce((sum, row) => sum + Number(row[3]), 0);
    const closing = opening + produced - shipped;
    fgRows.push([week, sku, opening, produced, shipped, closing]);
    opening = closing;
  }
}
const fg = writeTable("Finished Goods", "FinishedGoodsLedger", ["Week", "SKU", "Opening Inventory", "Produced", "Shipped", "Closing Inventory", "Holding Cost"], alternate ? [...fgRows].reverse() : fgRows);
for (let index = 0; index < fg.rows.length; index += 1) {
  const week = fg.rows[index][0]; const sku = fg.rows[index][1];
  const projectedRows = projections.rows.map((row, projectionIndex) => ({ row, projectionIndex }))
    .filter(({ row }) => row[1] === sku && row[5] !== null && row[5] >= week && row[5] < new Date(Date.parse(`${week}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10));
  const weekIndex = weeks.indexOf(week);
  if (weekIndex > 0) {
    const previous = fg.rows.findIndex((row) => row[0] === weeks[weekIndex - 1] && row[1] === sku);
    formula(fg, index, "Opening Inventory", `=${cell(fg, previous, "Closing Inventory")}`);
  }
  const productionIndex = production.rows.findIndex((row) => row[0] === week && row[1] === sku);
  formula(fg, index, "Produced", `=${qualifiedCell(production, productionIndex, "Production Quantity")}`);
  if (projectedRows.length) formula(fg, index, "Shipped", `=${projectedRows.map(({ projectionIndex }) => qualifiedCell(projections, projectionIndex, "Fulfilled Quantity")).join("+")}`);
  formula(fg, index, "Closing Inventory", `=${cell(fg, index, "Opening Inventory")}+${cell(fg, index, "Produced")}-${cell(fg, index, "Shipped")}`);
  const inventoryIndex = rawInventory.rows.findIndex((row) => row[0] === sku);
  formula(fg, index, "Holding Cost", `=${cell(fg, index, "Closing Inventory")}*'Inventory Inputs'!${cell(rawInventory, inventoryIndex, "Holding Cost Per Unit Week")}`);
}

const receipts = new Map([["2026-10-19|CMP-A", 53], ["2026-10-05|CMP-B", 12], ["2026-10-19|CMP-B", 24], ["2026-09-21|CMP-C", 18], ["2026-11-02|CMP-C", 72], ["2026-10-12|CMP-D", 8], ["2026-10-12|CMP-E", 14]]);
const betaProductionWeek = alternate ? "2026-09-28" : "2026-09-21";
const consumption = new Map([["2026-09-07|CMP-A", 16], ["2026-09-07|CMP-B", 8], [`${betaProductionWeek}|CMP-A`, 12], [`${betaProductionWeek}|CMP-C`, 36], ["2026-10-12|CMP-B", 24], ["2026-10-12|CMP-D", 12], ["2026-10-12|CMP-E", 24], ["2026-10-19|CMP-A", 56], ["2026-10-19|CMP-B", 28], ["2026-11-02|CMP-A", 24], ["2026-11-02|CMP-C", 72]]);
const initialComponents = { "CMP-A": 55, "CMP-B": 24, "CMP-C": 18, "CMP-D": 4, "CMP-E": 10 };
const componentRows = [];
for (const component of components) {
  let opening = initialComponents[component];
  for (const week of weeks) {
    const received = receipts.get(`${week}|${component}`) ?? 0;
    let consumed = consumption.get(`${week}|${component}`) ?? 0;
    if (componentMutant && component === "CMP-A" && week === "2026-09-07") consumed -= 1;
    const closing = opening + received - consumed;
    componentRows.push([week, component, opening, received, consumed, closing]);
    opening = closing;
  }
}
if (inventoryMutant) componentRows.find((row) => row[0] === "2026-09-14" && row[1] === "CMP-A")[2] += 1;
const componentLedger = writeTable("Component Inventory", "ComponentLedger", ["Week", "Component", "Opening Inventory", "Receipts", "Consumed", "Closing Inventory", "Holding Cost"], alternate ? [...componentRows].reverse() : componentRows);
for (let index = 0; index < componentLedger.rows.length; index += 1) {
  const [week, component] = componentLedger.rows[index];
  const weekIndex = weeks.indexOf(week);
  if (weekIndex > 0) {
    const previous = componentLedger.rows.findIndex((row) => row[0] === weeks[weekIndex - 1] && row[1] === component);
    const inventoryAdjustment = inventoryMutant && week === "2026-09-14" && component === "CMP-A" ? "+1" : "";
    formula(componentLedger, index, "Opening Inventory", `=${cell(componentLedger, previous, "Closing Inventory")}${inventoryAdjustment}`);
  }
  formula(componentLedger, index, "Closing Inventory", `=${cell(componentLedger, index, "Opening Inventory")}+${cell(componentLedger, index, "Receipts")}-${cell(componentLedger, index, "Consumed")}`);
  const inventoryIndex = rawInventory.rows.findIndex((row) => row[0] === component);
  formula(componentLedger, index, "Holding Cost", `=${cell(componentLedger, index, "Closing Inventory")}*'Inventory Inputs'!${cell(rawInventory, inventoryIndex, "Holding Cost Per Unit Week")}`);
}

const purchaseRows = [
  ["CMP-A", "Apex Components", 53, "2026-09-28", "2026-10-19", false, 4.2, 0], ["CMP-B", "Beacon Industrial", 12, "2026-09-07", "2026-09-21", false, 2.8, 0],
  ["CMP-B", "Beacon Industrial", 24, "2026-10-05", "2026-10-19", false, 2.8, 0], ["CMP-C", "Cirrus Parts", 18, "2026-09-07", "2026-09-21", true, 5.5, 1.8],
  ["CMP-C", "Cirrus Parts", 72, "2026-10-05", "2026-11-02", false, 5.5, 0], ["CMP-D", "Delta Fabrication", 8, "2026-09-07", "2026-10-12", false, 8.6, 0],
  ["CMP-E", "Evergreen Metals", 14, "2026-09-21", "2026-10-12", false, 3.7, 0],
];
purchaseRows.find((row) => row[0] === "CMP-C")[3] = "2026-08-24";
if (receiptMutant) purchaseRows.find((row) => row[0] === "CMP-D")[4] = "2026-09-14";
const purchases = writeTable("Purchasing Decisions", "PurchasePlan", ["Component", "Supplier", "Purchase Quantity", "Purchase Order Date", "Receipt Date", "Expedited", "Unit Cost", "Expedite Premium Per Unit"], alternate ? [...purchaseRows].reverse() : purchaseRows);
for (let index = 0; index < purchases.rows.length; index += 1) {
  const row = purchases.rows[index];
  const sourceIndex = rawSuppliers.rows.findIndex((supplier) => supplier[0] === row[0]);
  const expedited = cell(purchases, index, "Expedited");
  const baselineExpedite = Boolean(row[5]);
  formula(purchases, index, "Expedited", `=AND('Scenario'!${cell(scenario, 3, "Value")},OR(${baselineExpedite},'Scenario'!${cell(scenario, 2, "Value")}>0,'Supplier Inputs'!${cell(rawSuppliers, sourceIndex, "Normal Lead Time Weeks")}>5))`);
  if (receiptMutant && row[0] === "CMP-D") {
    const receiptDateColumn = purchases.col - 1 + purchases.headers.indexOf("Receipt Date");
    purchases.sheet.getCell(purchases.row + index, receiptDateColumn).values = [[excelDateSerial(row[4])]];
  } else {
    const [year, month, day] = String(row[3]).split("-").map(Number);
    formula(purchases, index, "Receipt Date", `=DATE(${year},${month},${day})+7*(IF(${expedited},'Supplier Inputs'!${cell(rawSuppliers, sourceIndex, "Expedite Lead Time Weeks")},'Supplier Inputs'!${cell(rawSuppliers, sourceIndex, "Normal Lead Time Weeks")})+'Scenario'!${cell(scenario, 2, "Value")})`);
  }
  formula(purchases, index, "Expedite Premium Per Unit", `=IF(${expedited},'Supplier Inputs'!${cell(rawSuppliers, sourceIndex, "Expedite Premium Per Unit")},0)`);
  purchases.sheet.getCell(purchases.row + index, purchases.col - 1 + purchases.headers.indexOf("Receipt Date")).format.numberFormat = "yyyy-mm-dd";
}

for (let index = 0; index < componentLedger.rows.length; index += 1) {
  const [week, component] = componentLedger.rows[index];
  const bomRows = rawBom.rows.filter((row) => row[1] === component);
  const productionTerms = bomRows.flatMap((bom) => {
    const productionIndex = production.rows.findIndex((row) => row[0] === week && row[1] === bom[0]);
    return productionIndex < 0 ? [] : [`${qualifiedCell(production, productionIndex, "Production Quantity")}*${Number(bom[2])}`];
  });
  const mutationAdjustment = componentMutant && week === "2026-09-07" && component === "CMP-A" ? "-1" : "";
  if (productionTerms.length) formula(componentLedger, index, "Consumed", `=${productionTerms.join("+")}${mutationAdjustment}`);
  const [year, month, day] = String(week).split("-").map(Number);
  const nextWeek = new Date(Date.UTC(year, month - 1, day + 7)).toISOString().slice(0, 10);
  const weekStartSerial = excelDateSerial(week);
  const nextWeekSerial = excelDateSerial(nextWeek);
  const terms = purchases.rows.flatMap((purchase, purchaseIndex) => purchase[0] === component ? [
    `IF(AND(${qualifiedCell(purchases, purchaseIndex, "Receipt Date")}>=${weekStartSerial},${qualifiedCell(purchases, purchaseIndex, "Receipt Date")}<${nextWeekSerial}),${qualifiedCell(purchases, purchaseIndex, "Purchase Quantity")},0)`,
  ] : []);
  if (terms.length) formula(componentLedger, index, "Receipts", `=${terms.join("+")}`);
  const receiptsColumn = componentLedger.col - 1 + componentLedger.headers.indexOf("Receipts");
  componentLedger.sheet.getCell(componentLedger.row + index, receiptsColumn).format.numberFormat = "0.00";
}

const usedHours = { "2026-09-07": 12, [betaProductionWeek]: 24, "2026-10-12": 30, "2026-10-19": 42, "2026-11-02": 48 };
const capacityRows = weeks.map((week, index) => [week, rawCapacity.rows[index][1], usedHours[week] ?? 0]);
const capacity = writeTable("Capacity Plan", "CapacityUtilization", ["Week", "Available Hours", "Used Hours"], alternate ? [...capacityRows].reverse() : capacityRows);
for (let index = 0; index < capacity.rows.length; index += 1) {
  const sourceIndex = weeks.indexOf(capacity.rows[index][0]);
  formula(capacity, index, "Available Hours", `='Capacity Inputs'!${cell(rawCapacity, sourceIndex, "Hours")}*'Scenario'!${cell(scenario, 1, "Value")}`);
  const productionTerms = production.rows.flatMap((row, productionIndex) => {
    if (row[0] !== capacity.rows[index][0]) return [];
    const productIndex = rawProducts.rows.findIndex((product) => product[0] === row[1]);
    return productIndex < 0 ? [] : [`${qualifiedCell(production, productionIndex, "Production Quantity")}*'Product Inputs'!${cell(rawProducts, productIndex, "Production Hours Per Unit")}`];
  });
  if (productionTerms.length) formula(capacity, index, "Used Hours", `=${productionTerms.join("+")}`);
}

const exceptions = writeTable("Exceptions", "PlanningExceptions", ["Exception Type", "Order ID", "Detail"],
  projections.rows.map((row) => [row[8] === "infeasible" ? "infeasible" : "", row[0], row[8] === "infeasible" ? "Demand exceeds available horizon capacity and component supply." : ""]));
for (let index = 0; index < projections.rows.length; index += 1) {
  const backorder = qualifiedCell(projections, index, "Backorder Quantity");
  const status = qualifiedCell(projections, index, "Status");
  const orderId = String(projections.rows[index][0]);
  formula(exceptions, index, "Exception Type", `=IF(${backorder}>0,IF(${status}="infeasible","infeasible","short"),"")`);
  formula(exceptions, index, "Order ID", `=IF(${backorder}>0,"${orderId}","")`);
  formula(exceptions, index, "Detail", `=IF(${backorder}>0,IF(${status}="infeasible","Demand exceeds available horizon capacity and component supply.","Demand exceeds planned fulfillment."),"")`);
}
formula(exceptions, projections.rows.length, "Detail", '=IF(1=1,"","")');
exceptions.sheet.getCell(exceptions.row + 9, exceptions.col + 7).values = [["Review exceptions weekly"]];
const costs = writeTable("Cost Summary", "PlanCosts", ["Metric", "Value"], [
  ["Production Cost", 1884], ["Purchasing Cost", 939], ["Expedite Cost", 32.4], ["Shipping Cost", alternate ? 1070 : 974], ["Holding Cost", alternate ? 45.82 : 39.62],
  ["Total Cost", costMutant ? 3870.02 : alternate ? 3971.22 : 3869.02], ["Purchase Units", 201], ["Production Units", 84], ["Exceptions Total", 1], ["Fulfillment Total Units", 98],
]);
for (let index = 0; index < costs.rows.length; index += 1) formula(costs, index, "Value", `=${Number(costs.rows[index][1])}+0*'Scenario'!${cell(scenario, 0, "Value")}`);
const expediteCostIndex = costs.rows.findIndex((row) => row[0] === "Expedite Cost");
const productionCostIndex = costs.rows.findIndex((row) => row[0] === "Production Cost");
const purchasingCostIndex = costs.rows.findIndex((row) => row[0] === "Purchasing Cost");
const shippingCostIndex = costs.rows.findIndex((row) => row[0] === "Shipping Cost");
const holdingCostIndex = costs.rows.findIndex((row) => row[0] === "Holding Cost");
const totalCostIndex = costs.rows.findIndex((row) => row[0] === "Total Cost");
const purchaseUnitsIndex = costs.rows.findIndex((row) => row[0] === "Purchase Units");
const productionUnitsIndex = costs.rows.findIndex((row) => row[0] === "Production Units");
const exceptionsTotalIndex = costs.rows.findIndex((row) => row[0] === "Exceptions Total");
const fulfillmentTotalIndex = costs.rows.findIndex((row) => row[0] === "Fulfillment Total Units");
formula(costs, productionCostIndex, "Value", `=${production.rows.map((row, index) => {
  const productIndex = rawProducts.rows.findIndex((product) => product[0] === row[1]);
  return `${qualifiedCell(production, index, "Production Quantity")}*'Product Inputs'!${cell(rawProducts, productIndex, "Production Cost Per Unit")}`;
}).join("+")}`);
formula(costs, purchasingCostIndex, "Value", `=${purchases.rows.map((_, index) => `${qualifiedCell(purchases, index, "Purchase Quantity")}*${qualifiedCell(purchases, index, "Unit Cost")}`).join("+")}`);
formula(costs, expediteCostIndex, "Value", `=${purchases.rows.map((_, index) => `${qualifiedCell(purchases, index, "Purchase Quantity")}*${qualifiedCell(purchases, index, "Expedite Premium Per Unit")}`).join("+")}`);
formula(costs, shippingCostIndex, "Value", `=${projections.rows.map((row, index) => {
  const shippingIndex = rawShipping.rows.findIndex((shipping) => shipping[0] === row[7]);
  return shippingIndex < 0 ? "0" : `${qualifiedCell(projections, index, "Fulfilled Quantity")}*'Shipping Inputs'!${cell(rawShipping, shippingIndex, "Cost Per Unit")}`;
}).join("+")}`);
formula(costs, holdingCostIndex, "Value", `=${[
  ...fg.rows.map((_, index) => qualifiedCell(fg, index, "Holding Cost")),
  ...componentLedger.rows.map((_, index) => qualifiedCell(componentLedger, index, "Holding Cost")),
].join("+")}`);
if (!costMutant) formula(costs, totalCostIndex, "Value", `=${[0, 1, 2, 3, 4].map((index) => cell(costs, index, "Value")).join("+")}`);
formula(costs, purchaseUnitsIndex, "Value", `=${purchases.rows.map((_, index) => qualifiedCell(purchases, index, "Purchase Quantity")).join("+")}`);
formula(costs, productionUnitsIndex, "Value", `=${production.rows.map((_, index) => qualifiedCell(production, index, "Production Quantity")).join("+")}`);
formula(costs, exceptionsTotalIndex, "Value", `=${projections.rows.map((_, index) => `IF(${qualifiedCell(projections, index, "Backorder Quantity")}>0,1,0)`).join("+")}`);
formula(costs, fulfillmentTotalIndex, "Value", `=${projections.rows.map((_, index) => qualifiedCell(projections, index, "Fulfilled Quantity")).join("+")}`);

if (!dashboardMutant) {
  const dashboardMetrics = ["Total Orders", "Units Requested", "Units Fulfilled", "Late Orders", "Exception Count", "Management Total Cost"];
  const dashboardValues = [6, 168, 98, 0, 1, staleDashboardMutant ? 9999 : alternate ? 3971.22 : costMutant ? 3870.02 : 3869.02];
  const dashboard = alternate
    ? writeTable(managementSheetName, "ManagementSummary", ["Metric", ...dashboardMetrics], [["Value", ...dashboardValues]], { row: 3, col: 3 })
    : writeTable(managementSheetName, "ManagementSummary", ["Metric", "Value"], dashboardMetrics.map((metric, index) => [metric, dashboardValues[index]]), { row: 2, col: 2 });
  const dashboardFormula = (index, expression) => formula(dashboard, alternate ? 0 : index, alternate ? dashboardMetrics[index] : "Value", expression);
  dashboardFormula(0, `=${rawOrders.rows.map((_, index) => `IF(${qualifiedCell(rawOrders, index, "Order ID")}<>"",1,0)`).join("+")}`);
  dashboardFormula(1, `=${projections.rows.map((_, index) => qualifiedCell(projections, index, "Requested Quantity")).join("+")}`);
  dashboardFormula(2, `=${projections.rows.map((_, index) => qualifiedCell(projections, index, "Fulfilled Quantity")).join("+")}`);
  dashboardFormula(3, `=${projections.rows.map((_, index) => `IF(${qualifiedCell(projections, index, "Status")}="late",1,0)`).join("+")}`);
  dashboardFormula(4, `='Cost Summary'!${cell(costs, exceptionsTotalIndex, "Value")}`);
  if (!staleDashboardMutant) dashboardFormula(5, `='Cost Summary'!${cell(costs, totalCostIndex, "Value")}`);
  dashboard.sheet.getRange("J3:K15").values = [["Week", "Production Units"], ...weeks.map((week) => [week, null])];
  for (const [weekIndex, week] of weeks.entries()) {
    const productionTerms = production.rows.flatMap((row, productionIndex) => row[0] === week
      ? [qualifiedCell(production, productionIndex, "Production Quantity")]
      : []);
    dashboard.sheet.getCell(3 + weekIndex, 10).formulas = [[`=${productionTerms.join("+") || "0"}`]];
  }
  const chart = dashboard.sheet.charts.add("line", dashboard.sheet.getRange("J3:K15"));
  chart.title = "Weekly Production Units";
  chart.hasLegend = false;
  chart.setPosition("M3", "T16");
  if (alternate) {
    dashboard.sheet.getRange("J18:K18").values = [["Capacity Utilization", null]];
    const used = capacity.rows.map((_, index) => qualifiedCell(capacity, index, "Used Hours")).join("+");
    const available = capacity.rows.map((_, index) => qualifiedCell(capacity, index, "Available Hours")).join("+");
    dashboard.sheet.getCell(17, 11).formulas = [[`=(${used})/(${available})`]];
    dashboard.sheet.getCell(17, 11).format.numberFormat = "0.0%";
  } else {
    dashboard.sheet.getRange("W3:X5").values = [["Capacity Signal", "Value"], ["Capacity Used Hours", null], ["Capacity Available Hours", null]];
    const used = capacity.rows.map((_, index) => qualifiedCell(capacity, index, "Used Hours")).join("+");
    const available = capacity.rows.map((_, index) => qualifiedCell(capacity, index, "Available Hours")).join("+");
    dashboard.sheet.getCell(3, 23).formulas = [[`=${used}`]];
    dashboard.sheet.getCell(4, 23).formulas = [[`=${available}`]];
  }
}

if (alternate) {
  sheets[managementSheetName].getRange("A20:B20").formulas = [['="FY 2026"', "=0"]];
}

if (hardcoded) {
  workbook.recalculate();
  for (const sheet of Object.values(sheets)) {
    const used = sheet.getUsedRange();
    if (used) used.values = used.values;
  }
  sheets[managementSheetName].getRange("A20:B20").formulas = [['="FY 2026"', "=0"]];
}

for (const sheet of Object.values(sheets)) {
  // Keep every semantic view large enough for deterministic visual inspection
  // without prescribing where its real table must live.
  sheet.getCell(30, 15).values = [["Planner evidence"]];
  const used = sheet.getUsedRange();
  if (!used) continue;
  used.format.columnWidthPx = 180;
  used.format.rowHeightPx = 30;
  used.format.wrapText = true;
}

await fs.mkdir(dirname(outputPath), { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
