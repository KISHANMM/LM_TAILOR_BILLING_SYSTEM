# LM Ladies Tailor Billing System

## 1. Project Summary (For your CV)
**Project Name:** LM Ladies Tailor Billing System
**Role:** Full-Stack Developer
**Description:** A comprehensive, full-stack Progressive Web Application (PWA) tailored for a boutique tailoring business to manage customer relationships, optimize order lifecycles, and handle financial analytics. The application digitizes manual tailoring logs by providing customer profile management, precise dynamic measurement tracking, order/service billing, and worker assigned task updates. Real-time dashboards provide analytics on business expenses and net profits. 
**Key Achievements:**
- Developed offline-first capabilities allowing the business to function seamlessly during internet outages, syncing automatically upon connection.
- Integrated a live Google Sheets backup framework using the Google Sheets API to ensure redundancy of financial and order records.
- Created an interactive Canvas-based ScratchPad for tailors to draw clothing patterns (like necklines) paired with camera uploads for reference images.
- Designed advanced SQL query structures on LibSQL/Turso for real-time calculation of daily dues, analytics, and business profits spanning thousands of rows.

---

## 2. Tools & Technologies Used
### Frontend Architecture:
- **React.js & Vite:** Core frontend runtime for fast module replacement and rendering.
- **CSS3 (Vanilla/Custom Modules):** Handcrafted responsive UI designs, styled independently to provide a customized tailored aesthetic.
- **Axios:** For handling HTTP requests.
- **Lucide-React:** For crisp, scalable vector icons.
- **PWA (Progressive Web App):** Service Workers and Manifest configurations for offline capability and native-app feel on mobile devices.
- **HTML5 Canvas API:** Custom drawing pad implementation for tailoring sketches.

### Backend Architecture:
- **Node.js runtime & Express.js framework:** Main backend API server handling CRUD operations.
- **Google API Client (`googleapis`):** For server-to-server integration mapping orders directly into cloud spreadsheets.

### Database & Cloud:
- **LibSQL / Turso:** A high-performance, cloud-distributed SQLite-compatible database used for primary data storage in production.
- **Local SQLite:** Local database environment for sandboxed development.
- **Vercel:** Hosting delivery for the frontend, combined with configured environment variables.

---

## 3. Implementation Details & Architecture Review
### Application Flow & Data Model:
- The system operates around a robust relational model. Base tables include `customers`, `measurements`, `orders`, `services`, and `expenses`.
- **Customer to Measurements Relation:** Enforced with a strict 1-to-1 unique mapping; preventing data pollution when tailors manage repeat customer visits.
- **Order creation & State Management:** An order is created by linking a Customer, applying `services` (stitching, embroidery) and tracking advances. The order flows across discrete states: `Pending` -> `Ready` -> `Delivered`.
- **Worker Management Integration:** Granular control allowing specific workers (like Praveen, Renuka, etc.) to view assigned tasks and update the status, which is immediately reflected securely in the broader expenses and analytics module.

### Core Mechanisms Developed:
1. **Concurrency and Idempotency Control:** To handle issues with slow network connections and user double-clicking, a synchronous frontend blocker (`submittingRef` guard) is paired with a backend 30-second temporal evaluation logic. This stops duplicate identical order creation payloads from executing SQL INSERTs.
2. **Offline Mode:** Front-end Service Workers intercept calls. If offline, the order commits are stored locally and re-pushed when internet connectivity restores.
3. **Automated Sheet Synchrony:** As soon as an order is successfully finalized in Turso DB, an asynchronous Node.js function (`server/sheets.js`) maps the JSON payload and pushes the row via secure Service Account credentials into a protected Google Sheet for fallback ledgering.

---

## 4. Top Interview Questions & Answers

**Q1: Can you walk me through the architecture of your Tailor Billing application?**
**Answer:** The architecture is a decoupled client-server model. The frontend is built on React.js (via Vite) optimized as a PWA, storing cached states for offline support. It communicates via RESTful APIs to an Express/Node.js backend. The backend strictly mediates data using a cloud-hosted LibSQL database via Turso. I also built a separate Google Sheets webhook trigger on the backend to append every transaction for secondary backup.

**Q2: How did you handle the challenge of network unreliability or duplicate orders?**
**Answer:** Network latency led to a known risk of double billing if users clicked the Submit order button repeatedly. I solved this natively on two layers:
1. **Frontend:** Implemented a stateful ref check (using `useRef`) that freezes the button interactions the moment a submission initializes, ignoring further user clicks.
2. **Backend:** As fail-over security, I wrote a time-based duplicate detection service. When an order payload arrives, the database checks if an identical order (similar customer ID and parameters) was inserted within the last 30 seconds. If so, it rejects the persistence attempt.

**Q3: How exactly is the data synchronized with Google Sheets?**
**Answer:** In the backend router layer, after an order successfully completes database insertion, control is passed to a utility file (`sheets.js`). Using the `googleapis` SDK, I programmatically authenticate against my Google Service Account JSON config. The utility formats the nested order/service object into flat array values and sends an `append` operation to the specific Spreadsheet ID. The headers are frozen and custom formatted remotely.

**Q4: Why did you choose Turso/LibSQL instead of something standard like PostgreSQL or MongoDB?**
**Answer:** Given this tool is used heavily for a local business with high read density but moderately grouped writes, SQLite was incredibly fast and lightweight. Turso’s LibSQL scales that SQLite model to the cloud globally at the edge. It provided the SQL relational integrity I fundamentally needed for tying invoices and services back to customers, while keeping hosting complexity and latency to an absolute minimum.

**Q5: The application has analytics for profits. How do you calculate that?**
**Answer:** The database groups revenue components (like advanced amounts, total order values) against specific date variables (`booking_date`). I then created an `expenses` table categorized by worker wages and miscellaneous costs. The backend runs aggregated SQL `SUM()` queries using grouping logic to compare collected revenues against raw expenses, outputting granular Monthly, Yearly, and All-Time Net Profit data to the dashboard.

**Q6: I see you implemented a custom Drawing Canvas and Camera capability. How was that accomplished?**
**Answer:** Modern browsers support the HTML5 `<canvas>` API along with `getUserMedia` for device peripherals. I created React components that interface with canvas drawing methods (like `lineTo`, `moveTo`) mapping pointer events (both touch & mouse) onto the drawing context. Using `.toDataURL()`, the visual canvas or photo captures are transformed to secure base64 strings and attached alongside the REST JSON payload to the database.
