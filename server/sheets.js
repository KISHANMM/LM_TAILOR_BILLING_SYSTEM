// sheets.js — Google Sheets auto-backup helper
// Appends a new row every time an order is created

const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_TAB = 'Orders'; // tab name inside the spreadsheet

// Column headers (bold formatting applied on first init)
const HEADERS = [
    'ORDER ID', 'CUSTOMER NAME', 'PHONE', 'BOOKING DATE', 'DELIVERY DATE',
    'SERVICES', 'TOTAL (₹)', 'ADVANCE (₹)', 'BALANCE (₹)',
    'PAYMENT METHOD', 'WORKER', 'MEAS. TYPE',
    'LENGTH', 'SHOULDER', 'CHEST', 'WAIST', 'DOT',
    'BACK NECK', 'FRONT NECK', 'SLEEVES LEN.', 'ARMHOLE',
    'CHEST DIST.', 'SLEEVES ROUND',
    'T-LENGTH', 'T-SHOULDER', 'T-CHEST', 'T-WAIST', 'T-BACK NECK', 'T-FRONT NECK', 'T-SLEEVES LEN.', 'T-ROUND', 'T-HALF BODY', 'T-HIP',
    'B-LENGTH', 'B-ROUND', 'B-HIP', 'B-FLY', 'B-THAI', 'B-KNEE',
    'NOTES', 'CREATED AT', 'Len'
];

let isInitialized = false;

function getAuthClient() {
    const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY env var not set');
    const key = JSON.parse(keyJson);
    return new google.auth.GoogleAuth({
        credentials: key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
}

// Initialize sheet: create tab if needed, write bold headers if empty
async function initSheet(sheets) {
    if (isInitialized) return;

    // Check if tab exists
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const tabExists = meta.data.sheets.some(s => s.properties.title === SHEET_TAB);

    if (!tabExists) {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SHEET_ID,
            requestBody: {
                requests: [{
                    addSheet: { properties: { title: SHEET_TAB } }
                }]
            }
        });
    }

    // Write header row if missing
    const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_TAB}!A1:A1`,
    });

    if (!existing.data.values || existing.data.values.length === 0) {
        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: `${SHEET_TAB}!A1`,
            valueInputOption: 'RAW',
            requestBody: { values: [HEADERS] },
        });
    }

    // Get the sheet ID for formatting
    const updatedMeta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const sheetObj = updatedMeta.data.sheets.find(s => s.properties.title === SHEET_TAB);
    const sheetTabId = sheetObj.properties.sheetId;

    // Apply formatting (bold headers, freeze row, auto-resize, date/currency formats)
    console.log('[Sheets] 🛠️  Ensuring sheet formatting is applied...');
    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
            requests: [
                {
                    // Bold text
                    repeatCell: {
                        range: { sheetId: sheetTabId, startRowIndex: 0, endRowIndex: 1 },
                        cell: {
                            userEnteredFormat: {
                                textFormat: { bold: true, fontSize: 11 },
                                backgroundColor: { red: 0.18, green: 0.05, blue: 0.05 }, // dark maroon
                                horizontalAlignment: 'CENTER',
                            }
                        },
                        fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment)'
                    }
                },
                {
                    // Freeze header row
                    updateSheetProperties: {
                        properties: {
                            sheetId: sheetTabId,
                            gridProperties: { frozenRowCount: 1 }
                        },
                        fields: 'gridProperties.frozenRowCount'
                    }
                },
                {
                    // Format Date columns (D, E)
                    repeatCell: {
                        range: { sheetId: sheetTabId, startColumnIndex: 3, endColumnIndex: 5 },
                        cell: {
                            userEnteredFormat: {
                                numberFormat: { type: 'DATE', pattern: 'yyyy-mm-dd' },
                                horizontalAlignment: 'LEFT',
                            }
                        },
                        fields: 'userEnteredFormat(numberFormat,horizontalAlignment)'
                    }
                },
                {
                    // Format Currency columns (G, H, I)
                    repeatCell: {
                        range: { sheetId: sheetTabId, startColumnIndex: 6, endColumnIndex: 9 },
                        cell: {
                            userEnteredFormat: {
                                numberFormat: { type: 'NUMBER', pattern: '[$₹-409]#,##0' },
                                horizontalAlignment: 'RIGHT',
                            }
                        },
                        fields: 'userEnteredFormat(numberFormat,horizontalAlignment)'
                    }
                }
            ]
        }
    });

    isInitialized = true;
}

/**
 * Append a new order row to the Google Sheet.
 * Called after successful order creation. Non-blocking — errors are logged, not thrown.
 *
 * @param {object} data - Order data object
 */
// Private helper to format one order into a sheet row array
function _prepareRow(data) {
    const {
        order_id, customer_name, phone_number,
        booking_date, delivery_date,
        services, total_amount, advance_paid, balance_amount,
        payment_method, assigned_worker, measurement_type,
        measurements = {}, notes, created_at
    } = data;

    // Format services as readable string: "Blouse x1 (₹800), Alteration x2 (₹300)"
    const servicesStr = Array.isArray(services)
        ? services.map(s => `${s.service_type} x${s.quantity} (₹${s.price})`).join(', ')
        : '';

    return [
        `#${String(order_id).padStart(4, '0')}`,
        customer_name || '',
        phone_number || '',
        booking_date || '',
        delivery_date || '',
        servicesStr,
        total_amount || 0,
        advance_paid || 0,
        balance_amount || 0,
        payment_method || 'Cash',
        assigned_worker || '',
        measurement_type || '',
        measurements['length'] || measurements.m_length || '',
        measurements.shoulder || '',
        measurements.chest || '',
        measurements.waist || '',
        measurements.dot || '',
        measurements.back_neck || '',
        measurements.front_neck || '',
        measurements.sleeves_length || '',
        measurements.armhole || '',
        measurements.chest_distance || '',
        measurements.sleeves_round || '',
        measurements.t_length || '',
        measurements.t_shoulder || '',
        measurements.t_chest || '',
        measurements.t_waist || '',
        measurements.t_back_neck || '',
        measurements.t_front_neck || '',
        measurements.t_sleeves_length || '',
        measurements.t_sleeves_round || '',
        measurements.t_half_body || '',
        measurements.t_hip || '',
        measurements.b_length || '',
        measurements.b_bottom_round || '',
        measurements.b_hip || '',
        measurements.b_fly || '',
        measurements.b_thai || '',
        measurements.b_knee || '',
        notes || '',
        created_at || new Date().toLocaleString('en-IN'),
        measurements.meas_length || measurements.length || measurements.m_length || ''
    ];
}

