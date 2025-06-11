document.addEventListener('DOMContentLoaded', () => {
    const loggedInUser = JSON.parse(localStorage.getItem('truffleUser'));
    if (!loggedInUser) {
        alert('Please login to view your profile and order history.');
        window.location.href = 'login.html';
        return;
    }

    // Populate User Details
    const userNameElement = document.getElementById('user-name');
    const userEmailElement = document.getElementById('user-email');
    const userAddressDisplayElement = document.getElementById('user-address-display');
    const userAddressInputElement = document.getElementById('user-address-input');

    if (userNameElement) userNameElement.textContent = loggedInUser.name || 'N/A';
    if (userEmailElement) userEmailElement.textContent = loggedInUser.email || 'N/A';
    if (userAddressDisplayElement) userAddressDisplayElement.textContent = loggedInUser.address || 'Not set';
    if (userAddressInputElement) userAddressInputElement.value = loggedInUser.address || '';

    // Handle Address Update
    const updateAddressForm = document.getElementById('update-address-form');
    if (updateAddressForm) {
        updateAddressForm.addEventListener('submit', handleUpdateAddress);
    }

    // Load Order History
    loadOrderHistory();

    // Check for #orders hash and scroll if present
    if(window.location.hash === "#orders") {
        const ordersSection = document.getElementById('order-history-section');
        if(ordersSection) {
            ordersSection.scrollIntoView({ behavior: 'smooth' });
        }
    }
});

async function handleUpdateAddress(event) {
    event.preventDefault();
    const newAddress = document.getElementById('user-address-input').value;
    const messageElement = document.getElementById('address-update-message');
    messageElement.textContent = '';

    try {
        const response = await fetch('/api/user/address', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: newAddress }),
        });
        const data = await response.json();
        if (response.ok) {
            messageElement.textContent = 'Address updated successfully!';
            messageElement.className = 'text-green-500 text-sm mt-2';

            // Update displayed address and localStorage
            const userAddressDisplayElement = document.getElementById('user-address-display');
            if (userAddressDisplayElement) userAddressDisplayElement.textContent = newAddress;

            const loggedInUser = JSON.parse(localStorage.getItem('truffleUser'));
            if (loggedInUser) {
                loggedInUser.address = newAddress;
                localStorage.setItem('truffleUser', JSON.stringify(loggedInUser));
            }
        } else {
            messageElement.textContent = data.message || 'Failed to update address.';
            messageElement.className = 'text-red-500 text-sm mt-2';
        }
    } catch (error) {
        console.error('Error updating address:', error);
        messageElement.textContent = 'An error occurred.';
        messageElement.className = 'text-red-500 text-sm mt-2';
    }
}

async function loadOrderHistory() {
    const orderHistoryContainer = document.getElementById('order-history-container');
    if (!orderHistoryContainer) return;

    orderHistoryContainer.innerHTML = '<p class="text-gray-400">Loading order history...</p>';

    try {
        const response = await fetch('/api/orders/history');
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        const orders = await response.json();

        if (orders.length === 0) {
            orderHistoryContainer.innerHTML = '<p class="text-gray-300">You have no past orders.</p>';
            return;
        }

        let ordersHTML = '<div class="space-y-6">';
        orders.forEach(order => {
            ordersHTML += `
                <div class="bg-[#2e2b1f] p-4 md:p-6 rounded-lg shadow-md">
                    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3">
                        <h3 class="text-xl font-semibold text-yellow-400">Order #${order.id}</h3>
                        <span class="text-sm text-gray-400 mt-1 sm:mt-0">Placed on: ${new Date(order.created_at).toLocaleDateString()}</span>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-300 mb-3">
                        <p><strong>Delivery Date:</strong> ${order.delivery_date}</p>
                        <p><strong>Delivery Slot:</strong> ${order.delivery_slot_description}</p>
                        <p><strong>Total Amount:</strong> €${order.total_amount.toFixed(2)}</p>
                        <p><strong>Status:</strong> <span class="font-medium ${order.status === 'Pending' ? 'text-orange-400' : 'text-green-400'}">${order.status}</span></p>
                    </div>
                    ${order.delivery_notes ? `<p class="text-sm text-gray-400 mb-3"><strong>Notes:</strong> ${escapeHtml(order.delivery_notes)}</p>` : ''}
                    <h4 class="text-md font-semibold text-gray-200 mb-1">Items:</h4>
                    <ul class="list-disc list-inside pl-5 space-y-1 text-sm text-gray-400">
                        ${order.items.map(item => `<li>${escapeHtml(item.product_name)} x ${item.quantity} (Price: €${item.price.toFixed(2)} each)</li>`).join('')}
                    </ul>
                </div>
            `;
        });
        ordersHTML += '</div>';
        orderHistoryContainer.innerHTML = ordersHTML;

    } catch (error) {
        console.error('Error loading order history:', error);
        orderHistoryContainer.innerHTML = `<p class="text-red-500">Could not load order history: ${error.message}</p>`;
    }
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}
