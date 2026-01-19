# ✅ Testing Checklist - Sabrofood POS Production Features

## 🧪 Pre-Deployment Tests

### ⚙️ Setup Tests

- [ ] **SQL Migration Executed**
  - Execute `database/migration.sql` in Supabase SQL Editor
  - Verify no errors
  - Check that `codigo_barras` column exists in `productos` table
  - Verify index `idx_productos_codigo_barras` created

- [ ] **Realtime Enabled**
  - Go to Supabase Dashboard → Database → Replication
  - Enable replication for `productos` table
  - Verify status shows "Active"

- [ ] **RLS Policies Verified**
  - Check `productos` table has 3 policies (SELECT, INSERT, UPDATE)
  - Check `ventas` table has 2 policies (SELECT, INSERT)
  - All policies should allow public access (for development)

---

## 🔄 Realtime Synchronization Tests

### Test 1: Stock Update Synchronization
**Scenario:** Two users, one updates stock while other is viewing

- [ ] Open browser A, login as "Jonathan R."
- [ ] Open browser B, login as "Sebastian"
- [ ] In browser A, note stock of a specific product
- [ ] In browser B, make a sale that reduces stock of that product
- [ ] **Expected:** Browser A shows updated stock without refresh
- [ ] **Expected:** Product card animates with pulse effect
- [ ] **Expected:** Stock number and color updates correctly

### Test 2: Out of Stock Display
**Scenario:** Product goes out of stock in real-time

- [ ] Open two browsers with different users
- [ ] Product X has stock of 1
- [ ] User A adds product to cart
- [ ] User B buys last unit of product X
- [ ] **Expected:** User A sees stock change to "Sin stock"
- [ ] **Expected:** Product card becomes semi-transparent
- [ ] **Expected:** Product card becomes unclickable

### Test 3: Stock Validation Before Sale
**Scenario:** Prevent overselling with concurrent purchases

- [ ] Open browser A, login as "Jonathan R."
- [ ] Open browser B, login as "Sebastian"
- [ ] Product has 2 units in stock
- [ ] User A adds 2 units to cart
- [ ] User B adds 1 unit to cart and completes purchase
- [ ] User A tries to complete purchase
- [ ] **Expected:** Error message about insufficient stock
- [ ] **Expected:** Cart updates to available quantity
- [ ] **Expected:** Sale does NOT process

### Test 4: Cart Warning for Low Stock
**Scenario:** Warning when stock drops below cart quantity

- [ ] Add 5 units of product to cart
- [ ] Use Supabase to manually set stock to 3
- [ ] **Expected:** Warning notification appears
- [ ] **Expected:** Cart still shows 5 units
- [ ] **Expected:** Attempting to checkout shows validation error

---

## 💰 Price Management Tests

### Test 5: Access Control
**Scenario:** Only encargados can access price management

- [ ] Login as "Jonathan R." (vendedor)
- [ ] **Expected:** "Administrar Precios" button NOT visible
- [ ] Logout and login as "Admin" (encargado)
- [ ] **Expected:** "Administrar Precios" button IS visible

### Test 6: Price Editing
**Scenario:** Edit multiple prices at once

- [ ] Login as "Admin"
- [ ] Click "Administrar Precios"
- [ ] **Expected:** Modal opens with table of all products
- [ ] **Expected:** Each product has editable price input
- [ ] Change price of 3 different products
- [ ] Click "Guardar Cambios"
- [ ] **Expected:** Confirmation dialog appears
- [ ] Confirm changes
- [ ] **Expected:** Success notification
- [ ] **Expected:** Modal closes
- [ ] **Expected:** Products show new prices in POS

### Test 7: Price Validation
**Scenario:** No changes saves nothing

- [ ] Open "Administrar Precios"
- [ ] Don't change any prices
- [ ] Click "Guardar Cambios"
- [ ] **Expected:** "No hay cambios para guardar" notification
- [ ] **Expected:** No database updates made

### Test 8: Price Table UI
**Scenario:** Verify table functionality

- [ ] Open "Administrar Precios"
- [ ] **Expected:** Table shows product name, brand, category, stock, price
- [ ] **Expected:** Table is scrollable if many products
- [ ] **Expected:** Header stays fixed while scrolling
- [ ] Click on price input
- [ ] **Expected:** Input gets focus border color
- [ ] **Expected:** Existing value is selected
- [ ] Hover over table rows
- [ ] **Expected:** Row background changes

---

## 💾 Persistent Session Tests

### Test 9: Auto-Login on Reload
**Scenario:** Session persists across page reloads

- [ ] Login as any user
- [ ] Note the current view and products loaded
- [ ] Press F5 or click reload
- [ ] **Expected:** No login screen appears
- [ ] **Expected:** Same user is logged in
- [ ] **Expected:** Products load automatically
- [ ] **Expected:** Realtime activates automatically

### Test 10: Session Data Storage
**Scenario:** Verify localStorage structure

- [ ] Login as "Admin"
- [ ] Open DevTools → Application → Local Storage
- [ ] Look for key `sabrofood_user`
- [ ] **Expected:** Value contains username, role, loginDate
- [ ] **Expected:** role is "encargado" for Admin
- [ ] **Expected:** loginDate is ISO timestamp

### Test 11: Logout Clears Session
**Scenario:** Logout properly cleans everything

- [ ] Login as any user
- [ ] Add products to cart
- [ ] Click logout button
- [ ] **Expected:** Confirmation if cart has items
- [ ] Confirm logout
- [ ] **Expected:** Page reloads
- [ ] **Expected:** Login screen appears
- [ ] **Expected:** localStorage is cleared
- [ ] **Expected:** Realtime is disconnected

### Test 12: User Switching
**Scenario:** Change user without full logout