/**
 * Append a new order row to the Google Sheet.
 * Called after successful order creation. Non-blocking — errors are logged, not thrown.
 *
 * @param {object} data - Order data object
 */
async function appendOrderToSheet(data) {
    if (!SHEET_ID) {
        console.warn('[Sheets] GOOGLE_SHEET_ID not set — skipping backup');
        return;
    }
    try {
        const auth = getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });

        await initSheet(sheets);

        const row = _prepareRow(data);

        await sheets.spreadsheets.values.append({
            spreadsheetId: SHEET_ID,
            range: `${SHEET_TAB}!A1`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: [row] },
        });

        console.log(`[Sheets] ✅ Order ${row[0]} backed up to Google Sheet`);
    } catch (err) {
        // Never crash the order creation — just log the error
        console.error('[Sheets] ❌ Failed to backup order:', err.message);
    }
}

/**
 * Synchronize multiple orders to the Google Sheet in a single batch.
 *
 * @param {Array<object>} ordersArr - Array of order objects
 */
async function syncOrdersToSheet(ordersArr) {
    if (!SHEET_ID) return;
    if (!ordersArr || ordersArr.length === 0) return;

    try {
        const auth = getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });

        await initSheet(sheets);

        const rows = ordersArr.map(o => _prepareRow(o));

        await sheets.spreadsheets.values.append({
            spreadsheetId: SHEET_ID,
            range: `${SHEET_TAB}!A1`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: rows },
        });

        console.log(`[Sheets] ✅ Batch sync complete: ${rows.length} rows written`);
    } catch (err) {
        console.error('[Sheets] ❌ Batch sync failed:', err.message);
    }
}

module.exports = { appendOrderToSheet, syncOrdersToSheet };
