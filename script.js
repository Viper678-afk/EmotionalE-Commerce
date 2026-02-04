let products = [];
let cart = {}; // { productId: qty }

// Elements
const moodSelect = document.getElementById("moodSelect");
const searchInput = document.getElementById("searchInput");
const productList = document.getElementById("productList");
const productDetails = document.getElementById("productDetails");
const cartDiv = document.getElementById("cart");
const messageDiv = document.getElementById("message");
const cartCount = document.getElementById("cartCount");

const checkoutForm = document.getElementById("checkoutForm");
const orderConfirmation = document.getElementById("orderConfirmation");

// Load CSV (uses YOUR existing filename: Products.CSV)
function loadCSV() {
  fetch("./Products.CSV")
    .then(r => r.text())
    .then(text => {
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
      const headers = lines[0].split(",").map(h => h.trim());

      products = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",");
        if (values.length < headers.length) continue;

        const p = {};
        headers.forEach((h, idx) => {
          p[h] = (values[idx] || "").replace(/"/g, "").trim();
        });

        p.price = Number(p.price);
        p.stock = Number(p.stock);

        // Featured = first 3 items in the CSV (simple MVP rule)
        p.featured = i <= 3;

        // Generate an image without needing extra files or internet
        p.image = makeProductImage(p.name);

        products.push(p);
      }

      populateMoods();
      applyFilters();
      renderCart();
      updateCartCount();
    })
    .catch(() => showMessage("Could not load Products.CSV. Check that the file is in the same folder.", true));
}

