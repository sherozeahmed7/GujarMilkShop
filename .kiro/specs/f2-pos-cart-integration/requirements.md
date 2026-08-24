# Requirements Document

## Introduction

The **F2 POS Cart Integration** feature connects the existing Items F2 tab (Lassi, Butter, Ghee) to the POS cart and backend, exactly mirroring how Milk and Yogurt work today. Currently the F2 sell actions bypass the shared cart and only mutate in-memory mock stock — no payment flow, no real API call. After this feature, cashiers will add Lassi / Butter / Ghee lines to the shared right-panel cart, complete the bill through the same Cash / Online / Split / Khata payment tabs, and the backend will record the sale and deduct real F2 stock inside a single database transaction.

The work is structured in five phases:
- **Phase 1** — Frontend POS wiring (add-to-cart for F2 items)
- **Phase 2** — Backend F2 stock models and routes
- **Phase 3** — Extend the existing sale API to accept F2 item types and enforce stock
- **Phase 4** — Wire F2 inventory UI from mock to real API
- **Phase 5** — F2 sales reporting (later, same epic)

---

## Glossary

- **POS**: Point-of-Sale screen (`frontend/src/pages/POS.tsx`) with a left product panel and a right cart/bill panel.
- **Cart**: The shared in-memory list of `CartItem` objects held in `POS.tsx` state, rendered in the right panel.
- **F2 Tab / Items F2**: The "Items F2" tab in the POS left panel that renders `<MilkProducts />`.
- **F2 Products**: Lassi, Butter, and Ghee — the three products managed on the F2 tab.
- **Cart_Panel**: The right-panel bill area (cart list + payment tabs + checkout button) inside `POS.tsx`.
- **F2_Section**: One of `LassiSection`, `ButterSection`, or `GheeSection` React components.
- **Quick_Sale**: The current "Sell" button in each F2_Section that calls `onAddSale` directly (bypasses the Cart_Panel).
- **Add_To_Cart_Handler**: The `addToCart` function in `POS.tsx` that appends a `CartItem` to the cart state.
- **buildSaleItems**: Pure function in `POS.tsx` that converts cart lines to `SaleItemPayload[]` before API submission.
- **Sale_Service**: `backend/src/services/sale.service.ts` — validates and persists sales via Prisma.
- **SaleItem**: The `SaleItem` Prisma model; stores `itemName`, `quantity`, `unitPrice`, `totalPrice` per sale line.
- **F2_Daily_Stock**: The `MilkProductsDailyStock` shape defined in `frontend/src/types/milkProducts.types.ts`.
- **F2_Stock_Model**: New Prisma models for daily F2 stock (`MilkProductDailyStock`, `MilkProductTransaction`, `ButterGheeConversion`).
- **IMilkProductsRepository**: Interface in `frontend/src/repositories/milkProducts.repository.ts`.
- **Mock_Repository**: `mockMilkProductsRepository` — current in-memory implementation.
- **API_Repository**: New `apiMilkProductsRepository` — real HTTP implementation to be built in Phase 4.
- **ConfirmSaleModal**: Existing `frontend/src/components/pos/ConfirmSaleModal.tsx` — used for F2 bills.
- **JWT**: JSON Web Token auth middleware (`backend/src/middleware/auth.middleware.ts`) used on all protected routes.
- **Khata**: Ledger payment type (`ledger_daily` | `ledger_monthly`) that records a credit sale against a registered Customer.
- **Oversell**: Attempting to sell more F2 stock than is currently available for the day.

---

## Requirements

### Requirement 1: Add F2 Items to Cart from the F2 Tab

**User Story:** As a cashier, I want to add Lassi, Butter, and Ghee lines to the shared cart from the Items F2 tab, so that F2 sales go through the same payment flow as Milk and Yogurt.

#### Acceptance Criteria

