// Sayı maskeleme (Thousand separator helper)
function formatNumberWithDots(val) {
    let num = val.replace(/\D/g, '');
    if (!num) return '';
    return new Intl.NumberFormat('tr-TR').format(parseInt(num));
}

document.addEventListener('DOMContentLoaded', () => {
    // Premium Mouse Move Glow Effect inside the card (if present on page)
    const card = document.getElementById('main-card');
    if (card) {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    }

    // ==========================================
    // DETECT PAGE TYPE
    // ==========================================
    const isAdminPage = document.body.classList.contains('admin-page');

    if (!isAdminPage) {
        initLandingPage();
    } else {
        initAdminPage();
    }
});

// ==========================================
// LANDING PAGE LOGIC (index.html)
// ==========================================
function initLandingPage() {
    const openModalBtns = document.querySelectorAll('#open-sell-modal, #open-sell-modal-2, #open-sell-modal-3');
    const closeModalBtn = document.getElementById('close-sell-modal');
    const modal = document.getElementById('sell-modal');
    const form = document.getElementById('car-upload-form');
    const fileInput = document.getElementById('car-images');
    const previewContainer = document.getElementById('image-preview-container');
    const submitBtn = document.getElementById('submit-car-btn');

    let selectedFiles = []; // Sıkıştırılmış Base64 görsel verilerini tutar

    // Model yılı seçeneklerini dinamik oluştur (Gelecek yıl dahil 1970'e kadar)
    const yearSelect = document.getElementById('car-year');
    if (yearSelect) {
        let yearsHtml = '<option value="" disabled selected>Seçin</option>';
        const maxYear = new Date().getFullYear() + 1;
        for (let y = maxYear; y >= 1970; y--) {
            yearsHtml += `<option value="${y}">${y}</option>`;
        }
        yearSelect.innerHTML = yearsHtml;
    }

    // Modal aç / kapat
    if (openModalBtns.length > 0 && modal) {
        openModalBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
            });
        });
    }

    if (closeModalBtn && modal) {
        closeModalBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            document.body.style.overflow = 'auto';
            form.reset();
            previewContainer.innerHTML = '';
            selectedFiles = [];
        });
    }

    // Telefon inputuna tıklandığında otomatik '0' ekleme ve imleci sona taşıma
    const phoneInput = document.getElementById('seller-phone');
    if (phoneInput) {
        phoneInput.addEventListener('focus', () => {
            if (phoneInput.value.trim() === '') {
                phoneInput.value = '0';
            }
            // İmleci (kürsör) sıfırın sağına (sona) yerleştir
            setTimeout(() => {
                const valLength = phoneInput.value.length;
                phoneInput.setSelectionRange(valLength, valLength);
            }, 10);
        });
        phoneInput.addEventListener('blur', () => {
            if (phoneInput.value.trim() === '0') {
                phoneInput.value = '';
            }
        });
    }

    // Fiyat alanına nokta maskelemesi ekleme (1.250.000 gibi)
    const priceInput = document.getElementById('car-price');
    if (priceInput) {
        priceInput.addEventListener('input', (e) => {
            let cursorPosition = e.target.selectionStart;
            let originalLength = e.target.value.length;
            
            let formatted = formatNumberWithDots(e.target.value);
            e.target.value = formatted;
            
            // İmleç konumunu koru
            let newLength = formatted.length;
            cursorPosition = cursorPosition + (newLength - originalLength);
            e.target.setSelectionRange(cursorPosition, cursorPosition);
        });
    }

    // Dosya seçimi ve sıkıştırma
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            
            // Maksimum 5 resim kontrolü
            if (selectedFiles.length + files.length > 5) {
                alert('En fazla 5 adet görsel yükleyebilirsiniz.');
                fileInput.value = '';
                return;
            }

            for (const file of files) {
                if (!file.type.startsWith('image/')) continue;
                
                try {
                    // Resmi sıkıştırıp doğrudan Base64 formatına çevir
                    const base64Data = await compressAndGetBase64(file, 600, 0.5); // Boyutu küçük tutmak için 600px ve 0.5 kalite
                    
                    selectedFiles.push({
                        base64: base64Data,
                        name: file.name
                    });

                    // Önizleme kartını ekle
                    renderPreview();
                } catch (error) {
                    console.error('Resim sıkıştırma hatası:', error);
                }
            }
            
            fileInput.value = ''; // Inputu temizle
        });
    }

    // Önizleme galerisini çiz
    function renderPreview() {
        previewContainer.innerHTML = '';
        selectedFiles.forEach((fileObj, index) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item';
            
            const img = document.createElement('img');
            img.src = fileObj.base64;
            
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'preview-remove-btn';
            removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            removeBtn.addEventListener('click', () => {
                selectedFiles.splice(index, 1);
                renderPreview();
            });

            previewItem.appendChild(img);
            previewItem.appendChild(removeBtn);
            previewContainer.appendChild(previewItem);
        });
    }

    // Form Gönderim İşlemi
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!db) {
                alert('Firebase veritabanı henüz yapılandırılmadı. Lütfen firebase-config.js dosyasını kontrol edin.');
                return;
            }

            if (selectedFiles.length === 0) {
                alert('Lütfen en az 1 adet araç resmi yükleyin.');
                return;
            }

            // Gönderim butonunu kilitle ve yükleme durumuna al
            submitBtn.disabled = true;
            const originalBtnHtml = submitBtn.innerHTML;
            submitBtn.innerHTML = '<span class="spinner"></span> İlanınız Gönderiliyor...';

            try {
                // Sıkıştırılmış base64 listesini al
                const imageUrls = selectedFiles.map(f => f.base64);

                // Form verilerini Firebase Firestore'a kaydet (Detaylı şablon ile)
                const carData = {
                    brandModel: document.getElementById('car-brand-model').value.trim(),
                    year: parseInt(document.getElementById('car-year').value),
                    fuel: document.getElementById('car-fuel').value.trim(),
                    transmission: document.getElementById('car-transmission').value,
                    city: document.getElementById('car-city').value.trim(),
                    km: document.getElementById('car-km').value.trim(),
                    paint: document.getElementById('car-paint').value.trim(),
                    replaced: document.getElementById('car-replaced').value.trim(),
                    tramer: document.getElementById('car-tramer').value.trim(),
                    price: parseFloat(document.getElementById('car-price').value.replace(/\./g, '')),
                    sellerPhone: (() => {
                        let phone = document.getElementById('seller-phone').value.trim();
                        if (phone && !phone.startsWith('0')) {
                            phone = '0' + phone;
                        }
                        return phone;
                    })(),
                    description: document.getElementById('car-description').value.trim(),
                    images: imageUrls,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                };

                await db.collection('listings').add(carData);

                // Başarı durumunda modalı kapat ve temizle
                alert('Harika! İlan talebiniz başarıyla alındı. Yönetici onayından sonra WhatsApp grubumuzda paylaşılacaktır.');
                closeModalBtn.click();
            } catch (error) {
                console.error('İlan gönderme hatası:', error);
                alert('İlan gönderilirken bir hata oluştu: ' + error.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHtml;
            }
        });
    }

    // 4. ANASAYFA VITRIN YÜKLEYİCİSİ (İndeks gereksinimini kaldırmak için client-side filtreleme yapıyoruz)
    const showcaseContainer = document.getElementById('showcase-container');
    if (showcaseContainer && db) {
        db.collection('listings')
            .orderBy('timestamp', 'desc')
            .onSnapshot((snapshot) => {
                renderShowcaseListings(snapshot);
            }, (error) => {
                console.error("Vitrin verileri çekilirken hata oluştu:", error);
                showcaseContainer.innerHTML = `<div class="empty-state" style="color: #ff4a4a;"><i class="fa-solid fa-triangle-exclamation"></i> Vitrin ilanları yüklenemedi.</div>`;
            });
    }

    function renderShowcaseListings(snapshot) {
        showcaseContainer.innerHTML = '';
        // İndeks hatası almamak için vitrin filtresini burada yapıyoruz
        const docs = snapshot.docs.filter(doc => doc.data().showcase === true);
        
        if (docs.length === 0) {
            showcaseContainer.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1; text-align: center; color: rgba(255,255,255,0.4); padding: 60px 0; background: rgba(255,255,255,0.01); border: 1px dashed rgba(255,255,255,0.1); border-radius: 24px;">
                    <i class="fa-solid fa-car-side" style="font-size: 3rem; color: var(--gold-primary); margin-bottom: 15px; display: block;"></i>
                    Şu an yayında vitrin ilanı bulunmamaktadır.
                </div>
            `;
            return;
        }

        docs.forEach(doc => {
            const id = doc.id;
            const data = doc.data();
            
            // Fiyat formatlama
            const formattedPrice = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(data.price || 0);
            
            // Tarih formatlama
            let dateStr = 'Yeni İlan';
            if (data.timestamp) {
                const dateVal = data.timestamp.toDate();
                dateStr = dateVal.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
            }

            const coverImage = (data.images && data.images.length > 0) ? data.images[0] : 'logo.jpg';
            
            // Küçük resimler (Görsel galerisi)
            let thumbsHtml = '';
            if (data.images && data.images.length > 1) {
                thumbsHtml += `<div class="showcase-gallery-thumbs">`;
                data.images.forEach((img, idx) => {
                    thumbsHtml += `
                        <div class="showcase-thumb ${idx === 0 ? 'active' : ''}" onclick="event.stopPropagation(); changeShowcaseMainImage('${id}', '${img}', this)">
                            <img src="${img}" alt="Görsel ${idx+1}">
                        </div>
                    `;
                });
                thumbsHtml += `</div>`;
            }

            const card = document.createElement('div');
            card.className = 'showcase-card';
            card.id = `showcase-${id}`;
            card.innerHTML = `
                <div class="showcase-card-img-wrapper">
                    <img src="${coverImage}" id="showcase-main-img-${id}" class="showcase-card-img" alt="${data.brandModel}">
                    <span class="showcase-card-badge">${data.year || '-'}</span>
                    ${thumbsHtml}
                </div>
                <div class="showcase-card-content">
                    <h3 class="showcase-card-title">${data.brandModel || 'Araç İlanı'}</h3>
                    <div class="showcase-card-meta">
                        <i class="fa-solid fa-calendar-days"></i> ${dateStr}
                    </div>
                    
                    <div class="showcase-card-details-grid">
                        <div class="showcase-detail-item">
                            <i class="fa-solid fa-gauge-high"></i>
                            <span>${data.km ? parseInt(data.km).toLocaleString('tr-TR') : '-'} KM</span>
                        </div>
                        <div class="showcase-detail-item">
                            <i class="fa-solid fa-gas-pump"></i>
                            <span>${data.fuel || '-'}</span>
                        </div>
                        <div class="showcase-detail-item">
                            <i class="fa-solid fa-gears"></i>
                            <span>${data.transmission || '-'}</span>
                        </div>
                        <div class="showcase-detail-item">
                            <i class="fa-solid fa-location-dot"></i>
                            <span>${data.city || '-'}</span>
                        </div>
                        <div class="showcase-detail-item" style="grid-column: span 2;">
                            <i class="fa-solid fa-palette"></i>
                            <span><strong>Boya:</strong> ${data.paint || '-'}</span>
                        </div>
                        <div class="showcase-detail-item" style="grid-column: span 2;">
                            <i class="fa-solid fa-wrench"></i>
                            <span><strong>Değişen:</strong> ${data.replaced || '-'}</span>
                        </div>
                        <div class="showcase-detail-item" style="grid-column: span 2;">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                            <span><strong>Tramer:</strong> ${data.tramer || '-'}</span>
                        </div>
                    </div>

                    <p class="showcase-card-desc" style="white-space: pre-line;">${data.description || 'Açıklama belirtilmedi.'}</p>
                    
                    <div class="showcase-card-footer">
                        <div class="showcase-card-price">${formattedPrice}</div>
                        <!-- SATICI NUMARASI GİZLENMİŞTİR - YÖNLENDİRME DESTEK HATTINADIR -->
                        <button class="showcase-card-btn" onclick="contactShowcaseAdmin('${id}', '${data.brandModel.replace(/'/g, "\\'")}', '${formattedPrice}')">
                            <i class="fa-brands fa-whatsapp"></i> Bilgi Al
                        </button>
                    </div>
                </div>
            `;
            showcaseContainer.appendChild(card);
        });
    }

    // Küçük resme tıklandığında ana görseli değiştirme helper'ı
    window.changeShowcaseMainImage = function(id, src, thumbEl) {
        const mainImg = document.getElementById(`showcase-main-img-${id}`);
        if (mainImg) {
            mainImg.src = src;
        }
        // Aktif sınıfını güncelle
        const cardEl = document.getElementById(`showcase-${id}`);
        if (cardEl) {
            cardEl.querySelectorAll('.showcase-thumb').forEach(t => t.classList.remove('active'));
        }
        thumbEl.classList.add('active');
    };

    // Alıcıyı WhatsApp kanalına yönlendirme
    window.contactShowcaseAdmin = function(id, brandModel, price) {
        window.open('https://whatsapp.com/channel/0029VbD8ByE1NCrdySn50k1u', '_blank');
    };
}

// ==========================================
// ADMIN PANEL LOGIC (admin.html)
// ==========================================
function initAdminPage() {
    const authOverlay = document.getElementById('admin-auth-overlay');
    const loginForm = document.getElementById('admin-login-form');
    const passwordInput = document.getElementById('admin-password');
    const authErrorMsg = document.getElementById('auth-error-msg');
    const logoutBtn = document.getElementById('admin-logout-btn');
    const settingsForm = document.getElementById('settings-form');
    const listingsContainer = document.getElementById('listings-container');
    const listingsCountBadge = document.getElementById('listings-count');

    // Düzenleme Modalı Elemanları
    const editModal = document.getElementById('edit-modal');
    const closeEditModalBtn = document.getElementById('close-edit-modal');
    const editForm = document.getElementById('car-edit-form');
    const editFileInput = document.getElementById('edit-car-images');
    const editPreviewContainer = document.getElementById('edit-image-preview-container');
    
    window.editSelectedFiles = []; // Düzenlenen ilan için yeni seçilen resimler

    // Fiyat alanına nokta maskelemesi ekleme (1.250.000 gibi)
    const editPriceInput = document.getElementById('edit-car-price');
    if (editPriceInput) {
        editPriceInput.addEventListener('input', (e) => {
            let cursorPosition = e.target.selectionStart;
            let originalLength = e.target.value.length;
            
            let formatted = formatNumberWithDots(e.target.value);
            e.target.value = formatted;
            
            // İmleç konumunu koru
            let newLength = formatted.length;
            cursorPosition = cursorPosition + (newLength - originalLength);
            e.target.setSelectionRange(cursorPosition, cursorPosition);
        });
    }

    // Düzenleme görselleri dosya değişimi
    if (editFileInput) {
        editFileInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (window.editSelectedFiles.length + files.length > 5) {
                alert('En fazla 5 adet görsel yükleyebilirsiniz.');
                editFileInput.value = '';
                return;
            }
            for (const file of files) {
                if (!file.type.startsWith('image/')) continue;
                try {
                    const base64Data = await compressAndGetBase64(file, 600, 0.5);
                    window.editSelectedFiles.push({
                        base64: base64Data,
                        name: file.name
                    });
                    renderEditPreview();
                } catch (error) {
                    console.error('Resim sıkıştırma hatası:', error);
                }
            }
            editFileInput.value = '';
        });
    }

    function renderEditPreview() {
        editPreviewContainer.innerHTML = '';
        window.editSelectedFiles.forEach((fileObj, index) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item';
            
            const img = document.createElement('img');
            img.src = fileObj.base64;
            
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'preview-remove-btn';
            removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            removeBtn.addEventListener('click', () => {
                window.editSelectedFiles.splice(index, 1);
                renderEditPreview();
            });

            if (index === 0) {
                const badge = document.createElement('span');
                badge.className = 'cover-badge';
                badge.innerText = 'Kapak';
                previewItem.appendChild(badge);
            }

            previewItem.appendChild(img);
            previewItem.appendChild(removeBtn);
            editPreviewContainer.appendChild(previewItem);
        });
    }

    // Türkiye'nin 81 İli Listesi
    const TURKEY_CITIES = ["Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Amasya", "Ankara", "Antalya", "Artvin", "Aydın", "Balıkesir", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkari", "Hatay", "Isparta", "Mersin", "İstanbul", "İzmir", "Kars", "Kastamonu", "Kayseri", "Kırklareli", "Kırşehir", "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Kahramanmaraş", "Mardin", "Muğla", "Muş", "Nevşehir", "Niğde", "Ordu", "Rize", "Sakarya", "Samsun", "Siirt", "Sinop", "Sivas", "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Şanlıurfa", "Uşak", "Van", "Yozgat", "Zonguldak", "Aksaray", "Bayburt", "Karaman", "Kırıkkale", "Batman", "Şırnak", "Bartın", "Ardahan", "Iğdır", "Yalova", "Karabük", "Kilis", "Osmaniye", "Düzce"];

    const editYearSelect = document.getElementById('edit-car-year');
    if (editYearSelect) {
        let yearsHtml = '<option value="" disabled selected>Seçin</option>';
        const maxYear = new Date().getFullYear() + 1;
        for (let y = maxYear; y >= 1970; y--) {
            yearsHtml += `<option value="${y}">${y}</option>`;
        }
        editYearSelect.innerHTML = yearsHtml;
    }

    const editCitySelect = document.getElementById('edit-car-city');
    if (editCitySelect) {
        let citiesHtml = '<option value="" disabled selected>Seçin</option>';
        TURKEY_CITIES.forEach(c => {
            citiesHtml += `<option value="${c}">${c}</option>`;
        });
        editCitySelect.innerHTML = citiesHtml;
    }

    if (closeEditModalBtn && editModal) {
        closeEditModalBtn.addEventListener('click', () => {
            editModal.classList.remove('active');
        });
    }

    const editPhoneInput = document.getElementById('edit-seller-phone');
    if (editPhoneInput) {
        editPhoneInput.addEventListener('focus', () => {
            if (editPhoneInput.value.trim() === '') {
                editPhoneInput.value = '0';
            }
            setTimeout(() => {
                const valLength = editPhoneInput.value.length;
                editPhoneInput.setSelectionRange(valLength, valLength);
            }, 10);
        });
        editPhoneInput.addEventListener('blur', () => {
            if (editPhoneInput.value.trim() === '0') {
                editPhoneInput.value = '';
            }
        });
    }

    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-car-id').value;
            const submitBtn = document.getElementById('submit-edit-btn');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner"></span> Kaydediliyor...';
            
            let phoneVal = document.getElementById('edit-seller-phone').value.trim();
            if (phoneVal && !phoneVal.startsWith('0')) {
                phoneVal = '0' + phoneVal;
            }

            try {
                const updateData = {
                    brandModel: document.getElementById('edit-car-brand-model').value.trim(),
                    year: parseInt(document.getElementById('edit-car-year').value),
                    fuel: document.getElementById('edit-car-fuel').value,
                    transmission: document.getElementById('edit-car-transmission').value,
                    city: document.getElementById('edit-car-city').value,
                    km: document.getElementById('edit-car-km').value.trim(),
                    paint: document.getElementById('edit-car-paint').value.trim(),
                    replaced: document.getElementById('edit-car-replaced').value.trim(),
                    tramer: document.getElementById('edit-car-tramer').value.trim(),
                    price: parseFloat(document.getElementById('edit-car-price').value.replace(/\./g, '')),
                    sellerPhone: phoneVal,
                    description: document.getElementById('edit-car-description').value.trim()
                };

                // Eğer yeni görsel yüklenmişse veritabanındaki görselleri değiştir
                if (window.editSelectedFiles.length > 0) {
                    updateData.images = window.editSelectedFiles.map(f => f.base64);
                }

                await db.collection('listings').doc(id).update(updateData);
                alert('İlan başarıyla güncellendi.');
                editModal.classList.remove('active');
            } catch (error) {
                console.error("Güncelleme hatası:", error);
                alert("İlan güncellenirken bir hata oluştu: " + error.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span class="btn-text"><i class="fa-solid fa-save"></i> Güncellemeleri Kaydet</span>';
            }
        });
    }

    // 1. AYARLARI FİREBASE'DEN ÇEK VE YÜKLE
    let systemConfig = {
        apiProvider: 'green-api',
        apiInstanceId: '',
        apiToken: '',
        apiChatId: '',
        adminPass: '12345'
    };

    const loginSubmitBtn = loginForm ? loginForm.querySelector('.btn-form-submit') : null;
    const originalLoginBtnText = loginSubmitBtn ? loginSubmitBtn.innerHTML : '';

    if (loginSubmitBtn) {
        loginSubmitBtn.disabled = true;
        loginSubmitBtn.innerHTML = '<span class="spinner"></span> Yükleniyor...';
    }

    async function loadConfig() {
        if (!db) return;
        try {
            const doc = await db.collection('settings').doc('config').get();
            if (doc.exists) {
                systemConfig = doc.data();
            } else {
                // Varsayılan ayarları oluştur
                await db.collection('settings').doc('config').set(systemConfig);
            }
        } catch (err) {
            console.error("Sistem ayarları yüklenemedi:", err);
        }
    }

    // Firebase'den ayarlar yüklendikten sonra kontrolü yap
    loadConfig().then(() => {
        if (loginSubmitBtn) {
            loginSubmitBtn.disabled = false;
            loginSubmitBtn.innerHTML = originalLoginBtnText;
        }

        // Zaten giriş yapılmış mı kontrol et
        if (sessionStorage.getItem('admin_logged') === 'true') {
            authOverlay.style.display = 'none';
            loadAdminPanel();
        }

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const inputPass = passwordInput.value;
                if (inputPass === (systemConfig.adminPass || '12345')) {
                    sessionStorage.setItem('admin_logged', 'true');
                    authOverlay.style.display = 'none';
                    authErrorMsg.style.display = 'none';
                    loadAdminPanel();
                } else {
                    authErrorMsg.style.display = 'block';
                    passwordInput.value = '';
                }
            });
        }
    });

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('admin_logged');
            window.location.reload();
        });
    }

    // 2. PANEL ANA İŞLEVLERİ YÜKLE
    function loadAdminPanel() {
        // Ayarları Firebase'den gelen verilerle form alanlarına yükle
        document.getElementById('api-provider').value = systemConfig.apiProvider || 'green-api';
        document.getElementById('api-instance-id').value = systemConfig.apiInstanceId || '';
        document.getElementById('api-token').value = systemConfig.apiToken || '';
        document.getElementById('api-chat-id').value = systemConfig.apiChatId || '';
        document.getElementById('settings-admin-password').value = systemConfig.adminPass || '12345';
        if (document.getElementById('settings-support-phone')) {
            document.getElementById('settings-support-phone').value = systemConfig.supportPhone || '';
        }

        // Ayarları Kaydetme
        if (settingsForm) {
            settingsForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const saveBtn = settingsForm.querySelector('.btn-settings-save');
                const origText = saveBtn.innerText;
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<span class="spinner"></span> Kaydediliyor...';

                systemConfig = {
                    apiProvider: document.getElementById('api-provider').value,
                    apiInstanceId: document.getElementById('api-instance-id').value.trim(),
                    apiToken: document.getElementById('api-token').value.trim(),
                    apiChatId: document.getElementById('api-chat-id').value.trim(),
                    adminPass: document.getElementById('settings-admin-password').value.trim() || '12345',
                    supportPhone: document.getElementById('settings-support-phone') ? document.getElementById('settings-support-phone').value.trim() : ''
                };

                try {
                    await db.collection('settings').doc('config').set(systemConfig);
                    alert('Ayarlar veritabanına başarıyla kaydedildi.');
                } catch (err) {
                    console.error("Ayarlar kaydedilemedi:", err);
                    alert("Ayarlar kaydedilirken hata oluştu: " + err.message);
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.innerText = origText;
                }
            });
        }

        // Firebase Firestore'dan ilanları gerçek zamanlı dinle
        if (db) {
            db.collection('listings').orderBy('timestamp', 'desc').onSnapshot((snapshot) => {
                renderListings(snapshot);
            }, (error) => {
                console.error("Veriler çekilirken hata oluştu:", error);
                listingsContainer.innerHTML = `<div class="empty-state" style="color: #ff4a4a;"><i class="fa-solid fa-triangle-exclamation"></i> Veritabanı bağlantı hatası! Lütfen kuralları (Rules) kontrol edin.</div>`;
            });
        } else {
            listingsContainer.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i> Lütfen önce firebase-config.js dosyasını yapılandırın!</div>`;
        }
    }

    // İlanları listele
    function renderListings(snapshot) {
        listingsContainer.innerHTML = '';
        const docs = snapshot.docs;
        
        // Vitrin ve WhatsApp istatistiklerini hesapla
        const totalCount = docs.length;
        const showcaseCount = docs.filter(doc => doc.data().showcase === true).length;
        const wpSharedCount = docs.filter(doc => doc.data().wpShared === true).length;
        listingsCountBadge.innerHTML = `${totalCount} İlan <span style="color: #4ade80; margin-left: 6px; font-weight: 800;">(${showcaseCount} Vitrinde | ${wpSharedCount} WhatsApp'ta)</span>`;

        if (docs.length === 0) {
            listingsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-circle-check" style="color: var(--gold-primary);"></i>
                    <p>Mükemmel! Bekleyen herhangi bir ilan talebi yok.</p>
                </div>`;
            return;
        }

        docs.forEach((doc) => {
            const data = doc.data();
            const id = doc.id;
            const formattedPrice = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(data.price);
            const dateStr = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleString('tr-TR') : 'Yükleniyor...';
            
            // Görsel galerisi hazırlığı
            const mainImg = data.images[0] || 'logo.jpg';
            let thumbsHtml = '';
            if (data.images && data.images.length > 0) {
                data.images.forEach((imgUrl, idx) => {
                    thumbsHtml += `<img src="${imgUrl}" class="listing-thumb-img ${idx === 0 ? 'active' : ''}" data-index="${idx}" alt="Önizleme">`;
                });
            }

            const card = document.createElement('div');
            card.className = 'listing-card';
            card.id = `card-${id}`;
            
            // Yayınlanma durumuna göre yeşil veya kırmızı çerçeve rengi
            card.style.border = `2px solid ${data.showcase ? '#4ade80' : '#ef4444'}`;
            card.style.boxShadow = data.showcase ? '0 8px 32px rgba(74, 222, 128, 0.08)' : '0 8px 32px rgba(239, 68, 68, 0.05)';
            card.style.transition = 'all 0.3s ease';

            card.innerHTML = `
                <div class="listing-media">
                    <img src="${mainImg}" class="listing-main-img" id="main-img-${id}" alt="Araç Görseli">
                    <div class="listing-thumbs">
                        ${thumbsHtml}
                    </div>
                </div>
                <div class="listing-info">
                    <div class="listing-info-header">
                        <!-- Yayınlanma Durum Rozetleri -->
                        <div class="publication-status" style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
                            <span class="status-badge" style="padding: 4px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; background: ${data.showcase ? 'rgba(74, 222, 128, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; color: ${data.showcase ? '#4ade80' : '#ef4444'}; border: 1px solid ${data.showcase ? 'rgba(74, 222, 128, 0.2)' : 'rgba(239, 68, 68, 0.2)'};">
                                <i class="fa-solid ${data.showcase ? 'fa-eye' : 'fa-eye-slash'}"></i>
                                ${data.showcase ? 'Vitrinde Yayında' : 'Vitrinde Yayında Değil'}
                            </span>
                            <span class="status-badge" style="padding: 4px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; background: ${data.wpShared ? 'rgba(74, 222, 128, 0.1)' : 'rgba(255, 255, 255, 0.05)'}; color: ${data.wpShared ? '#4ade80' : 'rgba(255,255,255,0.4)'}; border: 1px solid ${data.wpShared ? 'rgba(74, 222, 128, 0.2)' : 'rgba(255,255,255,0.1)'};">
                                <i class="fa-brands fa-whatsapp"></i>
                                ${data.wpShared ? 'WhatsApp\'ta Paylaşıldı' : 'WhatsApp\'ta Paylaşılmadı'}
                            </span>
                        </div>
                        <div class="listing-brand-model">${data.brandModel || 'Araç İlanı'}</div>
                        <div class="listing-meta" style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; margin: 10px 0; font-size: 0.8rem; background: rgba(255,255,255,0.02); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.04);">
                            <span><i class="fa-solid fa-calendar-days" style="color: var(--gold-primary); margin-right: 4px;"></i><strong>Yıl:</strong> ${data.year || '-'}</span>
                            <span><i class="fa-solid fa-gas-pump" style="color: var(--gold-primary); margin-right: 4px;"></i><strong>Yakıt:</strong> ${data.fuel || '-'}</span>
                            <span><i class="fa-solid fa-gears" style="color: var(--gold-primary); margin-right: 4px;"></i><strong>Vites:</strong> ${data.transmission || '-'}</span>
                            <span><i class="fa-solid fa-location-dot" style="color: var(--gold-primary); margin-right: 4px;"></i><strong>Şehir:</strong> ${data.city || '-'}</span>
                            <span><i class="fa-solid fa-road" style="color: var(--gold-primary); margin-right: 4px;"></i><strong>Km:</strong> ${data.km || '-'}</span>
                            <span><i class="fa-solid fa-palette" style="color: var(--gold-primary); margin-right: 4px;"></i><strong>Boya:</strong> ${data.paint || '-'}</span>
                            <span><i class="fa-solid fa-wrench" style="color: var(--gold-primary); margin-right: 4px;"></i><strong>Değişen:</strong> ${data.replaced || '-'}</span>
                            <span><i class="fa-solid fa-triangle-exclamation" style="color: var(--gold-primary); margin-right: 4px;"></i><strong>Tramer:</strong> ${data.tramer || '-'}</span>
                        </div>
                        <div class="listing-price-tag">${formattedPrice}</div>
                        <div style="font-size: 0.85rem; color: #ffffff; margin-top: 8px;"><strong>İletişim:</strong> <a href="tel:${data.sellerPhone}" style="color: var(--gold-primary); text-decoration: none;">${data.sellerPhone || '-'}</a></div>
                        <div style="font-size: 0.85rem; color: rgba(255,255,255,0.7); margin-top: 8px; line-height: 1.4; max-height: 80px; overflow-y: auto; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px;"><strong>Açıklama:</strong> ${data.description || '-'}</div>
                        <div class="listing-date"><i class="fa-solid fa-clock"></i> ${dateStr}</div>
                    </div>
                    
                    <!-- Vitrin Kontrol Butonu -->
                    <div style="margin-top: 12px; width: 100%;">
                        <button class="btn-listing-action" onclick="toggleShowcase('${id}', ${data.showcase || false})" style="width: 100%; margin: 0; padding: 10px; font-size: 0.85rem; height: 40px; background: ${data.showcase ? 'linear-gradient(135deg, var(--gold-primary), var(--gold-dark))' : 'rgba(255,255,255,0.03)'}; color: ${data.showcase ? '#000000' : '#ffffff'}; border: 1px solid ${data.showcase ? 'var(--gold-primary)' : 'rgba(255,255,255,0.1)'}; border-radius: 10px; cursor: pointer; font-weight: 700; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; gap: 6px;">
                            <i class="${data.showcase ? 'fa-solid fa-star' : 'fa-regular fa-star'}"></i>
                            ${data.showcase ? 'Vitrinden Kaldır (Siteden Gizle)' : 'Vitrinde Göster (Sitede Yayınla)'}
                        </button>
                    </div>
                    
                    <div class="listing-actions" style="display: grid; grid-template-columns: 1.2fr 1.3fr 1fr 1fr; gap: 8px; margin-top: 10px; width: 100%;">
                        <button class="btn-listing-action btn-wp-publish" onclick="publishToListing('${id}')" style="margin: 0; padding: 10px 5px; font-size: 0.8rem; height: 38px;">
                            <i class="fa-brands fa-whatsapp"></i> Paylaş
                        </button>
                        <button class="btn-listing-action" onclick="openInstagramModal('${id}')" style="margin: 0; padding: 10px 5px; font-size: 0.8rem; height: 38px; background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%); border: none; color: #ffffff; border-radius: 10px; cursor: pointer; font-weight: 700; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; gap: 4px;">
                            <i class="fa-brands fa-instagram"></i> Instagram
                        </button>
                        <button class="btn-listing-action" onclick="openEditModal('${id}')" style="margin: 0; padding: 10px 5px; font-size: 0.8rem; height: 38px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: #ffffff; border-radius: 10px; cursor: pointer; font-weight: 700; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; gap: 4px;">
                            <i class="fa-solid fa-pen-to-square"></i> Düzenle
                        </button>
                        <button class="btn-listing-action btn-delete-listing" onclick="deleteListing('${id}')" style="margin: 0; padding: 10px 5px; font-size: 0.8rem; height: 38px; display: flex; align-items: center; justify-content: center; gap: 4px;">
                            <i class="fa-solid fa-trash-can"></i> Sil
                        </button>
                    </div>
                </div>
            `;

            listingsContainer.appendChild(card);

            // Thumbnail geçiş tetikleyicileri ekle
            const thumbs = card.querySelectorAll('.listing-thumb-img');
            const mainImageEl = card.querySelector(`#main-img-${id}`);
            thumbs.forEach(thumb => {
                thumb.addEventListener('click', () => {
                    thumbs.forEach(t => t.classList.remove('active'));
                    thumb.classList.add('active');
                    mainImageEl.src = thumb.src;
                });
            });
        });
    }
}