// Creates a local SVG image (data URI) so you always have “product images”
function makeProductImage(name) {
  const safe = escapeHTML(name);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="400">
      <rect width="100%" height="100%" fill="#e9eefc"/>
      <rect x="30" y="30" width="540" height="340" rx="24" fill="#ffffff" stroke="#cfd6f6"/>
      <text x="300" y="210" font-family="Arial" font-size="34" text-anchor="middle" fill="#111">
        ${safe}
      </text>
      <text x="300" y="260" font-family="Arial" font-size="18" text-anchor="middle" fill="#555">
        Product Image (MVP)
      </text>
    </svg>
  `.trim();

  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

function populateMoods() {
  moodSelect.innerHTML = `<option value="All">All</option>`;
  const moods = [...new Set(products.map(p => p.category))];
  moods.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    moodSelect.appendChild(opt);
  });
}

function applyFilters() {
  const mood = moodSelect.value || "All";
  const q = (searchInput.value || "").toLowerCase().trim();

  let list = [...products];

  if (mood !== "All") list = list.filter(p => p.category === mood);
  if (q) list = list.filter(p => p.name.toLowerCase().includes(q));

  // Featured first
  list.sort((a, b) => Number(b.featured) - Number(a.featured));

  showProducts(list);
}

function showProducts(list) {
  productList.innerHTML = "";

  if (list.length === 0) {
    productList.innerHTML = `<p>No products match your search.</p>`;
    return;
  }

  list.forEach(p => {
    const card = document.createElement("div");
    card.className = "card";
    card.onclick = () => showDetails(p.id);

    const stockText = p.stock > 0 ? "In Stock" : "Out of Stock";
    const stockClass = p.stock > 0 ? "in" : "out";
    const badge = p.featured ? `<span class="tag">Featured</span>` : `<span class="tag">${escapeHTML(p.category)}</span>`;

    card.innerHTML = `
      <img src="${p.image}" alt="${escapeHTML(p.name)}" />
      <div class="row">
        <b>${escapeHTML(p.name)}</b>
        ${badge}
      </div>
      <div class="row">
        <span>$${p.price.toFixed(2)}</span>
        <span class="${stockClass}">${stockText}</span>
      </div>
    `;

    productList.appendChild(card);
  });
}

function showDetails(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;

  const disabled = p.stock === 0 ? "disabled" : "";

  productDetails.innerHTML = `
    <img src="${p.image}" alt="${escapeHTML(p.name)}" />
    <h3>${escapeHTML(p.name)}</h3>
    <p><b>Category:</b> ${escapeHTML(p.category)}</p>
    <p>${escapeHTML(p.description)}</p>
    <p><b>Price:</b> $${p.price.toFixed(2)}</p>
    <p><b>Stock:</b> ${p.stock}</p>
    <button ${disabled} onclick="addToCart('${p.id}')">Add to Cart</button>
  `;
}

function addToCart(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;

  const currentQty = cart[id] || 0;

  // Prevent out-of-stock and exceeding stock
  if (p.stock === 0) {
    showMessage("This item is out of stock.", true);
    return;
  }
  if (currentQty >= p.stock) {
    showMessage(`Cannot add more. Only ${p.stock} in stock.`, true);
    return;
  }

  cart[id] = currentQty + 1;
  showMessage(`${p.name} added to cart.`, false);
  renderCart();
  updateCartCount();
}

function incrementItem(id) {
  addToCart(id);
}

function decrementItem(id) {
  if (!cart[id]) return;
  cart[id] -= 1;
  if (cart[id] <= 0) delete cart[id];
  showMessage("Item quantity updated.", false);
  renderCart();
  updateCartCount();
}

function removeItem(id) {
  if (!cart[id]) return;
  delete cart[id];
  showMessage("Item removed from cart.", false);
  renderCart();
  updateCartCount();
}

function renderCart() {
  const ids = Object.keys(cart);

  if (ids.length === 0) {
    cartDiv.innerHTML = "Cart is empty.";
    orderConfirmation.innerHTML = "";
    return;
  }

  let subtotal = 0;

  let html = `
    <table class="cartTable">
      <tr>
        <th>Item</th>
        <th>Price</th>
        <th>Qty</th>
        <th>Total</th>
        <th>Actions</th>
      </tr>
  `;

  ids.forEach(id => {
    const p = products.find(x => x.id === id);
    if (!p) return;

    const qty = cart[id];
    const lineTotal = p.price * qty;
    subtotal += lineTotal;

    html += `
      <tr>
        <td>${escapeHTML(p.name)}</td>
        <td>$${p.price.toFixed(2)}</td>
        <td>${qty}</td>
        <td>$${lineTotal.toFixed(2)}</td>
        <td class="cartActions">
          <button onclick="incrementItem('${id}')">+</button>
          <button onclick="decrementItem('${id}')">−</button>
          <button onclick="removeItem('${id}')">Remove</button>
        </td>
      </tr>
    `;
  });

  html += `
    </table>
    <p><b>Subtotal:</b> $${subtotal.toFixed(2)}</p>
  `;

  cartDiv.innerHTML = html;
}

function updateCartCount() {
  const totalItems = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  cartCount.textContent = `Cart (${totalItems})`;
}

function showMessage(msg, isError) {
  messageDiv.textContent = msg;
  messageDiv.className = "message " + (isError ? "error" : "success");

  setTimeout(() => {
    messageDiv.textContent = "";
    messageDiv.className = "message";
  }, 2500);
}

function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Controls
document.getElementById("searchButton").onclick = () => {
  applyFilters();
};

document.getElementById("resetButton").onclick = () => {
  searchInput.value = "";
  moodSelect.value = "All";
  applyFilters();
};

moodSelect.onchange = () => applyFilters();

// Checkout (simple required fields + confirmation = MVP “secure checkout”)
checkoutForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const name = document.getElementById("fullName").value.trim();
  const email = document.getElementById("email").value.trim();
  const address = document.getElementById("address").value.trim();

  if (!name || !email || !address) {
    showMessage("Please fill out all checkout fields.", true);
    return;
  }
  if (Object.keys(cart).length === 0) {
    showMessage("Your cart is empty.", true);
    return;
  }

  orderConfirmation.innerHTML = `
    <b>Order confirmed!</b>
    <p>Thanks, ${escapeHTML(name)}. A confirmation will be sent to ${escapeHTML(email)}.</p>
    <p><b>Shipping to:</b> ${escapeHTML(address)}</p>
    <p>Your order was placed successfully (MVP checkout).</p>
  `;

  // Clear cart after checkout
  cart = {};
  renderCart();
  updateCartCount();
  checkoutForm.reset();
  showMessage("Checkout complete.", false);
});

// Start
loadCSV();
