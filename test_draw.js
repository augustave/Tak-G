const puppeteer = require('puppeteer');
(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        page.on('console', msg => console.log('LOG:', msg.text()));
        page.on('pageerror', err => console.log('ERROR:', err.message));
        
        await page.goto('http://localhost:8080/index.html');
        await page.waitForTimeout(2000);
        
        await page.evaluate(() => {
            console.log("Starting Draw Test");
            const btn = document.getElementById('btn-draw-zone');
            btn.click();
            
            // Dispatch mousedown events on canvas
            const canvas = document.querySelector('canvas');
            const rect = canvas.getBoundingClientRect();
            
            const points = [
                {x: rect.width/2 - 100, y: rect.height/2 - 100},
                {x: rect.width/2 + 100, y: rect.height/2 - 100},
                {x: rect.width/2 + 100, y: rect.height/2 + 100},
                {x: rect.width/2 - 100, y: rect.height/2 + 100}
            ];
            
            points.forEach(p => {
                const e = new MouseEvent('mousedown', {
                    clientX: p.x, clientY: p.y, bubbles: true
                });
                canvas.dispatchEvent(e);
            });
            
            // Press Enter
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
            console.log("Draw finished.");
        });
        
        await page.screenshot({path: 'draw_test_debug.png'});
        await browser.close();
    } catch(err) {
        console.error(err);
    }
})();
