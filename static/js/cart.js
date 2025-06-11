// --- Cart Management ---
const CART_KEY = 'truffleCart';

function getCart() {
    const cart = localStorage.getItem(CART_KEY);
    return cart ? JSON.parse(cart) : [];
}

function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartIcon(); // Update icon whenever cart is saved
    // Dispatch a custom event that cart.html can listen to
    document.dispatchEvent(new CustomEvent('cartUpdated'));
}

function addToCart(productId, productName, productPrice) {
    const cart = getCart();
    const existingItemIndex = cart.findIndex(item => item.id === productId);

    if (existingItemIndex > -1) {
        cart[existingItemIndex].quantity += 1;
    } else {
        cart.push({ id: productId, name: productName, price: parseFloat(productPrice), quantity: 1 });
    }
    saveCart(cart);
    alert(productName + " added to cart!"); // Simple feedback
}

function updateCartQuantity(productId, quantity) {
    let cart = getCart();
    const itemIndex = cart.findIndex(item => item.id === productId);

    if (itemIndex > -1) {
        if (quantity > 0) {
            cart[itemIndex].quantity = quantity;
        } else {
            cart = cart.filter(item => item.id !== productId); // Remove item if quantity is 0 or less
        }
        saveCart(cart);
    }
}

function removeFromCart(productId) {
    let cart = getCart();
    cart = cart.filter(item => item.id !== productId);
    saveCart(cart);
}

function getCartTotal() {
    const cart = getCart();
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

function clearCart() {
    localStorage.removeItem(CART_KEY);
    saveCart([]); // Save an empty cart to trigger updates
}

// --- UI Updates ---
function updateCartIcon() {
    const cart = getCart();
    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartButtonTextElement = document.getElementById('nav-cart-button-text');
    if (cartButtonTextElement) {
        cartButtonTextElement.textContent = `Cart (${itemCount})`;
    }
}

// --- Product Loading for catalog.html ---
async function loadProducts() {
    const productsContainer = document.getElementById('products-container');
    if (!productsContainer) return;

    try {
        const response = await fetch('/api/products');
        if (!response.ok) throw new Error('Failed to fetch products');
        const products = await response.json();

        productsContainer.innerHTML = ''; // Clear existing products (e.g., static ones)
        products.forEach(product => {
            const productDiv = document.createElement('div');
            productDiv.className = 'flex flex-col gap-3 pb-3'; // Tailwind classes from original catalog
            productDiv.innerHTML = `
                <div class="w-full bg-center bg-no-repeat aspect-square bg-cover rounded-xl" style="background-image: url('${product.image_url || 'https://via.placeholder.com/150'}');"></div>
                <div>
                    <p class="text-white text-base font-medium leading-normal">${product.name}</p>
                    <p class="text-[#beb89d] text-sm font-normal leading-normal">€${product.price.toFixed(2)}</p>
                </div>
                <button
                    class="mt-auto flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 px-4 bg-[#f3efdc] text-[#1f1d14] text-sm font-bold"
                    onclick="addToCart(${product.id}, '${product.name.replace(/'/g, "\\'")}', ${product.price})">
                    Add to Cart
                </button>
            `;
            productsContainer.appendChild(productDiv);
        });
    } catch (error) {
        console.error('Error loading products:', error);
        productsContainer.innerHTML = '<p class="text-red-500">Could not load products.</p>';
    }
}

// --- Cart Display for cart.html ---
function displayCartItems() {
    const cartItemsContainer = document.getElementById('cart-items-container');
    const cartSummaryTotal = document.getElementById('cart-summary-total'); // For a potential separate total display
    const cartSubtotalElement = document.getElementById('cart-subtotal');
    const cartTotalElement = document.getElementById('cart-total');


    if (!cartItemsContainer) return;

    const cart = getCart();
    cartItemsContainer.innerHTML = ''; // Clear existing items

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<tr><td colspan="6" class="text-center text-white py-4">Your cart is empty.</td></tr>'; // colspan updated to 6
        if (cartSummaryTotal) cartSummaryTotal.textContent = '€0.00';
        if (cartSubtotalElement) cartSubtotalElement.textContent = '€0.00';
        if (cartTotalElement) cartTotalElement.textContent = '€0.00';
        return;
    }

    cart.forEach(item => {
        const itemRow = document.createElement('tr');
        itemRow.className = 'border-t border-t-[#5c573d]';
        // Fetch product image from local storage if not available in cart item, or use placeholder
        const productDetails = JSON.parse(localStorage.getItem('truffleProducts'))?.find(p => p.id === item.id);
        const imageUrl = item.image_url || productDetails?.image_url || 'https://via.placeholder.com/40';


        itemRow.innerHTML = `
            <td class="h-[72px] px-4 py-2 w-14">
                 <div class="bg-center bg-no-repeat aspect-square bg-cover rounded-md w-10 h-10" style="background-image: url('${imageUrl}');"></div>
            </td>
            <td class="h-[72px] px-4 py-2 text-white text-sm">${item.name}</td>
            <td class="h-[72px] px-4 py-2 text-white text-sm">
                <input type="number" value="${item.quantity}" min="1" class="form-input bg-[#2e2b1f] text-white w-16 text-center rounded" onchange="updateCartQuantity(${item.id}, parseInt(this.value))">
            </td>
            <td class="h-[72px] px-4 py-2 text-[#beb89d] text-sm">€${item.price.toFixed(2)}</td>
            <td class="h-[72px] px-4 py-2 text-[#beb89d] text-sm">€${(item.price * item.quantity).toFixed(2)}</td>
            <td class="h-[72px] px-4 py-2 text-center">
                <button class="text-red-500 hover:text-red-700 text-sm" onclick="removeFromCart(${item.id})">Remove</button>
            </td>
        `;
        cartItemsContainer.appendChild(itemRow);
    });

    const total = getCartTotal();
    if (cartSubtotalElement) cartSubtotalElement.textContent = \`€\${total.toFixed(2)}\`;
    if (cartTotalElement) cartTotalElement.textContent = \`€\${total.toFixed(2)}\`; // Assuming shipping is free for now
    if (cartSummaryTotal) cartSummaryTotal.textContent = \`€\${total.toFixed(2)}\`;
}

// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => {
    updateCartIcon();

    if (document.getElementById('products-container')) {
        loadProducts();
    }

    if (document.getElementById('cart-items-container')) {
        displayCartItems();
        document.addEventListener('cartUpdated', displayCartItems);
    }

    const checkoutButton = document.getElementById('proceed-to-checkout-button');
    if(checkoutButton) {
        checkoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            const user = localStorage.getItem('truffleUser');
            if (!user) {
                alert('Please login to proceed to checkout.');
                window.location.href = 'login.html';
            } else {
                window.location.href = 'delivery-book.html';
            }
        });
    }
});
