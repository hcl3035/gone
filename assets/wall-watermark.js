// wall-watermark.js - 水印功能
(function() {
    'use strict';

    const State = window.WallState;
    const Utils = window.WallUtils;

    window.WallWatermark = {
        setup: function(modal) {
            const watermarkPanel = modal.querySelector('.watermark-panel');
            if (!watermarkPanel) return;

            let watermarkToggle = modal.querySelector('.watermark-toggle');
            if (!watermarkToggle) {
                const toolbar = modal.querySelector('.modal-toolbar');
                if (toolbar) {
                    watermarkToggle = document.createElement('button');
                    watermarkToggle.className = 'toolbar-btn watermark-toggle';
                    watermarkToggle.title = '水印设置';
                    watermarkToggle.innerHTML = '💧';
                    const exportPdfBtn = toolbar.querySelector('.export-pdf');
                    if (exportPdfBtn) {
                        toolbar.insertBefore(watermarkToggle, exportPdfBtn);
                    } else {
                        toolbar.appendChild(watermarkToggle);
                    }
                }
            }

            if (watermarkToggle) {
                watermarkToggle.onclick = function() {
                    const panel = modal.querySelector('.watermark-panel');
                    if (panel) {
                        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
                    }
                };
            }

            const closePanelBtn = watermarkPanel.querySelector('.close-watermark-panel');
            if (closePanelBtn) {
                closePanelBtn.onclick = function() {
                    watermarkPanel.style.display = 'none';
                };
            }

            this.bindSettings(modal);
        },

        bindSettings: function(modal) {
            const watermarkPanel = modal.querySelector('.watermark-panel');
            
            const enabledCheckbox = watermarkPanel.querySelector('#watermarkEnabled');
            if (enabledCheckbox) {
                enabledCheckbox.onchange = function() {
                    State.watermarkConfig.enabled = this.checked;
                    this.updatePreview(modal);
                }.bind(this);
            }

            const locationCheckbox = watermarkPanel.querySelector('#watermarkLocation');
            if (locationCheckbox) {
                locationCheckbox.onchange = function() {
                    State.watermarkConfig.showLocation = this.checked;
                    this.updatePreview(modal);
                }.bind(this);
            }

            const dateCheckbox = watermarkPanel.querySelector('#watermarkDate');
            if (dateCheckbox) {
                dateCheckbox.onchange = function() {
                    State.watermarkConfig.showDate = this.checked;
                    this.updatePreview(modal);
                }.bind(this);
            }

            const customTextInput = watermarkPanel.querySelector('#watermarkCustomText');
            if (customTextInput) {
                customTextInput.oninput = function() {
                    State.watermarkConfig.customText = this.value;
                    this.updatePreview(modal);
                }.bind(this);
            }

            const positionSelect = watermarkPanel.querySelector('#watermarkPosition');
            if (positionSelect) {
                positionSelect.onchange = function() {
                    State.watermarkConfig.position = this.value;
                    this.updatePreview(modal);
                }.bind(this);
            }

            const opacitySlider = watermarkPanel.querySelector('#watermarkOpacity');
            const opacityValue = watermarkPanel.querySelector('#opacityValue');
            if (opacitySlider) {
                opacitySlider.oninput = function() {
                    State.watermarkConfig.opacity = parseFloat(this.value);
                    if (opacityValue) {
                        opacityValue.textContent = this.value;
                    }
                    this.updatePreview(modal);
                }.bind(this);
            }

            const fontSizeInput = watermarkPanel.querySelector('#watermarkFontSize');
            if (fontSizeInput) {
                fontSizeInput.onchange = function() {
                    State.watermarkConfig.fontSize = parseInt(this.value);
                    this.updatePreview(modal);
                }.bind(this);
            }

            const colorPicker = watermarkPanel.querySelector('#watermarkColor');
            if (colorPicker) {
                colorPicker.onchange = function() {
                    State.watermarkConfig.color = this.value;
                    this.updatePreview(modal);
                }.bind(this);
            }

            const getLocationBtn = watermarkPanel.querySelector('#getLocationBtn');
            if (getLocationBtn) {
                getLocationBtn.onclick = function() {
                    this.getLocation(modal);
                }.bind(this);
            }

            const applyBtn = watermarkPanel.querySelector('#applyWatermarkBtn');
            if (applyBtn) {
                applyBtn.onclick = function() {
                    this.apply(modal);
                }.bind(this);
            }
        },

        getLocation: function(modal) {
            const locationInfo = modal.querySelector('#locationInfo');
            locationInfo.textContent = '正在获取位置...';

            if (!navigator.geolocation) {
                locationInfo.textContent = '❌ 浏览器不支持地理定位';
                return;
            }

            navigator.geolocation.getCurrentPosition(
                function(position) {
                    const lat = position.coords.latitude.toFixed(6);
                    const lng = position.coords.longitude.toFixed(6);
                    State.currentLocation = { lat, lng };
                    locationInfo.innerHTML = '✅ 已获取位置<br>纬度: ' + lat + '<br>经度: ' + lng;
                    this.updatePreview(modal);
                }.bind(this),
                function(error) {
                    let errorMsg = '❌ 获取位置失败: ';
                    switch(error.code) {
                        case error.PERMISSION_DENIED:
                            errorMsg += '用户拒绝授权';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMsg += '位置信息不可用';
                            break;
                        case error.TIMEOUT:
                            errorMsg += '请求超时';
                            break;
                        default:
                            errorMsg += '未知错误';
                    }
                    locationInfo.textContent = errorMsg;
                },
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                }
            );
        },

        updatePreview: function(modal) {
            const previewCanvas = modal.querySelector('#watermarkPreviewCanvas');
            if (!previewCanvas) return;

            const ctx = previewCanvas.getContext('2d');
            previewCanvas.width = 300;
            previewCanvas.height = 200;

            ctx.fillStyle = '#333';
            ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

            const watermarkText = this.generateText();
            if (!watermarkText) return;

            const pos = this.calculatePosition(previewCanvas.width, previewCanvas.height, watermarkText, ctx);

            ctx.globalAlpha = State.watermarkConfig.opacity;
            ctx.font = State.watermarkConfig.fontSize + 'px Arial';
            ctx.fillStyle = State.watermarkConfig.color;
            ctx.fillText(watermarkText, pos.x, pos.y);
            ctx.globalAlpha = 1;
        },

        generateText: function() {
            let parts = [];

            if (State.watermarkConfig.customText) {
                parts.push(State.watermarkConfig.customText);
            }

            if (State.watermarkConfig.showLocation && State.currentLocation) {
                parts.push(State.currentLocation.lat + ', ' + State.currentLocation.lng);
            }

            if (State.watermarkConfig.showDate) {
                const now = new Date();
                const dateStr = now.toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                parts.push(dateStr);
            }

            return parts.join(' | ');
        },

        calculatePosition: function(canvasWidth, canvasHeight, text, ctx) {
            const metrics = ctx.measureText(text);
            const textWidth = metrics.width;
            const textHeight = State.watermarkConfig.fontSize;
            const padding = 10;

            let x, y;

            switch(State.watermarkConfig.position) {
                case 'top-left':
                    x = padding;
                    y = padding + textHeight;
                    break;
                case 'top-right':
                    x = canvasWidth - textWidth - padding;
                    y = padding + textHeight;
                    break;
                case 'bottom-left':
                    x = padding;
                    y = canvasHeight - padding;
                    break;
                case 'bottom-right':
                    x = canvasWidth - textWidth - padding;
                    y = canvasHeight - padding;
                    break;
                case 'center':
                    x = (canvasWidth - textWidth) / 2;
                    y = canvasHeight / 2;
                    break;
                default:
                    x = canvasWidth - textWidth - padding;
                    y = canvasHeight - padding;
            }

            return { x, y };
        },

        apply: function(modal) {
            if (!State.watermarkConfig.enabled) {
                Utils.showNotification('请先启用水印');
                return;
            }

            const watermarkText = this.generateText();
            if (!watermarkText) {
                Utils.showNotification('请至少选择一个水印内容');
                return;
            }

            const canvas = State.layerCanvases[State.activeCanvasIndex];
            if (!canvas || !canvas.ctx) {
                Utils.showNotification('画布未初始化');
                return;
            }

            canvas.ctx.save();
            canvas.ctx.globalAlpha = State.watermarkConfig.opacity;
            canvas.ctx.font = State.watermarkConfig.fontSize + 'px Arial';
            canvas.ctx.fillStyle = State.watermarkConfig.color;

            const pos = this.calculatePosition(canvas.width, canvas.height, watermarkText, canvas.ctx);
            canvas.ctx.fillText(watermarkText, pos.x, pos.y);

            canvas.ctx.restore();

            window.WallDrawing.saveState();
            Utils.showNotification('水印已应用');

            modal.querySelector('.watermark-panel').style.display = 'none';
        }
    };
})();
