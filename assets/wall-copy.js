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
                    </div>
                    <span class="modal-close">&times;</span>
                    <button class="modal-nav modal-prev">&#10094;</button>
                    <div class="modal-image-container">
                        <img class="modal-image" src="" alt="Original Image">
                    </div>
                    <button class="modal-nav modal-next">&#10095;</button>
                    <div class="modal-caption"></div>
                `;
                document.body.appendChild(modal);
                
                // 绑定事件
                modal.querySelector('.modal-close').onclick = closeModal;
                modal.querySelector('.modal-prev').onclick = showPrevImage;
                modal.querySelector('.modal-next').onclick = showNextImage;
                modal.querySelector('.zoom-in').onclick = zoomIn;
                modal.querySelector('.zoom-out').onclick = zoomOut;
                modal.querySelector('.zoom-reset').onclick = resetZoom;
                
                // 点击背景关闭
                modal.onclick = function(e) {
                    if (e.target === modal) {
                        closeModal();
                    }
                };
                
                // 滚轮缩放
                const imgContainer = modal.querySelector('.modal-image-container');
                imgContainer.addEventListener('wheel', function(e) {
                    e.preventDefault();
                    if (e.deltaY < 0) {
                        zoomIn();
                    } else {
                        zoomOut();
                    }
                });
                
                // 拖拽功能
                const img = modal.querySelector('.modal-image');
                
                img.addEventListener('mousedown', function(e) {
                    if (currentScale > 1) {
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
                });
                
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
            img.style.transform = 'translate(' + translateX + 'px, ' + translateY + 'px) scale(' + currentScale + ')';
            
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
            applyTransform();
        }

        // 显示上一张图片
        function showPrevImage() {
            if (allImages.length <= 1) return;
            currentImageIndex = (currentImageIndex - 1 + allImages.length) % allImages.length;
            currentScale = 1;
            translateX = 0;
            translateY = 0;
            updateModalImage();
        }

        // 显示下一张图片
        function showNextImage() {
            if (allImages.length <= 1) return;
            currentImageIndex = (currentImageIndex + 1) % allImages.length;
            currentScale = 1;
            translateX = 0;
            translateY = 0;
            updateModalImage();
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