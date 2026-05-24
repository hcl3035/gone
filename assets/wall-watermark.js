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
                // 关键修复：现在工具栏结构改变，不需要动态添加按钮
                // 水印设置已经放在下拉菜单中，所以这里跳过创建按钮
                console.log('水印快捷开关已移至下拉菜单，跳过创建');
            }

            if (watermarkToggle) {
                watermarkToggle.onclick = function() {
                    const panel = modal.querySelector('.watermark-panel');
                    if (panel) {
                        const isHidden = panel.style.display === 'none';
                        panel.style.display = isHidden ? 'block' : 'none';
                        
                        // 关键修复：打开面板时更新预览
                        if (isHidden) {
                            this.updatePreview(modal);
                        }
                    }
                }.bind(this);
            }

            const closePanelBtn = watermarkPanel.querySelector('.close-watermark-panel');
            if (closePanelBtn) {
                closePanelBtn.onclick = function() {
                    watermarkPanel.style.display = 'none';
                };
            }

            this.bindSettings(modal);
            
            // 关键修复：初始化时更新一次预览
            this.updatePreview(modal);
        },

        bindSettings: function(modal) {
            const watermarkPanel = modal.querySelector('.watermark-panel');
            console.log('=== bindSettings ===');
            console.log('watermarkPanel:', watermarkPanel);
            
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
            console.log('applyBtn:', applyBtn);
            
            if (applyBtn) {
                applyBtn.onclick = function(e) {
                    console.log('应用水印按钮被点击');
                    e.preventDefault();
                    this.apply(modal);
                }.bind(this);
            } else {
                console.error('找不到应用水印按钮！');
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
                    
                    locationInfo.innerHTML = '✅ 已获取坐标<br>纬度: ' + lat + '<br>经度: ' + lng + '<br>正在获取地址...';
                    
                    // 关键修复：调用反向地理编码API获取地址
                    this.reverseGeocode(lat, lng, function(address) {
                        State.currentLocation.address = address;
                        locationInfo.innerHTML = '✅ 已获取位置<br>纬度: ' + lat + '<br>经度: ' + lng + '<br>地址: ' + address;
                        this.updatePreview(modal);
                    }.bind(this));
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

        reverseGeocode: function(lat, lng, callback) {
            // 关键修复：使用更高的zoom级别获取更详细信息
            const url = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&zoom=20&addressdetails=1';
            
            fetch(url)
                .then(function(response) {
                    return response.json();
                })
                .then(function(data) {
                    if (data && data.display_name) {
                        const address = data.address;
                        let detailedAddress = '';
                        
                        console.log('原始地址数据:', data);
                        console.log('所有地址字段:', Object.keys(address).join(', '));
                        console.log('完整地址 display_name:', data.display_name);
                        
                        // 按优先级组合地址 components
                        const parts = [];
                        
                        // 建筑物/地标名称（最高优先级）
                        if (address.building) {
                            parts.push(address.building);
                        }
                        if (address.amenity) {
                            parts.push(address.amenity);
                        }
                        if (address.landmark) {
                            parts.push(address.landmark);
                        }
                        if (address.place) {
                            parts.push(address.place);
                        }
                        
                        // 街道级别信息
                        if (address.road) {
                            parts.push(address.road);
                        }
                        if (address.pedestrian) {
                            parts.push(address.pedestrian);
                        }
                        if (address.footway) {
                            parts.push(address.footway);
                        }
                        if (address.house_number) {
                            parts.push(address.house_number);
                        }
                        
                        // 区域/街区
                        if (address.suburb) {
                            parts.push(address.suburb);
                        }
                        if (address.neighbourhood) {
                            parts.push(address.neighbourhood);
                        }
                        if (address.quarter) {
                            parts.push(address.quarter);
                        }
                        
                        // 城市/地区
                        if (address.city) {
                            parts.push(address.city);
                        } else if (address.town) {
                            parts.push(address.town);
                        } else if (address.village) {
                            parts.push(address.village);
                        }
                        
                        // 国家/地区
                        if (address.country) {
                            parts.push(address.country);
                        }
                        
                        detailedAddress = parts.join(' ');
                        
                        // 关键修复：如果详细地址太短或为空，使用display_name的前两部分
                        if (!detailedAddress || detailedAddress.length < 10) {
                            // 从display_name提取前两个部分（通常是最详细的信息）
                            const nameParts = data.display_name.split(',');
                            if (nameParts.length >= 2) {
                                detailedAddress = nameParts[0].trim() + ' ' + nameParts[1].trim();
                            } else {
                                detailedAddress = data.display_name;
                            }
                        }
                        
                        console.log('最终详细地址:', detailedAddress);
                        
                        callback(detailedAddress);
                    } else {
                        callback('未知地址');
                    }
                })
                .catch(function(error) {
                    console.error('反向地理编码失败:', error);
                    callback('地址获取失败');
                });
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
                // 关键修复：优先显示地址名称，如果没有则显示坐标
                if (State.currentLocation.address) {
                    parts.push(State.currentLocation.address);
                } else {
                    parts.push(State.currentLocation.lat + ', ' + State.currentLocation.lng);
                }
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
            console.log('=== 应用水印 ===');
            
            // 关键修复：直接使用DOM元素获取当前值，不依赖State
            const enabledCheckbox = modal.querySelector('#watermarkEnabled');
            const locationCheckbox = modal.querySelector('#watermarkLocation');
            const dateCheckbox = modal.querySelector('#watermarkDate');
            const customTextInput = modal.querySelector('#watermarkCustomText');
            const positionSelect = modal.querySelector('#watermarkPosition');
            const opacitySlider = modal.querySelector('#watermarkOpacity');
            const fontSizeInput = modal.querySelector('#watermarkFontSize');
            const colorPicker = modal.querySelector('#watermarkColor');
            
            const config = {
                enabled: enabledCheckbox ? enabledCheckbox.checked : false,
                showLocation: locationCheckbox ? locationCheckbox.checked : false,
                showDate: dateCheckbox ? dateCheckbox.checked : true,
                customText: customTextInput ? customTextInput.value : '',
                position: positionSelect ? positionSelect.value : 'bottom-right',
                opacity: opacitySlider ? parseFloat(opacitySlider.value) : 0.7,
                fontSize: fontSizeInput ? parseInt(fontSizeInput.value) : 16,
                color: colorPicker ? colorPicker.value : '#FFFFFF'
            };
            
            console.log('水印配置（从DOM读取）:', config);
            
            if (!config.enabled) {
                Utils.showNotification('请先启用水印');
                return;
            }

            // 生成水印文字
            let parts = [];
            if (config.customText) {
                parts.push(config.customText);
            }
            if (config.showLocation && State.currentLocation) {
                // 关键修复：优先显示地址名称，如果没有则显示坐标
                if (State.currentLocation.address) {
                    parts.push(State.currentLocation.address);
                } else {
                    parts.push(State.currentLocation.lat + ', ' + State.currentLocation.lng);
                }
            }
            if (config.showDate) {
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
            
            const watermarkText = parts.join(' | ');
            console.log('生成的水印文字:', watermarkText);
            
            if (!watermarkText) {
                Utils.showNotification('请至少选择一个水印内容');
                return;
            }

            const canvas = State.layerCanvases[State.activeCanvasIndex];
            console.log('当前Canvas:', canvas);
            
            if (!canvas || !canvas.ctx) {
                console.error('画布未初始化');
                Utils.showNotification('画布未初始化');
                return;
            }

            // 关键修复：使用canvas.element获取实际的Canvas DOM元素
            const canvasElement = canvas.element || canvas.canvas;
            const ctx = canvas.ctx;
            
            console.log('Canvas元素:', canvasElement);
            console.log('Canvas尺寸:', canvasElement.width, 'x', canvasElement.height);

            // 保存当前状态
            window.WallDrawing.saveState();
            
            ctx.save();
            ctx.globalAlpha = config.opacity;
            const fontSize = config.fontSize * (canvasElement.width / 1000);
            ctx.font = fontSize + 'px Arial';
            ctx.fillStyle = config.color;
            ctx.textBaseline = 'bottom';

            // 计算位置
            const metrics = ctx.measureText(watermarkText);
            const textWidth = metrics.width;
            const padding = canvasElement.width * 0.02; // 2%的边距
            
            let x, y;
            switch(config.position) {
                case 'top-left':
                    x = padding;
                    y = padding + fontSize;
                    break;
                case 'top-right':
                    x = canvasElement.width - textWidth - padding;
                    y = padding + fontSize;
                    break;
                case 'bottom-left':
                    x = padding;
                    y = canvasElement.height - padding;
                    break;
                case 'bottom-right':
                    x = canvasElement.width - textWidth - padding;
                    y = canvasElement.height - padding;
                    break;
                case 'center':
                    x = (canvasElement.width - textWidth) / 2;
                    y = canvasElement.height / 2;
                    break;
                default:
                    x = canvasElement.width - textWidth - padding;
                    y = canvasElement.height - padding;
            }
            
            console.log('水印位置:', {x, y});
            console.log('字体大小:', fontSize);
            
            ctx.fillText(watermarkText, x, y);
            ctx.restore();
            
            console.log('水印已绘制到Canvas');

            Utils.showNotification('水印已应用');

            modal.querySelector('.watermark-panel').style.display = 'none';
        },

        // 关键修复：一键自动水印功能
        autoApply: function(modal) {
            const self = this;
            const autoBtn = modal.querySelector('.auto-watermark');
            
            if (!autoBtn) {
                console.error('找不到自动水印按钮');
                return;
            }
            
            // 显示处理中状态
            autoBtn.classList.add('processing');
            autoBtn.title = '正在获取位置...';
            Utils.showNotification('🔄 正在获取位置信息...');
            
            // 步骤1：读取原水印设置
            const watermarkPanel = modal.querySelector('.watermark-panel');
            const enabledCheckbox = watermarkPanel.querySelector('#watermarkEnabled');
            const locationCheckbox = watermarkPanel.querySelector('#watermarkLocation');
            
            // 步骤2：自动设置启用水印
            if (enabledCheckbox && !enabledCheckbox.checked) {
                enabledCheckbox.checked = true;
                State.watermarkConfig.enabled = true;
            }
            
            // 步骤3：选中显示地理位置
            if (locationCheckbox && !locationCheckbox.checked) {
                locationCheckbox.checked = true;
                State.watermarkConfig.showLocation = true;
            }
            
            // 步骤4：自动等待获取当前位置的结果
            if (!navigator.geolocation) {
                Utils.showNotification('❌ 浏览器不支持地理定位');
                autoBtn.classList.remove('processing');
                autoBtn.title = '一键自动水印';
                return;
            }
            
            navigator.geolocation.getCurrentPosition(
                function(position) {
                    const lat = position.coords.latitude.toFixed(6);
                    const lng = position.coords.longitude.toFixed(6);
                    State.currentLocation = { lat, lng };
                    
                    Utils.showNotification('✅ 已获取坐标，正在获取地址...');
                    
                    // 关键修复：调用反向地理编码API获取地址
                    self.reverseGeocode(lat, lng, function(address) {
                        State.currentLocation.address = address;
                        Utils.showNotification('✅ 位置获取成功，正在应用水印...');
                        
                        // 更新预览
                        self.updatePreview(modal);
                        
                        // 步骤5：自动应用水印
                        setTimeout(function() {
                            self.apply(modal);
                            
                            // 恢复按钮状态
                            autoBtn.classList.remove('processing');
                            autoBtn.title = '一键自动水印';
                            Utils.showNotification('✅ 自动水印应用成功！');
                        }, 500);
                    });
                },
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
                    Utils.showNotification(errorMsg);
                    
                    // 恢复按钮状态
                    autoBtn.classList.remove('processing');
                    autoBtn.title = '一键自动水印';
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        },
    };
})();
