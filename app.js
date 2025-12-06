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

function loadProducts() {
    const productsRef = firebase.database().ref('products');
    const productsGrid = document.getElementById('products-grid');
    const loadingSpinner = document.getElementById('loading-spinner');
    
    // Show loading spinner
    productsGrid.innerHTML = '';
    loadingSpinner.style.display = 'flex';
    
    // Remove any existing listeners first
    productsRef.off('value');
    
    productsRef.orderByChild('timestamp').on('value', (snapshot) => {
        // Hide loading spinner
        loadingSpinner.style.display = 'none';
        productsGrid.innerHTML = '';

        if (!snapshot.exists()) {
            productsGrid.innerHTML = `
                <div class="empty-state">
                    <p>📦</p>
                    <p>No products yet. Be the first to post!</p>
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
    const businessesRef = firebase.database().ref('businesses');
    const businessGrid = document.getElementById('business-grid');
    const loadingSpinner = document.getElementById('loading-spinner');
    
    // Show loading spinner
    businessGrid.innerHTML = '';
    loadingSpinner.style.display = 'flex';
    
    // Remove any existing listeners first
    businessesRef.off('value');
    
    businessesRef.orderByChild('timestamp').on('value', (snapshot) => {
        // Hide loading spinner
        loadingSpinner.style.display = 'none';
        businessGrid.innerHTML = '';

        if (!snapshot.exists()) {
            businessGrid.innerHTML = `
                <div class="empty-state">
                    <p>💼</p>
                    <p>No businesses yet. Be the first to add your business!</p>
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
    const views = product.views || 0;
    
    let imagesHtml = '';
    
    // Check if this is a business listing
    if (product.category === 'business' && product.logo) {
        imagesHtml = `<div class="business-logo-container">
            <img src="${escapeHtml(product.logo)}" alt="Business logo" class="business-logo" onclick="window.open('${escapeHtml(product.logo)}', '_blank')">
        </div>`;
    } else if (product.images && product.images.length > 0) {
        imagesHtml = '<div class="product-images">';
        product.images.forEach(imageUrl => {
            imagesHtml += `<img src="${escapeHtml(imageUrl)}" alt="Product image" class="product-image" loading="lazy" onclick="window.open('${escapeHtml(imageUrl)}', '_blank')">`;
        });
        imagesHtml += '</div>';
    }
    
    // Get seller rating
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
        
        card.innerHTML = `
            <div class="product-header">
                <div>
                    <div class="product-name">${escapeHtml(product.name)}</div>
                    <div class="product-stats">👁️ ${views} views</div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <button class="bookmark-btn ${isBookmarked ? 'bookmarked' : ''}" onclick="toggleBookmark('${product.id}', event)">
                        ${isBookmarked ? '⭐' : '☆'}
                    </button>
                    <div class="product-price">$${formattedPrice}</div>
                </div>
            </div>
            ${imagesHtml}
            <div class="product-description">${escapeHtml(product.description)}</div>
            <div class="product-footer">
                <button class="seller-badge-btn" onclick="showSellerInfo('${escapeHtml(product.seller)}', event)">
                    <span class="seller-icon">👤</span>
                    <div class="seller-info">
                        <div class="seller-name">${escapeHtml(product.seller)}</div>
                        <div class="seller-rating">${ratingStars} ${ratingText}</div>
                    </div>
                </button>
                <span class="product-category">${escapeHtml(product.category)}</span>
            </div>
        `;
    });
    
    // Open product detail when card is clicked
    card.addEventListener('click', (e) => {
        if (!e.target.classList.contains('bookmark-btn') && 
            !e.target.closest('.bookmark-btn') &&
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
    
    // Get seller rating
    firebase.database().ref('reviews/' + business.seller).once('value', (reviewSnapshot) => {
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
        `;
    });
    
    card.onclick = (e) => {
        if (!e.target.classList.contains('bookmark-btn') && 
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
    
    mainMenu.style.display = 'none';
    mainHeader.style.display = 'none';
    
    if (category === 'location') {
        categoryHeader.style.display = 'none';
        productsGrid.style.display = 'none';
        businessGrid.style.display = 'none';
        locationMapView.style.display = 'block';
        initLocationMainMap();
    } else if (category === 'business') {
        categoryHeader.style.display = 'block';
        addBtn.textContent = '+ Add Business';
        productsGrid.style.display = 'none';
        businessGrid.style.display = 'grid';
        locationMapView.style.display = 'none';
        loadBusinesses();
    } else {
        categoryHeader.style.display = 'block';
        addBtn.textContent = '+ Add Product';
        productsGrid.style.display = 'grid';
        businessGrid.style.display = 'none';
        locationMapView.style.display = 'none';
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
    
    mainMenu.style.display = 'grid';
    mainHeader.style.display = 'flex';
    categoryHeader.style.display = 'none';
    productsGrid.style.display = 'none';
    businessGrid.style.display = 'none';
    locationMapView.style.display = 'none';
    
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
function showSettings() {
    document.getElementById('settings-modal').classList.add('active');
    showSettingsTab('my-posts');
}

function closeSettings() {
    document.getElementById('settings-modal').classList.remove('active');
}

function showSettingsTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.settings-tab').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Show/hide content
    document.getElementById('my-posts-tab').style.display = tab === 'my-posts' ? 'block' : 'none';
    document.getElementById('bookmarks-tab').style.display = tab === 'bookmarks' ? 'block' : 'none';
    document.getElementById('contact-info-tab').style.display = tab === 'contact-info' ? 'block' : 'none';
    document.getElementById('reviews-tab').style.display = tab === 'reviews' ? 'block' : 'none';
    
    if (tab === 'my-posts') {
        loadUserPosts();
    } else if (tab === 'bookmarks') {
        loadBookmarks();
    } else if (tab === 'contact-info') {
        loadContactInfo();
    } else if (tab === 'reviews') {
        loadMyReviews();
    }
}

function loadUserPosts() {
    if (!currentUser) return;
    
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
    
    card.innerHTML = `
        <div class="product-header">
            <div>
                <div class="product-name">${escapeHtml(product.name)}</div>
                <div class="product-stats">👁️ ${views} views</div>
            </div>
            <div class="product-price">$${formattedPrice}</div>
        </div>
        ${imagesHtml}
        <div class="product-description">${escapeHtml(product.description)}</div>
        <div class="product-footer">
            <span class="product-category">${escapeHtml(product.category)}</span>
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
function deleteMyProduct(productId, productName) {
    if (!confirm(`Are you sure you want to delete "${productName}"?`)) {
        return;
    }
    
    firebase.database().ref('products/' + productId).remove()
        .then(() => {
            alert('Product deleted successfully');
            loadUserPosts(); // Reload the list
        })
        .catch((error) => {
            console.error('Error deleting product:', error);
            alert('Error deleting product: ' + error.message);
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

function showSellerInfo(seller, event) {
    event.stopPropagation();
    currentSellerForReview = seller;
    
    document.getElementById('seller-modal-name').textContent = seller;
    document.getElementById('seller-info-modal').classList.add('active');
    
    // Load seller rating
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
    
    if (currentUser.username === currentSellerForReview) {
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
    
    firebase.database().ref('reviews/' + currentSellerForReview).push(review);
    
    alert('Review submitted successfully!');
    selectedRating = 0;
    document.getElementById('review-text').value = '';
    updateStarDisplay();
    loadSellerReviews(currentSellerForReview);
}

function loadSellerReviews(seller) {
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

function loadMyReviews() {
    if (!currentUser) return;
    
    firebase.database().ref('reviews/' + currentUser.username).once('value', (snapshot) => {
        const reviewsList = document.getElementById('user-reviews-list');
        reviewsList.innerHTML = '';
        
        if (!snapshot.exists()) {
            reviewsList.innerHTML = '<div class="empty-state"><p>⭐</p><p>No reviews yet</p></div>';
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
        
        let html = `
            <div class="seller-rating">
                <h3>Your Overall Rating</h3>
                <div class="rating-stars">${stars}</div>
                <div class="rating-count">${avgRating} out of 5 (${reviewCount} reviews)</div>
            </div>
        `;
        
        reviews.reverse().forEach(review => {
            const reviewStars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
            const date = review.timestamp ? new Date(review.timestamp).toLocaleDateString() : 'Unknown';
            
            html += `
                <div class="review-item">
                    <div class="review-header">
                        <div>
                            <div class="review-author">${escapeHtml(review.reviewer)}</div>
                            <div class="review-date">${date}</div>
                        </div>
                        <div class="review-stars">${reviewStars}</div>
                    </div>
                    ${review.text ? `<div class="review-text">${escapeHtml(review.text)}</div>` : ''}
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
            <img src="${escapeHtml(product.logo)}" alt="Business logo" class="business-logo" onclick="window.open('${escapeHtml(product.logo)}', '_blank')">
        </div>`;
    } else if (product.images && product.images.length > 0) {
        imagesDiv.innerHTML = '';
        product.images.forEach(imageUrl => {
            const img = document.createElement('img');
            img.src = imageUrl;
            img.className = 'product-detail-image';
            img.alt = product.name;
            img.onclick = () => window.open(imageUrl, '_blank');
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
    
    // Initialize location map if location exists
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
    // Display seller info
    firebase.database().ref('users/' + product.seller + '/contact').once('value', (snapshot) => {
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

