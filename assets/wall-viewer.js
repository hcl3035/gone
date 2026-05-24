

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
                
                <!-- 关键修复：工具栏移到最下方，一行显示，支持横向滚动 -->
                <div class="modal-toolbar">
                    <!-- 关键修复：下拉菜单固定在左侧 -->
                    <div class="tool-dropdown-container fixed-left">
                        <button class="toolbar-btn tool-dropdown-toggle" title="选择工具">&#128736;</button>
                        <div class="tool-dropdown-menu">
                            <button class="tool-dropdown-item active" data-tool="brush">&#9999; 画笔</button>
                            <button class="tool-dropdown-item" data-tool="straight-line">&#128207; 直线</button>
                            <button class="tool-dropdown-item" data-tool="eraser">&#129515; 橡皮擦</button>
                            <button class="tool-dropdown-item" data-tool="text">T 文字</button>
                            <button class="tool-dropdown-item" data-tool="arrow">&#10145; 箭头</button>
                            <button class="tool-dropdown-item" data-tool="rect">&#9634; 矩形</button>
                            <button class="tool-dropdown-item" data-tool="circle">&#11093; 圆形</button>
                            <div class="dropdown-separator"></div>
                            <div class="dropdown-separator"></div>
                            <button class="tool-dropdown-item layer-manager-item" id="dropdownLayerManager">&#128218; 图层管理</button>
                            <button class="tool-dropdown-item watermark-settings-item" id="dropdownWatermarkSettings">&#128167; 水印设置</button>
                        </div>
                    </div>
                    
                    <!-- 可滚动的工具容器 -->
                    <div class="toolbar-scrollable">
                        <!-- 导航和常用工具 -->
                        <button class="toolbar-btn zoom-in" title="放大">+</button>
                        <button class="toolbar-btn zoom-out" title="缩小">&minus;</button>
                        <button class="toolbar-btn zoom-reset" title="重置">&#8634;</button>
                        <span class="zoom-level">100%</span>
                        <button class="toolbar-btn tool-hand" title="平移/抓手" data-tool="hand">&#9995;</button>
                        <!-- 关键修复：选择工具移到平移工具右边 -->
                        <button class="toolbar-btn tool-select" title="选择/移动" data-tool="select">&#128070;</button>
                        
                        <!-- 编辑功能 -->
                        <input type="color" class="color-picker" value="#FF0000" title="选择颜色">
                        <input type="range" class="brush-size" min="1" max="20" value="3" title="画笔粗细">
                        <input type="range" class="opacity-slider" min="0.1" max="1" step="0.1" value="1" title="透明度">
                        <span class="opacity-value" style="color: white; font-size: 12px; min-width: 35px;">100%</span>
                        <button class="toolbar-btn draw-undo" title="撤销">&#8617;</button>
                        <button class="toolbar-btn draw-redo" title="重做">&#8618;</button>
                        <button class="toolbar-btn draw-clear" title="清空">&#128465;</button>
                        <div class="toolbar-separator"></div>
                        <button class="toolbar-btn export-pdf" title="导出PDF">&#128196;</button>
                        <button class="toolbar-btn download-annotated" title="下载标注图片">&#128190;</button>
                    </div>
                </div>
                
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
            
            // 关键修复：工具下拉菜单事件处理
            const dropdownToggle = modal.querySelector('.tool-dropdown-toggle');
            const dropdownMenu = modal.querySelector('.tool-dropdown-menu');
            const dropdownItems = modal.querySelectorAll('.tool-dropdown-item');
            
            console.log('=== 下拉菜单元素查找 ===');
            console.log('dropdownToggle:', dropdownToggle);
            console.log('dropdownMenu:', dropdownMenu);
            console.log('dropdownItems数量:', dropdownItems.length);
            
            if (dropdownToggle && dropdownMenu) {
                console.log('下拉菜单初始化成功');
                
                // 关键修复：添加横向滚动支持（触摸拖动）
                const scrollable = modal.querySelector('.toolbar-scrollable');
                let isScrolling = false;
                let scrollStartX = 0;
                let scrollLeft = 0;
                
                scrollable.addEventListener('touchstart', function(e) {
                    isScrolling = true;
                    scrollStartX = e.touches[0].pageX - scrollable.offsetLeft;
                    scrollLeft = scrollable.scrollLeft;
                }, { passive: true });
                
                scrollable.addEventListener('touchmove', function(e) {
                    if (!isScrolling) return;
                    e.preventDefault();
                    const x = e.touches[0].pageX - scrollable.offsetLeft;
                    const walk = (x - scrollStartX) * 2; // 滚动速度加倍
                    scrollable.scrollLeft = scrollLeft - walk;
                }, { passive: false });
                
                scrollable.addEventListener('touchend', function() {
                    isScrolling = false;
                });
                
                // 点击切换按钮显示/隐藏下拉菜单
                dropdownToggle.addEventListener('click', function(e) {
                    console.log('=== 下拉菜单切换按钮被点击 ===');
                    e.stopPropagation();
                    dropdownMenu.classList.toggle('show');
                    console.log('下拉菜单当前状态:', dropdownMenu.classList.contains('show') ? '显示' : '隐藏');
                });
                
                // 关键修复：添加触摸事件支持
                dropdownToggle.addEventListener('touchend', function(e) {
                    console.log('=== 下拉菜单切换按钮被触摸 ===');
                    e.preventDefault();
                    e.stopPropagation();
                    dropdownMenu.classList.toggle('show');
                    console.log('下拉菜单当前状态:', dropdownMenu.classList.contains('show') ? '显示' : '隐藏');
                });
                
                // 关键修复：使用事件委托，在下拉菜单容器上监听点击和触摸
                dropdownMenu.addEventListener('click', function(e) {
                    console.log('=== 下拉菜单被点击（事件委托） ===');
                    handleDropdownItemClick(e);
                });
                
                // 关键修复：添加触摸事件支持
                dropdownMenu.addEventListener('touchend', function(e) {
                    console.log('=== 下拉菜单被触摸（事件委托） ===');
                    e.preventDefault();
                    handleDropdownItemClick(e);
                });
                
                // 处理下拉菜单项点击/触摸的通用函数
                function handleDropdownItemClick(e) {
                    console.log('点击的目标:', e.target);
                    console.log('目标类名:', e.target.className);
                    
                    const item = e.target.closest('.tool-dropdown-item');
                    if (!item) {
                        console.log('点击的不是菜单项');
                        return;
                    }
                    
                    console.log('找到菜单项:', item);
                    
                    e.stopPropagation();
                    
                    // 检查是否是特殊按钮（图层管理或水印设置）
                    if (item.id === 'dropdownLayerManager') {
                        console.log('点击了图层管理');
                        const layerPanel = modal.querySelector('.layer-panel');
                        if (layerPanel) {
                            const isVisible = layerPanel.style.display !== 'none';
                            if (isVisible) {
                                layerPanel.style.display = 'none';
                            } else {
                                layerPanel.style.display = 'block';
                                // 关键修复：打开图层管理面板时，需要渲染列表并绑定按钮事件
                                if (window.WallLayers && window.WallLayers.renderList) {
                                    window.WallLayers.renderList(modal);
                                }
                            }
                        }
                        dropdownMenu.classList.remove('show');
                        return;
                    }
                    
                    if (item.id === 'dropdownWatermarkSettings') {
                        console.log('点击了水印设置');
                        const watermarkPanel = modal.querySelector('.watermark-panel');
                        if (watermarkPanel) {
                            const isVisible = watermarkPanel.style.display !== 'none';
                            watermarkPanel.style.display = isVisible ? 'none' : 'block';
                        }
                        dropdownMenu.classList.remove('show');
                        return;
                    }
                    
                    // 普通工具切换
                    console.log('工具名称:', item.dataset.tool);
                    
                    // 更新active状态
                    dropdownItems.forEach(function(i) { i.classList.remove('active'); });
                    item.classList.add('active');
                    
                    // 触发工具切换
                    const tool = item.dataset.tool;
                    const toolBtn = modal.querySelector(`[data-tool="${tool}"]`);
                    console.log('找到的工具按钮:', toolBtn);
                    if (toolBtn) {
                        console.log('触发工具按钮点击');
                        toolBtn.click();
                    } else {
                        console.error('未找到对应的工具按钮:', tool);
                    }
                    
                    // 隐藏下拉菜单
                    dropdownMenu.classList.remove('show');
                }
                
                // 点击其他地方关闭下拉菜单
                document.addEventListener('click', function() {
                    dropdownMenu.classList.remove('show');
                });
            }
            
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
            // 关键修复：禁用工具栏拖动功能，防止移出页面
            // this.makeToolbarDraggable(modal);
            
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
            
            // 关键修复：屏蔽图片外区域的长按系统菜单（移动端）
            // 使用之前已经声明的 imgContainer 变量
            if (imgContainer) {
                imgContainer.addEventListener('contextmenu', function(e) {
                    e.preventDefault();
                    return false;
                });
                
                // 阻止长按时的默认行为
                imgContainer.addEventListener('touchstart', function(e) {
                    // 如果不是在图片或文字上，阻止默认行为
                    const target = e.target;
                    const isImage = target.classList.contains('modal-image');
                    const isText = target.closest('.text-annotations-container');
                    const isCanvas = target.classList.contains('annotation-layer');
                    
                    if (!isImage && !isText && !isCanvas) {
                        // 在图片外的区域长按，阻止系统菜单
                        e.preventDefault();
                    }
                }, { passive: false });
            }
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

        // 关键修复：工具栏拖动功能已禁用，防止移出页面
        /* makeToolbarDraggable: function(modal) {
            const toolbar = modal.querySelector('.modal-toolbar');
            if (!toolbar) return;

            let isDragging = false;
            let startX, startY, initialLeft, initialTop;
            let hasBeenDragged = false;

            // 鼠标事件
            toolbar.addEventListener('mousedown', function(e) {
                if (e.target.classList.contains('toolbar-btn') || 
                    e.target.classList.contains('color-picker') ||
                    e.target.classList.contains('tool-dropdown-toggle') ||
                    e.target.classList.contains('tool-dropdown-item') ||
                    e.target.closest('.tool-dropdown-menu') ||
                    e.target.tagName === 'INPUT' ||
                    e.target.tagName === 'SELECT') {
                    return;
                }

                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                
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
                
                toolbar.style.cursor = 'grabbing';
                e.preventDefault();
            });

            document.addEventListener('mousemove', function(e) {
                if (!isDragging) return;

                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;
                
                let newLeft = initialLeft + deltaX;
                let newTop = initialTop + deltaY;
                
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                const toolbarWidth = toolbar.offsetWidth;
                const toolbarHeight = toolbar.offsetHeight;
                
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
                    e.target.classList.contains('tool-dropdown-toggle') ||
                    e.target.classList.contains('tool-dropdown-item') ||
                    e.target.closest('.tool-dropdown-menu') ||
                    e.target.tagName === 'INPUT' ||
                    e.target.tagName === 'SELECT') {
                    return;
                }

                isDragging = true;
                const touch = e.touches[0];
                startX = touch.clientX;
                startY = touch.clientY;
                
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
                
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                const toolbarWidth = toolbar.offsetWidth;
                const toolbarHeight = toolbar.offsetHeight;
                
                newLeft = Math.max(-toolbarWidth / 2, Math.min(newLeft, viewportWidth - toolbarWidth / 2));
                newTop = Math.max(0, Math.min(newTop, viewportHeight - toolbarHeight));
                
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
                    toolbar.style.opacity = '1';
                    toolbar.style.transition = 'opacity 0.2s ease';
                }
            });
        }, */

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
