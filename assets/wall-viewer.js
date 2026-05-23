

// wall-viewer.js - 图片模态框查看器
(function() {
    'use strict';

    const State = window.WallState;
    const Utils = window.WallUtils;

    window.WallViewer = {
        open: function(imageUrl, imageKey) {
            // 收集所有图片
            State.allImages = [];
            const previewImgs = document.querySelectorAll('.previewImage');
            previewImgs.forEach(function(img, index) {
                State.allImages.push({
                    id: img.dataset.imageId,
                    src: img.dataset.imageUrl
                });
                if (img.dataset.imageId === imageKey) {
                    State.currentImageIndex = index;
                }
            });
            
            State.currentScale = 1;
            State.translateX = 0;
            State.translateY = 0;
            
            let modal = document.getElementById('imageModal');
            if (!modal) {
                this.createModal();
                modal = document.getElementById('imageModal');
            }
            
            modal.style.display = 'flex';
            this.updateModalImage();
        },

        createModal: function() {
            const modal = document.createElement('div');
            modal.id = 'imageModal';
            modal.className = 'imageModal';
            modal.innerHTML = `
                <div class="modal-toolbar">
                    <button class="toolbar-btn zoom-in" title="放大">+</button>
                    <button class="toolbar-btn zoom-out" title="缩小">−</button>
                    <button class="toolbar-btn zoom-reset" title="重置">⟲</button>
                    <span class="zoom-level">100%</span>
                    <div class="toolbar-separator"></div>
                    <button class="toolbar-btn tool-hand" title="平移/抓手" data-tool="hand">✋</button>
                    <button class="toolbar-btn tool-select" title="选择/移动" data-tool="select">👆</button>
                    <button class="toolbar-btn tool-brush active" title="画笔" data-tool="brush">✏️</button>
                    <button class="toolbar-btn tool-straight-line" title="直线画笔" data-tool="straight-line">📏</button>
                    <button class="toolbar-btn tool-eraser" title="橡皮擦" data-tool="eraser"></button>
                    <button class="toolbar-btn tool-text" title="文字" data-tool="text">T</button>
                    <button class="toolbar-btn tool-arrow" title="箭头" data-tool="arrow">➡️</button>
                    <button class="toolbar-btn tool-rect" title="矩形" data-tool="rect">⬜</button>
                    <button class="toolbar-btn tool-circle" title="圆形" data-tool="circle">⭕</button>
                    <input type="color" class="color-picker" value="#FF0000" title="选择颜色">
                    <input type="range" class="brush-size" min="1" max="20" value="3" title="画笔粗细">
                    <input type="range" class="opacity-slider" min="0.1" max="1" step="0.1" value="1" title="透明度">
                    <span class="opacity-value" style="color: white; font-size: 12px; min-width: 35px;">100%</span>
                    <button class="toolbar-btn draw-undo" title="撤销">↩️</button>
                    <button class="toolbar-btn draw-redo" title="重做">↪️</button>
                    <button class="toolbar-btn draw-clear" title="清空">🗑️</button>
                    <div class="toolbar-separator"></div>
                    <button class="toolbar-btn layer-manager" title="图层管理">📚</button>
                    <button class="toolbar-btn export-pdf" title="导出PDF">📄</button>
                    <button class="toolbar-btn download-annotated" title="下载标注图片">💾</button>
                </div>
                <span class="modal-close">&times;</span>
                <button class="modal-nav modal-prev">&#10094;</button>
                <div class="modal-image-container">
                    <div class="layers-container" style="position:absolute; top:0; left:0; width:100%; height:100%;">
                        <img class="modal-image" src="" alt="Original Image" style="display:block; width:100%; height:100%; object-fit:contain;">
                    </div>
                    <div class="text-annotations-container" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:100; transform-origin:0 0;">
                    </div>
                    <div class="text-input-container" style="display:none; position:fixed; z-index:10000;">
                        <textarea class="text-annotation-input" placeholder="输入文字..."></textarea>
                        <button class="text-confirm-btn">确认</button>
                    </div>
                </div>
                <button class="modal-nav modal-next">&#10095;</button>
                <div class="modal-caption"></div>
                
                <div class="layer-panel" style="display:none;">
                    <div class="layer-panel-header">
                        <h3>图层管理</h3>
                        <button class="close-layer-panel">×</button>
                    </div>
                    <div class="layer-list"></div>
                    <button class="add-layer-btn">+ 新建图层</button>
                </div>
                
                <div class="watermark-panel" style="display:none;">
                    <div class="watermark-panel-header">
                        <h3>水印设置</h3>
                        <button class="close-watermark-panel">×</button>
                    </div>
                    <div class="watermark-options">
                        <label class="watermark-option">
                            <input type="checkbox" id="watermarkEnabled">
                            <span>启用水印</span>
                        </label>
                        <div class="watermark-section">
                            <h4>内容设置</h4>
                            <label class="watermark-option">
                                <input type="checkbox" id="watermarkLocation">
                                <span>显示地理位置</span>
                            </label>
                            <label class="watermark-option">
                                <input type="checkbox" id="watermarkDate" checked>
                                <span>显示日期时间</span>
                            </label>
                            <div class="watermark-input-group">
                                <label>自定义文字：</label>
                                <input type="text" id="watermarkCustomText" placeholder="输入自定义文字...">
                            </div>
                        </div>
                        <div class="watermark-section">
                            <h4>位置设置</h4>
                            <select id="watermarkPosition">
                                <option value="bottom-right">右下角</option>
                                <option value="bottom-left">左下角</option>
                                <option value="top-right">右上角</option>
                                <option value="top-left">左上角</option>
                                <option value="center">居中</option>
                            </select>
                        </div>
                        <div class="watermark-section">
                            <h4>样式设置</h4>
                            <div class="watermark-input-group">
                                <label>透明度：</label>
                                <input type="range" id="watermarkOpacity" min="0.1" max="1" step="0.1" value="0.7">
                                <span id="opacityValue">0.7</span>
                            </div>
                            <div class="watermark-input-group">
                                <label>字体大小：</label>
                                <input type="number" id="watermarkFontSize" min="10" max="48" value="16">
                            </div>
                            <div class="watermark-input-group">
                                <label>颜色：</label>
                                <input type="color" id="watermarkColor" value="#FFFFFF">
                            </div>
                        </div>
                        <div class="watermark-section">
                            <button class="get-location-btn" id="getLocationBtn">📍 获取当前位置</button>
                            <div class="location-info" id="locationInfo"></div>
                        </div>
                        <div class="watermark-preview">
                            <h4>预览</h4>
                            <canvas id="watermarkPreviewCanvas"></canvas>
                        </div>
                    </div>
                    <button class="apply-watermark-btn" id="applyWatermarkBtn">应用水印</button>
                </div>
            `;
            document.body.appendChild(modal);
            
            this.bindModalEvents(modal);
        },

        bindModalEvents: function(modal) {
            const self = this;
            
            modal.querySelector('.modal-close').onclick = function() { self.close(); };
            modal.querySelector('.modal-prev').onclick = function() { self.showPrev(); };
            modal.querySelector('.modal-next').onclick = function() { self.showNext(); };
            modal.querySelector('.zoom-in').onclick = function() { self.zoomIn(); };
            modal.querySelector('.zoom-out').onclick = function() { self.zoomOut(); };
            modal.querySelector('.zoom-reset').onclick = function() { self.resetZoom(); };
            
            modal.onclick = function(e) {
                if (e.target === modal) self.close();
            };
            
            // 关键修复：图片在layers-container内部
            const layersContainer = modal.querySelector('.layers-container');
            const img = layersContainer ? layersContainer.querySelector('.modal-image') : null;
            const imgContainer = modal.querySelector('.modal-image-container');
            let isSpacePressed = false;
            
            // 监听键盘事件（空格键）
            document.addEventListener('keydown', function(e) {
                if (e.code === 'Space' && !isSpacePressed) {
                    isSpacePressed = true;
                    if (img) img.style.cursor = 'grab';
                    e.preventDefault();
                }
            });

            document.addEventListener('keyup', function(e) {
                if (e.code === 'Space') {
                    isSpacePressed = false;
                    if (img) img.style.cursor = '';
                    if (State.isDragging) {
                        State.isDragging = false;
                    }
                }
            });

            // 容器上的鼠标按下事件（用于平移）
            imgContainer.addEventListener('mousedown', function(e) {
                const canPan = isSpacePressed || State.currentTool === 'hand' || e.button === 1;

                if (canPan) {
                    State.isDragging = true;
                    State.startX = e.clientX - State.translateX;
                    State.startY = e.clientY - State.translateY;
                    if (img) img.style.cursor = 'grabbing';
                    e.preventDefault();
                }
            });

            // 全局鼠标移动
            document.addEventListener('mousemove', function(e) {
                if (State.isDragging) {
                    State.translateX = e.clientX - State.startX;
                    State.translateY = e.clientY - State.startY;
                    self.applyTransform();
                    e.preventDefault();
                }
            });

            // 全局鼠标释放
            document.addEventListener('mouseup', function(e) {
                if (State.isDragging) {
                    State.isDragging = false;
                    if (img) {
                        if (isSpacePressed || State.currentTool === 'hand') {
                            img.style.cursor = 'grab';
                        } else {
                            img.style.cursor = '';
                        }
                    }
                }
            });

            // 阻止鼠标中键的默认行为
            imgContainer.addEventListener('mousedown', function(e) {
                if (e.button === 1) {
                    e.preventDefault();
                }
            });

            imgContainer.addEventListener('wheel', function(e) {
                e.preventDefault();
                if (e.deltaY < 0) {
                    self.zoomIn();
                } else {
                    self.zoomOut();
                }
            });
            
            // 关键修复：添加多点触控支持（双指缩放和平移）
            this.setupMultiTouch(imgContainer, layersContainer);
            
            // 绑定标注工具（但不初始化图层）
            window.WallDrawing.setupToolsWithoutInit(modal);
            window.WallText.setupInput(modal);
            window.WallText.makeMovable();
            window.WallLayers.init(modal);
            
            console.log('WallWatermark对象:', window.WallWatermark);
            if (window.WallWatermark && window.WallWatermark.setup) {
                console.log('调用WallWatermark.setup');
                window.WallWatermark.setup(modal);
            } else {
                console.error('WallWatermark未加载！');
            }
            
            // 关键修复：添加工具栏拖动功能
            this.makeToolbarDraggable(modal);
            
            console.log('Tools setup complete');

            // 键盘事件
            document.addEventListener('keydown', function(e) {
                if (modal.style.display === 'flex') {
                    // 关键修复：如果输入框正在聚焦，禁用所有快捷键
                    const textInput = modal.querySelector('.text-annotation-input');
                    const textInputContainer = modal.querySelector('.text-input-container');
                    
                    if (textInput && document.activeElement === textInput) {
                        // 只允许Escape关闭输入框
                        if (e.key === 'Escape') {
                            textInputContainer.style.display = 'none';
                            textInput.value = '';
                        }
                        return;
                    }
                    
                    if (e.key === 'Escape') self.close();
                    if (e.key === 'ArrowLeft') self.showPrev();
                    if (e.key === 'ArrowRight') self.showNext();
                    if (e.key === '+' || e.key === '=') self.zoomIn();
                    if (e.key === '-') self.zoomOut();
                    if (e.key === '0') self.resetZoom();
                }
            });
        },

        updateModalImage: function() {
            const modal = document.getElementById('imageModal');
            if (!modal || State.allImages.length === 0) return;
            
            // 关键修复：图片在layers-container内部
            const layersContainer = modal.querySelector('.layers-container');
            const img = layersContainer ? layersContainer.querySelector('.modal-image') : null;
            const caption = modal.querySelector('.modal-caption');
            const prevBtn = modal.querySelector('.modal-prev');
            const nextBtn = modal.querySelector('.modal-next');
            const zoomLevel = modal.querySelector('.zoom-level');
            
            if (img) {
                // 先清除旧的Canvas
                const oldCanvases = layersContainer.querySelectorAll('.annotation-layer');
                oldCanvases.forEach(canvas => canvas.remove());
                
                // 设置图片src
                img.src = State.allImages[State.currentImageIndex].src;
                
                console.log('Setting image src:', img.src);
                console.log('Image complete before load:', img.complete);
                
                // 关键修复：确保图片加载完成后再初始化图层
                if (img.complete && img.naturalWidth) {
                    console.log('Image already loaded, initializing layers immediately');
                    this.initLayersAfterImageLoad(modal);
                } else {
                    console.log('Waiting for image to load...');
                    img.onload = function() {
                        console.log('Image loaded successfully');
                        this.initLayersAfterImageLoad(modal);
                    }.bind(this);
                    
                    img.onerror = function() {
                        console.error('Failed to load image');
                    };
                }
            } else {
                console.error('modal-image not found in layers-container');
            }
            
            caption.textContent = 'Image ' + State.allImages[State.currentImageIndex].id + 
                                 ' (' + (State.currentImageIndex + 1) + '/' + State.allImages.length + ')';
            
            prevBtn.style.display = State.allImages.length > 1 ? 'block' : 'none';
            nextBtn.style.display = State.allImages.length > 1 ? 'block' : 'none';
            zoomLevel.textContent = Math.round(State.currentScale * 100) + '%';
            
            this.applyTransform();
        },

        initLayersAfterImageLoad: function(modal) {
            console.log('initLayersAfterImageLoad called');
            // 重新初始化图层（图片加载完成后）
            if (window.WallDrawing && window.WallDrawing.initLayers) {
                // 不再使用setTimeout，直接调用
                window.WallDrawing.initLayers(modal);
            }
        },

        applyTransform: function() {
            const modal = document.getElementById('imageModal');
            if (!modal) return;

            // 关键修复：图片在layers-container内部
            const layersContainer = modal.querySelector('.layers-container');
            const textContainer = modal.querySelector('.text-annotations-container');

            const transform = 'translate(' + State.translateX + 'px, ' + State.translateY + 'px) scale(' + State.currentScale + ')';
            
            // 对layers-container应用transform（包含图片和Canvas）
            if (layersContainer) {
                layersContainer.style.transform = transform;
            }
            
            // 文字容器也应用相同的transform
            if (textContainer) {
                textContainer.style.transform = transform;
            }

            const zoomLevel = modal.querySelector('.zoom-level');
            zoomLevel.textContent = Math.round(State.currentScale * 100) + '%';
        },

        zoomIn: function() {
            State.currentScale = Math.min(State.currentScale + 0.25, 5);
            this.applyTransform();
        },

        zoomOut: function() {
            State.currentScale = Math.max(State.currentScale - 0.25, 0.25);
            if (State.currentScale <= 1) {
                State.translateX = 0;
                State.translateY = 0;
            }
            this.applyTransform();
        },

        resetZoom: function() {
            State.currentScale = 1;
            State.translateX = 0;
            State.translateY = 0;
            State.isDragging = false;
            this.applyTransform();
        },

        showPrev: function() {
            if (State.allImages.length <= 1) return;
            State.currentImageIndex = (State.currentImageIndex - 1 + State.allImages.length) % State.allImages.length;
            this.resetZoom();
            this.updateModalImage();
            setTimeout(function() {
                window.WallLayers.reinit();
                window.WallText.makeMovable(); // 重新启用文字拖动
            }, 100);
        },

        showNext: function() {
            if (State.allImages.length <= 1) return;
            State.currentImageIndex = (State.currentImageIndex + 1) % State.allImages.length;
            this.resetZoom();
            this.updateModalImage();
            setTimeout(function() {
                window.WallLayers.reinit();
                window.WallText.makeMovable(); // 重新启用文字拖动
            }, 100);
        },

        close: function() {
            const modal = document.getElementById('imageModal');
            if (modal) {
                modal.style.display = 'none';
            }
        },

        makeToolbarDraggable: function(modal) {
            const toolbar = modal.querySelector('.modal-toolbar');
            if (!toolbar) return;

            let isDragging = false;
            let startX, startY, initialLeft, initialTop;
            let hasBeenDragged = false; // 关键修复：标记是否已经拖动过

            // 鼠标事件
            toolbar.addEventListener('mousedown', function(e) {
                // 如果点击的是按钮，不拖动
                if (e.target.classList.contains('toolbar-btn') || 
                    e.target.classList.contains('color-picker') ||
                    e.target.tagName === 'INPUT' ||
                    e.target.tagName === 'SELECT') {
                    return;
                }

                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                
                // 关键修复：首次拖动时，先获取实际位置并设置
                if (!hasBeenDragged) {
                    const rect = toolbar.getBoundingClientRect();
                    toolbar.style.left = rect.left + 'px';
                    toolbar.style.top = rect.top + 'px';
                    toolbar.style.transform = 'none';
                    hasBeenDragged = true;
                    
                    // 重新获取位置作为起始点
                    initialLeft = rect.left;
                    initialTop = rect.top;
                } else {
                    const rect = toolbar.getBoundingClientRect();
                    initialLeft = rect.left;
                    initialTop = rect.top;
                }
                
                toolbar.style.cursor = 'grabbing';
                e.preventDefault();
            });

            document.addEventListener('mousemove', function(e) {
                if (!isDragging) return;

                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;
                
                let newLeft = initialLeft + deltaX;
                let newTop = initialTop + deltaY;
                
                // 关键修复：简化的边界检查，允许自由拖动
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                const toolbarWidth = toolbar.offsetWidth;
                const toolbarHeight = toolbar.offsetHeight;
                
                // 允许拖动到屏幕边缘外一点点，提供更好的体验
                newLeft = Math.max(-toolbarWidth / 2, Math.min(newLeft, viewportWidth - toolbarWidth / 2));
                newTop = Math.max(0, Math.min(newTop, viewportHeight - toolbarHeight));
                
                toolbar.style.left = newLeft + 'px';
                toolbar.style.top = newTop + 'px';
                toolbar.style.transform = 'none';
            });

            document.addEventListener('mouseup', function() {
                if (isDragging) {
                    isDragging = false;
                    toolbar.style.cursor = 'move';
                }
            });

            // 触摸事件（移动端支持）
            toolbar.addEventListener('touchstart', function(e) {
                if (e.target.classList.contains('toolbar-btn') || 
                    e.target.classList.contains('color-picker') ||
                    e.target.tagName === 'INPUT' ||
                    e.target.tagName === 'SELECT') {
                    return;
                }

                isDragging = true;
                const touch = e.touches[0];
                startX = touch.clientX;
                startY = touch.clientY;
                
                // 关键修复：首次拖动时，先获取实际位置并设置
                if (!hasBeenDragged) {
                    const rect = toolbar.getBoundingClientRect();
                    toolbar.style.left = rect.left + 'px';
                    toolbar.style.top = rect.top + 'px';
                    toolbar.style.transform = 'none';
                    hasBeenDragged = true;
                    
                    initialLeft = rect.left;
                    initialTop = rect.top;
                } else {
                    const rect = toolbar.getBoundingClientRect();
                    initialLeft = rect.left;
                    initialTop = rect.top;
                }
                
                // 添加视觉反馈
                toolbar.style.opacity = '0.8';
                toolbar.style.transition = 'none';
                
                e.preventDefault();
            }, { passive: false });

            document.addEventListener('touchmove', function(e) {
                if (!isDragging) return;

                const touch = e.touches[0];
                const deltaX = touch.clientX - startX;
                const deltaY = touch.clientY - startY;
                
                let newLeft = initialLeft + deltaX;
                let newTop = initialTop + deltaY;
                
                // 关键修复：简化的边界检查，允许自由拖动
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                const toolbarWidth = toolbar.offsetWidth;
                const toolbarHeight = toolbar.offsetHeight;
                
                newLeft = Math.max(-toolbarWidth / 2, Math.min(newLeft, viewportWidth - toolbarWidth / 2));
                newTop = Math.max(0, Math.min(newTop, viewportHeight - toolbarHeight));
                
                // 关键修复：使用requestAnimationFrame优化性能
                requestAnimationFrame(function() {
                    toolbar.style.left = newLeft + 'px';
                    toolbar.style.top = newTop + 'px';
                    toolbar.style.transform = 'none';
                });
                
                e.preventDefault();
            }, { passive: false });

            document.addEventListener('touchend', function() {
                if (isDragging) {
                    isDragging = false;
                    // 恢复透明度
                    toolbar.style.opacity = '1';
                    toolbar.style.transition = 'opacity 0.2s ease';
                }
            });
        },

        setupMultiTouch: function(container, layersContainer) {
            let initialDistance = 0;
            let initialScale = 1;
            let initialTranslateX = 0;
            let initialTranslateY = 0;
            let lastTouchCenter = { x: 0, y: 0 };
            let isPinching = false;
            
            // 关键修复：单指平移支持
            let isPanning = false;
            let panStartX = 0;
            let panStartY = 0;
            let panInitialTranslateX = 0;
            let panInitialTranslateY = 0;

            container.addEventListener('touchstart', function(e) {
                if (e.touches.length === 2) {
                    // 双指触摸开始 - 缩放模式
                    e.preventDefault();
                    isPinching = true;
                    isPanning = false;
                    
                    const touch1 = e.touches[0];
                    const touch2 = e.touches[1];
                    
                    initialDistance = Math.hypot(
                        touch2.clientX - touch1.clientX,
                        touch2.clientY - touch1.clientY
                    );
                    
                    initialScale = State.currentScale;
                    initialTranslateX = State.translateX;
                    initialTranslateY = State.translateY;
                    
                    lastTouchCenter = {
                        x: (touch1.clientX + touch2.clientX) / 2,
                        y: (touch1.clientY + touch2.clientY) / 2
                    };
                } else if (e.touches.length === 1 && !State.isDrawingMode) {
                    // 关键修复：单指在非绘图模式下可以平移
                    const tool = State.currentTool;
                    const canPan = tool === 'hand' || tool === 'select' || State.currentScale > 1;
                    
                    if (canPan) {
                        e.preventDefault();
                        isPanning = true;
                        isPinching = false;
                        
                        const touch = e.touches[0];
                        panStartX = touch.clientX;
                        panStartY = touch.clientY;
                        panInitialTranslateX = State.translateX;
                        panInitialTranslateY = State.translateY;
                        
                        // 视觉反馈
                        container.style.cursor = 'grabbing';
                    }
                }
            }, { passive: false });

            container.addEventListener('touchmove', function(e) {
                if (isPinching && e.touches.length === 2) {
                    // 双指缩放和平移
                    e.preventDefault();
                    
                    const touch1 = e.touches[0];
                    const touch2 = e.touches[1];
                    
                    const currentDistance = Math.hypot(
                        touch2.clientX - touch1.clientX,
                        touch2.clientY - touch1.clientY
                    );
                    
                    const scaleChange = currentDistance / initialDistance;
                    let newScale = initialScale * scaleChange;
                    newScale = Math.max(0.25, Math.min(newScale, 5));
                    
                    const currentTouchCenter = {
                        x: (touch1.clientX + touch2.clientX) / 2,
                        y: (touch1.clientY + touch2.clientY) / 2
                    };
                    
                    const deltaX = currentTouchCenter.x - lastTouchCenter.x;
                    const deltaY = currentTouchCenter.y - lastTouchCenter.y;
                    
                    State.translateX = initialTranslateX + deltaX;
                    State.translateY = initialTranslateY + deltaY;
                    
                    if (newScale <= 1) {
                        State.translateX = 0;
                        State.translateY = 0;
                    }
                    
                    State.currentScale = newScale;
                    lastTouchCenter = currentTouchCenter;
                    
                    this.applyTransform();
                } else if (isPanning && e.touches.length === 1) {
                    // 关键修复：单指平移
                    e.preventDefault();
                    
                    const touch = e.touches[0];
                    const deltaX = touch.clientX - panStartX;
                    const deltaY = touch.clientY - panStartY;
                    
                    State.translateX = panInitialTranslateX + deltaX;
                    State.translateY = panInitialTranslateY + deltaY;
                    
                    this.applyTransform();
                }
            }.bind(this), { passive: false });

            container.addEventListener('touchend', function(e) {
                if (e.touches.length < 2) {
                    isPinching = false;
                }
                if (e.touches.length === 0) {
                    isPanning = false;
                    container.style.cursor = '';
                }
            });
        }
    };
})();