1. WHEN the cashier clicks "Add to Cart" on an F2_Section with a quantity greater than 0 and a unit price greater than 0 entered, THE POS SHALL append a `CartItem` with `name` set to `'Lassi'`, `'Butter'`, or `'Ghee'` respectively, along with the entered `quantity` and `unitPrice`, to the Cart.
2. WHEN an F2 item is added to the Cart, THE Cart_Panel SHALL display the new line item showing name, an editable quantity field, the unit label (e.g. "L" for Lassi, "kg" for Butter/Ghee), and a calculated line total equal to quantity × unitPrice.
3. WHEN the cashier changes the quantity of an F2 cart line to a value greater than 0, THE Cart_Panel SHALL update the line total to the new quantity × the original unitPrice stored for that line.
4. IF the cashier sets the quantity of an F2 cart line to 0 or a negative number, THEN THE Cart_Panel SHALL remove that line from the Cart and recalculate the bill subtotal and total.
5. WHEN the cashier removes an F2 cart line using the remove action, THE Cart_Panel SHALL remove it and recalculate the bill subtotal and total.
6. WHILE the Items F2 tab is active, THE Cart_Panel SHALL be visible and all checkout controls (payment tabs, checkout button) SHALL be interactable, so that the cashier can review and pay without switching tabs.
7. WHILE the Items F2 tab is active, THE Cart_Panel SHALL display and allow checkout for any combination of F2 items (Lassi, Butter, Ghee) and Milk/Yogurt items simultaneously.
8. IF the cashier enters a quantity of 0 or a negative number in an F2 sell field and attempts to add to Cart, THEN THE F2_Section SHALL not add any item to the Cart and SHALL display a visible error indication (e.g. a red border or inline error message on the quantity field).
9. WHEN an F2_Section is rendered, THE F2_Section SHALL display a unit price input field allowing the cashier to enter a price per unit greater than 0 before adding to Cart.

---

### Requirement 2: Retire Quick-Sale Bypass on F2 Sections

**User Story:** As a cashier, I want selling F2 products to always go through the cart and payment confirmation, so that no sale escapes the POS payment flow or stock accounting.

#### Acceptance Criteria

1. THE POS SHALL replace the Quick_Sale "Sell" action on each of `LassiSection`, `ButterSection`, and `GheeSection` with an "Add to Cart" action that calls the Add_To_Cart_Handler in `POS.tsx`.
2. IF the cashier triggers the "Add to Cart" action on an F2_Section with a quantity of 0 or less, THEN THE F2_Section SHALL not invoke the Add_To_Cart_Handler and SHALL show a visible error on the quantity field.
3. WHEN the "Add to Cart" action is triggered on an F2_Section with a valid quantity, THE F2_Section SHALL NOT invoke `onAddSale`, `handleLassiSale`, `handleButterSale`, or `handleGheeSale` (the legacy inventory-write paths).
4. THE F2_Section SHALL retain all production, conversion, and day-end inventory actions (`handleLassiProduction`, `handleButterProduction`, `handleGheeProduction`, `handleConvertButterToGhee`, `handleDayEndLassi`) unchanged; only the sell path changes.
5. WHILE the F2 tab is active and the Cart contains at least one item, THE Cart_Panel SHALL be displayed and all checkout controls (payment tabs, checkout button) SHALL be interactable.

---

### Requirement 3: buildSaleItems Maps F2 Item Names Correctly

**User Story:** As a developer, I want `buildSaleItems` to produce correct `SaleItemPayload` entries for F2 lines, so that the backend receives valid `itemName` values.

#### Acceptance Criteria

1. WHEN the Cart contains a line with `name === 'Lassi'`, THE buildSaleItems function SHALL set `itemName` to `'lassi'` in the resulting payload.
2. WHEN the Cart contains a line with `name === 'Butter'`, THE buildSaleItems function SHALL set `itemName` to `'butter'` in the resulting payload.
3. WHEN the Cart contains a line with `name === 'Ghee'`, THE buildSaleItems function SHALL set `itemName` to `'ghee'` in the resulting payload.
4. WHEN the Cart contains a mix of Milk, Yogurt, Lassi, Butter, and Ghee lines, THE buildSaleItems function SHALL produce a `SaleItemPayload` array where each entry's `itemName` equals the lowercase form of its source line `name` (i.e. `'Milk'→'milk'`, `'Yogurt'→'yogurt'`, `'Lassi'→'lassi'`, `'Butter'→'butter'`, `'Ghee'→'ghee'`), with no entry affecting another.
5. WHEN the Cart contains only Milk and/or Yogurt lines (no F2 lines), THE buildSaleItems function SHALL produce `itemName` values of `'milk'` and `'yogurt'` respectively, with the same `quantity`, `unitPrice`, and `totalPrice` values as before this change.
6. THE `SaleItemPayload` type SHALL be widened to `itemName: 'milk' | 'yogurt' | 'lassi' | 'butter' | 'ghee'` so that TypeScript accepts F2 item names at compile time.
7. IF the Cart contains a line with a `name` value that is not one of `'Milk'`, `'Yogurt'`, `'Lassi'`, `'Butter'`, or `'Ghee'`, THEN THE buildSaleItems function SHALL throw an Error identifying the unrecognised name, and SHALL NOT produce a payload entry for that line.

---