// ==========================================
// GLOBAL YARDIMCI FONKSİYONLAR
// ==========================================

// Resim Sıkıştırma ve Base64 Alımı (Canvas API)
function compressAndGetBase64(file, maxWidth, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // En-boy oranını bozmadan boyutlandır
                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // JPEG formatında sıkıştırıp doğrudan Base64 string ver
                const base64Data = canvas.toDataURL('image/jpeg', quality);
                resolve(base64Data);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

// ==========================================
// ADMIN PANEL ACTIONS (GLOBAL WINDOW FUNCTIONS)
// ==========================================

// Instagram Modalı ve Canvas Çizimi
window.openInstagramModal = async function(id) {
    const modal = document.getElementById('instagram-modal');
    const canvas = document.getElementById('instagram-canvas');
    if (!modal || !canvas) return;

    try {
        const doc = await db.collection('listings').doc(id).get();
        if (!doc.exists) {
            alert('İlan bulunamadı.');
            return;
        }
        const data = doc.data();
        const ctx = canvas.getContext('2d');

        // 1. Modalı Aç ve Yükleniyor Göster
        modal.classList.add('active');
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 1080, 1080);
        ctx.fillStyle = '#ffffff';
        ctx.font = '30px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Görsel Hazırlanıyor...', 540, 540);

        // 2. Logo ve Ana Görseli Yükle
        const logoImg = new Image();
        logoImg.src = 'logo.jpg';

        const carImg = new Image();
        // Eğer görsel base64 ise direkt yükler, URL ise CORS sorunu yaşamamak için crossOrigin ayarla
        if (data.images && data.images.length > 0) {
            if (!data.images[0].startsWith('data:')) {
                carImg.crossOrigin = 'anonymous';
            }
            carImg.src = data.images[0];
        } else {
            carImg.src = 'logo.jpg'; // Görsel yoksa logo çiz
        }

        // Resimlerin yüklenmesini bekle
        const waitLoad = (img) => new Promise(res => {
            if (img.complete) res();
            else {
                img.onload = () => res();
                img.onerror = () => res(); // Hata olsa da devam etsin
            }
        });

        await Promise.all([waitLoad(logoImg), waitLoad(carImg)]);

        // 3. Arka plan çiz (Siyah/Koyu Gri Premium Degrade)
        const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1080);
        bgGrad.addColorStop(0, '#0D0D0D');
        bgGrad.addColorStop(0.5, '#141414');
        bgGrad.addColorStop(1, '#050505');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 1080, 1080);

        // 4. Çift Altın Çerçeve Çiz (Corporate border)
        ctx.strokeStyle = '#D5B04C';
        ctx.lineWidth = 4;
        ctx.strokeRect(30, 30, 1020, 1020);
        
        ctx.strokeStyle = '#A78326';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(42, 42, 996, 996);

        // 5. Logo Çiz (Üst Ortaya Daire Çerçeveyle)
        ctx.save();
        const logoSize = 130;
        const logoX = 540 - logoSize/2;
        const logoY = 70;
        
        // Logo için altın halka
        ctx.strokeStyle = '#D5B04C';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(540, logoY + logoSize/2, logoSize/2 + 5, 0, Math.PI * 2);
        ctx.stroke();

        // Logoyu yuvarla ve çiz
        ctx.beginPath();
        ctx.arc(540, logoY + logoSize/2, logoSize/2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
        ctx.restore();

        // 6. Araç Görselini Çiz (Ortada, Geniş Premium Çerçeveli)
        const imgX = 115;
        const imgY = 240;
        const imgW = 850;
        const imgH = 480;

        // Görsel çerçevesi (Altın)
        ctx.strokeStyle = '#D5B04C';
        ctx.lineWidth = 3;
        ctx.strokeRect(imgX - 3, imgY - 3, imgW + 6, imgH + 6);

        // Görseli çiz (Kırpıp tam oturtacak şekilde)
        ctx.drawImage(carImg, imgX, imgY, imgW, imgH);

        // 7. Araç Bilgilerini Yaz
        // Marka - Model ve Yıl
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 48px Inter, sans-serif';
        const brandModel = (data.brandModel || 'Araç').toUpperCase();
        const year = data.year || '';
        ctx.fillText(`${brandModel} (${year})`, 540, 770);

        // Altın Fiyat Etiketi
        ctx.fillStyle = '#D5B04C';
        ctx.font = 'bold 58px Inter, sans-serif';
        const formattedPrice = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(data.price || 0);
        ctx.fillText(formattedPrice, 540, 840);

        // Araç Özellikleri Rozetleri (KM | Yakıt | Vites | Şehir)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = '30px Inter, sans-serif';
        const kmStr = data.km ? `${parseInt(data.km).toLocaleString('tr-TR')} KM` : '-';
        const fuel = data.fuel || '-';
        const trans = data.transmission || '-';
        const city = data.city || '-';
        ctx.fillText(`${kmStr}  |  ${fuel}  |  ${trans}  |  ${city}`, 540, 900);

        // Hasar / Tramer Bilgisi
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = 'italic 24px Inter, sans-serif';
        const paint = data.paint ? `Boya: ${data.paint}` : 'Boya: -';
        const replaced = data.replaced ? `Değişen: ${data.replaced}` : 'Değişen: -';
        const tramer = data.tramer ? `Tramer: ${data.tramer}` : 'Tramer: -';
        ctx.fillText(`${paint}  •  ${replaced}  •  ${tramer}`, 540, 945);

        // Footer Web Sitesi Linki
        ctx.fillStyle = '#D5B04C';
        ctx.font = 'bold 28px Inter, sans-serif';
        ctx.fillText('satarsin.com.tr', 540, 1010);

        // İndirme Butonu Eventi Tanımla (Eski dinleyicileri kaldırarak)
        const downloadBtn = document.getElementById('download-instagram-btn');
        const newDownloadBtn = downloadBtn.cloneNode(true);
        downloadBtn.parentNode.replaceChild(newDownloadBtn, downloadBtn);

        newDownloadBtn.addEventListener('click', () => {
            const link = document.createElement('a');
            link.download = `${brandModel.replace(/\s+/g, '-').toLowerCase()}-instagram.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        });

    } catch (error) {
        console.error("Instagram görseli oluşturulurken hata:", error);
        alert("Görsel oluşturulurken bir hata meydana geldi: " + error.message);
    }
};

// Kapatma Eventleri
document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('close-instagram-modal');
    const modal = document.getElementById('instagram-modal');
    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }
});

// Vitrin Durumunu Değiştir
window.toggleShowcase = async function(id, currentStatus) {
    try {
        await db.collection('listings').doc(id).update({
            showcase: !currentStatus
        });
        alert(currentStatus ? 'İlan vitrinden kaldırıldı.' : 'İlan vitrine eklendi ve sitede yayına alındı.');
    } catch (error) {
        console.error("Vitrin güncelleme hatası:", error);
        alert("Vitrin durumu güncellenirken hata oluştu: " + error.message);
    }
};

// İlan Düzenleme Modalı Aç
window.openEditModal = async function(id) {
    const editModal = document.getElementById('edit-modal');
    if (!editModal) return;

    try {
        const doc = await db.collection('listings').doc(id).get();
        if (!doc.exists) {
            alert('İlan bulunamadı.');
            return;
        }
        const data = doc.data();
        
        // Yeni görsel seçim listesini temizle
        window.editSelectedFiles = [];
        const previewContainer = document.getElementById('edit-image-preview-container');
        if (previewContainer) previewContainer.innerHTML = '';
        const fileInput = document.getElementById('edit-car-images');
        if (fileInput) fileInput.value = '';

        document.getElementById('edit-car-id').value = id;
        document.getElementById('edit-car-brand-model').value = data.brandModel || '';
        document.getElementById('edit-car-year').value = data.year || '';
        document.getElementById('edit-car-fuel').value = data.fuel || 'Benzin';
        document.getElementById('edit-car-transmission').value = data.transmission || 'Manuel';
        document.getElementById('edit-car-city').value = data.city || '';
        document.getElementById('edit-car-km').value = data.km || '';
        document.getElementById('edit-car-paint').value = data.paint || '';
        document.getElementById('edit-car-replaced').value = data.replaced || '';
        document.getElementById('edit-car-tramer').value = data.tramer || '';
        document.getElementById('edit-car-price').value = data.price ? formatNumberWithDots(data.price.toString()) : '';
        document.getElementById('edit-seller-phone').value = data.sellerPhone || '';
        document.getElementById('edit-car-description').value = data.description || '';

        editModal.classList.add('active');
    } catch (error) {
        console.error("İlan detayları çekilemedi:", error);
        alert("İlan bilgileri yüklenirken hata oluştu: " + error.message);
    }
};

// İlanı Sil
window.deleteListing = async function(id) {
    if (!confirm('Bu ilanı kalıcı olarak silmek istediğinize emin misiniz?')) return;

    try {
        await db.collection('listings').doc(id).delete();
        alert('İlan başarıyla veritabanından silindi.');
    } catch (error) {
        console.error('Silme hatası:', error);
        alert('İlan silinirken bir hata oluştu: ' + error.message);
    }
};

// İlanı WhatsApp Grubunda Paylaş
window.publishToListing = async function(id) {
    // API Ayarlarını Firestore'dan oku
    let config;
    try {
        const configDoc = await db.collection('settings').doc('config').get();
        if (configDoc.exists) {
            config = configDoc.data();
        } else {
            throw new Error("Sistem ayarları bulunamadı. Lütfen sağ taraftaki panelden ayarları kaydedin.");
        }
    } catch (err) {
        alert("WhatsApp API ayarları yüklenemedi: " + err.message);
        return;
    }

    const apiProvider = config.apiProvider || 'green-api';
    const instanceId = config.apiInstanceId;
    const token = config.apiToken;
    const chatId = config.apiChatId;

    if (!instanceId || !token || !chatId) {
        alert('Lütfen önce sağ taraftaki panelden WhatsApp API ayarlarınızı yapın.');
        return;
    }

    const btn = document.querySelector(`#card-${id} .btn-wp-publish`);
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Gönderiliyor...';

    try {
        // İlan verilerini çek
        const doc = await db.collection('listings').doc(id).get();
        if (!doc.exists) {
            throw new Error('İlan bulunamadı.');
        }
        const data = doc.data();
        const formattedPrice = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(data.price);

        // Telefon numarasını başında 0 olacak şekilde formatla
        let formattedPhone = data.sellerPhone || '-';
        if (formattedPhone !== '-' && !formattedPhone.startsWith('0')) {
            formattedPhone = '0' + formattedPhone;
        }

        // WhatsApp mesaj metnini hazırla (Kullanıcının Şablonu ile)
        const messageText = 
`🚗 *Marka Model:* ${data.brandModel || '-'}
📅 *Model Yılı:* ${data.year || '-'}
⛽ *Yakıt:* ${data.fuel || '-'}
⚙️ *Vites:* ${data.transmission || '-'}
📍 *Şehir:* ${data.city || '-'}
🛣️ *Km:* ${data.km || '-'}
🎨 *Boya:* ${data.paint || '-'}
🔧 *Değişen:* ${data.replaced || '-'}
💥 *Tramer:* ${data.tramer || '-'}
💰 *Fiyat:* ${formattedPrice}
📞 *İletişim:* ${formattedPhone}

📝 *Genel açıklama :* ${data.description || '-'}`;

        // WhatsApp API'sine görselleri sırayla GÖNDER (açıklamasız - bu sayede temiz bir albüm oluştururlar)
        if (data.images && data.images.length > 0) {
            for (let i = 0; i < data.images.length; i++) {
                const imgUrl = data.images[i]; // Base64 verisi
                
                if (apiProvider === 'green-api') {
                    await sendGreenApiImage(instanceId, token, chatId, imgUrl, '');
                } else if (apiProvider === 'ultramsg') {
                    await sendUltraMsgImage(instanceId, token, chatId, imgUrl, '');
                }
                
                // Fotoğrafların albüm (yan yana) şeklinde gruplanması için aradaki bekleme süresini çok kısa tutuyoruz (100 ms)
                await new Promise(r => setTimeout(r, 100));
            }
        } else {
            throw new Error('İlan görseli bulunamadı.');
        }

        // Görseller bittikten sonra açıklamayı ayrı bir metin mesajı olarak en altta gönder
        if (apiProvider === 'green-api') {
            await sendGreenApiText(instanceId, token, chatId, messageText);
        } else if (apiProvider === 'ultramsg') {
            await sendUltraMsgText(instanceId, token, chatId, messageText);
        }

        // Firebase'de paylaşıldı durumunu işaretle
        try {
            await db.collection('listings').doc(id).update({ wpShared: true });
        } catch (dbErr) {
            console.error("Firebase güncelleme hatası (wpShared):", dbErr);
        }

        alert('Tebrikler! Araç görselleri ve açıklama WhatsApp grubuna başarıyla gönderildi.');
    } catch (error) {
        console.error('WhatsApp API gönderim hatası:', error);
        alert('WhatsApp\'a gönderilirken bir hata oluştu: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};

// Green-API Metin Mesajı Gönderim İsteği
async function sendGreenApiText(instanceId, token, chatId, message) {
    const hostPrefix = instanceId.substring(0, 4);
    const url = `https://${hostPrefix}.api.greenapi.com/waInstance${instanceId}/sendMessage/${token}`;
    const body = {
        chatId: chatId,
        message: message
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    const result = await response.json();
    if (!result.idMessage) {
        throw new Error(result.message || 'Green-API metin mesajı gönderimi başarısız.');
    }
}

// Ultramsg Metin Mesajı Gönderim İsteği
async function sendUltraMsgText(instanceId, token, chatId, message) {
    const url = `https://api.ultramsg.com/${instanceId}/messages/chat`;
    const details = {
        'token': token,
        'to': chatId,
        'body': message
    };

    let formBody = [];
    for (let property in details) {
        let encodedKey = encodeURIComponent(property);
        let encodedValue = encodeURIComponent(details[property]);
        formBody.push(encodedKey + "=" + encodedValue);
    }
    formBody = formBody.join("&");

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        },
        body: formBody
    });

    const result = await response.json();
    if (!result.sent || result.sent !== "true") {
        throw new Error(result.error ? result.error.message : 'Ultramsg metin mesajı gönderimi başarısız.');
    }
}

// Helper: Base64 stringini Blob nesnesine dönüştürür
function base64ToBlob(base64Data, contentType = 'image/jpeg') {
    const sliceSize = 512;
    const byteCharacters = atob(base64Data.split(',')[1]);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }

    return new Blob(byteArrays, { type: contentType });
}

// Helper: Görseli Green-API Bulut Deposuna Yükler ve Geçici Link Alır (Kanallar için zorunludur)
async function uploadFileToGreenApi(instanceId, token, base64Data) {
    const hostPrefix = instanceId.substring(0, 4);
    const apiUrl = `https://${hostPrefix}.api.greenapi.com`;
    const url = `${apiUrl}/waInstance${instanceId}/uploadFile/${token}`;
    
    const blob = base64ToBlob(base64Data, 'image/jpeg');

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'image/jpeg'
        },
        body: blob
    });

    const result = await response.json();
    if (!result.urlFile) {
        throw new Error(result.message || 'Görsel buluta yüklenemedi.');
    }
    return result.urlFile;
}

