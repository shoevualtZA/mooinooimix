let currentUser = null;
let currentCategory = 'all';
let locationMap = null;
let locationMarker = null;
let selectedLocation = null;
let businessLocationMap = null;
let businessLocationMarker = null;
let businessSelectedLocation = null;
let locationMainMap = null;
let productMarkers = [];
let businessMarkers = [];

// Simple notification system
function showNotification(message, type = 'info') {
    // For now, use alert - can be enhanced later
    alert(message);
}

// Check if user is already logged in
function checkAuth() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showMarketplace();
        loadProducts();
    } else {
        showAuth();
    }
}

// Initialize app
checkAuth();

// Image upload preview and location checkbox listener
document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('product-images');
    if (imageInput) {
        imageInput.addEventListener('change', handleImagePreview);
    }
    
    const logoInput = document.getElementById('business-logo');
    if (logoInput) {
        logoInput.addEventListener('change', handleLogoPreview);
    }
    
    const locationCheckbox = document.getElementById('add-location-checkbox');
    if (locationCheckbox) {
        locationCheckbox.addEventListener('change', handleLocationCheckboxChange);
    }
});

function handleImagePreview(event) {
    const files = event.target.files;
    const preview = document.getElementById('image-preview');
    preview.innerHTML = '';
    
    if (files.length > 3) {
        alert('Maximum 3 images allowed');
        event.target.value = '';
        return;
    }
    
    // Check file sizes (10MB limit per image)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    for (let file of files) {
        if (file.size > maxSize) {
            alert(`Image "${file.name}" is too large. Maximum size is 10MB per image.`);
            event.target.value = '';
            return;
        }
    }
    
    Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.className = 'preview-image';
                preview.appendChild(img);
            };
            reader.readAsDataURL(file);
        }
    });
}

function handleLogoPreview(event) {
    const file = event.target.files[0];
    const preview = document.getElementById('logo-preview');
    preview.innerHTML = '';
    
    if (!file) return;
    
    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        alert('Logo is too large. Maximum size is 10MB.');
        event.target.value = '';
        return;
    }
    
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.className = 'preview-image';
            preview.appendChild(img);
        };
        reader.readAsDataURL(file);
    }
}

function handleCategorySelection() {
    const category = document.getElementById('product-category').value;
    const standardFields = document.getElementById('standard-fields');
    const businessFields = document.getElementById('business-fields');
    const nameLabel = document.querySelector('label[for="product-name"]') || document.querySelector('input#product-name').previousElementSibling;
    const descLabel = document.querySelector('label[for="product-description"]') || document.querySelector('textarea#product-description').previousElementSibling;
    const priceLabel = document.querySelector('label[for="product-price"]') || document.querySelector('input#product-price').previousElementSibling;
    
    if (category === 'business') {
        standardFields.style.display = 'none';
        businessFields.style.display = 'block';
        if (nameLabel) nameLabel.textContent = 'Business Name';
        if (descLabel) descLabel.textContent = 'Business Description';
        if (priceLabel) priceLabel.textContent = 'Starting Price / Service Cost';
        
        // Initialize business location map
        setTimeout(() => {
            if (!businessLocationMap) {
                initBusinessLocationMap();
            }
        }, 100);
    } else {
        standardFields.style.display = 'block';
        businessFields.style.display = 'none';
        if (nameLabel) nameLabel.textContent = 'Product Name';
        if (descLabel) descLabel.textContent = 'Description';
        if (priceLabel) priceLabel.textContent = 'Price';
    }
}

// Auth Functions
function showAuth() {
    document.getElementById('auth-view').style.display = 'flex';
    document.getElementById('marketplace-view').style.display = 'none';
}

function showMarketplace() {
    document.getElementById('auth-view').style.display = 'none';
    document.getElementById('marketplace-view').style.display = 'flex';
    if (currentUser) {
        document.getElementById('current-user').textContent = currentUser.username;
    }
}

function showLogin() {
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('signup-form').style.display = 'none';
}

function showSignup() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('signup-form').style.display = 'block';
}

async function signup() {
    const username = document.getElementById('signup-username').value.trim();
    const password = document.getElementById('signup-password').value;

    if (!username || !password) {
        alert('Please fill in all fields');
        return;
    }

    if (password.length < 6) {
        alert('Password must be at least 6 characters');
        return;
    }

    // Check if username already exists
    try {
        const usersRef = firebase.database().ref('users/' + username);
        const snapshot = await usersRef.once('value');
        
        if (snapshot.exists()) {
            alert('Username already taken. Please choose another one.');
            return;
        }

        // Create new user in database
        const userId = Date.now().toString();
        await usersRef.set({
            username: username,
            password: btoa(password), // Simple encoding (in production, use proper hashing)
            userId: userId,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });

        // Log user in
        currentUser = {
            username: username,
            userId: userId
        };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        // Check if user came from buyer page to leave a review
        const pendingSeller = localStorage.getItem('pendingSeller');
        if (pendingSeller) {
            // Redirect back to buyer page
            window.location.href = 'index.html';
            return;
        }
        
        clearAuthForms();
        showMarketplace();
        loadProducts();
        
    } catch (error) {
        console.error('Signup error:', error);
        alert('Error creating account: ' + error.message);
    }
}

async function login() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!username || !password) {
        alert('Please fill in all fields');
        return;
    }

    try {
        const usersRef = firebase.database().ref('users/' + username);
        const snapshot = await usersRef.once('value');
        
        if (!snapshot.exists()) {
            alert('Invalid username or password');
            return;
        }

        const userData = snapshot.val();
        
        // Check if user is banned
        if (userData.banned === true) {
            alert('Your account has been banned. Please contact support.');
            return;
        }
        
        // Check password
        if (atob(userData.password) !== password) {
            alert('Invalid username or password');
            return;
        }

        // Log user in
        currentUser = {
            username: userData.username,
            userId: userData.userId
        };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        // Check if user came from buyer page to leave a review
        const pendingSeller = localStorage.getItem('pendingSeller');
        if (pendingSeller) {
            // Redirect back to buyer page
            window.location.href = 'index.html';
            return;
        }
        
        clearAuthForms();
        showMarketplace();
        loadProducts();
        
    } catch (error) {
        console.error('Login error:', error);
        alert('Error logging in: ' + error.message);
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    showAuth();
}

function clearAuthForms() {
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('signup-username').value = '';
    document.getElementById('signup-password').value = '';
}

// Product Functions
function showAddProduct() {
    document.getElementById('add-product-modal').classList.add('active');
    
    // If in business category, automatically switch to business mode
    if (currentCategory === 'business') {
        document.getElementById('product-category').value = 'business';
        handleCategorySelection();
    }
}

function closeAddProduct() {
    document.getElementById('add-product-modal').classList.remove('active');
    clearProductForm();
    if (locationMap) {
        locationMap.remove();
        locationMap = null;
        locationMarker = null;
        selectedLocation = null;
    }
    if (businessLocationMap) {
        businessLocationMap.remove();
        businessLocationMap = null;
        businessLocationMarker = null;
        businessSelectedLocation = null;
    }
}

function handleLocationCheckboxChange() {
    const checkbox = document.getElementById('add-location-checkbox');
    const mapGroup = document.getElementById('location-map-group');
    
    if (checkbox.checked) {
        mapGroup.style.display = 'block';
        // Initialize map after a short delay to ensure the container is visible
        setTimeout(() => {
            if (!locationMap) {
                initLocationMap();
            }
        }, 100);
    } else {
        mapGroup.style.display = 'none';
        selectedLocation = null;
        document.getElementById('selected-location').innerHTML = '';
    }
}

function initLocationMap() {
    if (locationMap) return;
    
    // Initialize map centered on a default location (you can change this)
    locationMap = L.map('location-map').setView([0, 0], 2);
    
    // Add base layers
    const streetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Made and ran by networKING technologies',
        maxZoom: 19
    });
    
    const satelliteMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Made and ran by networKING technologies',
        maxZoom: 19
    });
    
    // Add default layer
    streetMap.addTo(locationMap);
    
    // Add layer control
    const baseMaps = {
        "Street Map": streetMap,
        "Satellite": satelliteMap
    };
    L.control.layers(baseMaps).addTo(locationMap);
    
    // Add mobile fullscreen functionality
    addMapFullscreenHandler('location-map', locationMap);
    
    // Try to get user's current location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                locationMap.setView([lat, lng], 13);
            },
            (error) => {
                console.log('Geolocation error:', error);
                // Default to a central location if geolocation fails
                locationMap.setView([0, 0], 2);
            }
        );
    }
    
    // Add click event to set location
    locationMap.on('click', (e) => {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        
        // Remove existing marker if any
        if (locationMarker) {
            locationMap.removeLayer(locationMarker);
        }
        
        // Add new marker
        locationMarker = L.marker([lat, lng]).addTo(locationMap);
        
        // Save selected location
        selectedLocation = {
            lat: lat,
            lng: lng
        };
        
        // Update display
        document.getElementById('selected-location').innerHTML = 
            `<strong>Selected:</strong> ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    });
}

function initBusinessLocationMap() {
    if (businessLocationMap) return;
    
    // Initialize map centered on a default location
    businessLocationMap = L.map('business-location-map').setView([0, 0], 2);
    
    // Add base layers
    const streetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Made and ran by networKING technologies',
        maxZoom: 19
    });
    
    const satelliteMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Made and ran by networKING technologies',
        maxZoom: 19
    });
    
    // Add default layer
    streetMap.addTo(businessLocationMap);
    
    // Add layer control
    const baseMaps = {
        "Street Map": streetMap,
        "Satellite": satelliteMap
    };
    L.control.layers(baseMaps).addTo(businessLocationMap);
    
    // Add mobile fullscreen functionality
    addMapFullscreenHandler('business-location-map', businessLocationMap);
    
    // Try to get user's current location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                businessLocationMap.setView([lat, lng], 13);
            },
            (error) => {
                console.log('Geolocation error:', error);
                businessLocationMap.setView([0, 0], 2);
            }
        );
    }
    
    // Add click event to set location
    businessLocationMap.on('click', (e) => {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        
        // Remove existing marker if any
        if (businessLocationMarker) {
            businessLocationMap.removeLayer(businessLocationMarker);
        }
        
        // Add new marker
        businessLocationMarker = L.marker([lat, lng]).addTo(businessLocationMap);
        
        // Save selected location
        businessSelectedLocation = {
            lat: lat,
            lng: lng
        };
        
        // Update display
        document.getElementById('business-selected-location').innerHTML = 
            `<strong>Selected:</strong> ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    });
}

// Initialize main location map with all products and businesses
function initLocationMainMap() {
    if (locationMainMap) {
        locationMainMap.remove();
    }
    
    locationMainMap = L.map('location-main-map').setView([0, 0], 2);
    
    // Add base layers
    const streetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Made and ran by networKING technologies',
        maxZoom: 19
    });
    
    const satelliteMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Made and ran by networKING technologies',
        maxZoom: 19
    });
    
    streetMap.addTo(locationMainMap);
    
    const baseMaps = {
        "Street Map": streetMap,
        "Satellite": satelliteMap
    };
    L.control.layers(baseMaps).addTo(locationMainMap);
    
    // Try to get user's location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                locationMainMap.setView([position.coords.latitude, position.coords.longitude], 12);
                loadMapMarkers();
            },
            (error) => {
                console.log('Geolocation error:', error);
                locationMainMap.setView([0, 0], 2);
                loadMapMarkers();
            }
        );
    } else {
        loadMapMarkers();
    }
    
    // Add filter event listeners
    document.getElementById('show-products').addEventListener('change', updateMapMarkers);
    document.getElementById('show-businesses').addEventListener('change', updateMapMarkers);
}

