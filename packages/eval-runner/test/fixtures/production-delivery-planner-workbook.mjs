import fs from "node:fs/promises";
import { dirname } from "node:path";

import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const [, , outputPath, variant = "green-primary"] = process.argv;
if (!outputPath) throw new Error("Usage: production-delivery-planner-workbook.mjs <output.xlsx> [variant]");

const alternate = variant === "green-alternate";
const hardcoded = variant === "mutant-hardcoded";
const capacityMutant = variant === "mutant-capacity";
const componentMutant = variant === "mutant-components";
const inventoryMutant = variant === "mutant-inventory";
const missingOrder = variant === "mutant-missing-order";
const dateMutant = variant === "mutant-late-delivery";
const receiptMutant = variant === "mutant-receipt";
const costMutant = variant === "mutant-cost";
const staleDashboardMutant = variant === "mutant-stale-dashboard";
const dashboardMutant = variant === "mutant-dashboard";
const weeks = ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"];
const products = ["FG-ALPHA", "FG-BETA", "FG-GAMMA"];
const components = ["CMP-A", "CMP-B", "CMP-C", "CMP-D", "CMP-E"];
const startRow = alternate ? 4 : 1;
const startCol = alternate ? 2 : 1;
const workbook = Workbook.create();
const sheetOrder = alternate
  ? ["Management", "Order Projections", "Purchasing Decisions", "Production Schedule", "Cost Summary", "Component Inventory", "Finished Goods", "Capacity Plan", "Exceptions", "Product Inputs", "Shipping Inputs", "Inventory Inputs", "BOM Inputs", "Supplier Inputs", "Capacity Inputs", "Order Inputs", "Scenario"]
  : ["Scenario", "Order Inputs", "Capacity Inputs", "Supplier Inputs", "BOM Inputs", "Inventory Inputs", "Shipping Inputs", "Product Inputs", "Order Projections", "Production Schedule", "Finished Goods", "Component Inventory", "Purchasing Decisions", "Capacity Plan", "Exceptions", "Cost Summary", "Management"];
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

function formula(table, dataIndex, header, expression) {
  if (hardcoded) return;
  const column = table.headers.indexOf(header);
  table.sheet.getCell(table.row + dataIndex, table.col - 1 + column).formulas = [[expression]];
}

