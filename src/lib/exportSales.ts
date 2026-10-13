import * as XLSXNS from 'xlsx-js-style';
import type { CellObject, Range, RowInfo, WorkSheet } from 'xlsx-js-style';

type XlsxModule = typeof XLSXNS;
const XLSX: XlsxModule = (XLSXNS as unknown as { default?: XlsxModule }).default ?? XLSXNS;

export type SalesExportRange = 'Day' | 'Week' | 'Month' | 'Year';

export type SalesReportInput = {
  stationName: string;
  range: SalesExportRange;
  periodLabel: string;
  selectedDate: string;
  compare: string;
  grossSales: number;
  salesChange: string;
  orderCount: number;
  ordersChange: string;
  averageOrder: number;
  averageChange: string;
  unpaidCount: number;
  unpaidTotal: number;
  breakdownTitle: string;
  breakdownHeading: string;
  breakdown: { label: string; total: number }[];
  orders: {
    created: Date;
    customer: string;
    payment: string;
    status: 'Paid' | 'Unpaid';
    total: number;
    items: { product: string; quantity: number; unitPrice: number | null; lineTotal: number | null }[];
  }[];
  filename: string;
};

type Style = Record<string, unknown>;
type Cell = { value?: string | number; formula?: string; style?: Style; format?: string };
type Draft = {
  cols: number;
  rows: Cell[][];
  merges: Range[];
  heights: RowInfo[];
};

const PESO = '"₱"#,##0.00';
const COUNT = '#,##0';
const grid = {
  top: { style: 'thin', color: { rgb: 'D5E0E8' } },
  bottom: { style: 'thin', color: { rgb: 'D5E0E8' } },
  left: { style: 'thin', color: { rgb: 'D5E0E8' } },
  right: { style: 'thin', color: { rgb: 'D5E0E8' } },
};

const paint = (hex: string) => ({ patternType: 'solid', fgColor: { rgb: hex } });
const typeface = (size: number, color: string, bold = false, italic = false) => ({ name: 'Calibri', sz: size, bold, italic, color: { rgb: color } });
const place = (horizontal: 'left' | 'center' | 'right') => ({ horizontal, vertical: 'center' });

const banner = (size: number, color: string, fill: string, bold = true): Style => ({
  font: typeface(size, color, bold),
  fill: paint(fill),
  alignment: place('center'),
});

const sectionStyle: Style = {
  font: typeface(12, 'FFFFFF', true),
  fill: paint('163651'),
  alignment: { ...place('left'), indent: 1 },
};

const headStyle: Style = {
  font: typeface(10, 'FFFFFF', true),
  fill: paint('0E3A56'),
  alignment: place('center'),
  border: grid,
};

const noteStyle: Style = {
  font: typeface(9, '5C7388', false, true),
  alignment: { ...place('left'), wrapText: true },
};

const dataStyle = (fill: string, horizontal: 'left' | 'center' | 'right', color = '1D3047', bold = false): Style => ({
  font: typeface(11, color, bold),
  fill: paint(fill),
  alignment: place(horizontal),
  border: grid,
});

const push = (draft: Draft, cells: Cell[], height: number, mergeAll = false) => {
  const row = draft.rows.length;
  const padded = Array.from({ length: draft.cols }, (_, index) => cells[index] ?? { value: '' });
  draft.rows.push(padded);
  draft.heights.push({ hpt: height });
  if (mergeAll) draft.merges.push({ s: { r: row, c: 0 }, e: { r: row, c: draft.cols - 1 } });
};

const mergeLabel = (draft: Draft) => {
  const row = draft.rows.length - 1;
  draft.merges.push({ s: { r: row, c: 0 }, e: { r: row, c: 1 } });
};

const span = (text: string, style: Style, cols: number): Cell[] => Array.from({ length: cols }, (_, index) => ({ value: index === 0 ? text : '', style }));