// Load all markers on the map
function loadMapMarkers() {
    // Clear existing markers
    productMarkers.forEach(marker => locationMainMap.removeLayer(marker));
    businessMarkers.forEach(marker => locationMainMap.removeLayer(marker));
    productMarkers = [];
    businessMarkers = [];
    
    const currentUser = localStorage.getItem('currentUser');
    
    // Load products with locations
    firebase.database().ref('products').once('value', (snapshot) => {
        snapshot.forEach((childSnapshot) => {
            const product = { id: childSnapshot.key, ...childSnapshot.val() };
            
            // Skip banned users
            firebase.database().ref('users/' + product.seller + '/banned').once('value', (banSnapshot) => {
                if (banSnapshot.val() === true) return;
                
                if (product.location && product.location.lat && product.location.lng) {
                    // Create custom icon for products
                    const productIcon = L.divIcon({
                        className: 'custom-marker',
                        html: `<div style="background: #4facfe; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); font-size: 20px;">🛍️</div>`,
                        iconSize: [40, 40]
                    });
                    
                    const marker = L.marker([product.location.lat, product.location.lng], { icon: productIcon });
                    
                    // Create popup content
                    const imageUrl = product.images && product.images.length > 0 ? product.images[0] : '';
                    const imageHtml = imageUrl ? `<img src="${escapeHtml(imageUrl)}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px; margin-bottom: 10px;">` : '';
                    
                    marker.bindPopup(`
                        <div style="width: 200px;">
                            ${imageHtml}
                            <h4 style="margin: 0 0 8px 0; font-size: 16px;">${escapeHtml(product.name)}</h4>
                            <p style="margin: 0 0 8px 0; font-size: 13px; color: #666; max-height: 60px; overflow: hidden;">${escapeHtml(product.description).substring(0, 100)}...</p>
                            <div style="margin-bottom: 10px;">
                                <strong style="color: #00bfa5; font-size: 18px;">$${product.price.toFixed(2)}</strong>
                            </div>
                            <button onclick="showProductDetailById('${product.id}')" 
                                style="width: 100%; padding: 8px; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                                View Details
                            </button>
                        </div>
                    `);
                    
                    marker.addTo(locationMainMap);
                    productMarkers.push(marker);
                }
            });
        });
    });
    
    // Load businesses with locations
    firebase.database().ref('businesses').once('value', (snapshot) => {
        snapshot.forEach((childSnapshot) => {
            const business = { id: childSnapshot.key, ...childSnapshot.val() };
            
            // Skip banned users
            firebase.database().ref('users/' + business.seller + '/banned').once('value', (banSnapshot) => {
                if (banSnapshot.val() === true) return;
                
                if (business.location && business.location.lat && business.location.lng) {
                    // Create custom icon for businesses
                    const businessIcon = L.divIcon({
                        className: 'custom-marker',
                        html: `<div style="background: #00bfa5; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); font-size: 20px;">🏢</div>`,
                        iconSize: [40, 40]
                    });
                    
                    const marker = L.marker([business.location.lat, business.location.lng], { icon: businessIcon });
                    
                    // Create popup content
                    const logoHtml = business.logo ? `<img src="${escapeHtml(business.logo)}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px; margin-bottom: 10px;">` : '';
                    
                    marker.bindPopup(`
                        <div style="width: 200px;">
                            ${logoHtml}
                            <h4 style="margin: 0 0 8px 0; font-size: 16px;">${escapeHtml(business.name)}</h4>
                            <p style="margin: 0 0 8px 0; font-size: 13px; color: #666; max-height: 60px; overflow: hidden;">${escapeHtml(business.description).substring(0, 100)}...</p>
                            <div style="margin-bottom: 10px;">
                                <div style="font-size: 12px; color: #666;">📧 ${escapeHtml(business.businessEmail)}</div>
                                <div style="font-size: 12px; color: #666;">📱 ${escapeHtml(business.businessPhone)}</div>
                            </div>
                            <button onclick="showBusinessDetail('${business.id}')" 
                                style="width: 100%; padding: 8px; background: linear-gradient(135deg, #00bfa5 0%, #00d2ff 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                                View Details
                            </button>
                        </div>
                    `);
                    
                    marker.addTo(locationMainMap);
                    businessMarkers.push(marker);
                }
            });
        });
    });
}

// Update marker visibility based on filters
function updateMapMarkers() {
    const showProducts = document.getElementById('show-products').checked;
    const showBusinesses = document.getElementById('show-businesses').checked;
    
    productMarkers.forEach(marker => {
        if (showProducts) {
            marker.addTo(locationMainMap);
        } else {
            locationMainMap.removeLayer(marker);
        }
    });
    
    businessMarkers.forEach(marker => {
        if (showBusinesses) {
            marker.addTo(locationMainMap);
        } else {
            locationMainMap.removeLayer(marker);
        }
    });
}

// Close location map and go back to main menu
function closeLocationMap() {
    document.getElementById('location-map-view').style.display = 'none';
    if (locationMainMap) {
        locationMainMap.remove();
        locationMainMap = null;
    }
    showMainMenu();
}

function addMapFullscreenHandler(mapContainerId, mapInstance) {
    const mapContainer = document.getElementById(mapContainerId);
    if (!mapContainer) return;
    
    // Check if mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth <= 768;
    
    if (isMobile) {
        mapContainer.addEventListener('click', function(e) {
            // Only trigger on direct clicks to the map container, not other elements
            if (e.target === mapContainer || e.target.classList.contains('leaflet-container')) {
                openFullscreenMap(mapContainerId, mapInstance);
            }
        });
    }
}