const scenario = writeTable("Scenario", "ScenarioControls", ["Control", "Value"], [
  ["Demand Multiplier", 1], ["Capacity Multiplier", 1], ["Supplier Lead Time Adjustment Weeks", 0], ["Expedite Enabled", true],
]);
const rawOrders = writeTable("Order Inputs", "SourceOrders", ["Order ID", "Customer", "SKU", "Quantity", "Order Date", "Requested Delivery Date", "Priority"], [
  ["ORD-1001", "Northstar Health", "FG-ALPHA", 18, "2026-09-01", "2026-09-18", "priority"],
  ["ORD-1002", "Atlas Retail", "FG-BETA", 16, "2026-09-02", "2026-10-02", "standard"],
  ["ORD-1003", "Summit Labs", "FG-GAMMA", 12, "2026-09-05", "2026-10-16", "priority"],
  ["ORD-1004", "Redwood Supply", "FG-ALPHA", 28, "2026-09-08", "2026-10-30", "standard"],
  ["ORD-1005", "Bluebird Systems", "FG-BETA", 24, "2026-09-11", "2026-11-13", "standard"],
  ["ORD-1006", "Cobalt Works", "FG-GAMMA", 70, "2026-09-01", "2026-09-18", "priority"],
]);
const capacityHours = [62, 58, 66, 60, 64, 56, 68, 60, 64, 58, 54, 48];
if (capacityMutant) capacityHours[0] = 10;
const rawCapacity = writeTable("Capacity Inputs", "SourceCapacity", ["Week", "Hours"], weeks.map((week, index) => [week, capacityHours[index]]));
const rawSuppliers = writeTable("Supplier Inputs", "SourceSuppliers", ["Component", "Supplier", "Normal Lead Time Weeks", "Expedite Lead Time Weeks", "Unit Cost", "Expedite Premium Per Unit"], [
  ["CMP-A", "Apex Components", 3, 1, 4.2, 1.4], ["CMP-B", "Beacon Industrial", 2, 1, 2.8, 1.1],
  ["CMP-C", "Cirrus Parts", 4, 2, 5.5, 1.8], ["CMP-D", "Delta Fabrication", 5, 2, 8.6, 2.6], ["CMP-E", "Evergreen Metals", 3, 1, 3.7, 1.3],
]);
writeTable("BOM Inputs", "SourceBOM", ["SKU", "Component", "Quantity Per Unit"], [
  ["FG-ALPHA", "CMP-A", 2], ["FG-ALPHA", "CMP-B", 1], ["FG-BETA", "CMP-A", 1], ["FG-BETA", "CMP-C", 3],
  ["FG-GAMMA", "CMP-B", 2], ["FG-GAMMA", "CMP-D", 1], ["FG-GAMMA", "CMP-E", 2],
]);
writeTable("Inventory Inputs", "SourceInventory", ["Item", "Item Type", "Quantity On Hand", "Holding Cost Per Unit Week"], [
  ["FG-ALPHA", "finished-good", 10, 0.45], ["FG-BETA", "finished-good", 4, 0.5], ["FG-GAMMA", "finished-good", 0, 0.65],
  ["CMP-A", "component", 55, 0.08], ["CMP-B", "component", 24, 0.06], ["CMP-C", "component", 18, 0.09],
  ["CMP-D", "component", 4, 0.12], ["CMP-E", "component", 10, 0.11],
]);
writeTable("Shipping Inputs", "SourceShipping", ["Mode", "Transit Days", "Cost Per Unit"], [
  ["Ground", 5, 7], ["Two-Day", 2, 13], ["Next-Day", 1, 22],
]);
writeTable("Product Inputs", "SourceProducts", ["SKU", "Production Hours Per Unit", "Production Cost Per Unit"], [
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
for (let index = 0; index < projectionRows.length; index += 1) {
  const orderId = projectionRows[index][0];
  const sourceIndex = rawOrders.rows.findIndex((row) => row[0] === orderId);
  formula(projections, index, "Requested Quantity", `='Order Inputs'!${cell(rawOrders, sourceIndex, "Quantity")}*'Scenario'!${cell(scenario, 0, "Value")}`);
  if (orderId === "ORD-1004") {
    formula(projections, index, "Fulfilled Quantity", `=MIN(${cell(projections, index, "Requested Quantity")},28)`);
    formula(projections, index, "Backorder Quantity", `=MAX(0,${cell(projections, index, "Requested Quantity")}-${cell(projections, index, "Fulfilled Quantity")})`);
    formula(projections, index, "Status", `=IF(${cell(projections, index, "Backorder Quantity")}>0,"short","on-time")`);
  }
}

const productionValues = Object.fromEntries(weeks.flatMap((week) => products.map((sku) => [`${week}|${sku}`, 0])));
Object.assign(productionValues, { "2026-09-07|FG-ALPHA": 8, [`${alternate ? "2026-09-28" : "2026-09-21"}|FG-BETA`]: 12, "2026-10-12|FG-GAMMA": 12, "2026-10-19|FG-ALPHA": 28, "2026-11-02|FG-BETA": 24 });
const productionRows = weeks.flatMap((week) => products.map((sku) => [week, sku, productionValues[`${week}|${sku}`]]));
const production = writeTable("Production Schedule", "WeeklyProduction", ["Week", "SKU", "Production Quantity"], alternate ? [...productionRows].reverse() : productionRows);
for (let index = 0; index < production.rows.length; index += 1) formula(production, index, "Production Quantity", `=${Number(production.rows[index][2])}+0*'Scenario'!${cell(scenario, 1, "Value")}`);
const shipmentByWeekSku = new Map([["2026-09-07|FG-ALPHA", 18], [`${alternate ? "2026-09-28" : "2026-09-21"}|FG-BETA`, 16], ["2026-10-12|FG-GAMMA", 12], ["2026-10-19|FG-ALPHA", 28], ["2026-11-02|FG-BETA", 24]]);
const initialFg = { "FG-ALPHA": 10, "FG-BETA": 4, "FG-GAMMA": 0 };
const fgRows = [];
for (const sku of products) {
  let opening = initialFg[sku];
  for (const week of weeks) {
    const produced = productionValues[`${week}|${sku}`];
    const shipped = shipmentByWeekSku.get(`${week}|${sku}`) ?? 0;
    const closing = opening + produced - shipped;
    fgRows.push([week, sku, opening, produced, shipped, closing]);
    opening = closing;
  }
}
const fg = writeTable("Finished Goods", "FinishedGoodsLedger", ["Week", "SKU", "Opening Inventory", "Produced", "Shipped", "Closing Inventory"], alternate ? [...fgRows].reverse() : fgRows);
for (let index = 0; index < fg.rows.length; index += 1) formula(fg, index, "Closing Inventory", `=${cell(fg, index, "Opening Inventory")}+${cell(fg, index, "Produced")}-${cell(fg, index, "Shipped")}`);

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
const componentLedger = writeTable("Component Inventory", "ComponentLedger", ["Week", "Component", "Opening Inventory", "Receipts", "Consumed", "Closing Inventory"], alternate ? [...componentRows].reverse() : componentRows);
for (let index = 0; index < componentLedger.rows.length; index += 1) formula(componentLedger, index, "Closing Inventory", `=${cell(componentLedger, index, "Opening Inventory")}+${cell(componentLedger, index, "Receipts")}-${cell(componentLedger, index, "Consumed")}`);

const purchaseRows = [
  ["CMP-A", "Apex Components", 53, "2026-09-28", "2026-10-19", false, 4.2, 0], ["CMP-B", "Beacon Industrial", 12, "2026-09-21", "2026-10-05", false, 2.8, 0],
  ["CMP-B", "Beacon Industrial", 24, "2026-10-05", "2026-10-19", false, 2.8, 0], ["CMP-C", "Cirrus Parts", 18, "2026-09-07", "2026-09-21", true, 5.5, 1.8],
  ["CMP-C", "Cirrus Parts", 72, "2026-10-05", "2026-11-02", false, 5.5, 0], ["CMP-D", "Delta Fabrication", 8, "2026-09-07", "2026-10-12", false, 8.6, 0],
  ["CMP-E", "Evergreen Metals", 14, "2026-09-21", "2026-10-12", false, 3.7, 0],
];
if (receiptMutant) purchaseRows.find((row) => row[0] === "CMP-D")[4] = "2026-09-14";
const purchases = writeTable("Purchasing Decisions", "PurchasePlan", ["Component", "Supplier", "Purchase Quantity", "Purchase Order Date", "Receipt Date", "Expedited", "Unit Cost", "Expedite Premium Per Unit"], alternate ? [...purchaseRows].reverse() : purchaseRows);
const cmpDIndex = purchases.rows.findIndex((row) => row[0] === "CMP-D");
formula(purchases, cmpDIndex, "Expedited", `='Supplier Inputs'!${cell(rawSuppliers, 3, "Normal Lead Time Weeks")}>5`);
if (!receiptMutant) formula(purchases, cmpDIndex, "Receipt Date", `=DATE(2026,10,12)+0*'Supplier Inputs'!${cell(rawSuppliers, 3, "Normal Lead Time Weeks")}`);
formula(purchases, cmpDIndex, "Expedite Premium Per Unit", `=IF(${cell(purchases, cmpDIndex, "Expedited")},'Supplier Inputs'!${cell(rawSuppliers, 3, "Expedite Premium Per Unit")},0)`);
purchases.sheet.getCell(purchases.row + cmpDIndex, purchases.col - 1 + purchases.headers.indexOf("Receipt Date")).format.numberFormat = "yyyy-mm-dd";

const usedHours = { "2026-09-07": 12, [betaProductionWeek]: 24, "2026-10-12": 30, "2026-10-19": 42, "2026-11-02": 48 };
const capacityRows = weeks.map((week, index) => [week, rawCapacity.rows[index][1], usedHours[week] ?? 0]);
const capacity = writeTable("Capacity Plan", "CapacityUtilization", ["Week", "Available Hours", "Used Hours"], alternate ? [...capacityRows].reverse() : capacityRows);
for (let index = 0; index < capacity.rows.length; index += 1) {
  const sourceIndex = weeks.indexOf(capacity.rows[index][0]);
  formula(capacity, index, "Available Hours", `='Capacity Inputs'!${cell(rawCapacity, sourceIndex, "Hours")}*'Scenario'!${cell(scenario, 1, "Value")}`);
}

const exceptions = writeTable("Exceptions", "PlanningExceptions", ["Exception Type", "Order ID", "Detail"], [
  ["infeasible", "ORD-1006", "Demand exceeds available horizon capacity and component supply."],
  ["", "", ""],
]);
const ord1004Index = projections.rows.findIndex((row) => row[0] === "ORD-1004");
formula(exceptions, 1, "Exception Type", `=IF(${cell(projections, ord1004Index, "Backorder Quantity")}>0,"short","")`);
formula(exceptions, 1, "Order ID", `=IF(${cell(projections, ord1004Index, "Backorder Quantity")}>0,"ORD-1004","")`);
formula(exceptions, 1, "Detail", `=IF(${cell(projections, ord1004Index, "Backorder Quantity")}>0,"Demand scenario exceeds planned fulfillment.","")`);
exceptions.sheet.getCell(exceptions.row + 9, exceptions.col + 7).values = [["Review exceptions weekly"]];
const costs = writeTable("Cost Summary", "PlanCosts", ["Metric", "Value"], [
  ["Production Cost", 1884], ["Purchasing Cost", 939], ["Expedite Cost", 32.4], ["Shipping Cost", alternate ? 1070 : 974], ["Holding Cost", alternate ? 45.82 : 39.62],
  ["Total Cost", costMutant ? 3870.02 : alternate ? 3971.22 : 3869.02], ["Purchase Units", 201], ["Production Units", 84], ["Exceptions Total", 1], ["Fulfillment Total Units", 98],
]);
for (let index = 0; index < costs.rows.length; index += 1) formula(costs, index, "Value", `=${Number(costs.rows[index][1])}+0*'Scenario'!${cell(scenario, 0, "Value")}`);
const expediteCostIndex = costs.rows.findIndex((row) => row[0] === "Expedite Cost");
const totalCostIndex = costs.rows.findIndex((row) => row[0] === "Total Cost");
const exceptionsTotalIndex = costs.rows.findIndex((row) => row[0] === "Exceptions Total");
const fulfillmentTotalIndex = costs.rows.findIndex((row) => row[0] === "Fulfillment Total Units");
formula(costs, expediteCostIndex, "Value", `=${purchases.rows.map((_, index) => `${cell(purchases, index, "Purchase Quantity")}*${cell(purchases, index, "Expedite Premium Per Unit")}`).join("+")}`);
if (!costMutant) formula(costs, totalCostIndex, "Value", `=${[0, 1, 2, 3, 4].map((index) => cell(costs, index, "Value")).join("+")}`);
formula(costs, exceptionsTotalIndex, "Value", `=1+IF(${cell(projections, ord1004Index, "Backorder Quantity")}>0,1,0)`);
formula(costs, fulfillmentTotalIndex, "Value", `=${projections.rows.map((_, index) => cell(projections, index, "Fulfilled Quantity")).join("+")}`);

if (!dashboardMutant) {
  const dashboard = writeTable("Management", "ManagementSummary", ["Metric", "Value"], [
    ["Total Orders", 6], ["Units Requested", 168], ["Units Fulfilled", 98], ["Late Orders", 0], ["Exception Count", 1], ["Management Total Cost", staleDashboardMutant ? 9999 : alternate ? 3971.22 : costMutant ? 3870.02 : 3869.02],
  ], { row: alternate ? 3 : 2, col: alternate ? 3 : 2 });
  formula(dashboard, 0, "Value", `=${rawOrders.rows.map((_, index) => `IF(${cell(rawOrders, index, "Order ID")}<>"",1,0)`).join("+")}`);
  formula(dashboard, 1, "Value", `=${projections.rows.map((_, index) => cell(projections, index, "Requested Quantity")).join("+")}`);
  formula(dashboard, 2, "Value", `=${projections.rows.map((_, index) => cell(projections, index, "Fulfilled Quantity")).join("+")}`);
  formula(dashboard, 3, "Value", `=${projections.rows.map((_, index) => `IF(${cell(projections, index, "Status")}="late",1,0)`).join("+")}`);
  formula(dashboard, 4, "Value", `='Cost Summary'!${cell(costs, exceptionsTotalIndex, "Value")}`);
  if (!staleDashboardMutant) formula(dashboard, 5, "Value", `='Cost Summary'!${cell(costs, totalCostIndex, "Value")}`);
  dashboard.sheet.getRange("J3:K15").values = [["Week", "Production Units"], ...weeks.map((week) => [week, Object.entries(productionValues).filter(([key]) => key.startsWith(`${week}|`)).reduce((sum, [, value]) => sum + value, 0)])];
  const chart = dashboard.sheet.charts.add("line", dashboard.sheet.getRange("J3:K15"));
  chart.title = "Weekly Production Units";
  chart.hasLegend = false;
  chart.setPosition("M3", "T16");
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