const headerBlock = (draft: Draft, input: SalesReportInput, sheetTitle: string) => {
  const cols = draft.cols;
  push(draft, span(input.stationName, banner(20, 'FFFFFF', '0B3148'), cols), 34, true);
  push(draft, span(sheetTitle, banner(13, 'FFFFFF', '14527A'), cols), 22, true);
  push(draft, span(`${input.range} view  ·  ${input.periodLabel}`, banner(12, '213916', '61E903'), cols), 22, true);
  push(draft, span(`Selected date: ${input.selectedDate}`, banner(11, '213916', 'E8F6D4', false), cols), 20, true);
  push(draft, span(`Exported ${new Date().toLocaleString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`, banner(10, '5C7388', 'F7FAFC', false), cols), 18, true);
  push(draft, span('', { fill: paint('FFFFFF') }, cols), 10, true);
};

const toSheet = (draft: Draft, widths: number[]): WorkSheet => {
  const rows = draft.rows.map((row) => row.map((cell) => cell.value ?? ''));
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  draft.rows.forEach((row, r) => {
    row.forEach((item, c) => {
      const address = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[address] as CellObject | undefined;
      if (!cell) return;
      if (item.formula) {
        cell.f = item.formula;
        cell.t = 'n';
      }
      if (item.style || item.format) cell.s = item.format ? { ...item.style, numFmt: item.format } : item.style;
      if (item.format) cell.z = item.format;
    });
  });
  sheet['!merges'] = draft.merges;
  sheet['!cols'] = widths.map((wch) => ({ wch }));
  sheet['!rows'] = draft.heights;
  sheet['!pageSetup'] = { paperSize: 9, orientation: draft.cols > 3 ? 'landscape' : 'portrait', fitToWidth: 1, fitToHeight: 0, horizontalCentered: true };
  sheet['!margins'] = { left: 0.5, right: 0.5, top: 0.55, bottom: 0.5, header: 0.25, footer: 0.25 };
  const last = XLSX.utils.encode_cell({ r: Math.max(draft.rows.length - 1, 0), c: draft.cols - 1 });
  sheet['!ref'] = `A1:${last}`;
  return sheet;
};