- [ ] Login as "Jonathan R."
- [ ] Add 3 products to cart
- [ ] Click "Cambiar Usuario" button
- [ ] **Expected:** Warning about losing cart
- [ ] Confirm change
- [ ] **Expected:** Login screen appears
- [ ] **Expected:** Cart is cleared
- [ ] Login as different user
- [ ] **Expected:** Empty cart
- [ ] **Expected:** New user session started

---

## 🎨 UI/UX Tests

### Test 13: Realtime Animation
**Scenario:** Visual feedback for updates

- [ ] Have two browsers open
- [ ] Make change in one browser
- [ ] **Expected:** Product card in other browser pulses
- [ ] **Expected:** Animation lasts about 0.5 seconds
- [ ] **Expected:** No animation glitches

### Test 14: User Badge
**Scenario:** User indicator in header

- [ ] Login as any user
- [ ] Look at top-right of POS view
- [ ] **Expected:** User badge shows username
- [ ] **Expected:** Badge has user icon (👤)
- [ ] **Expected:** Badge has primary color background

### Test 15: Modal Responsiveness
**Scenario:** Price management modal on different screens

- [ ] Open "Administrar Precios" on desktop
- [ ] **Expected:** Modal is centered, max-width 900px
- [ ] Resize window to mobile width
- [ ] **Expected:** Modal adapts to screen size
- [ ] **Expected:** Table is scrollable horizontally if needed

### Test 16: Button Visibility
**Scenario:** Role-based button display

- [ ] Login as "Admin"
- [ ] Check sidebar
- [ ] **Expected:** "Asignar Códigos" visible
- [ ] Check POS header
- [ ] **Expected:** "Administrar Precios" visible
- [ ] Logout and login as "Jonathan R."
- [ ] **Expected:** Both buttons hidden

---

## 🔐 Security Tests

### Test 17: RLS Policies
**Scenario:** Verify database-level security

- [ ] Check Supabase policies
- [ ] **Expected:** productos table has RLS enabled
- [ ] **Expected:** ventas table has RLS enabled
- [ ] **Expected:** Public policies allow all operations (development mode)

### Test 18: Client-Side Validation
**Scenario:** Verify stock validation works

- [ ] Disable JavaScript in browser
- [ ] Try to make a purchase
- [ ] **Expected:** System should not allow sale
- [ ] Re-enable JavaScript
- [ ] **Expected:** System works normally

---

## 🚨 Error Handling Tests

### Test 19: Supabase Disconnection
**Scenario:** Graceful degradation when Supabase is down

- [ ] Block Supabase URL in browser
- [ ] Try to make a sale
- [ ] **Expected:** Error notification appears
- [ ] **Expected:** Sale does not process
- [ ] **Expected:** App doesn't crash

### Test 20: Network Interruption
**Scenario:** Handle network issues

- [ ] Login and add products to cart
- [ ] Turn off network
- [ ] Try to complete sale
- [ ] **Expected:** Error message about network
- [ ] Turn network back on
- [ ] Retry sale
- [ ] **Expected:** Sale processes successfully

### Test 21: Invalid Stock Values
**Scenario:** Handle corrupted data

- [ ] Manually set product stock to negative in Supabase
- [ ] View product in POS
- [ ] **Expected:** Shows as "Sin stock"
- [ ] Try to add to cart
- [ ] **Expected:** Error message

### Test 22: Concurrent Price Changes
**Scenario:** Multiple admins editing prices

- [ ] Open "Administrar Precios" in two browsers as Admin
- [ ] Change same product price in both
- [ ] Save in browser A
- [ ] Save in browser B
- [ ] **Expected:** Last save wins
- [ ] **Expected:** Both browsers refresh with final price

---

## 📊 Performance Tests

### Test 23: Large Product List
**Scenario:** Performance with many products

- [ ] Load system with 100+ products
- [ ] Open "Administrar Precios"
- [ ] **Expected:** Table loads within 2 seconds
- [ ] **Expected:** Scrolling is smooth
- [ ] Edit 10 prices and save
- [ ] **Expected:** Updates complete within 5 seconds

### Test 24: Multiple Realtime Updates
**Scenario:** Handle many simultaneous updates

- [ ] Have 3+ browsers open
- [ ] Make multiple sales concurrently
- [ ] **Expected:** All browsers update correctly
- [ ] **Expected:** No race conditions
- [ ] **Expected:** No visual glitches

### Test 25: Long Session
**Scenario:** Session stability over time

- [ ] Login and leave browser open for 1+ hours
- [ ] Make a purchase
- [ ] **Expected:** Realtime still works
- [ ] **Expected:** Session still valid
- [ ] **Expected:** No memory leaks

---

## ✅ Acceptance Criteria Verification

- [ ] ✅ SQL script executes without errors
- [ ] ✅ Realtime synchronizes across multiple users
- [ ] ✅ Stock validation prevents double-selling
- [ ] ✅ Price management only visible to encargados
- [ ] ✅ Price table allows inline editing
- [ ] ✅ Auto-login works on page reload
- [ ] ✅ "Cambiar Usuario" allows re-authentication
- [ ] ✅ Logout cleans localStorage and Realtime
- [ ] ✅ Design maintains warm and friendly style
- [ ] ✅ Uses `codigo_barras` naming consistently

---

## 📝 Test Results

**Date:** __________________  
**Tester:** __________________  
**Environment:** __________________  
**Browser:** __________________  
**Supabase Project:** __________________

### Summary:
- Total Tests: 25
- Passed: _____
- Failed: _____
- Skipped: _____

### Critical Issues Found:
1. _______________________
2. _______________________
3. _______________________

### Notes:
_______________________________________
_______________________________________
_______________________________________

---

**Sign-off:** _____________________ Date: __________
