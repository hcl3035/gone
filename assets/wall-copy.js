(function() {
    // 图片计数器（基于当天日期）
    let imageCounter = 0;
    let currentDate = '';
    
    // 用户唯一标识
    let userId = '';
    
    // 当前查看的图片索引、缩放比例和拖拽状态
    let currentImageIndex = 0;
    let currentScale = 1;
    let allImages = [];
    
    // 拖拽相关变量
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let translateX = 0;
    let translateY = 0;
    
    // 涂鸦功能相关变量
    let isDrawingMode = false;
    let isDrawing = false;
    let drawColor = '#FF0000';
    let drawWidth = 3;
    let currentCanvas = null;
    let canvasCtx = null;
    let drawingHistory = [];
    let redoHistory = [];
    
    // 高级标注工具
    let currentTool = 'brush'; // brush, eraser, text, arrow, rect, circle
    let textAnnotations = [];
    let shapeAnnotations = [];
    let currentLayer = 0;
    let layers = [{ name: '图层 1', visible: true, locked: false }];
    let layerCanvases = []; // 存储每个图层的canvas
    let activeCanvasIndex = 0; // 当前激活的图层索引

    // 水印功能相关变量
    let watermarkConfig = {
        enabled: false,
        showLocation: false,
        showDate: true,
        customText: '',
        position: 'bottom-right', // bottom-right, bottom-left, top-right, top-left, center
        opacity: 0.7,
        fontSize: 16,
        color: '#FFFFFF'
    };
    let currentLocation = null;
    
    // 存储已上传图片的映射（imageNumber -> fileId）
    let uploadedImages = {};
    
    // 存储所有图片信息（fileId -> imageUrl）
    let imageStore = {};
    
    // 全局图片序号（用于文本框显示）
    let globalImageNumber = 0;

    function initWallCopy() {
        const textarea = document.getElementById('wallContent');
        if (!textarea) {
            console.warn('wallContent textarea not found');
            return;
        }

        const box = textarea.closest('.box');
        
        // 从 textarea 的 data 属性获取 wall image 路径
        const wallImagePath = textarea.dataset.wallImagePath || '/wall-image/';

        // 生成用户唯一标识
        userId = 'user_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
        
        // 初始化日期和计数器
        const today = new Date();
        currentDate = today.getFullYear().toString().substr(-2) + 
                      String(today.getMonth() + 1).padStart(2, '0') + 
                      String(today.getDate()).padStart(2, '0');
        
        // 从 localStorage 恢复计数器
        const savedCounter = localStorage.getItem('imgCounter_' + currentDate);
        if (savedCounter) {
            imageCounter = parseInt(savedCounter);
        }
        
        // 计算当前已有多少图片，确定下一个序号
        globalImageNumber = countExistingImages(textarea.value);

        // 复制功能
        textarea.addEventListener('mouseup', function() {
            const selectedText = textarea.value.substring(
                textarea.selectionStart,
                textarea.selectionEnd
            );

            if (!selectedText || selectedText.trim() === '') {
                return;
            }

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(selectedText).then(function() {
                    showCopyNotification();
                }).catch(function(err) {
                    console.error('Failed to copy: ', err);
                    fallbackCopy(selectedText);
                });
            } else {
                fallbackCopy(selectedText);
            }
        });

        // 粘贴图片功能
        textarea.addEventListener('paste', function(e) {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    e.preventDefault();
                    
                    const blob = items[i].getAsFile();
                    
                    // 增加全局序号
                    globalImageNumber++;
                    const imageNum = globalImageNumber;
                    
                    // 生成临时ID用于上传
                    imageCounter++;
                    const tempId = currentDate + '_' + imageCounter;
                    
                    // 保存到 localStorage
                    localStorage.setItem('imgCounter_' + currentDate, imageCounter.toString());
                    
                    // 先显示临时预览（使用本地 Blob URL）
                    const tempUrl = URL.createObjectURL(blob);
                    
                    // 在光标位置插入超短标记：📷1、📷2...
                    const startPos = textarea.selectionStart;
                    const endPos = textarea.selectionEnd;
                    const text = textarea.value;
                    
                    // 使用 emoji + 序号
                    const imageMarkdown = '📷' + imageNum;
                    
                    textarea.value = text.substring(0, startPos) + imageMarkdown + text.substring(endPos);
                    
                    // 移动光标到标记后面
                    const newPos = startPos + imageMarkdown.length;
                    textarea.setSelectionRange(newPos, newPos);
                    
                    // 存储图片信息（用序号作为键）
                    imageStore['#' + imageNum] = { url: tempUrl, type: 'temp', tempId: tempId };
                    
                    // 渲染临时预览
                    renderImagePreview('#' + imageNum, tempUrl);
                    
                    showCopyNotification('正在上传图片...');
                    
                    // 异步上传到服务器
                    uploadImageToServer(blob, tempId, function(fileId) {
                        // 上传成功，更新映射
                        uploadedImages['#' + imageNum] = fileId;
                        imageStore['#' + imageNum] = { url: wallImagePath + fileId, type: 'server', fileId: fileId };
                        
                        // 更新预览图片的信息
                        const previewImg = document.querySelector(`img[data-image-id="#${imageNum}"]`);
                        if (previewImg) {
                            previewImg.src = wallImagePath + fileId;
                            previewImg.dataset.imageUrl = wallImagePath + fileId;
                            previewImg.dataset.fileId = fileId;
                            previewImg.dataset.displayNum = imageNum.toString();
                        }
                        
                        showCopyNotification('图片上传成功');
                        
                        // 触发 input 事件
                        textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    }, function(error) {
                        console.error('Upload failed:', error);
                        showCopyNotification('图片上传失败');
                    });
                    
                    break;
                }
            }
        });

        // 统计已有图片数量
        function countExistingImages(content) {
            const pattern = /📷(\d+)/g;
            let match;
            let maxNum = 0;
            while ((match = pattern.exec(content)) !== null) {
                const num = parseInt(match[1]);
                if (num > maxNum) {
                    maxNum = num;
                }
            }
            return maxNum;
        }

        // 上传图片到服务器
        function uploadImageToServer(blob, tempId, onSuccess, onError) {
            const formData = new FormData();
            formData.append('file', blob, tempId + '.png');
            formData.append('downloads', '9999');
            formData.append('duration', '168h');
            
            fetch('/upload', {
                method: 'POST',
                body: formData
            })
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('Upload failed: ' + response.status);
                }
                return response.json();
            })
            .then(function(data) {
                if (data && data.length > 0 && data[0].id) {
                    console.log('Upload success, file ID:', data[0].id);
                    onSuccess(data[0].id);
                } else {
                    onError('No file ID returned');
                }
            })
            .catch(function(error) {
                console.error('Upload error:', error);
                onError(error);
            });
        }

        // 监听textarea的resize事件，同步调整box宽度
        let isResizing = false;
        let animationFrameId = null;
        let lastBoxWidth = 0;

        function updateBoxWidth() {
            if (isResizing && box) {
                const textareaWidth = textarea.offsetWidth;
                const boxPadding = 32;
                const newWidth = textareaWidth + boxPadding;
                
                if (Math.abs(newWidth - lastBoxWidth) > 2) {
                    box.style.width = newWidth + 'px';
                    lastBoxWidth = newWidth;
                }
            }
            animationFrameId = requestAnimationFrame(updateBoxWidth);
        }

        textarea.addEventListener('mousedown', function() {
            isResizing = true;
            lastBoxWidth = box ? box.offsetWidth : 0;
            if (!animationFrameId) {
                updateBoxWidth();
            }
        });

        document.addEventListener('mouseup', function() {
            if (isResizing) {
                isResizing = false;
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                    animationFrameId = null;
                }
            }
        });

        // 窗口大小改变时重置textarea和box尺寸
        let windowResizeTimeout;
        
        window.addEventListener('resize', function() {
            clearTimeout(windowResizeTimeout);
            
            windowResizeTimeout = setTimeout(function() {
                textarea.style.width = '';
                textarea.style.height = '';
                if (box) {
                    box.style.width = '';
                }
                lastBoxWidth = 0;
            }, 50);
        });

        function fallbackCopy(text) {
            const tempTextarea = document.createElement('textarea');
            tempTextarea.value = text;
            tempTextarea.style.position = 'fixed';
            tempTextarea.style.left = '-9999px';
            document.body.appendChild(tempTextarea);
            tempTextarea.select();

            try {
                document.execCommand('copy');
                showCopyNotification();
            } catch (err) {
                console.error('Fallback copy failed: ', err);
            }

            document.body.removeChild(tempTextarea);
        }

        function showCopyNotification(message) {
            let notification = document.getElementById('copyNotification');
            if (!notification) {
                notification = document.createElement('div');
                notification.id = 'copyNotification';
                notification.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 50%;
                    transform: translateX(-50%);
                    background-color: #4CAF50;
                    color: white;
                    padding: 12px 24px;
                    border-radius: 4px;
                    z-index: 10000;
                    font-size: 14px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                    opacity: 0;
                    transition: opacity 0.3s ease;
                `;
                document.body.appendChild(notification);
            }

            notification.textContent = message || '已复制选中内容';
            notification.style.opacity = '1';
            setTimeout(function() {
                notification.style.opacity = '0';
            }, 1500);
        }

        // 渲染图片预览
        function renderImagePreview(imageKey, imageUrl, isTemp) {
            // 创建或获取预览容器
            let previewContainer = document.getElementById('imagePreviewContainer');
            if (!previewContainer) {
                previewContainer = document.createElement('div');
                previewContainer.id = 'imagePreviewContainer';
                previewContainer.className = 'imagePreviewContainer';
                
                // 将预览容器插入到 textarea 后面
                textarea.parentNode.insertBefore(previewContainer, textarea.nextSibling);
            }

            // 创建图片元素
            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = 'Image ' + imageKey;
            img.title = '点击查看原图';
            img.className = 'previewImage';
            img.dataset.imageId = imageKey;
            img.dataset.imageUrl = imageUrl;
            
            // 如果是服务器图片，设置 displayNum 和 fileId
            if (!isTemp) {
                const num = imageKey.replace('#', '');
                img.dataset.displayNum = num;
            }
            
            // 点击图片查看原图
            img.onclick = function() {
                openImageModal(imageUrl, imageKey);
            };
            
            // 添加删除按钮
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'deleteImageButton';
            deleteBtn.innerHTML = '×';
            deleteBtn.title = '删除图片';
            deleteBtn.onclick = function() {
                // 从 textarea 中移除对应的标记
                const pattern = new RegExp('📷' + imageKey.replace('#', '') + '(?!\\d)', 'g');
                textarea.value = textarea.value.replace(pattern, '');
                
                // 移除预览图片
                wrapper.remove();
                
                // 如果容器为空，移除容器
                if (previewContainer.children.length === 0) {
                    previewContainer.remove();
                }
                
                // 清理存储
                delete imageStore[imageKey];
                
                showCopyNotification('已删除图片');
            };
            
            // 创建包装器
            const wrapper = document.createElement('div');
            wrapper.className = 'imageWrapper';
            wrapper.appendChild(img);
            wrapper.appendChild(deleteBtn);
            
            previewContainer.appendChild(wrapper);
        }

        // 打开图片模态框
        function openImageModal(imageUrl, imageKey) {
            // 收集所有图片
            allImages = [];
            const previewImgs = document.querySelectorAll('.previewImage');
            previewImgs.forEach(function(img, index) {
                allImages.push({
                    id: img.dataset.imageId,
                    src: img.dataset.imageUrl
                });
                if (img.dataset.imageId === imageKey) {
                    currentImageIndex = index;
                }
            });
            
            // 重置缩放和位置
            currentScale = 1;
            translateX = 0;
            translateY = 0;
            
            // 创建或获取模态框
            let modal = document.getElementById('imageModal');
            if (!modal) {
                modal = document.createElement('div');
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
                        <button class="toolbar-btn tool-eraser" title="橡皮擦" data-tool="eraser">🧹</button>
                        <button class="toolbar-btn tool-text" title="文字" data-tool="text">T</button>
                        <button class="toolbar-btn tool-arrow" title="箭头" data-tool="arrow">➡️</button>
                        <button class="toolbar-btn tool-rect" title="矩形" data-tool="rect">⬜</button>
                        <button class="toolbar-btn tool-circle" title="圆形" data-tool="circle">⭕</button>
                        <input type="color" class="color-picker" value="#FF0000" title="选择颜色">
                        <input type="range" class="brush-size" min="1" max="20" value="3" title="画笔粗细">
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
                        <img class="modal-image" src="" alt="Original Image">
                        <div class="layers-container"></div>
                        <div class="text-input-container" style="display:none;">
                            <textarea class="text-annotation-input" placeholder="输入文字..."></textarea>
                            <button class="text-confirm-btn">确认</button>
                        </div>
                    </div>
                    <button class="modal-nav modal-next">&#10095;</button>
                    <div class="modal-caption"></div>
                    
                    <!-- 图层管理面板 -->
                    <div class="layer-panel" style="display:none;">
                        <div class="layer-panel-header">
                            <h3>图层管理</h3>
                            <button class="close-layer-panel">×</button>
                        </div>
                        <div class="layer-list"></div>
                        <button class="add-layer-btn">+ 新建图层</button>
                    </div>
                    <!-- 水印设置面板 -->
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
                
                // 绑定事件
                modal.querySelector('.modal-close').onclick = closeModal;
                modal.querySelector('.modal-prev').onclick = showPrevImage;
                modal.querySelector('.modal-next').onclick = showNextImage;
                modal.querySelector('.zoom-in').onclick = zoomIn;
                modal.querySelector('.zoom-out').onclick = zoomOut;
                modal.querySelector('.zoom-reset').onclick = resetZoom;
                
                // 标注工具事件绑定
                setupAnnotationTools(modal);
                
                // 点击背景关闭
                modal.onclick = function(e) {
                    if (e.target === modal) {
                        closeModal();
                    }
                };

                // 拖拽功能 - 支持多种触发方式
                const imgContainer = modal.querySelector('.modal-image-container');
                const img = modal.querySelector('.modal-image');
                let isSpacePressed = false;
                // 监听键盘事件（空格键）
                document.addEventListener('keydown', function(e) {
                    if (e.code === 'Space' && !isSpacePressed) {
                        isSpacePressed = true;
                        img.style.cursor = 'grab';
                        e.preventDefault(); // 防止页面滚动
                    }
                });

                document.addEventListener('keyup', function(e) {
                    if (e.code === 'Space') {
                        isSpacePressed = false;
                        img.style.cursor = '';
                        if (isDragging) {
                            isDragging = false;
                        }
                    }
                });

                // 容器上的鼠标按下事件（用于平移）
                imgContainer.addEventListener('mousedown', function(e) {
                    // 条件：1) 按住空格键 或 2) 使用手型工具 或 3) 鼠标中键
                    const canPan = isSpacePressed || currentTool === 'hand' || e.button === 1;

                    if (canPan) {
                        isDragging = true;
                        startX = e.clientX - translateX;
                        startY = e.clientY - translateY;
                        img.style.cursor = 'grabbing';
                        e.preventDefault();
                    }
                });

                // 全局鼠标移动
                document.addEventListener('mousemove', function(e) {
                    if (isDragging) {
                        translateX = e.clientX - startX;
                        translateY = e.clientY - startY;
                        applyTransform();
                        e.preventDefault();
                    }
                });

                // 全局鼠标释放
                document.addEventListener('mouseup', function(e) {
                    if (isDragging) {
                        isDragging = false;
                        // 根据当前状态恢复光标
                        if (isSpacePressed || currentTool === 'hand') {
                            img.style.cursor = 'grab';
                        } else {
                            img.style.cursor = '';
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
                        zoomIn();
                    } else {
                        zoomOut();
                    }
                });
                
                /*img.addEventListener('mousedown', function(e) {
                    if (currentScale > 1 && !isDrawingMode) {
                        isDragging = true;
                        startX = e.clientX - translateX;
                        startY = e.clientY - translateY;
                        img.style.cursor = 'grabbing';
                        e.preventDefault();
                    }
                });
                
                document.addEventListener('mousemove', function(e) {
                    if (isDragging) {
                        translateX = e.clientX - startX;
                        translateY = e.clientY - startY;
                        applyTransform();
                    }
                });
                
                document.addEventListener('mouseup', function() {
                    if (isDragging) {
                        isDragging = false;
                        img.style.cursor = 'grab';
                    }
                });*/
                
                // 键盘事件
                document.addEventListener('keydown', handleKeyDown);
            }
            
            // 显示模态框
            modal.style.display = 'flex';
            updateModalImage();
        }

        // 更新模态框图片
        function updateModalImage() {
            const modal = document.getElementById('imageModal');
            if (!modal || allImages.length === 0) return;
            
            const img = modal.querySelector('.modal-image');
            const caption = modal.querySelector('.modal-caption');
            const prevBtn = modal.querySelector('.modal-prev');
            const nextBtn = modal.querySelector('.modal-next');
            const zoomLevel = modal.querySelector('.zoom-level');
            
            img.src = allImages[currentImageIndex].src;
            caption.textContent = 'Image ' + allImages[currentImageIndex].id + ' (' + (currentImageIndex + 1) + '/' + allImages.length + ')';
            
            // 显示/隐藏导航按钮
            prevBtn.style.display = allImages.length > 1 ? 'block' : 'none';
            nextBtn.style.display = allImages.length > 1 ? 'block' : 'none';
            
            // 更新缩放显示
            zoomLevel.textContent = Math.round(currentScale * 100) + '%';
            
            // 应用变换
            applyTransform();
        }

        // 应用缩放和位移
        function applyTransform() {
            const modal = document.getElementById('imageModal');
            if (!modal) return;

            const img = modal.querySelector('.modal-image');
            const layersContainer = modal.querySelector('.layers-container');

            const transform = 'translate(' + translateX + 'px, ' + translateY + 'px) scale(' + currentScale + ')';
            img.style.transform = transform;

            if (layersContainer) {
                layersContainer.style.transform = transform;
            }

            const zoomLevel = modal.querySelector('.zoom-level');
            zoomLevel.textContent = Math.round(currentScale * 100) + '%';
        }

        // 放大
        function zoomIn() {
            currentScale = Math.min(currentScale + 0.25, 5);
            applyTransform();
        }

        // 缩小
        function zoomOut() {
            currentScale = Math.max(currentScale - 0.25, 0.25);
            if (currentScale <= 1) {
                translateX = 0;
                translateY = 0;
            }
            applyTransform();
        }

        // 重置缩放
        function resetZoom() {
            currentScale = 1;
            translateX = 0;
            translateY = 0;
            isDragging = false;
            applyTransform();
        }

        // 显示上一张图片
        function showPrevImage() {
            if (allImages.length <= 1) return;
            currentImageIndex = (currentImageIndex - 1 + allImages.length) % allImages.length;
            currentScale = 1;
            translateX = 0;
            translateY = 0;
            isDragging = false;
            updateModalImage();
            // 切换图片后重新初始化图层
            setTimeout(function() {
                initLayerSystem();
            }, 100);
        }

        // 显示下一张图片
        function showNextImage() {
            if (allImages.length <= 1) return;
            currentImageIndex = (currentImageIndex + 1) % allImages.length;
            currentScale = 1;
            translateX = 0;
            translateY = 0;
            isDragging = false;
            updateModalImage();
            // 切换图片后重新初始化图层
            setTimeout(function() {
                initLayerSystem();
            }, 100);
        }

        // 关闭模态框
        function closeModal() {
            const modal = document.getElementById('imageModal');
            if (modal) {
                modal.style.display = 'none';
            }
        }

        // 键盘事件处理
        function handleKeyDown(e) {
            const modal = document.getElementById('imageModal');
            if (modal && modal.style.display === 'block') {
                if (e.key === 'Escape') closeModal();
                if (e.key === 'ArrowLeft') showPrevImage();
                if (e.key === 'ArrowRight') showNextImage();
                if (e.key === '+' || e.key === '=') zoomIn();
                if (e.key === '-') zoomOut();
                if (e.key === '0') resetZoom();
            }
        }

        // 设置标注工具
        function setupAnnotationTools(modal) {
            const colorPicker = modal.querySelector('.color-picker');
            const brushSize = modal.querySelector('.brush-size');
            const undoBtn = modal.querySelector('.draw-undo');
            const redoBtn = modal.querySelector('.draw-redo');
            const clearBtn = modal.querySelector('.draw-clear');
            const downloadBtn = modal.querySelector('.download-annotated');
            const exportPdfBtn = modal.querySelector('.export-pdf');
            const layerManagerBtn = modal.querySelector('.layer-manager');
            const canvas = modal.querySelector('.drawing-canvas');
            const textInputContainer = modal.querySelector('.text-input-container');
            const textInput = modal.querySelector('.text-annotation-input');
            const textConfirmBtn = modal.querySelector('.text-confirm-btn');

            // 工具切换
            const toolButtons = modal.querySelectorAll('[data-tool]');
            toolButtons.forEach(btn => {
                btn.onclick = function() {
                    // 移除所有active类
                    toolButtons.forEach(b => b.classList.remove('active'));
                    // 添加active到当前按钮
                    this.classList.add('active');
                    // 设置当前工具
                    currentTool = this.dataset.tool;
                    isDrawingMode = true;

                    // 根据工具类型设置光标
                    if (currentTool === 'hand') {
                        updateAllLayerCanvasesCursor('grab');
                        showCopyNotification('按住鼠标左键拖动来平移图片');
                    } else if (currentTool === 'select') {
                        updateAllLayerCanvasesCursor('default');
                    } else if (currentTool === 'text') {
                        updateAllLayerCanvasesCursor('text');
                    } else if (currentTool === 'eraser') {
                        updateAllLayerCanvasesCursor('cell');
                    } else {
                        updateAllLayerCanvasesCursor('crosshair');
                    }

                    enableAllLayerCanvases();
                };
            });

            // 颜色选择
            colorPicker.onchange = function() {
                drawColor = this.value;
            };

            // 画笔大小
            brushSize.oninput = function() {
                drawWidth = parseInt(this.value);
            };

            // 撤销 - 针对当前图层
            undoBtn.onclick = function() {
                const currentLayerData = drawingHistory[activeCanvasIndex];
                if (currentLayerData && currentLayerData.length > 0) {
                    if (!redoHistory[activeCanvasIndex]) {
                        redoHistory[activeCanvasIndex] = [];
                    }
                    redoHistory[activeCanvasIndex].push(currentLayerData.pop());
                    restoreCurrentLayerCanvas();
                }
            };

            // 重做 - 针对当前图层
            redoBtn.onclick = function() {
                const currentLayerRedo = redoHistory[activeCanvasIndex];
                if (currentLayerRedo && currentLayerRedo.length > 0) {
                    drawingHistory[activeCanvasIndex].push(currentLayerRedo.pop());
                    restoreCurrentLayerCanvas();
                }
            };

            // 清空当前图层
            clearBtn.onclick = function() {
                const canvas = layerCanvases[activeCanvasIndex];
                if (canvas && canvas.ctx) {
                    saveCurrentLayerState();
                    canvas.ctx.clearRect(0, 0, canvas.width, canvas.height);
                }
            };

            // 下载标注后的图片
            downloadBtn.onclick = function() {
                downloadAnnotatedImage();
            };

            // 导出PDF
            exportPdfBtn.onclick = function() {
                exportToPDF();
            };

            // 图层管理
            layerManagerBtn.onclick = function() {
                toggleLayerPanel(modal);
            };

            // 水印功能
            setupWatermarkTools(modal);

            // 文字输入确认
            textConfirmBtn.onclick = function() {
                const text = textInput.value.trim();
                if (text) {
                    addTextAnnotation(text);
                }
                textInputContainer.style.display = 'none';
                textInput.value = '';
            };

            // 初始化画布和事件
            //initCanvas();
            //setupAdvancedCanvasEvents(canvas, modal);
            // 初始化图层系统
            initLayerSystem();

            // 启用文字移动功能
            makeTextAnnotationMovable();
        }

        // 初始化图层系统
        function initLayerSystem() {
            const modal = document.getElementById('imageModal');
            if (!modal) return;

            const container = modal.querySelector('.layers-container');
            if (!container) return;

            // 清空容器
            container.innerHTML = '';
            layerCanvases = [];
            drawingHistory = [[]]; // 每个图层独立的历史记录
            redoHistory = [[]];

            // 为第一个图层创建canvas
            createLayerCanvas(0, container);
        }

// 创建图层canvas
        function createLayerCanvas(index, container) {
            const modal = document.getElementById('imageModal');
            const img = modal.querySelector('.modal-image');

            const canvas = document.createElement('canvas');
            canvas.className = 'drawing-canvas';
            canvas.dataset.layerIndex = index;

            canvas.style.position = 'absolute';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.zIndex = index + 1;
            canvas.style.pointerEvents = index === activeCanvasIndex ? 'auto' : 'none';

            const setCanvasSize = function() {
                if (img.complete && img.naturalWidth > 0) {
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;

                    if (layerCanvases[index]) {
                        layerCanvases[index].width = canvas.width;
                        layerCanvases[index].height = canvas.height;
                    }
                    console.log('Canvas ' + index + ' size set:', canvas.width, 'x', canvas.height);
                }
            };

            if (img.complete && img.naturalWidth > 0) {
                setCanvasSize();
            } else {
                img.onload = function() {
                    setCanvasSize();
                };
            }

            const ctx = canvas.getContext('2d');
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = drawColor;
            ctx.lineWidth = drawWidth;

            layerCanvases[index] = {
                element: canvas,
                ctx: ctx,
                width: canvas.width || 0,
                height: canvas.height || 0
            };

            container.appendChild(canvas);

            setupLayerCanvasEvents(canvas, index);
        }

// 设置图层canvas事件
        function setupLayerCanvasEvents(canvas, layerIndex) {
            let startX = 0;
            let startY = 0;
            let tempCanvas = null;
            let tempCtx = null;

            canvas.addEventListener('mousedown', function(e) {
                if (!isDrawingMode || layerIndex !== activeCanvasIndex) return;

                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;

                startX = (e.clientX - rect.left) * scaleX;
                startY = (e.clientY - rect.top) * scaleY;

                if (currentTool === 'text') {
                    showTextInput(e.clientX, e.clientY);
                } else if (['arrow', 'rect', 'circle'].includes(currentTool)) {
                    tempCanvas = document.createElement('canvas');
                    tempCanvas.width = canvas.width;
                    tempCanvas.height = canvas.height;
                    tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
                    tempCtx.drawImage(canvas, 0, 0);
                    isDrawing = true;
                } else if (currentTool === 'brush' || currentTool === 'eraser') {
                    isDrawing = true;
                    saveCurrentLayerState();

                    const ctx = layerCanvases[layerIndex].ctx;
                    ctx.beginPath();
                    ctx.moveTo(startX, startY);
                }
            });

            canvas.addEventListener('mousemove', function(e) {
                if (!isDrawing || !isDrawingMode || layerIndex !== activeCanvasIndex) return;

                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;

                const x = (e.clientX - rect.left) * scaleX;
                const y = (e.clientY - rect.top) * scaleY;

                const ctx = layerCanvases[layerIndex].ctx;

                if (currentTool === 'brush') {
                    ctx.strokeStyle = drawColor;
                    ctx.lineWidth = drawWidth;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.lineTo(x, y);
                    ctx.stroke();
                } else if (currentTool === 'eraser') {
                    ctx.globalCompositeOperation = 'destination-out';
                    ctx.lineWidth = drawWidth * 5;
                    ctx.lineCap = 'round';
                    ctx.lineTo(x, y);
                    ctx.stroke();
                    ctx.globalCompositeOperation = 'source-over';
                } else if (['arrow', 'rect', 'circle'].includes(currentTool)) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.putImageData(tempCtx.getImageData(0, 0, canvas.width, canvas.height), 0, 0);

                    ctx.strokeStyle = drawColor;
                    ctx.lineWidth = drawWidth;

                    if (currentTool === 'arrow') {
                        drawArrow(ctx, startX, startY, x, y);
                    } else if (currentTool === 'rect') {
                        ctx.strokeRect(startX, startY, x - startX, y - startY);
                    } else if (currentTool === 'circle') {
                        const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
                        ctx.beginPath();
                        ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
                        ctx.stroke();
                    }
                }
            });

            canvas.addEventListener('mouseup', function(e) {
                if (!isDrawing || layerIndex !== activeCanvasIndex) return;
                isDrawing = false;

                if (['arrow', 'rect', 'circle'].includes(currentTool)) {
                    saveCurrentLayerState();
                    const rect = canvas.getBoundingClientRect();
                    const scaleX = canvas.width / rect.width;
                    const scaleY = canvas.height / rect.height;
                    const endX = (e.clientX - rect.left) * scaleX;
                    const endY = (e.clientY - rect.top) * scaleY;

                    shapeAnnotations.push({
                        layer: layerIndex,
                        type: currentTool,
                        start: { x: startX, y: startY },
                        end: { x: endX, y: endY },
                        color: drawColor,
                        width: drawWidth
                    });
                }
            });

            canvas.addEventListener('mouseout', function() {
                isDrawing = false;
            });
        }

        // 更新所有图层canvas的光标
        function updateAllLayerCanvasesCursor(cursorType) {
            layerCanvases.forEach(layer => {
                if (layer && layer.element) {
                    layer.element.style.cursor = cursorType;
                }
            });
        }

        // 启用所有图层canvas的指针事件（用于切换激活图层时）
        function enableAllLayerCanvases() {
            layerCanvases.forEach((layer, index) => {
                if (layer && layer.element) {
                    layer.element.style.pointerEvents = index === activeCanvasIndex ? 'auto' : 'none';
                }
            });
        }


        // 设置水印工具
        function setupWatermarkTools(modal) {
            const watermarkPanel = modal.querySelector('.watermark-panel');
            if (!watermarkPanel) {
                console.warn('Watermark panel not found, skipping setup');
                return;
            }

            const closePanelBtn = watermarkPanel.querySelector('.close-watermark-panel');
            const applyBtn = watermarkPanel.querySelector('#applyWatermarkBtn');
            const getLocationBtn = watermarkPanel.querySelector('#getLocationBtn');

            // 查找或创建水印按钮
            let watermarkToggle = modal.querySelector('.watermark-toggle');
            if (!watermarkToggle) {
                // 在工具栏中添加水印按钮
                const toolbar = modal.querySelector('.modal-toolbar');
                if (!toolbar) {
                    console.warn('Toolbar not found');
                    return;
                }

                watermarkToggle = document.createElement('button');
                watermarkToggle.className = 'toolbar-btn watermark-toggle';
                watermarkToggle.title = '水印设置';
                watermarkToggle.innerHTML = '💧';

                // 在导出PDF按钮之前插入
                const exportPdfBtn = toolbar.querySelector('.export-pdf');
                if (exportPdfBtn) {
                    toolbar.insertBefore(watermarkToggle, exportPdfBtn);
                } else {
                    toolbar.appendChild(watermarkToggle);
                }
            }

            // 水印按钮点击事件 - 关键修复！
            watermarkToggle.onclick = function() {
                const panel = modal.querySelector('.watermark-panel');
                if (panel) {
                    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
                    console.log('Watermark panel toggled:', panel.style.display);
                } else {
                    console.error('Watermark panel not found on toggle');
                }
            };

            // 关闭面板
            if (closePanelBtn) {
                closePanelBtn.onclick = function() {
                    watermarkPanel.style.display = 'none';
                };
            }

            // 启用/禁用水印
            const enabledCheckbox = watermarkPanel.querySelector('#watermarkEnabled');
            if (enabledCheckbox) {
                enabledCheckbox.onchange = function() {
                    watermarkConfig.enabled = this.checked;
                    updateWatermarkPreview(modal);
                };
            }

            // 显示位置
            const locationCheckbox = watermarkPanel.querySelector('#watermarkLocation');
            if (locationCheckbox) {
                locationCheckbox.onchange = function() {
                    watermarkConfig.showLocation = this.checked;
                    updateWatermarkPreview(modal);
                };
            }

            // 显示日期
            const dateCheckbox = watermarkPanel.querySelector('#watermarkDate');
            if (dateCheckbox) {
                dateCheckbox.onchange = function() {
                    watermarkConfig.showDate = this.checked;
                    updateWatermarkPreview(modal);
                };
            }

            // 自定义文字
            const customTextInput = watermarkPanel.querySelector('#watermarkCustomText');
            if (customTextInput) {
                customTextInput.oninput = function() {
                    watermarkConfig.customText = this.value;
                    updateWatermarkPreview(modal);
                };
            }

            // 位置选择
            const positionSelect = watermarkPanel.querySelector('#watermarkPosition');
            if (positionSelect) {
                positionSelect.onchange = function() {
                    watermarkConfig.position = this.value;
                    updateWatermarkPreview(modal);
                };
            }

            // 透明度
            const opacitySlider = watermarkPanel.querySelector('#watermarkOpacity');
            const opacityValue = watermarkPanel.querySelector('#opacityValue');
            if (opacitySlider) {
                opacitySlider.oninput = function() {
                    watermarkConfig.opacity = parseFloat(this.value);
                    if (opacityValue) {
                        opacityValue.textContent = this.value;
                    }
                    updateWatermarkPreview(modal);
                };
            }

            // 字体大小
            const fontSizeInput = watermarkPanel.querySelector('#watermarkFontSize');
            if (fontSizeInput) {
                fontSizeInput.onchange = function() {
                    watermarkConfig.fontSize = parseInt(this.value);
                    updateWatermarkPreview(modal);
                };
            }

            // 颜色
            const colorPicker = watermarkPanel.querySelector('#watermarkColor');
            if (colorPicker) {
                colorPicker.onchange = function() {
                    watermarkConfig.color = this.value;
                    updateWatermarkPreview(modal);
                };
            }

            // 获取地理位置
            if (getLocationBtn) {
                getLocationBtn.onclick = function() {
                    getCurrentLocation(modal);
                };
            }

            // 应用水印
            if (applyBtn) {
                applyBtn.onclick = function() {
                    applyWatermarkToImage(modal);
                };
            }

            console.log('Watermark tools setup complete');
        }

        // 获取当前位置
        function getCurrentLocation(modal) {
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
                    currentLocation = { lat, lng };

                    // 使用反向地理编码获取地址（可选，需要API）
                    locationInfo.innerHTML = `                        ✅ 已获取位置<br>
                        纬度: ${lat}<br>
                        经度: ${lng}                    `;

                    updateWatermarkPreview(modal);
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
                    locationInfo.textContent = errorMsg;
                },
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                }
            );
        }

        // 更新水印预览
        function updateWatermarkPreview(modal) {
            const previewCanvas = modal.querySelector('#watermarkPreviewCanvas');
            if (!previewCanvas) return;

            const ctx = previewCanvas.getContext('2d');
            previewCanvas.width = 300;
            previewCanvas.height = 200;

            // 绘制示例背景
            ctx.fillStyle = '#333';
            ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

            // 生成水印文本
            const watermarkText = generateWatermarkText();
            if (!watermarkText) return;

            // 计算位置
            const pos = calculateWatermarkPosition(previewCanvas.width, previewCanvas.height, watermarkText, ctx);

            // 绘制水印
            ctx.globalAlpha = watermarkConfig.opacity;
            ctx.font = `${watermarkConfig.fontSize}px Arial`;
            ctx.fillStyle = watermarkConfig.color;
            ctx.fillText(watermarkText, pos.x, pos.y);
            ctx.globalAlpha = 1;
        }

        // 生成水印文本
        function generateWatermarkText() {
            let parts = [];

            if (watermarkConfig.customText) {
                parts.push(watermarkConfig.customText);
            }

            if (watermarkConfig.showLocation && currentLocation) {
                parts.push(`${currentLocation.lat}, ${currentLocation.lng}`);
            }

            if (watermarkConfig.showDate) {
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
        }

        // 计算水印位置
        function calculateWatermarkPosition(canvasWidth, canvasHeight, text, ctx) {
            const metrics = ctx.measureText(text);
            const textWidth = metrics.width;
            const textHeight = watermarkConfig.fontSize;
            const padding = 10;

            let x, y;

            switch(watermarkConfig.position) {
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
        }

        // 应用水印到图片
        function applyWatermarkToImage(modal) {
            const img = modal.querySelector('.modal-image');
            const canvas = layerCanvases[activeCanvasIndex];

            if (!watermarkConfig.enabled) {
                showCopyNotification('请先启用水印');
                return;
            }

            const watermarkText = generateWatermarkText();
            if (!watermarkText) {
                showCopyNotification('请至少选择一个水印内容');
                return;
            }

            if (!canvas || !canvas.ctx) {
                showCopyNotification('画布未初始化');
                return;
            }

            // 在当前图层上绘制水印
            canvas.ctx.save();
            canvas.ctx.globalAlpha = watermarkConfig.opacity;
            canvas.ctx.font = `${watermarkConfig.fontSize}px Arial`;
            canvas.ctx.fillStyle = watermarkConfig.color;

            const pos = calculateWatermarkPosition(canvas.width, canvas.height, watermarkText, canvas.ctx);
            canvas.ctx.fillText(watermarkText, pos.x, pos.y);

            canvas.ctx.restore();

            saveCurrentLayerState();
            showCopyNotification('水印已应用');

            // 关闭面板
            modal.querySelector('.watermark-panel').style.display = 'none';
        }

        // 应用水印到图片
        function applyWatermarkToImage(modal) {
            const img = modal.querySelector('.modal-image');
            const canvas = layerCanvases[activeCanvasIndex];

            if (!watermarkConfig.enabled) {
                showCopyNotification('请先启用水印');
                return;
            }

            const watermarkText = generateWatermarkText();
            if (!watermarkText) {
                showCopyNotification('请至少选择一个水印内容');
                return;
            }

            if (!canvas || !canvas.ctx) {
                showCopyNotification('画布未初始化');
                return;
            }

            // 在当前图层上绘制水印
            canvas.ctx.save();
            canvas.ctx.globalAlpha = watermarkConfig.opacity;
            canvas.ctx.font = `${watermarkConfig.fontSize}px Arial`;
            canvas.ctx.fillStyle = watermarkConfig.color;

            const pos = calculateWatermarkPosition(canvas.width, canvas.height, watermarkText, canvas.ctx);
            canvas.ctx.fillText(watermarkText, pos.x, pos.y);

            canvas.ctx.restore();

            saveCurrentLayerState();
            showCopyNotification('水印已应用');

            // 关闭面板
            modal.querySelector('.watermark-panel').style.display = 'none';
        }

        // 添加移动文字标注的功能
        function makeTextAnnotationMovable() {
            const modal = document.getElementById('imageModal');
            if (!modal) return;

            let selectedTextIndex = -1;
            let isDraggingText = false;
            let dragStartX = 0;
            let dragStartY = 0;

            const canvas = layerCanvases[activeCanvasIndex];
            if (!canvas || !canvas.element) return;

            // 监听鼠标按下事件
            canvas.element.addEventListener('mousedown', function(e) {
                // 只在选择工具或文字工具时启用
                if (currentTool !== 'select' && currentTool !== 'text') return;

                const rect = canvas.element.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;

                const x = (e.clientX - rect.left) * scaleX;
                const y = (e.clientY - rect.top) * scaleY;

                // 检查是否点击了文字（从后往前找，优先选择最上层的）
                for (let i = textAnnotations.length - 1; i >= 0; i--) {
                    const annotation = textAnnotations[i];
                    if (annotation.layer !== activeCanvasIndex) continue;

                    // 估算文字宽度（每个字符约0.6倍字体大小）
                    const estimatedWidth = annotation.text.length * (annotation.size * 0.6);

                    // 碰撞检测
                    if (x >= annotation.x && x <= annotation.x + estimatedWidth &&
                        y >= annotation.y - annotation.size && y <= annotation.y) {
                        selectedTextIndex = i;
                        isDraggingText = true;
                        dragStartX = x;
                        dragStartY = y;

                        // 保存状态用于撤销
                        saveCurrentLayerState();
                        e.preventDefault();
                        break;
                    }
                }
            });

            canvas.element.addEventListener('mousemove', function(e) {
                if (!isDraggingText || selectedTextIndex === -1) return;

                const rect = canvas.element.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;

                const x = (e.clientX - rect.left) * scaleX;
                const y = (e.clientY - rect.top) * scaleY;

                // 更新文字位置
                const annotation = textAnnotations[selectedTextIndex];
                annotation.x += x - dragStartX;
                annotation.y += y - dragStartY;
                dragStartX = x;
                dragStartY = y;

                // 重绘当前图层
                redrawCurrentLayer();
            });

            canvas.element.addEventListener('mouseup', function() {
                if (isDraggingText) {
                    isDraggingText = false;
                    selectedTextIndex = -1;
                }
            });

            canvas.element.addEventListener('mouseout', function() {
                if (isDraggingText) {
                    isDraggingText = false;
                    selectedTextIndex = -1;
                }
            });
        }

        // 重绘当前图层（清除并重新绘制所有文字标注）
        function redrawCurrentLayer() {
            const canvas = layerCanvases[activeCanvasIndex];
            if (!canvas || !canvas.ctx) return;

            // 清空画布
            canvas.ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 重新绘制所有文字标注
            textAnnotations.forEach(function(annotation) {
                if (annotation.layer === activeCanvasIndex) {
                    canvas.ctx.font = `${annotation.size}px Arial`;
                    canvas.ctx.fillStyle = annotation.color;
                    canvas.ctx.fillText(annotation.text, annotation.x, annotation.y);
                }
            });
        }


        // 设置高级画布事件
        /*function setupAdvancedCanvasEvents(canvas, modal) {
            let startX = 0;
            let startY = 0;
            let tempCanvas = null;
            let tempCtx = null;

            canvas.addEventListener('mousedown', function(e) {
                if (!isDrawingMode) return;

                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;

                startX = (e.clientX - rect.left) * scaleX;
                startY = (e.clientY - rect.top) * scaleY;

                if (currentTool === 'text') {
                    showTextInput(e.clientX, e.clientY);
                } else if (['arrow', 'rect', 'circle'].includes(currentTool)) {
                    // 保存当前状态用于形状预览
                    tempCanvas = document.createElement('canvas');
                    tempCanvas.width = canvas.width;
                    tempCanvas.height = canvas.height;
                    tempCtx = tempCanvas.getContext('2d');
                    tempCtx.drawImage(canvas, 0, 0);
                    isDrawing = true;
                } else if (currentTool === 'brush' || currentTool === 'eraser') {
                    isDrawing = true;
                    saveCanvasState();

                    canvasCtx.beginPath();
                    canvasCtx.moveTo(startX, startY);
                }
            });

            canvas.addEventListener('mousemove', function(e) {
                if (!isDrawing) return;

                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;

                const x = (e.clientX - rect.left) * scaleX;
                const y = (e.clientY - rect.top) * scaleY;

                if (currentTool === 'brush') {
                    canvasCtx.strokeStyle = drawColor;
                    canvasCtx.lineWidth = drawWidth;
                    canvasCtx.lineCap = 'round';
                    canvasCtx.lineJoin = 'round';
                    canvasCtx.lineTo(x, y);
                    canvasCtx.stroke();
                } else if (currentTool === 'eraser') {
                    canvasCtx.globalCompositeOperation = 'destination-out';
                    canvasCtx.lineWidth = drawWidth * 5;
                    canvasCtx.lineCap = 'round';
                    canvasCtx.lineTo(x, y);
                    canvasCtx.stroke();
                    canvasCtx.globalCompositeOperation = 'source-over';
                } else if (['arrow', 'rect', 'circle'].includes(currentTool)) {
                    // 清除并重绘
                    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
                    canvasCtx.putImageData(tempCtx.getImageData(0, 0, canvas.width, canvas.height), 0, 0);

                    canvasCtx.strokeStyle = drawColor;
                    canvasCtx.lineWidth = drawWidth;

                    if (currentTool === 'arrow') {
                        drawArrow(canvasCtx, startX, startY, x, y);
                    } else if (currentTool === 'rect') {
                        canvasCtx.strokeRect(startX, startY, x - startX, y - startY);
                    } else if (currentTool === 'circle') {
                        const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
                        canvasCtx.beginPath();
                        canvasCtx.arc(startX, startY, radius, 0, 2 * Math.PI);
                        canvasCtx.stroke();
                    }
                }
            });

            canvas.addEventListener('mouseup', function(e) {
                if (!isDrawing) return;
                isDrawing = false;

                if (['arrow', 'rect', 'circle'].includes(currentTool)) {
                    saveCanvasState();
                    // 保存形状信息
                    const rect = canvas.getBoundingClientRect();
                    const scaleX = canvas.width / rect.width;
                    const scaleY = canvas.height / rect.height;
                    const endX = (e.clientX - rect.left) * scaleX;
                    const endY = (e.clientY - rect.top) * scaleY;

                    shapeAnnotations.push({
                        type: currentTool,
                        start: { x: startX, y: startY },
                        end: { x: endX, y: endY },
                        color: drawColor,
                        width: drawWidth
                    });
                }
            });

            canvas.addEventListener('mouseout', function() {
                isDrawing = false;
            });
        }*/

        // 绘制箭头
        function drawArrow(ctx, fromX, fromY, toX, toY) {
            const headLength = 15;
            const angle = Math.atan2(toY - fromY, toX - fromX);
            
            ctx.beginPath();
            ctx.moveTo(fromX, fromY);
            ctx.lineTo(toX, toY);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(toX, toY);
            ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fillStyle = drawColor;
            ctx.fill();
        }

        // 显示文字输入框
        function showTextInput(clientX, clientY) {
            const modal = document.getElementById('imageModal');
            if (!modal) return;

            const textInputContainer = modal.querySelector('.text-input-container');
            const textInput = modal.querySelector('.text-annotation-input');
            const canvas = layerCanvases[activeCanvasIndex];

            if (!canvas) return;

            // 将视口坐标转换为相对于canvas容器的坐标
            const containerRect = modal.querySelector('.modal-image-container').getBoundingClientRect();
            const relativeX = clientX - containerRect.left;
            const relativeY = clientY - containerRect.top;

            textInputContainer.style.display = 'block';
            textInputContainer.style.left = relativeX + 'px';
            textInputContainer.style.top = relativeY + 'px';
            textInput.focus();
        }

        // 添加文字标注
        function addTextAnnotation(text) {
            const modal = document.getElementById('imageModal');
            if (!modal) return;

            const canvas = layerCanvases[activeCanvasIndex];
            if (!canvas || !canvas.ctx) {
                console.error('Canvas not initialized');
                showCopyNotification('画布未初始化');
                return;
            }

            const textInputContainer = modal.querySelector('.text-input-container');

            // 获取文字输入框相对于容器的位置
            const containerRect = modal.querySelector('.modal-image-container').getBoundingClientRect();
            const inputRect = textInputContainer.getBoundingClientRect();

            // 计算相对于容器的坐标
            const containerX = inputRect.left - containerRect.left;
            const containerY = inputRect.top - containerRect.top;

            // 转换为canvas坐标系（考虑缩放）
            const canvasRect = canvas.element.getBoundingClientRect();
            const scaleX = canvas.width / canvasRect.width;
            const scaleY = canvas.height / canvasRect.height;

            const canvasX = containerX * scaleX;
            const canvasY = containerY * scaleY;

            canvas.ctx.font = `${drawWidth * 5 + 10}px Arial`;
            canvas.ctx.fillStyle = drawColor;
            canvas.ctx.fillText(text, canvasX, canvasY);

            textAnnotations.push({
                layer: activeCanvasIndex,
                text: text,
                x: canvasX,
                y: canvasY,
                color: drawColor,
                size: drawWidth * 5 + 10
            });

            saveCurrentLayerState();
        }

        // 保存当前图层状态
        function saveCurrentLayerState() {
            if (!drawingHistory[activeCanvasIndex]) {
                drawingHistory[activeCanvasIndex] = [];
            }

            const canvas = layerCanvases[activeCanvasIndex];
            if (canvas && canvas.element) {
                drawingHistory[activeCanvasIndex].push(canvas.element.toDataURL());
                if (!redoHistory[activeCanvasIndex]) {
                    redoHistory[activeCanvasIndex] = [];
                }
                redoHistory[activeCanvasIndex] = []; // 清空重做历史
            }
        }

        // 恢复当前图层canvas
        function restoreCurrentLayerCanvas() {
            const canvas = layerCanvases[activeCanvasIndex];
            if (!canvas || !canvas.element) return;

            const history = drawingHistory[activeCanvasIndex];
            if (!history || history.length === 0) return;

            const img = new Image();
            img.onload = function() {
                canvas.ctx.clearRect(0, 0, canvas.element.width, canvas.element.height);
                canvas.ctx.drawImage(img, 0, 0);
            };
            img.src = history[history.length - 1];
        }

        // 图层管理
        function toggleLayerPanel(modal) {
            const panel = modal.querySelector('.layer-panel');
            if (panel.style.display === 'none') {
                panel.style.display = 'block';
                renderLayerList(modal);
            } else {
                panel.style.display = 'none';
            }
        }

        // 渲染图层列表
        function renderLayerList(modal) {
            const layerList = modal.querySelector('.layer-list');
            layerList.innerHTML = '';

            layers.forEach((layer, index) => {
                const layerItem = document.createElement('div');
                layerItem.className = 'layer-item';
                if (index === activeCanvasIndex) {
                    layerItem.style.border = '2px solid #4CAF50';
                }
                layerItem.innerHTML = `                    <input type="checkbox" ${layer.visible ? 'checked' : ''} class="layer-visible">
                    <span class="layer-name">${layer.name}</span>
                    <button class="layer-select" data-index="${index}" title="选中此图层">●</button>
                    <button class="layer-delete" data-index="${index}" title="删除图层">×</button>
                `;

                const visibleCheckbox = layerItem.querySelector('.layer-visible');
                visibleCheckbox.onchange = function() {
                    layers[index].visible = this.checked;
                    // 显示/隐藏对应的canvas
                    if (layerCanvases[index] && layerCanvases[index].element) {
                        layerCanvases[index].element.style.display = this.checked ? 'block' : 'none';
                    }
                };

                const selectBtn = layerItem.querySelector('.layer-select');
                selectBtn.onclick = function() {
                    // 切换到该图层
                    activeCanvasIndex = index;
                    enableAllLayerCanvases();
                    renderLayerList(modal); // 重新渲染以更新高亮
                    showCopyNotification(`已切换到: ${layer.name}`);
                };

                const deleteBtn = layerItem.querySelector('.layer-delete');
                deleteBtn.onclick = function() {
                    if (layers.length > 1) {
                        deleteLayer(index, modal);
                    } else {
                        showCopyNotification('至少保留一个图层');
                    }
                };

                layerList.appendChild(layerItem);
            });

            const addLayerBtn = modal.querySelector('.add-layer-btn');
            addLayerBtn.onclick = function() {
                addNewLayer(modal);
            };

            const closeBtn = modal.querySelector('.close-layer-panel');
            closeBtn.onclick = function() {
                modal.querySelector('.layer-panel').style.display = 'none';
            };
        }

        // 添加新图层
        function addNewLayer(modal) {
            const newIndex = layers.length;
            layers.push({
                name: `图层 ${newIndex + 1}`,
                visible: true,
                locked: false
            });

            const container = modal.querySelector('.layers-container');
            createLayerCanvas(newIndex, container);

            // 切换到新图层
            activeCanvasIndex = newIndex;
            enableAllLayerCanvases();

            renderLayerList(modal);
            showCopyNotification(`已创建: 图层 ${newIndex + 1}`);
        }

        // 删除图层
        function deleteLayer(index, modal) {
            // 删除canvas
            if (layerCanvases[index] && layerCanvases[index].element) {
                layerCanvases[index].element.remove();
            }

            // 从数组中移除
            layers.splice(index, 1);
            layerCanvases.splice(index, 1);
            drawingHistory.splice(index, 1);
            redoHistory.splice(index, 1);

            // 调整activeCanvasIndex
            if (activeCanvasIndex >= layers.length) {
                activeCanvasIndex = layers.length - 1;
            }

            // 重新编号和重建canvas
            rebuildLayerCanvases(modal);

            renderLayerList(modal);
            showCopyNotification('图层已删除');
        }

        // 重建所有图层canvas（删除后重新排序）
        function rebuildLayerCanvases(modal) {
            const container = modal.querySelector('.layers-container');
            container.innerHTML = '';

            const oldCanvases = [...layerCanvases];
            layerCanvases = [];

            layers.forEach((layer, index) => {
                createLayerCanvas(index, container);

                // 如果有旧的数据，复制过来
                if (oldCanvases[index] && oldCanvases[index].element) {
                    const newCanvas = layerCanvases[index].element;
                    const newCtx = layerCanvases[index].ctx;
                    newCtx.drawImage(oldCanvases[index].element, 0, 0);

                    // 恢复可见性
                    newCanvas.style.display = layer.visible ? 'block' : 'none';
                }
            });

            enableAllLayerCanvases();
        }

        // 导出为PDF
        function exportToPDF() {
            const modal = document.getElementById('imageModal');
            if (!modal) return;
            
            const img = modal.querySelector('.modal-image');

            // 创建临时canvas合并内容
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = img.naturalWidth;
            tempCanvas.height = img.naturalHeight;
            const ctx = tempCanvas.getContext('2d');
            
            ctx.drawImage(img, 0, 0);
            // 绘制所有可见图层
            layerCanvases.forEach((layer, index) => {
                if (layer && layer.element && layers[index].visible) {
                    ctx.drawImage(layer.element, 0, 0);
                }
            });

            // 如果启用了水印，添加水印
            if (watermarkConfig.enabled) {
                const watermarkText = generateWatermarkText();
                if (watermarkText) {
                    ctx.globalAlpha = watermarkConfig.opacity;
                    ctx.font = `${watermarkConfig.fontSize * (img.naturalWidth / img.offsetWidth)}px Arial`;
                    ctx.fillStyle = watermarkConfig.color;

                    const pos = calculateWatermarkPosition(tempCanvas.width, tempCanvas.height, watermarkText, ctx);
                    ctx.fillText(watermarkText, pos.x, pos.y);
                    ctx.globalAlpha = 1;
                }
            }

            // 转换为PDF（简单实现：使用浏览器打印功能）
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>标注图片</title>
                    <style>
                        body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                        img { max-width: 100%; height: auto; }
                        @media print { body { margin: 0; } }
                    </style>
                </head>
                <body>
                    <img src="${tempCanvas.toDataURL('image/png')}" />
                    <script>
                        setTimeout(function() { window.print(); }, 500);
                    <\/script>
                </body>
                </html>
            `);
            printWindow.document.close();
            
            showCopyNotification('正在导出PDF...');
        }

        // 初始化画布
        /*function initCanvas() {
            const modal = document.getElementById('imageModal');
            if (!modal) return;
            
            const container = modal.querySelector('.modal-image-container');
            const img = modal.querySelector('.modal-image');
            const canvas = modal.querySelector('.drawing-canvas');
            
            if (!img.complete || img.naturalWidth === 0) {
                img.onload = function() {
                    setupCanvasSize(canvas, img, container);
                };
            } else {
                setupCanvasSize(canvas, img, container);
            }
        }
        
        // 设置画布尺寸
        function setupCanvasSize(canvas, img, container) {
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            canvas.style.width = img.offsetWidth + 'px';
            canvas.style.height = img.offsetHeight + 'px';
            
            canvasCtx = canvas.getContext('2d');
            canvasCtx.lineCap = 'round';
            canvasCtx.lineJoin = 'round';
            canvasCtx.strokeStyle = drawColor;
            canvasCtx.lineWidth = drawWidth;
            
            // 绑定绘画事件
            setupCanvasEvents(canvas);
        }
        
        // 设置画布事件
        function setupCanvasEvents(canvas) {
            let lastX = 0;
            let lastY = 0;
            
            canvas.addEventListener('mousedown', function(e) {
                if (!isDrawingMode) return;
                
                isDrawing = true;
                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;
                
                lastX = (e.clientX - rect.left) * scaleX;
                lastY = (e.clientY - rect.top) * scaleY;
                
                // 保存状态用于撤销
                saveCanvasState();
            });
            
            canvas.addEventListener('mousemove', function(e) {
                if (!isDrawing || !isDrawingMode) return;
                
                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;
                
                const x = (e.clientX - rect.left) * scaleX;
                const y = (e.clientY - rect.top) * scaleY;
                
                canvasCtx.strokeStyle = drawColor;
                canvasCtx.lineWidth = drawWidth;
                canvasCtx.beginPath();
                canvasCtx.moveTo(lastX, lastY);
                canvasCtx.lineTo(x, y);
                canvasCtx.stroke();
                
                lastX = x;
                lastY = y;
            });
            
            canvas.addEventListener('mouseup', function() {
                isDrawing = false;
            });
            
            canvas.addEventListener('mouseout', function() {
                isDrawing = false;
            });
        }
        
        // 保存画布状态
        function saveCanvasState() {
            const modal = document.getElementById('imageModal');
            if (!modal) return;
            
            const canvas = modal.querySelector('.drawing-canvas');
            if (canvas) {
                drawingHistory.push(canvas.toDataURL());
                redoHistory = []; // 清空重做历史
            }
        }
        
        // 恢复画布状态
        function restoreCanvas() {
            const modal = document.getElementById('imageModal');
            if (!modal) return;
            
            const canvas = modal.querySelector('.drawing-canvas');
            if (!canvas || drawingHistory.length === 0) return;
            
            const img = new Image();
            img.onload = function() {
                canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
                canvasCtx.drawImage(img, 0, 0);
            };
            img.src = drawingHistory[drawingHistory.length - 1];
        }*/
        
        // 下载标注后的图片
        function downloadAnnotatedImage() {
            const modal = document.getElementById('imageModal');
            if (!modal) return;
            
            const img = modal.querySelector('.modal-image');

            
            // 创建一个临时 canvas 合并图片和标注
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = img.naturalWidth;
            tempCanvas.height = img.naturalHeight;
            const ctx = tempCanvas.getContext('2d');
            
            // 绘制原图
            ctx.drawImage(img, 0, 0);

            // 按顺序绘制所有可见图层
            layerCanvases.forEach((layer, index) => {
                if (layer && layer.element && layers[index].visible) {
                    ctx.drawImage(layer.element, 0, 0);
                }
            });

            // 如果启用了水印，添加水印
            if (watermarkConfig.enabled) {
                const watermarkText = generateWatermarkText();
                if (watermarkText) {
                    ctx.globalAlpha = watermarkConfig.opacity;
                    ctx.font = `${watermarkConfig.fontSize * (img.naturalWidth / img.offsetWidth)}px Arial`;
                    ctx.fillStyle = watermarkConfig.color;

                    const pos = calculateWatermarkPosition(tempCanvas.width, tempCanvas.height, watermarkText, ctx);
                    ctx.fillText(watermarkText, pos.x, pos.y);
                    ctx.globalAlpha = 1;
                }
            }

            // 下载
            const link = document.createElement('a');
            link.download = 'annotated_image_' + Date.now() + '.png';
            link.href = tempCanvas.toDataURL('image/png');
            link.click();
            
            showCopyNotification('图片已下载');
        }

        // 页面加载时，解析已有的图片并显示预览
        function parseExistingImages() {
            const content = textarea.value;
            console.log('Parsing existing images, content length:', content.length);
            
            // 匹配格式：📷1、📷2...
            const imagePattern = /📷(\d+)/g;
            let match;
            
            // 收集所有图片序号
            const imageNums = [];
            while ((match = imagePattern.exec(content)) !== null) {
                const num = match[1];
                console.log('Found image number:', num);
                imageNums.push(num);
            }
            
            console.log('Total images found:', imageNums.length);
            
            if (imageNums.length === 0) {
                return;
            }
            
            // 从隐藏字段中读取映射关系
            loadWallImageMapping(imageNums);
        }

        // 从服务器加载图片映射
        function loadWallImageMapping(imageNums) {
            const mapDataElement = document.getElementById('wallImageMapData');
            if (!mapDataElement) {
                console.warn('wallImageMapData element not found');
                return;
            }
            
            let imageMap = {};
            try {
                // 从 script 标签的 textContent 读取 JSON
                const mapJson = mapDataElement.textContent.trim();
                console.log('Raw map data:', mapJson);
                
                if (mapJson && mapJson !== '{}') {
                    imageMap = JSON.parse(mapJson);
                    console.log('Loaded image map from server:', imageMap);
                }
            } catch(e) {
                console.error('Failed to parse image map:', e, 'Raw data:', mapDataElement.textContent);
                return;
            }
            
            if (Object.keys(imageMap).length === 0) {
                console.log('No image mapping available');
                return;
            }
            
            // 为每个图片序号创建预览
            imageNums.forEach(function(num, index) {
                const fileId = imageMap[num];
                if (fileId) {
                    const imageUrl = wallImagePath + fileId;
                    const imageKey = '#' + num;
                    
                    console.log('Loading image #' + num + ' (fileId: ' + fileId + ') from:', imageUrl);
                    
                    // 存储图片信息
                    imageStore[imageKey] = { url: imageUrl, type: 'server', fileId: fileId };
                    
                    // 验证图片是否可以加载
                    const testImg = new Image();
                    testImg.onload = function() {
                        console.log('Image loaded successfully: #' + num);
                        renderImagePreview(imageKey, imageUrl, false);
                        
                        // 设置显示序号
                        const img = document.querySelector(`img[data-file-id="${fileId}"]`);
                        if (img) {
                            img.dataset.displayNum = num;
                        }
                    };
                    testImg.onerror = function() {
                        console.error('Failed to load image: #' + num, 'URL:', imageUrl);
                    };
                    testImg.src = imageUrl;
                } else {
                    console.log('No mapping found for image #' + num);
                }
            });
        }

        // 初始解析已有图片
        if (textarea.value) {
            setTimeout(parseExistingImages, 300);
        }
        
        // 监听表单提交事件，保存当前所有图片的映射关系
        const wallForm = document.getElementById('wallForm');
        if (wallForm) {
            wallForm.addEventListener('submit', function(e) {
                console.log('Form submitting, collecting image mappings...');
                
                // 构建当前所有图片的映射（displayNum -> fileId）
                const imageMap = {};
                
                // 方法1：从预览图片元素收集
                const previewImgs = document.querySelectorAll('.previewImage');
                console.log('Found preview images:', previewImgs.length);
                previewImgs.forEach(function(img) {
                    const displayNum = img.dataset.displayNum;
                    const fileId = img.dataset.fileId;
                    console.log('Preview img - displayNum:', displayNum, 'fileId:', fileId);
                    if (displayNum && fileId) {
                        imageMap[displayNum] = fileId;
                    }
                });
                
                // 方法2：如果从 DOM 收集的不够，从 imageStore 补充
                for (const key in imageStore) {
                    if (imageStore.hasOwnProperty(key)) {
                        const info = imageStore[key];
                        if (info.type === 'server' && info.fileId) {
                            const num = key.replace('#', '');
                            if (!imageMap[num]) {
                                console.log('Adding from imageStore:', num, '->', info.fileId);
                                imageMap[num] = info.fileId;
                            }
                        }
                    }
                }
                
                console.log('Collected image map:', imageMap);
                
                // 将映射转换为 JSON 并存入隐藏字段
                const imageMapInput = document.getElementById('wallImageMap');
                if (imageMapInput) {
                    imageMapInput.value = JSON.stringify(imageMap);
                    console.log('Saved image map to hidden field:', imageMapInput.value);
                } else {
                    console.error('wallImageMap input element not found!');
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWallCopy);
    } else {
        initWallCopy();
    }
})();