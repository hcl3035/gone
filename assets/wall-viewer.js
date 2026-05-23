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
                    <div class="text-input-container" style="display:none;">
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
            
            // 绑定标注工具（但不初始化图层）
            window.WallDrawing.setupToolsWithoutInit(modal);
            window.WallText.setupInput(modal);
            window.WallText.makeMovable();
            window.WallLayers.init(modal);
            window.WallWatermark.setup(modal);
            
            console.log('Tools setup complete');

            // 键盘事件
            document.addEventListener('keydown', function(e) {
                if (modal.style.display === 'flex') {
                    // 关键修复：如果输入框正在聚焦，禁用所有快捷键
                    const textInput = modal.querySelector('.text-annotation-input');
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
        }
    };
})();
