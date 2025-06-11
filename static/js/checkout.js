document.addEventListener('DOMContentLoaded', () => {
    const loggedInUser = JSON.parse(localStorage.getItem('truffleUser'));
    if (!loggedInUser) {
        alert('Please login to schedule your delivery.');
        window.location.href = 'login.html';
        return;
    }

    const userAddressElement = document.getElementById('user-delivery-address');
    if (userAddressElement && loggedInUser.address) {
        userAddressElement.textContent = loggedInUser.address;
    } else if (userAddressElement) {
        userAddressElement.textContent = 'No address set. Please update in your profile.';
    }

    displayOrderSummary(); // From cart.js, assumed to be loaded via shared script or separate include

    const deliveryDateInput = document.getElementById('delivery-date-input');
    const timeSlotsContainer = document.getElementById('time-slots-container');

    if (deliveryDateInput) {
        let today = new Date();
        // Adjust for timezone to prevent yesterday's date in some cases
        today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
        const todayStr = today.toISOString().split('T')[0];
        deliveryDateInput.setAttribute("min", todayStr);

        deliveryDateInput.addEventListener('change', async function() {
            // Parse date as local, not UTC, by ensuring no Z or timezone offset is implied if not present
            const parts = this.value.split('-');
            const selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
            const dayOfWeek = selectedDate.getDay(); // Sunday = 0, Saturday = 6

            timeSlotsContainer.innerHTML = '';
            if (dayOfWeek !== 6 && dayOfWeek !== 0) {
                timeSlotsContainer.innerHTML = '<p class="text-red-500">Delivery only available on Saturdays and Sundays.</p>';
                return;
            }

            const dayName = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });

            try {
                const response = await fetch('/api/delivery-slots');
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const allSlots = await response.json();
                const availableSlots = allSlots.filter(slot => slot.day_of_week === dayName);

                if (availableSlots.length > 0) {
                    availableSlots.forEach(slot => {
                        const slotLabel = document.createElement('label');
                        slotLabel.className = 'text-sm font-medium leading-normal flex items-center justify-center rounded-xl border border-[#554e3a] px-4 h-11 text-white has-[:checked]:border-[3px] has-[:checked]:px-3.5 has-[:checked]:border-[#f8bc06] relative cursor-pointer m-1';
                        slotLabel.innerHTML = `
                            ${slot.time_slot.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
                            <input type="radio" class="invisible absolute" name="delivery_slot_id" value="${slot.id}" required>`;
                        timeSlotsContainer.appendChild(slotLabel);
                    });
                } else {
                    timeSlotsContainer.innerHTML = '<p class="text-white">No delivery slots available for this day.</p>';
                }
            } catch (error) {
                console.error('Error fetching delivery slots:', error);
                timeSlotsContainer.innerHTML = '<p class="text-red-500">Could not load delivery slots. ' + error.message + '</p>';
            }
        });
    }

    const confirmOrderForm = document.getElementById('confirm-order-form');
    if (confirmOrderForm) {
        confirmOrderForm.addEventListener('submit', handlePlaceOrder);
    }
});

// Assuming getCart, getCartTotal, clearCart are loaded from cart.js
function displayOrderSummary() {
    const cartSummaryContainer = document.getElementById('cart-summary-container');
    if (!cartSummaryContainer || typeof getCart !== 'function') { // Check if cart.js functions are available
        if (cartSummaryContainer) cartSummaryContainer.innerHTML = '<p class="text-red-500">Error: Cart functions not loaded.</p>';
        return;
    }

    const cart = getCart();
    const confirmBtn = document.querySelector('#confirm-order-form button[type="submit"]');

    if (cart.length === 0) {
        cartSummaryContainer.innerHTML = '<p class="text-white">Your cart is empty. Please add items from the catalog.</p>';
        if(confirmBtn) confirmBtn.disabled = true;
        return;
    }

    let summaryHTML = '<ul class="list-disc list-inside text-gray-300">';
    cart.forEach(item => {
        summaryHTML += `<li class="py-1">${item.name.replace(/</g, "&lt;").replace(/>/g, "&gt;")} x ${item.quantity} - €${(item.price * item.quantity).toFixed(2)}</li>`;
    });
    summaryHTML += '</ul>';

    const total = getCartTotal();
    summaryHTML += `<p class="text-white font-bold mt-3 text-lg">Total: €${total.toFixed(2)}</p>`;
    cartSummaryContainer.innerHTML = summaryHTML;
    if(confirmBtn) confirmBtn.disabled = false;
}

async function handlePlaceOrder(event) {
    event.preventDefault();
    const errorMessageElement = document.getElementById('checkout-error-message');
    if (!errorMessageElement) { console.error("Error message element not found"); return; }
    errorMessageElement.textContent = '';

    if (typeof getCart !== 'function' || typeof clearCart !== 'function') {
        errorMessageElement.textContent = 'Cart functions not available. Please refresh.';
        return;
    }
    const cart = getCart();
    if (cart.length === 0) {
        errorMessageElement.textContent = 'Your cart is empty.';
        return;
    }

    const deliveryDateInput = document.getElementById('delivery-date-input');
    const selectedSlotRadio = document.querySelector('input[name="delivery_slot_id"]:checked');
    const deliveryNotesInput = document.getElementById('delivery-notes');

    if (!deliveryDateInput || !deliveryDateInput.value) {
        errorMessageElement.textContent = 'Please select a delivery date.';
        return;
    }
    if (!selectedSlotRadio) {
        errorMessageElement.textContent = 'Please select a delivery time slot.';
        return;
    }
    const deliverySlotId = selectedSlotRadio.value;
    const deliveryDate = deliveryDateInput.value;
    const deliveryNotes = deliveryNotesInput ? deliveryNotesInput.value : "";


    const orderData = {
        cart_items: cart.map(item => ({ product_id: item.id, quantity: item.quantity })),
        delivery_date: deliveryDate,
        delivery_slot_id: parseInt(deliverySlotId),
        delivery_notes: deliveryNotes
    };

    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData),
        });

        const result = await response.json();
        if (response.ok) {
            clearCart();
            localStorage.setItem('lastOrderDetails', JSON.stringify(result.order));
            window.location.href = 'order-confirmation.html';
        } else {
            errorMessageElement.textContent = result.message || 'Failed to place order.';
        }
    } catch (error) {
        console.error('Error placing order:', error);
        errorMessageElement.textContent = 'An error occurred while placing your order: ' + error.message;
    }
}
