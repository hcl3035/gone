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
    
    // 存储已上传图片的映射（fileId -> imageUrl）
    let uploadedImages = {};

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
                    
                    // 生成简短ID
                    imageCounter++;
                    const imageId = userId.substr(-6) + '_' + currentDate + '_' + imageCounter;
                    
                    // 保存到 localStorage
                    localStorage.setItem('imgCounter_' + currentDate, imageCounter.toString());
                    
                    // 先显示临时预览（使用本地 Blob URL）
                    const tempUrl = URL.createObjectURL(blob);
                    
                    // 在光标位置插入图片标记
                    const startPos = textarea.selectionStart;
                    const endPos = textarea.selectionEnd;
                    const text = textarea.value;
                    
                    // 统一使用 \n 作为换行符
                    const imageMarkdown = '\n![' + imageId + ']\n';
                    
                    textarea.value = text.substring(0, startPos) + imageMarkdown + text.substring(endPos);
                    
                    // 移动光标
                    const newPos = startPos + imageMarkdown.length;
                    textarea.setSelectionRange(newPos, newPos);
                    
                    // 渲染临时预览
                    renderImagePreview(imageId, tempUrl);
                    
                    showCopyNotification('正在上传图片...');
                    
                    // 异步上传到服务器
                    uploadImageToServer(blob, imageId, function(fileId) {
                        // 上传成功，更新映射
                        uploadedImages[imageId] = wallImagePath + fileId;
                        
                        // 替换 textarea 中的标记为文件ID
                        const pattern = new RegExp('\\n!\\[' + imageId + '\\]\\n', 'g');
                        const fileMarkdown = '\n![' + fileId + ']\n';
                        textarea.value = textarea.value.replace(pattern, fileMarkdown);
                        
                        // 更新预览图片的 src
                        const previewImg = document.querySelector(`img[data-image-id="${imageId}"]`);
                        if (previewImg) {
                            previewImg.src = wallImagePath + fileId;
                            previewImg.dataset.imageUrl = wallImagePath + fileId;
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

        // 上传图片到服务器
        function uploadImageToServer(blob, imageId, onSuccess, onError) {
            const formData = new FormData();
            formData.append('file', blob, imageId + '.png');
            formData.append('downloads', '999'); // 设置较多的下载次数
            formData.append('duration', '72h'); // 设置3天有效期
            
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
                // data 是上传结果数组，取第一个文件的ID
                if (data && data.length > 0 && data[0].id) {
                    onSuccess(data[0].id);
                } else {
                    onError('No file ID returned');
                }
            })
            .catch(function(error) {
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
        function renderImagePreview(imageId, imageUrl) {
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
            img.alt = 'Image ' + imageId;
            img.title = '点击查看原图';
            img.className = 'previewImage';
            img.dataset.imageId = imageId;
            img.dataset.imageUrl = imageUrl;
            
            // 点击图片查看原图
            img.onclick = function() {
                openImageModal(imageUrl, imageId);
            };
            
            // 添加删除按钮
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'deleteImageButton';
            deleteBtn.innerHTML = '×';
            deleteBtn.title = '删除图片';
            deleteBtn.onclick = function() {
                // 从 textarea 中移除对应的标记（支持多种格式）
                const pattern1 = new RegExp('\\n!\\[' + imageId + '\\]\\n', 'g');
                const pattern2 = new RegExp('\\n!\\[' + imageId + '\\]\\r\\n', 'g');
                const pattern3 = new RegExp('\\n!\\[' + imageId + '\\]', 'g');
                
                textarea.value = textarea.value
                    .replace(pattern1, '\n')
                    .replace(pattern2, '\n')
                    .replace(pattern3, '\n');
                
                // 移除预览图片
                wrapper.remove();
                
                // 如果容器为空，移除容器
                if (previewContainer.children.length === 0) {
                    previewContainer.remove();
                }
                
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
        function openImageModal(imageUrl, imageId) {
            // 收集所有图片
            allImages = [];
            const previewImgs = document.querySelectorAll('.previewImage');
            previewImgs.forEach(function(img, index) {
                allImages.push({
                    id: img.dataset.imageId,
                    src: img.dataset.imageUrl
                });
                if (img.dataset.imageId === imageId) {
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
            
            // 匹配格式：![fileId] （支持多种换行符）
            const imagePattern = /!\[([a-zA-Z0-9_-]+)\](?:\r?\n|\r)?/g;
            let match;
            
            // 收集所有图片标记
            const fileIds = [];
            while ((match = imagePattern.exec(content)) !== null) {
                const fileId = match[1];
                console.log('Found image ID:', fileId);
                fileIds.push(fileId);
            }
            
            console.log('Total images found:', fileIds.length);
            
            if (fileIds.length === 0) {
                return;
            }
            
            // 为每个文件ID创建预览（使用 wall-image 路径，不需要认证）
            fileIds.forEach(function(fileId, index) {
                const imageUrl = wallImagePath + fileId;
                console.log('Loading image', index + 1, 'from:', imageUrl);
                
                // 先验证图片是否可以加载
                const testImg = new Image();
                testImg.onload = function() {
                    console.log('Image loaded successfully:', fileId);
                    renderImagePreview(fileId, imageUrl);
                };
                testImg.onerror = function() {
                    console.error('Failed to load image:', fileId, 'URL:', imageUrl);
                };
                testImg.src = imageUrl;
            });
        }

        // 初始解析已有图片
        if (textarea.value) {
            // 延迟执行，确保 DOM 完全准备好
            setTimeout(parseExistingImages, 300);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWallCopy);
    } else {
        initWallCopy();
    }
})();