### Requirement 4: Payment Flow Covers F2 Bills

**User Story:** As a cashier, I want to complete an F2 sale using Cash, Online, Split, or Khata payment exactly as I do for Milk/Yogurt, so that F2 revenue is captured the same way.

#### Acceptance Criteria

1. WHEN the Cart contains at least one F2 item and the cashier clicks the checkout button, THE POS SHALL open the ConfirmSaleModal.
2. WHEN the cashier confirms the sale in ConfirmSaleModal, THE POS SHALL call `saleService.createSale` with a payload whose `items` array includes one `SaleItemPayload` entry per F2 cart line, each with `itemName` set to `'lassi'`, `'butter'`, or `'ghee'` as appropriate.
3. IF a Khata payment type is selected and a registered customer is chosen, THEN THE POS SHALL include `saleType: 'ledger_daily'` or `'ledger_monthly'` (matching the selected Khata type) and `customerId` in the sale payload.
4. IF a Split payment is selected, THEN THE POS SHALL require `paidAmount` (a value greater than 0 and less than the total), `customerName`, and `customerPhone` in the sale payload, and SHALL NOT allow checkout if any of these fields is missing.
5. IF a Cash payment is selected, THEN THE POS SHALL send `saleType: 'walk_in'` and `paymentMethod: 'cash'` in the sale payload.
6. IF an Online payment is selected, THEN THE POS SHALL send `saleType: 'walk_in'` and `paymentMethod: 'online'` in the sale payload.
7. WHEN a sale containing F2 items completes successfully, THE POS SHALL reset the Cart to empty and display a success label naming the sale type (e.g. "Cash Sale Complete", "Khata Sale – [Customer Name]") consistent with the label shown for Milk/Yogurt sales.
8. IF a sale containing F2 items fails (non-2xx response from the API), THEN THE POS SHALL display the server's error message in the UI and SHALL NOT clear the Cart.

---

### Requirement 5: Backend F2 Stock Models

**User Story:** As a developer, I want Prisma models for F2 daily stock, transactions, and Butter→Ghee conversions, so that the backend can read and write real F2 inventory.

#### Acceptance Criteria

1. THE backend Prisma schema SHALL contain a `MilkProductDailyStock` model with: `id` (Int, auto-increment primary key), `date` (DateTime, unique), `milkTotal` (Float), `lassiProduced` (Float), `lassiSold` (Float), `lassiRemaining` (Float), `butterOpening` (Float), `butterProduced` (Float), `butterSold` (Float), `butterConverted` (Float), `butterClosing` (Float), `gheeOpening` (Float), `gheeProduced` (Float), `gheeSold` (Float), `gheeClosing` (Float), `createdAt` (DateTime, default now), and `updatedAt` (DateTime, auto-updated). All Float fields SHALL default to 0.
2. THE backend Prisma schema SHALL contain a `MilkProductTransaction` model with: `id` (Int, auto-increment), `date` (DateTime), `product` (String, one of `'Milk'` | `'Lassi'` | `'Butter'` | `'Ghee'`), `type` (String, one of `'opening'` | `'produced'` | `'sold'` | `'converted'` | `'adjustment'` | `'milk_added'` | `'lassi_produced'` | `'lassi_sold'` | `'butter_produced'` | `'butter_sold'` | `'butter_converted'` | `'ghee_produced'` | `'ghee_sold'`), `quantity` (Float, must be > 0), `reference` (String, optional, max 255 characters), `notes` (String, optional, max 500 characters), and `createdAt` (DateTime, default now).
3. THE backend Prisma schema SHALL contain a `ButterGheeConversion` model with: `id` (Int, auto-increment), `date` (DateTime), `butterUsed` (Float, must be > 0), `gheeProduced` (Float, must be > 0), `notes` (String, optional, max 500 characters), and `createdAt` (DateTime, default now).
4. THE `MilkProductDailyStock` model SHALL enforce a unique constraint on the `date` field so that no two records can exist for the same calendar date.
5. WHEN a Prisma migration is applied, THE database SHALL create the three new F2 tables (`MilkProductDailyStock`, `MilkProductTransaction`, `ButterGheeConversion`) without modifying, dropping, or altering data in the existing `Sale`, `SaleItem`, `Payment`, `Customer`, `DailyRate`, or `User` tables.

---

### Requirement 6: Backend F2 Stock API Routes

**User Story:** As a developer, I want REST API routes under `/api/milk-products` for F2 inventory operations, so that the frontend can read and write F2 stock without using the mock repository.

#### Acceptance Criteria

