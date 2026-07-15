// firebase-config.js
// Firebase Ayarları

// Firebase Konsolundan aldığınız web uygulaması yapılandırma değerlerini buraya yapıştırın:
const firebaseConfig = {
    apiKey: "AIzaSyAzhHtew32uoS8n5TmIXFP05pZ-4ZqJNv8",
    authDomain: "satarsin-ed338.firebaseapp.com",
    projectId: "satarsin-ed338",
    storageBucket: "satarsin-ed338.firebasestorage.app",
    messagingSenderId: "576501379580",
    appId: "1:576501379580:web:01434ea9c7c7e968604279"
};

// Firebase'i başlat
let db = null;
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
} else {
    console.warn("Firebase SDK yüklenmedi. Lütfen internet bağlantınızı kontrol edin.");
}