const summarySheet = (input: SalesReportInput) => {
  const draft: Draft = { cols: 3, rows: [], merges: [], heights: [] };
  headerBlock(draft, input, 'Sales & Analytics');
  push(draft, span('Summary', sectionStyle, 3), 24, true);
  push(draft, [
    { value: 'Metric', style: headStyle },
    { value: 'Compared with previous period', style: headStyle },
    { value: 'Amount', style: headStyle },
  ], 20);
  const metrics: { label: string; change: string; value: number; format: string }[] = [
    { label: 'Gross sales', change: `${input.salesChange} ${input.compare}`, value: input.grossSales, format: PESO },
    { label: 'Total orders', change: `${input.ordersChange} ${input.compare}`, value: input.orderCount, format: COUNT },
    { label: 'Average order value', change: `${input.averageChange} ${input.compare}`, value: input.averageOrder, format: PESO },
    { label: 'Unpaid orders', change: 'Listed with the orders, not included in gross sales', value: input.unpaidCount, format: COUNT },
    { label: 'Unpaid balance', change: 'Not included in gross sales', value: input.unpaidTotal, format: PESO },
  ];
  metrics.forEach((metric, index) => {
    const fill = index % 2 === 0 ? 'FFFFFF' : 'F4F8FB';
    push(draft, [
      { value: metric.label, style: dataStyle(fill, 'left', '1D3047', true) },
      { value: metric.change, style: dataStyle(fill, 'left', '5C7388') },
      { value: metric.value, style: dataStyle(fill, 'right', '1D3047', true), format: metric.format },
    ], 22);
  });
  push(draft, span('', { fill: paint('FFFFFF') }, 3), 10, true);
  push(draft, span(`${input.breakdownTitle}  ·  ${input.periodLabel}`, sectionStyle, 3), 24, true);
  push(draft, [
    { value: input.breakdownHeading, style: headStyle },
    { value: '', style: headStyle },
    { value: 'Sales', style: headStyle },
  ], 20);
  mergeLabel(draft);
  const firstBreakdown = draft.rows.length + 1;
  input.breakdown.forEach((item, index) => {
    const fill = index % 2 === 0 ? 'FFFFFF' : 'F4F8FB';
    push(draft, [
      { value: item.label, style: dataStyle(fill, 'left') },
      { value: '', style: dataStyle(fill, 'left') },
      { value: item.total, style: dataStyle(fill, 'right', '1D3047', true), format: PESO },
    ], 20);
    mergeLabel(draft);
  });
  const lastBreakdown = draft.rows.length;
  push(draft, [
    { value: 'Total paid sales', style: dataStyle('E7F8C9', 'left', '213916', true) },
    { value: '', style: dataStyle('E7F8C9', 'left', '213916', true) },
    {
      value: input.grossSales,
      formula: input.breakdown.length ? `SUM(C${firstBreakdown}:C${lastBreakdown})` : undefined,
      style: dataStyle('E7F8C9', 'right', '213916', true),
      format: PESO,
    },
  ], 22);
  mergeLabel(draft);
  push(draft, span('', { fill: paint('FFFFFF') }, 3), 8, true);
  push(draft, span(`Order history  ·  ${input.periodLabel}`, sectionStyle, 3), 24, true);
  push(draft, [
    { value: 'Name', style: headStyle },
    { value: 'Date', style: headStyle },
    { value: 'Total sale', style: headStyle },
  ], 20);
  const historyOrders = [...input.orders].sort((left, right) => left.created.getTime() - right.created.getTime());
  const firstHistory = draft.rows.length + 1;
  if (!historyOrders.length) {
    push(draft, span('No orders for this period.', dataStyle('FFFFFF', 'center', '5C7388'), 3), 22, true);
  } else {
    historyOrders.forEach((order, index) => {
      const fill = index % 2 === 0 ? 'FFFFFF' : 'F4F8FB';
      const when = order.created.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
      push(draft, [
        { value: order.customer, style: dataStyle(fill, 'left', '1D3047', true) },
        { value: when, style: dataStyle(fill, 'left') },
        { value: order.total, style: dataStyle(fill, 'right', '1D3047', true), format: PESO },
      ], 20);
    });
  }
  const lastHistory = draft.rows.length;
  const historyTotal = historyOrders.reduce((sum, order) => sum + order.total, 0);
  push(draft, [
    { value: 'Total', style: dataStyle('E7F8C9', 'left', '213916', true) },
    { value: `${historyOrders.length} order${historyOrders.length === 1 ? '' : 's'}`, style: dataStyle('E7F8C9', 'left', '213916', true) },
    {
      value: historyTotal,
      formula: historyOrders.length ? `SUM(C${firstHistory}:C${lastHistory})` : undefined,
      style: dataStyle('E7F8C9', 'right', '213916', true),
      format: PESO,
    },
  ], 22);
  push(draft, span('', { fill: paint('FFFFFF') }, 3), 8, true);
  push(draft, span('Gross sales count paid orders only. The order history below Revenue lists every order in this Day, Week, Month, or Year, including unpaid orders.', noteStyle, 3), 36, true);
  return toSheet(draft, [28, 62, 18]);
};

const orderQty = (order: SalesReportInput['orders'][number]) => order.items.reduce((sum, item) => sum + item.quantity, 0);
const orderItemsLabel = (order: SalesReportInput['orders'][number]) => order.items.length ? order.items.map((item) => `${item.quantity}× ${item.product}`).join(', ') : 'Items not recorded';

