# Project Context - LM Ladies Tailor Billing System

## 1. What the Project Does
The **LM Ladies Tailor Billing System** is a full-stack web application designed for a tailoring business to manage customer relationships, order tracking, and financial analytics.
- **Customer Management**: Stores customer profiles, contact info, and their specific measurements.
- **Order Lifecycle**: Tracks orders from "Pending" to "Ready" and "Delivered". Each order can contain multiple services (e.g., stitching, embroidery).
- **Billing**: Generates PDF bills for customers and calculates balances/advances.
- **Worker Management**: A dedicated dashboard for workers to update the status of assigned work.
- **Analytics & Profits**: Tracks business expenses (including stitching labor) and calculates net profit over time.
- **PWA / Offline Support**: Works offline as a Progressive Web App, syncing data when a connection is restored.

## 2. Current Progress (Updated: 19 Mar 2026)
- **Core Functionality**: Customer CRUD, order creation, and bill generation are fully implemented.
- **1:1 Measurement Model**: Restored and enforced a strict 1-to-1 relationship between customers and measurement records.
- **Database Indexing**: Added unique constraints to prevent data duplication.
- **Customer Editing**: Users can now edit customer names and phone numbers directly from their profiles.
- **Analytics**: Comprehensive dashboard for monthly, yearly, and all-time profit/loss tracking.
- **Deployment**: Configured for Vercel with LibSQL/Turso for persistent cloud storage.
- **Advance Edit Feature**: Admin can edit the advance payment amount on any order from Order History with a confirmation popup.
- **Dashboard "Due Tomorrow"**: Dashboard now shows a "Due Tomorrow" reminder card listing orders due the next day, with click-to-filter functionality. Removed "Total Earnings" card.
- **Dashboard Interactive Filters**: Clicking status cards (Due Today, Pending, Ready, Due Tomorrow) filters Order History accordingly.
- **Worker Status Update**: Workers can mark orders as Ready or Delivered directly from their dashboard.
- **Camera / Sketch Support**: New Order form supports camera capture and a ScratchPad canvas for drawing backneck patterns.
- **Duplicate Order Prevention**: 
  - Frontend: `submittingRef` guard in `NewOrder.jsx` blocks double-clicks at the synchronous level.
  - Backend: 30-second duplicate detection check in `orders.js` before inserting a new order.
- **Google Sheets Auto-Backup**: Every new order is automatically appended to a Google Sheet with full details (customer, measurements, services, payment). Headers are bold/frozen. All 17 existing orders have been backfilled.
- **Worker Expense Categories**: Worker names (PRAVEEN, RENUKA, JAIRULL, SADDAM, KHALIM) added as expense categories in Analytics.
- **Offline Order Save**: Orders created while offline are saved locally and synced when internet is restored.

## 3. Pending Tasks
- **UI/UX Polishing**: Potential refinements based on user feedback.
- **Worker Features**: Potential expansion of the worker dashboard (e.g., more granular task tracking).

## 4. Key Architecture
- **Tech Stack**:
  - **Frontend**: React.js, Vite, custom CSS, Lucide-React icons.
  - **Backend**: Node.js, Express.
  - **Database**: LibSQL (Turso cloud for production, local SQLite for development).
- **Communication**: REST API using Axios with environment-based base URLs.
- **Schema Overview**:
  - `customers`: ID, Name, Phone Number.
  - `measurements`: Link to customer (UNIQUE), stores specific tailor dimensions.
  - `orders`: Links customer, tracks dates, totals, advances, status, worker, payment method.
  - `services`: Detailed line items for each order.
  - `expenses`: General business expenses with category (includes worker names).
  - `order_images` & `order_voice_notes`: Attachments for design references and instructions.

## 5. Key Files
- `server/routes/orders.js` — Order CRUD, duplicate guard, Google Sheets backup trigger
- `server/sheets.js` — Google Sheets API helper (auth, header init, row append)
- `server/routes/dashboard.js` — Dashboard stats including Due Tomorrow
- `client/src/pages/NewOrder.jsx` — Order creation form with double-submit guard
- `client/src/pages/OrderHistory.jsx` — Order list with advance edit feature
- `client/src/pages/Dashboard.jsx` — Interactive stat cards with filtering
- `client/src/pages/Analytics.jsx` — Expense tracker with worker categories

## 6. Environment Variables (Backend)
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Turso cloud DB URL (or local file path for dev) |
| `DATABASE_AUTH_TOKEN` | Turso auth token |
| `GOOGLE_SHEET_ID` | Google Sheets spreadsheet ID for auto-backup |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Full JSON credentials for Google service account |
| `PORT` | Server port (default 5000) |

## 7. Important Links & Credentials
- **GitHub Repository**: https://github.com/KISHANMM/LM_TAILOR_BILLING_SYSTEM
- **Live App**: https://lm-tailor-billing-system-7f1a.vercel.app
- **Google Sheet Backup**: https://docs.google.com/spreadsheets/d/1kt1JXpECJRwcgrxjU11NVXgGcUo1IvwrSboUxbbX9y0
- **Turso Database URL**: libsql://lm-tailor-db-kishanmagaji.aws-ap-south-1.turso.io
- **Turso Auth Token**: eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzI4MTIzMjcsImlkIjoiMDE5Y2MzZDgtZDMwMS03NTJkLWIyZjEtOTdiMGM1ZTRkODc2IiwicmlkIjoiMTJlZGVjZGQtYmZhMy00ZDhmLWFhOTgtN2NiNDA4MDdhN2U2In0.gVqmcn4sRplpeQTRr8EkQuDH8e7pi8CcK3igelGBiFxZrhOkfTGL1YSrvf7A835IGBRfIE4WQDXKaBJD_b3rDA
- **Google Service Account Email**: lm-tailor-sheets@lm-tailor.iam.gserviceaccount.com
- **Google Service Account Key File**: `lm-tailor-c4307233f93a.json` (keep safe, never commit to these credentials to git)