function openFullscreenMap(mapContainerId, mapInstance) {
    // Check if overlay already exists
    if (document.getElementById('map-fullscreen-overlay')) {
        return; // Already open
    }
    
    // Create fullscreen overlay
    const overlay = document.createElement('div');
    overlay.id = 'map-fullscreen-overlay';
    overlay.innerHTML = `
        <div class="map-fullscreen-header">
            <button class="map-back-btn" onclick="closeFullscreenMap()">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
                Back
            </button>
        </div>
        <div id="fullscreen-map-container"></div>
    `;
    document.body.appendChild(overlay);
    
    // Wait for DOM to be ready
    setTimeout(() => {
        const fullscreenMapDiv = document.getElementById('fullscreen-map-container');
        if (!fullscreenMapDiv) return;
        
        // Create new map in fullscreen
        const fullscreenMap = L.map('fullscreen-map-container').setView(mapInstance.getCenter(), mapInstance.getZoom());
    
    // Copy layers
    const streetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Made and ran by networKING technologies',
        maxZoom: 19
    });
    
    const satelliteMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Made and ran by networKING technologies',
        maxZoom: 19
    });
    
    streetMap.addTo(fullscreenMap);
    
    const baseMaps = {
        "Street Map": streetMap,
        "Satellite": satelliteMap
    };
    L.control.layers(baseMaps).addTo(fullscreenMap);
    
    // Copy markers
    mapInstance.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
            L.marker(layer.getLatLng()).addTo(fullscreenMap);
        }
    });
    
    // Add click handler for location selection if it's the location-map
    if (mapContainerId === 'location-map') {
        fullscreenMap.on('click', (e) => {
            const lat = e.latlng.lat;
            const lng = e.latlng.lng;
            
            // Update markers on both maps
            fullscreenMap.eachLayer((layer) => {
                if (layer instanceof L.Marker) {
                    fullscreenMap.removeLayer(layer);
                }
            });
            
            if (locationMarker) {
                locationMap.removeLayer(locationMarker);
            }
            
            L.marker([lat, lng]).addTo(fullscreenMap);
            locationMarker = L.marker([lat, lng]).addTo(locationMap);
            
            selectedLocation = { lat, lng };
            document.getElementById('selected-location').innerHTML = 
                `<strong>Selected:</strong> ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        });
    }
    
        // Store reference for closing
        window.currentFullscreenMap = fullscreenMap;
    }, 100);
}

function closeFullscreenMap() {
    const overlay = document.getElementById('map-fullscreen-overlay');
    if (overlay) {
        if (window.currentFullscreenMap) {
            window.currentFullscreenMap.remove();
            window.currentFullscreenMap = null;
        }
        overlay.remove();
    }
}

function clearProductForm() {
    document.getElementById('product-name').value = '';
    document.getElementById('product-description').value = '';
    document.getElementById('product-price').value = '';
    document.getElementById('product-category').value = 'market';
    document.getElementById('product-images').value = '';
    document.getElementById('image-preview').innerHTML = '';
    document.getElementById('add-location-checkbox').checked = false;
    document.getElementById('location-map-group').style.display = 'none';
    selectedLocation = null;
    document.getElementById('selected-location').innerHTML = '';
    
    // Clear business fields
    document.getElementById('business-logo').value = '';
    document.getElementById('logo-preview').innerHTML = '';
    document.getElementById('business-email').value = '';
    document.getElementById('business-phone').value = '';
    document.getElementById('business-address').value = '';
    document.getElementById('business-website').value = '';
    businessSelectedLocation = null;
    document.getElementById('business-selected-location').innerHTML = '';
    
    // Reset visibility
    document.getElementById('standard-fields').style.display = 'block';
    document.getElementById('business-fields').style.display = 'none';
}

let isSubmitting = false;

async function addProduct() {
    if (!currentUser) {
        alert('You must be logged in to add products');
        return;
    }

    // Prevent duplicate submissions
    if (isSubmitting) {
        return;
    }

    const name = document.getElementById('product-name').value.trim();
    const description = document.getElementById('product-description').value.trim();
    const price = parseFloat(document.getElementById('product-price').value);
    const category = document.getElementById('product-category').value;

    if (!name || !description || !price || price <= 0) {
        alert('Please fill in all fields with valid values');
        return;
    }

    isSubmitting = true;
    try {
        let product;
        
        if (category === 'business') {
            // Business listing
            const logoFile = document.getElementById('business-logo').files[0];
            const email = document.getElementById('business-email').value.trim();
            const phone = document.getElementById('business-phone').value.trim();
            const address = document.getElementById('business-address').value.trim();
            const website = document.getElementById('business-website').value.trim();
            
            if (!logoFile || !email || !phone || !address) {
                alert('Please fill in all required business fields');
                isSubmitting = false;
                return;
            }
            
            if (!businessSelectedLocation) {
                alert('Please set your business location on the map');
                isSubmitting = false;
                return;
            }
            
            // Check logo size
            const maxSize = 10 * 1024 * 1024;
            if (logoFile.size > maxSize) {
                alert('Logo is too large. Maximum size is 10MB.');
                isSubmitting = false;
                return;
            }
            
            // Convert logo to base64
            const logoBase64 = await convertImageToBase64(logoFile);
            
            product = {
                name: name,
                description: description,
                price: price,
                category: category,
                seller: currentUser.username,
                sellerId: currentUser.userId,
                logo: logoBase64,
                businessEmail: email,
                businessPhone: phone,
                businessAddress: address,
                businessWebsite: website,
                location: businessSelectedLocation,
                views: 0,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
        } else {
            // Regular product
            const imageFiles = document.getElementById('product-images').files;
            
            if (imageFiles.length > 3) {
                alert('Maximum 3 images allowed');
                isSubmitting = false;
                return;
            }
            
            // Check file sizes
            const maxSize = 10 * 1024 * 1024;
            for (let file of imageFiles) {
                if (file.size > maxSize) {
                    alert(`Image is too large. Maximum size is 10MB per image.`);
                    isSubmitting = false;
                    return;
                }
            }
            
            // Convert images to base64
            const imageUrls = [];
            for (let i = 0; i < imageFiles.length; i++) {
                const file = imageFiles[i];
                const base64 = await convertImageToBase64(file);
                imageUrls.push(base64);
            }
            
            product = {
                name: name,
                description: description,
                price: price,
                category: category,
                seller: currentUser.username,
                sellerId: currentUser.userId,
                images: imageUrls,
                views: 0,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
            
            // Add location if selected
            if (selectedLocation) {
                product.location = selectedLocation;
            }
        }

        // Save to appropriate database path
        if (category === 'business') {
            await firebase.database().ref('businesses').push(product);
            closeAddProduct();
            loadBusinesses();
            alert('Business posted successfully!');
        } else {
            await firebase.database().ref('products').push(product);
            closeAddProduct();
            loadProducts();
            alert('Product posted successfully!');
        }
    } catch (error) {
        console.error('Error adding product:', error);
        alert('Error posting product: ' + error.message);
    } finally {
        isSubmitting = false;
    }
}

function convertImageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function cleanupSoldProducts() {
    const productsRef = firebase.database().ref('products');
    const now = Date.now();
    
    productsRef.once('value').then((snapshot) => {
        if (!snapshot.exists()) return;
        
        const deletePromises = [];
        snapshot.forEach((childSnapshot) => {
            const product = childSnapshot.val();
            const productId = childSnapshot.key;
            
            // Delete if product is sold and deleteAt time has passed
            if (product.sold === true && product.deleteAt && product.deleteAt <= now) {
                console.log(`Auto-deleting sold product: ${product.name}`);
                const deletePromise = firebase.database().ref('products/' + productId).remove();
                deletePromises.push(deletePromise);
            }
        });
        
        if (deletePromises.length > 0) {
            Promise.all(deletePromises).then(() => {
                console.log(`Cleaned up ${deletePromises.length} sold product(s)`);
            }).catch((error) => {
                console.error('Error cleaning up sold products:', error);
            });
        }
    }).catch((error) => {
        console.error('Error checking sold products:', error);
    });
}

function loadProducts() {
    // Clean up any expired sold products first
    cleanupSoldProducts();
    
    if (!currentUser) {
        alert('Please log in to view your products');
        return;
    }
    
    const productsRef = firebase.database().ref('products');
    const productsGrid = document.getElementById('products-grid');
    const loadingSpinner = document.getElementById('loading-spinner');
    
    // Show loading spinner
    productsGrid.innerHTML = '';
    loadingSpinner.style.display = 'flex';
    
    // Remove any existing listeners first
    productsRef.off('value');
    
    // Filter to only show current user's products
    productsRef.orderByChild('sellerId').equalTo(currentUser.userId).on('value', (snapshot) => {
        // Hide loading spinner
        loadingSpinner.style.display = 'none';
        productsGrid.innerHTML = '';

        if (!snapshot.exists()) {
            productsGrid.innerHTML = `
                <div class="empty-state">
                    <p>📦</p>
                    <p>No products yet. Click "+ Add Product" to post your first item!</p>
                </div>
            `;
            return;
        }

        const products = [];
        const productPromises = [];
        
        snapshot.forEach((childSnapshot) => {
            const product = {
                id: childSnapshot.key,
                ...childSnapshot.val()
            };
            
            // Skip sold products
            if (product.sold === true) {
                return;
            }
            
            // Check if seller is banned
            const promise = firebase.database().ref('users/' + product.seller + '/banned').once('value').then((userSnapshot) => {
                const isBanned = userSnapshot.val() === true;
                if (!isBanned) {
                    products.push(product);
                }
            });
            
            productPromises.push(promise);
        });
        
        // Wait for all ban checks to complete
        Promise.all(productPromises).then(() => {

            // Reverse to show newest first
            products.reverse();

            // Filter by category
            const filteredProducts = currentCategory === 'all' 
                ? products 
                : products.filter(p => p.category === currentCategory);

        if (filteredProducts.length === 0) {
            productsGrid.innerHTML = `
                <div class="empty-state">
                    <p>📦</p>
                    <p>No products in this category</p>
                </div>
            `;
            return;
        }

            filteredProducts.forEach(product => {
                const productCard = createProductCard(product);
                productsGrid.appendChild(productCard);
            });
        });
    });
}

function loadBusinesses() {
    // Clean up any expired sold products first
    cleanupSoldProducts();
    
    if (!currentUser) {
        alert('Please log in to view your businesses');
        return;
    }
    
    const businessesRef = firebase.database().ref('businesses');
    const businessGrid = document.getElementById('business-grid');
    const loadingSpinner = document.getElementById('loading-spinner');
    
    // Show loading spinner
    businessGrid.innerHTML = '';
    loadingSpinner.style.display = 'flex';
    
    // Remove any existing listeners first
    businessesRef.off('value');
    
    // Filter to only show current user's businesses
    businessesRef.orderByChild('sellerId').equalTo(currentUser.userId).on('value', (snapshot) => {
        // Hide loading spinner
        loadingSpinner.style.display = 'none';
        businessGrid.innerHTML = '';

        if (!snapshot.exists()) {
            businessGrid.innerHTML = `
                <div class="empty-state">
                    <p>💼</p>
                    <p>No businesses yet. Click "+ Add Business" to post your first business!</p>
                </div>
            `;
            return;
        }

        const businesses = [];
        const businessPromises = [];
        
        snapshot.forEach((childSnapshot) => {
            const business = {
                id: childSnapshot.key,
                ...childSnapshot.val()
            };
            
            // Check if seller is banned
            const promise = firebase.database().ref('users/' + business.seller + '/banned').once('value').then((userSnapshot) => {
                const isBanned = userSnapshot.val() === true;
                if (!isBanned) {
                    businesses.push(business);
                }
            });
            
            businessPromises.push(promise);
        });
        
        // Wait for all ban checks to complete
        Promise.all(businessPromises).then(() => {
            // Reverse to show newest first
            businesses.reverse();

            if (businesses.length === 0) {
                businessGrid.innerHTML = `
                    <div class="empty-state">
                        <p>💼</p>
                        <p>No businesses in this category</p>
                    </div>
                `;
                return;
            }

            businesses.forEach(business => {
                const businessCard = createBusinessCard(business);
                businessGrid.appendChild(businessCard);
            });
        });
    });
}

function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    
    const formattedPrice = product.price.toFixed(2);
    const isBookmarked = checkIfBookmarked(product.id);
    
    // Get first image only
    let imageHtml = '';
    if (product.images && product.images.length > 0) {
        imageHtml = `<div class="product-main-image-container">
            <img src="${escapeHtml(product.images[0])}" alt="Product image" class="product-main-image" loading="lazy">
        </div>`;
    }
    
    // Get seller rating (for products only)
    firebase.database().ref('reviews/' + product.seller).once('value', (reviewSnapshot) => {
        let avgRating = 0;
        let reviewCount = 0;
        
        if (reviewSnapshot.exists()) {
            let totalStars = 0;
            reviewSnapshot.forEach((review) => {
                totalStars += review.val().rating;
                reviewCount++;
            });
            avgRating = (totalStars / reviewCount).toFixed(1);
        }
        
        const ratingStars = avgRating > 0 ? '⭐'.repeat(Math.round(avgRating)) : '';
        const ratingText = avgRating > 0 ? `${avgRating} (${reviewCount})` : 'No reviews';
        
        // Check if this is the current user's product
        const isOwner = currentUser && product.sellerId === currentUser.userId;
        const ownerButtons = isOwner ? `
            <div class="product-owner-buttons" style="display: flex; gap: 8px; padding: 10px; border-top: 1px solid #eee; margin-top: 10px;">
                <button onclick="editProduct('${product.id}'); event.stopPropagation();" style="flex: 1; background: #3498db; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px;">
                    ✏️ Edit
                </button>
                ${product.sold !== true ? `
                <button onclick="markAsSold('${product.id}', '${escapeHtml(product.name)}'); event.stopPropagation();" style="flex: 1; background: #2ecc71; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px;">
                    ✓ Sold
                </button>
                ` : ''}
                <button onclick="deleteMyProduct('${product.id}', '${escapeHtml(product.name)}'); event.stopPropagation();" style="background: #e74c3c; color: white; border: none; padding: 10px 15px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px;">
                    🗑️
                </button>
            </div>
        ` : '';
        
        card.innerHTML = `
            ${imageHtml}
            <div class="product-card-info">
                <div class="product-card-header">
                    <div class="product-name">${escapeHtml(product.name)}</div>
                    <div class="product-price" style="color: #4facfe; font-weight: 700; font-size: 18px;">$${formattedPrice}</div>
                </div>
                <div class="product-card-rating">
                    ${ratingStars} ${ratingText}
                </div>
            </div>
            ${ownerButtons}
        `;
    });
    
    // Open product detail when card is clicked
    card.addEventListener('click', (e) => {
        if (!e.target.classList.contains('bookmark-btn') && 
            !e.target.closest('.bookmark-btn') &&
            !e.target.closest('button') &&
            !e.target.classList.contains('seller-badge-btn') &&
            !e.target.closest('.seller-badge-btn') &&
            !e.target.classList.contains('product-image')) {
            showProductDetail(product);
        }
    });
    
    return card;
}

function createBusinessCard(business) {
    const card = document.createElement('div');
    card.className = 'product-card business-card';
    
    const formattedPrice = business.price.toFixed(2);
    const isBookmarked = checkIfBookmarked(business.id);
    const views = business.views || 0;
    
    // Business logo
    let logoHtml = '';
    if (business.logo) {
        logoHtml = `<div class="business-logo-container">
            <img src="${escapeHtml(business.logo)}" alt="Business logo" class="business-logo" loading="lazy">
        </div>`;
    }
    
    // Get business rating (separate from seller rating)
    firebase.database().ref('businessReviews/' + business.id).once('value', (reviewSnapshot) => {
        let avgRating = 0;
        let reviewCount = 0;
        
        if (reviewSnapshot.exists()) {
            let totalStars = 0;
            reviewSnapshot.forEach((review) => {
                totalStars += review.val().rating;
                reviewCount++;
            });
            avgRating = (totalStars / reviewCount).toFixed(1);
        }
        
        const ratingStars = avgRating > 0 ? '⭐'.repeat(Math.round(avgRating)) : '';
        const ratingText = avgRating > 0 ? `${avgRating} (${reviewCount})` : 'No reviews';
        
        // Check if this is the current user's business
        const isOwner = currentUser && business.sellerId === currentUser.userId;
        const ownerButtons = isOwner ? `
            <div class="product-owner-buttons" style="display: flex; gap: 8px; padding: 10px; border-top: 1px solid #eee; margin-top: 10px;">
                <button onclick="editBusiness('${business.id}'); event.stopPropagation();" style="flex: 1; background: #3498db; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px;">
                    ✏️ Edit
                </button>
                <button onclick="deleteMyBusiness('${business.id}', '${escapeHtml(business.name)}'); event.stopPropagation();" style="background: #e74c3c; color: white; border: none; padding: 10px 15px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px;">
                    🗑️
                </button>
            </div>
        ` : '';
        
        card.innerHTML = `
            <div class="business-card-header">
                <button class="bookmark-btn ${isBookmarked ? 'bookmarked' : ''}" onclick="toggleBookmark('${business.id}', event)">
                    ${isBookmarked ? '⭐' : '☆'}
                </button>
            </div>
            ${logoHtml}
            <div class="business-card-name">${escapeHtml(business.name)}</div>
            <div class="business-card-rating">
                ${ratingStars} ${ratingText}
            </div>
            <div class="business-price" style="color: #4facfe; font-weight: 700; font-size: 18px; padding: 10px;">$${formattedPrice}</div>
            ${ownerButtons}
        `;
    });
    
    card.onclick = (e) => {
        if (!e.target.classList.contains('bookmark-btn') && 
            !e.target.closest('button') &&
            !e.target.classList.contains('seller-badge-btn') &&
            !e.target.classList.contains('view-details-btn') &&
            !e.target.closest('.seller-badge-btn')) {
            showBusinessDetail(business.id);
        }
    };
    
    return card;
}

function filterCategory(category) {
    currentCategory = category;
    
    // Hide main menu and header, show appropriate view
    const mainMenu = document.getElementById('main-menu');
    const mainHeader = document.getElementById('main-header');
    const categoryHeader = document.getElementById('category-header');
    const addBtn = document.getElementById('add-btn');
    const productsGrid = document.getElementById('products-grid');
    const businessGrid = document.getElementById('business-grid');
    const locationMapView = document.getElementById('location-map-view');
    const hallMonitorView = document.getElementById('hall-monitor-view');
    const speedCopMapView = document.getElementById('speedcop-map-view');
    
    mainMenu.style.display = 'none';
    mainHeader.style.display = 'none';
    
    if (category === 'location') {
        categoryHeader.style.display = 'none';
        productsGrid.style.display = 'none';
        businessGrid.style.display = 'none';
        locationMapView.style.display = 'block';
        hallMonitorView.style.display = 'none';
        speedCopMapView.style.display = 'none';
        initLocationMainMap();
    } else if (category === 'business') {
        categoryHeader.style.display = 'block';
        addBtn.textContent = '+ Add Business';
        productsGrid.style.display = 'none';
        businessGrid.style.display = 'grid';
        locationMapView.style.display = 'none';
        hallMonitorView.style.display = 'none';
        speedCopMapView.style.display = 'none';
        loadBusinesses();
    } else if (category === 'hall-monitor') {
        categoryHeader.style.display = 'block';
        addBtn.style.display = 'none';
        productsGrid.style.display = 'none';
        businessGrid.style.display = 'none';
        locationMapView.style.display = 'none';
        hallMonitorView.style.display = 'block';
        speedCopMapView.style.display = 'none';
    } else {
        categoryHeader.style.display = 'block';
        addBtn.textContent = '+ Add Product';
        productsGrid.style.display = 'grid';
        businessGrid.style.display = 'none';
        locationMapView.style.display = 'none';
        hallMonitorView.style.display = 'none';
        speedCopMapView.style.display = 'none';
        loadProducts();
    }
}

// Return to main menu
function showMainMenu() {
    const mainMenu = document.getElementById('main-menu');
    const mainHeader = document.getElementById('main-header');
    const categoryHeader = document.getElementById('category-header');
    const productsGrid = document.getElementById('products-grid');
    const businessGrid = document.getElementById('business-grid');
    const locationMapView = document.getElementById('location-map-view');
    const hallMonitorView = document.getElementById('hall-monitor-view');
    const speedCopMapView = document.getElementById('speedcop-map-view');
    
    mainMenu.style.display = 'grid';
    mainHeader.style.display = 'flex';
    categoryHeader.style.display = 'none';
    productsGrid.style.display = 'none';
    businessGrid.style.display = 'none';
    locationMapView.style.display = 'none';
    hallMonitorView.style.display = 'none';
    speedCopMapView.style.display = 'none';
    
    currentCategory = 'menu';
}

// Utility function to escape HTML and prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Close modal when clicking outside
document.getElementById('add-product-modal').addEventListener('click', (e) => {
    if (e.target.id === 'add-product-modal') {
        closeAddProduct();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target.id === 'settings-modal') {
                closeSettings();
            }
        });
    }
});

// Settings Functions
function showAnalytics() {
    // Hide main menu and show analytics view
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('main-header').style.display = 'none';
    document.getElementById('analytics-view').style.display = 'block';
    
    // Load analytics data
    if (currentUser) {
        loadAnalytics();
    }
}

function closeAnalytics() {
    document.getElementById('analytics-view').style.display = 'none';
    document.getElementById('main-header').style.display = 'block';
    showMainMenu();
}

function loadAnalytics() {
    if (!currentUser) return;
    
    let totalProducts = 0;
    let totalBusinesses = 0;
    let totalViews = 0;
    let itemsSold = 0;
    
    // Load products analytics
    firebase.database().ref('products').orderByChild('sellerId').equalTo(currentUser.userId).once('value', (snapshot) => {
        const productsList = document.getElementById('analytics-products-list');
        productsList.innerHTML = '';
        
        const products = [];
        
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                const product = { id: child.key, ...child.val() };
                products.push(product);
                totalProducts++;
                totalViews += product.views || 0;
                if (product.sold === true) itemsSold++;
            });
            
            // Sort by views
            products.sort((a, b) => (b.views || 0) - (a.views || 0));
            
            products.forEach(product => {
                const statusBadge = product.sold ? '<span style="background: #2ecc71; color: white; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;">SOLD</span>' : '<span style="background: #4facfe; color: white; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;">ACTIVE</span>';
                
                productsList.innerHTML += `
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #333; margin-bottom: 5px;">${escapeHtml(product.name)}</div>
                            <div style="font-size: 13px; color: #666;">$${product.price.toFixed(2)} • ${product.category}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 20px; font-weight: 700; color: #4facfe; margin-bottom: 5px;">${product.views || 0}</div>
                            <div style="font-size: 12px; color: #999;">views</div>
                        </div>
                        <div style="margin-left: 15px;">
                            ${statusBadge}
                        </div>
                    </div>
                `;
            });
        } else {
            productsList.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">No products yet</div>';
        }
        
        // Update summary
        document.getElementById('analytics-total-products').textContent = totalProducts;
        document.getElementById('analytics-items-sold').textContent = itemsSold;
        
        // Load businesses analytics
        loadBusinessesAnalytics(totalViews);
    });
}

function loadBusinessesAnalytics(productViews) {
    if (!currentUser) return;
    
    let totalBusinesses = 0;
    let businessViews = 0;
    
    firebase.database().ref('businesses').orderByChild('sellerId').equalTo(currentUser.userId).once('value', (snapshot) => {
        const businessesList = document.getElementById('analytics-businesses-list');
        businessesList.innerHTML = '';
        
        const businesses = [];
        
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                const business = { id: child.key, ...child.val() };
                businesses.push(business);
                totalBusinesses++;
                businessViews += business.views || 0;
            });
            
            // Sort by views
            businesses.sort((a, b) => (b.views || 0) - (a.views || 0));
            
            businesses.forEach(business => {
                businessesList.innerHTML += `
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #333; margin-bottom: 5px;">${escapeHtml(business.name)}</div>
                            <div style="font-size: 13px; color: #666;">${escapeHtml(business.businessEmail)}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 20px; font-weight: 700; color: #00bfa5; margin-bottom: 5px;">${business.views || 0}</div>
                            <div style="font-size: 12px; color: #999;">views</div>
                        </div>
                    </div>
                `;
            });
        } else {
            businessesList.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">No businesses yet</div>';
        }
        
        // Update summary
        document.getElementById('analytics-total-businesses').textContent = totalBusinesses;
        document.getElementById('analytics-total-views').textContent = productViews + businessViews;
    });
}

function showMyReviews() {
    // Hide main menu and show reviews view
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('main-header').style.display = 'none';
    document.getElementById('reviews-view').style.display = 'block';
    
    // Load reviews data
    if (currentUser) {
        loadMyReviews();
    }
}

function closeReviewsView() {
    document.getElementById('reviews-view').style.display = 'none';
    document.getElementById('main-header').style.display = 'block';
    showMainMenu();
}

function showSettings() {
    // Hide main menu and show settings view
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('main-header').style.display = 'none';
    document.getElementById('settings-view').style.display = 'block';
    
    // Load settings data
    if (currentUser) {
        document.getElementById('settings-username').textContent = currentUser.username;
        loadContactInfo();
    }
}

function closeSettings() {
    document.getElementById('settings-view').style.display = 'none';
    document.getElementById('main-header').style.display = 'block';
    showMainMenu();
}

// Removed old tab-based settings

function loadUserPosts() {
    if (!currentUser) return;
    
    // Clean up any expired sold products first
    cleanupSoldProducts();
    
    const productsRef = firebase.database().ref('products');
    productsRef.orderByChild('sellerId').equalTo(currentUser.userId).once('value', (snapshot) => {
        const userProductsList = document.getElementById('user-products-list');
        userProductsList.innerHTML = '';
        
        if (!snapshot.exists()) {
            userProductsList.innerHTML = '<div class="empty-state"><p>📦</p><p>You haven\'t posted anything yet</p></div>';
            return;
        }
        
        const products = [];
        snapshot.forEach((childSnapshot) => {
            products.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });
        
        products.reverse().forEach(product => {
            const productCard = createUserProductCard(product);
            userProductsList.appendChild(productCard);
        });
    });
}

function createUserProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    
    const formattedPrice = product.price.toFixed(2);
    const views = product.views || 0;
    
    let imagesHtml = '';
    if (product.images && product.images.length > 0) {
        imagesHtml = '<div class="product-images">';
        product.images.forEach(imageUrl => {
            imagesHtml += `<img src="${escapeHtml(imageUrl)}" alt="Product image" class="product-image" onclick="window.open('${escapeHtml(imageUrl)}', '_blank')">`;
        });
        imagesHtml += '</div>';
    }
    
    const isSold = product.sold === true;
    const soldBadge = isSold ? '<div style="background: #ff4757; color: white; padding: 4px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; margin-left: 10px;">SOLD</div>' : '';
    const soldOverlay = isSold ? '<div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; border-radius: 16px; pointer-events: none;"><span style="background: #ff4757; color: white; padding: 10px 20px; border-radius: 8px; font-weight: 700; font-size: 18px;">SOLD</span></div>' : '';
    
    card.innerHTML = `
        ${soldOverlay}
        <div class="product-header">
            <div style="display: flex; align-items: center;">
                <div>
                    <div class="product-name">${escapeHtml(product.name)}</div>
                    <div class="product-stats">👁️ ${views} views</div>
                </div>
                ${soldBadge}
            </div>
            <div class="product-price">$${formattedPrice}</div>
        </div>
        ${imagesHtml}
        <div class="product-description">${escapeHtml(product.description)}</div>
        <div class="product-footer" style="display: flex; gap: 10px; flex-wrap: wrap;">
            <span class="product-category">${escapeHtml(product.category)}</span>
            <div style="display: flex; gap: 8px; margin-left: auto; flex-wrap: wrap;">
                <button class="btn-edit" onclick="editProduct('${product.id}')" style="background: #3498db; color: white; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 5px;">
                    ✏️ Edit
                </button>
                ${!isSold ? `<button class="btn-sold" onclick="markAsSold('${product.id}', '${escapeHtml(product.name)}')" style="background: #2ecc71; color: white; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 5px;">
                    ✓ Mark as Sold
                </button>` : `<button class="btn-repost" onclick="repostProduct('${product.id}', '${escapeHtml(product.name)}')" style="background: #3498db; color: white; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 5px;">
                    🔄 Repost
                </button>`}
                <button class="btn-delete" onclick="deleteMyProduct('${product.id}', '${escapeHtml(product.name)}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                    Delete
                </button>
            </div>
        </div>
    `;
    
    card.style.position = 'relative';
    
    return card;
}

function loadUserBusinesses() {
    if (!currentUser) return;
    
    const businessesRef = firebase.database().ref('businesses');
    businessesRef.orderByChild('sellerId').equalTo(currentUser.userId).once('value', (snapshot) => {
        const userBusinessesList = document.getElementById('user-businesses-list');
        userBusinessesList.innerHTML = '';
        
        if (!snapshot.exists()) {
            userBusinessesList.innerHTML = '<div class="empty-state"><p>🏢</p><p>You haven\'t posted any businesses yet</p></div>';
            return;
        }
        
        const businesses = [];
        snapshot.forEach((childSnapshot) => {
            businesses.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });
        
        businesses.reverse().forEach(business => {
            const businessCard = createUserBusinessCard(business);
            userBusinessesList.appendChild(businessCard);
        });
    });
}

function createUserBusinessCard(business) {
    const card = document.createElement('div');
    card.className = 'product-card';
    
    const views = business.views || 0;
    
    let logoHtml = '';
    if (business.logo) {
        logoHtml = `<div class="business-logo-container">
            <img src="${escapeHtml(business.logo)}" alt="Business logo" class="business-logo" loading="lazy">
        </div>`;
    }
    
    card.innerHTML = `
        ${logoHtml}
        <div class="product-header">
            <div>
                <div class="product-name">${escapeHtml(business.name)}</div>
                <div class="product-stats">👁️ ${views} views</div>
            </div>
        </div>
        <div class="product-description">${escapeHtml(business.description)}</div>
        <div class="business-contact-preview">
            <div class="contact-item-small">📧 ${escapeHtml(business.businessEmail)}</div>
            <div class="contact-item-small">📱 ${escapeHtml(business.businessPhone)}</div>
            <div class="contact-item-small">📍 ${escapeHtml(business.businessAddress)}</div>
        </div>
        <div class="product-footer" style="display: flex; gap: 10px; flex-wrap: wrap;">
            <span class="product-category">Business</span>
            <div style="display: flex; gap: 8px; margin-left: auto;">
                <button class="btn-edit" onclick="editBusiness('${business.id}')" style="background: #3498db; color: white; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 5px;">
                    ✏️ Edit
                </button>
                <button class="btn-delete" onclick="deleteMyBusiness('${business.id}', '${escapeHtml(business.name)}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                    Delete
                </button>
            </div>
        </div>
    `;
    
    return card;
}

function loadBookmarks() {
    const bookmarks = getBookmarks();
    const bookmarksList = document.getElementById('bookmarks-list');
    bookmarksList.innerHTML = '';
    
    if (bookmarks.length === 0) {
        bookmarksList.innerHTML = '<div class="empty-state"><p>⭐</p><p>No bookmarks yet</p></div>';
        return;
    }
    
    // Load each bookmarked product
    bookmarks.forEach(productId => {
        firebase.database().ref('products/' + productId).once('value', (snapshot) => {
            if (snapshot.exists()) {
                const product = {
                    id: snapshot.key,
                    ...snapshot.val()
                };
                const productCard = createProductCard(product);
                bookmarksList.appendChild(productCard);
            }
        });
    });
}

// Bookmark Functions
function getBookmarks() {
    const bookmarks = localStorage.getItem('bookmarks');
    return bookmarks ? JSON.parse(bookmarks) : [];
}

function saveBookmarks(bookmarks) {
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
}

function checkIfBookmarked(productId) {
    const bookmarks = getBookmarks();
    return bookmarks.includes(productId);
}

function toggleBookmark(productId, event) {
    event.stopPropagation();
    
    let bookmarks = getBookmarks();
    const index = bookmarks.indexOf(productId);
    
    if (index > -1) {
        bookmarks.splice(index, 1);
        alert('Removed from bookmarks');
    } else {
        bookmarks.push(productId);
        alert('Added to bookmarks!');
    }
    
    saveBookmarks(bookmarks);
    loadProducts(); // Reload to update bookmark icons
}

// Delete User's Own Product
function markAsSold(productId, productName) {
    if (!confirm(`Mark "${productName}" as sold?\n\nThis will show as SOLD to other users and will be automatically deleted in 30 minutes.`)) {
        return;
    }
    
    const soldTimestamp = Date.now();
    const deleteAt = soldTimestamp + (30 * 60 * 1000); // 30 minutes from now
    
    firebase.database().ref('products/' + productId).update({
        sold: true,
        soldTimestamp: soldTimestamp,
        deleteAt: deleteAt
    })
        .then(() => {
            alert('Product marked as SOLD! It will be automatically removed in 30 minutes.');
            loadUserPosts(); // Reload the list
        })
        .catch((error) => {
            console.error('Error marking product as sold:', error);
            alert('Error updating product: ' + error.message);
        });
}

function repostProduct(productId, productName) {
    if (!confirm(`Repost "${productName}"?\n\nThis will remove the SOLD status and make it visible to other users again.`)) {
        return;
    }
    
    firebase.database().ref('products/' + productId).update({
        sold: null,
        soldTimestamp: null,
        deleteAt: null
    })
        .then(() => {
            alert('Product reposted successfully! It is now visible to other users.');
            loadUserPosts(); // Reload the list
        })
        .catch((error) => {
            console.error('Error reposting product:', error);
            alert('Error updating product: ' + error.message);
        });
}

function editProduct(productId) {
    firebase.database().ref('products/' + productId).once('value', (snapshot) => {
        if (!snapshot.exists()) {
            alert('Product not found');
            return;
        }
        
        const product = snapshot.val();
        
        // Populate the form with existing data
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-description').value = product.description;
        document.getElementById('product-price').value = product.price;
        document.getElementById('product-category').value = product.category;
        
        // Store the product ID for updating
        document.getElementById('add-product-modal').dataset.editingId = productId;
        
        // Change button text to "Update Product"
        const addBtn = document.querySelector('#add-product-modal .btn-primary');
        addBtn.textContent = 'Update Product';
        addBtn.onclick = () => updateProduct(productId);
        
        // Open the modal
        showAddProduct();
    });
}

function editBusiness(businessId) {
    firebase.database().ref('businesses/' + businessId).once('value', (snapshot) => {
        if (!snapshot.exists()) {
            alert('Business not found');
            return;
        }
        
        const business = snapshot.val();
        
        // Populate the form with existing data
        document.getElementById('product-name').value = business.name;
        document.getElementById('product-description').value = business.description;
        document.getElementById('product-price').value = business.price;
        document.getElementById('product-category').value = 'business';
        document.getElementById('business-email').value = business.businessEmail;
        document.getElementById('business-phone').value = business.businessPhone;
        document.getElementById('business-address').value = business.businessAddress;
        document.getElementById('business-website').value = business.businessWebsite || '';
        
        handleCategorySelection();
        
        // Store the business ID for updating
        document.getElementById('add-product-modal').dataset.editingId = businessId;
        
        // Change button text to "Update Business"
        const addBtn = document.querySelector('#add-product-modal .btn-primary');
        addBtn.textContent = 'Update Business';
        addBtn.onclick = () => updateBusiness(businessId);
        
        // Open the modal
        showAddProduct();
    });
}

async function updateProduct(productId) {
    const name = document.getElementById('product-name').value.trim();
    const description = document.getElementById('product-description').value.trim();
    const price = parseFloat(document.getElementById('product-price').value);
    
    if (!name || !description || !price || price <= 0) {
        alert('Please fill in all fields with valid values');
        return;
    }
    
    const updates = {
        name: name,
        description: description,
        price: price
    };
    
    try {
        await firebase.database().ref('products/' + productId).update(updates);
        alert('Product updated successfully!');
        closeAddProduct();
        loadProducts();
    } catch (error) {
        console.error('Error updating product:', error);
        alert('Error updating product: ' + error.message);
    }
}

async function updateBusiness(businessId) {
    const name = document.getElementById('product-name').value.trim();
    const description = document.getElementById('product-description').value.trim();
    const price = parseFloat(document.getElementById('product-price').value);
    const email = document.getElementById('business-email').value.trim();
    const phone = document.getElementById('business-phone').value.trim();
    const address = document.getElementById('business-address').value.trim();
    const website = document.getElementById('business-website').value.trim();
    
    if (!name || !description || !price || !email || !phone || !address) {
        alert('Please fill in all required fields');
        return;
    }
    
    const updates = {
        name: name,
        description: description,
        price: price,
        businessEmail: email,
        businessPhone: phone,
        businessAddress: address,
        businessWebsite: website
    };
    
    try {
        await firebase.database().ref('businesses/' + businessId).update(updates);
        alert('Business updated successfully!');
        closeAddProduct();
        loadBusinesses();
    } catch (error) {
        console.error('Error updating business:', error);
        alert('Error updating business: ' + error.message);
    }
}

function deleteMyProduct(productId, productName) {
    if (!confirm(`Are you sure you want to delete "${productName}"?`)) {
        return;
    }
    
    firebase.database().ref('products/' + productId).remove()
        .then(() => {
            alert('Product deleted successfully');
            loadProducts(); // Reload the main grid
        })
        .catch((error) => {
            console.error('Error deleting product:', error);
            alert('Error deleting product: ' + error.message);
        });
}

function deleteMyBusiness(businessId, businessName) {
    if (!confirm(`Are you sure you want to delete "${businessName}"?`)) {
        return;
    }
    
    firebase.database().ref('businesses/' + businessId).remove()
        .then(() => {
            alert('Business deleted successfully');
            loadBusinesses(); // Reload the main grid
        })
        .catch((error) => {
            console.error('Error deleting business:', error);
            alert('Error deleting business: ' + error.message);
        });
}

// Views Tracking
function incrementProductViews(productId) {
    if (!currentUser) return;
    
    // Get viewed products from localStorage
    const viewedProductsKey = `viewedProducts_${currentUser.username}`;
    let viewedProducts = JSON.parse(localStorage.getItem(viewedProductsKey) || '[]');
    
    // Check if user has already viewed this product
    if (viewedProducts.includes(productId)) {
        return; // Already viewed, don't increment
    }
    
    // Add to viewed products list
    viewedProducts.push(productId);
    localStorage.setItem(viewedProductsKey, JSON.stringify(viewedProducts));
    
    // Increment view count in database
    const productRef = firebase.database().ref('products/' + productId);
    productRef.once('value', (snapshot) => {
        if (snapshot.exists()) {
            const currentViews = snapshot.val().views || 0;
            productRef.update({ views: currentViews + 1 });
        }
    });
}

function incrementBusinessViews(businessId) {
    if (!currentUser) return;
    
    // Get viewed businesses from localStorage
    const viewedBusinessesKey = `viewedBusinesses_${currentUser.username}`;
    let viewedBusinesses = JSON.parse(localStorage.getItem(viewedBusinessesKey) || '[]');
    
    // Check if user has already viewed this business
    if (viewedBusinesses.includes(businessId)) {
        return; // Already viewed, don't increment
    }
    
    // Add to viewed businesses list
    viewedBusinesses.push(businessId);
    localStorage.setItem(viewedBusinessesKey, JSON.stringify(viewedBusinesses));
    
    // Increment view count in database
    const businessRef = firebase.database().ref('businesses/' + businessId);
    businessRef.once('value', (snapshot) => {
        if (snapshot.exists()) {
            const currentViews = snapshot.val().views || 0;
            businessRef.update({ views: currentViews + 1 });
        }
    });
}

// Contact Info Functions
function loadContactInfo() {
    if (!currentUser) return;
    
    firebase.database().ref('users/' + currentUser.username + '/contact').once('value', (snapshot) => {
        if (snapshot.exists()) {
            const contact = snapshot.val();
            document.getElementById('user-email').value = contact.email || '';
            document.getElementById('user-phone').value = contact.phone || '';
            document.getElementById('user-location').value = contact.location || '';
        }
    });
}

function saveContactInfo() {
    if (!currentUser) return;
    
    const email = document.getElementById('user-email').value.trim();
    const phone = document.getElementById('user-phone').value.trim();
    const location = document.getElementById('user-location').value.trim();
    
    firebase.database().ref('users/' + currentUser.username + '/contact').set({
        email: email,
        phone: phone,
        location: location
    });
    
    alert('Contact info saved!');
}

// Review Functions
let selectedRating = 0;
let currentSellerForReview = '';
let currentBusinessForReview = '';
let isReviewingBusiness = false;

function showSellerInfo(seller, event) {
    event.stopPropagation();
    currentSellerForReview = seller;
    isReviewingBusiness = false;
    
    document.getElementById('seller-modal-name').textContent = seller;
    document.getElementById('seller-info-modal').classList.add('active');
    
    // Show all seller-specific sections (wait for modal to render)
    setTimeout(() => {
        const ratingEl = document.getElementById('seller-rating');
        const contactEl = document.getElementById('seller-contact');
        const previewEl = document.getElementById('seller-products-preview');
        
        if (ratingEl) ratingEl.style.display = 'block';
        if (contactEl) contactEl.style.display = 'block';
        if (previewEl) previewEl.style.display = 'block';
    }, 0);
    
    // Load seller rating (for product sellers only)
    firebase.database().ref('reviews/' + seller).once('value', (snapshot) => {
        const ratingDiv = document.getElementById('seller-rating');
        
        if (!snapshot.exists()) {
            ratingDiv.innerHTML = '<p style="color: #999;">No reviews yet</p>';
        } else {
            let totalStars = 0;
            let reviewCount = 0;
            
            snapshot.forEach((review) => {
                totalStars += review.val().rating;
                reviewCount++;
            });
            
            const avgRating = (totalStars / reviewCount).toFixed(1);
            const stars = '⭐'.repeat(Math.round(avgRating));
            
            ratingDiv.innerHTML = `
                <h3>Seller Rating</h3>
                <div class="rating-stars">${stars}</div>
                <div class="rating-count">${avgRating} out of 5 (${reviewCount} reviews)</div>
            `;
        }
    });
    
    // Load seller contact info
    firebase.database().ref('users/' + seller + '/contact').once('value', (snapshot) => {
        const contactDiv = document.getElementById('seller-contact');
        
        if (!snapshot.exists() || !snapshot.val().email && !snapshot.val().phone && !snapshot.val().location) {
            contactDiv.innerHTML = '<p style="color: #999;">No contact information available</p>';
        } else {
            const contact = snapshot.val();
            let html = '<h3>Contact Information</h3>';
            
            if (contact.email) {
                html += `<div class="contact-item">📧 <a href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a></div>`;
            }
            if (contact.phone) {
                html += `<div class="contact-item">📱 <a href="tel:${escapeHtml(contact.phone)}">${escapeHtml(contact.phone)}</a></div>`;
            }
            if (contact.location) {
                html += `<div class="contact-item">📍 ${escapeHtml(contact.location)}</div>`;
            }
            
            contactDiv.innerHTML = html;
        }
    });
    
    // Load seller's products preview
    loadSellerProductsPreview(seller);
    
    // Load reviews
    loadSellerReviews(seller);
    
    // Reset review form
    selectedRating = 0;
    document.getElementById('review-text').value = '';
    updateStarDisplay();
}

function loadSellerProductsPreview(seller) {
    firebase.database().ref('products').orderByChild('seller').equalTo(seller).limitToLast(6).once('value', (snapshot) => {
        const previewDiv = document.getElementById('seller-products-preview');
        
        if (!snapshot.exists()) {
            previewDiv.innerHTML = '';
            return;
        }
        
        let html = '<h3 style="margin-top: 20px;">Other Products by ' + escapeHtml(seller) + '</h3>';
        html += '<div class="seller-products-grid">';
        
        snapshot.forEach((child) => {
            const product = { id: child.key, ...child.val() };
            const imageUrl = product.images && product.images.length > 0 ? product.images[0] : '';
            const imageSrc = imageUrl || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3ENo Image%3C/text%3E%3C/svg%3E';
            
            html += `
                <div class="seller-product-mini" onclick="showProductDetailById('${product.id}')">
                    <img src="${imageSrc}" alt="${escapeHtml(product.name)}">
                    <div class="seller-product-mini-name">${escapeHtml(product.name)}</div>
                    <div class="seller-product-mini-price">$${product.price.toFixed(2)}</div>
                </div>
            `;
        });
        
        html += '</div>';
        previewDiv.innerHTML = html;
    });
}

function closeSellerInfo() {
    document.getElementById('seller-info-modal').classList.remove('active');
}

function setRating(rating) {
    selectedRating = rating;
    updateStarDisplay();
}

function updateStarDisplay() {
    const stars = document.querySelectorAll('#review-stars .star');
    stars.forEach((star, index) => {
        if (index < selectedRating) {
            star.classList.add('filled');
            star.textContent = '★';
        } else {
            star.classList.remove('filled');
            star.textContent = '☆';
        }
    });
}

function submitReview() {
    if (!currentUser) {
        alert('You must be logged in to leave a review');
        return;
    }
    
    if (!isReviewingBusiness && currentUser.username === currentSellerForReview) {
        alert('You cannot review yourself');
        return;
    }
    
    if (selectedRating === 0) {
        alert('Please select a rating');
        return;
    }
    
    const reviewText = document.getElementById('review-text').value.trim();
    
    const review = {
        rating: selectedRating,
        text: reviewText,
        reviewer: currentUser.username,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    
    // Use different path for business reviews vs seller reviews
    const reviewPath = isReviewingBusiness ? 'businessReviews/' + currentBusinessForReview : 'reviews/' + currentSellerForReview;
    
    firebase.database().ref(reviewPath).push(review);
    
    alert('Review submitted successfully!');
    selectedRating = 0;
    document.getElementById('review-text').value = '';
    updateStarDisplay();
    
    if (isReviewingBusiness) {
        loadBusinessReviews(currentBusinessForReview);
    } else {
        loadSellerReviews(currentSellerForReview);
    }
}

function loadSellerReviews(seller) {
    isReviewingBusiness = false;
    firebase.database().ref('reviews/' + seller).once('value', (snapshot) => {
        const reviewsList = document.getElementById('seller-reviews-list');
        reviewsList.innerHTML = '';
        
        if (!snapshot.exists()) {
            reviewsList.innerHTML = '<p style="color: #999;">No reviews yet</p>';
            return;
        }
        
        const reviews = [];
        snapshot.forEach((child) => {
            reviews.push({ id: child.key, ...child.val() });
        });
        
        reviews.reverse().forEach(review => {
            const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
            const date = review.timestamp ? new Date(review.timestamp).toLocaleDateString() : 'Unknown';
            
            const reviewDiv = document.createElement('div');
            reviewDiv.className = 'review-item';
            reviewDiv.innerHTML = `
                <div class="review-header">
                    <div>
                        <div class="review-author">${escapeHtml(review.reviewer)}</div>
                        <div class="review-date">${date}</div>
                    </div>
                    <div class="review-stars">${stars}</div>
                </div>
                ${review.text ? `<div class="review-text">${escapeHtml(review.text)}</div>` : ''}
            `;
            reviewsList.appendChild(reviewDiv);
        });
    });
}

function showBusinessReviewModal(businessId, businessName) {
    isReviewingBusiness = true;
    currentBusinessForReview = businessId;
    document.getElementById('seller-modal-name').textContent = businessName;
    document.getElementById('seller-info-modal').classList.add('active');
    
    // Hide seller-specific sections (wait for modal to render)
    setTimeout(() => {
        const ratingEl = document.getElementById('seller-rating');
        const contactEl = document.getElementById('seller-contact');
        const previewEl = document.getElementById('seller-products-preview');
        
        if (ratingEl) ratingEl.style.display = 'none';
        if (contactEl) contactEl.style.display = 'none';
        if (previewEl) previewEl.style.display = 'none';
    }, 0);
    
    // Reset review form
    selectedRating = 0;
    document.getElementById('review-text').value = '';
    updateStarDisplay();
    
    loadBusinessReviews(businessId);
}

function loadBusinessReviews(businessId) {
    isReviewingBusiness = true;
    currentBusinessForReview = businessId;
    firebase.database().ref('businessReviews/' + businessId).once('value', (snapshot) => {
        const reviewsList = document.getElementById('seller-reviews-list');
        reviewsList.innerHTML = '';
        
        if (!snapshot.exists()) {
            reviewsList.innerHTML = '<p style="color: #999;">No reviews yet</p>';
            return;
        }
        
        const reviews = [];
        snapshot.forEach((child) => {
            reviews.push({ id: child.key, ...child.val() });
        });
        
        reviews.reverse().forEach(review => {
            const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
            const date = review.timestamp ? new Date(review.timestamp).toLocaleDateString() : 'Unknown';
            
            const reviewDiv = document.createElement('div');
            reviewDiv.className = 'review-item';
            reviewDiv.innerHTML = `
                <div class="review-header">
                    <div>
                        <div class="review-author">${escapeHtml(review.reviewer)}</div>
                        <div class="review-date">${date}</div>
                    </div>
                    <div class="review-stars">${stars}</div>
                </div>
                ${review.text ? `<div class="review-text">${escapeHtml(review.text)}</div>` : ''}
            `;
            reviewsList.appendChild(reviewDiv);
        });
    });
}

function loadMyReviews() {
    if (!currentUser) return;
    
    firebase.database().ref('reviews/' + currentUser.username).once('value', (snapshot) => {
        const reviewsList = document.getElementById('user-reviews-list');
        reviewsList.innerHTML = '';
        
        if (!snapshot.exists()) {
            reviewsList.innerHTML = '<div class="empty-state"><p>⭐</p><p>No reviews yet</p></div>';
            
            // Update summary stats
            const avgDisplay = document.getElementById('avg-rating-display');
            const totalDisplay = document.getElementById('total-reviews-display');
            if (avgDisplay) avgDisplay.textContent = '-';
            if (totalDisplay) totalDisplay.textContent = '0';
            
            return;
        }
        
        let totalStars = 0;
        let reviewCount = 0;
        const reviews = [];
        
        snapshot.forEach((child) => {
            const review = { id: child.key, ...child.val() };
            reviews.push(review);
            totalStars += review.rating;
            reviewCount++;
        });
        
        const avgRating = (totalStars / reviewCount).toFixed(1);
        const stars = '⭐'.repeat(Math.round(avgRating));
        
        // Update summary stats in the reviews view
        const avgDisplay = document.getElementById('avg-rating-display');
        const totalDisplay = document.getElementById('total-reviews-display');
        if (avgDisplay) avgDisplay.textContent = avgRating;
        if (totalDisplay) totalDisplay.textContent = reviewCount;
        
        let html = '';
        
        reviews.reverse().forEach(review => {
            const reviewStars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
            const date = review.timestamp ? new Date(review.timestamp).toLocaleDateString() : 'Unknown';
            
            html += `
                <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                        <div>
                            <div style="font-weight: 600; color: #333; margin-bottom: 5px;">${escapeHtml(review.reviewer)}</div>
                            <div style="font-size: 12px; color: #999;">${date}</div>
                        </div>
                        <div style="color: #ffd700; font-size: 18px;">${reviewStars}</div>
                    </div>
                    ${review.text ? `<div style="color: #666; font-size: 14px; line-height: 1.6;">${escapeHtml(review.text)}</div>` : ''}
                </div>
            `;
        });
        
        reviewsList.innerHTML = html;
    });
}

function showBusinessDetail(businessId) {
    firebase.database().ref('businesses/' + businessId).once('value', (snapshot) => {
        if (snapshot.exists()) {
            const business = { id: snapshot.key, ...snapshot.val() };
            showProductDetail(business);
        }
    });
}

// Show product detail by ID (for map markers)
function showProductDetailById(productId) {
    firebase.database().ref('products/' + productId).once('value', (snapshot) => {
        if (snapshot.exists()) {
            const product = { id: snapshot.key, ...snapshot.val() };
            showProductDetail(product);
        }
    });
}

// Product Detail Modal Functions
function showProductDetail(product) {
    // Increment views for the appropriate database
    if (product.category === 'business') {
        incrementBusinessViews(product.id);
    } else {
        incrementProductViews(product.id);
    }
    
    document.getElementById('product-detail-name').textContent = product.name;
    document.getElementById('product-detail-modal').classList.add('active');
    
    // Display images or business logo
    const imagesDiv = document.getElementById('product-detail-images');
    if (product.category === 'business' && product.logo) {
        imagesDiv.innerHTML = `<div class="business-logo-container">
            <img src="${escapeHtml(product.logo)}" alt="Business logo" class="business-logo" onclick="openImageViewer('${escapeHtml(product.logo)}')">
        </div>`;
    } else if (product.images && product.images.length > 0) {
        imagesDiv.innerHTML = '';
        product.images.forEach(imageUrl => {
            const img = document.createElement('img');
            img.src = imageUrl;
            img.className = 'product-detail-image';
            img.alt = product.name;
            img.onclick = () => openImageViewer(imageUrl);
            imagesDiv.appendChild(img);
        });
    } else {
        imagesDiv.innerHTML = '<p style="color: #999; text-align: center;">No images available</p>';
    }
    
    // Display product info
    const infoDiv = document.getElementById('product-detail-info');
    const postedDate = product.timestamp ? new Date(product.timestamp).toLocaleDateString() : 'Unknown';
    
    let businessInfoHtml = '';
    if (product.category === 'business') {
        businessInfoHtml = `
            <div style="margin: 20px 0; padding: 20px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <h3 style="margin-bottom: 20px; color: #1a1a1a; border-bottom: 2px solid #00bfa5; padding-bottom: 10px;">📞 Contact Information</h3>
                <div style="display: grid; gap: 15px;">
                    <div class="contact-item" style="display: flex; align-items: center; padding: 12px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                        <span style="font-size: 24px; margin-right: 12px;">📧</span>
                        <div>
                            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">Email</div>
                            <a href="mailto:${escapeHtml(product.businessEmail)}" style="color: #00bfa5; font-weight: 600; text-decoration: none;">${escapeHtml(product.businessEmail)}</a>
                        </div>
                    </div>
                    <div class="contact-item" style="display: flex; align-items: center; padding: 12px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                        <span style="font-size: 24px; margin-right: 12px;">📱</span>
                        <div>
                            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">Phone</div>
                            <a href="tel:${escapeHtml(product.businessPhone)}" style="color: #00bfa5; font-weight: 600; text-decoration: none;">${escapeHtml(product.businessPhone)}</a>
                        </div>
                    </div>
                    <div class="contact-item" style="display: flex; align-items: center; padding: 12px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                        <span style="font-size: 24px; margin-right: 12px;">📍</span>
                        <div>
                            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">Address</div>
                            <div style="color: #333; font-weight: 500;">${escapeHtml(product.businessAddress)}</div>
                        </div>
                    </div>
                    ${product.businessWebsite ? `
                    <div class="contact-item" style="display: flex; align-items: center; padding: 12px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                        <span style="font-size: 24px; margin-right: 12px;">🌐</span>
                        <div>
                            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">Website</div>
                            <a href="${escapeHtml(product.businessWebsite)}" target="_blank" style="color: #00bfa5; font-weight: 600; text-decoration: none;">${escapeHtml(product.businessWebsite)}</a>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    let locationMapHtml = '';
    if (product.location && product.location.lat && product.location.lng) {
        locationMapHtml = `
            <div style="margin: 20px 0;">
                <h4 style="margin-bottom: 10px;">📍 Location on Map</h4>
                <div id="product-location-map" style="height: 250px; width: 100%; border-radius: 8px; border: 2px solid #e0e0e0;"></div>
            </div>
        `;
    }
    
    infoDiv.innerHTML = `
        <div class="product-detail-description">${escapeHtml(product.description)}</div>
        <div class="product-detail-meta">
            <span><strong>Category:</strong> ${escapeHtml(product.category)}</span>
            <span><strong>Posted:</strong> ${postedDate}</span>
            <span><strong>Views:</strong> 👁️ ${product.views || 0}</span>
        </div>
        ${businessInfoHtml}
        ${locationMapHtml}
    `;
    
    // Add directions button if location exists
    const locationButtonContainer = document.getElementById('product-location-button-container');
    if (product.location && product.location.lat && product.location.lng) {
        locationButtonContainer.innerHTML = `
            <button onclick="showDirectionsMap(${product.location.lat}, ${product.location.lng}, '${escapeHtml(product.name)}')" style="width: 100%; padding: 16px; margin: 20px 0; background: white; color: #333; border: 2px solid #e0e0e0; border-radius: 16px; cursor: pointer; font-weight: 600; font-size: 16px; display: flex; align-items: center; gap: 15px; transition: all 0.3s; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                <span style="font-size: 32px;">🗺️</span>
                <div style="text-align: left; flex: 1;">
                    <div style="font-size: 16px; font-weight: 700; color: #333; margin-bottom: 4px;">Get Directions</div>
                    <div style="font-size: 13px; color: #999; font-weight: 400;">View route to this location</div>
                </div>
            </button>
        `;
    } else {
        locationButtonContainer.innerHTML = '';
    }
    
    // Initialize location map if location exists
    if (product.location && product.location.lat && product.location.lng) {
        setTimeout(() => {
            const productMap = L.map('product-location-map').setView([product.location.lat, product.location.lng], 13);
            
            // Add base layers
            const streetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: 'Made and ran by networKING technologies',
                maxZoom: 19
            });
            
            const satelliteMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Made and ran by networKING technologies',
                maxZoom: 19
            });
            
            // Add default layer
            streetMap.addTo(productMap);
            
            // Add layer control
            const baseMaps = {
                "Street Map": streetMap,
                "Satellite": satelliteMap
            };
            L.control.layers(baseMaps).addTo(productMap);
            
            L.marker([product.location.lat, product.location.lng]).addTo(productMap);
            
            // Add mobile fullscreen functionality
            addMapFullscreenHandler('product-location-map', productMap);
        }, 100);
    }
    // Display seller info or business rating
    firebase.database().ref('users/' + product.seller + '/contact').once('value', (snapshot) => {
        // Use different review path for businesses vs products
        const reviewPath = product.category === 'business' ? 'businessReviews/' + product.id : 'reviews/' + product.seller;
        
        firebase.database().ref(reviewPath).once('value', (reviewSnapshot) => {
            let avgRating = 0;
            let reviewCount = 0;
            
            if (reviewSnapshot.exists()) {
                let totalStars = 0;
                reviewSnapshot.forEach((review) => {
                    totalStars += review.val().rating;
                    reviewCount++;
                });
                avgRating = (totalStars / reviewCount).toFixed(1);
            }
            
            const ratingStars = avgRating > 0 ? '⭐'.repeat(Math.round(avgRating)) : '';
            const ratingText = avgRating > 0 ? `${avgRating} (${reviewCount} reviews)` : 'No reviews';
            
            let contactHtml = '';
            if (snapshot.exists()) {
                const contact = snapshot.val();
                if (contact.email || contact.phone || contact.location) {
                    contactHtml = '<div style="margin-top: 15px;">';
                    if (contact.email) contactHtml += `<div class="contact-item">📧 <a href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a></div>`;
                    if (contact.phone) contactHtml += `<div class="contact-item">📱 <a href="tel:${escapeHtml(contact.phone)}">${escapeHtml(contact.phone)}</a></div>`;
                    if (contact.location) contactHtml += `<div class="contact-item">📍 ${escapeHtml(contact.location)}</div>`;
                    contactHtml += '</div>';
                }
            }
            
            const sellerDiv = document.getElementById('product-detail-seller');
            
            // Show different info for businesses vs products
            if (product.category === 'business') {
                // Check if current user is the owner
                const isOwner = currentUser && currentUser.username === product.seller;
                const reviewButton = isOwner ? '' : `
                    <button class="btn-primary" onclick="showBusinessReviewModal('${product.id}', '${escapeHtml(product.name)}')" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        ⭐ Write a Review
                    </button>
                `;
                
                sellerDiv.innerHTML = `
                    <h3>Business Rating</h3>
                    <div style="padding: 15px; background: #f8f9fa; border-radius: 12px; margin-bottom: 15px;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                            <span style="font-size: 24px;">⭐</span>
                            <div>
                                <div style="font-size: 20px; font-weight: 700; color: #333;">${ratingStars} ${ratingText}</div>
                                <div style="font-size: 13px; color: #666;">Customer Reviews</div>
                            </div>
                        </div>
                    </div>
                    ${reviewButton}
                `;
            } else {
                // Check if current user is the owner
                const isOwner = currentUser && currentUser.username === product.seller;
                
                if (isOwner) {
                    // Owner viewing their own product - just show rating, no review button
                    sellerDiv.innerHTML = `
                        <h3>Seller Information</h3>
                        <div style="padding: 15px; background: #f8f9fa; border-radius: 12px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span class="seller-icon-large">👤</span>
                                <div>
                                    <div class="seller-name-large">${escapeHtml(product.seller)}</div>
                                    <div class="seller-rating">${ratingStars} ${ratingText}</div>
                                </div>
                            </div>
                        </div>
                        ${contactHtml}
                    `;
                } else {
                    // Other user viewing product
                    sellerDiv.innerHTML = `
                        <h3>Seller Information</h3>
                        <button class="seller-detail-btn" onclick="showSellerInfo('${escapeHtml(product.seller)}', event)">
                            <div class="seller-detail-left">
                                <span class="seller-icon-large">👤</span>
                                <div>
                                    <div class="seller-name-large">${escapeHtml(product.seller)}</div>
                                    <div class="seller-rating">${ratingStars} ${ratingText}</div>
                                </div>
                            </div>
                            <div class="seller-detail-arrow">View Profile →</div>
                        </button>
                        ${contactHtml}
                    `;
                }
            }
        });
    });
}

function showProductDetailById(productId) {
    firebase.database().ref('products/' + productId).once('value', (snapshot) => {
        if (snapshot.exists()) {
            const product = { id: snapshot.key, ...snapshot.val() };
            closeSellerInfo(); // Close seller modal if open
            showProductDetail(product);
        }
    });
}

function showBusinessDetail(businessId) {
    firebase.database().ref('businesses/' + businessId).once('value', (snapshot) => {
        if (snapshot.exists()) {
            const business = { id: snapshot.key, ...snapshot.val() };
            closeSellerInfo(); // Close seller modal if open
            showProductDetail(business); // Reuse product detail modal
        }
    });
}

function closeProductDetail() {
    document.getElementById('product-detail-modal').classList.remove('active');
}

function openImageViewer(imageUrl) {
    const viewer = document.getElementById('image-fullscreen-viewer');
    const img = document.getElementById('fullscreen-image');
    const magnifyCircle = document.getElementById('magnify-circle');
    const magnifyContent = document.getElementById('magnify-content');
    
    img.src = imageUrl;
    viewer.style.display = 'block';
    
    // Enable hardware acceleration
    magnifyCircle.style.transform = 'translateZ(0)';
    magnifyCircle.style.willChange = 'transform';
    
    let isDragging = false;
    let animationFrame = null;
    const magnifyZoom = 2.5;
    
    // Preload background image for smoother performance
    magnifyContent.style.backgroundImage = `url('${imageUrl}')`;
    magnifyContent.style.backgroundRepeat = 'no-repeat';
    
    // Touch events for mobile with RAF throttling
    img.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            isDragging = true;
            magnifyCircle.style.display = 'block';
            updateMagnifier(e.touches[0]);
        }
    }, { passive: false });
    
    img.addEventListener('touchmove', (e) => {
        if (isDragging && e.touches.length === 1) {
            e.preventDefault();
            
            // Cancel previous frame if still pending
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
            }
            
            // Schedule update on next frame
            animationFrame = requestAnimationFrame(() => {
                updateMagnifier(e.touches[0]);
            });
        }
    }, { passive: false });
    
    img.addEventListener('touchend', () => {
        isDragging = false;
        magnifyCircle.style.display = 'none';
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }
    });
    
    // Mouse events for desktop
    img.addEventListener('mousedown', (e) => {
        isDragging = true;
        magnifyCircle.style.display = 'block';
        updateMagnifier(e);
    });
    
    img.addEventListener('mousemove', (e) => {
        if (isDragging) {
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
            }
            animationFrame = requestAnimationFrame(() => {
                updateMagnifier(e);
            });
        }
    });
    
    img.addEventListener('mouseup', () => {
        isDragging = false;
        magnifyCircle.style.display = 'none';
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }
    });
    
    img.addEventListener('mouseleave', () => {
        isDragging = false;
        magnifyCircle.style.display = 'none';
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }
    });
    
    function updateMagnifier(pointer) {
        const rect = img.getBoundingClientRect();
        const x = (pointer.clientX !== undefined ? pointer.clientX : pointer.pageX);
        const y = (pointer.clientY !== undefined ? pointer.clientY : pointer.pageY);
        
        // Position magnify circle centered on touch/cursor using transform for better performance
        const circleRadius = 75; // Half of 150px circle
        const circleX = x - circleRadius;
        const circleY = y - circleRadius;
        magnifyCircle.style.left = '0';
        magnifyCircle.style.top = '0';
        magnifyCircle.style.transform = `translate(${circleX}px, ${circleY}px) translateZ(0)`;
        
        // Calculate position in image relative to image bounds
        const imgX = x - rect.left;
        const imgY = y - rect.top;
        
        // Update magnified content - center the magnification on the exact touch point
        const bgPosX = -imgX * magnifyZoom + circleRadius;
        const bgPosY = -imgY * magnifyZoom + circleRadius;
        
        magnifyContent.style.backgroundSize = `${rect.width * magnifyZoom}px ${rect.height * magnifyZoom}px`;
        magnifyContent.style.backgroundPosition = `${bgPosX}px ${bgPosY}px`;
        magnifyContent.style.width = '150px';
        magnifyContent.style.height = '150px';
    }
}

function closeImageViewer() {
    const viewer = document.getElementById('image-fullscreen-viewer');
    const magnifyCircle = document.getElementById('magnify-circle');
    viewer.style.display = 'none';
    magnifyCircle.style.display = 'none';
}

let directionsMap = null;

function showDirectionsMap(destLat, destLng, productName) {
    document.getElementById('product-directions-modal').style.display = 'block';
    
    // Initialize map
    if (directionsMap) {
        directionsMap.remove();
    }
    
    directionsMap = L.map('directions-map').setView([destLat, destLng], 13);
    
    // Add street map
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Made and ran by networKING technologies',
        maxZoom: 19
    }).addTo(directionsMap);
    
    // Add destination marker
    const destIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background: #ff4757; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); font-size: 20px;">📍</div>`,
        iconSize: [40, 40]
    });
    
    const destMarker = L.marker([destLat, destLng], { icon: destIcon }).addTo(directionsMap);
    destMarker.bindPopup(`<b>${escapeHtml(productName)}</b>`).openPopup();
    
    // Try to get user's current location and draw route
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;
                
                // Add user location marker
                const userIcon = L.divIcon({
                    className: 'custom-marker',
                    html: `<div style="background: #4facfe; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); font-size: 20px;">📍</div>`,
                    iconSize: [40, 40]
                });
                
                const userMarker = L.marker([userLat, userLng], { icon: userIcon }).addTo(directionsMap);
                userMarker.bindPopup('<b>Your Location</b>');
                
                // Get route from OSRM (free routing service)
                const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${destLng},${destLat}?overview=full&geometries=geojson`;
                
                fetch(osrmUrl)
                    .then(response => response.json())
                    .then(data => {
                        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                            const route = data.routes[0];
                            const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
                            
                            // Draw the route following roads
                            const routeLine = L.polyline(coordinates, {
                                color: '#4facfe',
                                weight: 5,
                                opacity: 0.8
                            }).addTo(directionsMap);
                            
                            // Fit map to show route
                            directionsMap.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
                            
                            // Get distance from OSRM
                            const distanceKm = (route.distance / 1000).toFixed(2);
                            
                            // Add distance info
                            const infoBox = L.control({ position: 'topright' });
                            infoBox.onAdd = function() {
                                const div = L.DomUtil.create('div', 'info-box');
                                div.style.cssText = 'background: white; padding: 15px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); font-weight: 600;';
                                div.innerHTML = `📏 ${distanceKm} km`;
                                return div;
                            };
                            infoBox.addTo(directionsMap);
                        } else {
                            // Fallback to straight line if routing fails
                            const route = L.polyline([[userLat, userLng], [destLat, destLng]], {
                                color: '#4facfe',
                                weight: 4,
                                opacity: 0.7,
                                dashArray: '10, 10'
                            }).addTo(directionsMap);
                            
                            directionsMap.fitBounds(route.getBounds(), { padding: [50, 50] });
                            
                            const distance = directionsMap.distance([userLat, userLng], [destLat, destLng]);
                            const distanceKm = (distance / 1000).toFixed(2);
                            
                            const infoBox = L.control({ position: 'topright' });
                            infoBox.onAdd = function() {
                                const div = L.DomUtil.create('div', 'info-box');
                                div.style.cssText = 'background: white; padding: 15px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); font-weight: 600;';
                                div.innerHTML = `📏 ~${distanceKm} km (straight line)`;
                                return div;
                            };
                            infoBox.addTo(directionsMap);
                        }
                    })
                    .catch(error => {
                        console.error('Routing error:', error);
                        // Fallback to straight line
                        const route = L.polyline([[userLat, userLng], [destLat, destLng]], {
                            color: '#4facfe',
                            weight: 4,
                            opacity: 0.7,
                            dashArray: '10, 10'
                        }).addTo(directionsMap);
                        
                        directionsMap.fitBounds(route.getBounds(), { padding: [50, 50] });
                    });
            },
            (error) => {
                console.log('Geolocation error:', error);
                // Just show destination if user location fails
                directionsMap.setView([destLat, destLng], 13);
            }
        );
    }
}

function closeDirectionsMap() {
    document.getElementById('product-directions-modal').style.display = 'none';
    if (directionsMap) {
        directionsMap.remove();
        directionsMap = null;
    }
}

// Close modals when clicking outside
document.addEventListener('DOMContentLoaded', () => {
    const sellerModal = document.getElementById('seller-info-modal');
    if (sellerModal) {
        sellerModal.addEventListener('click', (e) => {
            if (e.target.id === 'seller-info-modal') {
                closeSellerInfo();
            }
        });
    }
    
    const productModal = document.getElementById('product-detail-modal');
    if (productModal) {
        productModal.addEventListener('click', (e) => {
            if (e.target.id === 'product-detail-modal') {
                closeProductDetail();
            }
        });
    }
});

// Hall Monitor / Speed Cop Functions
let speedCopMap = null;
let speedCopMarkers = [];
let addSpeedCopMap = null;
let tempSpeedCopMarker = null;
let tempSpeedCopLocation = null;

function showAddSpeedCop() {
    document.getElementById('speedcop-choice-modal').style.display = 'block';
}

function closeSpeedCopChoiceModal() {
    document.getElementById('speedcop-choice-modal').style.display = 'none';
}

let pendingSpeedCopLocation = null;

function placeSpeedCopHere() {
    closeSpeedCopChoiceModal();
    
    if (!navigator.geolocation) {
        showNotification('Geolocation is not supported by your browser', 'error');
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            // Store location and show confirmation modal
            pendingSpeedCopLocation = { lat, lng };
            document.getElementById('speedcop-confirm-modal').classList.add('active');
            
            // Set up confirm button
            document.getElementById('confirm-speedcop-report-btn').onclick = confirmSpeedCopReport;
        },
        (error) => {
            console.error('Geolocation error:', error);
            showNotification('Unable to get your location. Try "Choose on Map" instead.', 'error');
        }
    );
}

function confirmSpeedCopReport() {
    if (!pendingSpeedCopLocation) return;
    
    document.getElementById('speedcop-confirm-modal').classList.remove('active');
    
    // Save to Firebase
    const speedCopData = {
        lat: pendingSpeedCopLocation.lat,
        lng: pendingSpeedCopLocation.lng,
        reportedBy: currentUser.username,
        timestamp: Date.now(),
        expiresAt: Date.now() + (10 * 60 * 60 * 1000)
    };
    
    const speedCopRef = firebase.database().ref('speedcops').push();
    speedCopRef.set(speedCopData)
        .then(() => {
            showNotification('Speed cop reported successfully! 🚨', 'success');
            pendingSpeedCopLocation = null;
        })
        .catch(error => {
            console.error('Error reporting speed cop:', error);
            showNotification('Error reporting speed cop. Please try again.', 'error');
        });
}

function closeSpeedCopConfirmModal() {
    document.getElementById('speedcop-confirm-modal').classList.remove('active');
    pendingSpeedCopLocation = null;
}

function chooseSpeedCopLocation() {
    closeSpeedCopChoiceModal();
    document.getElementById('hall-monitor-view').style.display = 'none';
    document.getElementById('add-speedcop-map-view').style.display = 'block';
    initAddSpeedCopMap();
}

function initAddSpeedCopMap() {
    if (addSpeedCopMap) {
        addSpeedCopMap.remove();
    }
    
    tempSpeedCopMarker = null;
    tempSpeedCopLocation = null;
    document.getElementById('confirm-speedcop-btn').disabled = true;
    
    addSpeedCopMap = L.map('add-speedcop-map', {
        zoomControl: false
    }).setView([0, 0], 2);
    
    // Add street map only (no layer toggle)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Made and ran by networKING technologies',
        maxZoom: 19
    }).addTo(addSpeedCopMap);
    
    // Try to get user's location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                addSpeedCopMap.setView([position.coords.latitude, position.coords.longitude], 15);
            },
            (error) => {
                console.log('Geolocation error:', error);
                addSpeedCopMap.setView([0, 0], 2);
            }
        );
    }
    
    // Add click event to place marker
    addSpeedCopMap.on('click', (e) => {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        
        // Remove existing temp marker if any
        if (tempSpeedCopMarker) {
            addSpeedCopMap.removeLayer(tempSpeedCopMarker);
        }
        
        // Create custom icon for speed cop
        const speedCopIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background: #ff4757; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); font-size: 20px;">🚨</div>`,
            iconSize: [40, 40]
        });
        
        // Add new marker
        tempSpeedCopMarker = L.marker([lat, lng], { icon: speedCopIcon }).addTo(addSpeedCopMap);
        
        // Save temp location
        tempSpeedCopLocation = { lat, lng };
        
        // Enable confirm button
        document.getElementById('confirm-speedcop-btn').disabled = false;
    });
}