const ordersSheet = (input: SalesReportInput) => {
  const draft: Draft = { cols: 9, rows: [], merges: [], heights: [] };
  headerBlock(draft, input, 'Sales & Analytics — Orders');
  push(draft, span(`Orders  ·  ${input.periodLabel}`, sectionStyle, 9), 24, true);
  const headings = ['No.', 'Date', 'Time', 'Customer', 'Order items', 'Qty', 'Payment', 'Status', 'Order total'];
  push(draft, headings.map((heading) => ({ value: heading, style: headStyle })), 20);
  const headerRow = draft.rows.length;
  const listedTotal = input.orders.reduce((sum, order) => sum + order.total, 0);
  const listedQty = input.orders.reduce((sum, order) => sum + orderQty(order), 0);
  if (!input.orders.length) {
    push(draft, span('No orders for this period.', dataStyle('FFFFFF', 'center', '5C7388', false), 9), 24, true);
  } else {
    input.orders.forEach((order, index) => {
      const fill = index % 2 === 0 ? 'FFFFFF' : 'F4F8FB';
      const statusColor = order.status === 'Unpaid' ? 'C67E32' : '3D7A22';
      const date = order.created.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
      const time = order.created.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
      const qty = orderQty(order);
      push(draft, [
        { value: index + 1, style: dataStyle(fill, 'center'), format: COUNT },
        { value: date, style: dataStyle(fill, 'left') },
        { value: time, style: dataStyle(fill, 'left') },
        { value: order.customer, style: dataStyle(fill, 'left', '1D3047', true) },
        { value: orderItemsLabel(order), style: { ...dataStyle(fill, 'left'), alignment: { ...place('left'), wrapText: true } } },
        qty ? { value: qty, style: dataStyle(fill, 'center', '1D3047', true), format: COUNT } : { value: '', style: dataStyle(fill, 'center') },
        { value: order.payment, style: dataStyle(fill, 'left') },
        { value: order.status, style: dataStyle(fill, 'center', statusColor, true) },
        { value: order.total, style: dataStyle(fill, 'right', '1D3047', true), format: PESO },
      ], order.items.length > 1 ? 32 : 22);
    });
  }
  const lastOrder = draft.rows.length;
  push(draft, [
    { value: 'Total', style: dataStyle('E7F8C9', 'center', '213916', true) },
    { value: `${input.orders.length} order${input.orders.length === 1 ? '' : 's'}`, style: dataStyle('E7F8C9', 'left', '213916', true) },
    { value: '', style: dataStyle('E7F8C9', 'left', '213916', true) },
    { value: '', style: dataStyle('E7F8C9', 'left', '213916', true) },
    { value: '', style: dataStyle('E7F8C9', 'left', '213916', true) },
    listedQty ? { value: listedQty, formula: input.orders.length ? `SUM(F${headerRow + 1}:F${lastOrder})` : undefined, style: dataStyle('E7F8C9', 'center', '213916', true), format: COUNT } : { value: '', style: dataStyle('E7F8C9', 'center', '213916', true) },
    { value: '', style: dataStyle('E7F8C9', 'left', '213916', true) },
    { value: input.unpaidCount ? `${input.unpaidCount} unpaid` : 'All paid', style: dataStyle('E7F8C9', 'center', '213916', true) },
    {
      value: listedTotal,
      formula: input.orders.length ? `SUM(I${headerRow + 1}:I${lastOrder})` : undefined,
      style: dataStyle('E7F8C9', 'right', '213916', true),
      format: PESO,
    },
  ], 22);
  push(draft, span('', { fill: paint('FFFFFF') }, 9), 8, true);
  push(draft, span('Each order shows who bought, the quantity, and the order total for this Day, Week, Month, or Year and the selected date.', noteStyle, 9), 28, true);
  const sheet = toSheet(draft, [8, 16, 12, 24, 42, 10, 14, 12, 16]);
  if (input.orders.length) sheet['!autofilter'] = { ref: `A${headerRow}:I${lastOrder}` };
  return sheet;
};