// Green-API Görsel Gönderim İsteği (Kanallarda da %100 çalışabilmesi için önce bulut yüklemesi yapar)
async function sendGreenApiImage(instanceId, token, chatId, imageUrl, caption) {
    let url, response;
    const hostPrefix = instanceId.substring(0, 4);
    const apiUrl = `https://${hostPrefix}.api.greenapi.com`;
    
    // Eğer resim yerel veya bağıl bir yol ise (örn: logo.jpg), bunu tam URL'e çevirelim
    if (!imageUrl.startsWith('data:') && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
        imageUrl = window.location.origin + '/' + imageUrl;
    }
    
    // Eğer görsel base64 ise, kanala doğrudan yollayabilmek için önce buluta yükleyip linke dönüştürelim
    if (imageUrl.startsWith('data:')) {
        try {
            // 1. Buluta yükle ve link al
            const uploadedUrl = await uploadFileToGreenApi(instanceId, token, imageUrl);
            
            // 2. Bu linki kanala/gruba sendFileByUrl ile gönder
            url = `${apiUrl}/waInstance${instanceId}/sendFileByUrl/${token}`;
            const body = {
                chatId: chatId,
                urlFile: uploadedUrl,
                fileName: "arac.jpg",
                caption: caption
            };

            response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
        } catch (uploadError) {
            console.error("Buluta yükleme hatası:", uploadError);
            throw new Error("Görsel buluta yüklenemediği için gönderilemedi: " + uploadError.message);
        }
    } else {
        // Normal URL ise doğrudan sendFileByUrl kullanıyoruz
        url = `${apiUrl}/waInstance${instanceId}/sendFileByUrl/${token}`;
        const body = {
            chatId: chatId,
            urlFile: imageUrl,
            fileName: "arac.jpg",
            caption: caption
        };

        response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
    }

    const result = await response.json();
    if (!result.idMessage) {
        throw new Error(result.message || 'Green-API mesaj gönderimi başarısız.');
    }
}

// Ultramsg Görsel Gönderim İsteği
async function sendUltraMsgImage(instanceId, token, chatId, imageUrl, caption) {
    // Ultramsg base64 gönderimlerinde /messages/image endpoint'inde direkt base64 kabul eder (data:image/jpeg;base64,...)
    const url = `https://api.ultramsg.com/${instanceId}/messages/image`;
    
    // URL Encoded veri paketi
    const details = {
        'token': token,
        'to': chatId,
        'image': imageUrl, // Base64 verisi (Ultramsg'in son API sürümü bunu doğrudan destekler)
        'caption': caption
    };

    let formBody = [];
    for (let property in details) {
        let encodedKey = encodeURIComponent(property);
        let encodedValue = encodeURIComponent(details[property]);
        formBody.push(encodedKey + "=" + encodedValue);
    }
    formBody = formBody.join("&");

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        },
        body: formBody
    });

    const result = await response.json();
    if (!result.sent || result.sent !== "true") {
        throw new Error(result.error ? result.error.message : 'Ultramsg mesaj gönderimi başarısız.');
    }
}
