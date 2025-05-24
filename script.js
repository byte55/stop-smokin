class SmokingTracker {
    constructor() {
        this.initializeData();
        this.initializeEventListeners();
        this.startTimer();
        this.updateDisplay();
        this.checkAchievements();
        this.showNewQuote();
    }

    initializeData() {
        const defaultData = {
            smokingEvents: [],
            totalCigarettes: 0,
            longestStreak: 0,
            currentLevel: 1,
            achievements: {},
            lastSmokeTime: null
        };

        this.data = JSON.parse(localStorage.getItem('smokingTrackerData')) || defaultData;
        this.saveData();
    }

    saveData() {
        localStorage.setItem('smokingTrackerData', JSON.stringify(this.data));
    }

    initializeEventListeners() {
        document.getElementById('smokeButton').addEventListener('click', () => this.recordSmoke());
        document.getElementById('newQuoteBtn').addEventListener('click', () => this.showNewQuote());
        document.getElementById('resetDataBtn').addEventListener('click', () => this.resetData());
        
        // Sync event listeners
        document.getElementById('generateQRBtn').addEventListener('click', () => this.generateQRCode());
        document.getElementById('scanQRBtn').addEventListener('click', () => this.startQRScan());
        document.getElementById('exportDataBtn').addEventListener('click', () => this.exportData());
        document.getElementById('importDataBtn').addEventListener('click', () => this.importData());
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileImport(e));
        document.getElementById('qrFileInput').addEventListener('change', (e) => this.handleQRFileImport(e));
    }

    recordSmoke() {
        const now = new Date();
        this.data.smokingEvents.push(now.toISOString());
        this.data.totalCigarettes++;
        this.data.lastSmokeTime = now.toISOString();
        
        this.saveData();
        this.updateDisplay();
        this.checkAchievements();
        this.updateLevel();
        this.showNewQuote();
    }

    startTimer() {
        setInterval(() => {
            this.updateTimer();
        }, 1000);
    }

    updateTimer() {
        const timerElement = document.getElementById('smokeFreeTimer');
        
        if (!this.data.lastSmokeTime) {
            timerElement.textContent = '00:00:00';
            return;
        }

        const lastSmoke = new Date(this.data.lastSmokeTime);
        const now = new Date();
        const timeDiff = now - lastSmoke;

        const hours = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

        timerElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        // Update longest streak
        const currentStreakHours = Math.floor(timeDiff / (1000 * 60 * 60));
        if (currentStreakHours > this.data.longestStreak) {
            this.data.longestStreak = currentStreakHours;
            this.saveData();
        }
    }

    updateDisplay() {
        // Update last smoke time display
        const lastSmokeElement = document.getElementById('lastSmokeTime');
        if (this.data.lastSmokeTime) {
            const lastSmoke = new Date(this.data.lastSmokeTime);
            lastSmokeElement.textContent = `Last cigarette: ${lastSmoke.toLocaleString()}`;
        }

        // Update statistics
        document.getElementById('totalCigarettes').textContent = this.data.totalCigarettes;
        document.getElementById('longestStreak').textContent = `${this.data.longestStreak}h`;
        document.getElementById('todayCount').textContent = this.getTodayCount();
        document.getElementById('weekCount').textContent = this.getWeekCount();
        
        // Update average statistics
        const avgStats = this.getAverageStatistics();
        document.getElementById('avgPerDay').textContent = avgStats.avgPerDay.toFixed(1);
        document.getElementById('avgPerWeek').textContent = avgStats.avgPerWeek.toFixed(1);
        document.getElementById('avgPerMonth').textContent = avgStats.avgPerMonth.toFixed(1);
        document.getElementById('reductionPercent').textContent = `${avgStats.reductionPercent}%`;
        
        // Update trend indicators
        this.updateTrendIndicators(avgStats);

        // Update level display
        document.getElementById('currentLevel').textContent = this.data.currentLevel;
        this.updateProgressBar();
    }

    getTodayCount() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        return this.data.smokingEvents.filter(event => {
            const eventDate = new Date(event);
            return eventDate >= today;
        }).length;
    }

    getWeekCount() {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        return this.data.smokingEvents.filter(event => {
            const eventDate = new Date(event);
            return eventDate >= weekAgo;
        }).length;
    }

    getAverageStatistics() {
        if (this.data.smokingEvents.length === 0) {
            return {
                avgPerDay: 0,
                avgPerWeek: 0,
                avgPerMonth: 0,
                reductionPercent: 0,
                trends: { daily: 'stable', weekly: 'stable', monthly: 'stable' }
            };
        }

        const now = new Date();
        const firstEvent = new Date(this.data.smokingEvents[0]);
        const daysSinceStart = Math.max(1, Math.floor((now - firstEvent) / (1000 * 60 * 60 * 24)));
        
        // Calculate averages
        const avgPerDay = this.data.totalCigarettes / daysSinceStart;
        const avgPerWeek = avgPerDay * 7;
        const avgPerMonth = avgPerDay * 30;
        
        // Calculate reduction percentage vs peak week
        const weeklyData = this.getWeeklyData();
        const peakWeek = Math.max(...weeklyData, 1);
        const currentWeekAvg = this.getWeekCount();
        const reductionPercent = Math.max(0, Math.round((1 - currentWeekAvg / peakWeek) * 100));
        
        // Calculate trends
        const trends = this.calculateTrends();
        
        return {
            avgPerDay,
            avgPerWeek,
            avgPerMonth,
            reductionPercent,
            trends
        };
    }

    getWeeklyData() {
        const weeks = [];
        const now = new Date();
        
        for (let i = 0; i < 12; i++) { // Last 12 weeks
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - (i * 7) - 7);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 7);
            
            const weekCount = this.data.smokingEvents.filter(event => {
                const eventDate = new Date(event);
                return eventDate >= weekStart && eventDate < weekEnd;
            }).length;
            
            weeks.unshift(weekCount);
        }
        
        return weeks.slice(-8); // Return last 8 weeks
    }

    calculateTrends() {
        const weeklyData = this.getWeeklyData();
        if (weeklyData.length < 3) return { daily: 'stable', weekly: 'stable', monthly: 'stable' };
        
        const recent3Weeks = weeklyData.slice(-3);
        const previous3Weeks = weeklyData.slice(-6, -3);
        
        const recentAvg = recent3Weeks.reduce((a, b) => a + b, 0) / recent3Weeks.length;
        const previousAvg = previous3Weeks.reduce((a, b) => a + b, 0) / previous3Weeks.length;
        
        let trend = 'stable';
        const changePercent = previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg) * 100 : 0;
        
        if (changePercent < -15) trend = 'down';
        else if (changePercent > 15) trend = 'up';
        
        return {
            daily: trend,
            weekly: trend,
            monthly: trend
        };
    }

    updateTrendIndicators(avgStats) {
        const dailyTrend = document.getElementById('dailyTrend');
        const weeklyTrend = document.getElementById('weeklyTrend');
        const monthlyTrend = document.getElementById('monthlyTrend');
        
        const setTrend = (element, trend) => {
            element.className = `trend ${trend}`;
            if (trend === 'down') element.textContent = '↓';
            else if (trend === 'up') element.textContent = '↑';
            else element.textContent = '→';
        };
        
        setTrend(dailyTrend, avgStats.trends.daily);
        setTrend(weeklyTrend, avgStats.trends.weekly);
        setTrend(monthlyTrend, avgStats.trends.monthly);
    }

    updateLevel() {
        // Level up based on days smoke-free
        if (this.data.lastSmokeTime) {
            const daysSmokeFreeBefore = Math.floor(this.data.longestStreak / 24);
            const daysSmokeFreeCurrent = Math.floor(this.getCurrentStreakHours() / 24);
            
            // Level calculation: every 3 days smoke-free = 1 level
            const newLevel = Math.max(1, Math.floor(daysSmokeFreeCurrent / 3) + 1);
            
            if (newLevel > this.data.currentLevel) {
                this.data.currentLevel = newLevel;
                this.saveData();
                this.showLevelUpNotification();
            }
        }
    }

    getCurrentStreakHours() {
        if (!this.data.lastSmokeTime) return 0;
        const lastSmoke = new Date(this.data.lastSmokeTime);
        const now = new Date();
        return Math.floor((now - lastSmoke) / (1000 * 60 * 60));
    }

    updateProgressBar() {
        const currentStreakDays = Math.floor(this.getCurrentStreakHours() / 24);
        const progressToNextLevel = (currentStreakDays % 3) / 3 * 100;
        document.getElementById('progressFill').style.width = `${progressToNextLevel}%`;
    }

    showLevelUpNotification() {
        // Simple notification for level up
        const notification = document.createElement('div');
        notification.textContent = `🎉 Level Up! You're now Level ${this.data.currentLevel}!`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    checkAchievements() {
        const avgStats = this.getAverageStatistics();
        const achievements = [
            { id: 'first_track', title: 'Awareness', desc: 'Heart rate normalizing', condition: () => this.data.totalCigarettes >= 1, icon: '💓' },
            { id: 'one_hour', title: 'Blood Healing', desc: 'CO levels dropping', condition: () => this.getCurrentStreakHours() >= 1, icon: '🩸' },
            { id: 'one_day', title: 'Heart Protected', desc: 'Heart attack risk reduced', condition: () => this.getCurrentStreakHours() >= 24, icon: '🫀' },
            { id: 'three_days', title: 'Nicotine Free', desc: 'Body completely detoxed', condition: () => this.getCurrentStreakHours() >= 72, icon: '🧬' },
            { id: 'one_week', title: 'Circulation Boost', desc: 'Walking gets easier', condition: () => this.getCurrentStreakHours() >= 168, icon: '🚶‍♂️' },
            { id: 'awareness', title: 'Pattern Master', desc: 'Tracking builds awareness', condition: () => this.data.totalCigarettes >= 10, icon: '🧠' },
            { id: 'level_up', title: 'Health Champion', desc: 'Major lung improvements', condition: () => this.data.currentLevel >= 3, icon: '🫁' },
            { id: 'reducer', title: 'Reducer', desc: '25% less smoking', condition: () => avgStats.reductionPercent >= 25, icon: '📉' },
            { id: 'half_way', title: 'Half Way Hero', desc: '50% reduction achieved', condition: () => avgStats.reductionPercent >= 50, icon: '🎯' },
            { id: 'trend_master', title: 'Trend Master', desc: 'Consistent weekly reduction', condition: () => avgStats.trends.weekly === 'down', icon: '📊' }
        ];

        achievements.forEach(achievement => {
            if (achievement.condition() && !this.data.achievements[achievement.id]) {
                this.data.achievements[achievement.id] = {
                    unlocked: true,
                    unlockedAt: new Date().toISOString()
                };
                this.showAchievementNotification(achievement);
            }
        });

        this.renderAchievements(achievements);
        this.saveData();
    }

    renderAchievements(achievements) {
        const achievementsList = document.getElementById('achievementsList');
        achievementsList.innerHTML = '';

        achievements.forEach(achievement => {
            const isUnlocked = this.data.achievements[achievement.id]?.unlocked;
            const achievementEl = document.createElement('div');
            achievementEl.className = `achievement ${isUnlocked ? 'unlocked' : ''}`;
            achievementEl.innerHTML = `
                <div class="achievement-icon">${achievement.icon}</div>
                <div class="achievement-title">${achievement.title}</div>
                <div class="achievement-desc">${achievement.desc}</div>
            `;
            achievementsList.appendChild(achievementEl);
        });
    }

    showAchievementNotification(achievement) {
        const notification = document.createElement('div');
        notification.textContent = `🏆 Achievement Unlocked: ${achievement.title}!`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #FFD700;
            color: #333;
            padding: 15px 20px;
            border-radius: 10px;
            z-index: 1000;
            animation: slideIn 0.3s ease;
            font-weight: 600;
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 4000);
    }

    getMotivationalMessage() {
        const hoursSmokeFree = this.getCurrentStreakHours();
        const minutesSmokeFree = Math.floor((this.getTimeSinceLastSmoke() % (1000 * 60 * 60)) / (1000 * 60));
        const avgStats = this.getAverageStatistics();
        
        // Add reduction-focused messages
        if (avgStats.reductionPercent > 50) {
            return `🏆 Incredible! You've reduced smoking by ${avgStats.reductionPercent}% from your peak. Your lungs are thanking you every day!`;
        } else if (avgStats.reductionPercent > 25) {
            return `📉 Great progress! You've cut down ${avgStats.reductionPercent}% from your peak consumption. Every reduction counts towards better health!`;
        } else if (avgStats.trends.weekly === 'down') {
            return `📊 Excellent trend! You're smoking less this week. Your body is already benefiting from this reduction!`;
        }
        
        // Original time-based messages
        if (hoursSmokeFree === 0 && minutesSmokeFree < 20) {
            return "🚭 Every minute without smoking is a victory! Your body is already starting to heal.";
        } else if (hoursSmokeFree === 0 && minutesSmokeFree >= 20) {
            return `🫁 Amazing! ${minutesSmokeFree} minutes smoke-free! Your heart rate and blood pressure are starting to drop to normal levels.`;
        } else if (hoursSmokeFree < 12) {
            return `⚡ ${hoursSmokeFree} hours smoke-free! Your blood oxygen levels are increasing and carbon monoxide levels are decreasing.`;
        } else if (hoursSmokeFree < 24) {
            return `💓 ${hoursSmokeFree} hours without smoking! Your heart attack risk is already starting to decrease.`;
        } else if (hoursSmokeFree < 48) {
            const days = Math.floor(hoursSmokeFree / 24);
            return `👃 ${days} day${days > 1 ? 's' : ''} smoke-free! Your nerve endings are regrowing and your sense of smell and taste are improving.`;
        } else if (hoursSmokeFree < 72) {
            const days = Math.floor(hoursSmokeFree / 24);
            return `🌬️ ${days} days smoke-free! Your breathing is easier as your bronchial tubes are relaxing and lung capacity is increasing.`;
        } else if (hoursSmokeFree < 168) {
            const days = Math.floor(hoursSmokeFree / 24);
            return `🔥 ${days} days without cigarettes! Nicotine is completely eliminated from your body. You're breaking free!`;
        } else if (hoursSmokeFree < 336) {
            const days = Math.floor(hoursSmokeFree / 24);
            return `💪 ${days} days strong! Your circulation is improving and walking is becoming easier.`;
        } else if (hoursSmokeFree < 720) {
            const weeks = Math.floor(hoursSmokeFree / 168);
            return `🫀 ${weeks} week${weeks > 1 ? 's' : ''} smoke-free! Your heart disease risk has dropped by 50%. Keep going!`;
        } else if (hoursSmokeFree < 2160) {
            const weeks = Math.floor(hoursSmokeFree / 168);
            return `🧠 ${weeks} weeks without smoking! Your risk of stroke is reducing to that of a non-smoker.`;
        } else if (hoursSmokeFree < 8760) {
            const months = Math.floor(hoursSmokeFree / 720);
            return `🎉 ${months} month${months > 1 ? 's' : ''} smoke-free! Your lung function is improving by up to 30%. You're a champion!`;
        } else {
            const years = Math.floor(hoursSmokeFree / 8760);
            return `👑 ${years} year${years > 1 ? 's' : ''} smoke-free! Your risk of heart disease is now the same as a non-smoker. You've achieved the ultimate victory!`;
        }
    }

    getTimeSinceLastSmoke() {
        if (!this.data.lastSmokeTime) return 0;
        const lastSmoke = new Date(this.data.lastSmokeTime);
        const now = new Date();
        return now - lastSmoke;
    }

    showNewQuote() {
        const motivationalMessage = this.getMotivationalMessage();
        document.getElementById('motivationalQuote').textContent = motivationalMessage;
    }

    resetData() {
        if (confirm('Are you sure you want to reset all your data? This action cannot be undone.')) {
            localStorage.removeItem('smokingTrackerData');
            this.initializeData();
            this.updateDisplay();
            this.checkAchievements();
            
            // Show confirmation
            const notification = document.createElement('div');
            notification.textContent = '✅ Data has been reset successfully!';
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #4CAF50;
                color: white;
                padding: 15px 20px;
                border-radius: 10px;
                z-index: 1000;
            `;
            
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 3000);
        }
    }

    // QR Code and Data Sync Methods
    generateQRCode() {
        const dataToExport = {
            ...this.data,
            exportedAt: new Date().toISOString(),
            version: "1.0"
        };
        
        const dataString = JSON.stringify(dataToExport);
        const encodedData = btoa(dataString); // Base64 encode
        
        // Use QR.js library via CDN
        const qrDisplay = document.getElementById('qrDisplay');
        qrDisplay.innerHTML = `
            <div>
                <div id="qrcode"></div>
                <div class="qr-instructions">
                    Scan this QR code with your mobile device to import your data.<br>
                    QR code will disappear in 2 minutes for security.
                </div>
            </div>
        `;
        
        // Generate QR code using a simple library-free approach
        this.createQRCode(encodedData);
        
        // Auto-hide QR code after 2 minutes
        setTimeout(() => {
            qrDisplay.innerHTML = '<p style="color: #666;">QR code expired for security</p>';
        }, 120000);
    }

    createQRCode(data) {
        // Simple QR code generation using qr-server.com API
        const qrSize = 200;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(data)}`;
        
        const qrDisplay = document.getElementById('qrcode');
        qrDisplay.innerHTML = `
            <img src="${qrUrl}" alt="QR Code" class="qr-code" style="max-width: 200px;">
        `;
    }

    startQRScan() {
        // For mobile devices, we'll use camera
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            this.startCameraScan();
        } else {
            // Fallback to file upload
            document.getElementById('qrFileInput').click();
        }
    }

    async startCameraScan() {
        try {
            const video = document.getElementById('qrVideo');
            const canvas = document.getElementById('qrCanvas');
            const context = canvas.getContext('2d');
            
            video.style.display = 'block';
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            video.srcObject = stream;
            video.play();
            
            // Create stop button and status
            const qrDisplay = document.getElementById('qrDisplay');
            qrDisplay.innerHTML = `
                <div>
                    <p id="scanStatus">Point your camera at the QR code</p>
                    <p style="font-size: 0.8rem; color: #666; margin: 10px 0;">Make sure the QR code is well lit and centered</p>
                    <button onclick="smokingTracker.stopCameraScan()" class="sync-btn" style="background: #dc3545;">Stop Camera</button>
                </div>
            `;
            
            // Scan for QR codes every 300ms
            this.scanInterval = setInterval(() => {
                if (video.readyState === video.HAVE_ENOUGH_DATA) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    context.drawImage(video, 0, 0);
                    
                    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                    const code = this.detectQRCode(imageData);
                    
                    // Update status
                    const statusEl = document.getElementById('scanStatus');
                    if (statusEl) {
                        statusEl.textContent = code ? 'QR Code detected! Processing...' : 'Scanning for QR code...';
                    }
                    
                    if (code) {
                        this.processQRData(code);
                        this.stopCameraScan();
                    }
                }
            }, 300);
            
        } catch (error) {
            console.error('Camera access denied:', error);
            this.showNotification('Camera access denied. Use Export/Import instead.', 'error');
            
            // Show fallback options
            const qrDisplay = document.getElementById('qrDisplay');
            qrDisplay.innerHTML = `
                <div>
                    <p style="color: #dc3545; margin-bottom: 15px;">📷 Camera access denied</p>
                    <p style="font-size: 0.9rem; margin-bottom: 15px;">Try these alternatives:</p>
                    <button onclick="document.getElementById('qrFileInput').click()" class="sync-btn">Upload QR Image</button>
                    <p style="font-size: 0.8rem; color: #666; margin-top: 10px;">
                        Or use Export/Import buttons below for manual file transfer
                    </p>
                </div>
            `;
        }
    }

    stopCameraScan() {
        const video = document.getElementById('qrVideo');
        const stream = video.srcObject;
        
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        
        video.style.display = 'none';
        video.srcObject = null;
        
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
        }
        
        document.getElementById('qrDisplay').innerHTML = '';
    }

    detectQRCode(imageData) {
        // Use jsQR library to detect QR codes
        if (typeof jsQR !== 'undefined') {
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            return code ? code.data : null;
        }
        return null;
    }

    handleQRFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        this.showNotification('Processing QR image...', 'info');
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Create canvas to process the image
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                context.drawImage(img, 0, 0);
                
                // Get image data and try to detect QR code
                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                const code = this.detectQRCode(imageData);
                
                if (code) {
                    this.processQRData(code);
                } else {
                    this.showNotification('❌ No QR code found in image. Try a clearer photo.', 'error');
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
        
        // Reset file input
        event.target.value = '';
    }

    processQRData(qrData) {
        try {
            const decodedData = atob(qrData); // Base64 decode
            const importedData = JSON.parse(decodedData);
            
            if (this.validateImportData(importedData)) {
                if (confirm('Import data from QR code? This will replace your current data.')) {
                    this.data = { ...importedData };
                    delete this.data.exportedAt;
                    delete this.data.version;
                    this.saveData();
                    this.updateDisplay();
                    this.checkAchievements();
                    this.showNewQuote();
                    this.showNotification('✅ Data imported successfully from QR code!', 'success');
                }
            } else {
                this.showNotification('❌ Invalid QR code data', 'error');
            }
        } catch (error) {
            this.showNotification('❌ Failed to process QR code data', 'error');
        }
    }

    // Manual Export/Import Methods
    exportData() {
        const dataToExport = {
            ...this.data,
            exportedAt: new Date().toISOString(),
            version: "1.0"
        };
        
        const dataStr = JSON.stringify(dataToExport, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `stop-smokin-data-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        this.showNotification('✅ Data exported successfully!', 'success');
    }

    importData() {
        document.getElementById('fileInput').click();
    }

    handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                if (this.validateImportData(importedData)) {
                    if (confirm('Import data from file? This will replace your current data.')) {
                        this.data = { ...importedData };
                        delete this.data.exportedAt;
                        delete this.data.version;
                        this.saveData();
                        this.updateDisplay();
                        this.checkAchievements();
                        this.showNewQuote();
                        this.showNotification('✅ Data imported successfully!', 'success');
                    }
                } else {
                    this.showNotification('❌ Invalid file format', 'error');
                }
            } catch (error) {
                this.showNotification('❌ Failed to parse file', 'error');
            }
        };
        reader.readAsText(file);
        
        // Reset file input
        event.target.value = '';
    }

    validateImportData(data) {
        return data && 
               Array.isArray(data.smokingEvents) &&
               typeof data.totalCigarettes === 'number' &&
               typeof data.longestStreak === 'number' &&
               typeof data.currentLevel === 'number' &&
               typeof data.achievements === 'object';
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.textContent = message;
        
        const colors = {
            success: '#4CAF50',
            error: '#dc3545',
            info: '#17a2b8'
        };
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            z-index: 1000;
            animation: slideIn 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 4000);
    }
}

// Make the instance globally accessible for camera controls
let smokingTracker;

// Add CSS animation for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    smokingTracker = new SmokingTracker();
});