1. WHEN `GET /api/milk-products/stock?date=YYYY-MM-DD` is called with a valid date, THE API SHALL return the `MilkProductDailyStock` record for that date with HTTP 200; IF no record exists for the date, THEN THE API SHALL return an object with all numeric quantity fields set to 0 for that date with HTTP 200.
2. WHEN `POST /api/milk-products/stock/milk` is called with `{ date: string, quantity: number }` where `quantity > 0` and `quantity ≤ 99999.99`, THE API SHALL add `quantity` to the existing `milkTotal` for that date (creating the daily stock record if it does not yet exist) and return the updated record with HTTP 200.
3. WHEN `POST /api/milk-products/stock/lassi-production` is called with `{ date: string, quantity: number }` where `quantity > 0`, THE API SHALL add `quantity` to `lassiProduced` for that date (creating the record if needed) and return the updated record with HTTP 200.
4. WHEN `POST /api/milk-products/stock/butter-production` is called with `{ date: string, quantity: number }` where `quantity > 0`, THE API SHALL add `quantity` to `butterProduced` for that date (creating the record if needed) and return the updated record with HTTP 200.
5. WHEN `POST /api/milk-products/stock/ghee-production` is called with `{ date: string, quantity: number }` where `quantity > 0`, THE API SHALL add `quantity` to `gheeProduced` for that date (creating the record if needed) and return the updated record with HTTP 200.
6. WHEN `POST /api/milk-products/stock/conversion` is called with `{ date: string, butterKg: number, gheeKg: number }` where both values are > 0, THE API SHALL atomically deduct `butterKg` from `butterConverted` and add `gheeKg` to `gheeProduced` for that date and return the updated record with HTTP 200; IF the atomic update fails, THE API SHALL return HTTP 500 and leave both fields unchanged.
7. WHEN `POST /api/milk-products/stock/day-end-lassi` is called with `{ date: string, quantity: number }` where `quantity ≥ 0`, THE API SHALL set `lassiSold` to `quantity` for that date (creating the record if needed) and return the updated record with HTTP 200.
8. WHEN `GET /api/milk-products/transactions?date=YYYY-MM-DD` is called with a valid date, THE API SHALL return an array of all `MilkProductTransaction` records for that date with HTTP 200 (empty array if none).
9. WHEN `GET /api/milk-products/conversions?date=YYYY-MM-DD` is called with a valid date, THE API SHALL return an array of all `ButterGheeConversion` records for that date with HTTP 200 (empty array if none).
10. ALL routes under `/api/milk-products` SHALL require a valid JWT Bearer token via the `authenticateJWT` middleware; IF the token is missing or invalid, THE API SHALL return HTTP 401.
11. IF the `date` query parameter on any GET route is absent, not in `YYYY-MM-DD` format, or represents an invalid calendar date (e.g. `2024-02-30`), THEN THE API SHALL return HTTP 400 with a message that identifies the invalid or missing `date` parameter.

---

### Requirement 7: Sale Service Accepts F2 Item Names

**User Story:** As a developer, I want the Sale_Service to accept `'lassi'`, `'butter'`, and `'ghee'` as valid `itemName` values, so that sales containing F2 items can be persisted.

#### Acceptance Criteria

1. THE Sale_Service SHALL recognise exactly five valid item names: `'milk'`, `'yogurt'`, `'lassi'`, `'butter'`, and `'ghee'`; any sale payload whose item names are all within this set SHALL pass item-name validation.
2. WHEN a sale payload contains an item with `itemName: 'lassi'`, `'butter'`, or `'ghee'`, a `quantity` greater than 0, and a `unitPrice` greater than or equal to 0, THE Sale_Service SHALL persist the corresponding `SaleItem` row and return HTTP 201 for the overall sale.
3. IF a sale payload contains an item with an `itemName` that is not one of the five allowed values, THEN THE Sale_Service SHALL return HTTP 400 with a message that identifies the unrecognised value and lists all five allowed names.
4. WHEN a sale payload contains only `'milk'` and/or `'yogurt'` items with `quantity > 0` and `unitPrice ≥ 0`, THE Sale_Service SHALL persist the corresponding `SaleItem` rows and return HTTP 201, identical to behaviour before this change.

---

### Requirement 8: Stock Sufficiency Check on Sale with F2 Lines

**User Story:** As a cashier, I want the backend to block an F2 sale if remaining stock is insufficient, so that I never oversell Lassi, Butter, or Ghee.

#### Acceptance Criteria