function confirmSpeedCop() {
    if (!tempSpeedCopLocation) {
        alert('Please select a location on the map first');
        return;
    }
    
    const speedCopData = {
        lat: tempSpeedCopLocation.lat,
        lng: tempSpeedCopLocation.lng,
        reportedBy: currentUser.username,
        timestamp: Date.now(),
        expiresAt: Date.now() + (10 * 60 * 60 * 1000)
    };
    
    firebase.database().ref('speedcops').push(speedCopData)
        .then(() => {
            alert('Speed cop location reported successfully!');
            closeAddSpeedCopMap();
        })
        .catch((error) => {
            console.error('Error reporting speed cop:', error);
            alert('Error reporting speed cop: ' + error.message);
        });
}

function closeAddSpeedCopMap() {
    document.getElementById('add-speedcop-map-view').style.display = 'none';
    document.getElementById('hall-monitor-view').style.display = 'block';
    if (addSpeedCopMap) {
        addSpeedCopMap.remove();
        addSpeedCopMap = null;
    }
    tempSpeedCopMarker = null;
    tempSpeedCopLocation = null;
}

function showSpeedCopMap() {
    document.getElementById('hall-monitor-view').style.display = 'none';
    document.getElementById('speedcop-map-view').style.display = 'block';
    initSpeedCopMap();
}

