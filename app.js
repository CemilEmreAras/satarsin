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
    const openModalBtn = document.getElementById('open-sell-modal');
    const closeModalBtn = document.getElementById('close-sell-modal');
    const modal = document.getElementById('sell-modal');
    const form = document.getElementById('car-upload-form');
    const fileInput = document.getElementById('car-images');
    const previewContainer = document.getElementById('image-preview-container');
    const submitBtn = document.getElementById('submit-car-btn');

    let selectedFiles = []; // Sıkıştırılmış Base64 görsel verilerini tutar

    // Modal aç / kapat
    if (openModalBtn && modal) {
        openModalBtn.addEventListener('click', () => {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
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

    // Modal dışına tıklandığında kapatma
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModalBtn.click();
            }
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
                    price: parseFloat(document.getElementById('car-price').value),
                    sellerPhone: document.getElementById('seller-phone').value.trim(),
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

    // 1. ŞİFRE GÜVENLİK VE GİRİŞ KONTROLLERİ
    const getStoredPassword = () => localStorage.getItem('admin_pass') || '12345';
    
    // Zaten giriş yapılmış mı kontrol et
    if (sessionStorage.getItem('admin_logged') === 'true') {
        authOverlay.style.display = 'none';
        loadAdminPanel();
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const inputPass = passwordInput.value;
            if (inputPass === getStoredPassword()) {
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

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('admin_logged');
            window.location.reload();
        });
    }

    // 2. PANEL ANA İŞLEVLERİ YÜKLE
    function loadAdminPanel() {
        // Ayarları LocalStorage'dan form alanlarına yükle
        document.getElementById('api-provider').value = localStorage.getItem('api_provider') || 'green-api';
        document.getElementById('api-instance-id').value = localStorage.getItem('api_instance_id') || '';
        document.getElementById('api-token').value = localStorage.getItem('api_token') || '';
        document.getElementById('api-chat-id').value = localStorage.getItem('api_chat_id') || '';
        document.getElementById('settings-admin-password').value = getStoredPassword();

        // Ayarları Kaydetme
        if (settingsForm) {
            settingsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                localStorage.setItem('api_provider', document.getElementById('api-provider').value);
                localStorage.setItem('api_instance_id', document.getElementById('api-instance-id').value.trim());
                localStorage.setItem('api_token', document.getElementById('api-token').value.trim());
                localStorage.setItem('api_chat_id', document.getElementById('api-chat-id').value.trim());
                
                const newPass = document.getElementById('settings-admin-password').value.trim();
                if (newPass) {
                    localStorage.setItem('admin_pass', newPass);
                }

                alert('Ayarlar başarıyla kaydedildi.');
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
        listingsCountBadge.innerText = `${docs.length} İlan`;

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
            card.innerHTML = `
                <div class="listing-media">
                    <img src="${mainImg}" class="listing-main-img" id="main-img-${id}" alt="Araç Görseli">
                    <div class="listing-thumbs">
                        ${thumbsHtml}
                    </div>
                </div>
                <div class="listing-info">
                    <div class="listing-info-header">
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
                    
                    <div class="listing-actions">
                        <button class="btn-listing-action btn-wp-publish" onclick="publishToListing('${id}')">
                            <i class="fa-brands fa-whatsapp"></i> WP Grubuna Gönder
                        </button>
                        <button class="btn-listing-action btn-delete-listing" onclick="deleteListing('${id}')">
                            <i class="fa-solid fa-trash-can"></i> İlanı Sil
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
    // API Ayarlarını oku
    const apiProvider = localStorage.getItem('api_provider') || 'green-api';
    const instanceId = localStorage.getItem('api_instance_id');
    const token = localStorage.getItem('api_token');
    const chatId = localStorage.getItem('api_chat_id');

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
📞 *İletişim:* ${data.sellerPhone || '-'}

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

// Green-API Görsel Gönderim İsteyi
async function sendGreenApiImage(instanceId, token, chatId, imageUrl, caption) {
    let url, response;
    
    // Green-API'de host adresi Instance ID'nizin ilk 4 hanesinden oluşur (Örn: 7107.api.greenapi.com)
    const hostPrefix = instanceId.substring(0, 4);
    const baseUrl = `https://${hostPrefix}.api.greenapi.com`;
    
    // Eğer resim yerel veya bağıl bir yol ise (örn: logo.jpg), bunu tam URL'e çevirelim
    if (!imageUrl.startsWith('data:') && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
        imageUrl = window.location.origin + '/' + imageUrl;
    }
    
    // Eğer görsel base64 ise sendFileByUpload kullanıyoruz
    if (imageUrl.startsWith('data:')) {
        url = `${baseUrl}/waInstance${instanceId}/sendFileByUpload/${token}`;
        
        const blob = base64ToBlob(imageUrl, 'image/jpeg');
        const formData = new FormData();
        formData.append('chatId', chatId);
        formData.append('file', blob, 'arac.jpg');
        if (caption) {
            formData.append('caption', caption);
        }

        response = await fetch(url, {
            method: 'POST',
            body: formData
        });
    } else {
        // Normal URL ise sendFileByUrl kullanıyoruz
        url = `${baseUrl}/waInstance${instanceId}/sendFileByUrl/${token}`;
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
