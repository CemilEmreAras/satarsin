document.addEventListener('DOMContentLoaded', () => {
    const card = document.getElementById('main-card');
    
    // Premium Mouse Move Glow Effect inside the card
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left; // x position within the element.
        const y = e.clientY - rect.top;  // y position within the element.
        
        // Update custom CSS variables on the card
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
    });
    
    // Add dynamic entry animations or click logging if needed
    console.log("Satarsın Web App initialized successfully.");
});