function initSpeedCopMap() {
    if (speedCopMap) {
        speedCopMap.remove();
    }
    
    speedCopMap = L.map('speedcop-map').setView([0, 0], 2);
    
    // Add base layers
    const streetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Made and ran by networKING technologies',
        maxZoom: 19
    });
    
    const satelliteMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Made and ran by networKING technologies',
        maxZoom: 19
    });
    
    streetMap.addTo(speedCopMap);
    
    const baseMaps = {
        "Street Map": streetMap,
        "Satellite": satelliteMap
    };
    L.control.layers(baseMaps).addTo(speedCopMap);
    
    // Try to get user's location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                speedCopMap.setView([position.coords.latitude, position.coords.longitude], 12);
                loadSpeedCops();
            },
            (error) => {
                console.log('Geolocation error:', error);
                speedCopMap.setView([0, 0], 2);
                loadSpeedCops();
            }
        );
    } else {
        loadSpeedCops();
    }
}

function loadSpeedCops() {
    // Clear existing markers
    speedCopMarkers.forEach(marker => speedCopMap.removeLayer(marker));
    speedCopMarkers = [];
    
    const now = Date.now();
    
    firebase.database().ref('speedcops').once('value', (snapshot) => {
        snapshot.forEach((childSnapshot) => {
            const speedCop = { id: childSnapshot.key, ...childSnapshot.val() };
            
            // Check if expired (10 hours = 36000000 ms)
            if (speedCop.expiresAt && speedCop.expiresAt < now) {
                // Remove expired speed cop from Firebase
                firebase.database().ref('speedcops/' + speedCop.id).remove();
                return; // Skip this marker
            }
            
            // Calculate time remaining
            const timeRemaining = speedCop.expiresAt ? speedCop.expiresAt - now : null;
            let timeRemainingText = '';
            if (timeRemaining) {
                const hoursRemaining = Math.floor(timeRemaining / (60 * 60 * 1000));
                const minutesRemaining = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));
                timeRemainingText = `<p style="margin: 0 0 8px 0; font-size: 13px; color: #ff4757; font-weight: 600;">⏱️ Expires in: ${hoursRemaining}h ${minutesRemaining}m</p>`;
            }
            
            // Create custom icon for speed cops
            const speedCopIcon = L.divIcon({
                className: 'custom-marker',
                html: `<div style="background: #ff4757; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); font-size: 20px;">🚨</div>`,
                iconSize: [40, 40]
            });
            
            const marker = L.marker([speedCop.lat, speedCop.lng], { icon: speedCopIcon });
            
            const reportedDate = new Date(speedCop.timestamp).toLocaleString();
            
            marker.bindPopup(`
                <div style="width: 200px; text-align: center;">
                    <h4 style="margin: 0 0 10px 0; font-size: 16px; color: #ff4757;">🚨 Speed Cop Alert</h4>
                    ${timeRemainingText}
                    <p style="margin: 0; font-size: 12px; color: #999;">${reportedDate}</p>
                </div>
            `);
            
            marker.addTo(speedCopMap);
            speedCopMarkers.push(marker);
        });
    });
}

function closeSpeedCopMap() {
    document.getElementById('speedcop-map-view').style.display = 'none';
    document.getElementById('hall-monitor-view').style.display = 'block';
    if (speedCopMap) {
        speedCopMap.remove();
        speedCopMap = null;
    }
}

