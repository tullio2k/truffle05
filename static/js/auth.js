document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }

    // Initial check for user session to update UI
    checkUserSessionAndUpdateUI();
});

async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessageElement = document.getElementById('login-error-message');
    errorMessageElement.textContent = ''; // Clear previous errors

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('truffleUser', JSON.stringify(data.user)); // Store user info
            window.location.href = 'home.html'; // Redirect to home
        } else {
            errorMessageElement.textContent = data.message || 'Login failed.';
        }
    } catch (error) {
        console.error('Login error:', error);
        errorMessageElement.textContent = 'An error occurred during login.';
    }
}

async function handleRegister(event) {
    event.preventDefault();
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const address = document.getElementById('address').value;
    const errorMessageElement = document.getElementById('register-error-message');
    errorMessageElement.textContent = ''; // Clear previous errors

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, address }),
        });
        const data = await response.json();
        if (response.ok) {
            // Optionally display a success message before redirecting
            alert('Registration successful! Please login.');
            window.location.href = 'login.html'; // Redirect to login
        } else {
            errorMessageElement.textContent = data.message || 'Registration failed.';
        }
    } catch (error) {
        console.error('Registration error:', error);
        errorMessageElement.textContent = 'An error occurred during registration.';
    }
}

async function handleLogout() {
    const errorMessageElement = document.getElementById('logout-error-message'); // Assuming one might exist
    if(errorMessageElement) errorMessageElement.textContent = '';

    try {
        const response = await fetch('/api/logout', { method: 'POST' });
        const data = await response.json();
        if (response.ok) {
            localStorage.removeItem('truffleUser');
            checkUserSessionAndUpdateUI(); // Update UI immediately
            // Optional: redirect to home or login page
            if (window.location.pathname !== '/home.html' && window.location.pathname !== '/') {
                 // window.location.href = 'home.html';
            }
        } else {
            if(errorMessageElement) errorMessageElement.textContent = data.message || 'Logout failed.';
            else alert(data.message || 'Logout failed.');
        }
    } catch (error) {
        console.error('Logout error:', error);
        if(errorMessageElement) errorMessageElement.textContent = 'An error occurred during logout.';
        else alert('An error occurred during logout.');
    }
}

async function checkUserSessionAndUpdateUI() {
    const navLogin = document.getElementById('nav-login');
    const navRegister = document.getElementById('nav-register');
    const navLogout = document.getElementById('nav-logout');
    const navUserAccount = document.getElementById('nav-user-account'); // e.g., a "My Account" link
    const navCartText = document.getElementById('nav-cart-text'); // For cart button text
    const navUserName = document.getElementById('nav-user-name'); // For displaying user's name

    // Default to logged-out state
    if (navLogin) navLogin.style.display = 'inline-flex'; // Or 'block', 'flex' etc.
    if (navRegister) navRegister.style.display = 'inline-flex';
    if (navLogout) navLogout.style.display = 'none';
    if (navUserAccount) navUserAccount.style.display = 'none';
    if (navUserName) navUserName.style.display = 'none';


    try {
        const response = await fetch('/api/check_session');
        const data = await response.json();

        if (data.logged_in && data.user) {
            if (navLogin) navLogin.style.display = 'none';
            if (navRegister) navRegister.style.display = 'none';
            if (navLogout) {
                navLogout.style.display = 'inline-flex';
                // Ensure logout handler is attached if it wasn't already or if element was hidden
                const logoutButton = navLogout.querySelector('button') || navLogout; // if navLogout is the button itself
                logoutButton.removeEventListener('click', handleLogout); // remove if already exists
                logoutButton.addEventListener('click', handleLogout);
            }
            if (navUserAccount) navUserAccount.style.display = 'inline-flex';
            if (navUserName) {
                navUserName.textContent = data.user.name;
                navUserName.style.display = 'inline-flex';
            }

            // Redirect from login/register pages if already logged in
            if (window.location.pathname.endsWith('login.html') || window.location.pathname.endsWith('register.html')) {
                window.location.href = 'home.html';
            }

        } else {
            localStorage.removeItem('truffleUser'); // Ensure local storage is clean if session says logged out
            // UI is already set to logged-out by default above
        }
    } catch (error) {
        console.error('Error checking session:', error);
        // Keep UI in logged-out state on error
        localStorage.removeItem('truffleUser');
    }
}