1. WHEN a sale payload includes at least one F2 line item, THE Sale_Service SHALL read the `MilkProductDailyStock` record for the server's current calendar date (YYYY-MM-DD in the server's local timezone) before committing the sale.
2. IF no `MilkProductDailyStock` record exists for today's date when a sale with F2 lines is submitted, THEN THE Sale_Service SHALL return HTTP 422 with a message stating that no stock record has been created for today and that F2 items cannot be sold until stock is initialised.
3. IF the total `quantity` of all `lassi` lines in a sale payload exceeds the current `lassiRemaining` value for today, THEN THE Sale_Service SHALL return HTTP 422 with a message that includes the product name ("Lassi") and the current `lassiRemaining` value.
4. IF the total `quantity` of all `butter` lines in a sale payload exceeds the current `butterClosing` value for today, THEN THE Sale_Service SHALL return HTTP 422 with a message that includes the product name ("Butter") and the current `butterClosing` value.
5. IF the total `quantity` of all `ghee` lines in a sale payload exceeds the current `gheeClosing` value for today, THEN THE Sale_Service SHALL return HTTP 422 with a message that includes the product name ("Ghee") and the current `gheeClosing` value.
6. WHEN all stock checks pass, THE Sale_Service SHALL create the `Sale`, `SaleItem`, and `Payment` rows AND update the following fields in `MilkProductDailyStock` for today — `lassiSold += soldLassiQty`, `lassiRemaining -= soldLassiQty`, `butterSold += soldButterQty`, `butterClosing -= soldButterQty`, `gheeSold += soldGheeQty`, `gheeClosing -= soldGheeQty` — all in a single atomic database transaction, returning HTTP 201.
7. IF the database transaction fails for any reason after stock checks pass, THEN THE Sale_Service SHALL roll back all changes (sale rows and stock deductions) and return HTTP 500, leaving the stock unchanged.

---

### Requirement 9: Frontend Inventory API Repository

**User Story:** As a developer, I want an `apiMilkProductsRepository` that implements `IMilkProductsRepository` by calling the real `/api/milk-products` routes, so that the F2 inventory UI reads and writes real data.

#### Acceptance Criteria

1. THE frontend SHALL contain an `apiMilkProductsRepository` module that implements all six methods of `IMilkProductsRepository` using the existing `apiClient`:
   - `getDailyStock(date)` → `GET /api/milk-products/stock?date={date}`
   - `getTransactions(date)` → `GET /api/milk-products/transactions?date={date}`
   - `getConversions(date)` → `GET /api/milk-products/conversions?date={date}`
   - `updateDailyStock(date, data)` → `POST /api/milk-products/stock/milk` (and corresponding production/day-end endpoints based on which fields are set)
   - `addTransaction(transaction)` → `POST /api/milk-products/transactions`
   - `addConversion(conversion)` → `POST /api/milk-products/stock/conversion`
2. WHEN `milkProducts.service.ts` is switched from `mockMilkProductsRepository` to `apiMilkProductsRepository`, THE F2 inventory UI operations (produce milk, record lassi production, record butter production, record ghee production, convert butter to ghee, set day-end lassi, view history) SHALL all call through to the real API endpoints without requiring any changes to the `IMilkProductsRepository` interface or the service layer.
3. IF an API call within `apiMilkProductsRepository` returns a non-2xx HTTP response, THEN THE repository method SHALL throw an `Error` whose message is the `message` field from the server response body, or a fallback message of `"Request failed with status {status}"` if no `message` field is present.
4. THE `apiMilkProductsRepository` SHALL use `apiClient` (which reads the JWT token from `localStorage` and sends it as `Authorization: Bearer {token}`) for every request, consistent with other frontend API calls.

---

### Requirement 10: Sales Reports Include F2 Items

**User Story:** As a shop owner, I want sales records and customer ledger views to show F2 item names, quantities, prices, and customer details, so that F2 revenue is visible in reports.

#### Acceptance Criteria

1. WHEN a sale containing F2 items is retrieved via `GET /api/sales/:id`, THE API SHALL return `SaleItem` records with `itemName` values `'lassi'`, `'butter'`, or `'ghee'`.
2. WHEN sales are listed via `GET /api/sales`, THE response SHALL include F2 item lines alongside Milk/Yogurt lines, filterable by the same date range and saleType parameters.
3. WHEN the sales analytics endpoint is called with `includeAnalytics=true`, THE `categoryBreakdown` field SHALL include separate entries for `'Lassi'`, `'Butter'`, and `'Ghee'` when F2 items are sold.
4. WHEN a Khata sale includes F2 items, THE sale record SHALL contain the `customerId`, `customer.name`, item names, quantities, and unit prices.