const historySheet = (input: SalesReportInput) => {
  const draft: Draft = { cols: 10, rows: [], merges: [], heights: [] };
  headerBlock(draft, input, 'Sales & Analytics — Order history');
  push(draft, span(`Order history  ·  ${input.periodLabel}`, sectionStyle, 10), 24, true);
  const headings = ['Customer', 'Date', 'Time', 'Product', 'Qty', 'Unit price', 'Line total', 'Order total', 'Payment', 'Status'];
  push(draft, headings.map((heading) => ({ value: heading, style: headStyle })), 20);
  const headerRow = draft.rows.length;
  const lines = input.orders.flatMap((order) => {
    const date = order.created.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    const time = order.created.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
    if (!order.items.length) return [{ order, date, time, product: 'Items not recorded', quantity: null as number | null, unitPrice: null as number | null, lineTotal: null as number | null, first: true }];
    return order.items.map((item, index) => ({ order, date, time, product: item.product, quantity: item.quantity, unitPrice: item.unitPrice, lineTotal: item.lineTotal, first: index === 0 }));
  });
  if (!lines.length) {
    push(draft, span('No orders for this period.', dataStyle('FFFFFF', 'center', '5C7388', false), 10), 24, true);
  } else {
    let stripe = 0;
    lines.forEach((line, index) => {
      if (index === 0 || line.first) stripe += 1;
      const fill = stripe % 2 === 0 ? 'F4F8FB' : 'FFFFFF';
      const statusColor = line.order.status === 'Unpaid' ? 'C67E32' : '3D7A22';
      push(draft, [
        { value: line.order.customer, style: dataStyle(fill, 'left', '1D3047', true) },
        { value: line.date, style: dataStyle(fill, 'left') },
        { value: line.time, style: dataStyle(fill, 'left') },
        { value: line.product, style: dataStyle(fill, 'left') },
        line.quantity == null ? { value: '', style: dataStyle(fill, 'center') } : { value: line.quantity, style: dataStyle(fill, 'center', '1D3047', true), format: COUNT },
        line.unitPrice == null ? { value: '', style: dataStyle(fill, 'right') } : { value: line.unitPrice, style: dataStyle(fill, 'right'), format: PESO },
        line.lineTotal == null ? { value: '', style: dataStyle(fill, 'right') } : { value: line.lineTotal, style: dataStyle(fill, 'right', '1D3047', true), format: PESO },
        line.first ? { value: line.order.total, style: dataStyle(fill, 'right', '1D3047', true), format: PESO } : { value: '', style: dataStyle(fill, 'right') },
        { value: line.order.payment, style: dataStyle(fill, 'left') },
        { value: line.order.status, style: dataStyle(fill, 'center', statusColor, true) },
      ], 20);
    });
  }
  const lastLine = draft.rows.length;
  const qtyTotal = input.orders.reduce((sum, order) => sum + orderQty(order), 0);
  const lineTotal = lines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0);
  const orderTotal = input.orders.reduce((sum, order) => sum + order.total, 0);
  push(draft, [
    { value: 'Total', style: dataStyle('E7F8C9', 'left', '213916', true) },
    { value: `${input.orders.length} order${input.orders.length === 1 ? '' : 's'}`, style: dataStyle('E7F8C9', 'left', '213916', true) },
    { value: '', style: dataStyle('E7F8C9', 'left', '213916', true) },
    { value: '', style: dataStyle('E7F8C9', 'left', '213916', true) },
    qtyTotal ? { value: qtyTotal, formula: lines.length ? `SUM(E${headerRow + 1}:E${lastLine})` : undefined, style: dataStyle('E7F8C9', 'center', '213916', true), format: COUNT } : { value: '', style: dataStyle('E7F8C9', 'center', '213916', true) },
    { value: '', style: dataStyle('E7F8C9', 'right', '213916', true) },
    lineTotal ? { value: lineTotal, formula: lines.length ? `SUM(G${headerRow + 1}:G${lastLine})` : undefined, style: dataStyle('E7F8C9', 'right', '213916', true), format: PESO } : { value: '', style: dataStyle('E7F8C9', 'right', '213916', true) },
    { value: orderTotal, formula: lines.length ? `SUM(H${headerRow + 1}:H${lastLine})` : undefined, style: dataStyle('E7F8C9', 'right', '213916', true), format: PESO },
    { value: '', style: dataStyle('E7F8C9', 'left', '213916', true) },
    { value: input.unpaidCount ? `${input.unpaidCount} unpaid` : 'All paid', style: dataStyle('E7F8C9', 'center', '213916', true) },
  ], 22);
  push(draft, span('', { fill: paint('FFFFFF') }, 10), 10, true);
  push(draft, span('Totals by customer', sectionStyle, 10), 24, true);
  push(draft, [
    { value: 'Customer', style: headStyle },
    { value: 'Orders', style: headStyle },
    { value: 'Total qty', style: headStyle },
    { value: 'Order total', style: headStyle },
  ], 20);
  const grouped = new Map<string, { orders: number; qty: number; total: number }>();
  input.orders.forEach((order) => {
    const current = grouped.get(order.customer) ?? { orders: 0, qty: 0, total: 0 };
    current.orders += 1;
    current.qty += orderQty(order);
    current.total += order.total;
    grouped.set(order.customer, current);
  });
  const customers = [...grouped.entries()].sort((left, right) => right[1].total - left[1].total || left[0].localeCompare(right[0]));
  if (!customers.length) {
    push(draft, [{ value: 'No orders for this period.', style: dataStyle('FFFFFF', 'left', '5C7388') }], 22);
  } else {
    customers.forEach(([name, totals], index) => {
      const fill = index % 2 === 0 ? 'FFFFFF' : 'F4F8FB';
      push(draft, [
        { value: name, style: dataStyle(fill, 'left', '1D3047', true) },
        { value: totals.orders, style: dataStyle(fill, 'center'), format: COUNT },
        totals.qty ? { value: totals.qty, style: dataStyle(fill, 'center', '1D3047', true), format: COUNT } : { value: '', style: dataStyle(fill, 'center') },
        { value: totals.total, style: dataStyle(fill, 'right', '1D3047', true), format: PESO },
      ], 20);
    });
    push(draft, [
      { value: 'Total', style: dataStyle('E7F8C9', 'left', '213916', true) },
      { value: input.orders.length, style: dataStyle('E7F8C9', 'center', '213916', true), format: COUNT },
      qtyTotal ? { value: qtyTotal, style: dataStyle('E7F8C9', 'center', '213916', true), format: COUNT } : { value: '', style: dataStyle('E7F8C9', 'center', '213916', true) },
      { value: orderTotal, style: dataStyle('E7F8C9', 'right', '213916', true), format: PESO },
    ], 22);
  }
  push(draft, span('', { fill: paint('FFFFFF') }, 10), 8, true);
  push(draft, span('Order total is the full amount of that customer’s order. Qty is the number of items on the order. The customer totals add every order in this period.', noteStyle, 10), 32, true);
  return toSheet(draft, [26, 16, 14, 28, 12, 14, 16, 16, 14, 12]);
};

export const downloadSalesReport = (input: SalesReportInput) => {
  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    Title: `${input.stationName} — ${input.range} — ${input.periodLabel}`,
    Subject: `Sales report for ${input.selectedDate}`,
    Author: input.stationName,
    CreatedDate: new Date(),
  };
  XLSX.utils.book_append_sheet(workbook, summarySheet(input), 'Summary');
  XLSX.utils.book_append_sheet(workbook, ordersSheet(input), 'Orders');
  XLSX.utils.book_append_sheet(workbook, historySheet(input), 'Order history');
  XLSX.writeFile(workbook, input.filename);
};
